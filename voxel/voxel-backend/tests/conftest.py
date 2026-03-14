"""
conftest.py — shared pytest fixtures
"""
import io
import struct
import wave
import pytest
import numpy as np
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app


# ── App client ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    """FastAPI test client — models are mocked so no GPU needed."""
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


# ── Audio fixtures ────────────────────────────────────────────────────────────

def _make_wav(duration_s: float = 1.0, sample_rate: int = 16_000, freq: float = 440.0) -> bytes:
    """Generate a synthetic sine-wave WAV file in memory."""
    n_samples = int(duration_s * sample_rate)
    t         = np.linspace(0, duration_s, n_samples, dtype=np.float32)
    audio     = (np.sin(2 * np.pi * freq * t) * 0.5).astype(np.float32)

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)      # 16-bit
        wf.setframerate(sample_rate)
        pcm = (audio * 32767).astype(np.int16).tobytes()
        wf.writeframes(pcm)
    buf.seek(0)
    return buf.read()


@pytest.fixture
def sample_wav_bytes():
    """1-second 440 Hz sine WAV — valid audio for pipeline tests."""
    return _make_wav(duration_s=1.0)


@pytest.fixture
def sample_audio_array():
    """Raw float32 numpy array at 16 kHz."""
    sr   = 16_000
    t    = np.linspace(0, 1.0, sr, dtype=np.float32)
    return np.sin(2 * np.pi * 440 * t).astype(np.float32)


@pytest.fixture
def empty_wav_bytes():
    """Minimal valid WAV with no audio frames."""
    return _make_wav(duration_s=0.01)


# ── Auth fixtures ─────────────────────────────────────────────────────────────

FAKE_USER_ID = "00000000-0000-0000-0000-000000000001"

@pytest.fixture
def mock_auth_user():
    """Mocked JWT payload returned by get_current_user."""
    return {"sub": FAKE_USER_ID, "email": "test@voxel.app", "role": "authenticated"}


@pytest.fixture
def auth_headers(mock_auth_user):
    """
    Headers that bypass real JWT validation.
    Patch get_current_user in your tests to return mock_auth_user.
    """
    return {"Authorization": "Bearer test-token"}


# ── Service mocks ─────────────────────────────────────────────────────────────

@pytest.fixture
def mock_asr_result():
    from app.services.asr_service import ASRResult
    from app.models.schemas import ModelName
    return ASRResult(
        transcript = "i i need h-help with the the door",
        language   = "en",
        confidence = 0.87,
        model_used = ModelName.WAV2VEC2,
    )


@pytest.fixture
def mock_recon_result():
    from app.services.text_reconstructor import ReconstructionResult
    return ReconstructionResult(
        clean_text    = "I need help with the door.",
        original_text = "i i need h-help with the the door",
        was_modified  = True,
    )


@pytest.fixture
def mock_tts_result():
    import base64
    from app.services.tts_service import TTSResult
    return TTSResult(
        audio_base64 = base64.b64encode(b"fake-wav-bytes").decode(),
        duration_ms  = 1500,
        sample_rate  = 16_000,
        voice        = "female",
        text         = "I need help with the door.",
    )
