from datetime import date, time

import pytest

from ingestion import load
from ingestion.models import Ballot, Chamber, Choice, Vote
from tests.conftest import FakeDb


def make_vote(vote_id: int = 7, **overrides) -> Vote:
    fields = {
        "id": vote_id,
        "sitting_date": date(2026, 11, 10),
        "time": time(12, 18),
        "chamber": Chamber.DEPUTIES,
        "title": "Vot final - PL-x 1/2026 - adoptare",
        "is_final": True,
        "bill_title": "PL 1/2026 privind ceva",
        "bill_url": "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect?idp=1",
        "source_url": f"https://www.cdep.ro/ords/pls/steno/evot2015.nominal?idv={vote_id}&idl=1",
        "present": 2,
        "votes_for": 1,
        "votes_against": 1,
        "abstained": 0,
        "not_voted": 0,
    }
    return Vote(**{**fields, **overrides})


def make_ballot(vote_id: int, mp_id: int, group: str, choice: Choice, **overrides) -> Ballot:
    fields = {
        "vote_id": vote_id,
        "mp_source_id": mp_id,
        "chamber": Chamber.DEPUTIES,
        "legislature": 2024,
        "name": f"Member {mp_id}",
        "group": group,
        "choice": choice,
    }
    return Ballot(**{**fields, **overrides})


BALLOTS = [make_ballot(7, 1, "PSD", Choice.FOR), make_ballot(7, 2, "PNL", Choice.AGAINST)]


def test_writes_every_table_with_resolved_foreign_keys():
    db = FakeDb()

    load.load(db, [make_vote()], BALLOTS)

    parties = {row["abbreviation"]: row for row in db.rows("parties")}
    mps = {row["source_id"]: row for row in db.rows("mps")}
    assert parties["PSD"]["name"] == "Partidul Social Democrat"
    assert mps[1]["party_id"] == parties["PSD"]["id"]
    assert mps[1]["chamber"] == "deputies"
    assert sorted(db.rows("ballots"), key=lambda row: row["mp_id"]) == [
        {"vote_id": 7, "mp_id": mps[1]["id"], "party_id": parties["PSD"]["id"], "choice": "for"},
        {
            "vote_id": 7,
            "mp_id": mps[2]["id"],
            "party_id": parties["PNL"]["id"],
            "choice": "against",
        },
    ]


def test_vote_row_is_json_ready():
    db = FakeDb()

    load.load(db, [make_vote()], BALLOTS)

    (row,) = db.rows("votes")
    assert row["id"] == 7
    assert row["sitting_date"] == "2026-11-10"
    assert row["voted_time"] == "12:18:00"
    assert row["chamber"] == "deputies"
    assert row["votes_for"] == 1


def test_vote_without_a_time():
    db = FakeDb()

    load.load(db, [make_vote(time=None)], BALLOTS)

    assert db.rows("votes")[0]["voted_time"] is None


def test_loading_twice_changes_nothing():
    db = FakeDb()

    load.load(db, [make_vote()], BALLOTS)
    first = {name: db.rows(name) for name in db.tables}
    load.load(db, [make_vote()], BALLOTS)

    assert {name: db.rows(name) for name in db.tables} == first


def test_unknown_group_keeps_its_label():
    db = FakeDb()

    load.load(db, [make_vote()], [make_ballot(7, 1, "XYZ", Choice.FOR)])

    assert db.rows("parties")[0]["name"] == "XYZ"


def test_member_keeps_latest_group_but_ballots_keep_the_group_at_the_time():
    db = FakeDb()
    ballots = [make_ballot(7, 1, "PSD", Choice.FOR), make_ballot(8, 1, "PNL", Choice.FOR)]

    load.load(db, [make_vote(7), make_vote(8)], ballots)

    parties = {row["abbreviation"]: row["id"] for row in db.rows("parties")}
    (mp,) = db.rows("mps")
    assert mp["party_id"] == parties["PNL"]
    assert {row["vote_id"]: row["party_id"] for row in db.rows("ballots")} == {
        7: parties["PSD"],
        8: parties["PNL"],
    }


def test_senator_and_deputy_with_the_same_source_id_are_different_people():
    db = FakeDb()
    ballots = [
        make_ballot(7, 1, "PSD", Choice.FOR),
        make_ballot(7, 1, "PSD", Choice.FOR, chamber=Chamber.SENATE),
    ]

    load.load(db, [make_vote(chamber=Chamber.JOINT)], ballots)

    assert len(db.rows("mps")) == 2
    assert len(db.rows("ballots")) == 2


def test_large_loads_are_sent_in_batches(monkeypatch):
    monkeypatch.setattr(load, "BATCH_SIZE", 2)
    db = FakeDb()
    ballots = [make_ballot(7, mp_id, "PSD", Choice.FOR) for mp_id in range(1, 6)]

    load.load(db, [make_vote()], ballots)

    assert len(db.rows("ballots")) == 5


def test_nothing_to_load():
    db = FakeDb()

    load.load(db, [], [])

    assert db.tables == {}


def test_connect_names_the_missing_variable(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)

    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        load.connect()
