"""
ASRService — Stage 2 of the Voice Reconstruction Pipeline.

Runs wav2vec2 (English) or MMS (Luganda) to produce a raw transcript.
The transcript at this stage is imperfect — stutters, gaps, errors — 
which Stage 3 (TextReconstructor) will clean up.
"""
import logging
from dataclasses import dataclass

import numpy as np
import torch

from app.services.model_loader import model_registry
from app.models.schemas import Language, ModelName
from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ASRResult:
    transcript:  str
    language:    str
    confidence:  float
    model_used:  ModelName


class ASRService:

    async def transcribe(
        self,
        audio: np.ndarray,
        language: Language = Language.EN,
    ) -> ASRResult:
        """
        Transcribe preprocessed 16kHz float32 audio.
        Selects the correct model based on language.
        """
        key = "asr_en" if language == Language.EN else "asr_lg"

        if not model_registry.is_loaded(key):
            logger.warning("ASR model %s not loaded — attempting lazy load", key)
            if language == Language.EN:
                model_registry.load_asr_en()
            else:
                model_registry.load_asr_lg()

        loaded = model_registry.get(key)
        if not loaded or not loaded.loaded:
            raise RuntimeError(f"ASR model for language '{language}' is not available")

        model     = loaded.model
        processor = loaded.extra
        device    = loaded.device

        return await self._run_inference(audio, model, processor, device, language)

    async def _run_inference(
        self,
        audio:     np.ndarray,
        model:     any,
        processor: any,
        device:    str,
        language:  Language,
    ) -> ASRResult:
        """Run wav2vec2/MMS inference and return transcript + confidence."""
        import asyncio

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._infer_sync,
            audio, model, processor, device, language,
        )
        return result

    def _infer_sync(
        self,
        audio:     np.ndarray,
        model:     any,
        processor: any,
        device:    str,
        language:  Language,
    ) -> ASRResult:
        """Synchronous inference — runs in thread pool to avoid blocking event loop."""
        try:
            # Tokenise input
            inputs = processor(
                audio,
                sampling_rate=settings.target_sample_rate,
                return_tensors="pt",
                padding=True,
            )
            input_values = inputs.input_values.to(device)

            with torch.no_grad():
                logits = model(input_values).logits

            # Decode predicted ids
            predicted_ids = torch.argmax(logits, dim=-1)
            transcript    = processor.batch_decode(predicted_ids)[0].strip()

            # Estimate confidence from softmax probability of top token
            probs       = torch.softmax(logits, dim=-1)
            max_probs   = probs.max(dim=-1).values
            confidence  = float(max_probs.mean().item())
            confidence  = round(min(max(confidence, 0.0), 1.0), 3)

            model_used = ModelName.WAV2VEC2 if language == Language.EN else ModelName.MMS

            logger.debug("ASR transcript: %r  confidence: %.3f", transcript, confidence)

            return ASRResult(
                transcript = transcript,
                language   = language.value,
                confidence = confidence,
                model_used = model_used,
            )

        except Exception as e:
            logger.error("ASR inference failed: %s", e)
            raise RuntimeError(f"Transcription failed: {e}") from e


# Singleton
asr_service = ASRService()
