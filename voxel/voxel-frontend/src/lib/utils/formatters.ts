/**
 * Format a recording duration in milliseconds → "0:12"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes      = Math.floor(totalSeconds / 60)
  const seconds      = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Format a confidence score (0–1) → "94%"
 */
export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`
}

/**
 * Format a relative timestamp → "2 minutes ago"
 */
export function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s    = Math.floor(diff / 1000)
  if (s < 60)   return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h} hour${h > 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d > 1 ? 's' : ''} ago`
}

/**
 * Truncate text to a given length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Capitalise first letter
 */
export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
