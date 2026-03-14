import logging
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from app.middleware.auth       import get_current_user, get_optional_user
from app.models.schemas        import Language, ASRResponse
from app.services.audio_processor import audio_processor
from app.services.asr_service   import asr_service
from app.services.text_reconstructor import text_reconstructor
from app.db.supabase            import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/asr", tags=["asr"])


@router.post("/transcribe", response_model=ASRResponse)
async def transcribe(
    audio:    UploadFile = File(...),
    language: Language   = Form(Language.EN),
    user = Depends(get_optional_user),
):
    """ASR-only endpoint — transcribes audio without TTS output."""
    import time
    t0 = time.monotonic()

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")

    try:
        audio_result = await audio_processor.preprocess(audio_bytes)
        asr_result   = await asr_service.transcribe(audio_result.audio, language)
        recon_result = await text_reconstructor.clean(asr_result.transcript, language.value)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    processing_ms = int((time.monotonic() - t0) * 1000)
    return ASRResponse(
        transcript    = asr_result.transcript,
        clean_text    = recon_result.clean_text,
        language      = asr_result.language,
        confidence    = asr_result.confidence,
        model_used    = asr_result.model_used,
        processing_ms = processing_ms,
    )


@router.post("/history")
async def save_history(
    transcript: str  = Form(...),
    language:   str  = Form(...),
    confidence: float | None = Form(None),
    model_used: str | None   = Form(None),
    user = Depends(get_current_user),
):
    """Save a transcription entry to Supabase history."""
    try:
        supabase = get_supabase()
        supabase.table("transcription_history").insert({
            "user_id":    user["sub"],
            "transcript": transcript,
            "language":   language,
            "confidence": confidence,
            "model_used": model_used,
        }).execute()
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_history(
    limit:  int = 20,
    offset: int = 0,
    user = Depends(get_current_user),
):
    """Fetch user's transcription history from Supabase."""
    try:
        supabase = get_supabase()
        result   = (
            supabase.table("transcription_history")
            .select("*")
            .eq("user_id", user["sub"])
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"items": result.data, "total": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
