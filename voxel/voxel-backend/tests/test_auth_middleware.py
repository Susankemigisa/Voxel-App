"""
Tests for app/middleware/auth.py — JWT validation
"""
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from unittest.mock import patch
from jose import jwt

from app.middleware.auth import get_current_user, get_optional_user
from app.config import get_settings

settings = get_settings()


def _make_token(payload: dict) -> str:
    """Sign a JWT with the test secret."""
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_valid_token_returns_payload(self):
        payload = {"sub": "user-123", "email": "test@voxel.app", "role": "authenticated"}
        token   = _make_token(payload)
        creds   = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        result = await get_current_user(creds)

        assert result["sub"]   == "user-123"
        assert result["email"] == "test@voxel.app"

    @pytest.mark.asyncio
    async def test_missing_credentials_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            await get_current_user(None)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-real-token")
        with pytest.raises(HTTPException) as exc:
            await get_current_user(creds)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_secret_raises_401(self):
        payload = {"sub": "user-123"}
        token   = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        creds   = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc:
            await get_current_user(creds)
        assert exc.value.status_code == 401


class TestGetOptionalUser:
    @pytest.mark.asyncio
    async def test_valid_token_returns_payload(self):
        payload = {"sub": "user-123"}
        token   = _make_token(payload)
        creds   = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        result = await get_optional_user(creds)
        assert result is not None
        assert result["sub"] == "user-123"

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self):
        result = await get_optional_user(None)
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self):
        creds  = HTTPAuthorizationCredentials(scheme="Bearer", credentials="garbage")
        result = await get_optional_user(creds)
        assert result is None
