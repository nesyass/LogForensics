"""Lightweight alert correlation.

Correlation never claims that events are part of an attack. It only groups
alerts that share an observable attribute (currently source IP) and are close in
time, and it records the reason for the grouping.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from logforensics.config import SEVERITY_ORDER
from logforensics.models import Alert, Incident

DEFAULT_CORRELATION_WINDOW_SECONDS = 30 * 60


def _highest_severity(severities: list[str]) -> str:
    ranked = [severity for severity in SEVERITY_ORDER if severity in severities]
    return ranked[0] if ranked else "info"


def _make_incident(
    source_ip: str, alerts: list[Alert], window_seconds: int
) -> Incident:
    first_seen = min(alert.first_seen for alert in alerts)
    last_seen = max(alert.last_seen for alert in alerts)
    event_ids: list[str] = []
    seen: set[str] = set()
    for alert in alerts:
        for event_id in alert.evidence_event_ids:
            if event_id not in seen:
                seen.add(event_id)
                event_ids.append(event_id)
    reasons = [f"Alerts share source IP {source_ip}."]
    if len(alerts) > 1:
        reasons.append(
            "Consecutive alerts are within "
            f"{window_seconds // 60} minutes of each other."
        )
    return Incident(
        incident_id="",
        source_ip=source_ip,
        first_seen=first_seen,
        last_seen=last_seen,
        alert_ids=[alert.alert_id for alert in alerts],
        event_ids=event_ids,
        reasons=reasons,
        severity=_highest_severity([alert.severity for alert in alerts]),
    )


def build_incidents(
    alerts: list[Alert],
    window_seconds: int = DEFAULT_CORRELATION_WINDOW_SECONDS,
) -> list[Incident]:
    """Group alerts by source IP and temporal proximity."""

    grouped: dict[str, list[Alert]] = defaultdict(list)
    for alert in alerts:
        if alert.source_ip and alert.first_seen is not None:
            grouped[alert.source_ip].append(alert)

    incidents: list[Incident] = []
    for source_ip, ip_alerts in grouped.items():
        ip_alerts.sort(key=lambda alert: (alert.first_seen, alert.alert_id))
        current: list[Alert] = []
        for alert in ip_alerts:
            if current:
                gap = (alert.first_seen - current[-1].last_seen).total_seconds()
                if gap > window_seconds:
                    incidents.append(_make_incident(source_ip, current, window_seconds))
                    current = []
            current.append(alert)
        if current:
            incidents.append(_make_incident(source_ip, current, window_seconds))

    incidents.sort(key=lambda item: (item.first_seen or datetime.min, item.source_ip))
    for index, incident in enumerate(incidents, start=1):
        incident.incident_id = f"incident-{index:04d}"
    return incidents
