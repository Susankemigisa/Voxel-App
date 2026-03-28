import axios from 'axios'
import { useAuthStore } from '@/lib/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const isDev = process.env.NODE_ENV !== 'production'

export { API_URL }

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30_000,  // 30s – model inference can be slow
})

// ── Attach JWT to every request ──────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (isDev) {
    const method = (config.method ?? 'GET').toUpperCase()
    const path = config.url ?? ''
    const target = `${config.baseURL ?? ''}${path}`
    console.info('[API request]', { method, target })
  }

  return config
})

// ── Global error handling ────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (isDev) {
      const target = `${err.config?.baseURL ?? ''}${err.config?.url ?? ''}`
      console.error('[API error]', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        target,
        data: err.response?.data,
      })
    }

    if (err.code === 'ERR_NETWORK') {
      err.message = `Network Error: cannot reach backend at ${API_URL}. Check backend port and CORS allowed origins.`
    }

    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
