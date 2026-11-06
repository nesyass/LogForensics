# Detection Rules

Severity is a **triage priority**, not a statement that an attack occurred.
All thresholds below are lab defaults and are configurable in the sidebar or
through `DetectionSettings`.

## LF-001 — Failed Login Burst

- **Input:** `linux_auth` events with `event_type = authentication_failure`.
- **Group key:** `source_ip`.
- **Default window:** 120 seconds.
- **Default threshold:** 10 failures.
- **Severity:** medium.
- **Logic:** sort failures per IP, maintain a sliding window, and emit an alert
  when the count reaches the threshold. The window resets after an alert; a new
  alert needs another full threshold.
- **Reason example:** `12 failed authentication events from the same IP within
  120 seconds (6 distinct username(s)).`
- **Evidence:** all events in the triggering window.
- **Not proof of:** successful brute force or account compromise.

## LF-002 — Successful Login After Repeated Failures

- **Input:** failure and success events from the same `source_ip`.
- **Default precondition:** at least 5 failures.
- **Default window:** 600 seconds before the success.
- **Severity:** high.
- **Logic:** for each success, count failures from the same IP in the preceding
  window using binary search over sorted failure timestamps. At most one alert
  per IP per window.
- **Evidence:** prior failures plus the success.
- **False-positive sources:** mistyped password followed by a legitimate login,
  shared NAT addresses, credential rotation.
- **Next steps:** verify with the account owner, session logs and later
  privileged activity. Do not conclude compromise from this pattern alone.

## LF-003 — Multi-User Login Attempts

- **Input:** failed authentications with a username.
- **Group key:** `source_ip`.
- **Default threshold:** 5 distinct usernames.
- **Default window:** 300 seconds.
- **Severity:** medium.
- **Logic:** sliding window of failures; alert when the distinct username count
  reaches the threshold. The window resets after an alert.
- **Interpretation:** password spraying or account enumeration is possible;
  shared infrastructure or misconfiguration are alternatives.
- **Metadata:** sorted list of distinct usernames.

## LF-004 — HTTP Error Spike

- **Input:** web events with `http_status >= 400`.
- **Group key:** `source_ip`.
- **Default threshold:** 10 errors.
- **Default window:** 60 seconds.
- **Severity:** medium.
- **Logic:** sliding window over all 4xx and 5xx responses; alert includes
  separate 4xx and 5xx counts.
- **Possible causes:** broken links, application faults, scanning, outages or
  client mistakes. Interpret with the request paths, user agents and status
  distribution.

## LF-005 — Sensitive Path Request

- **Input:** web events with `http_path`.
- **Default paths:** `.env`, `admin`, `wp-admin`, `phpmyadmin`, `backup`,
  `config`. The list is configurable.
- **Severity:** medium (configurable).
- **Normalization:** percent-decode with `urllib.parse.unquote`, lowercase,
  collapse repeated slashes, remove query string and fragment. Matching is done
  on path segments, so `/ADMIN/users` and `/%2Eenv` match, while
  `/configuration` does not match `config`.
- **Grouping:** one alert per `(source_ip, matched_path)` with all matching
  events as evidence.
- **Reason example:** `2 request(s) to sensitive path '.env' were observed.
  Review the request and response status; the request alone is not evidence of
  exploitation.`
- **Metadata:** normalized paths and observed HTTP statuses.
- **Caution:** a 404 to `/.env` is still worth reviewing, but it may simply be a
  scanner or a benign link. A 200 would warrant deeper inspection.

## Rule metadata

`detection/rules.py` stores the ID, name, description, severity, source type
and logic summary. The UI displays this metadata next to the concrete alert
reason. The reason always contains the observed counts and the configured
window.

## Adding a rule

1. Add a `RuleMetadata` entry in `detection/rules.py`.
2. Implement a function in `detection/engine.py` that returns `Alert` objects.
3. Call it from `run_detection()` behind `settings.is_enabled(rule_id)`.
4. Add focused tests for threshold, window boundary and empty/missing fields.
5. Update this document and the README table.
