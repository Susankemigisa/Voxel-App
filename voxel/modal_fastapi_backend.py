"""
Deploy Voxel FastAPI backend on Modal and expose a public HTTPS URL.

Usage from repository root:
  pip install modal
  modal token new
  modal deploy voxel/modal_fastapi_backend.py

After deploy, Modal prints the public URL.
Health check endpoint:
  https://<your-modal-url>/api/v1/health

Required Modal secret:
  voxel-backend-env
Include backend environment variables from voxel/voxel-backend/.env.
"""

import sys

import modal

APP_NAME    = "voxel-fastapi-backend"
SECRET_NAME = "voxel-backend-env"

LOCAL_BACKEND_DIR  = "voxel-backend"
LOCAL_REQUIREMENTS = "voxel-backend/requirements.txt"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",
        "libsndfile1",
        "libsndfile1-dev",
        "build-essential",
        "git",
        "curl",
    )
    .pip_install_from_requirements(LOCAL_REQUIREMENTS)
    .env(
        {
            "HF_HOME":                  "/app/models",
            "TRANSFORMERS_CACHE":       "/app/models",
            "TOKENIZERS_PARALLELISM":   "false",
            "PYTHONUNBUFFERED":         "1",
            "PYTHONDONTWRITEBYTECODE":  "1",
            # ── Force fallback-safe strategies ────────────────────────────────
            # "auto" means: try Modal endpoint first, but if it returns
            # 404 "app stopped" (cold start), fall through to HF Inference
            # API then local model — so the app NEVER returns a 500 to users
            # just because a sub-endpoint is sleeping.
            "ASR_EN_STRATEGY":          "auto",
            "ASR_LG_STRATEGY":          "auto",
            "TTS_STRATEGY":             "auto",
            "TRANSLATE_STRATEGY":       "auto",
            "NAVIGATION_INTENT_STRATEGY": "auto",
        }
    )
    .add_local_dir(LOCAL_BACKEND_DIR, remote_path="/root/backend")
)

model_cache = modal.Volume.from_name("voxel-model-cache", create_if_missing=True)

app = modal.App(APP_NAME)


@app.function(
    image=image,
    volumes={"/app/models": model_cache},
    secrets=[modal.Secret.from_name(SECRET_NAME)],
    timeout=3600,
    # Keep the container warm for 5 minutes after last request so cold-starts
    # are rare — users won't hit the "app stopped" fallback in normal usage.
    scaledown_window=60 * 5,
)
@modal.asgi_app()
def fastapi_app():
    # Make backend package importable as `app.*`
    if "/root/backend" not in sys.path:
        sys.path.insert(0, "/root/backend")

    from app.main import app as fastapi

    return fastapi
