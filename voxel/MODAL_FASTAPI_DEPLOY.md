# Deploy FastAPI Backend to Modal

This deploys the backend in `voxel/voxel-backend` and exposes a public HTTPS URL.

## 1. Install and authenticate Modal

```bash
pip install modal
modal token new
```

## 2. Create Modal secret for backend env vars

Create a secret named `voxel-backend-env`.

Add required keys from backend `.env`, especially:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_JWT_SECRET`
- `OPENAI_API_KEY`
- `HF_TOKEN`
- `ASR_EN_STRATEGY`
- `ASR_LG_STRATEGY`
- `ASR_MODAL_URL`
- `TTS_STRATEGY`
- `TTS_MODAL_URL`
- `TRANSLATE_STRATEGY`
- `TRANSLATE_MODAL_EN_LG_URL`
- `TRANSLATE_MODAL_LG_EN_URL`
- `NAVIGATION_INTENT_STRATEGY`
- `NAVIGATION_MODAL_URL`

## 3. Deploy

From repository root:

```bash
modal deploy voxel/modal_fastapi_backend.py
```

Modal will print the public URL, for example:

```text
https://<workspace>--voxel-fastapi-backend-fastapi-app.modal.run
```

## 4. Verify

```bash
curl https://<your-url>/api/v1/health
```

## 5. Use in mobile app

```bash
cd voxel/voxel-mobile
EXPO_PUBLIC_API_BASE_URL=https://<your-url> npm run start -- --clear
```

Tap **Test Backend Connection** in the app before running voice tests.

## Notes

- Model cache is persisted in Modal volume `voxel-model-cache`.
- Cold starts can still happen after inactivity.
- Keep inference endpoints on Modal as you already do; this backend route centralizes logging and API access.
