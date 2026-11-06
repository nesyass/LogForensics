from datetime import datetime, timedelta, timezone

from logforensics.analysis.timeline import analyze_ips, build_timeline
from logforensics.correlation.correlator import build_incidents
from logforensics.models import Alert, Event

BASE = datetime(2026, 11, 5, 9, 0, 0, tzinfo=timezone.utc)


def make_event(index, offset, *, ip="192.0.2.15", event_type="authentication_failure", status=None):
    return Event(
        event_id=f"evt-{index:06d}",
        timestamp=BASE + timedelta(seconds=offset),
        timestamp_precision="second",
        timestamp_timezone_known=True,
        source_file="sample.log",
        source_line=index,
        source_type="web_access" if status else "linux_auth",
        host="lab-server",
        event_category="web" if status else "authentication",
        event_type=event_type,
        source_ip=ip,
        http_status=status,
    )


def make_alert(alert_id, rule_id, first_offset, evidence, ip="192.0.2.15", severity="medium"):
    return Alert(
        alert_id=alert_id,
        rule_id=rule_id,
        title=rule_id,
        severity=severity,
        source_ip=ip,
        event_count=len(evidence),
        first_seen=BASE + timedelta(seconds=first_offset),
        last_seen=BASE + timedelta(seconds=first_offset + 30),
        reason="test",
        evidence_event_ids=evidence,
    )


def test_timeline_is_sorted_and_flags_alert_evidence():
    events = [make_event(2, 20), make_event(1, 10)]
    alerts = [make_alert("alert-0001", "LF-001", 10, ["evt-000001"])]
    rows = build_timeline(events, alerts)

    assert [row["event_id"] for row in rows] == ["evt-000001", "evt-000002"]
    assert rows[0]["is_alert_evidence"] is True
    assert rows[0]["related_alert_ids"] == "alert-0001"
    assert rows[1]["is_alert_evidence"] is False
    assert rows[1]["source_file"] == "sample.log"


def test_ip_analysis_counts_auth_and_http_activity():
    events = [
        make_event(1, 0, event_type="authentication_failure"),
        make_event(2, 5, event_type="authentication_failure"),
        make_event(3, 10, event_type="authentication_success"),
        make_event(4, 15, event_type="http_request", status=404),
        make_event(5, 20, event_type="http_request", status=503),
    ]
    alerts = [make_alert("alert-0001", "LF-005", 15, ["evt-000004"])]
    rows = analyze_ips(events, alerts)

    assert len(rows) == 1
    row = rows[0]
    assert row["source_ip"] == "192.0.2.15"
    assert row["total_events"] == 5
    assert row["auth_failures"] == 2
    assert row["auth_successes"] == 1
    assert row["http_requests"] == 2
    assert row["http_4xx"] == 1
    assert row["http_5xx"] == 1
    assert row["alert_count"] == 1


def test_incidents_group_alerts_by_ip_and_time():
    alerts = [
        make_alert("alert-0001", "LF-001", 0, ["evt-000001"], severity="medium"),
        make_alert("alert-0002", "LF-002", 60, ["evt-000002"], severity="high"),
        make_alert("alert-0003", "LF-004", 4000, ["evt-000003"], severity="medium"),
        make_alert("alert-0004", "LF-004", 0, ["evt-000004"], ip="203.0.113.9"),
    ]
    incidents = build_incidents(alerts)

    assert len(incidents) == 3
    first = incidents[0]
    assert first.source_ip == "192.0.2.15"
    assert first.alert_ids == ["alert-0001", "alert-0002"]
    assert first.severity == "high"
    assert "share source IP" in first.reasons[0]
    assert "within 30 minutes" in first.reasons[1]


def test_incidents_skip_alerts_without_source_ip():
    alerts = [make_alert("alert-0001", "LF-005", 0, ["evt-000001"], ip=None)]
    assert build_incidents(alerts) == []
