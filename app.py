"""Launch the LogForensics local web console.

Usage:
    python app.py

The React frontend is served from ``web/dist`` by the FastAPI application on
``http://127.0.0.1:8000``. Build the frontend first with:

    cd web
    npm install
    npm run build
"""

from __future__ import annotations

import os

import uvicorn

from logforensics.api.main import app

if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.environ.get("LOGFORENSICS_HOST", "127.0.0.1"),
        port=int(os.environ.get("LOGFORENSICS_PORT", "8000")),
        log_level="info",
    )
