"""JSON, CSV and Markdown export of analysis results."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any

from logforensics.config import APP_NAME, APP_VERSION
from logforensics.models import AnalysisResult, Event

EVENT_COLUMNS = [
    "event_id",
    "timestamp",
    "timestamp_precision",
    "timestamp_timezone_known",
    "timestamp_assumption",
    "source_file",
    "source_line",
    "source_type",
    "host",
    "event_category",
    "event_type",
    "username",
    "source_ip",
    "source_port",
    "http_method",
    "http_path",
    "http_status",
    "process",
    "user_agent",
    "message",
    "raw_message",
    "parse_status",
]

ALERT_COLUMNS = [
    "alert_id",
    "rule_id",
    "title",
    "severity",
    "status",
    "source_ip",
    "event_count",
    "first_seen",
    "last_seen",
    "reason",
    "evidence_event_ids",
    "metadata_json",
]

TIMELINE_COLUMNS = [
    "timestamp",
    "event_id",
    "event_category",
    "event_type",
    "host",
    "username",
    "source_ip",
    "http_method",
    "http_path",
    "http_status",
    "source_file",
    "source_line",
    "is_alert_evidence",
    "related_alert_ids",
]


def _timestamp(value: datetime | None) -> str:
    return value.isoformat() if value else ""


def _md_cell(value: Any) -> str:
    text = str(value).replace("|", "\\|").replace("\n", " ")
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _events_csv(events: list[Event]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=EVENT_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for event in events:
        row = event.to_dict()
        writer.writerow({column: row.get(column, "") for column in EVENT_COLUMNS})
    return buffer.getvalue().encode("utf-8")


def _alerts_csv(result: AnalysisResult) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=ALERT_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for alert in result.alerts:
        row = alert.to_dict()
        writer.writerow(
            {
                "alert_id": row["alert_id"],
                "rule_id": row["rule_id"],
                "title": row["title"],
                "severity": row["severity"],
                "status": row["status"],
                "source_ip": row["source_ip"] or "",
                "event_count": row["event_count"],
                "first_seen": row["first_seen"] or "",
                "last_seen": row["last_seen"] or "",
                "reason": row["reason"],
                "evidence_event_ids": ";".join(row["evidence_event_ids"]),
                "metadata_json": json.dumps(row["metadata"], sort_keys=True),
            }
        )
    return buffer.getvalue().encode("utf-8")


def _timeline_rows(result: AnalysisResult) -> list[dict[str, Any]]:
    from logforensics.analysis.timeline import build_timeline

    return build_timeline(result.events, result.alerts)


def _timeline_csv(result: AnalysisResult) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(
        buffer, fieldnames=TIMELINE_COLUMNS, extrasaction="ignore"
    )
    writer.writeheader()
    for row in _timeline_rows(result):
        writer.writerow(
            {
                **row,
                "timestamp": _timestamp(row["timestamp"]),
            }
        )
    return buffer.getvalue().encode("utf-8")


def _summary_markdown(result: AnalysisResult, generated_at: datetime) -> bytes:
    summary = result.summary
    lines: list[str] = [
        f"# {APP_NAME} Investigation Summary",
        "",
        f"- Generated: {generated_at.isoformat()}",
        f"- Tool version: {APP_VERSION}",
        f"- Analysis timezone: {summary.timezone_name}",
        f"- Year assumed for year-less timestamps: {summary.year_assumption}",
        "",
        "> This report contains findings that require analyst review. Detection",
        "> output is not proof of compromise. Logs may contain sensitive data;",
        "> review before sharing.",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Files analyzed | {summary.total_files} |",
        f"| Log lines read | {summary.total_lines} |",
        f"| Parsed events | {summary.parsed_events} |",
        f"| Parse errors | {summary.parse_errors} |",
        f"| Alerts | {summary.total_alerts} |",
        f"| First event | {_timestamp(summary.first_event) or 'n/a'} |",
        f"| Last event | {_timestamp(summary.last_event) or 'n/a'} |",
        "",
        "## Files",
        "",
        "| File | Type | Lines | Parsed | Errors | SHA-256 |",
        "| --- | --- | ---: | ---: | ---: | --- |",
    ]
    for file in result.files:
        lines.append(
            f"| {_md_cell(file.name)} | {_md_cell(file.source_type or 'unknown')} | "
            f"{file.total_lines} | {file.parsed_lines} | {file.error_lines} | "
            f"`{file.sha256}` |"
        )

    lines.extend(["", "## Severity Distribution", ""])
    if summary.severity_counts:
        lines.extend(["| Severity | Alerts |", "| --- | ---: |"])
        for severity, count in summary.severity_counts.items():
            lines.append(f"| {severity} | {count} |")
    else:
        lines.append("No alerts were raised.")

    lines.extend(
        [
            "",
            "## Alerts",
            "",
            "| Alert | Rule | Severity | Status | IP | Events | First seen | Last seen | Reason |",
            "| --- | --- | --- | --- | --- | ---: | --- | --- | --- |",
        ]
    )
    if result.alerts:
        for alert in result.alerts:
            lines.append(
                f"| {alert.alert_id} | {alert.rule_id} | {alert.severity} | "
                f"{alert.status} | {_md_cell(alert.source_ip or 'n/a')} | "
                f"{alert.event_count} | {_timestamp(alert.first_seen) or 'n/a'} | "
                f"{_timestamp(alert.last_seen) or 'n/a'} | {_md_cell(alert.reason)} |"
            )
    else:
        lines.append("| n/a | n/a | n/a | n/a | n/a | 0 | n/a | n/a | No alerts |")

    lines.extend(["", "## Correlated Incidents", ""])
    if result.incidents:
        for incident in result.incidents:
            lines.append(
                f"- **{incident.incident_id}** ({incident.severity}) — "
                f"IP {incident.source_ip}, alerts: "
                f"{', '.join(incident.alert_ids)}. "
                f"Reasons: {' '.join(incident.reasons)}"
            )
    else:
        lines.append("No incidents were correlated.")

    lines.extend(["", "## Parse Errors", ""])
    if result.parse_errors:
        lines.extend(
            [
                "| File | Line | Parser | Reason |",
                "| --- | ---: | --- | --- |",
            ]
        )
        for error in result.parse_errors[:100]:
            lines.append(
                f"| {_md_cell(error.source_file)} | {error.source_line} | "
                f"{error.parser} | {_md_cell(error.reason)} |"
            )
        if len(result.parse_errors) > 100:
            lines.append(
                f"\n_Only the first 100 of {len(result.parse_errors)} errors are shown._"
            )
    else:
        lines.append("No parse errors.")

    lines.extend(
        [
            "",
            "## Limitations",
            "",
            "- Detection is rule-based and explainable; it does not prove an attack.",
            "- Syslog timestamps may lack a year and timezone; assumptions are explicit",
            "  in the analysis settings and in each event.",
            "- No geolocation, automatic blocking or threat-actor attribution is performed.",
            "- Source line numbers and SHA-256 hashes support traceability but do not",
            "  establish a legal chain of custody.",
            "",
        ]
    )
    return "\n".join(lines).encode("utf-8")


def _manifest_json(result: AnalysisResult, generated_at: datetime) -> bytes:
    payload = {
        "tool": APP_NAME,
        "version": APP_VERSION,
        "generated_at": generated_at.isoformat(),
        "files": [file.to_dict() for file in result.files],
    }
    return json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")


def export_all(
    result: AnalysisResult, generated_at: datetime | None = None
) -> dict[str, bytes]:
    """Return every export artifact as ``filename -> bytes``."""

    generated_at = generated_at or datetime.now().astimezone()
    events_payload = {
        "tool": APP_NAME,
        "version": APP_VERSION,
        "generated_at": generated_at.isoformat(),
        "summary": result.summary.to_dict(),
        "events": [event.to_dict() for event in result.events],
    }
    alerts_payload = {
        "tool": APP_NAME,
        "version": APP_VERSION,
        "generated_at": generated_at.isoformat(),
        "summary": result.summary.to_dict(),
        "alerts": [alert.to_dict() for alert in result.alerts],
    }
    return {
        "events.json": json.dumps(
            events_payload, indent=2, sort_keys=True
        ).encode("utf-8"),
        "events.csv": _events_csv(result.events),
        "alerts.json": json.dumps(
            alerts_payload, indent=2, sort_keys=True
        ).encode("utf-8"),
        "alerts.csv": _alerts_csv(result),
        "timeline.csv": _timeline_csv(result),
        "investigation-summary.md": _summary_markdown(result, generated_at),
        "file_manifest.json": _manifest_json(result, generated_at),
    }


def export_zip(
    result: AnalysisResult, generated_at: datetime | None = None
) -> bytes:
    import zipfile

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in export_all(result, generated_at).items():
            archive.writestr(name, content)
    return buffer.getvalue()
