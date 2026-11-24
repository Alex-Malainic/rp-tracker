from datetime import date

import httpx
import pytest

from ingestion.fetch import BASE_URL, CdepClient, FetchError

# Minimal bodies that pass each endpoint's check for a real page.
CALENDAR = ",20261110,20261111"
PAGE = '<table><th class="descriere"></th><a href="structura2015.mp?idm=1&cam=2&leg=2024"></a>'


def ok_page(request):
    body = CALENDAR if "zile_vot" in str(request.url) else PAGE
    return httpx.Response(200, text=body)


def make_client(handler, **kwargs):
    sleeps: list[float] = []
    http = httpx.Client(base_url=BASE_URL, transport=httpx.MockTransport(handler))
    return CdepClient(http, sleep=sleeps.append, **kwargs), sleeps


def test_builds_the_documented_urls():
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return ok_page(request)

    client, _ = make_client(handler)
    client.sitting_days(2026, 11)
    client.day_page(date(2026, 11, 10))
    client.ballots_page(37481)

    assert seen == [
        "https://www.cdep.ro/ords/pls/steno/evot2015.zile_vot?lu=11&an=2026",
        "https://www.cdep.ro/ords/pls/steno/evot2015.data?dat=20261110&idl=1",
        "https://www.cdep.ro/ords/pls/steno/evot2015.nominal?idv=37481&idl=1",
    ]


def test_decodes_utf8_whatever_the_page_declares():
    body = ('<?xml version="1.0" encoding="ISO-8859-2"?><NUME>Tuşa</NUME>' + PAGE).encode()

    def handler(request):
        return httpx.Response(
            200, content=body, headers={"content-type": "text/xml; charset=ISO-8859-2"}
        )

    client, _ = make_client(handler)

    assert "Tuşa" in client.ballots_page(1)


def test_waits_between_requests_but_not_before_the_first():
    client, sleeps = make_client(ok_page, delay=1.5)

    client.ballots_page(1)
    assert sleeps == []
    client.ballots_page(2)
    assert sleeps == [1.5]


def test_retries_server_errors_with_backoff():
    statuses = iter([503, 500, 200])
    client, sleeps = make_client(lambda request: httpx.Response(next(statuses), text=PAGE))

    assert client.ballots_page(1) == PAGE
    assert sleeps == [2.0, 4.0]


def test_retries_transport_errors():
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            raise httpx.ConnectError("connection reset")
        return httpx.Response(200, text=PAGE)

    client, _ = make_client(handler)

    assert client.ballots_page(1) == PAGE
    assert len(calls) == 2


def test_gives_up_after_the_configured_retries():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503)

    client, _ = make_client(handler, retries=2)

    with pytest.raises(FetchError, match="after 2 retries"):
        client.ballots_page(1)
    assert len(calls) == 3


def test_client_errors_are_not_retried():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(404)

    client, _ = make_client(handler)

    with pytest.raises(FetchError, match="HTTP 404"):
        client.ballots_page(1)
    assert len(calls) == 1


@pytest.mark.parametrize(
    ("call", "expected"),
    [
        (lambda client: client.sitting_days(2026, 11), CALENDAR),
        (lambda client: client.day_page(date(2026, 11, 10)), PAGE),
        (lambda client: client.ballots_page(1), PAGE),
    ],
)
def test_an_error_page_served_with_200_is_retried(call, expected):
    # cdep.ro answered some bursts with an HTML error page and HTTP 200.
    error_page = iter([httpx.Response(200, text="<!DOCTYPE HTML><html>Eroare</html>")])

    def handler(request):
        return next(error_page, None) or ok_page(request)

    client, sleeps = make_client(handler)

    assert call(client) == expected
    assert sleeps == [2.0]  # backed off once before the second attempt


def test_gives_up_on_a_persistent_error_page():
    client, _ = make_client(
        lambda request: httpx.Response(200, text="<html>Eroare</html>"), retries=1
    )

    with pytest.raises(FetchError, match="after 1 retries"):
        client.day_page(date(2026, 11, 10))


def test_an_empty_calendar_is_a_valid_answer():
    client, _ = make_client(lambda request: httpx.Response(200, text=""))

    assert client.sitting_days(2026, 1) == ""
