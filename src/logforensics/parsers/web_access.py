"""Parser for Apache/Nginx access logs (Common and Combined Log Format)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from logforensics.config import SOURCE_TYPE_WEB_ACCESS
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

# Combined Log Format. The referer/user-agent pair is optional so that the
# Common Log Format is accepted too.
_ACCESS_RE = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+\S+\s+'
    r'\[(?P<ts>[^\]]+)\]\s+'
    r'"(?P<request>(?:[^"\\]|\\.)*)"\s+'
    r'(?P<status>\d{3})\s+'
    r'(?P<size>\S+)'
    r'(?:\s+"(?P<referer>(?:[^"\\]|\\.)*)"\s+"(?P<ua>(?:[^"\\]|\\.)*)")?'
    r'\s*$'
)

_TS_RE = re.compile(
    r"^(?P<day>\d{2})/(?P<month>[A-Za-z]{3})/(?P<year>\d{4}):"
    r"(?P<hour>\d{2}):(?P<minute>\d{2}):(?P<second>\d{2})"
    r"(?:\s+(?P<tz>[+-]\d{4}))?$"
)

_REQUEST_RE = re.compile(r"^(?P<method>[A-Z]+)\s+(?P<path>\S+)(?:\s+(?P<proto>\S+))?$")


def _parse_timestamp(text: str, context: ParseContext) -> tuple[datetime, bool, str | None]:
    match = _TS_RE.match(text.strip())
    if not match:
        raise ParseLineError(
            "Timestamp is not in Apache/Nginx format "
            "(DD/Mon/YYYY:HH:MM:SS +ZZZZ)."
        )
    month = _MONTHS.get(match.group("month").lower())
    if month is None:
        raise ParseLineError(f"Unrecognized month abbreviation {match.group('month')!r}.")

    tz_group = match.group("tz")
    assumption = None
    if tz_group:
        sign = 1 if tz_group[0] == "+" else -1
        hours = int(tz_group[1:3])
        minutes = int(tz_group[3:5])
        tzinfo = timezone(sign * timedelta(hours=hours, minutes=minutes))
        tz_known = True
    else:
        tzinfo = context.timezone
        tz_known = False
        assumption = (
            f"Access log timestamp had no UTC offset; {context.timezone_name} "
            "applied from analysis settings."
        )

    try:
        parsed = datetime(
            int(match.group("year")),
            month,
            int(match.group("day")),
            int(match.group("hour")),
            int(match.group("minute")),
            int(match.group("second")),
            tzinfo=tzinfo,
        )
    except ValueError as exc:
        raise ParseLineError(f"Invalid access log timestamp: {exc}") from exc
    return parsed, tz_known, assumption


class WebAccessParser(BaseParser):
    source_type = SOURCE_TYPE_WEB_ACCESS
    display_name = "Apache/Nginx access log"

    def parse_line(
        self,
        line: str,
        source_file: str,
        source_line: int,
        context: ParseContext,
    ) -> ParsedRecord:
        match = _ACCESS_RE.match(line)
        if not match:
            raise ParseLineError(
                "Line does not match Common or Combined Log Format."
            )

        timestamp, tz_known, assumption = _parse_timestamp(match.group("ts"), context)
        request = match.group("request")
        method: str | None = None
        path: str | None = None
        request_match = _REQUEST_RE.match(request)
        if request_match:
            method = request_match.group("method")
            path = request_match.group("path")

        size_text = match.group("size")
        try:
            status = int(match.group("status"))
        except ValueError as exc:  # pragma: no cover - regex already enforces digits
            raise ParseLineError(f"Invalid HTTP status: {exc}") from exc

        record = ParsedRecord(
            source_file=source_file,
            source_line=source_line,
            source_type=self.source_type,
            raw_message=line,
            timestamp=timestamp,
            timestamp_precision="second",
            timestamp_timezone_known=tz_known,
            timestamp_assumption=assumption,
            host=None,
            event_category="web",
            event_type="http_request",
            source_ip=match.group("ip"),
            http_method=method,
            http_path=path,
            http_status=status,
            user_agent=match.group("ua"),
            message=request,
        )
        record.destination_ip = None
        # Keep response size available in the parser message for evidence
        # display without adding a non-spec normalized field.
        if size_text != "-":
            try:
                record.message = f"{request} -> {status} ({int(size_text)} bytes)"
            except ValueError:
                record.message = f"{request} -> {status} ({size_text} bytes)"
        else:
            record.message = f"{request} -> {status}"
        return record
