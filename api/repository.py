"""Read queries against Supabase, mirroring what the frontend asks for."""

from __future__ import annotations

from typing import Any

from supabase import Client

Row = dict[str, Any]


class Repository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def votes(self, *, limit: int, offset: int, final_only: bool) -> list[Row]:
        query = self._db.table("votes").select("*")
        if final_only:
            query = query.eq("is_final", True)
        return (
            query.order("sitting_date", desc=True)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
            .data
        )

    def parties(self) -> list[Row]:
        return self._db.table("parties").select("*").order("abbreviation").execute().data

    def cohesion(self) -> list[Row]:
        return self._db.table("party_cohesion_monthly").select("*").order("month").execute().data

    def similarity(self, year: int) -> list[Row]:
        return self._db.table("party_similarity").select("*").eq("year", year).execute().data

    def mps(self) -> list[Row]:
        return self._db.table("mps").select("*").order("name").execute().data

    def mp(self, mp_id: int) -> Row | None:
        rows = self._db.table("mps").select("*").eq("id", mp_id).limit(1).execute().data
        if not rows:
            return None
        attendance = (
            self._db.table("mp_attendance").select("*").eq("mp_id", mp_id).limit(1).execute().data
        )
        ballots = (
            self._db.table("ballots")
            .select("choice, party_id, votes(id, sitting_date, title, is_final, result)")
            .eq("mp_id", mp_id)
            .order("vote_id", desc=True)
            .limit(50)
            .execute()
            .data
        )
        return {
            **rows[0],
            "attendance": attendance[0] if attendance else None,
            "recent_ballots": ballots,
        }
