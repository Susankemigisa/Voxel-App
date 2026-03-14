"""
Tests for FastAPI routes — uses TestClient with mocked services.
"""
import base64
import pytest
import io
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.voice_pipeline import PipelineResult
from app.models.schemas import ModelName


# ── Shared mock pipeline result ───────────────────────────────────────────────

def _mock_pipeline_result(**overrides) -> PipelineResult:
    defaults = dict(
        raw_transcript = "i i need help",
        clean_text     = "I need help.",
        language       = "en",
        confidence     = 0.91,
        model_used     = ModelName.WAV2VEC2,
        audio_base64   = base64.b64encode(b"fake-wav").decode(),
        duration_ms    = 1200,
        pipeline_ms    = 850,
        stages         = [],
    )
    defaults.update(overrides)
    return PipelineResult(**defaults)


def _wav_file_bytes() -> bytes:
    """Minimal valid WAV for multipart upload."""
    import wave, struct
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16_000)
        wf.writeframes(b"\x00\x00" * 160)
    buf.seek(0)
    return buf.read()


# ── Health endpoint ───────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200

    def test_health_has_status_field(self, client):
        data = client.get("/api/v1/health").json()
        assert "status" in data
        assert data["status"] in ("ok", "degraded")

    def test_health_has_models_list(self, client):
        data = client.get("/api/v1/health").json()
        assert "models" in data
        assert isinstance(data["models"], list)

    def test_root_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200


# ── Pipeline endpoint ─────────────────────────────────────────────────────────

class TestPipelineEndpoint:
    @patch("app.routers.pipeline.voice_pipeline.process", new_callable=AsyncMock)
    def test_process_returns_200(self, mock_process, client):
        mock_process.return_value = _mock_pipeline_result()

        resp = client.post(
            "/api/v1/pipeline/process",
            files={"audio": ("test.wav", _wav_file_bytes(), "audio/wav")},
            data={"language": "en", "output_mode": "both"},
        )
        assert resp.status_code == 200

    @patch("app.routers.pipeline.voice_pipeline.process", new_callable=AsyncMock)
    def test_process_response_shape(self, mock_process, client):
        mock_process.return_value = _mock_pipeline_result()

        data = client.post(
            "/api/v1/pipeline/process",
            files={"audio": ("test.wav", _wav_file_bytes(), "audio/wav")},
            data={"language": "en", "output_mode": "both"},
        ).json()

        assert "raw_transcript" in data
        assert "clean_text"     in data
        assert "confidence"     in data
        assert "pipeline_ms"    in data

    def test_process_empty_audio_returns_422(self, client):
        resp = client.post(
            "/api/v1/pipeline/process",
            files={"audio": ("test.wav", b"", "audio/wav")},
            data={"language": "en"},
        )
        assert resp.status_code == 422

    def test_process_missing_audio_returns_422(self, client):
        resp = client.post(
            "/api/v1/pipeline/process",
            data={"language": "en"},
        )
        assert resp.status_code == 422

    @patch("app.routers.pipeline.voice_pipeline.process", new_callable=AsyncMock)
    def test_process_visual_mode_no_audio(self, mock_process, client):
        mock_process.return_value = _mock_pipeline_result(audio_base64=None)

        data = client.post(
            "/api/v1/pipeline/process",
            files={"audio": ("test.wav", _wav_file_bytes(), "audio/wav")},
            data={"language": "en", "output_mode": "visual"},
        ).json()

        assert data["audio_base64"] is None

    @patch("app.routers.pipeline.voice_pipeline.process", new_callable=AsyncMock)
    def test_process_luganda_language(self, mock_process, client):
        mock_process.return_value = _mock_pipeline_result(language="lg")

        resp = client.post(
            "/api/v1/pipeline/process",
            files={"audio": ("test.wav", _wav_file_bytes(), "audio/wav")},
            data={"language": "lg", "output_mode": "both"},
        )
        assert resp.status_code == 200
        _, kwargs = mock_process.call_args
        assert kwargs.get("language").value == "lg" or mock_process.call_args[0][1].value == "lg"


# ── TTS endpoint ──────────────────────────────────────────────────────────────

class TestTTSEndpoint:
    @patch("app.routers.tts.tts_service.synthesize", new_callable=AsyncMock)
    def test_synthesize_returns_200(self, mock_synth, client, mock_tts_result):
        mock_synth.return_value = mock_tts_result

        resp = client.post("/api/v1/tts/synthesize", json={
            "text": "Hello, I need assistance.",
            "language": "en",
            "voice": "female",
            "pitch": 0.5,
            "rate": 0.6,
        })
        assert resp.status_code == 200

    @patch("app.routers.tts.tts_service.synthesize", new_callable=AsyncMock)
    def test_synthesize_response_has_audio(self, mock_synth, client, mock_tts_result):
        mock_synth.return_value = mock_tts_result

        data = client.post("/api/v1/tts/synthesize", json={
            "text": "Hello.",
            "language": "en",
        }).json()

        assert "audio_base64" in data
        assert "duration_ms"  in data

    def test_synthesize_empty_text_returns_422(self, client):
        resp = client.post("/api/v1/tts/synthesize", json={"text": ""})
        assert resp.status_code == 422


# ── Translation endpoint ──────────────────────────────────────────────────────

class TestTranslationEndpoint:
    @patch("app.routers.translate.translation_service.translate", new_callable=AsyncMock)
    def test_translate_en_to_lg(self, mock_translate, client):
        from app.services.translation_service import TranslationResult
        mock_translate.return_value = TranslationResult(
            source_text = "Where is the exit?",
            translated  = "Omulyango gwa ku buwanguzi guli ludda lwa?",
            source_lang = "en",
            target_lang = "lg",
            model_used  = "Helsinki-NLP/opus-mt-en-lg",
        )
        resp = client.post("/api/v1/translate/", json={
            "text":        "Where is the exit?",
            "source_lang": "en",
            "target_lang": "lg",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "translated" in data

    def test_get_languages_returns_list(self, client):
        data = client.get("/api/v1/translate/languages").json()
        assert "languages" in data
        codes = [l["code"] for l in data["languages"]]
        assert "en" in codes
        assert "lg" in codes


# ── Auth endpoint ─────────────────────────────────────────────────────────────

class TestAuthEndpoint:
    @patch("app.routers.auth.get_current_user")
    def test_verify_valid_token(self, mock_auth, client, mock_auth_user, auth_headers):
        from app.middleware.auth import get_current_user
        from app.main import app
        app.dependency_overrides[get_current_user] = lambda: mock_auth_user

        resp = client.post("/api/v1/auth/verify", headers=auth_headers)
        assert resp.status_code == 200
        app.dependency_overrides.clear()

    def test_verify_missing_token_returns_401(self, client):
        resp = client.post("/api/v1/auth/verify")
        assert resp.status_code == 401
