from datetime import date

import pytest

from ingestion.models import Choice
from ingestion.pipeline import SourceMismatchError, collect_day, sitting_days_between
from tests.conftest import FakeSource, ballots_html, day_html, vote_row

DAY = date(2026, 11, 10)

MEMBERS = (
    (1, "Pop Ion", "PSD", "DA"),
    (2, "Rus Ana", "PNL(afiliat)", "NU"),
    (3, "Toma Dan", "USR", "AB"),
)


def source_with(day_page: str, ballots: dict[int, str]) -> FakeSource:
    return FakeSource(days={DAY: day_page}, ballots=ballots)


class TestCollectDay:
    def test_returns_votes_with_their_ballots(self):
        source = source_with(day_html(vote_row(7)), {7: ballots_html(*MEMBERS)})

        data = collect_day(source, DAY)

        assert [vote.id for vote in data.votes] == [7]
        assert [ballot.choice for ballot in data.ballots] == [
            Choice.FOR,
            Choice.AGAINST,
            Choice.ABSTAIN,
        ]

    def test_skips_test_votes_and_attendance_checks_without_fetching_them(self):
        page = day_html(
            vote_row(5, title="Vot test 1"),
            vote_row(6, title="Prezenta", tally=("195", "-", "-", "-", "-")),
            vote_row(7),
        )
        source = source_with(page, {7: ballots_html(*MEMBERS)})  # 5 and 6 would raise KeyError

        assert [vote.id for vote in collect_day(source, DAY).votes] == [7]

    def test_tally_mismatch_fails_loudly(self):
        source = source_with(day_html(vote_row(7)), {7: ballots_html(*MEMBERS[:2])})

        with pytest.raises(SourceMismatchError, match="do not match the official tally"):
            collect_day(source, DAY)

    def test_duplicate_member_fails_loudly(self):
        page = day_html(vote_row(7, tally=("2", "2", "-", "-", "-")))
        twice = ballots_html((1, "Pop Ion", "PSD", "DA"), (1, "Pop Ion", "PSD", "DA"))

        with pytest.raises(SourceMismatchError, match="more than once"):
            collect_day(source_with(page, {7: twice}), DAY)

    def test_a_sitting_day_with_an_empty_vote_table_is_skipped(self, caplog):
        data = collect_day(source_with(day_html(), {}), DAY)

        assert (data.votes, data.ballots) == ([], [])
        assert "vote table is empty" in caplog.text

    def test_a_one_vote_disagreement_with_the_summary_is_kept_and_logged(self, caplog):
        # Seen on vote 37439: the ballot list says 2 for, the summary 1.
        page = day_html(vote_row(7, tally=("3", "1", "2", "-", "-")))
        ballots = ballots_html(
            (1, "Pop Ion", "PSD", "DA"), (4, "Ene Ana", "PSD", "DA"), (2, "Rus Ana", "PNL", "NU")
        )
        source = source_with(page, {7: ballots})

        data = collect_day(source, DAY)

        assert [vote.id for vote in data.votes] == [7]
        assert len(data.ballots) == 3
        assert "differ from the official tally" in caplog.text

    def test_a_large_disagreement_with_the_summary_fails_loudly(self):
        page = day_html(vote_row(7, tally=("3", "-", "3", "-", "-")))
        source = source_with(
            page, {7: ballots_html(*((n, f"M{n}", "PSD", "DA") for n in (1, 2, 3)))}
        )

        with pytest.raises(SourceMismatchError, match="do not match the official tally"):
            collect_day(source, DAY)


class TestSittingDaysBetween:
    def test_filters_to_the_range(self):
        days = [date(2026, 10, 28), date(2026, 11, 2), date(2026, 11, 10), date(2026, 12, 1)]
        source = FakeSource(days=dict.fromkeys(days, ""))

        found = sitting_days_between(source, date(2026, 11, 1), date(2026, 11, 30))

        assert found == [date(2026, 11, 2), date(2026, 11, 10)]
        assert source.calendar_requests == [(2026, 11)]

    def test_spans_a_year_boundary(self):
        source = FakeSource(days={date(2024, 12, 23): "", date(2025, 2, 3): ""})

        found = sitting_days_between(source, date(2024, 12, 1), date(2025, 2, 28))

        assert found == [date(2024, 12, 23), date(2025, 2, 3)]
        assert source.calendar_requests == [(2024, 12), (2025, 1), (2025, 2)]
