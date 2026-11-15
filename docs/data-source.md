# Data source

Findings from Step 0 of the [brief](brief.md), checked on 2026-11-15 with
`python -m ingestion.probe <date>`.

**Verdict: per-MP vote data is available** from the Chamber of Deputies site
(cdep.ro) for every electronic vote, including joint sittings with the Senate.

## Endpoints

All under `https://www.cdep.ro/ords/pls/steno/`. The older `/pls/steno/...`
paths (without `/ords`) return 404.

| Purpose | Path | Format |
|---|---|---|
| Sitting days in a month | `evot2015.zile_vot?lu=<month>&an=<year>` | text: `,20261104,20261111,...` (unordered) |
| Votes on a day | `evot2015.xml?par1=1&par2=<YYYYMMDD>` | XML |
| Ballots for a vote | `evot2015.xml?par1=2&par2=<vote id>` | XML |
| Ballots for a vote, with MP ids | `evot2015.nominal?idv=<vote id>&idl=1` | HTML |
| Day page for humans | `evot2015.data?dat=<YYYYMMDD>&idl=1` | HTML |

No authentication, no API key. The calendar's year range is 2006 onwards; the
probe was run against 2017, 2025 and 2026.

## Fields

### Votes on a day (`ROWSET/ROW`)

| Element | Meaning |
|---|---|
| `VOTID` | Vote id, unique across chambers and years |
| `TIME_VOT` | `dd.mm.yyyy hh:mi`, local time (Europe/Bucharest) |
| `DESCRIERE` | Free-text subject |
| `CAMERA` | `2` Chamber of Deputies, `0` joint sitting (shown as `CD+SE` on the site) |
| `PREZENTI` | Members present |
| `AU_VOTAT_DA` / `AU_VOTAT_NU` / `AU_VOTAT_AB` | For / against / abstain |
| `NU_AU_VOTAT` | Present but did not vote |

### Ballots (`ROWSET/ROW`)

`VOTID`, `NUME` (surname), `PRENUME` (given names), `GRUP` (parliamentary
group), `CAMERA` (`2` deputy, `1` senator), `VOT` (`DA`, `NU`, `AB`, `-`).

The HTML page carries the same rows plus a link per member:
`/ords/pls/parlam/structura2015.mp?idm=<n>&cam=<1|2>&leg=<legislature year>`.
`(cam, leg, idm)` is the only stable member key the source offers; the XML has
names only.

## Quirks

- **Wrong encoding declaration.** The XML prolog says `ISO-8859-2`, but the
  bytes are UTF-8 (and the HTTP header says UTF-8). Decode as UTF-8 and ignore
  the prolog, or diacritics are corrupted.
- **Only present members are listed.** `-` means present without voting. A
  member who was absent has no row at all, so absence must be derived from the
  roster, not read from the data.
- **No sitting returns an empty body** with HTTP 200, not an empty `ROWSET`.
- **Missing elements.** Tally elements are omitted rather than zeroed when the
  source has no value (vote 16335, "Vot test 2", has only `PREZENTI`).
- **Test votes exist** ("Vot test 2") and should be filtered out.
- **Time can be `00:00`.** All eight votes on 2026-11-11 have no time of day.
  Do not rely on time for ordering; use `VOTID`.
- **Rows are not sorted** by id or time.
- **Group labels are inconsistent**: `PNL(afiliat)` and `PNL (afiliat)`,
  `Neafiliati` in HTML against `neafiliat` in XML. Groups also change between
  legislatures (PMP, ALDE in 2017; POT in 2025; PACE in 2026) and members move
  between groups, so the group has to be stored per ballot.
- **No adopted/rejected outcome**, only tallies. Whether a vote passed depends
  on the majority required, which the source does not state.
- **Many votes are procedural** ("Aprobare ordine de zi", "Propunere 1",
  "timp dezbatere"). Bill votes can usually be recognised by a reference such
  as `PL-x 146/2025` in the description.
- **Member ids are per legislature.** `idm=1&cam=2&leg=2024` and
  `idm=1&cam=2&leg=2016` are different people.

## Consistency check

For every vote probed, the number of HTML rows equalled the number of XML rows
and `PREZENTI`, and the parsed for / against / abstain / not-voted counts
equalled the official tallies.

| Day | Sitting | Votes that day | Votes checked | Mismatches |
|---|---|---|---|---|
| 2026-11-10 | joint | 13 | 13 | 0 |
| 2026-11-11 | Chamber | 8 | 3 | 0 |
| 2025-06-18 | Chamber | 15 | 3 | 0 |
| 2017-03-07 | Chamber | 27 | 2 | 0 |

2025-02-11, 2023-10-17 and 2026-11-14 had no sitting and returned empty
responses.

## Frequency and load

- Sittings are typically two or three days a week while Parliament is in
  session, with 5 to 30 votes per sitting day.
- Responses took 0.3 to 0.6 seconds. No rate limiting was seen at one request
  per second; about 120 requests were made in total. Rate limits at higher
  volumes are untested, so ingestion should keep a delay of at least one second.
- A daily run needs one calendar request, one day request and one or two
  requests per vote.

## Alternatives considered

- **Senate (senat.ro).** `Voturiplen.aspx` is an ASP.NET WebForms calendar
  navigated by `__doPostBack`, with no export link. Not investigated further.
  Senators' votes in joint sittings are already covered by cdep.ro.
- **data.gov.ro.** A search for Chamber vote datasets returned only election
  results, no plenary vote records.
- **vot-parlament.ro.** A third-party tracker built on the same official
  sources, with data under CC BY 4.0. Useful for cross-checking, not used as a
  source.

## Not yet verified

- Whether a vote's time or tallies are corrected after the sitting day.
- How quickly votes appear after a sitting ends.
- Behaviour across the whole 2006 to 2016 range.
