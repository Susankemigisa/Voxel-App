import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.middleware.auth import get_optional_user
from app.services.navigation_intent_service import navigation_intent_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/navigation", tags=["navigation"])


class NavigationExtractRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=1000)
    language: str = Field(default="en")


@router.post("/extract")
async def extract_navigation_intent(req: NavigationExtractRequest, user=Depends(get_optional_user)):
    result = await navigation_intent_service.extract(
        transcript=req.transcript,
        language=req.language,
    )
    return {
        "is_navigation": result.is_navigation,
        "destination": result.destination,
        "query": result.query,
        "confidence": result.confidence,
        "corrected_text": result.corrected_text,
        "reason": result.reason,
    }
