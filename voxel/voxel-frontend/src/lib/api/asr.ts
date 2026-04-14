import { apiClient } from './client'
import type { PipelineResponse, Language, OutputMode } from '@/types'

interface PipelineOptions {
  language:   Language
  outputMode: OutputMode
}

export async function runPipeline(
  audio: Blob,
  options: PipelineOptions,
): Promise<PipelineResponse> {
  const form = new FormData()
  form.append('audio', audio, 'recording.webm')
  form.append('language',    options.language)
  form.append('output_mode', options.outputMode)

  const res = await apiClient.post<PipelineResponse>(
    '/pipeline/process',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 },
  )
  return res.data
}