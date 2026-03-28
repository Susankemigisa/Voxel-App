# Voxel Modal Platform Setup Guide

## 1. Overview

This project now supports a remote-inference platform on Modal to reduce backend model load and startup weight.

The backend can route each stage to Modal endpoints:

- ASR: speech to text
- Translation: en <-> lg
- TTS: text to speech

Current deployment model supports a single Modal app with multiple routes:

- `POST /asr/transcribe`
- `POST /translate`
- `POST /tts/synthesize`
- `GET /health`

---

## 2. What Changed

### Backend strategy routing

Routing is configuration-driven through `.env` and `app/config.py`.

Supported strategy values per stage:

- `modal`: use Modal endpoint only
- `auto`: try Modal first, fallback locally (or HF where configured)
- `local`: local model only

ASR also supports `inference` (HF inference API only).

### Files involved

- Combined Modal app: `voice_endpoints.py`
- Optional separate Modal apps:
  - `whisper_endpoint.py`
  - `translate_endpoint.py`
  - `tts_endpoint.py`
- Backend services:
  - `voxel-backend/app/services/asr_service.py`
  - `voxel-backend/app/services/translation_service.py`
  - `voxel-backend/app/services/tts_service.py`
  - `voxel-backend/app/services/model_loader.py`
- Backend settings:
  - `voxel-backend/app/config.py`
  - `voxel-backend/.env`

---

## 3. Prerequisites

- Modal CLI installed
- Logged into Modal
- Modal secret created for Hugging Face token (name: `huggingface-secret`)
- Python 3.11 supported in Modal image

Useful checks:

```bash
modal --version
modal app list
```

---

## 4. Deploy The Combined Platform (Single App)

From the `voxel` folder:

```bash
modal deploy voice_endpoints.py
```

After deployment, Modal outputs a base URL like:

```text
https://<workspace>--voxel-voice-endpoints-<suffix>.modal.run
```

Route mapping:

- ASR URL: `<BASE_URL>/asr/transcribe`
- Translation URL: `<BASE_URL>/translate`
- TTS URL: `<BASE_URL>/tts/synthesize`

---

## 5. Configure Backend Environment

Update `voxel-backend/.env` with your deployed route URLs.

Recommended production profile (Modal-first):

```env
ASR_EN_STRATEGY=modal
TRANSLATE_STRATEGY=modal
TTS_STRATEGY=modal

ASR_MODAL_URL=<BASE_URL>/asr/transcribe
ASR_MODAL_TOKEN=
ASR_MODAL_TIMEOUT_S=90

TRANSLATE_MODAL_EN_LG_URL=<BASE_URL>/translate
TRANSLATE_MODAL_LG_EN_URL=<BASE_URL>/translate
TRANSLATE_MODAL_TOKEN=
TRANSLATE_MODAL_TIMEOUT_S=45

TTS_MODAL_URL=<BASE_URL>/tts/synthesize
TTS_MODAL_TOKEN=
TTS_MODAL_TIMEOUT_S=90
```

Safer rollout profile (fallback enabled):

```env
ASR_EN_STRATEGY=auto
TRANSLATE_STRATEGY=auto
TTS_STRATEGY=auto
```

---

## 6. Start Or Restart Services

Backend:

```bash
cd voxel-backend
# activate your venv
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd voxel-frontend
npm run dev
```

---

## 7. Validate Modal Platform Routes

### Health

```bash
curl -sS <BASE_URL>/health
```

Expected shape:

```json
{"status":"ok","device":"cpu|cuda","routes":["/asr/transcribe","/translate","/tts/synthesize"]}
```

### Translation

```bash
curl -sS -X POST <BASE_URL>/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello friend","source_lang":"en","target_lang":"lg"}'
```

### TTS

```bash
curl -sS -X POST <BASE_URL>/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Voxel","language":"en","voice":"female","pitch":0.5,"rate":1.0}'
```

### ASR

```bash
curl -sS -X POST <BASE_URL>/asr/transcribe \
  -F "wav=@/path/to/sample.wav" \
  -F "language=en"
```

---

## 8. Validate End-to-End Through Backend

Call your backend pipeline route as usual:

```bash
curl -sS -X POST http://localhost:8000/api/v1/pipeline/process \
  -F "audio=@/path/to/sample.wav" \
  -F "language=en" \
  -F "output_mode=both"
```

Check backend logs for route usage and fallback events.

---

## 9. Troubleshooting

### Issue: Modal deploy fails with import/name errors

Cause: module-level symbols not available at parse time.

Fix:

- Keep route handlers using simple dict payloads if import timing is sensitive.
- Re-deploy: `modal deploy voice_endpoints.py`.

### Issue: Empty ASR transcription

Cause: test tone or non-speech input.

Fix:

- Test with real spoken WAV.
- Confirm sample rate and audio quality.

### Issue: Backend fails in `modal` mode

Cause: endpoint URL missing or unreachable.

Fix:

- Set strategy to `auto` while validating.
- Confirm route URL and network access.

### Issue: High latency on first request

Cause: cold start and model warmup.

Fix:

- Increase Modal warm window (`SCALEDOWN`).
- Send warmup traffic.

### Issue: Running on CPU when GPU expected

Fix:

- Verify Modal app GPU settings.
- Inspect Modal logs and endpoint `/health` output.

---

## 10. Security Notes

- Do not commit real `.env` secrets.
- Rotate any exposed keys immediately.
- Use Modal secrets where possible for provider tokens.

---

## 11. Rollback Plan

If remote platform is unstable:

1. Set strategies to `local`.
2. Restart backend.
3. Continue operations on local models.
4. Re-enable `auto` once Modal routes are stable.

---

## 12. Optional: Separate Deployments Instead Of One

If you later want independent scaling:

- `modal deploy whisper_endpoint.py`
- `modal deploy translate_endpoint.py`
- `modal deploy tts_endpoint.py`

Then set stage-specific URLs in `.env` as already supported.

---

## 13. Operational Checklist

- [ ] Modal app deployed
- [ ] Base URL captured
- [ ] `.env` routes set
- [ ] Backend restarted
- [ ] `/health` route verified
- [ ] Translation/TTS/ASR route smoke-tested
- [ ] Full pipeline tested from frontend
- [ ] Logs reviewed for fallback behavior
