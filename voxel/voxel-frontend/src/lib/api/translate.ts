import { apiClient } from './client'
import type { TranslationResponse, Language } from '@/types'

export async function translateText(
  text:       string,
  sourceLang: Language,
  targetLang: Language
): Promise<TranslationResponse> {
  const { data } = await apiClient.post<TranslationResponse>('/translate', {
    text,
    source_lang: sourceLang,
    target_lang: targetLang,
  })
  return data
}

export async function getSupportedLanguages(): Promise<{ code: string; name: string }[]> {
  const { data } = await apiClient.get('/translate/languages')
  return data
}
