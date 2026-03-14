import logging
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.db.supabase     import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/verify")
async def verify_token(user = Depends(get_current_user)):
    """Verify a Supabase JWT. Returns user ID and email if valid."""
    return {"user_id": user.get("sub"), "email": user.get("email"), "valid": True}


@router.get("/profile")
async def get_profile(user = Depends(get_current_user)):
    """Get the authenticated user's profile from Supabase."""
    try:
        supabase = get_supabase()
        result   = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user["sub"])
            .single()
            .execute()
        )
        return result.data
    except Exception as e:
        raise HTTPException(status_code=404, detail="Profile not found")


@router.get("/preferences")
async def get_preferences(user = Depends(get_current_user)):
    """Get the user's communication preferences."""
    try:
        supabase = get_supabase()
        result   = (
            supabase.table("user_preferences")
            .select("*")
            .eq("user_id", user["sub"])
            .single()
            .execute()
        )
        return result.data or {}
    except Exception:
        return {}


@router.put("/preferences")
async def update_preferences(
    prefs: dict,
    user  = Depends(get_current_user),
):
    """Upsert the user's communication preferences."""
    try:
        supabase = get_supabase()
        supabase.table("user_preferences").upsert({
            "user_id": user["sub"],
            **prefs,
        }).execute()
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/phrases")
async def get_phrases(user = Depends(get_current_user)):
    """Get the user's saved phrases."""
    try:
        supabase = get_supabase()
        result   = (
            supabase.table("saved_phrases")
            .select("*")
            .eq("user_id", user["sub"])
            .order("created_at", desc=True)
            .execute()
        )
        return {"phrases": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/phrases")
async def save_phrase(
    phrase:   str,
    language: str = "en",
    category: str | None = None,
    user = Depends(get_current_user),
):
    """Save a phrase to the user's phrase library."""
    try:
        supabase = get_supabase()
        result   = supabase.table("saved_phrases").insert({
            "user_id":  user["sub"],
            "phrase":   phrase,
            "language": language,
            "category": category,
        }).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/phrases/{phrase_id}")
async def delete_phrase(phrase_id: str, user = Depends(get_current_user)):
    """Delete a saved phrase."""
    try:
        supabase = get_supabase()
        supabase.table("saved_phrases").delete().eq("id", phrase_id).eq("user_id", user["sub"]).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
