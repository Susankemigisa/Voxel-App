"""
TTSService — Stage 5 of the Voice Reconstruction Pipeline.

Synthesises clean text → speech audio.

Voice routing:
  FEMALE → microsoft/speecht5_tts  (female speaker embedding, natural)
  MALE   → facebook/mms-tts-eng    (MMS single-speaker male)
  ROBOT  → facebook/mms-tts-eng    (MMS with pitch shift down)

Returns base64-encoded WAV bytes for streaming to the frontend.
"""
import base64
import io
import logging
import asyncio
from dataclasses import dataclass

import numpy as np
import soundfile as sf
import torch
import httpx

from app.services.model_loader import model_registry
from app.models.schemas import Language, VoiceGender
from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class TTSResult:
    audio_base64: str
    duration_ms:  int
    sample_rate:  int
    voice:        str
    text:         str


class TTSService:

    def _strategy(self) -> str:
        strategy = (settings.tts_strategy or "local").strip().lower()
        if strategy not in {"auto", "modal", "local"}:
            logger.warning("Invalid TTS_STRATEGY=%r, defaulting to 'local'", strategy)
            return "local"
        return strategy

    async def synthesize(
        self,
        text:     str,
        language: Language     = Language.EN,
        voice:    VoiceGender  = VoiceGender.FEMALE,
        pitch:    float        = 0.5,   # 0.0–1.0
        rate:     float        = 1.0,   # speaking rate — 1.0 = natural speed
    ) -> TTSResult:
        """Convert text to speech and return base64 WAV audio."""

        strategy = self._strategy()

        if strategy in {"auto", "modal"}:
            if settings.tts_modal_url:
                try:
                    return await self._synth_modal(text, language, voice, pitch, rate)
                except Exception as e:
                    if strategy == "modal":
                        raise RuntimeError(f"Modal TTS failed: {e}") from e
                    logger.warning("Modal TTS failed — falling back to local: %s", e)
            elif strategy == "modal":
                raise RuntimeError("Modal TTS mode requires TTS_MODAL_URL to be set")

        return await self._synthesize_local(text, language, voice, pitch, rate)

    async def _synthesize_local(
        self,
        text:     str,
        language: Language,
        voice:    VoiceGender,
        pitch:    float,
        rate:     float,
    ) -> TTSResult:
        """Local synthesis using loaded backend models."""

        # Female English voice uses SpeechT5; everything else uses MMS
        use_speecht5 = (voice == VoiceGender.FEMALE and language == Language.EN)

        if use_speecht5:
            if not model_registry.is_loaded("tts_en_female"):
                model_registry.load_tts_speecht5()
            loaded = model_registry.get("tts_en_female")
            if not loaded or not loaded.loaded:
                logger.warning("SpeechT5 not available — falling back to MMS")
                use_speecht5 = False

        if not use_speecht5:
            key = "tts_en" if language == Language.EN else "tts_lg"
            if not model_registry.is_loaded(key):
                if language == Language.EN:
                    model_registry.load_tts_en()
                else:
                    model_registry.load_tts_lg()
            loaded = model_registry.get(key)
            if not loaded or not loaded.loaded:
                raise RuntimeError(f"TTS model for '{language}' not available")

        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._synth_speecht5_sync if use_speecht5 else self._synth_mms_sync,
            text, loaded.model, loaded.extra, loaded.device,
            language, voice, pitch, rate,
        )
        return result

    async def _synth_modal(
        self,
        text: str,
        language: Language,
        voice: VoiceGender,
        pitch: float,
        rate: float,
    ) -> TTSResult:
        headers = {"Content-Type": "application/json"}
        if settings.tts_modal_token:
            headers["Authorization"] = f"Bearer {settings.tts_modal_token}"

        payload = {
            "text": text,
            "language": language.value,
            "voice": voice.value,
            "pitch": pitch,
            "rate": rate,
        }

        async with httpx.AsyncClient(timeout=settings.tts_modal_timeout_s) as client:
            response = await client.post(settings.tts_modal_url, json=payload, headers=headers)

        if response.status_code != 200:
            raise RuntimeError(f"Modal endpoint returned {response.status_code}: {response.text}")

        result = response.json()
        audio_base64 = result.get("audio_base64")
        if not audio_base64:
            raise RuntimeError("Empty audio_base64 from Modal TTS endpoint")

        return TTSResult(
            audio_base64=audio_base64,
            duration_ms=int(result.get("duration_ms", 0)),
            sample_rate=int(result.get("sample_rate", 16000)),
            voice=str(result.get("voice", voice.value)),
            text=str(result.get("text", text)),
        )

    # ── SpeechT5 (female English) ─────────────────────────────────────────────

    def _synth_speecht5_sync(
        self,
        text:      str,
        model,
        processor_and_vocoder: tuple,   # (processor, vocoder, speaker_embeddings)
        device:    str,
        language:  Language,
        voice:     VoiceGender,
        pitch:     float,
        rate:      float,
    ) -> TTSResult:
        try:
            processor, vocoder, speaker_embeddings = processor_and_vocoder

            inputs = processor(text=text, return_tensors="pt").to(device)
            spk_emb = speaker_embeddings.to(device)

            with torch.no_grad():
                speech = model.generate_speech(
                    inputs["input_ids"], spk_emb, vocoder=vocoder
                )

            waveform    = speech.cpu().numpy()
            sample_rate = 16000  # SpeechT5 output is always 16kHz

            waveform = self._apply_rate_and_pitch(waveform, sample_rate, rate, pitch)

            return self._encode(waveform, sample_rate, voice.value, text)

        except Exception as e:
            logger.error("SpeechT5 synthesis failed: %s", e)
            raise RuntimeError(f"TTS failed: {e}") from e

    # ── MMS-TTS (male / Luganda / robot) ──────────────────────────────────────

    def _synth_mms_sync(
        self,
        text:      str,
        model,
        tokenizer,
        device:    str,
        language:  Language,
        voice:     VoiceGender,
        pitch:     float,
        rate:      float,
    ) -> TTSResult:
        try:
            inputs = tokenizer(text, return_tensors="pt").to(device)

            with torch.no_grad():
                output = model(**inputs)

            waveform    = output.waveform[0].cpu().numpy()
            sample_rate = model.config.sampling_rate  # typically 16000

            # Robot voice: pitch down
            if voice == VoiceGender.ROBOT:
                pitch = max(0.0, pitch - 0.25)

            waveform = self._apply_rate_and_pitch(waveform, sample_rate, rate, pitch)

            return self._encode(waveform, sample_rate, voice.value, text)

        except Exception as e:
            logger.error("MMS-TTS synthesis failed: %s", e)
            raise RuntimeError(f"TTS failed: {e}") from e

    # ── Shared helpers ────────────────────────────────────────────────────────

    def _apply_rate_and_pitch(
        self,
        waveform:    np.ndarray,
        sample_rate: int,
        rate:        float,
        pitch:       float,
    ) -> np.ndarray:
        """Apply speaking rate and pitch adjustments via librosa."""
        try:
            import librosa
            waveform = waveform.astype(np.float32)

            # Pitch shift: 0.5 = no change, range maps to ±6 semitones
            if abs(pitch - 0.5) > 0.05:
                n_steps  = (pitch - 0.5) * 12
                waveform = librosa.effects.pitch_shift(
                    waveform, sr=sample_rate, n_steps=n_steps
                )

            # Time stretch: 1.0 = natural speed
            if abs(rate - 1.0) > 0.05:
                waveform = librosa.effects.time_stretch(
                    waveform, rate=rate
                )
        except Exception as e:
            logger.warning("Rate/pitch adjustment failed (skipping): %s", e)

        return waveform

    def _encode(
        self,
        waveform:    np.ndarray,
        sample_rate: int,
        voice:       str,
        text:        str,
    ) -> TTSResult:
        buf = io.BytesIO()
        sf.write(buf, waveform, sample_rate, format="WAV", subtype="PCM_16")
        buf.seek(0)
        wav_bytes   = buf.read()
        audio_b64   = base64.b64encode(wav_bytes).decode("utf-8")
        duration_ms = int(len(waveform) / sample_rate * 1000)

        return TTSResult(
            audio_base64 = audio_b64,
            duration_ms  = duration_ms,
            sample_rate  = sample_rate,
            voice        = voice,
            text         = text,
        )


# Singleton
tts_service = TTSService()