"""
Sessions Router — GET/DELETE /api/v1/sessions
Uses the Supabase SERVICE KEY (bypasses RLS) so authenticated users
can always read and delete their own sessions.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.middleware.auth  import get_current_user
from app.db.supabase      import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


class Session(BaseModel):
    id:          str
    transcript:  Optional[str]  = None
    clean_text:  Optional[str]  = None
    language:    Optional[str]  = None
    created_at:  Optional[str]  = None
    confidence:  Optional[float] = None
    model_used:  Optional[str]  = None
    audio_url:   Optional[str]  = None


class DeleteRequest(BaseModel):
    ids: Optional[List[str]] = None   # if None → delete ALL for this user


@router.get("", response_model=List[Session])
async def get_sessions(user = Depends(get_current_user)):
    """Return all sessions for the authenticated user, newest first."""
    user_id  = user["sub"]
    supabase = get_supabase()
    try:
        result = (
            supabase.table("transcription_history")
            .select("id, transcript, clean_text, language, created_at, confidence, model_used, audio_url")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error("Failed to fetch sessions: %s", e)
        raise HTTPException(status_code=500, detail="Could not fetch sessions")


@router.delete("", status_code=204)
async def delete_sessions(req: DeleteRequest, user = Depends(get_current_user)):
    """
    Delete sessions for the authenticated user.
    - Pass { "ids": ["id1", "id2"] } to delete specific sessions.
    - Pass {} or { "ids": null } to delete ALL sessions for this user.
    """
    user_id  = user["sub"]
    supabase = get_supabase()
    try:
        query = (
            supabase.table("transcription_history")
            .delete()
            .eq("user_id", user_id)   # always scope to this user
        )
        if req.ids:
            query = query.in_("id", req.ids)
        result = query.execute()
        logger.info("Deleted %s sessions for user %s", len(req.ids or []) or "all", user_id)
    except Exception as e:
        logger.error("Failed to delete sessions: %s", e)
        raise HTTPException(status_code=500, detail="Could not delete sessions")