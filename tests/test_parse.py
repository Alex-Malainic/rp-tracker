from datetime import date, time

import pytest

from ingestion.models import Chamber, Choice
from ingestion.parse import (
    ParseError,
    normalize_group,
    parse_ballots_page,
    parse_day_page,
    parse_sitting_days,
    skip_reason,
)
from tests.conftest import ballots_html, day_html, vote_row

DAY = date(2025, 6, 18)


class TestSittingDays:
    def test_sorts_the_unordered_feed(self):
        assert parse_sitting_days(",20261104,20261111,20261102") == [
            date(2026, 11, 2),
            date(2026, 11, 4),
            date(2026, 11, 11),
        ]

    @pytest.mark.parametrize("text", ["", ",", "\n"])
    def test_month_without_sittings(self, text):
        assert parse_sitting_days(text) == []

    def test_rejects_an_error_page(self):
        with pytest.raises(ParseError):
            parse_sitting_days("<html>Service unavailable</html>")


class TestNormalizeGroup:
    @pytest.mark.parametrize(
        ("label", "expected"),
        [
            ("PSD", "PSD"),
            ("PNL(afiliat)", "PNL"),
            ("PNL (afiliat)", "PNL"),
            ("  SOS  RO ", "SOS RO"),
            ("Neafiliati", "Neafiliati"),
        ],
    )
    def test_labels(self, label, expected):
        assert normalize_group(label) == expected

    def test_rejects_an_empty_label(self):
        with pytest.raises(ParseError):
            normalize_group("  ")


class TestDayPage:
    def test_chamber_day(self, fixture_text):
        votes = parse_day_page(fixture_text("day_chamber.html"), DAY)

        assert len(votes) == 15
        first = votes[0]
        assert first.id == 35367
        assert first.sitting_date == DAY
        assert first.time == time(10, 3)
        assert first.chamber is Chamber.DEPUTIES
        assert first.title == "Modificarea ordinii de zi"
        assert not first.is_final
        assert first.bill_url is None
        assert first.source_url == (
            "https://www.cdep.ro/ords/pls/steno/evot2015.nominal?idv=35367&idl=1"
        )
        assert (first.present, first.votes_for, first.votes_against) == (180, 130, 43)
        assert (first.abstained, first.not_voted) == (5, 2)

    def test_final_vote_with_its_bill(self, fixture_text):
        votes = {vote.id: vote for vote in parse_day_page(fixture_text("day_chamber.html"), DAY)}
        vote = votes[35382]

        assert vote.is_final
        assert vote.title == "Vot final - PL-x 166/2025 - adoptare"
        assert vote.bill_title.startswith("PL 166/2025 pentru modificarea şi completarea Legii")
        assert vote.bill_url == (
            "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect?idp=22376"
        )

    def test_a_bill_row_applies_only_to_the_next_vote(self, fixture_text):
        votes = {vote.id: vote for vote in parse_day_page(fixture_text("day_chamber.html"), DAY)}

        assert votes[35367].bill_title is None
        assert votes[35372].bill_title.startswith("PHCD 39/2025")
        assert votes[35373].bill_title.startswith("PHCD 44/2025")
        assert "Ziua Maramureşului" in votes[35374].bill_title

    def test_dash_means_zero(self, fixture_text):
        votes = {vote.id: vote for vote in parse_day_page(fixture_text("day_chamber.html"), DAY)}

        assert votes[35373].not_voted == 0

    def test_joint_sitting(self, fixture_text):
        votes = parse_day_page(fixture_text("day_joint.html"), date(2026, 11, 10))

        assert len(votes) == 13
        assert {vote.chamber for vote in votes} == {Chamber.JOINT}
        assert votes[0].id == 37480

    def test_votes_without_a_time(self, fixture_text):
        votes = parse_day_page(fixture_text("day_no_time.html"), date(2026, 11, 11))

        assert len(votes) == 8
        assert all(vote.time is None for vote in votes)

    def test_resolution_rows_are_attached_too(self, fixture_text):
        votes = parse_day_page(fixture_text("day_no_time.html"), date(2026, 11, 11))

        assert any(vote.bill_title and vote.bill_title.startswith("PHCD") for vote in votes)

    def test_page_without_votes(self):
        assert parse_day_page("<html><body><p>Nothing here</p></body></html>", DAY) == []

    def test_missing_column_fails_loudly(self):
        html = day_html(vote_row(1)).replace('data-label="Pentru"', 'data-label="Da"')
        with pytest.raises(ParseError, match="missing column"):
            parse_day_page(html, DAY)

    def test_a_missing_did_not_vote_column_is_derived(self):
        # Whole days are published without the column (seen on 2025-02-17).
        html = day_html(vote_row(1, tally=("229", "78", "55", "96", "0")))
        html = html.replace('<td data-label="Nu au votat*">0</td>', "")

        (vote,) = parse_day_page(html, DAY)

        assert (vote.present, vote.votes_for, vote.not_voted) == (229, 78, 0)

    def test_a_derived_negative_count_fails_loudly(self):
        html = day_html(vote_row(1, tally=("10", "8", "5", "0", "0")))
        html = html.replace('<td data-label="Nu au votat*">0</td>', "")

        with pytest.raises(ParseError, match="more votes than members present"):
            parse_day_page(html, DAY)

    def test_vote_links_without_recognised_rows_fail_loudly(self):
        html = day_html(vote_row(1)).replace('data-label="Descriere"', 'data-label="Subiect"')

        with pytest.raises(ParseError, match="no vote rows were recognised"):
            parse_day_page(html, DAY)

    def test_non_numeric_tally_fails_loudly(self):
        html = day_html(vote_row(1, tally=("3", "many", "1", "1", "-")))
        with pytest.raises(ParseError, match="expected a number"):
            parse_day_page(html, DAY)


class TestSkipReason:
    def parse_one(self, **kwargs):
        return parse_day_page(day_html(vote_row(1, **kwargs)), DAY)[0]

    def test_real_vote(self):
        assert skip_reason(self.parse_one()) is None

    @pytest.mark.parametrize("title", ["Vot test 2", "vot test"])
    def test_test_vote(self, title):
        assert skip_reason(self.parse_one(title=title)) == "test vote"

    def test_attendance_check(self):
        vote = self.parse_one(title="Prezenta", tally=("195", "-", "-", "-", "-"))
        assert skip_reason(vote) == "attendance check"


class TestBallotsPage:
    def test_chamber_vote(self, fixture_text):
        ballots = parse_ballots_page(fixture_text("ballots_chamber.html"), 37498)

        assert len(ballots) == 14
        first = ballots[0]
        assert first.vote_id == 37498
        assert first.mp_source_id == 1
        assert first.chamber is Chamber.DEPUTIES
        assert first.legislature == 2024
        assert first.name == "Adomnicăi Mirela Elena"
        assert first.group == "PSD"
        assert first.choice is Choice.FOR

    def test_all_choices_are_mapped(self, fixture_text):
        ballots = parse_ballots_page(fixture_text("ballots_joint.html"), 37484)

        assert {ballot.choice for ballot in ballots} == set(Choice)

    def test_joint_vote_lists_senators_and_deputies(self, fixture_text):
        ballots = parse_ballots_page(fixture_text("ballots_joint.html"), 37484)

        assert {ballot.chamber for ballot in ballots} == {Chamber.SENATE, Chamber.DEPUTIES}
        senator = ballots[0]
        assert (senator.name, senator.chamber, senator.group) == (
            "Abrudean Mircea",
            Chamber.SENATE,
            "PNL",
        )

    def test_affiliated_members_count_for_the_party(self, fixture_text):
        ballots = parse_ballots_page(fixture_text("ballots_chamber.html"), 37498)

        assert not any("(afiliat)" in ballot.group for ballot in ballots)
        assert "Neafiliati" in {ballot.group for ballot in ballots}

    def test_unknown_choice_fails_loudly(self):
        with pytest.raises(ParseError, match="unexpected ballot row"):
            parse_ballots_page(ballots_html((1, "Pop Ion", "PSD", "MAYBE")), 1)

    def test_missing_vote_column_fails_loudly(self):
        link = '<a href="structura2015.mp?idm=1&cam=2&leg=2024">Pop Ion</a>'
        html = f"<table><tr><td>1.</td><td>{link}</td><td>PSD</td></tr></table>"
        with pytest.raises(ParseError, match="unexpected ballot row"):
            parse_ballots_page(html, 1)
