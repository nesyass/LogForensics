"""SQLite persistence for local LogForensics cases.

The database is deliberately local and boring: one file, no server, no ORM.
It stores the evidence needed to reopen a case, while keeping the raw log line
and source location for every event.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from logforensics.config import (
    REVIEW_STATUSES,
    SEVERITY_ORDER,
    DetectionSettings,
)
from logforensics.models import (
    Alert,
    AnalysisResult,
    AnalysisSummary,
    Event,
    FileSummary,
    Incident,
    ParseError,
)
from logforensics.reporting import export_all, export_zip

SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    timezone TEXT NOT NULL,
    year INTEGER,
    parser TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    settings_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_files (
    case_id TEXT NOT NULL,
    file_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    encoding TEXT NOT NULL,
    source_type TEXT,
    total_lines INTEGER NOT NULL,
    parsed_lines INTEGER NOT NULL,
    error_lines INTEGER NOT NULL,
    detection_confidence REAL,
    note TEXT,
    PRIMARY KEY (case_id, file_index),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
    case_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    timestamp TEXT,
    ts_utc TEXT,
    event_category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source_ip TEXT,
    username TEXT,
    host TEXT,
    source_file TEXT NOT NULL,
    source_line INTEGER NOT NULL,
    http_method TEXT,
    http_path TEXT,
    http_status INTEGER,
    message TEXT,
    raw_message TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (case_id, event_id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    case_id TEXT NOT NULL,
    alert_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    source_ip TEXT,
    event_count INTEGER NOT NULL,
    first_seen TEXT,
    last_seen TEXT,
    first_seen_utc TEXT,
    last_seen_utc TEXT,
    reason TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    PRIMARY KEY (case_id, alert_id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS incidents (
    case_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    source_ip TEXT,
    first_seen TEXT,
    last_seen TEXT,
    first_seen_utc TEXT,
    last_seen_utc TEXT,
    severity TEXT NOT NULL,
    alert_ids_json TEXT NOT NULL,
    event_ids_json TEXT NOT NULL,
    reasons_json TEXT NOT NULL,
    PRIMARY KEY (case_id, incident_id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parse_errors (
    case_id TEXT NOT NULL,
    error_index INTEGER NOT NULL,
    source_file TEXT NOT NULL,
    source_line INTEGER NOT NULL,
    raw_line TEXT NOT NULL,
    reason TEXT NOT NULL,
    parser TEXT NOT NULL,
    PRIMARY KEY (case_id, error_index),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_case_ts ON events(case_id, ts_utc);
CREATE INDEX IF NOT EXISTS idx_events_case_ip ON events(case_id, source_ip);
CREATE INDEX IF NOT EXISTS idx_alerts_case_ip ON alerts(case_id, source_ip);
"""

MIME_TYPES = {
    ".json": "application/json",
    ".csv": "text/csv",
    ".md": "text/markdown",
    ".zip": "application/zip",
}


def _utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class CaseStore:
    """Small SQLite repository with one connection per operation."""

    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as conn:
            conn.executescript(SCHEMA)

    @contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def save_result(
        self,
        result: AnalysisResult,
        *,
        name: str,
        source: str,
        parser: str,
        timezone_name: str,
        year: int | None,
    ) -> str:
        case_id = f"case-{uuid.uuid4().hex[:10]}"
        created_at = datetime.now(timezone.utc).isoformat()
        settings = result.settings or DetectionSettings()

        summary_json = json.dumps(result.summary.to_dict(), sort_keys=True)
        settings_json = json.dumps(asdict(settings), sort_keys=True)

        with self._db() as conn:
            conn.execute(
                """
                INSERT INTO cases
                    (id, name, source, created_at, timezone, year, parser,
                     summary_json, settings_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    case_id,
                    name,
                    source,
                    created_at,
                    timezone_name,
                    year,
                    parser,
                    summary_json,
                    settings_json,
                ),
            )
            conn.executemany(
                """
                INSERT INTO case_files
                    (case_id, file_index, name, size_bytes, sha256, encoding,
                     source_type, total_lines, parsed_lines, error_lines,
                     detection_confidence, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        case_id,
                        index,
                        item.name,
                        item.size_bytes,
                        item.sha256,
                        item.encoding,
                        item.source_type,
                        item.total_lines,
                        item.parsed_lines,
                        item.error_lines,
                        item.detection_confidence,
                        item.note,
                    )
                    for index, item in enumerate(result.files)
                ],
            )
            conn.executemany(
                """
                INSERT INTO events
                    (case_id, event_id, timestamp, ts_utc, event_category,
                     event_type, source_ip, username, host, source_file,
                     source_line, http_method, http_path, http_status, message,
                     raw_message, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        case_id,
                        event.event_id,
                        event.to_dict()["timestamp"],
                        _utc_iso(event.timestamp),
                        event.event_category,
                        event.event_type,
                        event.source_ip,
                        event.username,
                        event.host,
                        event.source_file,
                        event.source_line,
                        event.http_method,
                        event.http_path,
                        event.http_status,
                        event.message,
                        event.raw_message,
                        json.dumps(event.to_dict(), sort_keys=True),
                    )
                    for event in result.events
                ],
            )
            conn.executemany(
                """
                INSERT INTO alerts
                    (case_id, alert_id, rule_id, title, severity, status,
                     source_ip, event_count, first_seen, last_seen,
                     first_seen_utc, last_seen_utc, reason, evidence_json,
                     metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        case_id,
                        alert.alert_id,
                        alert.rule_id,
                        alert.title,
                        alert.severity,
                        alert.status,
                        alert.source_ip,
                        alert.event_count,
                        alert.to_dict()["first_seen"],
                        alert.to_dict()["last_seen"],
                        _utc_iso(alert.first_seen),
                        _utc_iso(alert.last_seen),
                        alert.reason,
                        json.dumps(alert.evidence_event_ids),
                        json.dumps(alert.metadata, sort_keys=True),
                    )
                    for alert in result.alerts
                ],
            )
            conn.executemany(
                """
                INSERT INTO incidents
                    (case_id, incident_id, source_ip, first_seen, last_seen,
                     first_seen_utc, last_seen_utc, severity, alert_ids_json,
                     event_ids_json, reasons_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        case_id,
                        incident.incident_id,
                        incident.source_ip,
                        incident.to_dict()["first_seen"],
                        incident.to_dict()["last_seen"],
                        _utc_iso(incident.first_seen),
                        _utc_iso(incident.last_seen),
                        incident.severity,
                        json.dumps(incident.alert_ids),
                        json.dumps(incident.event_ids),
                        json.dumps(incident.reasons),
                    )
                    for incident in result.incidents
                ],
            )
            conn.executemany(
                """
                INSERT INTO parse_errors
                    (case_id, error_index, source_file, source_line, raw_line,
                     reason, parser)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        case_id,
                        index,
                        error.source_file,
                        error.source_line,
                        error.raw_line,
                        error.reason,
                        error.parser,
                    )
                    for index, error in enumerate(result.parse_errors)
                ],
            )

        return case_id

    def update_alert_status(
        self, case_id: str, alert_id: str, status: str
    ) -> dict[str, Any] | None:
        if status not in REVIEW_STATUSES:
            raise ValueError(f"Unsupported review status: {status!r}")
        with self._db() as conn:
            cursor = conn.execute(
                "UPDATE alerts SET status = ? WHERE case_id = ? AND alert_id = ?",
                (status, case_id, alert_id),
            )
            if cursor.rowcount == 0:
                return None
            row = conn.execute(
                "SELECT * FROM alerts WHERE case_id = ? AND alert_id = ?",
                (case_id, alert_id),
            ).fetchone()
        return self._alert_from_row(row) if row else None

    def delete_case(self, case_id: str) -> bool:
        with self._db() as conn:
            cursor = conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list_cases(self, limit: int = 25) -> list[dict[str, Any]]:
        with self._db() as conn:
            rows = conn.execute(
                """
                SELECT id, name, source, created_at, timezone, year, parser,
                       summary_json
                FROM cases
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (max(1, min(limit, 100)),),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "source": row["source"],
                "created_at": row["created_at"],
                "timezone": row["timezone"],
                "year": row["year"],
                "parser": row["parser"],
                "summary": json.loads(row["summary_json"]),
            }
            for row in rows
        ]

    def get_case(self, case_id: str) -> dict[str, Any] | None:
        with self._db() as conn:
            case = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
            if case is None:
                return None
            files = conn.execute(
                "SELECT * FROM case_files WHERE case_id = ? ORDER BY file_index",
                (case_id,),
            ).fetchall()
            alerts = conn.execute(
                """
                SELECT * FROM alerts
                WHERE case_id = ?
                ORDER BY CASE severity
                    WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
                    first_seen_utc
                """,
                (case_id,),
            ).fetchall()
            incidents = self._incidents(conn, case_id)
            errors = conn.execute(
                "SELECT * FROM parse_errors WHERE case_id = ? ORDER BY error_index",
                (case_id,),
            ).fetchall()
        return {
            "id": case["id"],
            "name": case["name"],
            "source": case["source"],
            "created_at": case["created_at"],
            "timezone": case["timezone"],
            "year": case["year"],
            "parser": case["parser"],
            "summary": json.loads(case["summary_json"]),
            "settings": json.loads(case["settings_json"]),
            "files": [self._file_from_row(row) for row in files],
            "alerts": [self._alert_from_row(row) for row in alerts],
            "incidents": incidents,
            "parse_errors": [
                {
                    "source_file": row["source_file"],
                    "source_line": row["source_line"],
                    "raw_line": row["raw_line"],
                    "reason": row["reason"],
                    "parser": row["parser"],
                }
                for row in errors
            ],
        }

    def get_events(
        self,
        case_id: str,
        *,
        page: int = 1,
        page_size: int = 50,
        search: str = "",
        category: str = "",
        event_type: str = "",
        source_file: str = "",
        ip: str = "",
        user: str = "",
        date_from: str = "",
        date_to: str = "",
        sort: str = "desc",
    ) -> dict[str, Any]:
        page = max(1, page)
        page_size = max(1, min(page_size, 200))
        clauses = ["case_id = ?"]
        params: list[Any] = [case_id]

        if search.strip():
            term = f"%{search.strip()}%"
            clauses.append(
                "(raw_message LIKE ? OR message LIKE ? OR source_ip LIKE ? "
                "OR username LIKE ? OR event_type LIKE ? OR host LIKE ?)"
            )
            params.extend([term] * 6)
        for column, value in (
            ("event_category", category),
            ("event_type", event_type),
            ("source_file", source_file),
            ("source_ip", ip),
            ("username", user),
        ):
            if value.strip():
                clauses.append(f"{column} = ?")
                params.append(value.strip())
        if date_from.strip():
            clauses.append("ts_utc >= ?")
            params.append(date_from.strip())
        if date_to.strip():
            clauses.append("ts_utc <= ?")
            params.append(date_to.strip())

        where = " AND ".join(clauses)
        direction = "ASC" if sort.lower() == "asc" else "DESC"
        offset = (page - 1) * page_size

        with self._db() as conn:
            total = conn.execute(
                f"SELECT COUNT(*) FROM events WHERE {where}", params
            ).fetchone()[0]
            rows = conn.execute(
                f"""
                SELECT event_id, timestamp, ts_utc, event_category, event_type,
                       source_ip, username, host, http_method, http_path,
                       http_status, source_file, source_line
                FROM events
                WHERE {where}
                ORDER BY (ts_utc IS NULL), ts_utc {direction}, event_id {direction}
                LIMIT ? OFFSET ?
                """,
                [*params, page_size, offset],
            ).fetchall()

        pages = max(1, (total + page_size - 1) // page_size)
        return {
            "items": [dict(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
        }

    def get_event(self, case_id: str, event_id: str) -> dict[str, Any] | None:
        with self._db() as conn:
            row = conn.execute(
                "SELECT payload_json FROM events WHERE case_id = ? AND event_id = ?",
                (case_id, event_id),
            ).fetchone()
        return json.loads(row["payload_json"]) if row else None

    def get_facets(self, case_id: str) -> dict[str, list[str]]:
        with self._db() as conn:
            def distinct(column: str) -> list[str]:
                rows = conn.execute(
                    f"SELECT DISTINCT {column} FROM events "
                    f"WHERE case_id = ? AND {column} IS NOT NULL AND {column} != '' "
                    f"ORDER BY {column}",
                    (case_id,),
                ).fetchall()
                return [row[0] for row in rows]

            return {
                "categories": distinct("event_category"),
                "event_types": distinct("event_type"),
                "source_files": distinct("source_file"),
                "usernames": distinct("username"),
                "source_ips": distinct("source_ip"),
            }

    def get_timeline(self, case_id: str, buckets: int = 72) -> dict[str, Any]:
        with self._db() as conn:
            rows = conn.execute(
                """
                SELECT event_id, ts_utc, event_category
                FROM events
                WHERE case_id = ? AND ts_utc IS NOT NULL
                ORDER BY ts_utc
                """,
                (case_id,),
            ).fetchall()
            evidence_rows = conn.execute(
                "SELECT evidence_json FROM alerts WHERE case_id = ?", (case_id,)
            ).fetchall()
            incidents = self._incidents(conn, case_id)

            evidence_ids: set[str] = set()
            for row in evidence_rows:
                evidence_ids.update(json.loads(row["evidence_json"]))

            if not rows:
                return {
                    "buckets": [],
                    "evidence_events": [],
                    "incidents": incidents,
                    "first": None,
                    "last": None,
                }

            points = [
                (_parse_dt(row["ts_utc"]), row["event_id"], row["event_category"])
                for row in rows
            ]
            points = [point for point in points if point[0] is not None]
            if not points:
                return {
                    "buckets": [],
                    "evidence_events": [],
                    "incidents": incidents,
                    "first": None,
                    "last": None,
                }

            start = min(point[0] for point in points)
            end = max(point[0] for point in points)
            span = (end - start).total_seconds()
            count = max(8, min(buckets, 120)) if span > 0 else 1
            width = span / count if count > 1 else 1

            buckets_out: list[dict[str, Any]] = []
            for index in range(count):
                bucket_start = start
                if count > 1:
                    from datetime import timedelta

                    bucket_start = start + timedelta(seconds=width * index)
                buckets_out.append(
                    {
                        "start": bucket_start.isoformat(),
                        "authentication": 0,
                        "web": 0,
                        "system": 0,
                        "unknown": 0,
                        "alert_evidence": 0,
                        "total": 0,
                    }
                )

            for ts, event_id, category in points:
                index = 0 if count == 1 else min(
                    count - 1, int((ts - start).total_seconds() / width)
                )
                bucket = buckets_out[index]
                key = category if category in bucket else "unknown"
                bucket[key] += 1
                bucket["total"] += 1
                if event_id in evidence_ids:
                    bucket["alert_evidence"] += 1

            evidence_events: list[dict[str, Any]] = []
            if evidence_ids:
                placeholders = ",".join("?" for _ in evidence_ids)
                evidence_events = [
                    dict(row)
                    for row in conn.execute(
                        f"""
                        SELECT event_id, timestamp, event_category, event_type,
                               source_ip, username, http_path, http_status,
                               source_file, source_line
                        FROM events
                        WHERE case_id = ? AND event_id IN ({placeholders})
                        ORDER BY ts_utc
                        LIMIT 300
                        """,
                        [case_id, *sorted(evidence_ids)],
                    ).fetchall()
                ]

        return {
            "buckets": buckets_out,
            "evidence_events": evidence_events,
            "incidents": incidents,
            "first": start.isoformat(),
            "last": end.isoformat(),
        }

    def get_ip_analysis(self, case_id: str) -> list[dict[str, Any]]:
        with self._db() as conn:
            rows = conn.execute(
                """
                SELECT COALESCE(source_ip, 'unknown') AS source_ip,
                       COUNT(*) AS total_events,
                       SUM(CASE WHEN event_type = 'authentication_failure'
                                THEN 1 ELSE 0 END) AS auth_failures,
                       SUM(CASE WHEN event_type = 'authentication_success'
                                THEN 1 ELSE 0 END) AS auth_successes,
                       SUM(CASE WHEN event_category = 'web' OR http_status IS NOT NULL
                                THEN 1 ELSE 0 END) AS http_requests,
                       SUM(CASE WHEN http_status BETWEEN 400 AND 499
                                THEN 1 ELSE 0 END) AS http_4xx,
                       SUM(CASE WHEN http_status BETWEEN 500 AND 599
                                THEN 1 ELSE 0 END) AS http_5xx
                FROM events
                WHERE case_id = ?
                GROUP BY COALESCE(source_ip, 'unknown')
                """,
                (case_id,),
            ).fetchall()
            alert_rows = conn.execute(
                """
                SELECT COALESCE(source_ip, 'unknown') AS source_ip,
                       alert_id, severity
                FROM alerts
                WHERE case_id = ?
                """,
                (case_id,),
            ).fetchall()

        alerts_by_ip: dict[str, list[dict[str, Any]]] = {}
        for row in alert_rows:
            alerts_by_ip.setdefault(row["source_ip"], []).append(dict(row))

        output: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            ip_alerts = alerts_by_ip.get(item["source_ip"], [])
            severities = {alert["severity"] for alert in ip_alerts}
            item["alert_count"] = len(ip_alerts)
            item["alert_ids"] = sorted(alert["alert_id"] for alert in ip_alerts)
            item["max_severity"] = next(
                (severity for severity in SEVERITY_ORDER if severity in severities),
                "info",
            )
            output.append(item)

        return sorted(
            output,
            key=lambda item: (-item["total_events"], item["source_ip"]),
        )

    def list_exports(self, case_id: str) -> list[dict[str, Any]]:
        result = self.load_result(case_id)
        if result is None:
            return []
        artifacts = export_all(result)
        return [
            {
                "name": name,
                "size_bytes": len(content),
                "mime": MIME_TYPES.get(Path(name).suffix, "application/octet-stream"),
            }
            for name, content in sorted(artifacts.items())
        ]

    def get_export(self, case_id: str, name: str) -> tuple[bytes, str, str] | None:
        result = self.load_result(case_id)
        if result is None:
            return None
        if name == "logforensics-export.zip":
            return export_zip(result), "application/zip", name
        artifacts = export_all(result)
        if name not in artifacts:
            return None
        return (
            artifacts[name],
            MIME_TYPES.get(Path(name).suffix, "application/octet-stream"),
            name,
        )

    def load_result(self, case_id: str) -> AnalysisResult | None:
        with self._db() as conn:
            case = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
            if case is None:
                return None
            event_rows = conn.execute(
                "SELECT payload_json FROM events WHERE case_id = ? ORDER BY event_id",
                (case_id,),
            ).fetchall()
            alert_rows = conn.execute(
                "SELECT * FROM alerts WHERE case_id = ? ORDER BY alert_id",
                (case_id,),
            ).fetchall()
            incident_rows = conn.execute(
                "SELECT * FROM incidents WHERE case_id = ? ORDER BY incident_id",
                (case_id,),
            ).fetchall()
            error_rows = conn.execute(
                "SELECT * FROM parse_errors WHERE case_id = ? ORDER BY error_index",
                (case_id,),
            ).fetchall()
            file_rows = conn.execute(
                "SELECT * FROM case_files WHERE case_id = ? ORDER BY file_index",
                (case_id,),
            ).fetchall()

        events: list[Event] = []
        for row in event_rows:
            payload = json.loads(row["payload_json"])
            payload["timestamp"] = _parse_dt(payload.get("timestamp"))
            events.append(Event(**payload))

        summary_payload = json.loads(case["summary_json"])
        summary_payload["first_event"] = _parse_dt(summary_payload.get("first_event"))
        summary_payload["last_event"] = _parse_dt(summary_payload.get("last_event"))
        summary = AnalysisSummary(**summary_payload)

        settings_payload = json.loads(case["settings_json"] or "{}")
        if settings_payload:
            settings_payload["sensitive_paths"] = tuple(
                settings_payload.get("sensitive_paths", ())
            )
            settings_payload["enabled_rules"] = tuple(
                settings_payload.get("enabled_rules", ())
            )
        settings = DetectionSettings(**settings_payload) if settings_payload else None

        return AnalysisResult(
            events=events,
            parse_errors=[
                ParseError(
                    source_file=row["source_file"],
                    source_line=row["source_line"],
                    raw_line=row["raw_line"],
                    reason=row["reason"],
                    parser=row["parser"],
                )
                for row in error_rows
            ],
            alerts=[self._alert_from_row(row) for row in alert_rows],
            incidents=[
                Incident(
                    incident_id=row["incident_id"],
                    source_ip=row["source_ip"],
                    first_seen=_parse_dt(row["first_seen"]),
                    last_seen=_parse_dt(row["last_seen"]),
                    alert_ids=json.loads(row["alert_ids_json"]),
                    event_ids=json.loads(row["event_ids_json"]),
                    reasons=json.loads(row["reasons_json"]),
                    severity=row["severity"],
                )
                for row in incident_rows
            ],
            files=[self._file_from_row(row) for row in file_rows],
            summary=summary,
            settings=settings,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _incidents(
        self, conn: sqlite3.Connection, case_id: str
    ) -> list[dict[str, Any]]:
        rows = conn.execute(
            "SELECT * FROM incidents WHERE case_id = ? ORDER BY first_seen_utc",
            (case_id,),
        ).fetchall()
        return [
            {
                "incident_id": row["incident_id"],
                "source_ip": row["source_ip"],
                "first_seen": row["first_seen"],
                "last_seen": row["last_seen"],
                "alert_ids": json.loads(row["alert_ids_json"]),
                "event_ids": json.loads(row["event_ids_json"]),
                "reasons": json.loads(row["reasons_json"]),
                "severity": row["severity"],
            }
            for row in rows
        ]

    @staticmethod
    def _alert_from_row(row: sqlite3.Row) -> Alert:
        return Alert(
            alert_id=row["alert_id"],
            rule_id=row["rule_id"],
            title=row["title"],
            severity=row["severity"],
            status=row["status"],
            source_ip=row["source_ip"],
            event_count=row["event_count"],
            first_seen=_parse_dt(row["first_seen"]),
            last_seen=_parse_dt(row["last_seen"]),
            reason=row["reason"],
            evidence_event_ids=json.loads(row["evidence_json"]),
            metadata=json.loads(row["metadata_json"]),
        )

    @staticmethod
    def _file_from_row(row: sqlite3.Row) -> FileSummary:
        return FileSummary(
            name=row["name"],
            size_bytes=row["size_bytes"],
            sha256=row["sha256"],
            encoding=row["encoding"],
            source_type=row["source_type"],
            total_lines=row["total_lines"],
            parsed_lines=row["parsed_lines"],
            error_lines=row["error_lines"],
            detection_confidence=row["detection_confidence"],
            note=row["note"],
        )
