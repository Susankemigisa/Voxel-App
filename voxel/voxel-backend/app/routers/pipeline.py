"""
Pipeline Router — POST /api/v1/pipeline/process
"""
import logging
import base64
import time
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.middleware.auth       import get_optional_user
from app.config import get_settings
from app.models.schemas        import (
    Language, OutputMode, VoiceGender,
    PipelineResponse,
)
from app.services.voice_pipeline import voice_pipeline
from app.db.supabase             import get_supabase

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/pipeline", tags=["pipeline"])


def _safe_model_used(model_used) -> Optional[str]:
    """
    DB constraint only allows 'wav2vec2' or 'mms'.
    Whisper is the ASR model but pipeline wraps it — map to closest allowed value.
    """
    if model_used is None:
        return None
    val = model_used.value if hasattr(model_used, 'value') else str(model_used)
    if val in ('wav2vec2', 'mms'):
        return val
    if 'whisper' in val.lower():
        return 'wav2vec2'  # whisper is an ASR model, map to wav2vec2 slot
    return None  # unknown — omit to avoid constraint violation


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
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio file")

    translate_lang: Optional[Language] = None
    if translate_to and translate_to in Language._value2member_map_:
        translate_lang = Language(translate_to)

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

    audio_url: Optional[str] = None

    if user and result.audio_base64:
        try:
            user_id = user["sub"]
            supabase = get_supabase()
            wav_bytes = base64.b64decode(result.audio_base64)
            object_path = f"{user_id}/{int(time.time() * 1000)}.wav"

            supabase.storage.from_(settings.tts_audio_bucket).upload(
                object_path,
                wav_bytes,
                {"content-type": "audio/wav", "upsert": "true"},
            )

            audio_url = supabase.storage.from_(settings.tts_audio_bucket).get_public_url(object_path)

            if not audio_url:
                signed = supabase.storage.from_(settings.tts_audio_bucket).create_signed_url(
                    object_path,
                    settings.tts_audio_signed_url_expires_s,
                )
                audio_url = (signed or {}).get("signedURL")
        except Exception as e:
            logger.warning("Could not persist generated audio: %s", e)

    # Debug: log auth status
    if user:
        logger.info("✅ Authenticated user: %s", user.get("sub", "unknown"))
    else:
        logger.warning("⚠️ No authenticated user — session NOT saved. Check SUPABASE_JWT_SECRET in Modal secret.")

    # Save session — only insert columns that exist in the DB schema
    if user and result.raw_transcript:
        try:
            user_id  = user["sub"]
            supabase = get_supabase()
            safe_model = _safe_model_used(result.model_used)
            row = {
                "user_id":    user_id,
                "transcript": result.clean_text or result.raw_transcript,
                "language":   result.language,
                "confidence": result.confidence,
                "audio_url":  audio_url,
            }
            if safe_model:
                row["model_used"] = safe_model
            supabase.table("transcription_history").insert(row).execute()
            logger.info("Session saved for user %s", user_id)
        except Exception as e:
            logger.warning("Could not save transcription history: %s", e)

    return PipelineResponse(
        raw_transcript    = result.raw_transcript,
        clean_text        = result.clean_text,
        language          = result.language,
        confidence        = result.confidence,
        model_used        = result.model_used,
        audio_base64      = result.audio_base64,
        audio_url         = audio_url,
        duration_ms       = result.duration_ms,
        pipeline_ms       = result.pipeline_ms,
        navigation_intent = result.navigation_intent,
    )

from pydantic import BaseModel as _BaseModel

class CorrectionRequest(_BaseModel):
    text:     str
    language: str = "en"

class CorrectionResponse(_BaseModel):
    original:  str
    clean_text: str

@router.post("/correct", response_model=CorrectionResponse)
async def correct_text(req: CorrectionRequest):
    import anthropic, os

    original = req.text.strip()
    if not original:
        return CorrectionResponse(original=original, clean_text=original)

    lang_label = "Luganda" if req.language == "lg" else "English"

    try:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        prompt = (
            f"You are correcting a speech-to-text transcription from a Ugandan speaker.\n"
            f"Language: {lang_label}\n"
            f"Input: \"{original}\"\n\n"
            f"Fix only genuine errors: grammar from Luganda interference, stutters, "
            f"filler words (um, uh, eh), repeated words, mis-transcribed Ugandan place names.\n"
            f"Do NOT rephrase or change meaning. Return ONLY the corrected text, nothing else."
        )
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}]
        )
        corrected = message.content[0].text.strip().strip('"')
    except Exception as e:
        logger.warning("AI correction failed: %s", e)
        corrected = original

    return CorrectionResponse(original=original, clean_text=corrected)