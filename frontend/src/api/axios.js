import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://ruangkuis-backend.vercel.app/api');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register') &&
        !window.location.pathname.startsWith('/admin')
      ) {
        const currentPath = window.location.pathname + window.location.search
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}&expired=1`
      }
    }
    return Promise.reject(error)
  }
)

// Admin axios instance
export const adminApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('adminToken')
      if (!window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
