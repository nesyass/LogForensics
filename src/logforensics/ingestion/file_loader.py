"""Safe file ingestion with size, extension and encoding handling."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from logforensics.config import MAX_FILE_BYTES, SUPPORTED_EXTENSIONS

# UTF-8 first, then a conservative single-byte fallback for Windows-generated
# logs. The encoding used is recorded in the file manifest.
_ENCODINGS = ("utf-8-sig", "utf-8", "cp1252", "latin-1")


class FileLoadError(ValueError):
    """Raised when an input file fails validation."""


@dataclass
class LoadedFile:
    name: str
    text: str
    size_bytes: int
    sha256: str
    encoding: str


def _validate_name(name: str) -> str:
    base = Path(name).name.strip()
    if not base:
        raise FileLoadError("The uploaded file has an empty name.")
    suffix = Path(base).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        allowed = ", ".join(SUPPORTED_EXTENSIONS)
        raise FileLoadError(
            f"Unsupported file extension {suffix or '(none)'} for {base!r}. "
            f"Allowed extensions: {allowed}."
        )
    return base


def load_bytes(name: str, data: bytes) -> LoadedFile:
    """Validate and decode an uploaded file without executing its content."""

    base = _validate_name(name)
    if not data:
        raise FileLoadError(f"{base!r} is empty.")
    if len(data) > MAX_FILE_BYTES:
        raise FileLoadError(
            f"{base!r} is {len(data) / (1024 * 1024):.2f} MiB; the limit is "
            f"{MAX_FILE_BYTES / (1024 * 1024):.0f} MiB per file."
        )
    if b"\x00" in data[:4096]:
        raise FileLoadError(
            f"{base!r} looks like a binary file (NUL bytes found) and cannot "
            "be analyzed as text."
        )

    text: str | None = None
    used_encoding = ""
    for encoding in _ENCODINGS:
        try:
            candidate = data.decode(encoding)
        except UnicodeDecodeError:
            continue
        # Reject accidental mojibake unless this is the last-resort encoding.
        if encoding in ("utf-8-sig", "utf-8") or text is None:
            text = candidate
            used_encoding = encoding
            break

    if text is None:  # pragma: no cover - latin-1 always decodes bytes
        raise FileLoadError(f"Could not decode {base!r} as text.")

    if "\x00" in text:
        raise FileLoadError(f"{base!r} contains NUL characters after decoding.")

    return LoadedFile(
        name=base,
        text=text,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        encoding=used_encoding,
    )


def load_path(path: str | Path) -> LoadedFile:
    file_path = Path(path)
    return load_bytes(file_path.name, file_path.read_bytes())
