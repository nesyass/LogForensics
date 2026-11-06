from datetime import timezone

import pytest

from logforensics.analysis import analyze
from logforensics.config import DetectionSettings
from logforensics.ingestion.file_loader import FileLoadError, load_bytes
from logforensics.ingestion.format_detector import detect_format
from logforensics.parsers import ParseContext
from logforensics.parsers.linux_auth import LinuxAuthParser
from logforensics.normalization import normalize


def test_normalization_preserves_raw_and_source(context=None):
    context = context or ParseContext(
        year=2026, timezone=timezone.utc, timezone_name="UTC"
    )
    line = (
        "Nov  5 09:00:12 lab-server sshd[1201]: Failed password for invalid user "
        "admin from 192.0.2.15 port 51234 ssh2"
    )
    record = LinuxAuthParser().parse_line(line, "auth.log", 42, context)
    event = normalize(record, "evt-000042")

    assert event.event_id == "evt-000042"
    assert event.source_file == "auth.log"
    assert event.source_line == 42
    assert event.raw_message == line
    assert event.parse_status == "success"
    assert event.timestamp_precision == "second"
    assert event.http_status is None
    payload = event.to_dict()
    assert payload["event_id"] == "evt-000042"
    assert payload["raw_message"] == line
    assert payload["timestamp"].startswith("2026-11-05T09:00:12")


def test_detect_linux_auth_format():
    text = (
        "Nov  5 09:00:12 lab-server sshd[1201]: Failed password for root from "
        "192.0.2.15 port 51234 ssh2\n"
    )
    detection = detect_format(text, "auth.log")
    assert detection.source_type == "linux_auth"
    assert detection.confidence > 0


def test_detect_web_access_format():
    text = (
        '192.0.2.25 - - [05/Nov/2026:09:10:12 +0700] "GET / HTTP/1.1" '
        '200 10 "-" "curl/8.0"\n'
    )
    detection = detect_format(text, "access.log")
    assert detection.source_type == "web_access"
    assert detection.confidence > 0


def test_detect_unknown_format():
    detection = detect_format("hello\nworld\n", "notes.txt")
    assert detection.source_type is None
    assert detection.confidence == 0.0


def test_analyze_assigns_unique_ids_and_keeps_parse_errors():
    content = (
        "Nov  5 09:00:12 lab-server sshd[1201]: Failed password for root from "
        "192.0.2.15 port 51234 ssh2\n"
        "broken line\n"
        "Nov  5 09:01:00 lab-server sshd[1202]: Accepted password for root from "
        "192.0.2.15 port 51235 ssh2\n"
    ).encode()
    loaded = load_bytes("auth.log", content)
    result = analyze(
        [loaded],
        source_type="linux_auth",
        year=2026,
        timezone_name="UTC",
        settings=DetectionSettings(),
    )

    assert len(result.events) == 2
    assert len(result.parse_errors) == 1
    assert result.parse_errors[0].source_line == 2
    assert len({event.event_id for event in result.events}) == 2
    assert result.summary.parsed_events == 2
    assert result.summary.parse_errors == 1
    assert result.files[0].sha256


def test_file_loader_rejects_unsupported_extension():
    with pytest.raises(FileLoadError, match="extension"):
        load_bytes("payload.exe", b"not a log")


def test_file_loader_rejects_binary_content():
    with pytest.raises(FileLoadError, match="binary"):
        load_bytes("fake.log", b"abc\x00def")
