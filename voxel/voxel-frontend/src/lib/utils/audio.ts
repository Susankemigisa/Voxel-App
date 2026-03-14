/**
 * Convert a Blob to a base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])   // strip "data:audio/webm;base64," prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Decode base64 audio string and create a playable URL
 */
export function base64ToAudioUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

/**
 * Estimate audio duration in seconds from a WAV blob
 */
export async function estimateDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url   = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
  })
}

/**
 * Check if the browser supports audio recording
 */
export function isRecordingSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    navigator.mediaDevices &&
    typeof MediaRecorder !== 'undefined'
  )
}

/**
 * Convert audio file size (bytes) to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
