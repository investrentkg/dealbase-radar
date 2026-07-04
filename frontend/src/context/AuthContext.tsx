import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import * as api from '../lib/api'

interface AuthContextValue {
  user: api.AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, referralCode?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'dealbase_radar_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.AuthUser | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(false)

  const persist = (u: api.AuthUser | null) => {
    setUser(u)
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    else localStorage.removeItem(STORAGE_KEY)
  }

  const doLogin = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const { token, user } = await api.login(email, password)
      api.setToken(token)
      persist(user)
    } finally {
      setLoading(false)
    }
  }, [])

  const doRegister = useCallback(async (email: string, password: string, referralCode?: string) => {
    setLoading(true)
    try {
      const { token, user } = await api.register(email, password, referralCode)
      api.setToken(token)
      persist(user)
    } finally {
      setLoading(false)
    }
  }, [])

  const doLogout = useCallback(() => {
    api.setToken(null)
    persist(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login: doLogin, register: doRegister, logout: doLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musi byc uzyte wewnatrz AuthProvider')
  return ctx
}
