import json
from pathlib import Path

from logforensics.analysis import analyze, rerun_detection
from logforensics.config import DetectionSettings
from logforensics.ingestion.file_loader import load_path
from logforensics.reporting import export_all, export_zip

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "sample_data"
SAMPLE_FILES = ("auth_normal.log", "auth_suspicious.log", "web_access.log")


def load_samples():
    return [load_path(SAMPLE_DIR / name) for name in SAMPLE_FILES]


def analyze_samples(source_type="auto", settings=None):
    return analyze(
        load_samples(),
        source_type=source_type,
        year=2026,
        timezone_name="Asia/Jakarta",
        settings=settings or DetectionSettings(),
    )


def test_sample_dataset_matches_expected_results():
    expected = json.loads((SAMPLE_DIR / "expected_results.json").read_text("utf-8"))
    result = analyze_samples()

    assert result.summary.parse_errors == expected["expected_parse_errors"]
    assert len(result.alerts) == expected["expected_total_alerts"]

    actual = []
    for alert in result.alerts:
        actual.append(
            {
                "rule_id": alert.rule_id,
                "source_ip": alert.source_ip,
                "event_count": alert.event_count,
                **(
                    {"matched_path": alert.metadata["matched_path"]}
                    if alert.rule_id == "LF-005"
                    else {}
                ),
            }
        )
    assert sorted(actual, key=lambda item: json.dumps(item, sort_keys=True)) == sorted(
        expected["expected_alerts"], key=lambda item: json.dumps(item, sort_keys=True)
    )


def test_all_samples_are_detected_automatically():
    result = analyze_samples(source_type="auto")
    assert len(result.files) == 3
    assert all(file.source_type for file in result.files)
    assert all(file.detection_confidence and file.detection_confidence > 0 for file in result.files)
    assert result.summary.parsed_events == 51


def test_normal_auth_dataset_does_not_trigger_auth_rules():
    result = analyze(
        [load_path(SAMPLE_DIR / "auth_normal.log")],
        source_type="linux_auth",
        year=2026,
        timezone_name="Asia/Jakarta",
    )
    assert result.alerts == []


def test_every_alert_evidence_resolves_to_an_event():
    result = analyze_samples()
    event_ids = {event.event_id for event in result.events}
    for alert in result.alerts:
        assert alert.evidence_event_ids
        assert set(alert.evidence_event_ids) <= event_ids
        for event_id in alert.evidence_event_ids:
            event = result.event_by_id[event_id]
            assert event.source_file
            assert event.source_line >= 1
            assert event.raw_message


def test_rerun_detection_uses_existing_events():
    result = analyze_samples()
    strict = DetectionSettings(
        failed_login_threshold=999,
        success_after_failures_threshold=999,
        multi_user_threshold=999,
        http_error_threshold=999,
        enabled_rules=("LF-001", "LF-002", "LF-003", "LF-004"),
    )
    rerun_detection(result, strict)
    assert result.alerts == []
    assert result.summary.total_alerts == 0


def test_export_contains_all_artifacts_and_consistent_counts():
    result = analyze_samples()
    artifacts = export_all(result)

    assert set(artifacts) == {
        "events.json",
        "events.csv",
        "alerts.json",
        "alerts.csv",
        "timeline.csv",
        "investigation-summary.md",
        "file_manifest.json",
    }

    events_payload = json.loads(artifacts["events.json"])
    alerts_payload = json.loads(artifacts["alerts.json"])
    manifest = json.loads(artifacts["file_manifest.json"])

    assert len(events_payload["events"]) == len(result.events)
    assert len(alerts_payload["alerts"]) == len(result.alerts)
    assert events_payload["events"][0]["raw_message"]
    assert len(manifest["files"]) == 3

    csv_lines = artifacts["events.csv"].decode("utf-8").splitlines()
    assert csv_lines[0].startswith("event_id,timestamp,timestamp_precision")
    assert len(csv_lines) == len(result.events) + 1

    timeline_lines = artifacts["timeline.csv"].decode("utf-8").splitlines()
    assert len(timeline_lines) == len(result.events) + 1

    summary = artifacts["investigation-summary.md"].decode("utf-8")
    assert "LogForensics Investigation Summary" in summary
    assert "Asia/Jakarta" in summary
    assert "Limitations" in summary


def test_export_zip_is_a_valid_archive():
    import io
    import zipfile

    result = analyze_samples()
    archive = zipfile.ZipFile(io.BytesIO(export_zip(result)))
    names = set(archive.namelist())
    assert "events.json" in names
    assert "timeline.csv" in names
    assert "investigation-summary.md" in names
