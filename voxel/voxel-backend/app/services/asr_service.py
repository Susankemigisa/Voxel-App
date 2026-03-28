"""
ASRService — Stage 2 of the Voice Reconstruction Pipeline.

Uses the HuggingFace Inference API to run CDLI Whisper models
fine-tuned on Ugandan English non-standard speech.

Falls back to the local Whisper model if the Inference API
is unavailable or not configured.
"""
import asyncio
import logging
from dataclasses import dataclass
from packaging import version

import httpx
import numpy as np
import soundfile as sf
import io
import transformers

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

    @property
    def CDLI_MODELS(self) -> dict:
        return {
            Language.EN: settings.hf_asr_cdli_en,
        }

    async def transcribe(
        self,
        audio: np.ndarray,
        language: Language = Language.EN,
    ) -> ASRResult:
        """
        Transcribe preprocessed 16 kHz float32 audio.
        Tries the HuggingFace Inference API first (CDLI Whisper),
        then falls back to local Whisper model if that fails.
        """
        model_id = self.CDLI_MODELS.get(language)

        if model_id and settings.hf_token:
            try:
                return await self._transcribe_inference_api(audio, model_id, language)
            except Exception as e:
                logger.warning(
                    "Inference API failed (%s) — falling back to local model: %s",
                    model_id, e,
                )

        return await self._transcribe_local(audio, language)

    # ── HuggingFace Inference API ─────────────────────────────────────────────

    async def _transcribe_inference_api(
        self,
        audio:    np.ndarray,
        model_id: str,
        language: Language,
    ) -> ASRResult:
        buf = io.BytesIO()
        sf.write(buf, audio, settings.target_sample_rate, format="WAV", subtype="PCM_16")
        wav_bytes = buf.getvalue()

        url     = f"{settings.hf_inference_api_url}/{model_id}"
        headers = {
            "Authorization": f"Bearer {settings.hf_token}",
            "Content-Type":  "audio/wav",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, content=wav_bytes)

        if response.status_code == 503:
            logger.info("HF model loading (503) — retrying in 20s…")
            await asyncio.sleep(20)
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, content=wav_bytes)

        if response.status_code == 404:
            raise RuntimeError(
                f"Model not found on HF Inference API ({model_id}). "
                "Check the model ID or that the model supports serverless inference."
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"HF Inference API returned {response.status_code}: {response.text}"
            )

        result     = response.json()
        transcript = result.get("text", "").strip()
        if not transcript:
            raise RuntimeError("Empty transcript from Inference API")

        logger.info("CDLI Whisper [%s] → %r", model_id.split("/")[-1], transcript[:80])

        return ASRResult(
            transcript = transcript,
            language   = language.value,
            confidence = 0.95,
            model_used = ModelName.WHISPER,
        )

    # ── Local fallback ────────────────────────────────────────────────────────

    async def _transcribe_local(
        self,
        audio:    np.ndarray,
        language: Language,
    ) -> ASRResult:
        from app.services.model_loader import model_registry

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

        from transformers import WhisperForConditionalGeneration
        is_whisper = isinstance(model, WhisperForConditionalGeneration)

        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._infer_whisper_sync if is_whisper else self._infer_wav2vec2_sync,
            audio, model, processor, device, language,
        )
        return result

    # ── Whisper inference ─────────────────────────────────────────────────────

    def _infer_whisper_sync(
        self,
        audio:     np.ndarray,
        model,
        processor,
        device:    str,
        language:  Language,
    ) -> ASRResult:
        import torch

        try:
            inputs = processor(
                audio,
                sampling_rate  = settings.target_sample_rate,
                return_tensors = "pt",
            )
            input_features = inputs.input_features.to(device)

            with torch.no_grad():
                # Handle both old and new Whisper model versions
                # New versions (4.35+) have logits processor conflicts with forced_decoder_ids
                transformers_version = version.parse(transformers.__version__)
                
                if transformers_version >= version.parse("4.35.0"):
                    # Newer transformers: use language and task without forced_decoder_ids
                    # to avoid ForceTokensLogitsProcessor conflicts
                    try:
                        predicted_ids = model.generate(
                            input_features,
                            language   = "english",
                            task       = "transcribe",
                            no_speech_threshold      = 0.6,
                            logprob_threshold        = -1.0,
                            compression_ratio_threshold = 2.4,
                            condition_on_prev_tokens = False,
                        )
                    except Exception as e:
                        logger.warning("New Whisper API failed, trying legacy approach: %s", e)
                        # Fallback to legacy approach if new API fails
                        predicted_ids = self._infer_whisper_legacy(
                            input_features, model, processor, device
                        )
                else:
                    # Older transformers: use forced_decoder_ids approach
                    predicted_ids = self._infer_whisper_legacy(
                        input_features, model, processor, device
                    )

            transcript = processor.batch_decode(
                predicted_ids, skip_special_tokens=True
            )[0].strip()

            # Extra guard: if Whisper returns nothing meaningful, say so clearly
            if not transcript:
                logger.warning("Whisper returned empty transcript — audio may be too short or silent")
                raise RuntimeError("No speech detected in audio")

            logger.info("Local Whisper → %r", transcript)

            return ASRResult(
                transcript = transcript,
                language   = language.value,
                confidence = 0.92,
                model_used = ModelName.WHISPER,
            )

        except RuntimeError:
            raise
        except Exception as e:
            logger.error("Local Whisper inference failed: %s", e)
            raise RuntimeError(f"Transcription failed: {e}") from e

    def _infer_whisper_legacy(
        self, input_features, model, processor, device
    ):
        """
        Legacy Whisper inference using forced_decoder_ids.
        Used for transformers < 4.35.0 or as fallback.
        """
        import torch
        
        forced_ids = processor.get_decoder_prompt_ids(
            language="english", task="transcribe"
        )
        return model.generate(
            input_features,
            forced_decoder_ids  = forced_ids,
            no_speech_threshold      = 0.6,
            logprob_threshold        = -1.0,
            compression_ratio_threshold = 2.4,
            condition_on_prev_tokens = False,
        )

    # ── Wav2Vec2 / MMS inference (Luganda) ────────────────────────────────────

    def _infer_wav2vec2_sync(
        self,
        audio:     np.ndarray,
        model,
        processor,
        device:    str,
        language:  Language,
    ) -> ASRResult:
        import torch

        try:
            inputs = processor(
                audio,
                sampling_rate  = settings.target_sample_rate,
                return_tensors = "pt",
                padding        = True,
            )
            input_values = inputs.input_values.to(device)

            with torch.no_grad():
                logits = model(input_values).logits

            predicted_ids = torch.argmax(logits, dim=-1)
            transcript    = processor.batch_decode(predicted_ids)[0].strip()

            probs      = torch.softmax(logits, dim=-1)
            confidence = float(probs.max(dim=-1).values.mean().item())
            confidence = round(min(max(confidence, 0.0), 1.0), 3)

            model_used = ModelName.WAV2VEC2 if language == Language.EN else ModelName.MMS
            logger.info("Local wav2vec2/MMS → %r  confidence: %.3f", transcript, confidence)

            return ASRResult(
                transcript = transcript,
                language   = language.value,
                confidence = confidence,
                model_used = model_used,
            )

        except Exception as e:
            logger.error("Local wav2vec2 inference failed: %s", e)
            raise RuntimeError(f"Transcription failed: {e}") from e


# Singleton
asr_service = ASRService()