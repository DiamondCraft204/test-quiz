import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  const verifySession = useCallback(async () => {
    const currentToken = localStorage.getItem('token')
    if (!currentToken) {
      setLoading(false)
      return
    }
    try {
      const res = await api.get('/auth/me')
      if (res.data?.data?.user) {
        setUser(res.data.data.user)
        localStorage.setItem('user', JSON.stringify(res.data.data.user))
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    verifySession()
  }, [verifySession])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { token: t, user: u } = res.data.data
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password })
    const { token: t, user: u } = res.data.data
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
    return u
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
