"""Collect one or more sitting days from the source and check them."""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from ingestion.constituencies import CONSTITUENCIES, Seat
from ingestion.models import Ballot, Chamber, Vote
from ingestion.parse import (
    parse_ballots_page,
    parse_day_page,
    parse_members_page,
    parse_sitting_days,
    skip_reason,
)

log = logging.getLogger(__name__)

# Ballots moved between choices, summed, before a vote is rejected. Two is
# a single member counted under a different choice.
MAX_TALLY_DRIFT = 4


class Source(Protocol):
    def sitting_days(self, year: int, month: int) -> str: ...
    def day_page(self, day: date) -> str: ...
    def ballots_page(self, vote_id: int) -> str: ...
    def members_page(self, chamber: Chamber, legislature: int) -> str: ...


class SourceMismatchError(RuntimeError):
    """The source contradicts itself, or changed in a way we do not handle."""


@dataclass(frozen=True, slots=True)
class DayData:
    day: date
    votes: list[Vote]
    ballots: list[Ballot]


def sitting_days_between(source: Source, start: date, end: date) -> list[date]:
    """Days with votes in the inclusive range, according to the calendar."""
    days: list[date] = []
    for year, month in _months(start, end):
        days.extend(parse_sitting_days(source.sitting_days(year, month)))
    return [day for day in days if start <= day <= end]


def collect_day(source: Source, day: date) -> DayData:
    """Fetch and verify every vote of a sitting day.

    The calendar occasionally lists a day whose vote table is empty; that day
    is logged and skipped. (A page that is not a vote table at all is caught
    when fetching, and rows that cannot be read raise ParseError.)
    """
    votes = parse_day_page(source.day_page(day), day)
    if not votes:
        log.warning("%s: listed as a sitting day but its vote table is empty", day)
        return DayData(day=day, votes=[], ballots=[])

    kept: list[Vote] = []
    ballots: list[Ballot] = []
    for vote in votes:
        if reason := skip_reason(vote):
            log.info("vote %s skipped: %s (%s)", vote.id, reason, vote.title)
            continue
        vote_ballots = parse_ballots_page(source.ballots_page(vote.id), vote.id)
        _verify(vote, vote_ballots)
        kept.append(vote)
        ballots.extend(vote_ballots)

    log.info("%s: %d votes, %d ballots", day, len(kept), len(ballots))
    return DayData(day=day, votes=kept, ballots=ballots)


def collect_seats(source: Source, legislature: int) -> list[Seat]:
    """Fetch which constituency every deputy and senator was elected in.

    Members elected nationally (the national minorities' deputies) hold no
    constituency seat and are absent from the result.
    """
    seats: list[Seat] = []
    for chamber in (Chamber.DEPUTIES, Chamber.SENATE):
        found = parse_members_page(source.members_page(chamber, legislature))
        wrong = [
            seat for seat in found if (seat.chamber, seat.legislature) != (chamber, legislature)
        ]
        if wrong:
            raise SourceMismatchError(
                f"{chamber.value} list for {legislature} contains other members, "
                f"e.g. {wrong[0].name}"
            )
        # Every constituency elects members to both chambers, so a gap means
        # the page was cut short or its format changed.
        missing = sorted(set(CONSTITUENCIES) - {seat.constituency for seat in found})
        if missing:
            raise SourceMismatchError(
                f"{chamber.value}, legislature {legislature}: no members found for "
                f"constituencies {missing}"
            )
        seats.extend(found)

    holders = {(seat.chamber, seat.legislature, seat.mp_source_id) for seat in seats}
    if len(holders) != len(seats):
        raise SourceMismatchError("a member is listed more than once")
    log.info("legislature %d: %d seats", legislature, len(seats))
    return seats


def _verify(vote: Vote, ballots: list[Ballot]) -> None:
    """Check the ballots against the vote's published totals.

    The number of ballots must equal the members present. The split between
    choices may differ slightly: cdep.ro's own ballot list and its summary
    occasionally disagree by a vote (seen on vote 37439, where both the HTML
    and XML lists say 196 for and the summary 195). Both are stored as
    published and the difference is logged; a larger gap means a parsing fault.
    """
    if len(ballots) != vote.present:
        raise SourceMismatchError(
            f"vote {vote.id}: {len(ballots)} ballots do not match the official tally of "
            f"{vote.present} members present"
        )
    counted = Counter(ballot.choice for ballot in ballots)
    parsed = {choice: counted.get(choice, 0) for choice in vote.tally}
    drift = sum(abs(parsed[choice] - vote.tally[choice]) for choice in vote.tally)
    if drift > MAX_TALLY_DRIFT:
        raise SourceMismatchError(
            f"vote {vote.id}: ballots {_show(parsed)} do not match the official "
            f"tally {_show(vote.tally)}"
        )
    if drift:
        log.warning(
            "vote %s: ballots %s differ from the official tally %s; both kept as published",
            vote.id,
            _show(parsed),
            _show(vote.tally),
        )
    members = {(ballot.chamber, ballot.legislature, ballot.mp_source_id) for ballot in ballots}
    if len(members) != len(ballots):
        raise SourceMismatchError(f"vote {vote.id}: a member appears more than once")


def _show(tally: dict) -> str:
    return ", ".join(f"{choice.value}={count}" for choice, count in tally.items())


def _months(start: date, end: date) -> Iterator[tuple[int, int]]:
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        yield year, month
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
