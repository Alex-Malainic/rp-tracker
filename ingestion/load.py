"""Write parsed votes into Supabase with idempotent upserts.

Every table is upserted on its natural key (see supabase/migrations), so
loading the same day twice leaves the database unchanged.
"""

from __future__ import annotations

import logging
import os
from itertools import batched
from typing import Any

from supabase import Client, create_client

from ingestion.constituencies import CONSTITUENCIES, Seat
from ingestion.models import Ballot, Chamber, Vote

log = logging.getLogger(__name__)

BATCH_SIZE = 500

# Display names for the groups we know. Unknown groups keep their label.
PARTY_NAMES = {
    "PSD": "Partidul Social Democrat",
    "PNL": "Partidul Național Liberal",
    "USR": "Uniunea Salvați România",
    "AUR": "Alianța pentru Unirea Românilor",
    "UDMR": "Uniunea Democrată Maghiară din România",
    "SOS RO": "S.O.S. România",
    "POT": "Partidul Oamenilor Tineri",
    "Minoritati": "Minorități naționale",
    "Neafiliati": "Neafiliați",
}

MpKey = tuple[Chamber, int, int]


def connect() -> Client:
    """Create a client from SUPABASE_URL and SUPABASE_SERVICE_KEY."""
    try:
        return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    except KeyError as error:
        raise RuntimeError(f"environment variable {error} is not set") from error


def load(db: Client, votes: list[Vote], ballots: list[Ballot]) -> None:
    """Upsert votes and their ballots, creating parties and MPs as needed."""
    if not votes:
        return

    party_ids = _upsert_parties(db, sorted({ballot.group for ballot in ballots}))
    mp_ids = _upsert_mps(db, ballots, party_ids)
    _upsert(db, "votes", [_vote_row(vote) for vote in votes], on_conflict="id")
    _upsert(
        db,
        "ballots",
        [
            {
                "vote_id": ballot.vote_id,
                "mp_id": mp_ids[_mp_key(ballot)],
                "party_id": party_ids[ballot.group],
                "choice": ballot.choice.value,
            }
            for ballot in ballots
        ],
        on_conflict="vote_id,mp_id",
    )
    log.info("loaded %d votes and %d ballots", len(votes), len(ballots))


def load_seats(db: Client, seats: list[Seat]) -> int:
    """Record each member's constituency. Returns how many members were updated.

    Only members already known from a ballot are updated: a member who has
    not voted yet has no row, and gets their constituency on a later run.
    """
    _upsert(
        db,
        "constituencies",
        [
            {"id": number, "name": name, "region": region}
            for number, (name, region) in CONSTITUENCIES.items()
        ],
        on_conflict="id",
    )

    groups: dict[tuple[int, Chamber, int], list[int]] = {}
    for seat in seats:
        key = (seat.constituency, seat.chamber, seat.legislature)
        groups.setdefault(key, []).append(seat.mp_source_id)

    updated = 0
    for (constituency, chamber, legislature), source_ids in groups.items():
        response = (
            db.table("mps")
            .update({"constituency_id": constituency})
            .eq("chamber", chamber.value)
            .eq("legislature", legislature)
            .in_("source_id", source_ids)
            .execute()
        )
        updated += len(response.data)
    log.info("constituencies set for %d of %d listed members", updated, len(seats))
    return updated


def refresh_stats(db: Client) -> None:
    """Rebuild the materialized views behind the charts."""
    db.rpc("refresh_stats").execute()


def _upsert_parties(db: Client, groups: list[str]) -> dict[str, int]:
    rows = [{"abbreviation": group, "name": PARTY_NAMES.get(group, group)} for group in groups]
    saved = _upsert(db, "parties", rows, on_conflict="abbreviation")
    return {row["abbreviation"]: row["id"] for row in saved}


def _upsert_mps(db: Client, ballots: list[Ballot], party_ids: dict[str, int]) -> dict[MpKey, int]:
    # A provisional group: the member's last ballot in this batch. Batches can
    # be loaded out of order, so refresh_stats() resets it from the newest
    # ballot in the database.
    latest = {_mp_key(ballot): ballot for ballot in ballots}
    rows = [
        {
            "chamber": ballot.chamber.value,
            "legislature": ballot.legislature,
            "source_id": ballot.mp_source_id,
            "name": ballot.name,
            "party_id": party_ids[ballot.group],
        }
        for ballot in latest.values()
    ]
    saved = _upsert(db, "mps", rows, on_conflict="chamber,legislature,source_id")
    return {
        (Chamber(row["chamber"]), row["legislature"], row["source_id"]): row["id"] for row in saved
    }


def _upsert(db: Client, table: str, rows: list[dict[str, Any]], *, on_conflict: str) -> list[dict]:
    saved: list[dict] = []
    for batch in batched(rows, BATCH_SIZE):
        response = db.table(table).upsert(list(batch), on_conflict=on_conflict).execute()
        saved.extend(response.data)
    if len(saved) != len(rows):
        raise RuntimeError(f"{table}: sent {len(rows)} rows, database returned {len(saved)}")
    return saved


def _mp_key(ballot: Ballot) -> MpKey:
    return (ballot.chamber, ballot.legislature, ballot.mp_source_id)


def _vote_row(vote: Vote) -> dict[str, Any]:
    return {
        "id": vote.id,
        "sitting_date": vote.sitting_date.isoformat(),
        "voted_time": vote.time.isoformat() if vote.time else None,
        "chamber": vote.chamber.value,
        "title": vote.title,
        "is_final": vote.is_final,
        "bill_title": vote.bill_title,
        "bill_url": vote.bill_url,
        "source_url": vote.source_url,
        "present": vote.present,
        "votes_for": vote.votes_for,
        "votes_against": vote.votes_against,
        "abstained": vote.abstained,
        "not_voted": vote.not_voted,
    }
