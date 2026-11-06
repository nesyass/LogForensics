"""Heuristic format detection.

Detection is intentionally transparent: it scores a sample of lines against
the supported parsers and reports a confidence value. Users can always override
the result with a manual parser selection.
"""

from __future__ import annotations

from dataclasses import dataclass

from logforensics.config import SOURCE_TYPE_LINUX_AUTH, SOURCE_TYPE_WEB_ACCESS

_SAMPLE_LINES = 300


@dataclass
class FormatDetection:
    source_type: str | None
    confidence: float
    reason: str


def _score_linux_auth(line: str) -> int:
    score = 0
    lowered = line.lower()
    if "sshd[" in lowered or "sshd:" in lowered:
        score += 2
    if "sudo:" in lowered:
        score += 2
    if "failed password" in lowered:
        score += 2
    if "accepted password" in lowered or "accepted publickey" in lowered:
        score += 2
    if "authentication failure" in lowered:
        score += 1
    if "invalid user" in lowered:
        score += 1
    return score


def _score_web_access(line: str) -> int:
    score = 0
    lowered = line.lower()
    if 'http/1.' in lowered or 'http/2' in lowered:
        score += 2
    if any(method in lowered for method in ('"get ', '"post ', '"head ', '"put ', '"delete ', '"options ')):
        score += 1
    # Combined/Common Log Format has a bracketed timestamp before a quoted
    # request and a numeric status code after it.
    if "[" in line and "]" in line and '" ' in line:
        score += 1
    return score


def detect_format(text: str, filename: str = "") -> FormatDetection:
    lines = [line for line in text.splitlines() if line.strip()][:_SAMPLE_LINES]
    if not lines:
        return FormatDetection(None, 0.0, "The file contains no non-empty lines.")

    linux_score = sum(_score_linux_auth(line) for line in lines)
    web_score = sum(_score_web_access(line) for line in lines)

    name_hint = filename.lower()
    if "auth" in name_hint or "secure" in name_hint:
        linux_score += 1
    if "access" in name_hint or "web" in name_hint:
        web_score += 1

    total = len(lines)
    if linux_score == 0 and web_score == 0:
        return FormatDetection(
            None, 0.0, "No supported log signature was found in the sample."
        )

    if linux_score >= web_score:
        confidence = min(1.0, linux_score / (total * 3))
        return FormatDetection(
            SOURCE_TYPE_LINUX_AUTH,
            round(confidence, 2),
            f"Matched Linux auth signatures in {total} sampled line(s).",
        )

    confidence = min(1.0, web_score / (total * 3))
    return FormatDetection(
        SOURCE_TYPE_WEB_ACCESS,
        round(confidence, 2),
        f"Matched web access log signatures in {total} sampled line(s).",
    )
