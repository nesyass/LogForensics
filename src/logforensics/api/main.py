"""Local FastAPI application for the LogForensics web console."""

from __future__ import annotations

import hmac
import json
import os
import secrets
from pathlib import Path
from typing import Any

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.sessions import SessionMiddleware

from logforensics.analysis import analyze
from logforensics.api.store import CaseStore
from logforensics.config import (
    APP_NAME,
    APP_VERSION,
    DEFAULT_TIMEZONE,
    PARSER_CHOICES,
    DetectionSettings,
    resolve_timezone,
)
from logforensics.detection.rules import RULES
from logforensics.ingestion import FileLoadError, load_bytes, load_path

ROOT = Path(__file__).resolve().parents[3]
DIST = ROOT / "web" / "dist"
SAMPLE_DIR = ROOT / "sample_data"


class LoginRequest(BaseModel):
    username: str
    password: str


class AnalysisOptions(BaseModel):
    name: str | None = None
    year: int | None = Field(default=None, ge=1970, le=2100)
    timezone: str = DEFAULT_TIMEZONE
    parser: str = "auto"

    failed_login_threshold: int = Field(default=10, ge=2, le=1000)
    failed_login_window_seconds: int = Field(default=120, ge=5, le=86400)
    success_after_failures_threshold: int = Field(default=5, ge=1, le=1000)
    success_after_failures_window_seconds: int = Field(default=600, ge=5, le=86400)
    multi_user_threshold: int = Field(default=5, ge=2, le=1000)
    multi_user_window_seconds: int = Field(default=300, ge=5, le=86400)
    http_error_threshold: int = Field(default=10, ge=2, le=10000)
    http_error_window_seconds: int = Field(default=60, ge=5, le=86400)
    sensitive_paths: str = ".env, admin, wp-admin, phpmyadmin, backup, config"
    enabled_rules: list[str] = Field(default_factory=lambda: sorted(RULES))

    @field_validator("timezone")
    @classmethod
    def _valid_timezone(cls, value: str) -> str:
        try:
            resolve_timezone(value)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc
        return value

    @field_validator("parser")
    @classmethod
    def _valid_parser(cls, value: str) -> str:
        if value not in PARSER_CHOICES:
            raise ValueError(f"Unsupported parser: {value!r}")
        return value

    @field_validator("enabled_rules")
    @classmethod
    def _valid_rules(cls, value: list[str]) -> list[str]:
        unknown = sorted(set(value) - set(RULES))
        if unknown:
            raise ValueError(f"Unknown rules: {', '.join(unknown)}")
        return value

    def to_settings(self) -> DetectionSettings:
        paths = tuple(
            item.strip() for item in self.sensitive_paths.split(",") if item.strip()
        )
        return DetectionSettings(
            failed_login_threshold=self.failed_login_threshold,
            failed_login_window_seconds=self.failed_login_window_seconds,
            success_after_failures_threshold=self.success_after_failures_threshold,
            success_after_failures_window_seconds=self.success_after_failures_window_seconds,
            multi_user_threshold=self.multi_user_threshold,
            multi_user_window_seconds=self.multi_user_window_seconds,
            http_error_threshold=self.http_error_threshold,
            http_error_window_seconds=self.http_error_window_seconds,
            sensitive_paths=paths,
            enabled_rules=tuple(self.enabled_rules),
        )


def _verify(username: str, password: str, expected_user: str, expected_pass: str) -> bool:
    return hmac.compare_digest(
        username.strip().encode("utf-8"), expected_user.encode("utf-8")
    ) and hmac.compare_digest(
        password.encode("utf-8"), expected_pass.encode("utf-8")
    )


def create_app(
    db_path: Path | str | None = None,
    *,
    username: str | None = None,
    password: str | None = None,
    secret_key: str | None = None,
) -> FastAPI:
    app = FastAPI(
        title=f"{APP_NAME} API",
        version=APP_VERSION,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.state.store = CaseStore(
        db_path or os.environ.get("LOGFORENSICS_DB") or ROOT / "data" / "logforensics.db"
    )
    app.state.username = username or os.environ.get(
        "LOGFORENSICS_USERNAME", "analyst"
    )
    app.state.password = password or os.environ.get(
        "LOGFORENSICS_PASSWORD", "logforensics"
    )
    app.add_middleware(
        SessionMiddleware,
        secret_key=secret_key or os.environ.get("LOGFORENSICS_SECRET") or secrets.token_hex(32),
        same_site="lax",
        https_only=False,
        session_cookie="logforensics_session",
    )

    def require_user(request: Request) -> str:
        user = request.session.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="Sign in required.")
        return str(user)

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "app": APP_NAME, "version": APP_VERSION}

    @app.post("/api/auth/login")
    def login(payload: LoginRequest, request: Request) -> dict[str, str]:
        if not _verify(
            payload.username,
            payload.password,
            app.state.username,
            app.state.password,
        ):
            raise HTTPException(
                status_code=401, detail="Incorrect username or password."
            )
        user = payload.username.strip()
        request.session["user"] = user
        return {"user": user}

    @app.get("/api/auth/me")
    def me(request: Request) -> dict[str, str]:
        user = request.session.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="Not signed in.")
        return {"user": str(user)}

    @app.post("/api/auth/logout")
    def logout(request: Request) -> dict[str, bool]:
        request.session.clear()
        return {"ok": True}

    # ------------------------------------------------------------------
    # Cases
    # ------------------------------------------------------------------

    @app.get("/api/cases")
    def list_cases(
        _: str = Depends(require_user), limit: int = 25
    ) -> list[dict[str, Any]]:
        return app.state.store.list_cases(limit=limit)

    @app.get("/api/cases/{case_id}")
    def get_case(case_id: str, _: str = Depends(require_user)) -> dict[str, Any]:
        payload = app.state.store.get_case(case_id)
        if payload is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        return payload

    @app.delete("/api/cases/{case_id}")
    def delete_case(case_id: str, _: str = Depends(require_user)) -> dict[str, bool]:
        if not app.state.store.delete_case(case_id):
            raise HTTPException(status_code=404, detail="Case not found.")
        return {"ok": True}

    @app.post("/api/cases/sample")
    def create_sample_case(
        options: AnalysisOptions, _: str = Depends(require_user)
    ) -> dict[str, Any]:
        files = sorted(SAMPLE_DIR.glob("*.log"))
        if not files:
            raise HTTPException(
                status_code=500, detail="The synthetic sample dataset is missing."
            )
        try:
            loaded = [load_path(path) for path in files]
            result = analyze(
                loaded,
                source_type=options.parser,
                year=options.year,
                timezone_name=options.timezone,
                settings=options.to_settings(),
            )
        except (FileLoadError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        case_id = app.state.store.save_result(
            result,
            name=options.name or "Synthetic sample dataset",
            source="sample",
            parser=options.parser,
            timezone_name=options.timezone,
            year=options.year,
        )
        payload = app.state.store.get_case(case_id)
        if payload is None:  # pragma: no cover - just written
            raise HTTPException(status_code=500, detail="Could not read the new case.")
        return payload

    @app.post("/api/cases")
    async def create_case(
        files: list[UploadFile] = File(...),
        options: str = Form("{}"),
        name: str | None = Form(None),
        _: str = Depends(require_user),
    ) -> dict[str, Any]:
        try:
            parsed_options = AnalysisOptions.model_validate_json(options)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid options: {exc}") from exc

        loaded = []
        for upload in files:
            try:
                data = await upload.read()
                loaded.append(load_bytes(upload.filename or "upload.log", data))
            except FileLoadError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not loaded:
            raise HTTPException(status_code=400, detail="Choose at least one log file.")

        try:
            result = analyze(
                loaded,
                source_type=parsed_options.parser,
                year=parsed_options.year,
                timezone_name=parsed_options.timezone,
                settings=parsed_options.to_settings(),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        case_name = name or parsed_options.name
        if not case_name:
            names = [item.name for item in loaded]
            case_name = names[0] if len(names) == 1 else f"{len(names)} log sources"
        case_id = app.state.store.save_result(
            result,
            name=case_name,
            source="upload",
            parser=parsed_options.parser,
            timezone_name=parsed_options.timezone,
            year=parsed_options.year,
        )
        payload = app.state.store.get_case(case_id)
        if payload is None:  # pragma: no cover - just written
            raise HTTPException(status_code=500, detail="Could not read the new case.")
        return payload

    # ------------------------------------------------------------------
    # Investigation data
    # ------------------------------------------------------------------

    @app.get("/api/cases/{case_id}/events")
    def events(
        case_id: str,
        _: str = Depends(require_user),
        page: int = 1,
        page_size: int = 50,
        search: str = "",
        category: str = "",
        event_type: str = "",
        source_file: str = "",
        ip: str = "",
        user: str = "",
        date_from: str = "",
        date_to: str = "",
        sort: str = "desc",
    ) -> dict[str, Any]:
        if app.state.store.get_case(case_id) is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        return app.state.store.get_events(
            case_id,
            page=page,
            page_size=page_size,
            search=search,
            category=category,
            event_type=event_type,
            source_file=source_file,
            ip=ip,
            user=user,
            date_from=date_from,
            date_to=date_to,
            sort=sort,
        )

    @app.get("/api/cases/{case_id}/events/{event_id}")
    def event_detail(
        case_id: str, event_id: str, _: str = Depends(require_user)
    ) -> dict[str, Any]:
        payload = app.state.store.get_event(case_id, event_id)
        if payload is None:
            raise HTTPException(status_code=404, detail="Event not found.")
        return payload

    @app.get("/api/cases/{case_id}/facets")
    def facets(case_id: str, _: str = Depends(require_user)) -> dict[str, list[str]]:
        if app.state.store.get_case(case_id) is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        return app.state.store.get_facets(case_id)

    @app.get("/api/cases/{case_id}/timeline")
    def timeline(
        case_id: str,
        _: str = Depends(require_user),
        buckets: int = 72,
    ) -> dict[str, Any]:
        if app.state.store.get_case(case_id) is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        return app.state.store.get_timeline(case_id, buckets=buckets)

    @app.get("/api/cases/{case_id}/ips")
    def ips(case_id: str, _: str = Depends(require_user)) -> list[dict[str, Any]]:
        if app.state.store.get_case(case_id) is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        return app.state.store.get_ip_analysis(case_id)

    @app.patch("/api/cases/{case_id}/alerts/{alert_id}")
    def update_alert(
        case_id: str,
        alert_id: str,
        payload: dict[str, str],
        _: str = Depends(require_user),
    ) -> dict[str, Any]:
        status = payload.get("status", "")
        try:
            alert = app.state.store.update_alert_status(case_id, alert_id, status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if alert is None:
            raise HTTPException(status_code=404, detail="Alert not found.")
        return alert.to_dict()

    # ------------------------------------------------------------------
    # Exports
    # ------------------------------------------------------------------

    @app.get("/api/cases/{case_id}/exports")
    def exports(case_id: str, _: str = Depends(require_user)) -> list[dict[str, Any]]:
        if app.state.store.get_case(case_id) is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        return app.state.store.list_exports(case_id)

    @app.get("/api/cases/{case_id}/exports/{artifact}")
    def download_export(
        case_id: str, artifact: str, _: str = Depends(require_user)
    ) -> Response:
        payload = app.state.store.get_export(case_id, artifact)
        if payload is None:
            raise HTTPException(status_code=404, detail="Export artifact not found.")
        content, mime, filename = payload
        return Response(
            content=content,
            media_type=mime,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store",
            },
        )

    # ------------------------------------------------------------------
    # Frontend
    # ------------------------------------------------------------------

    if DIST.exists():
        assets = DIST / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> Response:
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found.")
        if DIST.exists():
            candidate = (DIST / full_path).resolve()
            try:
                candidate.relative_to(DIST.resolve())
            except ValueError:
                candidate = DIST / "index.html"
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            index = DIST / "index.html"
            if index.exists():
                return FileResponse(index)
        return HTMLResponse(
            "<!doctype html><meta charset='utf-8'><title>LogForensics</title>"
            "<body style='font-family:system-ui;padding:48px;max-width:720px'>"
            "<h1>LogForensics API is running</h1>"
            "<p>The frontend has not been built yet. Run "
            "<code>npm install</code> and <code>npm run build</code> in "
            "<code>web/</code>, or use <code>npm run dev</code> for development.</p>"
            "</body>",
            status_code=200,
        )

    return app


app = create_app()


def main() -> None:  # pragma: no cover - thin CLI wrapper
    import uvicorn

    uvicorn.run(
        "logforensics.api.main:app",
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )


if __name__ == "__main__":  # pragma: no cover
    main()
