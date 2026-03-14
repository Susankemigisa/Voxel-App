"""
Tests for config and Pydantic schema validation.
"""
import pytest
from pydantic import ValidationError

from app.models.schemas import (
    TTSRequest, TranslationRequest, PipelineRequest,
    Language, VoiceGender, OutputMode,
)
from app.config import get_settings


class TestSettings:
    def test_settings_loads(self):
        s = get_settings()
        assert s.app_name == "Voxel API"
        assert s.target_sample_rate == 16_000

    def test_settings_cached(self):
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2   # lru_cache returns same instance


class TestTTSRequestSchema:
    def test_valid_request(self):
        req = TTSRequest(text="Hello world", language="en", voice="female", pitch=0.5, rate=0.6)
        assert req.text == "Hello world"

    def test_empty_text_raises(self):
        with pytest.raises(ValidationError):
            TTSRequest(text="")

    def test_text_too_long_raises(self):
        with pytest.raises(ValidationError):
            TTSRequest(text="x" * 501)

    def test_pitch_out_of_range_raises(self):
        with pytest.raises(ValidationError):
            TTSRequest(text="hello", pitch=1.5)

    def test_rate_zero_raises(self):
        with pytest.raises(ValidationError):
            TTSRequest(text="hello", rate=0.0)

    def test_defaults_applied(self):
        req = TTSRequest(text="Hello")
        assert req.language == Language.EN
        assert req.voice    == VoiceGender.FEMALE


class TestTranslationRequestSchema:
    def test_valid_en_to_lg(self):
        req = TranslationRequest(
            text="Where is the exit?", source_lang="en", target_lang="lg"
        )
        assert req.source_lang == Language.EN
        assert req.target_lang == Language.LG

    def test_empty_text_raises(self):
        with pytest.raises(ValidationError):
            TranslationRequest(text="", source_lang="en", target_lang="lg")

    def test_invalid_language_raises(self):
        with pytest.raises(ValidationError):
            TranslationRequest(text="Hello", source_lang="fr", target_lang="lg")

    def test_text_too_long_raises(self):
        with pytest.raises(ValidationError):
            TranslationRequest(text="x" * 1001, source_lang="en", target_lang="lg")


class TestPipelineRequestSchema:
    def test_defaults(self):
        req = PipelineRequest()
        assert req.language    == Language.EN
        assert req.output_mode == OutputMode.BOTH
        assert req.translate_to is None

    def test_valid_with_translate(self):
        req = PipelineRequest(language="en", output_mode="audio", translate_to="lg")
        assert req.translate_to == Language.LG

    def test_invalid_output_mode_raises(self):
        with pytest.raises(ValidationError):
            PipelineRequest(output_mode="text")


class TestLanguageEnum:
    def test_en_value(self):
        assert Language.EN.value == "en"

    def test_lg_value(self):
        assert Language.LG.value == "lg"

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            Language("fr")
