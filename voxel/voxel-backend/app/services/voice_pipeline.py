"""
VoicePipelineService — The core Voxel feature.

Orchestrates all 5 pipeline stages:

  Stage 1: AudioProcessor      — denoise, normalise, trim
  Stage 2: ASRService          — impaired audio → raw transcript
  Stage 3: TextReconstructor   — raw transcript → clean sentence (Claude)
  Stage 4: TranslationService  — optional en ↔ lg translation
  Stage 5: TTSService          — clean text → synthesised speech audio

Input:  raw audio bytes (any format, any quality)
Output: clean text + (optionally) synthesised audio
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

from app.services.audio_processor    import audio_processor
from app.services.asr_service        import asr_service
from app.services.text_reconstructor import text_reconstructor
from app.services.translation_service import translation_service
from app.services.tts_service        import tts_service
from app.models.schemas import Language, VoiceGender, OutputMode, ModelName
from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class PipelineStageResult:
    stage:      str
    success:    bool
    duration_ms: int
    detail:     str = ""


@dataclass
class PipelineResult:
    raw_transcript: str
    clean_text:     str
    language:       str
    confidence:     float
    model_used:     ModelName
    audio_base64:   Optional[str] = None
    duration_ms:    Optional[int] = None
    pipeline_ms:    int = 0
    stages:         list[PipelineStageResult] = field(default_factory=list)


class VoicePipelineService:

    async def process(
        self,
        audio_bytes:  bytes,
        language:     Language    = Language.EN,
        output_mode:  OutputMode  = OutputMode.BOTH,
        translate_to: Optional[Language] = None,
        voice:        VoiceGender = VoiceGender.FEMALE,
        pitch:        float       = 0.5,
        rate:         float       = 0.6,
        user_phrases: list[str]   = (),
    ) -> PipelineResult:
        """
        Full pipeline: raw audio bytes → clean text + optional audio.

        Args:
            audio_bytes:  Raw audio in any format (webm, wav, ogg, mp3)
            language:     Input speech language ('en' or 'lg')
            output_mode:  'audio' | 'visual' | 'both'
            translate_to: Optional target language for translation
            voice:        TTS voice gender
            pitch:        TTS pitch adjustment (0.0–1.0)
            rate:         TTS speaking rate
            user_phrases: User's saved phrases for LLM context
        """
        pipeline_start = time.monotonic()
        stages: list[PipelineStageResult] = []

        self._validate_audio(audio_bytes)

        # ── Stage 1: Audio Preprocessing ─────────────────────────────────────
        t0 = time.monotonic()
        try:
            audio_result = await audio_processor.preprocess(audio_bytes)
            stages.append(PipelineStageResult(
                stage       = "audio_cleanup",
                success     = True,
                duration_ms = int((time.monotonic() - t0) * 1000),
                detail      = (
                    f"denoised={audio_result.was_denoised}, "
                    f"stretched={audio_result.was_stretched}, "
                    f"duration={audio_result.duration_s:.1f}s"
                ),
            ))
            logger.info("Stage 1 done: %s", stages[-1].detail)
        except Exception as e:
            logger.error("Stage 1 (audio preprocessing) failed: %s", e)
            raise RuntimeError(f"Audio preprocessing failed: {e}") from e

        # ── Stage 2: ASR Transcription ────────────────────────────────────────
        t0 = time.monotonic()
        try:
            asr_result = await asr_service.transcribe(audio_result.audio, language)
            stages.append(PipelineStageResult(
                stage       = "asr",
                success     = True,
                duration_ms = int((time.monotonic() - t0) * 1000),
                detail      = f"confidence={asr_result.confidence:.2f}, model={asr_result.model_used}",
            ))
            logger.info("Stage 2 done: %r (confidence=%.2f)", asr_result.transcript, asr_result.confidence)
        except Exception as e:
            logger.error("Stage 2 (ASR) failed: %s", e)
            raise RuntimeError(f"Speech recognition failed: {e}") from e

        # ── Stage 3: Text Reconstruction ──────────────────────────────────────
        t0 = time.monotonic()
        try:
            recon_result = await text_reconstructor.clean(
                asr_result.transcript,
                language = language.value,
                context  = list(user_phrases),
            )
            stages.append(PipelineStageResult(
                stage       = "text_reconstruction",
                success     = True,
                duration_ms = int((time.monotonic() - t0) * 1000),
                detail      = f"modified={recon_result.was_modified}",
            ))
            clean_text = recon_result.clean_text
            logger.info("Stage 3 done: %r → %r", asr_result.transcript, clean_text)
        except Exception as e:
            # Fallback: use raw transcript if LLM fails
            logger.warning("Stage 3 (text reconstruction) failed, using raw: %s", e)
            clean_text = asr_result.transcript
            stages.append(PipelineStageResult(
                stage       = "text_reconstruction",
                success     = False,
                duration_ms = int((time.monotonic() - t0) * 1000),
                detail      = f"fallback to raw: {e}",
            ))

        # ── Stage 4: Translation (optional) ──────────────────────────────────
        if translate_to and translate_to != language:
            t0 = time.monotonic()
            try:
                trans_result = await translation_service.translate(
                    clean_text, language, translate_to
                )
                clean_text = trans_result.translated
                stages.append(PipelineStageResult(
                    stage       = "translation",
                    success     = True,
                    duration_ms = int((time.monotonic() - t0) * 1000),
                    detail      = f"{language.value}→{translate_to.value}",
                ))
                logger.info("Stage 4 done: translated to %s", translate_to.value)
            except Exception as e:
                logger.warning("Stage 4 (translation) failed: %s", e)
                stages.append(PipelineStageResult(
                    stage       = "translation",
                    success     = False,
                    duration_ms = int((time.monotonic() - t0) * 1000),
                    detail      = str(e),
                ))

        # ── Stage 5: Text-to-Speech (conditional) ────────────────────────────
        audio_b64:   Optional[str] = None
        duration_ms: Optional[int] = None

        tts_lang = translate_to if (translate_to and translate_to != language) else language

        if output_mode in (OutputMode.AUDIO, OutputMode.BOTH):
            t0 = time.monotonic()
            try:
                tts_result = await tts_service.synthesize(
                    clean_text, language=tts_lang, voice=voice, pitch=pitch, rate=rate
                )
                audio_b64   = tts_result.audio_base64
                duration_ms = tts_result.duration_ms
                stages.append(PipelineStageResult(
                    stage       = "tts",
                    success     = True,
                    duration_ms = int((time.monotonic() - t0) * 1000),
                    detail      = f"duration={tts_result.duration_ms}ms, voice={voice.value}",
                ))
                logger.info("Stage 5 done: %dms audio", tts_result.duration_ms)
            except Exception as e:
                logger.error("Stage 5 (TTS) failed: %s", e)
                stages.append(PipelineStageResult(
                    stage       = "tts",
                    success     = False,
                    duration_ms = int((time.monotonic() - t0) * 1000),
                    detail      = str(e),
                ))
                # TTS failure is non-fatal — visual output still works

        pipeline_ms = int((time.monotonic() - pipeline_start) * 1000)
        logger.info("Pipeline complete in %dms", pipeline_ms)

        return PipelineResult(
            raw_transcript = asr_result.transcript,
            clean_text     = clean_text,
            language       = language.value,
            confidence     = asr_result.confidence,
            model_used     = asr_result.model_used,
            audio_base64   = audio_b64,
            duration_ms    = duration_ms,
            pipeline_ms    = pipeline_ms,
            stages         = stages,
        )

    def _validate_audio(self, audio_bytes: bytes) -> None:
        """Reject audio that's too large or empty."""
        if not audio_bytes:
            raise ValueError("Empty audio received")
        max_bytes = int(settings.max_audio_size_mb * 1024 * 1024)
        if len(audio_bytes) > max_bytes:
            raise ValueError(
                f"Audio too large: {len(audio_bytes)/1024/1024:.1f}MB "
                f"(max {settings.max_audio_size_mb}MB)"
            )


# Singleton
voice_pipeline = VoicePipelineService()
