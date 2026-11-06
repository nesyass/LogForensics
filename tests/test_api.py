from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from logforensics.api.main import create_app

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "sample_data"


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    app = create_app(
        db_path=tmp_path / "test.db",
        username="analyst",
        password="logforensics",
        secret_key="test-secret-key",
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def signed_in(client: TestClient) -> TestClient:
    response = client.post(
        "/api/auth/login",
        json={"username": "analyst", "password": "logforensics"},
    )
    assert response.status_code == 200
    return client


@pytest.fixture()
def sample_case(signed_in: TestClient) -> dict:
    response = signed_in.post(
        "/api/cases/sample",
        json={"timezone": "Asia/Jakarta", "parser": "auto", "name": "Test sample"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_protected_routes_require_sign_in(client: TestClient) -> None:
    assert client.get("/api/cases").status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/cases/sample", json={}).status_code == 401


def test_login_rejects_bad_credentials_and_accepts_demo_account(
    client: TestClient,
) -> None:
    bad = client.post(
        "/api/auth/login",
        json={"username": "analyst", "password": "wrong"},
    )
    assert bad.status_code == 401
    assert "Incorrect" in bad.json()["detail"]

    good = client.post(
        "/api/auth/login",
        json={"username": "analyst", "password": "logforensics"},
    )
    assert good.status_code == 200
    assert good.json() == {"user": "analyst"}
    assert client.get("/api/auth/me").json() == {"user": "analyst"}

    assert client.post("/api/auth/logout").json() == {"ok": True}
    assert client.get("/api/auth/me").status_code == 401


def test_sample_case_matches_the_documented_dataset(
    sample_case: dict,
) -> None:
    summary = sample_case["summary"]
    assert sample_case["source"] == "sample"
    assert sample_case["name"] == "Test sample"
    assert summary["total_files"] == 3
    assert summary["parsed_events"] == 51
    assert summary["total_alerts"] == 13
    assert summary["parse_errors"] == 0
    assert len(sample_case["files"]) == 3
    assert len(sample_case["incidents"]) == 3

    assert {alert["rule_id"] for alert in sample_case["alerts"]} == {
        "LF-001",
        "LF-002",
        "LF-003",
        "LF-004",
        "LF-005",
    }
    assert all(alert["status"] == "needs_review" for alert in sample_case["alerts"])
    assert all(alert["reason"] for alert in sample_case["alerts"])
    assert all(
        len(alert["evidence_event_ids"]) == alert["event_count"]
        for alert in sample_case["alerts"]
    )

    for file in sample_case["files"]:
        assert len(file["sha256"]) == 64
        assert file["total_lines"] >= file["parsed_lines"]
        assert file["note"] is not None

    settings = sample_case["settings"]
    assert settings["failed_login_threshold"] == 10
    assert "LF-001" in settings["enabled_rules"]


def test_case_list_contains_the_saved_case(
    signed_in: TestClient, sample_case: dict
) -> None:
    response = signed_in.get("/api/cases")
    assert response.status_code == 200
    cases = response.json()
    assert len(cases) == 1
    assert cases[0]["id"] == sample_case["id"]
    assert cases[0]["summary"]["parsed_events"] == 51

    detail = signed_in.get(f"/api/cases/{sample_case['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == sample_case["id"]

    missing = signed_in.get("/api/cases/does-not-exist")
    assert missing.status_code == 404


def test_event_explorer_pagination_search_and_filters(
    signed_in: TestClient, sample_case: dict
) -> None:
    case_id = sample_case["id"]

    first_page = signed_in.get(
        f"/api/cases/{case_id}/events", params={"page": 1, "page_size": 10}
    )
    assert first_page.status_code == 200
    payload = first_page.json()
    assert payload["total"] == 51
    assert payload["pages"] == 6
    assert payload["page"] == 1
    assert len(payload["items"]) == 10

    newest = payload["items"][0]["timestamp"]
    ascending = signed_in.get(
        f"/api/cases/{case_id}/events",
        params={"page": 1, "page_size": 10, "sort": "asc"},
    ).json()
    assert ascending["items"][0]["timestamp"] <= newest

    filtered = signed_in.get(
        f"/api/cases/{case_id}/events",
        params={"ip": "203.0.113.50", "page_size": 100},
    ).json()
    assert filtered["total"] > 0
    assert all(item["source_ip"] == "203.0.113.50" for item in filtered["items"])

    searched = signed_in.get(
        f"/api/cases/{case_id}/events",
        params={"search": "Failed password", "page_size": 100},
    ).json()
    assert searched["total"] > 0

    event_id = payload["items"][0]["event_id"]
    detail = signed_in.get(f"/api/cases/{case_id}/events/{event_id}")
    assert detail.status_code == 200
    event = detail.json()
    assert event["raw_message"]
    assert event["source_file"]
    assert event["source_line"] >= 1
    assert event["parse_status"] == "success"


def test_facets_timeline_and_ip_aggregation(
    signed_in: TestClient, sample_case: dict
) -> None:
    case_id = sample_case["id"]

    facets = signed_in.get(f"/api/cases/{case_id}/facets").json()
    assert "authentication" in facets["categories"]
    assert "web" in facets["categories"]
    assert facets["source_files"]
    assert facets["source_ips"]

    timeline = signed_in.get(
        f"/api/cases/{case_id}/timeline", params={"buckets": 72}
    ).json()
    assert timeline["buckets"]
    assert sum(bucket["total"] for bucket in timeline["buckets"]) == 51
    assert timeline["evidence_events"]
    assert len(timeline["incidents"]) == 3
    assert timeline["first"] <= timeline["last"]

    ips = signed_in.get(f"/api/cases/{case_id}/ips").json()
    assert len(ips) == 8
    assert sum(item["total_events"] for item in ips) == 51
    assert ips == sorted(
        ips, key=lambda item: (-item["total_events"], item["source_ip"])
    )
    assert any(item["alert_count"] > 0 for item in ips)


def test_alert_review_status_can_be_updated(
    signed_in: TestClient, sample_case: dict
) -> None:
    case_id = sample_case["id"]
    alert = sample_case["alerts"][0]

    response = signed_in.patch(
        f"/api/cases/{case_id}/alerts/{alert['alert_id']}",
        json={"status": "confirmed_suspicious"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed_suspicious"

    refreshed = signed_in.get(f"/api/cases/{case_id}").json()
    stored = next(
        item for item in refreshed["alerts"] if item["alert_id"] == alert["alert_id"]
    )
    assert stored["status"] == "confirmed_suspicious"

    invalid = signed_in.patch(
        f"/api/cases/{case_id}/alerts/{alert['alert_id']}",
        json={"status": "not-a-status"},
    )
    assert invalid.status_code == 400


def test_exports_and_zip_bundle(
    signed_in: TestClient, sample_case: dict
) -> None:
    case_id = sample_case["id"]

    artifacts = signed_in.get(f"/api/cases/{case_id}/exports")
    assert artifacts.status_code == 200
    names = {item["name"] for item in artifacts.json()}
    assert names == {
        "events.json",
        "events.csv",
        "alerts.json",
        "alerts.csv",
        "timeline.csv",
        "investigation-summary.md",
        "file_manifest.json",
    }

    for item in artifacts.json():
        response = signed_in.get(f"/api/cases/{case_id}/exports/{item['name']}")
        assert response.status_code == 200, item["name"]
        assert len(response.content) == item["size_bytes"]
        assert item["mime"] in response.headers["content-type"]

    events = signed_in.get(f"/api/cases/{case_id}/exports/events.json").json()
    assert len(events["events"]) == 51
    assert events["tool"] == "LogForensics"

    alerts_csv = signed_in.get(f"/api/cases/{case_id}/exports/alerts.csv").text
    assert "alert_id" in alerts_csv.splitlines()[0]
    assert "LF-001" in alerts_csv

    bundle = signed_in.get(
        f"/api/cases/{case_id}/exports/logforensics-export.zip"
    )
    assert bundle.status_code == 200
    assert bundle.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(bundle.content)) as archive:
        assert set(archive.namelist()) == names

    missing = signed_in.get(f"/api/cases/{case_id}/exports/unknown.txt")
    assert missing.status_code == 404


def test_upload_endpoint_creates_a_case(
    signed_in: TestClient,
) -> None:
    source = sorted(SAMPLE_DIR.glob("*auth*.log")) or sorted(SAMPLE_DIR.glob("*.log"))
    log_file = source[0]
    options = {
        "timezone": "Asia/Jakarta",
        "parser": "auto",
        "failed_login_threshold": 10,
        "enabled_rules": ["LF-001", "LF-002", "LF-003", "LF-004", "LF-005"],
    }
    response = signed_in.post(
        "/api/cases",
        files={"files": (log_file.name, log_file.read_bytes(), "text/plain")},
        data={"options": json.dumps(options), "name": "Uploaded case"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["source"] == "upload"
    assert payload["name"] == "Uploaded case"
    assert payload["summary"]["total_files"] == 1
    assert payload["files"][0]["name"] == log_file.name
    assert payload["summary"]["parsed_events"] > 0

    invalid = signed_in.post(
        "/api/cases",
        files={"files": ("bad.exe", b"MZ", "application/octet-stream")},
        data={"options": "{}"},
    )
    assert invalid.status_code == 400


def test_delete_case_removes_all_related_rows(
    signed_in: TestClient, sample_case: dict
) -> None:
    case_id = sample_case["id"]
    response = signed_in.delete(f"/api/cases/{case_id}")
    assert response.status_code == 200
    assert signed_in.get(f"/api/cases/{case_id}").status_code == 404
    assert signed_in.get(f"/api/cases/{case_id}/events").status_code == 404
    assert signed_in.get(f"/api/cases/{case_id}/exports").status_code == 404
    assert signed_in.delete(f"/api/cases/{case_id}").status_code == 404
