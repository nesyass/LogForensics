from datetime import timezone

import pytest

from logforensics.parsers import ParseContext, parse_text
from logforensics.parsers.base import ParseLineError
from logforensics.parsers.web_access import WebAccessParser


@pytest.fixture
def context():
    return ParseContext(year=2026, timezone=timezone.utc, timezone_name="UTC")


@pytest.fixture
def parser():
    return WebAccessParser()


def test_combined_log_format(parser, context):
    line = (
        '192.0.2.25 - - [05/Nov/2026:09:10:12 +0700] "GET /login HTTP/1.1" '
        '200 1234 "https://example.test/" "Mozilla/5.0"'
    )
    record = parser.parse_line(line, "access.log", 7, context)

    assert record.source_ip == "192.0.2.25"
    assert record.http_method == "GET"
    assert record.http_path == "/login"
    assert record.http_status == 200
    assert record.user_agent == "Mozilla/5.0"
    assert record.event_category == "web"
    assert record.event_type == "http_request"
    assert record.timestamp.isoformat() == "2026-11-05T09:10:12+07:00"
    assert record.timestamp_timezone_known is True
    assert record.raw_message == line
    assert record.source_line == 7


def test_common_log_format_without_referer_and_user_agent(parser, context):
    line = '203.0.113.9 - frank [05/Nov/2026:10:00:00 +0700] "GET / HTTP/1.1" 200 512'
    record = parser.parse_line(line, "access.log", 1, context)
    assert record.http_path == "/"
    assert record.user_agent is None
    assert record.http_status == 200


def test_missing_timezone_is_an_explicit_assumption(parser, context):
    line = '203.0.113.9 - - [05/Nov/2026:10:00:00] "GET / HTTP/1.1" 200 512'
    record = parser.parse_line(line, "access.log", 1, context)
    assert record.timestamp.utcoffset().total_seconds() == 0
    assert record.timestamp_timezone_known is False
    assert "applied from analysis settings" in record.timestamp_assumption


def test_request_with_query_string_preserves_raw_path(parser, context):
    line = (
        '203.0.113.9 - - [05/Nov/2026:10:00:00 +0700] '
        '"GET /search?q=%2e%2e%2f HTTP/1.1" 400 0 "-" "curl/8.0"'
    )
    record = parser.parse_line(line, "access.log", 1, context)
    assert record.http_path == "/search?q=%2e%2e%2f"
    assert record.http_status == 400


def test_empty_request_field_is_still_parseable(parser, context):
    line = '203.0.113.9 - - [05/Nov/2026:10:00:00 +0700] "-" 400 0 "-" "-"'
    record = parser.parse_line(line, "access.log", 1, context)
    assert record.http_method is None
    assert record.http_path is None
    assert record.http_status == 400


def test_invalid_line_is_reported(parser, context):
    with pytest.raises(ParseLineError):
        parser.parse_line("not an access log line", "access.log", 1, context)


def test_parse_text_records_errors(context):
    text = "\n".join(
        [
            '192.0.2.25 - - [05/Nov/2026:09:10:12 +0700] "GET / HTTP/1.1" '
            '200 10 "-" "curl/8.0"',
            "malformed",
        ]
    )
    result = parse_text(text, "access.log", "web_access", context)
    assert len(result.records) == 1
    assert len(result.errors) == 1
    assert result.errors[0].source_line == 2
