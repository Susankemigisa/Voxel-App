"""
TTSService — Stage 5 of the Voice Reconstruction Pipeline.

Synthesises clean text → speech audio using MMS-TTS (facebook/mms-tts-eng / lug).
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

    async def synthesize(
        self,
        text:     str,
        language: Language     = Language.EN,
        voice:    VoiceGender  = VoiceGender.FEMALE,
        pitch:    float        = 0.5,   # 0.0–1.0
        rate:     float        = 0.6,   # speaking rate
    ) -> TTSResult:
        """Convert text to speech and return base64 WAV audio."""
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
            self._synthesize_sync,
            text, loaded.model, loaded.extra, loaded.device,
            language, voice, pitch, rate,
        )
        return result

    def _synthesize_sync(
        self,
        text:      str,
        model:     any,
        tokenizer: any,
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

            # MMS-TTS returns waveform in output.waveform
            waveform    = output.waveform[0].cpu().numpy()
            sample_rate = model.config.sampling_rate   # typically 16000

            # Apply pitch shift (semitones)
            if abs(pitch - 0.5) > 0.05:
                import librosa
                n_steps    = (pitch - 0.5) * 12   # ±6 semitones
                waveform   = librosa.effects.pitch_shift(
                    waveform.astype(np.float32), sr=sample_rate, n_steps=n_steps
                )

            # Apply speaking rate (time stretch)
            if abs(rate - 1.0) > 0.05:
                import librosa
                waveform = librosa.effects.time_stretch(
                    waveform.astype(np.float32), rate=rate
                )

            # Encode to WAV bytes → base64
            buf = io.BytesIO()
            sf.write(buf, waveform, sample_rate, format="WAV", subtype="PCM_16")
            buf.seek(0)
            wav_bytes    = buf.read()
            audio_b64    = base64.b64encode(wav_bytes).decode("utf-8")
            duration_ms  = int(len(waveform) / sample_rate * 1000)

            return TTSResult(
                audio_base64 = audio_b64,
                duration_ms  = duration_ms,
                sample_rate  = sample_rate,
                voice        = voice.value,
                text         = text,
            )

        except Exception as e:
            logger.error("TTS synthesis failed: %s", e)
            raise RuntimeError(f"TTS failed: {e}") from e


# Singleton
tts_service = TTSService()
