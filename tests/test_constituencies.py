import httpx
import pytest

from ingestion import cli, load
from ingestion.constituencies import CONSTITUENCIES, Seat
from ingestion.fetch import BASE_URL, CdepClient
from ingestion.models import Chamber, Choice
from ingestion.parse import ParseError, parse_members_page
from ingestion.pipeline import SourceMismatchError, collect_seats
from tests.conftest import FakeDb, FakeSource, members_html
from tests.test_load import make_ballot, make_vote


class TestRegionTable:
    def test_covers_all_43_constituencies(self):
        assert sorted(CONSTITUENCIES) == list(range(1, 44))

    def test_every_region_is_used_and_names_are_unique(self):
        names = [name for name, _ in CONSTITUENCIES.values()]
        regions = {region for _, region in CONSTITUENCIES.values()}

        assert len(set(names)) == 43
        assert len(regions) == 9  # eight development regions and the diaspora

    @pytest.mark.parametrize(
        ("number", "name", "region"),
        [
            (13, "Cluj", "nord-vest"),
            (25, "Ilfov", "bucuresti-ilfov"),
            (35, "Suceava", "nord-est"),
            (42, "București", "bucuresti-ilfov"),
            (43, "Diaspora", "diaspora"),
        ],
    )
    def test_known_constituencies(self, number, name, region):
        assert CONSTITUENCIES[number] == (name, region)


class TestParse:
    def test_deputies(self, fixture_text):
        seats = parse_members_page(fixture_text("members_deputies.html"))

        assert seats[0] == Seat(
            constituency=35,
            chamber=Chamber.DEPUTIES,
            legislature=2024,
            mp_source_id=1,
            name="Adomnicăi Mirela Elena",
        )
        assert {seat.chamber for seat in seats} == {Chamber.DEPUTIES}

    def test_nationally_elected_members_have_no_seat(self, fixture_text):
        html = fixture_text("members_deputies.html")
        seats = parse_members_page(html)

        # The fixture includes national minority deputies, who are listed
        # without a constituency.
        assert html.count("structura2015.mp?idm=") > len(seats)
        assert "Ganţ Ovidiu Victor" not in {seat.name for seat in seats}

    def test_senators(self, fixture_text):
        seats = parse_members_page(fixture_text("members_senators.html"))

        assert seats[0] == Seat(13, Chamber.SENATE, 2024, 1, "Abrudean Mircea")
        assert {seat.chamber for seat in seats} == {Chamber.SENATE}

    def test_page_without_members(self):
        assert parse_members_page("<html><body></body></html>") == []

    def test_unknown_number_fails_loudly(self):
        with pytest.raises(ParseError, match="unknown constituency number 99"):
            parse_members_page(members_html((7, "Pop Ion", 99)))

    def test_unexpected_label_fails_loudly(self):
        html = members_html((7, "Pop Ion", 5)).replace("5 / NAME", "Bihor")
        with pytest.raises(ParseError, match="unexpected constituency label"):
            parse_members_page(html)


def full_source() -> FakeSource:
    """A source with one deputy and one senator in each constituency."""
    source = FakeSource()
    source.members[Chamber.DEPUTIES] = members_html(
        *((number, f"Deputy {number}", number) for number in CONSTITUENCIES),
        (900, "Minority Deputy", None),
    )
    source.members[Chamber.SENATE] = members_html(
        *((number, f"Senator {number}", number) for number in CONSTITUENCIES), chamber=1
    )
    return source


class TestCollect:
    def test_collects_both_chambers(self):
        seats = collect_seats(full_source(), 2024)

        assert len(seats) == 86
        assert {seat.chamber for seat in seats} == {Chamber.DEPUTIES, Chamber.SENATE}

    def test_a_constituency_without_members_fails_loudly(self):
        source = full_source()
        source.members[Chamber.SENATE] = members_html(
            *((number, f"Senator {number}", number) for number in CONSTITUENCIES if number != 5),
            chamber=1,
        )

        with pytest.raises(SourceMismatchError, match=r"senate.*no members found.*\[5\]"):
            collect_seats(source, 2024)

    def test_a_list_for_the_wrong_chamber_fails_loudly(self):
        source = full_source()
        source.members[Chamber.SENATE] = source.members[Chamber.DEPUTIES]

        with pytest.raises(SourceMismatchError, match="contains other members"):
            collect_seats(source, 2024)

    def test_a_member_listed_twice_fails_loudly(self):
        source = full_source()
        source.members[Chamber.DEPUTIES] += members_html((1, "Deputy 1", 2))

        with pytest.raises(SourceMismatchError, match="more than once"):
            collect_seats(source, 2024)


class TestLoad:
    def seeded_db(self) -> FakeDb:
        db = FakeDb()
        ballots = [
            make_ballot(7, 1, "PSD", Choice.FOR),
            make_ballot(7, 2, "PNL", Choice.AGAINST),
            make_ballot(7, 1, "PSD", Choice.FOR, chamber=Chamber.SENATE),
        ]
        load.load(db, [make_vote(chamber=Chamber.JOINT, present=3, votes_for=2)], ballots)
        return db

    def test_sets_the_constituency_of_known_members(self):
        db = self.seeded_db()
        seats = [
            Seat(35, Chamber.DEPUTIES, 2024, 1, "Member 1"),
            Seat(13, Chamber.DEPUTIES, 2024, 2, "Member 2"),
            Seat(13, Chamber.SENATE, 2024, 1, "Member 1"),
        ]

        assert load.load_seats(db, seats) == 3

        found = {
            (row["chamber"], row["source_id"]): row["constituency_id"] for row in db.rows("mps")
        }
        assert found == {("deputies", 1): 35, ("deputies", 2): 13, ("senate", 1): 13}

    def test_writes_the_constituency_table(self):
        db = self.seeded_db()

        load.load_seats(db, [])

        rows = {row["id"]: row for row in db.rows("constituencies")}
        assert len(rows) == 43
        assert rows[35] == {"id": 35, "name": "Suceava", "region": "nord-est"}

    def test_members_without_ballots_are_skipped(self):
        db = self.seeded_db()

        assert load.load_seats(db, [Seat(1, Chamber.DEPUTIES, 2024, 999, "Nobody")]) == 0
        assert len(db.rows("mps")) == 3

    def test_is_idempotent(self):
        db = self.seeded_db()
        seats = [Seat(35, Chamber.DEPUTIES, 2024, 1, "Member 1")]

        load.load_seats(db, seats)
        first = {name: db.rows(name) for name in db.tables}
        load.load_seats(db, seats)

        assert {name: db.rows(name) for name in db.tables} == first


class TestCli:
    def test_run_loads_seats_and_refreshes_stats(self):
        db = FakeDb()

        assert cli.run_constituencies(full_source(), db, 2024) == 86
        assert len(db.rows("constituencies")) == 43
        assert db.rpc_calls == ["refresh_stats"]

    def test_dry_run_needs_no_database(self):
        assert cli.run_constituencies(full_source(), None, 2024) == 86

    def test_dates_are_rejected(self):
        with pytest.raises(SystemExit) as exit_info:
            cli.main(["--constituencies", "--date", "2026-11-10"])
        assert exit_info.value.code == 2


def test_client_requests_the_member_list():
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, text=members_html((1, "Pop Ion", 1), chamber=1))

    http = httpx.Client(base_url=BASE_URL, transport=httpx.MockTransport(handler))
    CdepClient(http, sleep=lambda seconds: None).members_page(Chamber.SENATE, 2024)

    assert seen == ["https://www.cdep.ro/ords/pls/parlam/structura2015.de?cam=1&leg=2024&idl=1"]
