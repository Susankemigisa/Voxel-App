import { useCallback } from 'react'
import { apiPost } from '../lib/api'
import { getCachedCorrection, saveCorrectionToCache } from '../lib/offlineStore'

// Common Ugandan speech patterns to fix locally when offline
const LOCAL_RULES: Array<{ pattern: RegExp; fix: string }> = [
  // Luganda interference patterns
  { pattern: /\bwant going\b/gi,        fix: 'want to go'         },
  { pattern: /\bi am want\b/gi,         fix: 'I want'             },
  { pattern: /\bcan you tell me where is\b/gi, fix: 'where is'   },
  { pattern: /\btake me going to\b/gi,  fix: 'take me to'         },
  { pattern: /\bi need going\b/gi,      fix: 'I need to go'       },
  { pattern: /\bhelp me to find\b/gi,   fix: 'help me find'       },
  { pattern: /\bwhere can i find\b/gi,  fix: 'where is'           },
  // Common mis-transcriptions
  { pattern: /\bkam pala\b/gi,          fix: 'Kampala'            },
  { pattern: /\bent e bbe\b/gi,         fix: 'Entebbe'            },
  { pattern: /\bm kono\b/gi,            fix: 'Mukono'             },
  { pattern: /\bntind a\b/gi,           fix: 'Ntinda'             },
  { pattern: /\bkawem pe\b/gi,          fix: 'Kawempe'            },
  // Stutters / repetition
  { pattern: /\b(\w+) \1\b/gi,         fix: '$1'                 },
  // Filler words
  { pattern: /\b(um|uh|eh|ah|er)\s/gi, fix: ''                   },
  // Clean up multiple spaces
  { pattern: /\s{2,}/g,                fix: ' '                  },
]

function applyLocalRules(text: string): string {
  let result = text
  for (const rule of LOCAL_RULES) {
    result = result.replace(rule.pattern, rule.fix)
  }
  return result.trim()
}

export interface CorrectionResult {
  original:  string
  corrected: string
  source:    'ai' | 'cache' | 'local' | 'none'
  changed:   boolean
}

export function useSmartCorrection() {
  const correct = useCallback(async (
    text: string,
    language: 'en' | 'lg',
    isOnline: boolean
  ): Promise<CorrectionResult> => {
    const trimmed = text.trim()
    if (!trimmed) return { original: text, corrected: text, source: 'none', changed: false }

    // 1. Try cache first (fast, works offline)
    const cached = await getCachedCorrection(trimmed, language)
    if (cached) {
      return { original: trimmed, corrected: cached, source: 'cache', changed: cached !== trimmed }
    }

    // 2. Online: call AI backend
    if (isOnline) {
      try {
        const data = await apiPost<{ clean_text: string }>('/pipeline/correct', {
          text: trimmed,
          language,
        })
        const corrected = data.clean_text ?? trimmed
        // Cache the result for future offline use
        await saveCorrectionToCache(trimmed, corrected, language)
        return { original: trimmed, corrected, source: 'ai', changed: corrected !== trimmed }
      } catch {
        // Backend failed — fall through to local rules
      }
    }

    // 3. Offline: apply local rule-based corrections
    const localFixed = applyLocalRules(trimmed)
    if (localFixed !== trimmed) {
      await saveCorrectionToCache(trimmed, localFixed, language)
    }
    return {
      original: trimmed,
      corrected: localFixed,
      source: 'local',
      changed: localFixed !== trimmed,
    }
  }, [])

  return { correct }
}
