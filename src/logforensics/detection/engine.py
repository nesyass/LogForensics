"""Explainable, rule-based detection engine."""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import unquote

from logforensics.config import DetectionSettings
from logforensics.detection.rules import RULES
from logforensics.models import Alert, Event


def normalize_http_path(path: str | None) -> str:
    """Normalize a URL path for defensive, transparent path matching."""

    if not path:
        return ""
    decoded = path.strip().lower()
    # Decode conservatively more than once to catch common double-encoding,
    # without looping indefinitely on crafted input.
    for _ in range(3):
        candidate = unquote(decoded)
        if candidate == decoded:
            break
        decoded = candidate
    decoded = decoded.split("?", 1)[0].split("#", 1)[0]
    parts = [part for part in decoded.split("/") if part]
    return "/" + "/".join(parts)


def _sorted(events: list[Event]) -> list[Event]:
    return sorted(events, key=lambda event: (event.timestamp, event.event_id))


def _build_alert(
    rule_id: str,
    events: list[Event],
    reason: str,
    source_ip: str | None,
    metadata: dict | None = None,
) -> Alert:
    rule = RULES[rule_id]
    ordered = _sorted(events)
    timestamps = [event.timestamp for event in ordered if event.timestamp is not None]
    return Alert(
        rule_id=rule.id,
        title=rule.name,
        severity=rule.severity,
        source_ip=source_ip,
        event_count=len(ordered),
        first_seen=min(timestamps) if timestamps else None,
        last_seen=max(timestamps) if timestamps else None,
        reason=reason,
        evidence_event_ids=[event.event_id for event in ordered],
        metadata=metadata or {},
    )


def _authentication_events(events: list[Event], event_type: str) -> list[Event]:
    return [
        event
        for event in events
        if event.event_type == event_type
        and event.timestamp is not None
        and event.source_ip
    ]


def _detect_failed_login_burst(
    events: list[Event], settings: DetectionSettings
) -> list[Alert]:
    groups: dict[str, list[Event]] = defaultdict(list)
    for event in _authentication_events(events, "authentication_failure"):
        groups[event.source_ip].append(event)

    alerts: list[Alert] = []
    for source_ip, group_events in groups.items():
        window: list[Event] = []
        for event in _sorted(group_events):
            window.append(event)
            while (
                window
                and (event.timestamp - window[0].timestamp).total_seconds()
                > settings.failed_login_window_seconds
            ):
                window.pop(0)
            if len(window) >= settings.failed_login_threshold:
                evidence = list(window)
                users = sorted({item.username for item in evidence if item.username})
                alerts.append(
                    _build_alert(
                        "LF-001",
                        evidence,
                        (
                            f"{len(evidence)} failed authentication events from the "
                            f"same IP within {settings.failed_login_window_seconds} "
                            f"seconds ({len(users)} distinct username(s))."
                        ),
                        source_ip,
                        {
                            "window_seconds": settings.failed_login_window_seconds,
                            "threshold": settings.failed_login_threshold,
                            "distinct_usernames": users,
                        },
                    )
                )
                # One alert per burst: subsequent failures must accumulate a new
                # full window before another alert is raised.
                window = []
    return alerts


def _detect_success_after_failures(
    events: list[Event], settings: DetectionSettings
) -> list[Alert]:
    failures: dict[str, list[Event]] = defaultdict(list)
    successes: dict[str, list[Event]] = defaultdict(list)
    for event in _authentication_events(events, "authentication_failure"):
        failures[event.source_ip].append(event)
    for event in _authentication_events(events, "authentication_success"):
        successes[event.source_ip].append(event)

    alerts: list[Alert] = []
    for source_ip, success_events in successes.items():
        failure_events = _sorted(failures.get(source_ip, []))
        if not failure_events:
            continue
        failure_times = [event.timestamp for event in failure_events]
        last_alert_at: datetime | None = None
        for success in _sorted(success_events):
            window_start = success.timestamp - timedelta(
                seconds=settings.success_after_failures_window_seconds
            )
            left = bisect_left(failure_times, window_start)
            right = bisect_right(failure_times, success.timestamp)
            prior = failure_events[left:right]
            if len(prior) < settings.success_after_failures_threshold:
                continue
            if (
                last_alert_at is not None
                and (
                    success.timestamp - last_alert_at
                ).total_seconds()
                <= settings.success_after_failures_window_seconds
            ):
                continue
            evidence = prior + [success]
            alerts.append(
                _build_alert(
                    "LF-002",
                    evidence,
                    (
                        f"Successful authentication for '{success.username or 'unknown'}' "
                        f"after {len(prior)} failed attempts from the same IP within "
                        f"{settings.success_after_failures_window_seconds} seconds. "
                        "Verify whether this was legitimate or a compromised account."
                    ),
                    source_ip,
                    {
                        "failure_count": len(prior),
                        "window_seconds": settings.success_after_failures_window_seconds,
                        "successful_username": success.username,
                    },
                )
            )
            last_alert_at = success.timestamp
    return alerts


def _detect_multi_user(
    events: list[Event], settings: DetectionSettings
) -> list[Alert]:
    groups: dict[str, list[Event]] = defaultdict(list)
    for event in _authentication_events(events, "authentication_failure"):
        if event.username:
            groups[event.source_ip].append(event)

    alerts: list[Alert] = []
    for source_ip, group_events in groups.items():
        window: list[Event] = []
        for event in _sorted(group_events):
            window.append(event)
            while (
                window
                and (event.timestamp - window[0].timestamp).total_seconds()
                > settings.multi_user_window_seconds
            ):
                window.pop(0)
            usernames = {item.username for item in window if item.username}
            if len(usernames) >= settings.multi_user_threshold:
                evidence = list(window)
                alerts.append(
                    _build_alert(
                        "LF-003",
                        evidence,
                        (
                            f"{len(usernames)} distinct usernames were targeted from "
                            f"the same IP within {settings.multi_user_window_seconds} "
                            "seconds. Consider password spraying or account "
                            "enumeration, and verify before concluding compromise."
                        ),
                        source_ip,
                        {
                            "distinct_usernames": sorted(usernames),
                            "window_seconds": settings.multi_user_window_seconds,
                            "threshold": settings.multi_user_threshold,
                        },
                    )
                )
                window = []
    return alerts


def _detect_http_error_spike(
    events: list[Event], settings: DetectionSettings
) -> list[Alert]:
    groups: dict[str, list[Event]] = defaultdict(list)
    for event in events:
        if (
            event.http_status is not None
            and event.http_status >= 400
            and event.source_ip
            and event.timestamp is not None
        ):
            groups[event.source_ip].append(event)

    alerts: list[Alert] = []
    for source_ip, group_events in groups.items():
        window: list[Event] = []
        for event in _sorted(group_events):
            window.append(event)
            while (
                window
                and (event.timestamp - window[0].timestamp).total_seconds()
                > settings.http_error_window_seconds
            ):
                window.pop(0)
            if len(window) >= settings.http_error_threshold:
                evidence = list(window)
                count_4xx = sum(
                    1 for item in evidence if 400 <= item.http_status < 500
                )
                count_5xx = sum(
                    1 for item in evidence if 500 <= item.http_status < 600
                )
                alerts.append(
                    _build_alert(
                        "LF-004",
                        evidence,
                        (
                            f"{len(evidence)} HTTP error responses from the same IP "
                            f"within {settings.http_error_window_seconds} seconds "
                            f"({count_4xx} client errors, {count_5xx} server errors)."
                        ),
                        source_ip,
                        {
                            "http_4xx": count_4xx,
                            "http_5xx": count_5xx,
                            "window_seconds": settings.http_error_window_seconds,
                            "threshold": settings.http_error_threshold,
                        },
                    )
                )
                window = []
    return alerts


def _path_matches(path: str, needle: str) -> bool:
    normalized = normalize_http_path(path)
    target = "/" + needle.strip("/").lower()
    if not normalized:
        return False
    if normalized == target or normalized.startswith(target + "/"):
        return True
    return target.strip("/") in [part for part in normalized.split("/") if part]


def _detect_sensitive_path(
    events: list[Event], settings: DetectionSettings
) -> list[Alert]:
    grouped: dict[tuple[str, str], list[Event]] = defaultdict(list)
    for event in events:
        if not event.http_path or event.timestamp is None:
            continue
        for needle in settings.sensitive_paths:
            if _path_matches(event.http_path, needle):
                grouped[(event.source_ip or "unknown", needle)].append(event)
                break

    alerts: list[Alert] = []
    for (source_ip, needle), evidence in grouped.items():
        ordered = _sorted(evidence)
        statuses = sorted(
            {item.http_status for item in ordered if item.http_status is not None}
        )
        alert = _build_alert(
            "LF-005",
            evidence,
            (
                f"{len(evidence)} request(s) to sensitive path '{needle}' were "
                "observed. Review the request and response status; the request "
                "alone is not evidence of exploitation."
            ),
            None if source_ip == "unknown" else source_ip,
            {
                "matched_path": needle,
                "normalized_paths": sorted(
                    {normalize_http_path(item.http_path) for item in ordered}
                ),
                "http_statuses": statuses,
                "severity": settings.sensitive_path_severity,
            },
        )
        alert.severity = settings.sensitive_path_severity
        alerts.append(alert)
    return alerts


def run_detection(events: list[Event], settings: DetectionSettings) -> list[Alert]:
    """Run all enabled rules and return deterministic, explainable alerts."""

    alerts: list[Alert] = []
    if settings.is_enabled("LF-001"):
        alerts.extend(_detect_failed_login_burst(events, settings))
    if settings.is_enabled("LF-002"):
        alerts.extend(_detect_success_after_failures(events, settings))
    if settings.is_enabled("LF-003"):
        alerts.extend(_detect_multi_user(events, settings))
    if settings.is_enabled("LF-004"):
        alerts.extend(_detect_http_error_spike(events, settings))
    if settings.is_enabled("LF-005"):
        alerts.extend(_detect_sensitive_path(events, settings))

    alerts.sort(
        key=lambda alert: (
            alert.first_seen is None,
            alert.first_seen or datetime.min,
            alert.rule_id,
            alert.source_ip or "",
        )
    )
    for index, alert in enumerate(alerts, start=1):
        alert.alert_id = f"alert-{index:04d}"
    return alerts
