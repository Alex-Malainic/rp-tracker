"""HTTP access to cdep.ro: one polite, retrying client and nothing else."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import date

import httpx

from ingestion.models import Chamber

log = logging.getLogger(__name__)

BASE_URL = "https://www.cdep.ro/ords/pls/steno/"
MEMBERS_URL = "https://www.cdep.ro/ords/pls/parlam/"
# The site numbers chambers 1 (Senate) and 2 (Chamber of Deputies).
CHAMBER_CODES = {Chamber.SENATE: 1, Chamber.DEPUTIES: 2}
USER_AGENT = "rp-tracker/0.1 (public vote tracker; github.com)"
RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})


class FetchError(RuntimeError):
    """The source could not be read after all retries."""


class CdepClient:
    """Fetches the raw pages the parser understands.

    Waits ``delay`` seconds before every request after the first, and retries
    transport errors and retryable statuses with exponential backoff.
    """

    def __init__(
        self,
        http: httpx.Client | None = None,
        *,
        delay: float = 1.0,
        retries: int = 3,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._http = http or httpx.Client(
            base_url=BASE_URL,
            headers={"User-Agent": USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        )
        self._delay = delay
        self._retries = retries
        self._sleep = sleep
        self._requested = False

    def sitting_days(self, year: int, month: int) -> str:
        return self._get("evot2015.zile_vot", {"lu": month, "an": year})

    def day_page(self, day: date) -> str:
        return self._get("evot2015.data", {"dat": f"{day:%Y%m%d}", "idl": 1})

    def ballots_page(self, vote_id: int) -> str:
        return self._get("evot2015.nominal", {"idv": vote_id, "idl": 1})

    def members_page(self, chamber: Chamber, legislature: int) -> str:
        """The alphabetical list of a chamber's members, with constituencies."""
        return self._get(
            f"{MEMBERS_URL}structura2015.de",
            {"cam": CHAMBER_CODES[chamber], "leg": legislature, "idl": 1},
        )

    def close(self) -> None:
        self._http.close()

    def _get(self, path: str, params: dict[str, object]) -> str:
        last_error: Exception | None = None
        for attempt in range(self._retries + 1):
            if attempt:
                self._sleep(self._delay * 2**attempt)
            elif self._requested:
                self._sleep(self._delay)
            self._requested = True
            try:
                response = self._http.get(path, params=params)
            except httpx.TransportError as error:
                last_error = error
                log.warning("GET %s %s failed: %s", path, params, error)
                continue
            if response.status_code in RETRYABLE_STATUS:
                last_error = httpx.HTTPStatusError(
                    f"HTTP {response.status_code}", request=response.request, response=response
                )
                log.warning("GET %s %s returned %s", path, params, response.status_code)
                continue
            if response.status_code != 200:
                raise FetchError(f"GET {path} {params} returned HTTP {response.status_code}")
            # The pages are UTF-8 whatever their own declarations say.
            return response.content.decode("utf-8")
        raise FetchError(
            f"GET {path} {params} failed after {self._retries} retries"
        ) from last_error
