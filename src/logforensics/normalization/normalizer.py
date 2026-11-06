"""Normalization of parser output into the internal event schema."""

from __future__ import annotations

from logforensics.models import Event, ParsedRecord


def normalize(record: ParsedRecord, event_id: str) -> Event:
    """Convert a format-specific record into a normalized Event.

    The raw line is copied verbatim. Nothing from the parser output is dropped:
    fields that do not apply to a source type remain ``None``.
    """

    return Event(
        event_id=event_id,
        timestamp=record.timestamp,
        timestamp_precision=record.timestamp_precision,
        timestamp_timezone_known=record.timestamp_timezone_known,
        timestamp_assumption=record.timestamp_assumption,
        source_file=record.source_file,
        source_line=record.source_line,
        source_type=record.source_type,
        host=record.host,
        event_category=record.event_category,
        event_type=record.event_type,
        username=record.username,
        source_ip=record.source_ip,
        source_port=record.source_port,
        destination_ip=record.destination_ip,
        http_method=record.http_method,
        http_path=record.http_path,
        http_status=record.http_status,
        process=record.process,
        user_agent=record.user_agent,
        pid=record.pid,
        message=record.message,
        raw_message=record.raw_message,
        parse_status="success",
    )
