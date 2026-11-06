"""Parser for Linux authentication logs (auth.log / secure)."""

from __future__ import annotations

import re
from datetime import datetime

from logforensics.config import SOURCE_TYPE_LINUX_AUTH
from logforensics.models import ParsedRecord
from logforensics.parsers.base import BaseParser, ParseContext, ParseLineError

_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Classic syslog: Nov  5 09:00:12 lab-server sshd[1201]: message
_SYSLOG_RE = re.compile(
    r"^(?P<month>[A-Za-z]{3})\s+(?P<day>\d{1,2})\s+"
    r"(?P<time>\d{2}:\d{2}:\d{2})\s+"
    r"(?P<host>\S+)\s+"
    r"(?P<process>[^:\[]+?)(?:\[(?P<pid>\d+)\])?:\s+"
    r"(?P<message>.*)$"
)

# RFC 3339 prefix used by some journald/rsyslog configurations:
# 2026-11-05T09:00:12+07:00 lab-server sshd[1201]: message
_ISO_RE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?"
    r"(?:Z|[+-]\d{2}:?\d{2})?)\s+"
    r"(?P<host>\S+)\s+"
    r"(?P<process>[^:\[]+?)(?:\[(?P<pid>\d+)\])?:\s+"
    r"(?P<message>.*)$"
)

_INVALID_USER_FAIL_RE = re.compile(
    r"Failed password for invalid user (?P<user>\S+) from (?P<ip>\S+) "
    r"port (?P<port>\d+)"
)
_FAILED_RE = re.compile(
    r"Failed password for (?:user )?(?P<user>\S+) from (?P<ip>\S+) "
    r"port (?P<port>\d+)"
)
_ACCEPTED_RE = re.compile(
    r"Accepted (?:password|publickey|keyboard-interactive/pam) for "
    r"(?P<user>\S+) from (?P<ip>\S+) port (?P<port>\d+)"
)
_INVALID_ONLY_RE = re.compile(
    r"Invalid user (?P<user>\S+) from (?P<ip>\S+) port (?P<port>\d+)"
)
_SESSION_OPEN_RE = re.compile(
    r"session opened for user (?P<user>\S+) by"
)
_CLOSED_RE = re.compile(
    r"(?:Connection closed|Disconnected) by (?:authenticating user )?"
    r"(?P<user>\S+) (?P<ip>\S+) port (?P<port>\d+)"
)
_SUDO_RE = re.compile(r"^(?P<user>\S+)\s*:\s*TTY=.*?COMMAND=(?P<command>.*)$")


def _parse_syslog_timestamp(
    month_text: str, day: str, time_text: str, context: ParseContext
) -> datetime:
    month = _MONTHS.get(month_text.lower())
    if month is None:
        raise ParseLineError(f"Unrecognized month abbreviation {month_text!r}.")
    try:
        hour, minute, second = (int(part) for part in time_text.split(":"))
        return datetime(
            context.year,
            month,
            int(day),
            hour,
            minute,
            second,
            tzinfo=context.timezone,
        )
    except ValueError as exc:
        raise ParseLineError(f"Invalid syslog timestamp: {exc}") from exc


def _parse_iso_timestamp(text: str, context: ParseContext) -> tuple[datetime, bool]:
    normalized = text.replace(" ", "T", 1).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ParseLineError(f"Invalid ISO timestamp {text!r}: {exc}") from exc
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=context.timezone), False
    return parsed, True


class LinuxAuthParser(BaseParser):
    source_type = SOURCE_TYPE_LINUX_AUTH
    display_name = "Linux authentication log"

    def parse_line(
        self,
        line: str,
        source_file: str,
        source_line: int,
        context: ParseContext,
    ) -> ParsedRecord:
        match = _ISO_RE.match(line)
        if match:
            timestamp, tz_known = _parse_iso_timestamp(match.group("ts"), context)
            assumption = None if tz_known else (
                f"Timestamp had no UTC offset; {context.timezone_name} applied."
            )
            timestamp_precision = "subsecond" if "." in match.group("ts") else "second"
        else:
            match = _SYSLOG_RE.match(line)
            if not match:
                raise ParseLineError(
                    "Line does not match a supported syslog or RFC 3339 prefix."
                )
            timestamp = _parse_syslog_timestamp(
                match.group("month"),
                match.group("day"),
                match.group("time"),
                context,
            )
            tz_known = False
            assumption = (
                f"No year or timezone in syslog timestamp; {context.year} and "
                f"{context.timezone_name} assumed from analysis settings."
            )
            timestamp_precision = "second"

        host = match.group("host")
        process = match.group("process").strip()
        pid = int(match.group("pid")) if match.group("pid") else None
        message = match.group("message").strip()

        record = ParsedRecord(
            source_file=source_file,
            source_line=source_line,
            source_type=self.source_type,
            raw_message=line,
            timestamp=timestamp,
            timestamp_precision=timestamp_precision,
            timestamp_timezone_known=tz_known,
            timestamp_assumption=assumption,
            host=host,
            event_category="authentication",
            event_type="auth_log_entry",
            process=process,
            pid=pid,
            message=message,
        )

        self._classify(message, process, record)
        return record

    def _classify(self, message: str, process: str, record: ParsedRecord) -> None:
        if process == "sudo":
            sudo = _SUDO_RE.match(message)
            if sudo:
                record.event_category = "system"
                record.event_type = "privileged_command"
                record.username = sudo.group("user")
                record.message = message
            return

        match = _INVALID_USER_FAIL_RE.search(message)
        if match:
            self._apply_credentials(record, match)
            record.event_type = "authentication_failure"
            return

        match = _FAILED_RE.search(message)
        if match:
            self._apply_credentials(record, match)
            record.event_type = "authentication_failure"
            return

        match = _ACCEPTED_RE.search(message)
        if match:
            self._apply_credentials(record, match)
            record.event_type = "authentication_success"
            return

        match = _INVALID_ONLY_RE.search(message)
        if match:
            self._apply_credentials(record, match)
            record.event_type = "authentication_failure"
            return

        match = _SESSION_OPEN_RE.search(message)
        if match:
            record.username = match.group("user")
            record.event_type = "session_opened"
            return

        if "authentication failure" in message:
            ip_match = re.search(r"\brhost=(\S+)", message)
            user_match = re.search(r"\buser=(\S+)", message)
            record.source_ip = ip_match.group(1) if ip_match else None
            record.username = user_match.group(1) if user_match else None
            record.event_type = "authentication_failure"
            return

        match = _CLOSED_RE.search(message)
        if match:
            self._apply_credentials(record, match)
            record.event_type = "authentication_connection_closed"
            return

    @staticmethod
    def _apply_credentials(record: ParsedRecord, match: re.Match[str]) -> None:
        record.username = match.group("user")
        record.source_ip = match.group("ip")
        record.source_port = int(match.group("port"))
