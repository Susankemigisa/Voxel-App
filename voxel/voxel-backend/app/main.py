"""
Voxel API — FastAPI application entrypoint.

Startup sequence:
  1. Load all HuggingFace models into the ModelRegistry
  2. Register CORS middleware
  3. Mount all routers
  4. Expose health + model status endpoints
"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.services.model_loader import model_registry
from app.routers import pipeline, asr, tts, translate, auth
from app.models.schemas import HealthResponse, ModelStatus

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt = "%H:%M:%S",
)
logger   = logging.getLogger(__name__)
settings = get_settings()


# ── Lifespan — runs once at startup and shutdown ──────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Voxel API starting — loading models...")
    t0 = time.monotonic()
    model_registry.load_all()
    elapsed = time.monotonic() - t0
    logger.info("✅ All models ready in %.1fs", elapsed)
    yield
    logger.info("🛑 Voxel API shutting down")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = settings.app_name,
    version     = settings.app_version,
    description = "Accessibility-first voice navigation API — English + Luganda",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
    lifespan    = lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

PREFIX = "/api/v1"

app.include_router(pipeline.router, prefix=PREFIX)
app.include_router(asr.router,      prefix=PREFIX)
app.include_router(tts.router,      prefix=PREFIX)
app.include_router(translate.router, prefix=PREFIX)
app.include_router(auth.router,     prefix=PREFIX)


# ── Health + model status ─────────────────────────────────────────────────────

@app.get(f"{PREFIX}/health", response_model=HealthResponse, tags=["meta"])
async def health():
    statuses  = model_registry.all_statuses()
    all_ok    = all(s["loaded"] for s in statuses)
    return HealthResponse(
        status  = "ok" if all_ok else "degraded",
        version = settings.app_version,
        models  = [ModelStatus(**s) for s in statuses],
    )


@app.get(f"{PREFIX}/models/status", tags=["meta"])
async def model_status():
    return {"models": model_registry.all_statuses()}


@app.get("/", tags=["meta"])
async def root():
    return {
        "name":    settings.app_name,
        "version": settings.app_version,
        "docs":    "/docs",
        "health":  f"{PREFIX}/health",
    }


# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code = 500,
        content     = {"detail": "An unexpected error occurred. Please try again."},
    )


# ── Dev runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host    = "0.0.0.0",
        port    = settings.port,
        reload  = settings.debug,
        workers = 1,   # single worker — models are in-process singletons
    )
