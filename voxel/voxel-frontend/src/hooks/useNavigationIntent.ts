// Detects navigation intent from ASR transcript and extracts destination
// Supports English and Luganda phrases

const EN_TRIGGERS = [
  'take me to', 'navigate to', 'go to', 'directions to', 'how do i get to',
  'i want to go to', 'i need to go to', 'bring me to', 'head to',
  'route to', 'find route to', 'get me to', 'drive to', 'walk to',
]

const LG_TRIGGERS = [
  'ntwala e', 'ntwale e', 'ntwala ku', 'ntwale ku', 'genda e', 'genda ku',
  'nsomeze', 'genda', 'njigiriza', 'nsobola otya okugenda', 'nsobola ngenda',
  'nfuna ekkubo okutuuka', 'ngenda', 'nkolere ekkubo',
]

// Common Ugandan destinations for quick matching
const UGANDA_PLACES = [
  'kampala', 'entebbe', 'jinja', 'mbale', 'gulu', 'mbarara', 'fort portal',
  'fortportal', 'lira', 'arua', 'soroti', 'kabale', 'masaka', 'tororo',
  'ntinda', 'kawempe', 'nakawa', 'makindye', 'rubaga', 'kireka', 'naalya',
  'mukono', 'wakiso', 'bweyogerere', 'kyaliwajjala', 'kira', 'namugongo',
  'gayaza', 'matugga', 'bombo', 'luwero', 'wobulenzi', 'zirobwe',
  'kololo', 'naguru', 'bukoto', 'kamwokya', 'mulago', 'wandegeya',
  'makerere', 'kivulu', 'nakulabye', 'lubaga', 'mengo', 'nsambya',
  'bugolobi', 'luzira', 'portbell', 'muyenga', 'ggaba', 'kabalagala',
  'kisugu', 'namuwongo', 'katwe', 'kisenyi', 'old taxi park', 'new taxi park',
  'owino', 'nakasero', 'city centre', 'garden city', 'acacia mall',
  'palace of the republic', 'parliament', 'makerere university',
  'mulago hospital', 'kampala hospital', 'aga khan', 'case hospital',
  'entebbe airport', 'entebbe international airport',
  'kyebando', 'mpigi',
]

export interface NavigationIntent {
  isNavigation: boolean
  destination: string
  query: string       // full Google Maps search query
  confidence: number
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[.,!?'"]/g, '').replace(/\s+/g, ' ').trim()
}

export function detectNavigationIntent(transcript: string): NavigationIntent {
  const text = normalise(transcript)

  // Check English triggers
  for (const trigger of EN_TRIGGERS) {
    if (text.includes(trigger)) {
      const after = text.split(trigger)[1]?.trim()
      if (after && after.length > 1) {
        return {
          isNavigation: true,
          destination: formatDestination(after),
          query: buildQuery(after),
          confidence: 0.95,
        }
      }
    }
  }

  // Check Luganda triggers
  for (const trigger of LG_TRIGGERS) {
    if (text.includes(trigger)) {
      const after = text.split(trigger)[1]?.trim()
      if (after && after.length > 1) {
        return {
          isNavigation: true,
          destination: formatDestination(after),
          query: buildQuery(after),
          confidence: 0.9,
        }
      }
    }
  }

  // Direct place name match (user just said the place name)
  for (const place of UGANDA_PLACES) {
    if (text === place || text.startsWith(place) || text.endsWith(place)) {
      return {
        isNavigation: true,
        destination: formatDestination(place),
        query: buildQuery(place),
        confidence: 0.75,
      }
    }
  }

  // Partial match — if text contains a known Uganda place and is short
  if (text.split(' ').length <= 5) {
    for (const place of UGANDA_PLACES) {
      if (text.includes(place)) {
        return {
          isNavigation: true,
          destination: formatDestination(place),
          query: buildQuery(place),
          confidence: 0.65,
        }
      }
    }
  }

  return { isNavigation: false, destination: '', query: '', confidence: 0 }
}

function formatDestination(raw: string): string {
  return raw
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\b(Uganda|UG)\b/gi, '')
    .trim()
}

function buildQuery(destination: string): string {
  const dest = destination.trim()
  // If it already contains "Uganda" don't double-add
  if (dest.toLowerCase().includes('uganda')) return dest
  return `${formatDestination(dest)}, Uganda`
}
