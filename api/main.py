"""HTTP API: health, an admin endpoint to ingest a day, and read endpoints.

Run locally with ``uvicorn api.main:app --reload``. It needs SUPABASE_URL and
SUPABASE_SERVICE_KEY, plus ADMIN_TOKEN to enable POST /ingest.
"""

from __future__ import annotations

import os
import secrets
from collections.abc import Iterator
from datetime import date
from functools import lru_cache
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from supabase import Client

from api.repository import Repository
from ingestion import cli, load
from ingestion.fetch import CdepClient, FetchError
from ingestion.parse import ParseError
from ingestion.pipeline import Source, SourceMismatchError

app = FastAPI(title="Romanian Parliament Vote Tracker", version="0.1.0")


@lru_cache
def get_db() -> Client:
    return load.connect()


def get_repository(db: Annotated[Client, Depends(get_db)]) -> Repository:
    return Repository(db)


def get_source() -> Iterator[Source]:
    source = CdepClient()
    try:
        yield source
    finally:
        source.close()


def require_admin(x_admin_token: Annotated[str | None, Header()] = None) -> None:
    """Allow the request only with the token from ADMIN_TOKEN.

    Without ADMIN_TOKEN configured the endpoint is closed to everyone.
    """
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "ingestion is not enabled")
    if x_admin_token is None or not secrets.compare_digest(x_admin_token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid admin token")


Repo = Annotated[Repository, Depends(get_repository)]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest/{day}", dependencies=[Depends(require_admin)])
def ingest(
    day: date,
    source: Annotated[Source, Depends(get_source)],
    db: Annotated[Client, Depends(get_db)],
) -> dict[str, Any]:
    """Fetch one day from cdep.ro and load it. Safe to repeat."""
    try:
        votes = cli.run(source, db, day, day)
    except (FetchError, ParseError, SourceMismatchError) as error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(error)) from error
    return {"date": day.isoformat(), "votes": votes}


@app.get("/votes")
def list_votes(
    repo: Repo,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    final_only: bool = False,
) -> list[dict[str, Any]]:
    return repo.votes(limit=limit, offset=offset, final_only=final_only)


@app.get("/parties")
def list_parties(repo: Repo) -> list[dict[str, Any]]:
    return repo.parties()


@app.get("/parties/cohesion")
def party_cohesion(repo: Repo) -> list[dict[str, Any]]:
    return repo.cohesion()


@app.get("/parties/similarity")
def party_similarity(
    repo: Repo, year: Annotated[int, Query(ge=2006, le=2100)]
) -> list[dict[str, Any]]:
    return repo.similarity(year)


@app.get("/mps")
def list_mps(repo: Repo) -> list[dict[str, Any]]:
    return repo.mps()


@app.get("/mps/{mp_id}")
def get_mp(mp_id: int, repo: Repo) -> dict[str, Any]:
    mp = repo.mp(mp_id)
    if mp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no such member")
    return mp
