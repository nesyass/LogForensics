"""End-to-end analysis pipeline: detect → parse → normalize → detect → correlate."""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable, Sequence
from datetime import datetime

from logforensics.analysis.timeline import analyze_ips, build_timeline
from logforensics.config import (
    DEFAULT_TIMEZONE,
    MAX_LINES_PER_FILE,
    SEVERITY_ORDER,
    DetectionSettings,
    resolve_timezone,
)
from logforensics.correlation.correlator import build_incidents
from logforensics.detection.engine import run_detection
from logforensics.ingestion.file_loader import LoadedFile
from logforensics.ingestion.format_detector import detect_format
from logforensics.models import AnalysisResult, AnalysisSummary, FileSummary, ParsedRecord
from logforensics.normalization import normalize
from logforensics.parsers import PARSERS, ParseContext, parse_text

ProgressCallback = Callable[[int, int, str], None]


def _summarize(
    events,
    errors,
    files: list[FileSummary],
    alerts,
    timezone_name: str,
    year: int,
) -> AnalysisSummary:
    timestamps = [event.timestamp for event in events if event.timestamp is not None]
    severity_counts = Counter(alert.severity for alert in alerts)
    ordered_severities = {
        severity: severity_counts[severity]
        for severity in SEVERITY_ORDER
        if severity_counts[severity]
    }
    return AnalysisSummary(
        total_files=len(files),
        total_lines=sum(file.total_lines for file in files),
        parsed_events=len(events),
        parse_errors=len(errors),
        total_alerts=len(alerts),
        severity_counts=ordered_severities,
        first_event=min(timestamps) if timestamps else None,
        last_event=max(timestamps) if timestamps else None,
        timezone_name=timezone_name,
        year_assumption=year,
    )


def analyze(
    files: Sequence[LoadedFile],
    source_type: str = "auto",
    year: int | None = None,
    timezone_name: str = DEFAULT_TIMEZONE,
    settings: DetectionSettings | None = None,
    progress: ProgressCallback | None = None,
) -> AnalysisResult:
    """Analyze one or more loaded log files.

    ``source_type`` may be ``"auto"`` or a key from ``PARSERS``. Parsing is
    line-oriented; a bad line becomes a ParseError and never aborts the run.
    """

    if source_type != "auto" and source_type not in PARSERS:
        raise ValueError(f"Unsupported parser: {source_type!r}")

    settings = settings or DetectionSettings()
    tz = resolve_timezone(timezone_name)
    analysis_year = int(year) if year is not None else datetime.now().year
    context = ParseContext(
        year=analysis_year, timezone=tz, timezone_name=timezone_name
    )

    all_records: list[ParsedRecord] = []
    all_errors = []
    file_summaries: list[FileSummary] = []
    total = len(files)

    for index, loaded in enumerate(files, start=1):
        if progress is not None:
            progress(index - 1, total, f"Parsing {loaded.name}")

        resolved_type = source_type
        confidence: float | None = 1.0
        note: str | None = None

        if source_type == "auto":
            detected = detect_format(loaded.text, loaded.name)
            resolved_type = detected.source_type or ""
            confidence = detected.confidence
            note = detected.reason
            if not resolved_type:
                summary = FileSummary(
                    name=loaded.name,
                    size_bytes=loaded.size_bytes,
                    sha256=loaded.sha256,
                    encoding=loaded.encoding,
                    source_type=None,
                    total_lines=len(loaded.text.splitlines()),
                    parsed_lines=0,
                    error_lines=0,
                    detection_confidence=0.0,
                    note=(
                        detected.reason
                        + " Select a parser manually to force analysis."
                    ),
                )
                file_summaries.append(summary)
                continue

        parsed = parse_text(
            loaded.text,
            source_file=loaded.name,
            source_type=resolved_type,
            context=context,
            max_lines=MAX_LINES_PER_FILE,
        )
        all_records.extend(parsed.records)
        all_errors.extend(parsed.errors)

        if confidence is not None and confidence < 0.5:
            note = (note or "") + " Low detection confidence; verify the parser choice."

        file_summaries.append(
            FileSummary(
                name=loaded.name,
                size_bytes=loaded.size_bytes,
                sha256=loaded.sha256,
                encoding=loaded.encoding,
                source_type=resolved_type,
                total_lines=parsed.total_lines,
                parsed_lines=len(parsed.records),
                error_lines=len(parsed.errors),
                detection_confidence=confidence,
                note=note,
            )
        )

    events = [
        normalize(record, event_id=f"evt-{index:06d}")
        for index, record in enumerate(all_records, start=1)
    ]
    alerts = run_detection(events, settings)
    incidents = build_incidents(alerts)

    if progress is not None:
        progress(total, total, "Analysis complete")

    result = AnalysisResult(
        events=events,
        parse_errors=all_errors,
        alerts=alerts,
        incidents=incidents,
        files=file_summaries,
        summary=_summarize(
            events, all_errors, file_summaries, alerts, timezone_name, analysis_year
        ),
        settings=settings,
    )
    return result


def rerun_detection(
    result: AnalysisResult, settings: DetectionSettings
) -> AnalysisResult:
    """Re-run detection against already parsed events (no re-parsing)."""

    alerts = run_detection(result.events, settings)
    result.alerts = alerts
    result.incidents = build_incidents(alerts)
    result.settings = settings
    result.summary = _summarize(
        result.events,
        result.parse_errors,
        result.files,
        alerts,
        result.summary.timezone_name,
        result.summary.year_assumption or datetime.now().year,
    )
    return result


def get_timeline(result: AnalysisResult) -> list[dict]:
    return build_timeline(result.events, result.alerts)


def get_ip_analysis(result: AnalysisResult) -> list[dict]:
    return analyze_ips(result.events, result.alerts)
