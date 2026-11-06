"""Core data structures shared by parsers, detection, analysis and export."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


@dataclass
class ParsedRecord:
    """Format-specific fields extracted by a parser before normalization."""

    source_file: str
    source_line: int
    source_type: str
    raw_message: str
    timestamp: datetime
    timestamp_precision: str = "second"
    timestamp_timezone_known: bool = True
    timestamp_assumption: str | None = None
    host: str | None = None
    event_category: str = "unknown"
    event_type: str = "unknown"
    username: str | None = None
    source_ip: str | None = None
    source_port: int | None = None
    destination_ip: str | None = None
    http_method: str | None = None
    http_path: str | None = None
    http_status: int | None = None
    process: str | None = None
    user_agent: str | None = None
    message: str = ""
    pid: int | None = None


@dataclass
class Event:
    """Normalized event with full evidence traceability."""

    event_id: str
    timestamp: datetime | None
    timestamp_precision: str
    timestamp_timezone_known: bool
    source_file: str
    source_line: int
    source_type: str
    host: str | None
    event_category: str
    event_type: str
    username: str | None = None
    source_ip: str | None = None
    source_port: int | None = None
    destination_ip: str | None = None
    http_method: str | None = None
    http_path: str | None = None
    http_status: int | None = None
    process: str | None = None
    user_agent: str | None = None
    raw_message: str = ""
    message: str = ""
    parse_status: str = "success"
    timestamp_assumption: str | None = None
    pid: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "timestamp": _iso(self.timestamp),
            "timestamp_precision": self.timestamp_precision,
            "timestamp_timezone_known": self.timestamp_timezone_known,
            "timestamp_assumption": self.timestamp_assumption,
            "source_file": self.source_file,
            "source_line": self.source_line,
            "source_type": self.source_type,
            "host": self.host,
            "event_category": self.event_category,
            "event_type": self.event_type,
            "username": self.username,
            "source_ip": self.source_ip,
            "source_port": self.source_port,
            "destination_ip": self.destination_ip,
            "http_method": self.http_method,
            "http_path": self.http_path,
            "http_status": self.http_status,
            "process": self.process,
            "user_agent": self.user_agent,
            "pid": self.pid,
            "message": self.message,
            "raw_message": self.raw_message,
            "parse_status": self.parse_status,
        }


@dataclass
class ParseError:
    """A line that could not be parsed. Errors are never discarded silently."""

    source_file: str
    source_line: int
    raw_line: str
    reason: str
    parser: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_file": self.source_file,
            "source_line": self.source_line,
            "raw_line": self.raw_line,
            "reason": self.reason,
            "parser": self.parser,
        }


@dataclass
class Alert:
    """Explainable detection result referencing the events that triggered it."""

    rule_id: str
    title: str
    severity: str
    source_ip: str | None
    event_count: int
    first_seen: datetime | None
    last_seen: datetime | None
    reason: str
    evidence_event_ids: list[str]
    alert_id: str = ""
    status: str = "needs_review"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "rule_id": self.rule_id,
            "title": self.title,
            "severity": self.severity,
            "status": self.status,
            "source_ip": self.source_ip,
            "event_count": self.event_count,
            "first_seen": _iso(self.first_seen),
            "last_seen": _iso(self.last_seen),
            "reason": self.reason,
            "evidence_event_ids": list(self.evidence_event_ids),
            "metadata": dict(self.metadata),
        }


@dataclass
class Incident:
    """Lightweight correlation group of alerts sharing an attribute."""

    incident_id: str
    source_ip: str | None
    first_seen: datetime | None
    last_seen: datetime | None
    alert_ids: list[str]
    event_ids: list[str]
    reasons: list[str]
    severity: str = "info"

    def to_dict(self) -> dict[str, Any]:
        return {
            "incident_id": self.incident_id,
            "source_ip": self.source_ip,
            "first_seen": _iso(self.first_seen),
            "last_seen": _iso(self.last_seen),
            "alert_ids": list(self.alert_ids),
            "event_ids": list(self.event_ids),
            "reasons": list(self.reasons),
            "severity": self.severity,
        }


@dataclass
class FileSummary:
    name: str
    size_bytes: int
    sha256: str
    encoding: str
    source_type: str | None
    total_lines: int
    parsed_lines: int
    error_lines: int
    detection_confidence: float | None = None
    note: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "size_bytes": self.size_bytes,
            "sha256": self.sha256,
            "encoding": self.encoding,
            "source_type": self.source_type,
            "total_lines": self.total_lines,
            "parsed_lines": self.parsed_lines,
            "error_lines": self.error_lines,
            "detection_confidence": self.detection_confidence,
            "note": self.note,
        }


@dataclass
class AnalysisSummary:
    total_files: int = 0
    total_lines: int = 0
    parsed_events: int = 0
    parse_errors: int = 0
    total_alerts: int = 0
    severity_counts: dict[str, int] = field(default_factory=dict)
    first_event: datetime | None = None
    last_event: datetime | None = None
    timezone_name: str = ""
    year_assumption: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_files": self.total_files,
            "total_lines": self.total_lines,
            "parsed_events": self.parsed_events,
            "parse_errors": self.parse_errors,
            "total_alerts": self.total_alerts,
            "severity_counts": dict(self.severity_counts),
            "first_event": _iso(self.first_event),
            "last_event": _iso(self.last_event),
            "timezone_name": self.timezone_name,
            "year_assumption": self.year_assumption,
        }


@dataclass
class AnalysisResult:
    events: list[Event] = field(default_factory=list)
    parse_errors: list[ParseError] = field(default_factory=list)
    alerts: list[Alert] = field(default_factory=list)
    incidents: list[Incident] = field(default_factory=list)
    files: list[FileSummary] = field(default_factory=list)
    summary: AnalysisSummary = field(default_factory=AnalysisSummary)
    settings: Any = None

    @property
    def event_by_id(self) -> dict[str, Event]:
        return {event.event_id: event for event in self.events}

    @property
    def alert_by_id(self) -> dict[str, Alert]:
        return {alert.alert_id: alert for alert in self.alerts}
