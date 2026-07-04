import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import * as api from '../lib/api'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: api.AuthUser | null
  loading: boolean
  checkingSession: boolean
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
  // Jesli mamy juz zapisanego usera z poprzedniej sesji (localStorage), nie
  // trzeba czekac na sprawdzenie sesji Supabase - pokazujemy panel od razu.
  // Czekamy tylko gdy NIE mamy nikogo zapisanego, bo to moze byc powrot z
  // przekierowania Google OAuth, ktore jeszcze nie zdazylo dostarczyc sesji.
  const [checkingSession, setCheckingSession] = useState(!user)

  const persist = (u: api.AuthUser | null) => {
    setUser(u)
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    else localStorage.removeItem(STORAGE_KEY)
  }

  // Nasluchuje na sesje Supabase (logowanie przez Google) - po powrocie
  // z ekranu zgody Google, supabase-js samo wychwytuje token z URL i
  // emituje zdarzenie SIGNED_IN, na ktore tutaj reagujemy.
  useEffect(() => {
    // Sprawdzamy tez istniejaca sesje od razu (np. po odswiezeniu strony
    // z aktywna sesja Supabase, zanim onAuthStateChange zdazy cokolwiek wyemitowac)
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setCheckingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        api.setToken(session.access_token)
        try {
          const me = await api.getMe()
          persist(me.user as api.AuthUser)
        } catch {
          // Token Supabase jest OK, ale backend go jeszcze nie rozpoznaje -
          // ciche niepowodzenie, user zobaczy stan niezalogowany.
        }
      }
      setCheckingSession(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

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
    supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, checkingSession, login: doLogin, register: doRegister, logout: doLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musi byc uzyte wewnatrz AuthProvider')
  return ctx
}
