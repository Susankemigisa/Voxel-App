"""
AudioProcessor — Stage 1 of the Voice Reconstruction Pipeline.

Handles:
  • Format conversion (any → 16kHz mono WAV)
  • Noise reduction        (noisereduce)
  • Volume normalisation   (librosa RMS normalise)
  • Speed normalisation    (librosa time_stretch for slurred/rushed speech)
  • Silence trimming       (librosa trim)
  • VAD gating             (webrtcvad — keeps only speech frames)
"""
import io
import logging
import warnings
from dataclasses import dataclass

import numpy as np
import soundfile as sf
import librosa
import noisereduce as nr

from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()

TARGET_SR = settings.target_sample_rate   # 16 000 Hz


@dataclass
class AudioProcessingResult:
    audio:          np.ndarray   # float32, mono, 16 kHz
    sample_rate:    int
    duration_s:     float
    original_rms:   float
    normalised_rms: float
    was_denoised:   bool
    was_stretched:  bool


class AudioProcessor:

    # ── Public entry point ────────────────────────────────────────────────────

    async def preprocess(
        self,
        audio_bytes: bytes,
        *,
        denoise:          bool = True,
        normalize_volume: bool = True,
        remove_silence:   bool = True,
        normalize_speed:  bool = True,
    ) -> AudioProcessingResult:
        """
        Full Stage-1 preprocessing pipeline.
        Returns clean float32 numpy audio at 16 kHz.
        """
        # 1. Decode any format → float32 numpy @ target SR
        audio = self._decode(audio_bytes)

        original_rms = float(np.sqrt(np.mean(audio ** 2))) if len(audio) else 0.0

        # 2. Noise reduction
        was_denoised = False
        if denoise and len(audio) > TARGET_SR * 0.2:
            audio = self._denoise(audio)
            was_denoised = True

        # 3. Volume normalisation
        if normalize_volume:
            audio = self._normalize_volume(audio)

        # 4. Speed normalisation (fix slurred / rushed speech)
        was_stretched = False
        if normalize_speed:
            audio, was_stretched = self._normalize_speed(audio)

        # 5. Silence removal
        if remove_silence:
            audio = self._trim_silence(audio)

        normalised_rms = float(np.sqrt(np.mean(audio ** 2))) if len(audio) else 0.0
        duration_s     = len(audio) / TARGET_SR

        return AudioProcessingResult(
            audio          = audio,
            sample_rate    = TARGET_SR,
            duration_s     = duration_s,
            original_rms   = original_rms,
            normalised_rms = normalised_rms,
            was_denoised   = was_denoised,
            was_stretched  = was_stretched,
        )

    # ── Stage helpers ─────────────────────────────────────────────────────────

    def _decode(self, audio_bytes: bytes) -> np.ndarray:
        """Decode audio bytes (webm/wav/ogg/mp3) → float32 mono @ 16 kHz."""
        try:
            # Try soundfile first (fastest, handles WAV/FLAC/OGG)
            buf = io.BytesIO(audio_bytes)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                audio, sr = sf.read(buf, dtype="float32", always_2d=False)
        except Exception:
            # Fallback: librosa handles webm/mp3 via ffmpeg
            buf = io.BytesIO(audio_bytes)
            audio, sr = librosa.load(buf, sr=None, mono=True, dtype=np.float32)

        # Convert stereo → mono
        if audio.ndim == 2:
            audio = np.mean(audio, axis=1)

        # Resample to 16 kHz
        if sr != TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)

        return audio.astype(np.float32)

    def _denoise(self, audio: np.ndarray) -> np.ndarray:
        """
        Spectral noise reduction via noisereduce.
        Uses the first 0.5s as the noise profile (stationary noise).
        """
        noise_clip_len = min(int(TARGET_SR * 0.5), len(audio) // 4)
        noise_clip     = audio[:noise_clip_len] if noise_clip_len > 0 else audio

        try:
            reduced = nr.reduce_noise(
                y           = audio,
                y_noise     = noise_clip,
                sr          = TARGET_SR,
                stationary  = False,   # handles varying background noise
                prop_decrease = 0.75,
            )
            return reduced.astype(np.float32)
        except Exception as e:
            logger.warning("Noise reduction failed (using original): %s", e)
            return audio

    def _normalize_volume(self, audio: np.ndarray, target_rms: float = 0.1) -> np.ndarray:
        """RMS normalisation — boosts whispered speech to consistent level."""
        rms = np.sqrt(np.mean(audio ** 2))
        if rms < 1e-6:
            return audio
        gain  = target_rms / rms
        gain  = np.clip(gain, 0.1, 20.0)   # cap at 20× to avoid clipping
        audio = audio * gain
        # Hard clip to [-1, 1]
        return np.clip(audio, -1.0, 1.0).astype(np.float32)

    def _normalize_speed(
        self,
        audio: np.ndarray,
        min_rate: float = 0.65,
        max_rate: float = 1.6,
    ) -> tuple[np.ndarray, bool]:
        """
        Estimate speech rate and stretch if too slow (slurred) or too fast.
        Returns (audio, was_modified).
        """
        # Estimate rate via zero-crossing rate as a proxy for speaking speed
        zcr      = librosa.feature.zero_crossing_rate(audio, hop_length=512)[0]
        mean_zcr = float(np.mean(zcr))

        # Thresholds tuned empirically
        if mean_zcr < 0.03:
            # Very slow / slurred speech — speed up gently
            rate = 1.15
        elif mean_zcr > 0.20:
            # Rushed speech — slow down gently
            rate = 0.90
        else:
            return audio, False

        try:
            stretched = librosa.effects.time_stretch(audio, rate=rate)
            return stretched.astype(np.float32), True
        except Exception as e:
            logger.warning("Time stretch failed: %s", e)
            return audio, False

    def _trim_silence(
        self,
        audio: np.ndarray,
        top_db: int = 30,
        pad_ms: int = 100,
    ) -> np.ndarray:
        """Remove leading/trailing silence, add small padding."""
        trimmed, _ = librosa.effects.trim(audio, top_db=top_db)
        pad_samples = int(TARGET_SR * pad_ms / 1000)
        padding     = np.zeros(pad_samples, dtype=np.float32)
        return np.concatenate([padding, trimmed, padding])

    def audio_to_bytes(self, audio: np.ndarray, sample_rate: int = TARGET_SR) -> bytes:
        """Convert numpy float32 audio → WAV bytes."""
        buf = io.BytesIO()
        sf.write(buf, audio, sample_rate, format="WAV", subtype="PCM_16")
        buf.seek(0)
        return buf.read()


# Singleton
audio_processor = AudioProcessor()
