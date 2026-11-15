"""Command line entry point: ``python -m ingestion``.

Examples:
    python -m ingestion                          # today (UTC)
    python -m ingestion --date 2026-11-10
    python -m ingestion --from 2024-12-01 --to 2026-11-15
    python -m ingestion --date 2026-11-10 --dry-run
"""

from __future__ import annotations

import argparse
import logging
from collections.abc import Sequence
from datetime import UTC, date, datetime

from ingestion import load
from ingestion.fetch import CdepClient
from ingestion.pipeline import Source, collect_day, sitting_days_between

log = logging.getLogger("ingestion")


def run(source: Source, db: object | None, start: date, end: date) -> int:
    """Ingest every sitting day in the range. Returns the number of votes.

    With ``db`` set to None nothing is written (dry run).
    """
    days = sitting_days_between(source, start, end)
    if not days:
        log.info("no sitting days between %s and %s", start, end)
        return 0

    total = 0
    for day in days:
        data = collect_day(source, day)
        if db is not None:
            load.load(db, data.votes, data.ballots)
        total += len(data.votes)
    if db is not None and total:
        load.refresh_stats(db)
    log.info("done: %d votes over %d sitting days", total, len(days))
    return total


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m ingestion", description="Load parliamentary votes into Supabase."
    )
    parser.add_argument("--date", type=date.fromisoformat, help="a single day, YYYY-MM-DD")
    parser.add_argument(
        "--from", dest="start", type=date.fromisoformat, help="first day of a range"
    )
    parser.add_argument("--to", dest="end", type=date.fromisoformat, help="last day of a range")
    parser.add_argument("--dry-run", action="store_true", help="fetch and verify, write nothing")
    parser.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    args = parser.parse_args(argv)

    if args.date and (args.start or args.end):
        parser.error("use either --date or --from/--to")
    if args.end and not args.start:
        parser.error("--to needs --from")

    # The daily job runs in the evening, when the UTC and Bucharest dates agree.
    today = datetime.now(UTC).date()
    start = args.date or args.start or today
    end = args.date or args.end or (today if args.start else start)
    if start > end:
        parser.error("--from is after --to")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    db = None if args.dry_run else load.connect()
    source = CdepClient(delay=args.delay)
    try:
        run(source, db, start, end)
    finally:
        source.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
