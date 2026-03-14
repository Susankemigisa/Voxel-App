"""
Tests for app/services/voice_pipeline.py — end-to-end pipeline
All external services (ASR, LLM, TTS) are mocked.
"""
import base64
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.voice_pipeline import VoicePipelineService, PipelineResult
from app.models.schemas import Language, OutputMode, VoiceGender, ModelName


@pytest.fixture
def pipeline():
    return VoicePipelineService()


@pytest.fixture
def mock_audio_result(sample_audio_array):
    from app.services.audio_processor import AudioProcessingResult
    import numpy as np
    return AudioProcessingResult(
        audio          = sample_audio_array,
        sample_rate    = 16_000,
        duration_s     = 1.0,
        original_rms   = 0.05,
        normalised_rms = 0.1,
        was_denoised   = True,
        was_stretched  = False,
    )


@pytest.fixture
def mock_asr(mock_asr_result):
    with patch(
        "app.services.voice_pipeline.asr_service.transcribe",
        new_callable=AsyncMock,
        return_value=mock_asr_result,
    ) as m:
        yield m


@pytest.fixture
def mock_recon(mock_recon_result):
    with patch(
        "app.services.voice_pipeline.text_reconstructor.clean",
        new_callable=AsyncMock,
        return_value=mock_recon_result,
    ) as m:
        yield m


@pytest.fixture
def mock_tts(mock_tts_result):
    with patch(
        "app.services.voice_pipeline.tts_service.synthesize",
        new_callable=AsyncMock,
        return_value=mock_tts_result,
    ) as m:
        yield m


@pytest.fixture
def mock_audio_processor(mock_audio_result):
    with patch(
        "app.services.voice_pipeline.audio_processor.preprocess",
        new_callable=AsyncMock,
        return_value=mock_audio_result,
    ) as m:
        yield m


class TestPipelineValidation:
    def test_empty_audio_raises(self, pipeline):
        with pytest.raises(ValueError, match="Empty audio"):
            pipeline._validate_audio(b"")

    def test_oversized_audio_raises(self, pipeline):
        big = b"x" * (11 * 1024 * 1024)   # 11 MB > 10 MB limit
        with pytest.raises(ValueError, match="too large"):
            pipeline._validate_audio(big)

    def test_valid_audio_passes(self, pipeline, sample_wav_bytes):
        pipeline._validate_audio(sample_wav_bytes)   # should not raise


class TestPipelineOutputModes:
    @pytest.mark.asyncio
    async def test_both_mode_returns_audio(
        self, pipeline, sample_wav_bytes,
        mock_audio_processor, mock_asr, mock_recon, mock_tts,
    ):
        result = await pipeline.process(
            sample_wav_bytes,
            language    = Language.EN,
            output_mode = OutputMode.BOTH,
        )
        assert result.audio_base64 is not None
        mock_tts.assert_called_once()

    @pytest.mark.asyncio
    async def test_visual_mode_skips_tts(
        self, pipeline, sample_wav_bytes,
        mock_audio_processor, mock_asr, mock_recon, mock_tts,
    ):
        result = await pipeline.process(
            sample_wav_bytes,
            language    = Language.EN,
            output_mode = OutputMode.VISUAL,
        )
        assert result.audio_base64 is None
        mock_tts.assert_not_called()

    @pytest.mark.asyncio
    async def test_audio_mode_returns_audio(
        self, pipeline, sample_wav_bytes,
        mock_audio_processor, mock_asr, mock_recon, mock_tts,
    ):
        result = await pipeline.process(
            sample_wav_bytes,
            output_mode = OutputMode.AUDIO,
        )
        assert result.audio_base64 is not None
        mock_tts.assert_called_once()


class TestPipelineResult:
    @pytest.mark.asyncio
    async def test_result_has_all_fields(
        self, pipeline, sample_wav_bytes,
        mock_audio_processor, mock_asr, mock_recon, mock_tts,
    ):
        result = await pipeline.process(sample_wav_bytes)

        assert isinstance(result, PipelineResult)
        assert result.raw_transcript == "i i need h-help with the the door"
        assert result.clean_text     == "I need help with the door."
        assert result.language       == "en"
        assert 0.0 <= result.confidence <= 1.0
        assert result.pipeline_ms    >= 0

    @pytest.mark.asyncio
    async def test_pipeline_records_stages(
        self, pipeline, sample_wav_bytes,
        mock_audio_processor, mock_asr, mock_recon, mock_tts,
    ):
        result = await pipeline.process(sample_wav_bytes, output_mode=OutputMode.BOTH)
        stage_ids = [s.stage for s in result.stages]
        assert "audio_cleanup"       in stage_ids
        assert "asr"                 in stage_ids
        assert "text_reconstruction" in stage_ids
        assert "tts"                 in stage_ids


class TestPipelineFallbacks:
    @pytest.mark.asyncio
    async def test_tts_failure_is_non_fatal(
        self, pipeline, sample_wav_bytes,
        mock_audio_processor, mock_asr, mock_recon,
    ):
        """TTS failure should not crash the pipeline — visual output still works."""
        with patch(
            "app.services.voice_pipeline.tts_service.synthesize",
            new_callable=AsyncMock,
            side_effect=RuntimeError("TTS model unavailable"),
        ):
            result = await pipeline.process(
                sample_wav_bytes, output_mode=OutputMode.BOTH
            )
        # Clean text is still present even though TTS failed
        assert result.clean_text == "I need help with the door."
        assert result.audio_base64 is None

    @pytest.mark.asyncio
    async def test_reconstruction_failure_falls_back_to_raw(
        self, pipeline, sample_wav_bytes,
        mock_audio_processor, mock_asr, mock_tts,
    ):
        """If LLM reconstruction fails, raw ASR transcript is used as fallback."""
        with patch(
            "app.services.voice_pipeline.text_reconstructor.clean",
            new_callable=AsyncMock,
            side_effect=RuntimeError("LLM unavailable"),
        ):
            result = await pipeline.process(sample_wav_bytes)
        assert result.clean_text == "i i need h-help with the the door"

    @pytest.mark.asyncio
    async def test_asr_failure_raises(
        self, pipeline, sample_wav_bytes, mock_audio_processor,
    ):
        """ASR failure is fatal — raise RuntimeError."""
        with patch(
            "app.services.voice_pipeline.asr_service.transcribe",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Model not loaded"),
        ):
            with pytest.raises(RuntimeError, match="Speech recognition failed"):
                await pipeline.process(sample_wav_bytes)
