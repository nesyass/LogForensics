# Data Schema

## Normalized event

```json
{
  "event_id": "evt-000001",
  "timestamp": "2026-11-05T09:00:12+07:00",
  "timestamp_precision": "second",
  "timestamp_timezone_known": false,
  "timestamp_assumption": "No year or timezone in syslog timestamp; 2026 and Asia/Jakarta assumed from analysis settings.",
  "source_file": "auth_suspicious.log",
  "source_line": 5,
  "source_type": "linux_auth",
  "host": "lab-server",
  "event_category": "authentication",
  "event_type": "authentication_failure",
  "username": "admin",
  "source_ip": "203.0.113.50",
  "source_port": 51234,
  "destination_ip": null,
  "http_method": null,
  "http_path": null,
  "http_status": null,
  "process": "sshd",
  "user_agent": null,
  "pid": 1210,
  "message": "Failed password for invalid user admin from 203.0.113.50 port 51234 ssh2",
  "raw_message": "Nov  5 09:00:12 lab-server sshd[1210]: Failed password for invalid user admin from 203.0.113.50 port 51234 ssh2",
  "parse_status": "success"
}
```

### Important fields

| Field | Type | Notes |
| --- | --- | --- |
| `event_id` | string | Unique within one analysis; deterministic by file/line order. |
| `timestamp` | ISO 8601 string | Always timezone-aware when parsed. |
| `timestamp_timezone_known` | boolean | `false` when the analysis timezone was assumed. |
| `timestamp_assumption` | string/null | Human-readable explanation of any assumption. |
| `source_file` | string | Original file name. |
| `source_line` | integer | 1-based original line number. |
| `source_type` | string | `linux_auth` or `web_access`. |
| `raw_message` | string | Complete original line, unmodified. |
| `message` | string | Extracted message or request summary. |
| `event_type` | string | Normalized type (see below). |
| `parse_status` | string | `success` for normalized events. |

`raw_message` intentionally holds the whole line. The spec example shows only
the message portion, but preserving the full line is stronger for evidence
traceability.

### Event types

| Source | Event type | Category |
| --- | --- | --- |
| Linux auth | `authentication_failure` | authentication |
| Linux auth | `authentication_success` | authentication |
| Linux auth | `session_opened` | authentication |
| Linux auth | `authentication_connection_closed` | authentication |
| Linux auth | `privileged_command` (sudo) | system |
| Linux auth | `auth_log_entry` (parsed but unclassified) | authentication |
| Web | `http_request` | web |

## Parse error

```json
{
  "source_file": "broken.log",
  "source_line": 2,
  "raw_line": "this line does not match any parser",
  "reason": "Line does not match a supported syslog or RFC 3339 prefix.",
  "parser": "linux_auth"
}
```

Blank lines are skipped and are not errors. A line that does not match the
selected parser becomes a parse error and does not abort the run.

## Alert

```json
{
  "alert_id": "alert-0001",
  "rule_id": "LF-001",
  "title": "Failed Login Burst",
  "severity": "medium",
  "status": "needs_review",
  "source_ip": "203.0.113.50",
  "event_count": 10,
  "first_seen": "2026-11-05T09:00:12+07:00",
  "last_seen": "2026-11-05T09:01:10+07:00",
  "reason": "10 failed authentication events from the same IP within 120 seconds (6 distinct username(s)).",
  "evidence_event_ids": ["evt-000019", "evt-000020"],
  "metadata": {
    "window_seconds": 120,
    "threshold": 10,
    "distinct_usernames": ["admin", "oracle", "postgres", "root", "test", "ubuntu"]
  }
}
```

The `evidence_event_ids` list is shortened above for readability. Real alerts
contain every event in the triggering window.

Review statuses: `needs_review`, `benign`, `confirmed_suspicious`,
`false_positive`. These are analyst decisions, not automated classifications.

## Incident

Incidents group alerts by source IP when consecutive alerts are within 30
minutes. They contain alert IDs, unique evidence event IDs, first/last seen and
explicit grouping reasons.

## File summary and manifest

Each imported file records:

- name, size, encoding;
- SHA-256 of the original bytes;
- source type and detection confidence;
- total lines, parsed lines, error lines;
- an optional note (for example failed auto-detection or low confidence).

The manifest is exported as `file_manifest.json`. Hashes detect changes between
copies; they do not prove collection integrity or chain of custody.

## Export artifacts

| File | Content |
| --- | --- |
| `events.json` | Metadata, summary and all normalized events. |
| `events.csv` | Flat event table. |
| `alerts.json` | Metadata, summary and all alerts with evidence IDs. |
| `alerts.csv` | Flat alert table, statuses included. |
| `timeline.csv` | Chronological events with alert-evidence flags. |
| `investigation-summary.md` | Human-readable report with limits and file hashes. |
| `file_manifest.json` | Input file hashes and parse counts. |
