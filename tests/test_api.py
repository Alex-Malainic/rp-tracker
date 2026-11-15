from datetime import date

import pytest
from fastapi.testclient import TestClient

from api.main import app, get_db, get_repository, get_source
from ingestion.fetch import FetchError
from tests.conftest import FakeDb, FakeSource, ballots_html, day_html, vote_row

DAY = date(2026, 11, 10)
MEMBERS = (
    (1, "Pop Ion", "PSD", "DA"),
    (2, "Rus Ana", "PNL", "NU"),
    (3, "Toma Dan", "USR", "AB"),
)


class StubRepository:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def votes(self, *, limit, offset, final_only):
        self.calls.append(("votes", limit, offset, final_only))
        return [{"id": 7, "title": "Vot final"}]

    def parties(self):
        return [{"id": 1, "abbreviation": "PSD"}]

    def cohesion(self):
        return [{"month": "2026-11-01", "party_id": 1, "cohesion": 0.97}]

    def similarity(self, year):
        self.calls.append(("similarity", year))
        return [{"year": year, "party_a": 1, "party_b": 2, "agreement": 0.5}]

    def mps(self):
        return [{"id": 1, "name": "Pop Ion"}]

    def mp(self, mp_id):
        return {"id": 1, "name": "Pop Ion"} if mp_id == 1 else None


@pytest.fixture
def db():
    return FakeDb()


@pytest.fixture
def repo():
    return StubRepository()


@pytest.fixture
def client(db, repo, monkeypatch):
    source = FakeSource(days={DAY: day_html(vote_row(7))}, ballots={7: ballots_html(*MEMBERS)})
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_source] = lambda: source
    monkeypatch.setenv("ADMIN_TOKEN", "s3cret")
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


class TestIngest:
    def test_loads_the_day(self, client, db):
        response = client.post("/ingest/2026-11-10", headers={"X-Admin-Token": "s3cret"})

        assert response.status_code == 200
        assert response.json() == {"date": "2026-11-10", "votes": 1}
        assert len(db.rows("ballots")) == 3

    def test_day_without_a_sitting(self, client, db):
        response = client.post("/ingest/2026-11-14", headers={"X-Admin-Token": "s3cret"})

        assert response.json() == {"date": "2026-11-14", "votes": 0}
        assert db.tables == {}

    @pytest.mark.parametrize("headers", [{}, {"X-Admin-Token": "wrong"}])
    def test_rejects_a_missing_or_wrong_token(self, client, db, headers):
        assert client.post("/ingest/2026-11-10", headers=headers).status_code == 401
        assert db.tables == {}

    def test_is_closed_when_no_token_is_configured(self, client, monkeypatch):
        monkeypatch.delenv("ADMIN_TOKEN")

        response = client.post("/ingest/2026-11-10", headers={"X-Admin-Token": ""})

        assert response.status_code == 503

    def test_rejects_an_invalid_date(self, client):
        response = client.post("/ingest/yesterday", headers={"X-Admin-Token": "s3cret"})

        assert response.status_code == 422

    def test_source_failure_is_a_bad_gateway(self, client):
        class BrokenSource:
            def sitting_days(self, year, month):
                raise FetchError("cdep.ro is down")

        app.dependency_overrides[get_source] = lambda: BrokenSource()

        response = client.post("/ingest/2026-11-10", headers={"X-Admin-Token": "s3cret"})

        assert response.status_code == 502
        assert response.json() == {"detail": "cdep.ro is down"}


class TestReads:
    def test_votes_defaults(self, client, repo):
        assert client.get("/votes").json() == [{"id": 7, "title": "Vot final"}]
        assert repo.calls == [("votes", 50, 0, False)]

    def test_votes_paging_and_filter(self, client, repo):
        client.get("/votes", params={"limit": 10, "offset": 20, "final_only": True})

        assert repo.calls == [("votes", 10, 20, True)]

    @pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 201}, {"offset": -1}])
    def test_votes_rejects_out_of_range_paging(self, client, params):
        assert client.get("/votes", params=params).status_code == 422

    def test_parties(self, client):
        assert client.get("/parties").json() == [{"id": 1, "abbreviation": "PSD"}]

    def test_cohesion(self, client):
        assert client.get("/parties/cohesion").json()[0]["cohesion"] == 0.97

    def test_similarity_needs_a_year(self, client, repo):
        assert client.get("/parties/similarity").status_code == 422
        assert client.get("/parties/similarity", params={"year": 2026}).status_code == 200
        assert repo.calls == [("similarity", 2026)]

    def test_mps(self, client):
        assert client.get("/mps").json() == [{"id": 1, "name": "Pop Ion"}]

    def test_mp(self, client):
        assert client.get("/mps/1").json() == {"id": 1, "name": "Pop Ion"}

    def test_unknown_mp(self, client):
        assert client.get("/mps/99").status_code == 404
