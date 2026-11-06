from datetime import datetime, timedelta, timezone

from logforensics.config import DetectionSettings
from logforensics.detection.engine import normalize_http_path, run_detection
from logforensics.models import Event

BASE = datetime(2026, 11, 5, 9, 0, 0, tzinfo=timezone.utc)


def make_event(
    index,
    offset_seconds,
    *,
    event_type="authentication_failure",
    source_ip="203.0.113.50",
    username="root",
    http_path=None,
    http_status=None,
):
    return Event(
        event_id=f"evt-{index:06d}",
        timestamp=BASE + timedelta(seconds=offset_seconds),
        timestamp_precision="second",
        timestamp_timezone_known=True,
        source_file="test.log",
        source_line=index,
        source_type="web_access" if http_path else "linux_auth",
        host="lab-server",
        event_category="web" if http_path else "authentication",
        event_type=event_type,
        username=username,
        source_ip=source_ip,
        http_method="GET" if http_path else None,
        http_path=http_path,
        http_status=http_status,
    )


def test_failed_login_burst_triggers_at_threshold():
    events = [make_event(i, i * 5) for i in range(1, 4)]
    settings = DetectionSettings(
        failed_login_threshold=3, failed_login_window_seconds=60
    )
    alerts = run_detection(events, settings)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.rule_id == "LF-001"
    assert alert.source_ip == "203.0.113.50"
    assert alert.event_count == 3
    assert alert.severity == "medium"
    assert alert.evidence_event_ids == ["evt-000001", "evt-000002", "evt-000003"]
    assert "3 failed authentication events" in alert.reason


def test_normal_login_activity_produces_no_failed_login_alert():
    events = [make_event(i, i * 10) for i in range(1, 4)]
    settings = DetectionSettings(
        failed_login_threshold=10, failed_login_window_seconds=120
    )
    alerts = run_detection(events, settings)
    assert not [alert for alert in alerts if alert.rule_id == "LF-001"]


def test_events_outside_window_are_not_counted():
    events = [
        make_event(1, 0),
        make_event(2, 30),
        make_event(3, 100),
        make_event(4, 120),
    ]
    settings = DetectionSettings(
        failed_login_threshold=3, failed_login_window_seconds=60
    )
    alerts = run_detection(events, settings)
    assert not [alert for alert in alerts if alert.rule_id == "LF-001"]


def test_events_without_source_ip_do_not_crash():
    events = [
        make_event(1, 0, source_ip=None),
        make_event(2, 5, source_ip=None),
        make_event(3, 10, source_ip=None),
    ]
    settings = DetectionSettings(
        failed_login_threshold=2, failed_login_window_seconds=60
    )
    alerts = run_detection(events, settings)
    assert alerts == []


def test_successful_login_after_repeated_failures():
    events = [make_event(i, i * 10) for i in range(1, 6)]
    events.append(make_event(6, 60, event_type="authentication_success", username="admin"))
    settings = DetectionSettings(success_after_failures_threshold=5)
    alerts = run_detection(events, settings)
    rule_alerts = [alert for alert in alerts if alert.rule_id == "LF-002"]
    assert len(rule_alerts) == 1
    assert rule_alerts[0].severity == "high"
    assert rule_alerts[0].event_count == 6
    assert "Successful authentication" in rule_alerts[0].reason


def test_success_with_few_failures_does_not_alert():
    events = [make_event(i, i * 10) for i in range(1, 4)]
    events.append(make_event(4, 60, event_type="authentication_success"))
    alerts = run_detection(events, DetectionSettings())
    assert not [alert for alert in alerts if alert.rule_id == "LF-002"]


def test_multi_user_login_attempts():
    users = ["admin", "root", "oracle", "test", "ubuntu"]
    events = [
        make_event(index + 1, index * 10, username=user)
        for index, user in enumerate(users)
    ]
    settings = DetectionSettings(multi_user_threshold=5, multi_user_window_seconds=300)
    alerts = run_detection(events, settings)
    rule_alerts = [alert for alert in alerts if alert.rule_id == "LF-003"]
    assert len(rule_alerts) == 1
    assert rule_alerts[0].metadata["distinct_usernames"] == sorted(users)
    assert "5 distinct usernames" in rule_alerts[0].reason


def test_http_error_spike_reports_4xx_and_5xx_separately():
    events = []
    for index in range(6):
        events.append(
            make_event(
                index + 1,
                index * 5,
                event_type="http_request",
                http_path="/missing",
                http_status=404,
            )
        )
    for index in range(4):
        events.append(
            make_event(
                7 + index,
                30 + index * 5,
                event_type="http_request",
                http_path="/api",
                http_status=500,
            )
        )
    settings = DetectionSettings(http_error_threshold=10, http_error_window_seconds=60)
    alerts = run_detection(events, settings)
    rule_alerts = [alert for alert in alerts if alert.rule_id == "LF-004"]
    assert len(rule_alerts) == 1
    assert rule_alerts[0].event_count == 10
    assert rule_alerts[0].metadata["http_4xx"] == 6
    assert rule_alerts[0].metadata["http_5xx"] == 4


def test_sensitive_path_matching_and_normalization():
    assert normalize_http_path("/%2Eenv?x=1") == "/.env"
    assert normalize_http_path("/%252Eenv") == "/.env"
    assert normalize_http_path("//ADMIN//login//") == "/admin/login"
    assert normalize_http_path("") == ""

    events = [
        make_event(
            1,
            0,
            event_type="http_request",
            http_path="/%2Eenv?probe=1",
            http_status=404,
        ),
        make_event(
            2,
            5,
            event_type="http_request",
            http_path="/.ENV",
            http_status=403,
        ),
        make_event(
            3,
            10,
            event_type="http_request",
            http_path="/admin/users",
            http_status=403,
        ),
    ]
    alerts = run_detection(events, DetectionSettings())
    sensitive = [alert for alert in alerts if alert.rule_id == "LF-005"]
    assert len(sensitive) == 2
    env_alert = next(alert for alert in sensitive if alert.metadata["matched_path"] == ".env")
    assert env_alert.event_count == 2
    assert env_alert.severity == "medium"
    assert "not evidence of exploitation" in env_alert.reason


def test_disabled_rules_are_skipped():
    events = [make_event(i, i) for i in range(1, 4)]
    settings = DetectionSettings(
        failed_login_threshold=2,
        failed_login_window_seconds=60,
        enabled_rules=("LF-004",),
    )
    alerts = run_detection(events, settings)
    assert alerts == []
