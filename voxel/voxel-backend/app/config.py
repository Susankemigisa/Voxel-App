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
        "http://localhost:3001",
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
    hf_inference_api_url: str = "https://router.huggingface.co/hf-inference/models"

    # ASR runtime strategy (English):
    #   auto      -> try Modal, then HF inference, then local fallback
    #   modal     -> Modal endpoint only
    #   inference -> HF inference API only
    #   local     -> local model only (skip remote inference)
    asr_en_strategy: str = "local"

    # ASR runtime strategy (Luganda):
    #   auto  -> try Modal, then local fallback
    #   modal -> Modal endpoint only
    #   local -> local model only
    asr_lg_strategy: str = "auto"

    # Modal ASR endpoint settings (used when strategy=modal or strategy=auto)
    # Example URL:
    # https://xxxxx--whisper-endpoint-transcriber-transcribe.modal.run
    asr_modal_url: str = ""
    asr_modal_token: str = ""
    asr_modal_timeout_s: float = 90.0

    # ── ASR — CDLI Whisper (Inference API, primary) ───────────────────────────
    # Ugandan English, fine-tuned on non-standard speech
    # Options (trade off size vs accuracy):
    #   cdli/whisper-tiny_finetuned_ugandan_english_nonstandard_speech_v1.0   (37.8M  — fastest)
    #   cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0  (242M   — recommended)
    #   cdli/whisper-large-v3_finetuned_ugandan_english_nonstandard_speech_v1.0 (2B   — most accurate)
    # hf_asr_cdli_en: str = "cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"
    hf_asr_cdli_en: str = "openai/whisper-small"

    # Inference API model for English ASR.
    # Keep separate from local model so you can tune each path independently.
    hf_asr_inference_model_en: str = "openai/whisper-small"

    # ── ASR — local fallback / Luganda ────────────────────────────────────────
    # English: same CDLI Whisper model, loaded locally when API is unavailable
    # Luganda: mms-1b-all supports 1162 languages including Luganda (lug adapter)
    # 
    # Whisper model options:
    #   openai/whisper-tiny       (39MB)  — smallest, fastest
    #   openai/whisper-base       (140MB) — good balance
    #   openai/whisper-small      (242MB) — recommended (DEFAULT)
    #   openai/whisper-medium     (769MB) — better accuracy
    #   openai/whisper-large      (2.9GB) — best accuracy
    # 
    # CDLI models (fine-tuned for Ugandan English):
    #   cdli/whisper-tiny_finetuned_ugandan_english_nonstandard_speech_v1.0
    #   cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0
    #   cdli/whisper-large-v3_finetuned_ugandan_english_nonstandard_speech_v1.0
    # hf_asr_model_en: str = "cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"
    hf_asr_model_en: str = "openai/whisper-small"
    hf_asr_model_lg: str = "facebook/mms-1b-all"
    
    # Alternative Whisper models for fallback or testing
    hf_asr_model_en_alt: str = "openai/whisper-base"  # Fallback if small fails

    # ── Translation models ────────────────────────────────────────────────────
    hf_translate_en_lg: str = "Helsinki-NLP/opus-mt-en-lg"
    hf_translate_lg_en: str = "Helsinki-NLP/opus-mt-lg-en"

    # Translation runtime strategy:
    #   auto  -> try Modal endpoint first, then local fallback
    #   modal -> Modal endpoint only
    #   local -> local model only
    translate_strategy: str = "local"
    translate_modal_en_lg_url: str = ""
    translate_modal_lg_en_url: str = ""
    translate_modal_token: str = ""
    translate_modal_timeout_s: float = 45.0

    # ── TTS models ────────────────────────────────────────────────────────────
    hf_tts_en: str = "facebook/mms-tts-eng"
    hf_tts_lg: str = "facebook/mms-tts-lug"

    # TTS runtime strategy:
    #   auto  -> try Modal endpoint first, then local fallback
    #   modal -> Modal endpoint only
    #   local -> local model only
    tts_strategy: str = "local"
    tts_modal_url: str = ""
    tts_modal_token: str = ""
    tts_modal_timeout_s: float = 90.0

    # ── Audio limits ──────────────────────────────────────────────────────────
    max_audio_duration_s: int   = 30
    max_audio_size_mb:    float = 10.0

    target_sample_rate:   int   = 16_000

    # ── Navigation intent extraction ─────────────────────────────────────────
    # Strategy values:
    #   auto  -> try Modal endpoint first, then local fallback
    #   modal -> Modal endpoint only
    #   local -> local rule-based extraction only
    navigation_intent_strategy: str = "local"
    navigation_modal_url: str = ""
    navigation_modal_token: str = ""
    navigation_modal_timeout_s: float = 45.0

    # ── Generated audio storage ─────────────────────────────────────────────
    tts_audio_bucket: str = "tts-audio"
    tts_audio_signed_url_expires_s: int = 3600

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()