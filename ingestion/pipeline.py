"""Collect one or more sitting days from the source and check them."""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from ingestion.models import Ballot, Vote
from ingestion.parse import (
    parse_ballots_page,
    parse_day_page,
    parse_sitting_days,
    skip_reason,
)

log = logging.getLogger(__name__)


class Source(Protocol):
    def sitting_days(self, year: int, month: int) -> str: ...
    def day_page(self, day: date) -> str: ...
    def ballots_page(self, vote_id: int) -> str: ...


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

    The caller is expected to pass days taken from the sitting calendar, so a
    day page without votes means the page format changed.
    """
    votes = parse_day_page(source.day_page(day), day)
    if not votes:
        raise SourceMismatchError(f"{day}: listed as a sitting day but no votes were found")

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


def _verify(vote: Vote, ballots: list[Ballot]) -> None:
    counted = Counter(ballot.choice for ballot in ballots)
    parsed = {choice: counted.get(choice, 0) for choice in vote.tally}
    if parsed != vote.tally:
        raise SourceMismatchError(
            f"vote {vote.id}: ballots {_show(parsed)} do not match the official "
            f"tally {_show(vote.tally)}"
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
