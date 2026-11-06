# Sample data (synthetic)

All files in this directory are **synthetic**. They were written for this
project and do not contain real user, host, token or organization data.

- `auth_normal.log` — ordinary Linux authentication activity. It contains a
  small number of failures that are below the configured thresholds.
- `auth_suspicious.log` — repeated failures from one documentation IP, several
  targeted usernames, and a successful login after the failures.
- `web_access.log` — normal web traffic plus a short burst of 4xx/5xx responses
  and requests to sensitive paths.
- `expected_results.json` — expected rule outcomes used by the automated tests.

IP addresses come from documentation ranges reserved by RFC 5737:
`192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24`.

The authentication files use classic syslog timestamps, which have no year and
no timezone. The default analysis assumption is year `2026` and timezone
`Asia/Jakarta`; both values are visible in the UI and in the export.
