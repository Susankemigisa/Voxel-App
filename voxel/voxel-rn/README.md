# Voxel React Native (Expo)

AI-powered speech assistance for Uganda — English & Luganda.

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key  
- `EXPO_PUBLIC_API_URL` — your backend URL

**For Android emulator (local dev):** use `http://10.0.2.2:8000`  
**For real device on same WiFi:** use `http://192.168.x.x:8000` (your machine's LAN IP)  
**For deployed backend:** use your Railway/Render URL

### 3. Run on device / emulator
```bash
npm start          # Opens Expo Go QR code
npm run android    # Needs Android Studio
```

---

## 📱 Building the APK (No Android Studio needed)

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Log in to Expo
```bash
eas login
# Create account at expo.dev if you don't have one (free)
```

### Step 3: Configure the project
```bash
eas build:configure
```

### Step 4: Build the APK
```bash
npm run build:apk
# or: eas build --platform android --profile apk
```
This builds in the cloud — no Android Studio needed. Takes 5–15 minutes.
Download the `.apk` from the link EAS gives you and install on any Android phone.

### Step 5: Install on Android
- Download the `.apk` file to your phone
- Enable "Install from unknown sources" in Settings → Security
- Open the `.apk` to install

---

## 🍎 Building for iOS
iOS requires an Apple Developer account ($99/year) and a Mac with Xcode.
```bash
eas build --platform ios --profile preview
```

---

## 🧠 Features

### Smart Correction (AI)
After every transcription, the Voice screen sends the cleaned text to the backend
for further AI correction. A suggestion card appears if the AI finds improvements.
The user can accept or dismiss the suggestion.

**Offline fallback:** When offline, local rule-based corrections are applied
(Ugandan speech patterns, city name fixes, stutter removal).

### Offline Mode
- **Detection:** Polls `google.com/generate_204` every 10s
- **Recording:** Shows offline banner; user is warned before recording
- **Storage:** Pending sessions stored in AsyncStorage
- **Sync:** When back online, a "tap to sync" banner appears to upload pending sessions
- **Correction cache:** AI corrections are cached locally — common corrections work offline

---

## 📁 Project Structure

```
voxel-rn/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout + AuthGate
│   ├── (auth)/             # Login, Register
│   ├── (tabs)/             # Home, Voice, Navigate, TTS, Profile, Settings
│   └── sessions.tsx        # Full sessions history
├── src/
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client
│   │   ├── api.ts          # Backend API calls
│   │   ├── offlineStore.ts # AsyncStorage for offline data
│   │   └── theme.ts        # Colors, radius constants
│   ├── hooks/
│   │   ├── useNetworkStatus.ts   # Online/offline detection
│   │   ├── useSmartCorrection.ts # AI + local correction
│   │   └── useNavigationIntent.ts
│   └── store/
│       └── authStore.ts    # Zustand store (persisted)
├── app.json                # Expo config
├── eas.json                # Build profiles
└── .env.example            # Environment template
```

---

## 🔧 Backend Note

The backend (`voxel-backend`) must be running for Voice Input and TTS to work.
The Navigate screen uses OpenStreetMap (free, no backend needed).

When deploying the backend to Railway/Render, update `EXPO_PUBLIC_API_URL` in `.env`
to your deployed URL and rebuild the app.
