"""
Tests for app/services/text_reconstructor.py — Stage 3
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.text_reconstructor import TextReconstructor, ReconstructionResult


@pytest.fixture
def reconstructor():
    return TextReconstructor()


class TestIsAlreadyClean:
    def test_clean_sentence_passes(self, reconstructor):
        assert reconstructor._is_already_clean("I need help finding the exit.") is True

    def test_stutter_detected(self, reconstructor):
        assert reconstructor._is_already_clean("I I need help") is False

    def test_hyphen_detected(self, reconstructor):
        assert reconstructor._is_already_clean("I need h-help") is False

    def test_short_fragment_detected(self, reconstructor):
        assert reconstructor._is_already_clean("help me") is False

    def test_repeated_word_detected(self, reconstructor):
        assert reconstructor._is_already_clean("where is the the exit") is False


class TestRuleBasedCleanup:
    def test_removes_repetitions(self, reconstructor):
        result = reconstructor._rule_based_cleanup("I I need the the door")
        assert "I I" not in result
        assert "the the" not in result

    def test_removes_mid_word_hyphen(self, reconstructor):
        result = reconstructor._rule_based_cleanup("I need h- help please")
        assert "h-" not in result

    def test_capitalises_result(self, reconstructor):
        result = reconstructor._rule_based_cleanup("please help me")
        assert result[0].isupper()

    def test_adds_period(self, reconstructor):
        result = reconstructor._rule_based_cleanup("I need help")
        assert result.endswith(".")


class TestCleanWithMockedLLM:
    @pytest.mark.asyncio
    async def test_clean_calls_llm_for_stuttered_text(self, reconstructor):
        mock_choice  = MagicMock()
        mock_choice.message.content = "I need help finding the door."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        reconstructor._client = mock_client

        result = await reconstructor.clean("i i need h-help finding the the door")

        assert isinstance(result, ReconstructionResult)
        assert result.clean_text == "I need help finding the door."
        assert result.was_modified is True

    @pytest.mark.asyncio
    async def test_clean_skips_llm_for_clean_text(self, reconstructor):
        """Already clean text should NOT call the LLM."""
        mock_client = MagicMock()
        reconstructor._client = mock_client

        result = await reconstructor.clean("I need help finding the door.")

        mock_client.chat.completions.create.assert_not_called()
        assert result.clean_text == "I need help finding the door."

    @pytest.mark.asyncio
    async def test_clean_empty_string(self, reconstructor):
        result = await reconstructor.clean("")
        assert result.clean_text == ""
        assert result.was_modified is False

    @pytest.mark.asyncio
    async def test_clean_falls_back_on_api_error(self, reconstructor):
        from openai import APIError
        from unittest.mock import MagicMock
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = APIError(
            message="Rate limited", request=MagicMock(), body=None
        )
        reconstructor._client = mock_client

        result = await reconstructor.clean("i i need h-help")
        # Should fall back to rule-based cleanup — not raise
        assert isinstance(result.clean_text, str)
        assert len(result.clean_text) > 0

    @pytest.mark.asyncio
    async def test_clean_strips_quotes_from_llm_response(self, reconstructor):
        mock_choice = MagicMock()
        mock_choice.message.content = '"I need help."'
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        reconstructor._client = mock_client

        result = await reconstructor.clean("i i need h-help")
        assert not result.clean_text.startswith('"')
        assert not result.clean_text.endswith('"')

    @pytest.mark.asyncio
    async def test_clean_luganda_text(self, reconstructor):
        mock_choice = MagicMock()
        mock_choice.message.content = "Nze nsaba obuyambi."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        reconstructor._client = mock_client

        result = await reconstructor.clean("nze nze nsaba obu-", language="lg")
        assert result.clean_text == "Nze nsaba obuyambi."
