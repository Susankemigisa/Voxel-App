"""
ModelLoader — loads and caches all HuggingFace models at startup.
All services pull from this singleton so models are only loaded once.
"""
import logging
import os
from dataclasses import dataclass, field
from typing import Optional, Any

import torch
from transformers import (
    Wav2Vec2ForCTC,
    Wav2Vec2Processor,
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    VitsModel,
    VitsTokenizer,
)

from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class LoadedModel:
    name:   str
    model:  Any
    extra:  Any = None          # processor / tokenizer
    loaded: bool = False
    device: str = "cpu"


class ModelRegistry:
    """Singleton holding all loaded models."""

    def __init__(self):
        self._models: dict[str, LoadedModel] = {}
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("ModelRegistry initialised on device: %s", self.device)

    # ── ASR ──────────────────────────────────────────────────────────────────

    def load_asr_en(self) -> None:
        key = "asr_en"
        if self._models.get(key, LoadedModel("", None)).loaded:
            return
        logger.info("Loading English ASR model: %s", settings.hf_asr_model_en)
        try:
            processor = Wav2Vec2Processor.from_pretrained(
                settings.hf_asr_model_en,
                cache_dir=settings.model_cache_dir,
                token=settings.hf_token or None,
            )
            model = Wav2Vec2ForCTC.from_pretrained(
                settings.hf_asr_model_en,
                cache_dir=settings.model_cache_dir,
                token=settings.hf_token or None,
            ).to(self.device)
            model.eval()
            self._models[key] = LoadedModel(
                name=settings.hf_asr_model_en,
                model=model,
                extra=processor,
                loaded=True,
                device=self.device,
            )
            logger.info("✅ English ASR loaded")
        except Exception as e:
            logger.error("❌ Failed to load English ASR: %s", e)
            self._models[key] = LoadedModel(name=settings.hf_asr_model_en, model=None, loaded=False, device="cpu")

    def load_asr_lg(self) -> None:
        key = "asr_lg"
        if self._models.get(key, LoadedModel("", None)).loaded:
            return
        logger.info("Loading Luganda ASR model: %s", settings.hf_asr_model_lg)
        try:
            processor = Wav2Vec2Processor.from_pretrained(
                settings.hf_asr_model_lg,
                cache_dir=settings.model_cache_dir,
                token=settings.hf_token or None,
            )
            model = Wav2Vec2ForCTC.from_pretrained(
                settings.hf_asr_model_lg,
                cache_dir=settings.model_cache_dir,
                token=settings.hf_token or None,
            ).to(self.device)
            model.eval()
            self._models[key] = LoadedModel(
                name=settings.hf_asr_model_lg,
                model=model,
                extra=processor,
                loaded=True,
                device=self.device,
            )
            logger.info("✅ Luganda ASR loaded")
        except Exception as e:
            logger.error("❌ Failed to load Luganda ASR: %s", e)
            self._models[key] = LoadedModel(name=settings.hf_asr_model_lg, model=None, loaded=False, device="cpu")

    # ── Translation ───────────────────────────────────────────────────────────

    def _load_translation(self, key: str, model_id: str) -> None:
        if self._models.get(key, LoadedModel("", None)).loaded:
            return
        logger.info("Loading translation model: %s", model_id)
        try:
            tokenizer = AutoTokenizer.from_pretrained(
                model_id, cache_dir=settings.model_cache_dir, token=settings.hf_token or None
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_id, cache_dir=settings.model_cache_dir, token=settings.hf_token or None
            ).to(self.device)
            model.eval()
            self._models[key] = LoadedModel(name=model_id, model=model, extra=tokenizer, loaded=True, device=self.device)
            logger.info("✅ Translation model loaded: %s", model_id)
        except Exception as e:
            logger.error("❌ Failed to load translation model %s: %s", model_id, e)
            self._models[key] = LoadedModel(name=model_id, model=None, loaded=False, device="cpu")

    def load_translate_en_lg(self) -> None:
        self._load_translation("translate_en_lg", settings.hf_translate_en_lg)

    def load_translate_lg_en(self) -> None:
        self._load_translation("translate_lg_en", settings.hf_translate_lg_en)

    # ── TTS ───────────────────────────────────────────────────────────────────

    def _load_tts(self, key: str, model_id: str) -> None:
        if self._models.get(key, LoadedModel("", None)).loaded:
            return
        logger.info("Loading TTS model: %s", model_id)
        try:
            tokenizer = VitsTokenizer.from_pretrained(
                model_id, cache_dir=settings.model_cache_dir, token=settings.hf_token or None
            )
            model = VitsModel.from_pretrained(
                model_id, cache_dir=settings.model_cache_dir, token=settings.hf_token or None
            ).to(self.device)
            model.eval()
            self._models[key] = LoadedModel(name=model_id, model=model, extra=tokenizer, loaded=True, device=self.device)
            logger.info("✅ TTS model loaded: %s", model_id)
        except Exception as e:
            logger.error("❌ Failed to load TTS model %s: %s", model_id, e)
            self._models[key] = LoadedModel(name=model_id, model=None, loaded=False, device="cpu")

    def load_tts_en(self) -> None:
        self._load_tts("tts_en", settings.hf_tts_en)

    def load_tts_lg(self) -> None:
        self._load_tts("tts_lg", settings.hf_tts_lg)

    # ── Getters ───────────────────────────────────────────────────────────────

    def get(self, key: str) -> Optional[LoadedModel]:
        return self._models.get(key)

    def is_loaded(self, key: str) -> bool:
        m = self._models.get(key)
        return m is not None and m.loaded

    def all_statuses(self) -> list[dict]:
        return [
            {"name": m.name, "loaded": m.loaded, "device": m.device}
            for m in self._models.values()
        ]

    def load_all(self) -> None:
        """Called at app startup — loads all models concurrently."""
        import concurrent.futures
        loaders = [
            self.load_asr_en,
            self.load_asr_lg,
            self.load_translate_en_lg,
            self.load_translate_lg_en,
            self.load_tts_en,
            self.load_tts_lg,
        ]
        # Load in thread pool so startup doesn't block the event loop
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(fn) for fn in loaders]
            concurrent.futures.wait(futures)
        logger.info("All models loaded. Statuses: %s", self.all_statuses())


# Global singleton
model_registry = ModelRegistry()
