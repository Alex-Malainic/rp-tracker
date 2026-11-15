"""Electoral constituencies and the development regions they belong to.

A deputy or senator is elected in one of 43 constituencies: the 41 counties,
Bucharest and the diaspora. The source gives each constituency's official
number; names and regions are fixed here, because the source writes names in
capitals with legacy diacritics and knows nothing about regions.

Regions are Romania's eight development regions (NUTS 2), plus the diaspora.
"""

from __future__ import annotations

from dataclasses import dataclass

from ingestion.models import Chamber

NORTH_EAST = "nord-est"
SOUTH_EAST = "sud-est"
SOUTH = "sud-muntenia"
SOUTH_WEST = "sud-vest-oltenia"
WEST = "vest"
NORTH_WEST = "nord-vest"
CENTRE = "centru"
BUCHAREST_ILFOV = "bucuresti-ilfov"
DIASPORA = "diaspora"

# Official constituency number -> (name, region).
CONSTITUENCIES: dict[int, tuple[str, str]] = {
    1: ("Alba", CENTRE),
    2: ("Arad", WEST),
    3: ("Argeș", SOUTH),
    4: ("Bacău", NORTH_EAST),
    5: ("Bihor", NORTH_WEST),
    6: ("Bistrița-Năsăud", NORTH_WEST),
    7: ("Botoșani", NORTH_EAST),
    8: ("Brașov", CENTRE),
    9: ("Brăila", SOUTH_EAST),
    10: ("Buzău", SOUTH_EAST),
    11: ("Caraș-Severin", WEST),
    12: ("Călărași", SOUTH),
    13: ("Cluj", NORTH_WEST),
    14: ("Constanța", SOUTH_EAST),
    15: ("Covasna", CENTRE),
    16: ("Dâmbovița", SOUTH),
    17: ("Dolj", SOUTH_WEST),
    18: ("Galați", SOUTH_EAST),
    19: ("Giurgiu", SOUTH),
    20: ("Gorj", SOUTH_WEST),
    21: ("Harghita", CENTRE),
    22: ("Hunedoara", WEST),
    23: ("Ialomița", SOUTH),
    24: ("Iași", NORTH_EAST),
    25: ("Ilfov", BUCHAREST_ILFOV),
    26: ("Maramureș", NORTH_WEST),
    27: ("Mehedinți", SOUTH_WEST),
    28: ("Mureș", CENTRE),
    29: ("Neamț", NORTH_EAST),
    30: ("Olt", SOUTH_WEST),
    31: ("Prahova", SOUTH),
    32: ("Satu Mare", NORTH_WEST),
    33: ("Sălaj", NORTH_WEST),
    34: ("Sibiu", CENTRE),
    35: ("Suceava", NORTH_EAST),
    36: ("Teleorman", SOUTH),
    37: ("Timiș", WEST),
    38: ("Tulcea", SOUTH_EAST),
    39: ("Vaslui", NORTH_EAST),
    40: ("Vâlcea", SOUTH_WEST),
    41: ("Vrancea", SOUTH_EAST),
    42: ("București", BUCHAREST_ILFOV),
    43: ("Diaspora", DIASPORA),
}


@dataclass(frozen=True, slots=True)
class Seat:
    """One member's seat: who holds it and for which constituency."""

    constituency: int
    chamber: Chamber
    legislature: int
    mp_source_id: int
    name: str
