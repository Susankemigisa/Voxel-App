// For local dev: use your machine's LAN IP, not localhost
// (Android emulator/device can't reach localhost:8000)
// Change this to your deployed URL when deploying
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000'
// Note: 10.0.2.2 is Android emulator's alias for host machine localhost
// For a real device on same WiFi, use your machine's IP e.g. http://192.168.1.x:8000

export async function apiPost<T>(
  path: string,
  body: FormData | Record<string, unknown>,
  token?: string | null
): Promise<T> {
  const isFormData = body instanceof FormData
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method:  'POST',
    headers,
    body:    isFormData ? body : JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json()
}
