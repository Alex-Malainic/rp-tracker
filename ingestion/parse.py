"""Turn cdep.ro pages into dataclasses. Pure functions, no I/O.

The page formats are described in docs/data-source.md. Anything unexpected
raises ParseError, so a change in the source fails loudly instead of loading
partial data.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from ingestion.models import Ballot, Chamber, Choice, Vote

BASE_URL = "https://www.cdep.ro"

_CHOICES = {
    "DA": Choice.FOR,
    "NU": Choice.AGAINST,
    "AB": Choice.ABSTAIN,
    "-": Choice.NOT_VOTED,
}
_MEMBER_CHAMBERS = {"1": Chamber.SENATE, "2": Chamber.DEPUTIES}
_TALLY_COLUMNS = ("Prezenta", "Pentru", "Împotriva", "Abtineri", "Nu au votat*")
_AFFILIATED = re.compile(r"\s*\(afiliat\)\s*$", re.IGNORECASE)
_TEST_VOTE = re.compile(r"^\s*vot\s+test\b", re.IGNORECASE)


class ParseError(ValueError):
    """The source page does not have the structure we rely on."""


def parse_sitting_days(text: str) -> list[date]:
    """Parse the calendar feed, e.g. ``,20261104,20261111`` (unordered)."""
    try:
        return sorted(
            datetime.strptime(item.strip(), "%Y%m%d").date()
            for item in text.split(",")
            if item.strip()
        )
    except ValueError as error:
        raise ParseError(f"unexpected calendar feed: {text[:80]!r}") from error


def normalize_group(label: str) -> str:
    """Map a group label to its party: ``PNL (afiliat)`` -> ``PNL``."""
    group = _AFFILIATED.sub("", " ".join(label.split()))
    if not group:
        raise ParseError(f"empty group label: {label!r}")
    return group


def skip_reason(vote: Vote) -> str | None:
    """Why an entry on the day page is not a real vote, or None if it is one."""
    if _TEST_VOTE.match(vote.title):
        return "test vote"
    if not any(vote.tally.values()):
        # Attendance checks list who is present and record no choices.
        return "attendance check"
    return None


def parse_day_page(html: str, sitting_date: date) -> list[Vote]:
    """Parse the list of votes for one day. Returns [] when there are none."""
    soup = BeautifulSoup(html, "html.parser")
    votes = []
    bill: Tag | None = None
    for cell in soup.select('td[data-label^="Titlu"], td[data-label="Descriere"]'):
        if cell["data-label"] != "Descriere":
            # A "Titlu PL" (bill) or "Titlu PH" (resolution) row describes
            # the vote row that follows it.
            bill = cell
            continue
        row = cell.find_parent("tr")
        if row is None:
            raise ParseError("vote description outside a table row")
        votes.append(_parse_vote_row(row, cell, bill, sitting_date))
        bill = None
    return votes


def _parse_vote_row(row: Tag, description: Tag, bill: Tag | None, sitting_date: date) -> Vote:
    cells = {cell["data-label"]: cell for cell in row.select("td[data-label]")}
    nominal_link = row.select_one('a[href*="evot2015.nominal"]')
    if nominal_link is None:
        raise ParseError("vote row without a link to the nominal vote")
    vote_id = _query_int(nominal_link["href"], "idv")

    try:
        id_text = cells["Id vot"].get_text(" ", strip=True)
        time_text = cells["Ora"].get_text(strip=True)
        tallies = {label: _int(cells[label].get_text(strip=True)) for label in _TALLY_COLUMNS}
    except KeyError as error:
        raise ParseError(f"vote {vote_id}: missing column {error}") from error

    lines = [
        line.strip().removeprefix("-").strip()
        for line in description.get_text("\n").splitlines()
        if line.strip()
    ]
    if not lines:
        raise ParseError(f"vote {vote_id}: empty description")
    bill_link = bill.select_one("a[href]") if bill else None

    return Vote(
        id=vote_id,
        sitting_date=sitting_date,
        time=_time(time_text, vote_id),
        chamber=Chamber.JOINT if "CD+SE" in id_text else Chamber.DEPUTIES,
        title=" - ".join(lines),
        is_final=lines[0].casefold().startswith("vot final"),
        bill_title=" ".join(bill.get_text(" ").split()) if bill else None,
        bill_url=urljoin(BASE_URL, bill_link["href"]) if bill_link else None,
        source_url=urljoin(BASE_URL, nominal_link["href"]),
        present=tallies["Prezenta"],
        votes_for=tallies["Pentru"],
        votes_against=tallies["Împotriva"],
        abstained=tallies["Abtineri"],
        not_voted=tallies["Nu au votat*"],
    )


def parse_ballots_page(html: str, vote_id: int) -> list[Ballot]:
    """Parse the nominal vote page: one ballot per member present."""
    soup = BeautifulSoup(html, "html.parser")
    ballots = []
    for link in soup.select('a[href*="structura2015.mp?"]'):
        row = link.find_parent("tr")
        if row is None:
            continue  # a member link outside the results table, e.g. navigation
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all("td")]
        if len(cells) < 4:
            raise ParseError(f"vote {vote_id}: unexpected ballot row {cells}")
        # Joint sittings add a senator/deputat column; group and vote are
        # always the last two cells.
        group, raw_choice = cells[-2], cells[-1]
        query = parse_qs(urlparse(link["href"]).query)
        try:
            ballots.append(
                Ballot(
                    vote_id=vote_id,
                    mp_source_id=int(query["idm"][0]),
                    chamber=_MEMBER_CHAMBERS[query["cam"][0]],
                    legislature=int(query["leg"][0]),
                    name=" ".join(link.get_text().split()),
                    group=normalize_group(group),
                    choice=_CHOICES[raw_choice],
                )
            )
        except (KeyError, ValueError) as error:
            raise ParseError(f"vote {vote_id}: unexpected ballot row {cells}") from error
    return ballots


def _query_int(href: str, name: str) -> int:
    try:
        return int(parse_qs(urlparse(href).query)[name][0])
    except (KeyError, ValueError) as error:
        raise ParseError(f"no numeric {name!r} in link {href!r}") from error


def _int(text: str) -> int:
    # The source writes a dash, or nothing, instead of 0.
    if text in ("", "-"):
        return 0
    try:
        return int(text)
    except ValueError as error:
        raise ParseError(f"expected a number, got {text!r}") from error


def _time(text: str, vote_id: int) -> time | None:
    # Some votes are published without a time of day; the cell then holds
    # only the ">>>" link to the nominal vote.
    if text in ("", ">>>", "00:00"):
        return None
    try:
        return datetime.strptime(text, "%H:%M").time()
    except ValueError as error:
        raise ParseError(f"vote {vote_id}: unexpected time {text!r}") from error
