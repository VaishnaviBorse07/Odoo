import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise: Promise<{ access_token: string; refresh_token: string }> | null = null

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        // Skip refresh if no token — avoids 422 and logout loop after failed login
        if (!refreshToken) throw new Error('no refresh token')
        if (!refreshPromise) {
          refreshPromise = axios
            .post('/api/auth/refresh', { refresh_token: refreshToken })
            .then((response) => response.data)
            .finally(() => {
              refreshPromise = null
            })
        }
        const data = await refreshPromise
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
