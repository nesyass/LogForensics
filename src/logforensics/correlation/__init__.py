"""Correlation package."""

from logforensics.correlation.correlator import (
    DEFAULT_CORRELATION_WINDOW_SECONDS,
    build_incidents,
)

__all__ = ["DEFAULT_CORRELATION_WINDOW_SECONDS", "build_incidents"]
