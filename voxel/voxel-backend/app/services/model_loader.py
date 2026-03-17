"""
ModelLoader — loads and caches all HuggingFace models at startup.
All services pull from this singleton so models are only loaded once.
"""
import logging
from dataclasses import dataclass
from typing import Optional, Any

import torch
from transformers import (
    Wav2Vec2ForCTC,
    Wav2Vec2Processor,
    WhisperForConditionalGeneration,
    WhisperProcessor,
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    VitsModel,
    VitsTokenizer,
    SpeechT5ForTextToSpeech,
    SpeechT5Processor,
    SpeechT5HifiGan,
)

from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class LoadedModel:
    name:   str
    model:  Any
    extra:  Any = None          # processor / tokenizer / (processor, vocoder, embeddings)
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
        """
        Load the English ASR model.
        Detects Whisper vs Wav2Vec2 from the model ID and loads accordingly.
        """
        key      = "asr_en"
        if self._models.get(key, LoadedModel("", None)).loaded:
            return
        model_id  = settings.hf_asr_model_en
        is_whisper = "whisper" in model_id.lower()
        logger.info("Loading English ASR model: %s", model_id)
        try:
            if is_whisper:
                processor = WhisperProcessor.from_pretrained(
                    model_id,
                    cache_dir=settings.model_cache_dir,
                    token=settings.hf_token or None,
                )
                model = WhisperForConditionalGeneration.from_pretrained(
                    model_id,
                    cache_dir=settings.model_cache_dir,
                    token=settings.hf_token or None,
                ).to(self.device)
            else:
                processor = Wav2Vec2Processor.from_pretrained(
                    model_id,
                    cache_dir=settings.model_cache_dir,
                    token=settings.hf_token or None,
                )
                model = Wav2Vec2ForCTC.from_pretrained(
                    model_id,
                    cache_dir=settings.model_cache_dir,
                    token=settings.hf_token or None,
                ).to(self.device)

            model.eval()
            self._models[key] = LoadedModel(
                name=model_id, model=model, extra=processor,
                loaded=True, device=self.device,
            )
            logger.info("✅ English ASR loaded (%s)", "whisper" if is_whisper else "wav2vec2")
        except Exception as e:
            logger.error("❌ Failed to load English ASR: %s", e)
            self._models[key] = LoadedModel(name=model_id, model=None, loaded=False, device="cpu")

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
                name=settings.hf_asr_model_lg, model=model, extra=processor,
                loaded=True, device=self.device,
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
            self._models[key] = LoadedModel(
                name=model_id, model=model, extra=tokenizer, loaded=True, device=self.device
            )
            logger.info("✅ Translation model loaded: %s", model_id)
        except Exception as e:
            logger.error("❌ Failed to load translation model %s: %s", model_id, e)
            self._models[key] = LoadedModel(name=model_id, model=None, loaded=False, device="cpu")

    def load_translate_en_lg(self) -> None:
        self._load_translation("translate_en_lg", settings.hf_translate_en_lg)

    def load_translate_lg_en(self) -> None:
        self._load_translation("translate_lg_en", settings.hf_translate_lg_en)

    # ── TTS — MMS (male / Luganda) ────────────────────────────────────────────

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
            self._models[key] = LoadedModel(
                name=model_id, model=model, extra=tokenizer, loaded=True, device=self.device
            )
            logger.info("✅ TTS model loaded: %s", model_id)
        except Exception as e:
            logger.error("❌ Failed to load TTS model %s: %s", model_id, e)
            self._models[key] = LoadedModel(name=model_id, model=None, loaded=False, device="cpu")

    def load_tts_en(self) -> None:
        self._load_tts("tts_en", settings.hf_tts_en)

    def load_tts_lg(self) -> None:
        self._load_tts("tts_lg", settings.hf_tts_lg)

    # ── TTS — SpeechT5 (female English) ──────────────────────────────────────

    def load_tts_speecht5(self) -> None:
        """
        Load microsoft/speecht5_tts with a female CMU-ARCTIC speaker embedding.
        Stored under key 'tts_en_female'. The 'extra' field is a tuple of
        (processor, vocoder, speaker_embeddings) so the TTS service can unpack
        everything it needs in one call.
        """
        key      = "tts_en_female"
        model_id = "microsoft/speecht5_tts"
        if self._models.get(key, LoadedModel("", None)).loaded:
            return
        logger.info("Loading SpeechT5 female TTS model")
        try:
            from datasets import load_dataset

            processor = SpeechT5Processor.from_pretrained(
                model_id,
                cache_dir=settings.model_cache_dir,
                token=settings.hf_token or None,
            )
            model = SpeechT5ForTextToSpeech.from_pretrained(
                model_id,
                cache_dir=settings.model_cache_dir,
                token=settings.hf_token or None,
            ).to(self.device)
            model.eval()

            vocoder = SpeechT5HifiGan.from_pretrained(
                "microsoft/speecht5_hifigan",
                cache_dir=settings.model_cache_dir,
                token=settings.hf_token or None,
            ).to(self.device)
            vocoder.eval()

            # Speaker embedding — index 7306 is a clear female voice (CLB)
            embeddings_dataset = load_dataset(
                "Matthijs/cmu-arctic-xvectors",
                split="validation",
                cache_dir=settings.model_cache_dir,
            )
            speaker_embeddings = torch.tensor(
                embeddings_dataset[7306]["xvector"]
            ).unsqueeze(0)

            self._models[key] = LoadedModel(
                name   = model_id,
                model  = model,
                extra  = (processor, vocoder, speaker_embeddings),
                loaded = True,
                device = self.device,
            )
            logger.info("✅ SpeechT5 female TTS loaded")
        except Exception as e:
            logger.error("❌ Failed to load SpeechT5: %s", e)
            self._models[key] = LoadedModel(name=model_id, model=None, loaded=False, device="cpu")

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
        """
        Called at app startup — loads translation + TTS models concurrently.
        ASR and SpeechT5 are lazy-loaded on first request.
        """
        import concurrent.futures
        loaders = [
            self.load_translate_en_lg,
            self.load_translate_lg_en,
            self.load_tts_en,
            self.load_tts_lg,
        ]
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(fn) for fn in loaders]
            concurrent.futures.wait(futures)
        logger.info("All models loaded. Statuses: %s", self.all_statuses())


# Global singleton
model_registry = ModelRegistry()