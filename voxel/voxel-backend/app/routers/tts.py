import logging
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth     import get_optional_user
from app.models.schemas      import TTSRequest, TTSResponse
from app.services.tts_service import tts_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["tts"])


@router.post("/synthesize", response_model=TTSResponse)
async def synthesize(
    req:  TTSRequest,
    user = Depends(get_optional_user),
):
    """Convert text to speech. Returns base64-encoded WAV audio."""
    try:
        result = await tts_service.synthesize(
            text     = req.text,
            language = req.language,
            voice    = req.voice,
            pitch    = req.pitch,
            rate     = req.rate,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return TTSResponse(
        audio_base64 = result.audio_base64,
        duration_ms  = result.duration_ms,
        sample_rate  = result.sample_rate,
        voice        = result.voice,
        text         = req.text,
    )
