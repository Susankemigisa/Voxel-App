# ── Build stage ───────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System deps: ffmpeg (audio decoding), libsndfile (soundfile), build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── App stage ─────────────────────────────────────────────────────────────────
FROM base AS app

WORKDIR /app

# Model cache — Railway persistent volume mounts here
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV TOKENIZERS_PARALLELISM=false
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

# Pre-download models at build time (optional — Railway volume caches them)
# ARG HF_TOKEN
# RUN python scripts/download_models.py

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
