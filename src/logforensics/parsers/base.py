"""Shared parser primitives."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import tzinfo

from logforensics.models import ParsedRecord


@dataclass(frozen=True)
class ParseContext:
    """Assumptions applied to timestamps that lack year or timezone."""

    year: int
    timezone: tzinfo
    timezone_name: str


class ParseLineError(ValueError):
    """Raised by a parser when a line does not match its expected format."""


class BaseParser:
    source_type: str = "unknown"
    display_name: str = "Unknown"

    def parse_line(
        self,
        line: str,
        source_file: str,
        source_line: int,
        context: ParseContext,
    ) -> ParsedRecord:  # pragma: no cover - interface only
        raise NotImplementedError
