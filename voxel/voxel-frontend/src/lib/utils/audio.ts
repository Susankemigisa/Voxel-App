export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function base64ToAudioUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

export function isRecordingSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    navigator.mediaDevices &&
    typeof MediaRecorder !== 'undefined'
  )
}
