"""
JWT authentication middleware.
Validates Supabase-issued JWTs on every protected route.
"""
import logging
from typing import Optional

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
) -> dict:
    """
    FastAPI dependency — validates the Bearer token and returns the JWT payload.

    Usage:
        @router.post("/endpoint")
        async def my_endpoint(user = Depends(get_current_user)):
            user_id = user["sub"]
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Authentication required",
            headers     = {"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms = ["HS256"],
            options    = {"verify_aud": False},   # Supabase sets aud="authenticated"
        )
        return payload

    except JWTError as e:
        logger.warning("JWT validation failed: %s", e)
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Invalid or expired token",
            headers     = {"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
) -> Optional[dict]:
    """
    Same as get_current_user but returns None instead of raising for unauthenticated requests.
    Use on endpoints that work for both authenticated and anonymous users.
    """
    if credentials is None or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
