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

    # Inference API base URL — standard HF endpoint (router URL caused 404s)
    hf_inference_api_url: str = "https://api-inference.huggingface.co/models"

    # ── ASR — CDLI Whisper (Inference API, primary) ───────────────────────────
    # Ugandan English, fine-tuned on non-standard speech
    # Options (trade off size vs accuracy):
    #   cdli/whisper-tiny_finetuned_ugandan_english_nonstandard_speech_v1.0   (37.8M  — fastest)
    #   cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0  (242M   — recommended)
    #   cdli/whisper-large-v3_finetuned_ugandan_english_nonstandard_speech_v1.0 (2B   — most accurate)
    hf_asr_cdli_en: str = "cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"

    # ── ASR — local fallback models ───────────────────────────────────────────
    # Points at the same CDLI Whisper model so the local fallback is also
    # Ugandan-English-aware. model_loader.py detects "whisper" in the name
    # and uses WhisperForConditionalGeneration automatically.
    hf_asr_model_en: str = "cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"
    hf_asr_model_lg: str = "facebook/mms-300m"           # Luganda

    # ── Translation models ────────────────────────────────────────────────────
    hf_translate_en_lg: str = "Helsinki-NLP/opus-mt-en-lg"
    hf_translate_lg_en: str = "Helsinki-NLP/opus-mt-lg-en"

    # ── TTS models ────────────────────────────────────────────────────────────
    hf_tts_en: str = "facebook/mms-tts-eng"
    hf_tts_lg: str = "facebook/mms-tts-lug"

    # ── Audio limits ──────────────────────────────────────────────────────────
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