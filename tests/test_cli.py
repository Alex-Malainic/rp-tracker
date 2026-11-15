from datetime import date

import pytest

from ingestion import cli
from tests.conftest import FakeDb, FakeSource, ballots_html, day_html, vote_row

DAY = date(2026, 11, 10)
MEMBERS = (
    (1, "Pop Ion", "PSD", "DA"),
    (2, "Rus Ana", "PNL", "NU"),
    (3, "Toma Dan", "USR", "AB"),
)


@pytest.fixture
def source():
    return FakeSource(days={DAY: day_html(vote_row(7))}, ballots={7: ballots_html(*MEMBERS)})


def test_run_loads_sitting_days_and_refreshes_stats(source):
    db = FakeDb()

    total = cli.run(source, db, date(2026, 11, 1), date(2026, 11, 30))

    assert total == 1
    assert len(db.rows("votes")) == 1
    assert len(db.rows("ballots")) == 3
    assert db.rpc_calls == ["refresh_stats"]


def test_run_is_idempotent(source):
    db = FakeDb()

    cli.run(source, db, DAY, DAY)
    first = {name: db.rows(name) for name in db.tables}
    cli.run(source, db, DAY, DAY)

    assert {name: db.rows(name) for name in db.tables} == first


def test_run_without_sitting_days_touches_nothing(source):
    db = FakeDb()

    assert cli.run(source, db, date(2026, 11, 14), date(2026, 11, 15)) == 0
    assert db.tables == {}
    assert db.rpc_calls == []


def test_dry_run_needs_no_database(source):
    assert cli.run(source, None, DAY, DAY) == 1


@pytest.mark.parametrize(
    "argv",
    [
        ["--date", "2026-11-10", "--from", "2026-11-01"],
        ["--to", "2026-11-10"],
        ["--from", "2026-11-10", "--to", "2026-11-01"],
        ["--date", "10.11.2026"],
    ],
)
def test_invalid_arguments_are_rejected(argv):
    with pytest.raises(SystemExit) as exit_info:
        cli.main(argv)
    assert exit_info.value.code == 2
