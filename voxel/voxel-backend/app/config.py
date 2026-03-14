from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    app_name:    str = "Voxel API"
    app_version: str = "0.1.0"
    debug:       bool = False
    port:        int  = 8000

    # ── CORS ─────────────────────────────────────────────────────────────────
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "https://voxel.vercel.app",
    ]

    # ── Supabase ─────────────────────────────────────────────────────────────
    supabase_url:         str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret:  str = ""

    # ── HuggingFace ──────────────────────────────────────────────────────────
    hf_token:             str = ""
    model_cache_dir:      str = "/app/models"

    # ASR models
    hf_asr_model_en: str = "facebook/wav2vec2-large-xlsr-53"
    hf_asr_model_lg: str = "facebook/mms-300m"           # Luganda

    # Translation models
    hf_translate_en_lg: str = "Helsinki-NLP/opus-mt-en-lg"
    hf_translate_lg_en: str = "Helsinki-NLP/opus-mt-lg-en"

    # TTS models
    hf_tts_en: str = "facebook/mms-tts-eng"
    hf_tts_lg: str = "facebook/mms-tts-lug"

    # ── OpenAI (text reconstruction LLM) ─────────────────────────────────────
    openai_api_key: str = ""
    llm_model:      str = "gpt-4o-mini"

    # ── Audio limits ─────────────────────────────────────────────────────────
    max_audio_duration_s: int   = 30
    max_audio_size_mb:    float = 10.0
    target_sample_rate:   int   = 16_000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
