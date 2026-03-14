"""
download_models.py — Pre-download all HuggingFace models to the persistent volume.

Run once after deploying to Railway to populate the /app/models volume:
    python scripts/download_models.py

Subsequent container restarts will load from cache instantly.
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings

settings = get_settings()
cache    = settings.model_cache_dir
token    = settings.hf_token or None

os.makedirs(cache, exist_ok=True)
logger.info("Downloading models to: %s", cache)


def download(model_id: str, cls_name: str, extra_cls: str | None = None):
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, Wav2Vec2Processor, Wav2Vec2ForCTC, VitsModel, VitsTokenizer
    mapping = {
        "Wav2Vec2Processor":      Wav2Vec2Processor,
        "Wav2Vec2ForCTC":         Wav2Vec2ForCTC,
        "AutoTokenizer":          AutoTokenizer,
        "AutoModelForSeq2SeqLM":  AutoModelForSeq2SeqLM,
        "VitsModel":              VitsModel,
        "VitsTokenizer":          VitsTokenizer,
    }
    try:
        if extra_cls:
            logger.info("  Downloading %s (%s + %s)...", model_id, cls_name, extra_cls)
            mapping[extra_cls].from_pretrained(model_id, cache_dir=cache, token=token)
        else:
            logger.info("  Downloading %s (%s)...", model_id, cls_name)
        mapping[cls_name].from_pretrained(model_id, cache_dir=cache, token=token)
        logger.info("  ✅ %s", model_id)
    except Exception as e:
        logger.error("  ❌ Failed: %s — %s", model_id, e)


MODELS = [
    # ASR
    (settings.hf_asr_model_en, "Wav2Vec2ForCTC",        "Wav2Vec2Processor"),
    (settings.hf_asr_model_lg, "Wav2Vec2ForCTC",        "Wav2Vec2Processor"),
    # Translation
    (settings.hf_translate_en_lg, "AutoModelForSeq2SeqLM", "AutoTokenizer"),
    (settings.hf_translate_lg_en, "AutoModelForSeq2SeqLM", "AutoTokenizer"),
    # TTS
    (settings.hf_tts_en, "VitsModel", "VitsTokenizer"),
    (settings.hf_tts_lg, "VitsModel", "VitsTokenizer"),
]

if __name__ == "__main__":
    logger.info("Starting model downloads (%d models)...", len(MODELS))
    for args in MODELS:
        download(*args)
    logger.info("Done.")
