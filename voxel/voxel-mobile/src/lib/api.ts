/**
 * Voxel Mobile — API client
 * Connects to the FastAPI backend on Modal.
 */

import { BACKEND_BASE_URL, API_PREFIX } from "../config";

const BASE = `${BACKEND_BASE_URL}${API_PREFIX}`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Language   = "en" | "lg";
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

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body:   form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${BACKEND_BASE_URL}${API_PREFIX}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

// ── Pipeline (ASR → clean → TTS) ─────────────────────────────────────────────

/**
 * Returns the full pipeline endpoint URL — useful for streaming or
 * passing to a WebView / native audio recorder directly.
 */
export function pipelineEndpointUrl(): string {
  return `${BASE}/pipeline/process`;
}

/**
 * Run the full voice pipeline: send audio blob → get transcript + audio.
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
  // React Native FormData accepts { uri, name, type }
  const file = audioBlob as unknown as { uri?: string };
  if (file.uri) {
    // Native path (expo-av recording)
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
  if (options.pitch != null) form.append("pitch", String(options.pitch));
  if (options.rate  != null) form.append("rate",  String(options.rate));

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