/**
 * Voxel Mobile — API client
 * Connects to the FastAPI backend on Modal.
 */

import { BACKEND_BASE_URL, API_PREFIX } from "../config";
import { useAuthStore } from "../store/authStore";

const BASE = `${BACKEND_BASE_URL}${API_PREFIX}`;

/** Get the current access token from the auth store (works outside React components). */
function getToken(): string | null {
  return useAuthStore.getState().accessToken;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Language    = "en" | "lg";
export type VoiceGender = "male" | "female" | "robot";

export interface PipelineResponse {
  raw_transcript:     string;
  clean_text:         string;
  language:           string;
  confidence:         number;
  model_used?:        "whisper" | "wav2vec2" | "mms";
  audio_base64?:      string;
  audio_url?:         string;
  duration_ms?:       number;
  pipeline_ms:        number;
  navigation_intent?: NavigationExtractResponse;
}

export interface NavigationExtractResponse {
  is_navigation:  boolean;
  destination:    string;
  query:          string;
  confidence:     number;
  corrected_text: string;
  reason:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * POST JSON with automatic Modal cold-start retry.
 * Modal apps go to sleep and return 404 "app stopped" on first hit.
 * We retry once after 3s to give it time to wake up.
 */
async function post<T>(path: string, body: object, retries = 1): Promise<T> {
  const url = `${BASE}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Wait 3s before retry to let Modal wake the app up
      await new Promise(r => setTimeout(r, 3000));
    }
    try {
      const token   = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url, {
        method:  "POST",
        headers,
        body:    JSON.stringify(body),
      });
      if (res.status === 404) {
        const text = await res.text().catch(() => res.statusText);
        // Modal "app stopped" error — worth retrying
        if (text.includes("app for invoked web endpoint is stopped") || text.includes("modal-http")) {
          lastError = new Error(`Modal endpoint is starting up, please wait… (${res.status}: ${text})`);
          continue; // retry
        }
        throw new Error(`API ${path} failed (${res.status}): ${text}`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`API ${path} failed (${res.status}): ${text}`);
      }
      return res.json() as Promise<T>;
    } catch (e) {
      if (e instanceof Error && e.message.includes("Modal endpoint is starting up")) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error(`API ${path} failed after retries`);
}

/**
 * POST FormData with automatic Modal cold-start retry.
 */
async function postForm<T>(path: string, form: FormData, retries = 1): Promise<T> {
  const url = `${BASE}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 3000));
    }
    try {
      const token   = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url, {
        method:  "POST",
        headers,
        body:    form,
      });
      if (res.status === 404) {
        const text = await res.text().catch(() => res.statusText);
        if (text.includes("app for invoked web endpoint is stopped") || text.includes("modal-http")) {
          lastError = new Error(`Modal endpoint is starting up, please wait… (${res.status}: ${text})`);
          continue;
        }
        throw new Error(`API ${path} failed (${res.status}): ${text}`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`API ${path} failed (${res.status}): ${text}`);
      }
      return res.json() as Promise<T>;
    } catch (e) {
      if (e instanceof Error && e.message.includes("Modal endpoint is starting up")) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error(`API ${path} failed after retries`);
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${BACKEND_BASE_URL}${API_PREFIX}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

// ── Pipeline (ASR → clean → TTS) ─────────────────────────────────────────────

export function pipelineEndpointUrl(): string {
  return `${BASE}/pipeline/process`;
}

/**
 * Run the full voice pipeline: send audio blob → get transcript + audio.
 * output_mode defaults to "both" so TTS audio is always returned.
 */
export async function runPipeline(
  audioBlob: Blob,
  options: {
    language?:   Language;
    outputMode?: "audio" | "visual" | "both";
    voice?:      VoiceGender;
    pitch?:      number;
    rate?:       number;
  } = {}
): Promise<PipelineResponse> {
  const form = new FormData();
  const file = audioBlob as unknown as { uri?: string };
  if (file.uri) {
    (form as FormData).append("audio", {
      uri:  file.uri,
      name: "recording.m4a",
      type: "audio/m4a",
    } as unknown as Blob);
  } else {
    form.append("audio", audioBlob, "recording.webm");
  }
  form.append("language",    options.language   ?? "en");
  form.append("output_mode", options.outputMode ?? "both");
  if (options.voice) form.append("voice", options.voice);
  if (options.pitch != null) form.append("pitch", String(options.pitch / 100));
  if (options.rate  != null) form.append("rate",  String(options.rate  / 50));

  return postForm<PipelineResponse>("/pipeline/process", form);
}

// ── TTS ───────────────────────────────────────────────────────────────────────

export interface TTSResponse {
  audio_base64: string;
  duration_ms:  number;
  sample_rate:  number;
  voice:        string;
  text:         string;
}

export async function synthesizeTTS(options: {
  text:      string;
  language?: Language;
  voice?:    VoiceGender;
  pitch?:    number;   // 0–100
  rate?:     number;   // 0–100
}): Promise<TTSResponse> {
  return post<TTSResponse>("/tts/synthesize", {
    text:     options.text,
    language: options.language ?? "en",
    voice:    options.voice    ?? "female",
    pitch:    (options.pitch   ?? 50) / 100,
    rate:     (options.rate    ?? 50) / 50,
  });
}

// ── Navigation intent extraction ──────────────────────────────────────────────

export async function extractNavigation(options: {
  transcript:    string;
  language?:     Language;
  country_bias?: string;
}): Promise<NavigationExtractResponse> {
  return post<NavigationExtractResponse>("/navigation/extract", {
    transcript:   options.transcript,
    language:     options.language    ?? "en",
    country_bias: options.country_bias ?? "Uganda",
  });
}
// ── Sessions ──────────────────────────────────────────────────────────────────

export interface Session {
  id:         string
  transcript: string | null
  clean_text: string | null
  language:   string | null
  created_at: string
  confidence: number | null
  model_used: string | null
  audio_url:  string | null
}

/** Fetch all sessions for the current user via the backend (uses service key, bypasses RLS). */
export async function fetchSessions(): Promise<Session[]> {
  const url   = `${BASE}/sessions`
  const token = getToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`fetchSessions failed (${res.status})`)
  return res.json()
}

/** Delete specific sessions by ID, or all sessions if ids is empty/undefined. */
export async function deleteSessions(ids?: string[]): Promise<void> {
  const url   = `${BASE}/sessions`
  const token = getToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(url, {
    method:  'DELETE',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ids: ids && ids.length > 0 ? ids : null }),
  })
  if (!res.ok && res.status !== 204) throw new Error(`deleteSessions failed (${res.status})`)
}