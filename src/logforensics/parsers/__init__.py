"""Parser registry and line-oriented parse runner."""

from __future__ import annotations

from dataclasses import dataclass, field

from logforensics.config import SOURCE_TYPE_LINUX_AUTH, SOURCE_TYPE_WEB_ACCESS
from logforensics.models import ParseError, ParsedRecord
from logforensics.parsers.base import BaseParser, ParseContext, ParseLineError
from logforensics.parsers.linux_auth import LinuxAuthParser
from logforensics.parsers.web_access import WebAccessParser

PARSERS: dict[str, BaseParser] = {
    SOURCE_TYPE_LINUX_AUTH: LinuxAuthParser(),
    SOURCE_TYPE_WEB_ACCESS: WebAccessParser(),
}


@dataclass
class ParseResult:
    records: list[ParsedRecord] = field(default_factory=list)
    errors: list[ParseError] = field(default_factory=list)
    total_lines: int = 0


def parse_text(
    text: str,
    source_file: str,
    source_type: str,
    context: ParseContext,
    max_lines: int | None = None,
) -> ParseResult:
    """Parse every line of a file, preserving failures instead of dropping them."""

    parser = PARSERS.get(source_type)
    if parser is None:
        raise ValueError(f"Unsupported parser: {source_type!r}")

    result = ParseResult()
    lines = text.splitlines()
    result.total_lines = len(lines)
    for line_number, raw_line in enumerate(lines, start=1):
        if max_lines is not None and line_number > max_lines:
            result.errors.append(
                ParseError(
                    source_file=source_file,
                    source_line=line_number,
                    raw_line="",
                    reason=(
                        f"Line limit of {max_lines} exceeded; remaining content "
                        "was not parsed."
                    ),
                    parser=source_type,
                )
            )
            break
        if not raw_line.strip():
            continue
        try:
            record = parser.parse_line(
                raw_line, source_file, line_number, context
            )
        except ParseLineError as exc:
            result.errors.append(
                ParseError(
                    source_file=source_file,
                    source_line=line_number,
                    raw_line=raw_line,
                    reason=str(exc),
                    parser=source_type,
                )
            )
            continue
        result.records.append(record)
    return result


__all__ = [
    "PARSERS",
    "ParseContext",
    "ParseLineError",
    "ParseResult",
    "LinuxAuthParser",
    "WebAccessParser",
    "parse_text",
]
