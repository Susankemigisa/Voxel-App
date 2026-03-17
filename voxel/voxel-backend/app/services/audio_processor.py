"""
AudioProcessor — Stage 1 of the Voice Reconstruction Pipeline.

Handles:
  • Format conversion (webm/opus/ogg/mp3/wav → 16kHz mono WAV)
  • Noise reduction        (noisereduce)
  • Volume normalisation   (librosa RMS normalise)
  • Speed normalisation    (librosa time_stretch for slurred/rushed speech)
  • Silence trimming       (librosa trim)
"""
import io
import logging
import subprocess
import tempfile
import os
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
        audio = self._decode(audio_bytes)

        original_rms = float(np.sqrt(np.mean(audio ** 2))) if len(audio) else 0.0

        was_denoised = False
        if denoise and len(audio) > TARGET_SR * 0.2:
            audio = self._denoise(audio)
            was_denoised = True

        if normalize_volume:
            audio = self._normalize_volume(audio)

        was_stretched = False
        if normalize_speed:
            audio, was_stretched = self._normalize_speed(audio)

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

    # ── Decode: handles webm/opus from browser ────────────────────────────────

    def _decode(self, audio_bytes: bytes) -> np.ndarray:
        """
        Decode audio bytes to float32 mono @ 16 kHz.
        Tries 3 methods in order:
          1. soundfile  — fast, handles WAV/FLAC/OGG
          2. pydub      — handles webm/mp3/opus via ffmpeg
          3. ffmpeg CLI — direct subprocess fallback
        """
        # Method 1: soundfile (WAV, FLAC, OGG Vorbis)
        try:
            buf = io.BytesIO(audio_bytes)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                audio, sr = sf.read(buf, dtype="float32", always_2d=False)
            return self._to_mono_16k(audio, sr)
        except Exception:
            pass

        # Method 2: pydub (webm, mp3, opus — needs ffmpeg)
        try:
            from pydub import AudioSegment
            buf  = io.BytesIO(audio_bytes)
            seg  = AudioSegment.from_file(buf)
            seg  = seg.set_frame_rate(TARGET_SR).set_channels(1).set_sample_width(2)
            raw  = np.frombuffer(seg.raw_data, dtype=np.int16).astype(np.float32)
            audio = raw / 32768.0
            return audio.astype(np.float32)
        except Exception as e:
            logger.debug("pydub decode failed: %s", e)

        # Method 3: ffmpeg CLI subprocess (most compatible)
        try:
            return self._decode_via_ffmpeg(audio_bytes)
        except Exception as e:
            logger.debug("ffmpeg CLI decode failed: %s", e)

        raise RuntimeError(
            "Could not decode audio. "
            "Install ffmpeg: https://ffmpeg.org/download.html  "
            "then run: pip install pydub"
        )

    def _decode_via_ffmpeg(self, audio_bytes: bytes) -> np.ndarray:
        """Decode using ffmpeg subprocess — handles any format ffmpeg supports."""
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
            tmp_in.write(audio_bytes)
            tmp_in_path = tmp_in.name

        tmp_out_path = tmp_in_path + ".wav"
        try:
            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", tmp_in_path,
                    "-ar", str(TARGET_SR),
                    "-ac", "1",
                    "-f", "wav",
                    tmp_out_path,
                ],
                capture_output=True,
                timeout=30,
            )
            if result.returncode != 0:
                raise RuntimeError(f"ffmpeg error: {result.stderr.decode()[:200]}")

            audio, sr = sf.read(tmp_out_path, dtype="float32")
            return self._to_mono_16k(audio, sr)
        finally:
            for path in (tmp_in_path, tmp_out_path):
                try:
                    os.unlink(path)
                except Exception:
                    pass

    def _to_mono_16k(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Convert stereo→mono and resample to 16 kHz."""
        if audio.ndim == 2:
            audio = np.mean(audio, axis=1)
        if sr != TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
        return audio.astype(np.float32)

    # ── Processing stages ─────────────────────────────────────────────────────

    def _denoise(self, audio: np.ndarray) -> np.ndarray:
        noise_clip_len = min(int(TARGET_SR * 0.5), len(audio) // 4)
        noise_clip     = audio[:noise_clip_len] if noise_clip_len > 0 else audio
        try:
            reduced = nr.reduce_noise(
                y             = audio,
                y_noise       = noise_clip,
                sr            = TARGET_SR,
                stationary    = False,
                prop_decrease = 0.75,
            )
            return reduced.astype(np.float32)
        except Exception as e:
            logger.warning("Noise reduction failed (using original): %s", e)
            return audio

    def _normalize_volume(self, audio: np.ndarray, target_rms: float = 0.1) -> np.ndarray:
        rms = np.sqrt(np.mean(audio ** 2))
        if rms < 1e-6:
            return audio
        gain  = target_rms / rms
        gain  = np.clip(gain, 0.1, 20.0)
        audio = audio * gain
        return np.clip(audio, -1.0, 1.0).astype(np.float32)

    def _normalize_speed(
        self,
        audio: np.ndarray,
        min_rate: float = 0.65,
        max_rate: float = 1.6,
    ) -> tuple[np.ndarray, bool]:
        zcr      = librosa.feature.zero_crossing_rate(audio, hop_length=512)[0]
        mean_zcr = float(np.mean(zcr))
        if mean_zcr < 0.03:
            rate = 1.15
        elif mean_zcr > 0.20:
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
        trimmed, _ = librosa.effects.trim(audio, top_db=top_db)
        pad_samples = int(TARGET_SR * pad_ms / 1000)
        padding     = np.zeros(pad_samples, dtype=np.float32)
        return np.concatenate([padding, trimmed, padding])

    def audio_to_bytes(self, audio: np.ndarray, sample_rate: int = TARGET_SR) -> bytes:
        buf = io.BytesIO()
        sf.write(buf, audio, sample_rate, format="WAV", subtype="PCM_16")
        buf.seek(0)
        return buf.read()


# Singleton
audio_processor = AudioProcessor()