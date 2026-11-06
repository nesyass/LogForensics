"""Timeline construction and IP-oriented aggregation."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from logforensics.config import SEVERITY_ORDER
from logforensics.models import Alert, Event


def build_timeline(events: list[Event], alerts: list[Alert]) -> list[dict[str, Any]]:
    """Return chronologically sorted events, flagging alert evidence."""

    evidence: dict[str, list[str]] = defaultdict(list)
    for alert in alerts:
        for event_id in alert.evidence_event_ids:
            evidence[event_id].append(alert.alert_id)

    rows: list[dict[str, Any]] = []
    for event in events:
        alert_ids = sorted(set(evidence.get(event.event_id, [])))
        rows.append(
            {
                "timestamp": event.timestamp,
                "event_id": event.event_id,
                "event_category": event.event_category,
                "event_type": event.event_type,
                "host": event.host,
                "username": event.username,
                "source_ip": event.source_ip,
                "http_method": event.http_method,
                "http_path": event.http_path,
                "http_status": event.http_status,
                "source_file": event.source_file,
                "source_line": event.source_line,
                "is_alert_evidence": bool(alert_ids),
                "related_alert_ids": ", ".join(alert_ids),
                "related_alert_count": len(alert_ids),
            }
        )

    rows.sort(
        key=lambda row: (
            row["timestamp"] is None,
            row["timestamp"] or datetime.min,
            row["event_id"],
        )
    )
    return rows


def analyze_ips(events: list[Event], alerts: list[Alert]) -> list[dict[str, Any]]:
    """Aggregate authentication, web and alert activity per source IP."""

    rows: dict[str, dict[str, Any]] = {}
    alerts_by_ip: dict[str, list[Alert]] = defaultdict(list)
    for alert in alerts:
        alerts_by_ip[alert.source_ip or "unknown"].append(alert)

    def row_for(ip: str) -> dict[str, Any]:
        if ip not in rows:
            rows[ip] = {
                "source_ip": ip,
                "total_events": 0,
                "auth_failures": 0,
                "auth_successes": 0,
                "http_requests": 0,
                "http_4xx": 0,
                "http_5xx": 0,
                "alert_count": 0,
                "max_severity": "info",
                "alert_ids": [],
            }
        return rows[ip]

    for event in events:
        ip = event.source_ip or "unknown"
        row = row_for(ip)
        row["total_events"] += 1
        if event.event_type == "authentication_failure":
            row["auth_failures"] += 1
        elif event.event_type == "authentication_success":
            row["auth_successes"] += 1
        if event.event_category == "web" or event.http_status is not None:
            row["http_requests"] += 1
        if event.http_status is not None and 400 <= event.http_status < 500:
            row["http_4xx"] += 1
        if event.http_status is not None and 500 <= event.http_status < 600:
            row["http_5xx"] += 1

    for ip, ip_alerts in alerts_by_ip.items():
        row = row_for(ip)
        row["alert_count"] = len(ip_alerts)
        severities = {alert.severity for alert in ip_alerts}
        row["max_severity"] = next(
            (severity for severity in SEVERITY_ORDER if severity in severities),
            "info",
        )
        row["alert_ids"] = sorted(alert.alert_id for alert in ip_alerts)

    return sorted(
        rows.values(),
        key=lambda row: (-row["total_events"], row["source_ip"]),
    )
