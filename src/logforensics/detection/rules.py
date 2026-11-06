"""Rule metadata kept separate from engine mechanics.

Each rule has an ID, a human-readable explanation, an initial severity and the
data it applies to. Alert reasons add the concrete counts and time windows.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RuleMetadata:
    id: str
    name: str
    description: str
    severity: str
    source_type: str
    logic: str


RULES: dict[str, RuleMetadata] = {
    "LF-001": RuleMetadata(
        id="LF-001",
        name="Failed Login Burst",
        description=(
            "Multiple failed authentication events from one source IP within a "
            "short time window."
        ),
        severity="medium",
        source_type="linux_auth",
        logic=(
            "Group authentication_failure events by source_ip, apply a sliding "
            "window, and alert when the count reaches the configured threshold."
        ),
    ),
    "LF-002": RuleMetadata(
        id="LF-002",
        name="Successful Login After Repeated Failures",
        description=(
            "A successful authentication from an IP that already produced "
            "multiple failures. This pattern requires verification; it can also "
            "be caused by a user mistyping a password."
        ),
        severity="high",
        source_type="linux_auth",
        logic=(
            "For each successful authentication, count failures from the same "
            "IP in the preceding window and alert when the threshold is met."
        ),
    ),
    "LF-003": RuleMetadata(
        id="LF-003",
        name="Multi-User Login Attempts",
        description=(
            "One source IP targets many distinct usernames, consistent with "
            "password spraying or account enumeration. The pattern is not proof "
            "of compromise."
        ),
        severity="medium",
        source_type="linux_auth",
        logic=(
            "Group failed authentications by source_ip and alert when the number "
            "of distinct usernames in the window reaches the threshold."
        ),
    ),
    "LF-004": RuleMetadata(
        id="LF-004",
        name="HTTP Error Spike",
        description=(
            "A high number of 4xx or 5xx responses from one IP. Causes can "
            "include user error, application faults, scanning or an outage."
        ),
        severity="medium",
        source_type="web_access",
        logic=(
            "Group web events by source_ip, count 4xx and 5xx responses in a "
            "sliding window, and report both counts separately."
        ),
    ),
    "LF-005": RuleMetadata(
        id="LF-005",
        name="Sensitive Path Request",
        description=(
            "A request to a path on the configurable sensitive-path list "
            "(for example .env, /admin, /wp-admin). The request alone is not "
            "evidence of successful exploitation."
        ),
        severity="medium",
        source_type="web_access",
        logic=(
            "Normalize the request path (percent-decoding, slash collapsing, "
            "lowercasing) and compare path segments with the configured list."
        ),
    ),
}
