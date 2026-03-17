"""
TextReconstructor — Stage 3 of the Voice Reconstruction Pipeline.

Cleans raw ASR transcripts using rule-based processing — no external
API required. Handles the most common impaired-speech artefacts that
appear in Whisper output:

  • Stuttering / repetition    ("I I I need"  → "I need")
  • Cut-off / hyphenated words ("bath-"       → removed/joined)
  • Filler words               ("um", "uh"    → removed)
  • Punctuation & capitalisation
  • Luganda text (same rules apply)
"""
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ReconstructionResult:
    clean_text:    str
    original_text: str
    was_modified:  bool


class TextReconstructor:

    # Filler words to strip (English + common Luganda fillers)
    FILLERS = {
        "um", "uh", "er", "eh", "ah", "hmm", "hm",
        "like", "you know", "i mean",
        "naye",   # Luganda filler
    }

    async def clean(
        self,
        raw_transcript: str,
        language: str = "en",
        context: list[str] | None = None,
    ) -> ReconstructionResult:
        """
        Clean a raw ASR transcript into a well-formed sentence.
        Fully synchronous under the hood — no I/O, no external calls.
        """
        if not raw_transcript or not raw_transcript.strip():
            return ReconstructionResult(
                clean_text    = "",
                original_text = raw_transcript,
                was_modified  = False,
            )

        original = raw_transcript
        text     = raw_transcript.strip()

        text = self._remove_repetitions(text)
        text = self._remove_cutoff_words(text)
        text = self._remove_fillers(text)
        text = self._collapse_whitespace(text)
        text = self._capitalise_and_punctuate(text)

        was_modified = text.lower() != original.strip().lower()

        logger.info(
            "TextReconstructor: %r → %r (modified=%s)",
            original, text, was_modified,
        )

        return ReconstructionResult(
            clean_text    = text,
            original_text = original,
            was_modified  = was_modified,
        )

    # ── Rules ─────────────────────────────────────────────────────────────────

    def _remove_repetitions(self, text: str) -> str:
        """Remove consecutive duplicate words: 'I I I need' → 'I need'."""
        words   = text.split()
        cleaned = [words[0]] if words else []
        for word in words[1:]:
            if word.lower() != cleaned[-1].lower():
                cleaned.append(word)
        return " ".join(cleaned)

    def _remove_cutoff_words(self, text: str) -> str:
        """
        Drop trailing cut-off fragments ('bath-', 'h-help' → 'help').
        - 'word-'       → remove entirely (trailing cut-off)
        - 'h-help'      → 'help'  (stuttered lead-in)
        - 'hel-help'    → 'help'  (partial + full word — keep the full word)
        """
        # 'x-word' where x is 1–3 chars — stutter lead-in, keep the full word
        text = re.sub(r'\b\w{1,3}-(\w+)', r'\1', text)
        # 'word-' at end of token — trailing cut-off, remove
        text = re.sub(r'\b\w+-\s*', ' ', text)
        return text

    def _remove_fillers(self, text: str) -> str:
        """Strip common filler words."""
        pattern = r'\b(' + '|'.join(re.escape(f) for f in self.FILLERS) + r')\b'
        return re.sub(pattern, '', text, flags=re.IGNORECASE)

    def _collapse_whitespace(self, text: str) -> str:
        return re.sub(r'\s+', ' ', text).strip()

    def _capitalise_and_punctuate(self, text: str) -> str:
        """Capitalise first letter; add a period if no terminal punctuation."""
        if not text:
            return text
        text = text[0].upper() + text[1:]
        if text[-1] not in ".!?,":
            text += "."
        return text


# Singleton
text_reconstructor = TextReconstructor()