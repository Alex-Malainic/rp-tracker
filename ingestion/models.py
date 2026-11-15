"""Plain data structures shared by the parser, the loader and the API."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from enum import StrEnum


class Chamber(StrEnum):
    DEPUTIES = "deputies"
    SENATE = "senate"
    JOINT = "joint"


class Choice(StrEnum):
    FOR = "for"
    AGAINST = "against"
    ABSTAIN = "abstain"
    # Present in the room without casting a vote. Members who were absent
    # are not listed by the source at all.
    NOT_VOTED = "not_voted"


@dataclass(frozen=True, slots=True)
class Vote:
    id: int
    sitting_date: date
    time: time | None
    chamber: Chamber
    title: str
    is_final: bool
    bill_title: str | None
    bill_url: str | None
    source_url: str
    present: int
    votes_for: int
    votes_against: int
    abstained: int
    not_voted: int

    @property
    def tally(self) -> dict[Choice, int]:
        return {
            Choice.FOR: self.votes_for,
            Choice.AGAINST: self.votes_against,
            Choice.ABSTAIN: self.abstained,
            Choice.NOT_VOTED: self.not_voted,
        }


@dataclass(frozen=True, slots=True)
class Ballot:
    vote_id: int
    mp_source_id: int
    chamber: Chamber
    legislature: int
    name: str
    group: str
    choice: Choice
