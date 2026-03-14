import { apiClient } from './client'
import type { ASRResponse, PipelineResponse, Language, OutputMode } from '@/types'

/**
 * Full voice reconstruction pipeline:
 * audio → denoise → ASR → LLM cleanup → (translate) → TTS
 */
export async function runPipeline(
  audioBlob: Blob,
  options: {
    language:    Language
    outputMode:  OutputMode
    translateTo?: Language
  }
): Promise<PipelineResponse> {
  const form = new FormData()
  form.append('audio',       audioBlob, 'recording.wav')
  form.append('language',    options.language)
  form.append('output_mode', options.outputMode)
  if (options.translateTo) {
    form.append('translate_to', options.translateTo)
  }

  const { data } = await apiClient.post<PipelineResponse>(
    '/pipeline/process',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

/**
 * ASR-only transcription (no cleanup/TTS)
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language: Language = 'en'
): Promise<ASRResponse> {
  const form = new FormData()
  form.append('audio',    audioBlob, 'recording.wav')
  form.append('language', language)

  const { data } = await apiClient.post<ASRResponse>(
    '/asr/transcribe',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

/**
 * Save transcription to Supabase history via backend
 */
export async function saveTranscription(payload: {
  transcript:  string
  language:    string
  confidence?: number
  audioUrl?:   string
  modelUsed?:  'wav2vec2' | 'mms'
}): Promise<void> {
  await apiClient.post('/asr/history', payload)
}
