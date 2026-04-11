import axios from 'axios'
import { useAuthStore } from '@/lib/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
export { API_URL }

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30_000,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
