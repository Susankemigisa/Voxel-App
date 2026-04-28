"""
ASRService — Stage 2 of the Voice Reconstruction Pipeline.

Uses the HuggingFace Inference API for Whisper ASR.

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

# Raised when Modal returns "app stopped" — always triggers fallback even in modal-only mode
class ModalUnavailableError(RuntimeError):
    pass


@dataclass
class ASRResult:
    transcript:  str
    language:    str
    confidence:  float
    model_used:  ModelName


class ASRService:

    @property
    def INFERENCE_MODELS(self) -> dict:
        return {
            Language.EN: (
                settings.hf_asr_inference_model_en
                or settings.hf_asr_model_en
                or settings.hf_asr_cdli_en
            ),
        }

    def _strategy_for(self, language: Language) -> str:
        if language == Language.EN:
            strategy = (settings.asr_en_strategy or "auto").strip().lower()
            if strategy not in {"auto", "modal", "inference", "local"}:
                logger.warning("Invalid ASR_EN_STRATEGY=%r, defaulting to 'auto'", strategy)
                return "auto"
            return strategy

        strategy = (settings.asr_lg_strategy or "auto").strip().lower()
        if strategy not in {"auto", "modal", "local"}:
            logger.warning("Invalid ASR_LG_STRATEGY=%r, defaulting to 'auto'", strategy)
            return "auto"
        return strategy

    async def transcribe(
        self,
        audio: np.ndarray,
        language: Language = Language.EN,
    ) -> ASRResult:
        """
        Transcribe preprocessed 16 kHz float32 audio.
        Uses config-driven routing:
        - auto: Modal first, then HF inference, then local fallback
        - modal: Modal only
        - inference: HF inference only
        - local: local only
        """
        strategy = self._strategy_for(language)
        model_id = self.INFERENCE_MODELS.get(language)

        # 1) Modal endpoint path
        if strategy in {"auto", "modal"}:
            if settings.asr_modal_url:
                try:
                    return await self._transcribe_modal(audio, language)
                except ModalUnavailableError as e:
                    # Modal app is stopped/cold — ALWAYS fall through to HF/local
                    # regardless of strategy, so the app never returns a 500 to users
                    logger.warning("Modal ASR unavailable (app stopped) — falling back: %s", e)
                except Exception as e:
                    if strategy == "modal":
                        raise RuntimeError(f"Modal ASR failed: {e}") from e
                    logger.warning("Modal ASR failed — trying HF/local fallback: %s", e)
            elif strategy == "modal":
                raise RuntimeError("Modal-only mode requires ASR_MODAL_URL to be set")

        # 2) HF Inference API path
        if strategy in {"auto", "inference"} and model_id and settings.hf_token:
            try:
                return await self._transcribe_inference_api(audio, model_id, language)
            except Exception as e:
                if strategy == "inference":
                    raise RuntimeError(
                        f"Inference-only mode failed for model '{model_id}': {e}"
                    ) from e
                logger.warning(
                    "Inference API failed (%s) — falling back to local model: %s",
                    model_id, e,
                )

        if strategy == "inference" and (not model_id or not settings.hf_token):
            raise RuntimeError(
                "Inference-only mode requires HF token and a configured inference model"
            )

        return await self._transcribe_local(audio, language)

    # ── Modal endpoint ASR ────────────────────────────────────────────────────

    async def _transcribe_modal(
        self,
        audio: np.ndarray,
        language: Language,
    ) -> ASRResult:
        buf = io.BytesIO()
        sf.write(buf, audio, settings.target_sample_rate, format="WAV", subtype="PCM_16")
        wav_bytes = buf.getvalue()

        headers = {}
        if settings.asr_modal_token:
            headers["Authorization"] = f"Bearer {settings.asr_modal_token}"

        files = {
            "wav": ("audio.wav", wav_bytes, "audio/wav"),
        }
        data = {
            "language": language.value if language else "en",
            "use_word_timestamps": "false",
        }

        async with httpx.AsyncClient(timeout=settings.asr_modal_timeout_s) as client:
            response = await client.post(
                settings.asr_modal_url,
                headers=headers,
                files=files,
                data=data,
            )

        if response.status_code == 404:
            body = response.text or ""
            if "app for invoked web endpoint is stopped" in body or "modal-http" in body:
                raise ModalUnavailableError(
                    f"Modal ASR app is stopped (cold) — falling back: {body[:120]}"
                )
            raise ModalUnavailableError(f"Modal ASR endpoint returned 404: {body[:120]}")

        if response.status_code != 200:
            raise RuntimeError(f"Modal endpoint returned {response.status_code}: {response.text}")

        result = response.json()
        transcript = (result.get("transcription") or result.get("text") or "").strip()
        if not transcript:
            raise RuntimeError("Empty transcript from Modal endpoint")

        confidence = 0.95
        confidences = result.get("confidences")
        if isinstance(confidences, list) and confidences:
            try:
                confidence = float(sum(confidences) / len(confidences))
            except Exception:
                confidence = 0.95

        logger.info("Modal Whisper → %r", transcript[:80])
        return ASRResult(
            transcript=transcript,
            language=language.value,
            confidence=max(0.0, min(1.0, confidence)),
            model_used=ModelName.WHISPER,
        )

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

        logger.info("Inference Whisper [%s] → %r", model_id.split("/")[-1], transcript[:80])

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
            try:
                if language == Language.EN:
                    model_registry.load_asr_en()
                else:
                    model_registry.load_asr_lg()
            except Exception as load_err:
                logger.error("Lazy load of ASR model '%s' raised: %s", key, load_err)
                raise RuntimeError(
                    f"Speech recognition failed: ASR model for language '{language}' "
                    f"could not be loaded — {load_err}"
                ) from load_err

        loaded = model_registry.get(key)
        if not loaded or not loaded.loaded:
            raise RuntimeError(
                f"Speech recognition failed: ASR model for language '{language}' is not available. "
                f"Check backend logs for the model load error (OOM / download failure are common causes)."
            )

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