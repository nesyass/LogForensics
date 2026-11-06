from datetime import timezone

import pytest

from logforensics.parsers import ParseContext, parse_text
from logforensics.parsers.base import ParseLineError
from logforensics.parsers.linux_auth import LinuxAuthParser


@pytest.fixture
def context():
    return ParseContext(year=2026, timezone=timezone.utc, timezone_name="UTC")


@pytest.fixture
def parser():
    return LinuxAuthParser()


def test_failed_password_for_invalid_user(parser, context):
    line = (
        "Nov  5 09:00:12 lab-server sshd[1201]: Failed password for invalid user "
        "admin from 192.0.2.15 port 51234 ssh2"
    )
    record = parser.parse_line(line, "auth.log", 1, context)

    assert record.source_type == "linux_auth"
    assert record.host == "lab-server"
    assert record.process == "sshd"
    assert record.pid == 1201
    assert record.event_type == "authentication_failure"
    assert record.username == "admin"
    assert record.source_ip == "192.0.2.15"
    assert record.source_port == 51234
    assert record.event_category == "authentication"
    assert record.raw_message == line
    assert record.source_line == 1


def test_accepted_password_is_success(parser, context):
    line = (
        "Nov  5 09:02:41 lab-server sshd[1203]: Accepted password for analyst "
        "from 192.0.2.15 port 51236 ssh2"
    )
    record = parser.parse_line(line, "auth.log", 2, context)
    assert record.event_type == "authentication_success"
    assert record.username == "analyst"
    assert record.source_ip == "192.0.2.15"


def test_syslog_year_and_timezone_assumptions_are_explicit(parser, context):
    line = (
        "Nov  5 09:00:12 lab-server sshd[1201]: Failed password for root from "
        "192.0.2.15 port 51234 ssh2"
    )
    record = parser.parse_line(line, "auth.log", 3, context)
    assert record.timestamp.year == 2026
    assert record.timestamp.utcoffset().total_seconds() == 0
    assert record.timestamp_timezone_known is False
    assert "assumed" in record.timestamp_assumption


def test_iso_timestamp_with_offset(parser, context):
    line = (
        "2026-11-05T09:00:12+07:00 lab-server sshd[1201]: Failed password for "
        "root from 192.0.2.15 port 51234 ssh2"
    )
    record = parser.parse_line(line, "auth.log", 4, context)
    assert record.timestamp.isoformat() == "2026-11-05T09:00:12+07:00"
    assert record.timestamp_timezone_known is True
    assert record.timestamp_assumption is None


def test_sudo_becomes_privileged_command(parser, context):
    line = (
        "Nov  5 08:20:00 lab-server sudo: analyst : TTY=pts/0 ; "
        "PWD=/home/analyst ; USER=root ; COMMAND=/usr/bin/systemctl status nginx"
    )
    record = parser.parse_line(line, "auth.log", 5, context)
    assert record.event_type == "privileged_command"
    assert record.event_category == "system"
    assert record.username == "analyst"


def test_authentication_failure_pam_style_line(parser, context):
    line = (
        "Nov  5 09:10:00 lab-server sshd[1300]: authentication failure; "
        "logname= uid=0 euid=0 tty=ssh ruser= rhost=203.0.113.9 user=admin"
    )
    record = parser.parse_line(line, "auth.log", 6, context)
    assert record.event_type == "authentication_failure"
    assert record.source_ip == "203.0.113.9"
    assert record.username == "admin"


def test_invalid_line_raises(parser, context):
    with pytest.raises(ParseLineError):
        parser.parse_line("this is not a syslog line", "auth.log", 1, context)


def test_parse_text_keeps_failures_and_source_lines(context):
    text = "\n".join(
        [
            "Nov  5 09:00:12 lab-server sshd[1201]: Failed password for root "
            "from 192.0.2.15 port 51234 ssh2",
            "garbage line that cannot be parsed",
            "Nov  5 09:01:00 lab-server sshd[1202]: Accepted password for root "
            "from 192.0.2.15 port 51235 ssh2",
        ]
    )
    result = parse_text(text, "auth.log", "linux_auth", context)

    assert len(result.records) == 2
    assert len(result.errors) == 1
    assert result.errors[0].source_line == 2
    assert result.errors[0].raw_line == "garbage line that cannot be parsed"
    assert "does not match" in result.errors[0].reason
    assert result.total_lines == 3
