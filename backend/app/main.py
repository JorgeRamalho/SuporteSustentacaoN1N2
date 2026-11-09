"""API Sentinela."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.bootstrap import bootstrap
from app.config import get_settings
from app.errors import ProviderError, SentinelaError
from app.auth_routes import router as auth_router
from app.routes import public_router, router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    bootstrap()
    yield


app = FastAPI(
    title="Sentinela",
    summary="Sustentação N1/N2: logs, incidentes, SLA e automação em modo seguro.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8088",
        "http://localhost:8088",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5502",
        "http://localhost:5502",
        "http://127.0.0.1:8010",
        "http://localhost:8010",
        "https://suportesustentacaon1n2.vercel.app",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://[\w.-]+\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(public_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(router, prefix="/api")

_assets = get_settings().root / "frontend" / "dist" / "assets"
if _assets.is_dir():
    app.mount("/assets", StaticFiles(directory=_assets), name="console-assets")


@app.get("/", include_in_schema=False)
def root():
    index = get_settings().root / "frontend" / "dist" / "index.html"
    if index.is_file():
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
    return {"app": "Sentinela", "docs": "/docs", "health": "/api/health"}


@app.exception_handler(SentinelaError)
async def handle_domain(_request, exc: SentinelaError):
    status = 502 if isinstance(exc, ProviderError) else 400
    return JSONResponse(status_code=status, content={"detail": str(exc)})
