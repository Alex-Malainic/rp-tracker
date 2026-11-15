"""Step 0 probe: fetch one sitting day from cdep.ro and print the votes.

Standard library only, so it runs before the project has any dependencies.
It is a validation script, not the ingestion pipeline: the findings it
produced are written up in docs/data-source.md.

Usage:
    python -m ingestion.probe 2026-11-10            # summary per vote
    python -m ingestion.probe 2026-11-10 --ballots  # also every ballot
"""

from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from html import unescape

BASE = "https://www.cdep.ro/ords/pls/steno"
USER_AGENT = "rp-tracker-probe/0.1 (educational project)"
DELAY_SECONDS = 1.0

CHAMBERS = {"0": "joint", "1": "senate", "2": "deputies"}
CHOICES = {"DA": "for", "NU": "against", "AB": "abstain", "-": "not_voted"}


@dataclass(frozen=True)
class Vote:
    vote_id: int
    voted_at: datetime
    subject: str
    chamber: str
    present: int
    votes_for: int
    votes_against: int
    abstained: int
    not_voted: int


@dataclass(frozen=True)
class Ballot:
    vote_id: int
    mp_id: int
    chamber: str
    legislature: int
    name: str
    group: str
    choice: str


def fetch(path: str) -> str:
    request = urllib.request.Request(f"{BASE}/{path}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
    time.sleep(DELAY_SECONDS)
    # The XML prolog claims ISO-8859-2, but the bytes are UTF-8.
    return body.decode("utf-8")


def parse_rowset(text: str) -> list[dict[str, str]]:
    """Parse an Oracle ROWSET document into one dict per ROW."""
    if not text.strip():
        return []  # a day without a sitting returns an empty 200 response
    # Drop the prolog: its encoding declaration is wrong and ElementTree
    # refuses a str that carries one.
    text = re.sub(r"^\s*<\?xml[^>]*\?>", "", text)
    root = ET.fromstring(text)
    if root.tag != "ROWSET":
        raise ValueError(f"unexpected root element: {root.tag}")
    return [{child.tag: (child.text or "").strip() for child in row} for row in root]


def parse_votes(text: str) -> list[Vote]:
    # Tally elements are omitted, not zeroed, when the source has no value
    # (seen on "Vot test" rows), hence the defaults.
    return [
        Vote(
            vote_id=int(row["VOTID"]),
            voted_at=datetime.strptime(row["TIME_VOT"], "%d.%m.%Y %H:%M"),
            subject=row["DESCRIERE"],
            chamber=CHAMBERS[row["CAMERA"]],
            present=int(row.get("PREZENTI", 0)),
            votes_for=int(row.get("AU_VOTAT_DA", 0)),
            votes_against=int(row.get("AU_VOTAT_NU", 0)),
            abstained=int(row.get("AU_VOTAT_AB", 0)),
            not_voted=int(row.get("NU_AU_VOTAT", 0)),
        )
        for row in parse_rowset(text)
    ]


def parse_sitting_days(text: str) -> list[date]:
    """Parse the calendar feed, e.g. ",20261104,20261111" (unordered)."""
    return sorted(datetime.strptime(day, "%Y%m%d").date() for day in text.split(",") if day.strip())


_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
_MP_LINK = re.compile(
    r'structura2015\.mp\?idm=(\d+)&(?:amp;)?cam=(\d)&(?:amp;)?leg=(\d+)"[^>]*>(.*?)</a>', re.S
)
_CELL = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
_TAG = re.compile(r"<[^>]+>")


def _text(fragment: str) -> str:
    return " ".join(unescape(_TAG.sub("", fragment)).split())


def parse_ballots(html: str, vote_id: int) -> list[Ballot]:
    """Parse the nominal vote page, the only place that exposes MP ids."""
    ballots = []
    for row in _ROW.findall(html):
        link = _MP_LINK.search(row)
        if not link:
            continue
        mp_id, chamber, legislature, name = link.groups()
        cells = [_text(cell) for cell in _CELL.findall(row)]
        # Joint sittings add a "senator/deputat" column; group and vote are
        # always the last two cells.
        group, raw_choice = cells[-2], cells[-1]
        ballots.append(
            Ballot(
                vote_id=vote_id,
                mp_id=int(mp_id),
                chamber=CHAMBERS[chamber],
                legislature=int(legislature),
                name=_text(name),
                group=group,
                choice=CHOICES[raw_choice],
            )
        )
    return ballots


def probe(day: date, show_ballots: bool, limit: int | None) -> int:
    sitting_days = parse_sitting_days(fetch(f"evot2015.zile_vot?lu={day.month}&an={day.year}"))
    print(f"sitting days in {day:%Y-%m}: {', '.join(d.isoformat() for d in sitting_days)}")
    votes = parse_votes(fetch(f"evot2015.xml?par1=1&par2={day:%Y%m%d}"))
    print(f"{day}: {len(votes)} votes")
    problems = 0
    groups: Counter[str] = Counter()

    for vote in votes[:limit]:
        ballots = parse_ballots(fetch(f"evot2015.nominal?idv={vote.vote_id}&idl=1"), vote.vote_id)
        xml_rows = parse_rowset(fetch(f"evot2015.xml?par1=2&par2={vote.vote_id}"))
        tally = Counter(ballot.choice for ballot in ballots)
        groups.update(ballot.group for ballot in ballots)

        print(
            f"\n[{vote.vote_id}] {vote.voted_at:%Y-%m-%d %H:%M} ({vote.chamber}) {vote.subject[:90]}\n"
            f"  official: present={vote.present} for={vote.votes_for} against={vote.votes_against} "
            f"abstain={vote.abstained} not_voted={vote.not_voted}\n"
            f"  ballots:  html={len(ballots)} xml={len(xml_rows)} {dict(tally)}"
        )

        expected = {
            "for": vote.votes_for,
            "against": vote.votes_against,
            "abstain": vote.abstained,
            "not_voted": vote.not_voted,
        }
        actual = {choice: tally.get(choice, 0) for choice in expected}
        if actual != expected or len(ballots) != len(xml_rows):
            problems += 1
            print(f"  MISMATCH: expected {expected}, parsed {actual}")
        if len({(b.chamber, b.mp_id) for b in ballots}) != len(ballots):
            problems += 1
            print("  DUPLICATE mp ids within one vote")

        if show_ballots:
            for ballot in ballots:
                print(
                    f"    {ballot.chamber:8} {ballot.mp_id:>4} {ballot.name:40} "
                    f"{ballot.group:16} {ballot.choice}"
                )

    if groups:
        print(f"\ngroup labels seen: {dict(groups.most_common())}")
    print(f"problems: {problems}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("day", type=date.fromisoformat, help="sitting day, YYYY-MM-DD")
    parser.add_argument("--ballots", action="store_true", help="print every ballot")
    parser.add_argument("--limit", type=int, default=None, help="only the first N votes of the day")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    return 1 if probe(args.day, args.ballots, args.limit) else 0


if __name__ == "__main__":
    raise SystemExit(main())
