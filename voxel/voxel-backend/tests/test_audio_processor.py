"""
Tests for app/services/audio_processor.py — Stage 1
"""
import pytest
import numpy as np
from unittest.mock import patch

from app.services.audio_processor import AudioProcessor, AudioProcessingResult


@pytest.fixture
def processor():
    return AudioProcessor()


class TestAudioDecode:
    def test_decode_valid_wav(self, processor, sample_wav_bytes):
        audio = processor._decode(sample_wav_bytes)
        assert isinstance(audio, np.ndarray)
        assert audio.dtype == np.float32
        assert len(audio) > 0

    def test_decode_resamples_to_16k(self, processor, sample_wav_bytes):
        audio = processor._decode(sample_wav_bytes)
        # Result should be at 16 kHz; original fixture is already 16 kHz
        assert len(audio) == pytest.approx(16_000, rel=0.05)

    def test_decode_empty_raises(self, processor):
        with pytest.raises(Exception):
            processor._decode(b"")


class TestDenoise:
    def test_denoise_returns_same_shape(self, processor, sample_audio_array):
        result = processor._denoise(sample_audio_array)
        assert result.shape == sample_audio_array.shape
        assert result.dtype == np.float32

    def test_denoise_short_audio_returns_original(self, processor):
        short = np.zeros(100, dtype=np.float32)
        result = processor._denoise(short)
        np.testing.assert_array_equal(result, short)


class TestNormalizeVolume:
    def test_normalise_silent_audio(self, processor):
        silent = np.zeros(1000, dtype=np.float32)
        result = processor._normalize_volume(silent)
        # Should return unchanged (avoid div-by-zero)
        np.testing.assert_array_equal(result, silent)

    def test_normalise_boosts_quiet_audio(self, processor):
        quiet = np.ones(1000, dtype=np.float32) * 0.001
        result = processor._normalize_volume(quiet, target_rms=0.1)
        rms = np.sqrt(np.mean(result ** 2))
        assert abs(rms - 0.1) < 0.01

    def test_normalise_clips_to_one(self, processor):
        loud = np.ones(1000, dtype=np.float32) * 10.0
        result = processor._normalize_volume(loud)
        assert result.max() <= 1.0
        assert result.min() >= -1.0


class TestTrimSilence:
    def test_trim_returns_shorter_audio(self, processor):
        # Pad a tone with silence
        silence = np.zeros(8000, dtype=np.float32)
        tone    = np.sin(np.linspace(0, 2 * np.pi * 440, 8000)).astype(np.float32) * 0.5
        padded  = np.concatenate([silence, tone, silence])
        trimmed = processor._trim_silence(padded)
        assert len(trimmed) < len(padded)

    def test_trim_all_silence_returns_padding_only(self, processor):
        silence = np.zeros(16_000, dtype=np.float32)
        result  = processor._trim_silence(silence)
        # Only padding remains
        assert len(result) <= 3200  # 2 × 100ms padding


class TestFullPreprocess:
    @pytest.mark.asyncio
    async def test_preprocess_valid_wav(self, processor, sample_wav_bytes):
        result = await processor.preprocess(sample_wav_bytes)
        assert isinstance(result, AudioProcessingResult)
        assert result.sample_rate == 16_000
        assert result.duration_s > 0
        assert result.audio.dtype == np.float32

    @pytest.mark.asyncio
    async def test_preprocess_empty_raises(self, processor):
        with pytest.raises(Exception):
            await processor.preprocess(b"")

    @pytest.mark.asyncio
    async def test_preprocess_sets_denoised_flag(self, processor, sample_wav_bytes):
        result = await processor.preprocess(sample_wav_bytes, denoise=True)
        assert result.was_denoised is True

    @pytest.mark.asyncio
    async def test_preprocess_skip_denoise(self, processor, sample_wav_bytes):
        result = await processor.preprocess(sample_wav_bytes, denoise=False)
        assert result.was_denoised is False


class TestAudioToBytes:
    def test_roundtrip(self, processor, sample_audio_array):
        wav_bytes = processor.audio_to_bytes(sample_audio_array)
        assert isinstance(wav_bytes, bytes)
        assert len(wav_bytes) > 44   # at least WAV header
        # Decode back
        recovered = processor._decode(wav_bytes)
        assert len(recovered) == pytest.approx(len(sample_audio_array), rel=0.01)
