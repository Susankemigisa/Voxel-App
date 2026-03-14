import logging
from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth          import get_optional_user
from app.models.schemas           import TranslationRequest, TranslationResponse
from app.services.translation_service import translation_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/translate", tags=["translation"])


@router.post("/", response_model=TranslationResponse)
async def translate(
    req:  TranslationRequest,
    user = Depends(get_optional_user),
):
    try:
        result = await translation_service.translate(req.text, req.source_lang, req.target_lang)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return TranslationResponse(
        source_text  = result.source_text,
        translated   = result.translated,
        source_lang  = result.source_lang,
        target_lang  = result.target_lang,
        model_used   = result.model_used,
    )


@router.get("/languages")
async def get_languages():
    """List of supported language pairs."""
    return {
        "languages": [
            {"code": "en", "name": "English",  "flag": "🇬🇧"},
            {"code": "lg", "name": "Luganda",  "flag": "🇺🇬"},
        ],
        "pairs": [
            {"source": "en", "target": "lg"},
            {"source": "lg", "target": "en"},
        ]
    }
