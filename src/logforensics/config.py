"""Application-wide configuration and detection defaults.

Thresholds in this module are lab defaults, not universal baselines. They can
be overridden from the local web console or by passing a ``DetectionSettings``
instance to the analysis pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

APP_NAME = "LogForensics"
APP_VERSION = "0.1.0"

DEFAULT_TIMEZONE = "Asia/Jakarta"
DEFAULT_YEAR_FALLBACK_DAYS = 366

SUPPORTED_EXTENSIONS = (".log", ".txt", ".csv")
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MiB per file
MAX_LINES_PER_FILE = 200_000

SOURCE_TYPE_LINUX_AUTH = "linux_auth"
SOURCE_TYPE_WEB_ACCESS = "web_access"

SOURCE_TYPE_LABELS = {
    SOURCE_TYPE_LINUX_AUTH: "Linux authentication log",
    SOURCE_TYPE_WEB_ACCESS: "Apache/Nginx access log",
}

PARSER_CHOICES = {
    "auto": "Auto-detect",
    SOURCE_TYPE_LINUX_AUTH: "Linux authentication log",
    SOURCE_TYPE_WEB_ACCESS: "Apache/Nginx access log",
}

SEVERITY_ORDER = ("critical", "high", "medium", "low", "info")

REVIEW_STATUSES = (
    "needs_review",
    "benign",
    "confirmed_suspicious",
    "false_positive",
)

REVIEW_STATUS_LABELS = {
    "needs_review": "Needs Review",
    "benign": "Benign / Expected",
    "confirmed_suspicious": "Confirmed Suspicious",
    "false_positive": "False Positive",
}

EVENT_CATEGORY_LABELS = {
    "authentication": "Authentication",
    "web": "Web",
    "system": "System",
    "unknown": "Unknown",
}

TIMEZONE_CHOICES = (
    "Asia/Jakarta",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "UTC",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
    "Australia/Sydney",
)

SENSITIVE_PATHS = (
    ".env",
    "admin",
    "wp-admin",
    "phpmyadmin",
    "backup",
    "config",
)


@dataclass
class DetectionSettings:
    """Configurable thresholds for the rule-based detection engine."""

    failed_login_threshold: int = 10
    failed_login_window_seconds: int = 120

    success_after_failures_threshold: int = 5
    success_after_failures_window_seconds: int = 600

    multi_user_threshold: int = 5
    multi_user_window_seconds: int = 300

    http_error_threshold: int = 10
    http_error_window_seconds: int = 60

    sensitive_paths: tuple[str, ...] = field(default_factory=lambda: SENSITIVE_PATHS)
    sensitive_path_severity: str = "medium"

    enabled_rules: tuple[str, ...] = (
        "LF-001",
        "LF-002",
        "LF-003",
        "LF-004",
        "LF-005",
    )

    def is_enabled(self, rule_id: str) -> bool:
        return rule_id in self.enabled_rules


def resolve_timezone(name: str) -> tzinfo:
    """Resolve an IANA timezone name or raise a clear error.

    The app never silently falls back to UTC: an unknown timezone would make
    every downstream timestamp misleading.
    """

    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(
            f"Unknown timezone {name!r}. Install the 'tzdata' package or "
            "choose an IANA timezone available on this system."
        ) from exc
