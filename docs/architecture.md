# Architecture

## Goals

1. Keep parsing, normalization, detection, correlation, storage and presentation
   separate.
2. Never lose the original log line or its source location.
3. Make detection output explainable: rule, reason and evidence.
4. Run fully locally with no cloud service, API key or telemetry.
5. Keep the analysis core usable from Python without the web interface.

## Stack

| Layer | Module | Responsibility |
| --- | --- | --- |
| Interface | `web/src` (React 19 + TypeScript + Vite) | Landing page, sign-in gate, workspace pages, drawers, command palette and themes. |
| API | `api/main.py` (FastAPI) | Auth, case lifecycle, event queries, facets, timeline, IPs, review status, exports and SPA serving. |
| Storage | `api/store.py` (SQLite, WAL) | Persist cases, source files, events, alerts, incidents, settings and review status. |
| Ingestion | `ingestion/file_loader.py` | Validate extension, size, binary content and encoding; compute SHA-256. |
| Detection of format | `ingestion/format_detector.py` | Score a line sample against supported formats; report confidence. |
| Parsing | `parsers/linux_auth.py`, `parsers/web_access.py` | Turn one line into a `ParsedRecord`. Raise `ParseLineError` on mismatch. |
| Parse runner | `parsers/__init__.py` | Iterate lines, collect records and `ParseError`s, preserve line numbers. |
| Normalization | `normalization/normalizer.py` | Map parser output to the common `Event` schema. |
| Detection | `detection/engine.py`, `detection/rules.py` | Apply configurable rules; build `Alert`s with evidence IDs and reasons. |
| Correlation | `correlation/correlator.py` | Group alerts sharing a source IP within 30 minutes; record why. |
| Analysis | `analysis/timeline.py`, `analysis/pipeline.py` | Timeline, IP aggregation and end-to-end orchestration. |
| Reporting | `reporting/exporter.py` | JSON, CSV, Markdown and ZIP output; file manifest. |

## Data flow

```text
browser upload / sample files
      → load_bytes / load_path → text, SHA-256, encoding
      → detect_format (optional)
      → parse_text → ParsedRecord[] + ParseError[]
      → normalize  → Event[] with evt-000001 … IDs
      → run_detection → Alert[] with alert-0001 … IDs
      → build_incidents → Incident[]
      → CaseStore.save_case → SQLite (WAL)
      → API queries → React workspace
      → export_all / export_zip → downloads
```

The case is persisted before the response returns, so the workspace can be
reloaded, the case switched or the server restarted without re-parsing the logs.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | Signed-cookie session. |
| `GET /api/health` | Public health check. |
| `GET /api/cases` · `GET /api/cases/{id}` · `DELETE /api/cases/{id}` | Case list, detail and deletion. |
| `POST /api/cases/sample` · `POST /api/cases` | Create a case from the bundled dataset or uploaded files (multipart). |
| `GET /api/cases/{id}/events` | Paginated, sorted, text-searched and faceted event query. |
| `GET /api/cases/{id}/events/{event_id}` | Full event with raw line and provenance. |
| `GET /api/cases/{id}/facets` | Categories, event types, files, IPs and usernames for filters. |
| `GET /api/cases/{id}/timeline` | Bucketed activity, evidence markers and incidents. |
| `GET /api/cases/{id}/ips` | Per-source aggregation with linked alerts. |
| `PATCH /api/cases/{id}/alerts/{alert_id}` | Persist a review status. |
| `GET /api/cases/{id}/exports` · `.../exports/{name}` | Artifact list and downloads, including the ZIP bundle. |

`/api/docs` serves the OpenAPI schema; the React app is served from `web/dist`
with a catch-all route for client-side navigation.

## Storage decisions

SQLite is deliberate, not a shortcut:

- **Local-first:** one file (`data/logforensics.db`) contains the case record and
  can be copied or deleted with the investigation.
- **Operational cost:** no database server, account or port to manage. The app is
  a single local process.
- **Features the UI needs:** indexed filters, ordering, pagination, aggregation and
  per-alert updates without loading the full case into memory.
- **Durability:** WAL mode keeps reads responsive while a write completes, and
  review statuses survive a reload.

PostgreSQL would add a service to install and secure without improving a
single-analyst local workflow. The store is isolated behind `CaseStore`; a future
multi-user deployment could replace it without touching parsers or rules.

## Event schema decisions

- `raw_message` is the **complete original line**, not only the extracted
  message. The message portion is also stored in `message`.
- `source_file` and `source_line` are mandatory, 1-based and never rewritten.
- `timestamp` is timezone-aware when parsed. If the source had no offset, the
  analysis timezone is applied and `timestamp_timezone_known` is `False` with a
  human-readable `timestamp_assumption`.
- `event_id` is deterministic for a given file order: `evt-000001`, etc.
- `parse_status` is `"success"` for normalized events. Parse failures live in a
  separate `parse_errors` collection and remain visible in the UI.

## Detection design

- Rules operate only on normalized events.
- Every rule filters by relevant event types and skips events without the required
  key (for example, no source IP).
- Sliding windows are inclusive of the window boundary. After a burst alert, the
  window resets so that another full threshold is required.
- Alert IDs are assigned after sorting by first-seen time and rule ID, making
  output deterministic for a fixed input and configuration.
- `DetectionSettings` is a plain dataclass. The new-analysis form maps directly to
  it; thresholds and rule toggles are stored on the case.

## Correlation

Correlation is deliberately simple and transparent:

- group alerts by `source_ip`;
- split a group when the gap between the previous alert's `last_seen` and the next
  alert's `first_seen` exceeds 30 minutes;
- merge unique evidence event IDs;
- record reasons (`Alerts share source IP …`, time proximity).

No claim is made that grouped events form a single attack.

## UI state

- Auth is a signed session cookie; the React auth context calls `/api/auth/me` on
  load and redirects unauthenticated workspace routes to `/login`.
- Cases and the active case are loaded from the API. The selected case ID is kept
  in the browser so reloads return to the same investigation.
- Alert review statuses are persisted with `PATCH` and mirrored in case state.
- Theme preference and the active case are stored in `localStorage`; no log content
  is stored in the browser.
- The command palette (`Ctrl/Cmd+K`) navigates pages, switches cases and runs
  actions without scattering controls across the page.

## Extension points

| Need | Where to change |
| --- | --- |
| New log format | Add a `BaseParser` subclass, register it in `PARSERS`, add detection scoring and a UI label. |
| New rule | Add metadata in `detection/rules.py`, implement a function in `engine.py`, register it in `run_detection`. |
| YAML rules | Load YAML into `DetectionSettings`/rule objects; keep the engine pure. |
| Alternate storage | Implement the `CaseStore` interface; the API and core stay unchanged. |
| Redaction | Add a transformation stage between normalization and export; keep raw evidence available locally. |
