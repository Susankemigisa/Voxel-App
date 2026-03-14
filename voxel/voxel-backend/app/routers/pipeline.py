"""
Pipeline Router — POST /api/v1/pipeline/process

The main Voxel endpoint: impaired audio in → clean text + audio out.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.middleware.auth       import get_optional_user
from app.models.schemas        import (
    Language, OutputMode, VoiceGender,
    PipelineResponse,
)
from app.services.voice_pipeline import voice_pipeline
from app.db.supabase             import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/process", response_model=PipelineResponse)
async def process_pipeline(
    audio:        UploadFile       = File(...,  description="Audio file (any format, max 10MB)"),
    language:     Language         = Form(Language.EN),
    output_mode:  OutputMode       = Form(OutputMode.BOTH),
    translate_to: Optional[str]    = Form(None),
    voice:        VoiceGender      = Form(VoiceGender.FEMALE),
    pitch:        float            = Form(0.5),
    rate:         float            = Form(0.6),
    user          = Depends(get_optional_user),
):
    """
    Full 5-stage voice reconstruction pipeline.

    - Stage 1: Denoise, normalise, trim audio
    - Stage 2: ASR transcription (wav2vec2 / MMS)
    - Stage 3: LLM text reconstruction (Claude Haiku)
    - Stage 4: Optional translation (en ↔ lg)
    - Stage 5: TTS synthesis (MMS-TTS)

    Returns clean transcript + optional base64 audio.
    """
    # Read audio bytes
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio file")

    # Parse optional translate_to
    translate_lang: Optional[Language] = None
    if translate_to and translate_to in Language._value2member_map_:
        translate_lang = Language(translate_to)

    # Fetch user's saved phrases for LLM context (if authenticated)
    user_phrases: list[str] = []
    if user:
        try:
            user_id  = user["sub"]
            supabase = get_supabase()
            result   = (
                supabase.table("saved_phrases")
                .select("phrase")
                .eq("user_id", user_id)
                .limit(10)
                .execute()
            )
            user_phrases = [row["phrase"] for row in (result.data or [])]
        except Exception as e:
            logger.warning("Could not fetch user phrases: %s", e)

    # Run pipeline
    try:
        result = await voice_pipeline.process(
            audio_bytes  = audio_bytes,
            language     = language,
            output_mode  = output_mode,
            translate_to = translate_lang,
            voice        = voice,
            pitch        = pitch,
            rate         = rate,
            user_phrases = user_phrases,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    # Persist to transcription history (fire-and-forget)
    if user and result.raw_transcript:
        try:
            user_id  = user["sub"]
            supabase = get_supabase()
            supabase.table("transcription_history").insert({
                "user_id":    user_id,
                "transcript": result.clean_text,
                "language":   result.language,
                "confidence": result.confidence,
                "model_used": result.model_used.value,
            }).execute()
        except Exception as e:
            logger.warning("Could not save transcription history: %s", e)

    return PipelineResponse(
        raw_transcript = result.raw_transcript,
        clean_text     = result.clean_text,
        language       = result.language,
        confidence     = result.confidence,
        model_used     = result.model_used,
        audio_base64   = result.audio_base64,
        duration_ms    = result.duration_ms,
        pipeline_ms    = result.pipeline_ms,
    )
