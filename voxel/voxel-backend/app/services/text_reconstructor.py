"""
TextReconstructor — Stage 3 of the Voice Reconstruction Pipeline.

Takes the raw, imperfect ASR transcript and uses OpenAI GPT-4o-mini
to reconstruct it into a clean, grammatically correct sentence — removing
stutters, completing fragments, fixing grammar while preserving exact intent.

Handles:
  • Stuttering / repetition    ("I I I need" → "I need")
  • Incomplete sentences       ("where is the bath-" → "Where is the bathroom?")
  • Slurred / garbled words    ("hel-help" → "help")
  • Grammar correction
  • Luganda text reconstruction
"""
import logging
import re
from dataclasses import dataclass

from openai import OpenAI, APIError
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """You are a speech reconstruction assistant for people with speech impairments.

Your job: take a raw, imperfect ASR transcript and return ONE clean, grammatically correct sentence or phrase that best represents what the person intended to communicate.

Rules:
- Remove ALL stutters and repetitions (e.g. "I I I want" → "I want", "the the" → "the")
- Complete trailing or cut-off sentences using natural language inference
- Fix grammar, spelling, and punctuation
- Preserve the original meaning and intent EXACTLY — do not add information not implied
- Keep output concise — it will be spoken aloud via text-to-speech
- If the input is in Luganda, reconstruct and output in Luganda
- Return ONLY the cleaned sentence. No explanations, no labels, no quotes.

Examples:
  Input:  "i i i need h-help finding the the accessible entrance near north wing"
  Output: I need help finding the accessible entrance near the north wing.

  Input:  "where is the the bath-bathroom please"
  Output: Where is the bathroom, please?

  Input:  "c-call a doctor please please"
  Output: Please call a doctor.

  Input:  "nze nze nsaba obu-"
  Output: Nze nsaba obuyambi.

  Input:  "i need to go home"
  Output: I need to go home."""


@dataclass
class ReconstructionResult:
    clean_text:     str
    original_text:  str
    was_modified:   bool


class TextReconstructor:

    def __init__(self):
        self._client: OpenAI | None = None

    def _get_client(self) -> OpenAI:
        if self._client is None:
            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY not configured")
            self._client = OpenAI(api_key=settings.openai_api_key)
        return self._client

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=4))
    async def clean(
        self,
        raw_transcript: str,
        language:       str = "en",
        context:        list[str] | None = None,
    ) -> ReconstructionResult:
        """
        Clean a raw ASR transcript into a well-formed sentence.

        Args:
            raw_transcript: Raw output from ASR model
            language:       'en' or 'lg'
            context:        Optional list of user's saved phrases for intent inference
        """
        if not raw_transcript or not raw_transcript.strip():
            return ReconstructionResult(
                clean_text    = "",
                original_text = raw_transcript,
                was_modified  = False,
            )

        # Quick pre-filter: if already clean, skip the LLM call
        if self._is_already_clean(raw_transcript):
            return ReconstructionResult(
                clean_text    = raw_transcript.strip().capitalize(),
                original_text = raw_transcript,
                was_modified  = False,
            )

        import asyncio
        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._call_llm,
            raw_transcript,
            language,
            context or [],
        )
        return result

    def _call_llm(
        self,
        raw_transcript: str,
        language:       str,
        context:        list[str],
    ) -> ReconstructionResult:
        """Synchronous LLM call — runs in thread pool."""
        client = self._get_client()

        # Build user message with optional context
        user_msg = raw_transcript.strip()
        if context:
            top_context = context[:5]
            user_msg = (
                f"Saved phrases for context (do NOT copy unless exact match): "
                f"{'; '.join(top_context)}\n\n"
                f"Transcript to clean: {raw_transcript.strip()}"
            )

        try:
            response = client.chat.completions.create(
                model      = settings.llm_model,
                max_tokens = 256,
                messages   = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
            )
            clean_text = response.choices[0].message.content.strip()

            # Strip any accidental quotes the model may have added
            clean_text = clean_text.strip('"\'')

            was_modified = clean_text.lower() != raw_transcript.strip().lower()

            logger.info(
                "TextReconstructor: %r → %r (modified=%s)",
                raw_transcript, clean_text, was_modified,
            )

            return ReconstructionResult(
                clean_text    = clean_text,
                original_text = raw_transcript,
                was_modified  = was_modified,
            )

        except APIError as e:
            logger.error("OpenAI API error: %s", e)
            # Graceful fallback: apply basic rule-based cleanup
            return ReconstructionResult(
                clean_text    = self._rule_based_cleanup(raw_transcript),
                original_text = raw_transcript,
                was_modified  = True,
            )

    def _is_already_clean(self, text: str) -> bool:
        """Fast heuristic: text needs LLM if it has stutters/hyphens/repetitions."""
        t = text.lower()
        # Has hyphens mid-word (cut-off words)
        if re.search(r'\w-\w|\w-\s', t):
            return False
        # Has word repetitions ("the the", "i i")
        words = t.split()
        for i in range(len(words) - 1):
            if words[i] == words[i + 1] and len(words[i]) > 1:
                return False
        # Short fragment (likely incomplete)
        if len(words) <= 2:
            return False
        return True

    def _rule_based_cleanup(self, text: str) -> str:
        """
        Minimal rule-based fallback used when LLM is unavailable.
        Removes obvious stutters and hyphens.
        """
        t = text.strip()
        # Remove word-level repetitions
        words   = t.split()
        cleaned = [words[0]] if words else []
        for word in words[1:]:
            if word.lower() != cleaned[-1].lower():
                cleaned.append(word)
        t = " ".join(cleaned)
        # Remove mid-word hyphens
        t = re.sub(r'(\w+)-\s+', '', t)
        t = re.sub(r'\s+', ' ', t).strip()
        # Capitalise and punctuate
        if t and not t[-1] in ".!?":
            t += "."
        return t[0].upper() + t[1:] if t else t


# Singleton
text_reconstructor = TextReconstructor()
