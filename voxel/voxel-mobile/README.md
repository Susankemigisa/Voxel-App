# Voxel Mobile (Expo)

Voxel Mobile is the React Native client for Voxel voice, navigation intent, and TTS workflows.

The app is built with Expo and connects to the Voxel backend over HTTP/HTTPS.

## Features

- Voice recording and pipeline processing (`/api/v1/pipeline/process`)
- TTS synthesis (`/api/v1/tts/synthesize`)
- Navigation intent extraction (`/api/v1/navigation/extract`)
- Route/map viewing inside the app (OpenStreetMap via WebView)
- Editable user preferences (language, voice, pitch, speech rate)

## Prerequisites

- Node.js 18+
- npm 9+
- Expo Go app on Android/iOS, or Android emulator/iOS simulator
- Running backend (local or deployed)

## Project location

Run all mobile commands from this directory:

`voxel/voxel-mobile`

## Install

```bash
cd voxel/voxel-mobile
npm install
```

## Environment setup

Create your local env file from the template:

```bash
cp .env.example .env
```

Set backend URL in `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.example.com
```

Notes:

- Use a public HTTPS URL for physical devices.
- If using Android emulator with local backend, use `http://10.0.2.2:8000`.
- After changing `.env`, restart Expo with cache clear.

## Run locally

```bash
cd voxel/voxel-mobile
npm run start:clear
```

Then:

1. Scan QR with Expo Go, or open Android/iOS simulator.
2. Grant microphone permission.
3. Test Voice, Navigate, TTS, and Profile preferences.

## Available npm scripts

- `npm run start` - start Expo
- `npm run start:clear` - start Expo and clear cache
- `npm run android` - open Android target
- `npm run ios` - open iOS target
- `npm run web` - run Expo web target
- `npm run typecheck` - TypeScript check (`tsc --noEmit`)
- `npm run eas:login` - login to Expo/EAS
- `npm run build:apk` - cloud APK build (EAS)
- `npm run build:apk:local` - local APK build (EAS local)

## Backend options

### Option A: Use deployed backend (recommended)

Set `EXPO_PUBLIC_API_BASE_URL` to your deployed backend URL, for example Modal/Railway.

Health check:

```bash
curl https://<your-service>/api/v1/health
```

### Option B: Use local backend

- Start backend from `voxel/voxel-backend`
- For Android emulator, set URL to `http://10.0.2.2:8000`
- For physical device, use your laptop LAN IP (same Wi-Fi)

## Modal backend quick deploy (if needed)

From `voxel/`:

```bash
modal deploy modal_fastapi_backend.py
```

Do not run `modal run modal_fastapi_backend.py` for this service deployment.

Small end-to-end setup:

1. Create/update Modal secret with backend env values:

```bash
cd voxel/voxel-backend
modal secret create voxel-backend-env $(grep -v '^#' .env | xargs)
```

2. Deploy FastAPI service:

```bash
cd ../
modal deploy modal_fastapi_backend.py
```

3. Copy the Modal URL from deploy output and verify health:

```bash
curl https://<your-modal-url>/api/v1/health
```

4. Use that URL in `voxel/voxel-mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://<your-modal-url>
```

5. Restart mobile app:

```bash
cd voxel/voxel-mobile
npm run start:clear
```

## How to test core flows

### 1) Voice pipeline flow

1. Open `Voice` tab.
2. Tap `Start Recording`, speak, then `Stop + Process`.
3. Verify raw transcript, cleaned text, confidence, and audio playback.
4. If navigation is detected, use `View Route`.

### 2) Navigation flow

1. Open `Navigate` tab.
2. Enter phrase like `Take me to Kampala` or `Njagala genda Kampala`.
3. Tap `Extract Destination`.
4. Verify destination card, confidence, and tap `View Route` for map.

### 3) TTS flow

1. Open `TTS` tab.
2. Enter text.
3. Tap `Synthesize`.
4. Tap `Play Audio`.

### 4) Preferences flow

1. Open `Profile` tab.
2. Edit language, voice, pitch, and speech rate.
3. Re-run Voice/TTS and verify new settings are applied.

## APK build for testers

```bash
cd voxel/voxel-mobile
npm run eas:login
npm run build:apk
```

For local build:

```bash
npm run build:apk:local
```

Make sure `app.json` Android package is set (`com.cdli.voxelmobile`) and env vars are configured in `eas.json` or `.env` as required.

## Troubleshooting

### `AxiosError: Network Error`

- Confirm backend is running and reachable from your device.
- Verify `EXPO_PUBLIC_API_BASE_URL` is correct and includes protocol.
- If on phone, avoid localhost unless tunneled/public.
- Restart Expo after env change:

```bash
npm run start:clear
```

### Navigation falls back to local extraction

If backend logs show Modal navigation timeout/fallback:

- Check navigation upstream endpoint health.
- Increase backend navigation timeout if needed.
- Confirm backend still returns destination from local strategy.

### Map does not render

- Ensure internet is available (OpenStreetMap tiles and routing are remote).
- Try again with a known destination (e.g., Kampala, Jinja, Gulu).
- Verify `View Route` is tapped after destination extraction.

### Audio issues

- Ensure microphone permission was granted.
- Try stopping any other active audio app.
- Keep speech rate at `1.0` in Profile for normal playback speed.

## Developer notes

- Main app entry: `App.tsx`
- API client: `src/lib/api.ts`
- Backend URL config: `.env` via `EXPO_PUBLIC_API_BASE_URL`

## Current scope and next improvements

Current build focuses on feature-complete Voice/Navigate/TTS workflows with map route viewing and editable preferences.

Planned next:

1. Auth + session persistence
2. Saved history/sessions
3. Richer multi-route alternatives in mobile map UI
