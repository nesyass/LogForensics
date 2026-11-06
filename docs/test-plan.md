# Test Plan

## Running the suite

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Expected result for v0.1.0: **54 passed**.

Tests live in `tests/` and import the package through `pytest`'s `pythonpath`
setting (`pyproject.toml`) plus a `conftest.py` fallback.

Frontend checks use the built app on `http://127.0.0.1:8000`:

```powershell
cd web
npm run build
npm run lint
node scripts/ui-check.mjs
node scripts/screenshots.mjs
```

## Coverage

### Parser tests

`tests/test_linux_auth_parser.py`

- Failed password for an invalid user extracts username, IP and port.
- Accepted password produces `authentication_success`.
- Syslog timestamp applies the configured year/timezone and marks the assumption
  explicitly.
- RFC 3339 timestamp preserves its offset and marks timezone as known.
- Sudo lines become `privileged_command`.
- Non-syslog lines raise `ParseLineError`.
- Parse runner keeps failures with file, line, raw line and reason.

`tests/test_web_access_parser.py`

- Combined Log Format extracts all fields.
- Common Log Format without referer/user-agent is accepted.
- Missing offset triggers an explicit timezone assumption.
- Query strings are preserved in `http_path`.
- Empty request field (`"-"`) is parseable.
- Malformed lines are reported as parse errors.

### Normalization tests

`tests/test_normalization.py`

- Field mapping and raw-line preservation.
- Format detection for both formats and unknown input.
- Unique event IDs across a multi-line file.
- Parse errors remain available.
- File loader rejects unsupported extensions and binary/NUL content.

### Detection tests

`tests/test_detection.py`

- LF-001 fires exactly at the configured threshold.
- Normal activity below the threshold does not alert.
- Events outside the sliding window are not counted.
- Events without a source IP do not crash the engine.
- LF-002 requires the configured number of prior failures and produces High
  severity.
- LF-002 does not fire for a small number of failures.
- LF-003 counts distinct usernames.
- LF-004 reports 4xx and 5xx counts separately.
- LF-005 matches percent-encoded and mixed-case paths, normalizes slashes and does
  not match unrelated paths.
- Disabled rules are skipped.

### Timeline and correlation tests

`tests/test_timeline.py`

- Timeline is sorted by timestamp.
- Events used as alert evidence are flagged with their alert IDs.
- IP aggregation counts failures, successes, HTTP requests, 4xx and 5xx.
- Incidents group alerts by IP and 30-minute proximity.
- Alerts without a source IP are not force-correlated.

### Sample dataset tests

`tests/test_sample_dataset.py`

- The bundled data produces exactly the alerts in
  `sample_data/expected_results.json`.
- Auto-detection identifies all three files.
- `auth_normal.log` alone produces no alerts.
- Every evidence event ID resolves to a parsed event with source file, line and
  raw message.
- Re-running detection uses existing events and respects new thresholds.
- All export artifacts exist and contain the same counts as the result.
- CSV row counts match event counts.
- ZIP export contains the expected files.

### API tests

`tests/test_api.py`

- Health is public; case and event routes require a signed-in session.
- Bad credentials are rejected; the demo account signs in and out.
- The sample case stores 51 events, 13 alerts, 3 files and 3 incidents.
- Event pagination, sorting, search and IP filters return consistent totals.
- Event detail includes the raw message, source file and line.
- Facets, timeline buckets and IP aggregation are correct.
- Alert review status round-trips and invalid statuses are rejected.
- All seven export artifacts download with the expected size and MIME type; the
  ZIP contains exactly those names.
- Upload creates a case and rejects unsupported files.
- Deleting a case removes its events, exports and related rows.

### Frontend checks

`web/scripts/ui-check.mjs` runs in headless Microsoft Edge with
`playwright-core`:

- Landing page content, rule cards and typography.
- Demo sign-in, protected-route redirect and 401 handling.
- KPI values, activity chart, incidents and source hashes.
- Light/dark theme toggle and command palette navigation.
- Event search, pagination and evidence drawer.
- Detection rationale, evidence list and status round-trip.
- Timeline, sources, IP aggregation and filtered event drill-down.
- Seven exports and the ZIP download link.
- New-analysis modal and the branded 404 page.
- No horizontal overflow at 1440 px or 390 px; sticky rail on mobile.

## Manual acceptance checklist

| Criterion | How to verify |
| --- | --- |
| Landing and sign-in | Open the app signed out; confirm the landing page, reject a wrong password, then sign in with the demo credentials. |
| Light and dark themes | Toggle the theme from the top bar; confirm panels, badges, charts and tables stay readable. |
| Upload supported files | Load the sample dataset and upload a file with the same formats. |
| Normalized events | Overview shows parsed events; Event explorer lists them with filters. |
| Parse failures reported | Upload a file with one malformed line; Sources shows the parse error and raw line. |
| Five detection rules | Sample data yields LF-001 through LF-005. |
| Timeline | Timeline shows oldest-first events, timezone and correlated incidents. |
| Alert reason and evidence | Open a detection and inspect the linked evidence events. |
| Review status persists | Set a status, reload the page and confirm it is unchanged. |
| Export | Download `events.json`, `events.csv` and the ZIP; verify counts. |
| Database persists | Restart `python app.py`; the case is still listed. |
| Case deletion | Delete a case and confirm it disappears from the switcher and API. |
| Automated tests | `pytest` exits with code 0; `node scripts/ui-check.mjs` passes. |
| Synthetic data | `sample_data/README.md` documents it and uses RFC 5737 IPs. |

## Evaluation caveat

The dataset is small and synthetic. It is suitable for regression testing and a
portfolio demo, not for estimating production precision or recall. Any future
metric must first define whether a unit of evaluation is an event, an alert or a
scenario, and must not mix those units in one confusion matrix.
