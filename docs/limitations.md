# Limitations

LogForensics v0.1.0 is a focused, local-first log investigation aid. The following
limits are intentional.

## Scope

- Only Linux authentication logs (`auth.log` / `secure`) and Apache/Nginx access
  logs (Common/Combined) are supported.
- Windows Security Event Logs, JSON structured logs, cloud audit logs, kernel logs
  and application frameworks are not parsed.
- No live endpoint monitoring, agents, automatic containment or IP blocking.
- No geolocation. Reserved, private and synthetic addresses make geolocation
  misleading.
- No machine learning. Detection is rule-based so that each alert can be explained.
- No SIEM replacement, threat-actor attribution or legal forensic claims.

## Timestamps

- Classic syslog lines have neither year nor timezone. The app applies the
  year/timezone selected by the analyst and records the assumption on each event.
- Year rollover (for example a December log analyzed in January) is not inferred;
  the selected year is used directly.
- Sub-second precision is preserved for RFC 3339-style timestamps, but most syslog
  and web timestamps are second-precision.
- Mixed timezones are supported because timestamps are timezone-aware, but date
  filters in the UI operate on the selected analysis timezone.

## Detection quality

- Thresholds are lab defaults. They are not tuned for a specific environment.
- Rule-based detection produces false positives and false negatives.
- A burst from a shared NAT or a CI/CD system can look like an attack.
- A single `.env` request can be a benign link check or a scanner; the rule flags
  it for review, not as exploitation.
- Correlation is intentionally shallow: source IP plus a 30-minute gap. It does not
  model identity, asset criticality or attack graphs.
- The sample dataset is synthetic and small. No production precision/recall is
  claimed.

## Scale and storage

- 10 MiB per file, 200,000 lines per file.
- SQLite is single-writer and intended for one local analyst. It is not a
  multi-user case server.
- The whole case is held in SQLite for querying. Very large files require a future
  streaming/chunked parser and a different storage layout.
- Deleting a case removes its rows from the local database; there is no soft-delete
  recycle bin or audit trail of deletions.
- The database is local state, not evidence. Use exports and the manifest for handoff.

## Evidence integrity

- SHA-256 hashes of input files are included in the manifest.
- Hashes only detect changes between copies. They do not prove who collected the
  evidence, when it was collected, or that it was unchanged before hashing.
- No chain-of-custody controls, signatures or immutable storage are provided.
- The app reads files through the upload control; it does not enforce an
  evidence-handling procedure.

## Security

- The app is intended for local use. If exposed to a network it needs production
  authentication, TLS, access control and a deployment review. A local app is not
  automatically safe.
- The built-in sign-in gate is a local demo check (`analyst` / `logforensics` by
  default, overridable by `LOGFORENSICS_USERNAME` and `LOGFORENSICS_PASSWORD`). It
  has no user store, password hashing, session expiry, rate limiting or per-user
  authorization. It is not production authentication.
- The session cookie is signed with `LOGFORENSICS_SECRET`. If the variable is not
  set, a random secret is generated per process, so sessions end on restart.
- Uploaded content is treated as untrusted text. It is never executed, but raw log
  lines are rendered in the UI and exports.
- Redaction is not implemented. Exports can contain usernames, internal IPs, tokens
  and personal data.
- CSV exports preserve raw values for evidence integrity. Spreadsheet applications
  may interpret cells beginning with `=`, `+`, `-` or `@` as formulas. Do not open
  untrusted exports in an application that evaluates them.
- Markdown summary cells are HTML-escaped, but exported raw logs remain raw.
- No external services receive log data.

## UI and deployment

- The interface is English-language with light and dark themes.
- A local sign-in gate protects the workspace, but there is no multi-user account
  system, case sharing or audit log of analyst actions.
- The UI is desktop-first; mobile layouts remain usable and checked for horizontal
  overflow, but dense tables require horizontal scrolling.
- No Docker packaging, scheduled analysis or remote API access is provided.
- The production frontend must be built (`npm run build`). Running `python app.py`
  without `web/dist` shows a build reminder instead of the app.

## What would change the quality bar

1. A labelled corpus with documented provenance and licensing.
2. Rule-level evaluation (TP/FP/TN/FN) with a defined unit of analysis.
3. Streaming ingestion for multi-gigabyte files.
4. Redaction and an export review workflow.
5. Windows/JSON/Sigma sources and a rule-testing framework.
6. A real identity and authorization model before any shared deployment.

Until then, treat the output as a reproducible starting point for human review.
