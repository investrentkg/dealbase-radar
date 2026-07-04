// ── Klient API dla backendu DealBase Radar ────────────────────────────
// URL backendu ustawiany przez zmienna srodowiskowa VITE_API_URL (Vite
// wymaga prefiksu VITE_ zeby zmienna byla dostepna po stronie klienta).
// Do czasu wdrozenia backendu na Railway domyslnie wskazuje na localhost
// (przydatne przy pracy lokalnej/testach).

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4100'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function getToken(): string | null {
  return localStorage.getItem('dealbase_radar_token')
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('dealbase_radar_token', token)
  else localStorage.removeItem('dealbase_radar_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(data.error || `Błąd ${res.status}`, res.status)
  }
  return data as T
}

// ── Auth ────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string
  email: string
  plan: 'basic' | 'pro' | 'vip'
  trial_ends_at: string | null
  referral_code: string
}

export function register(email: string, password: string, referralCode?: string) {
  return request<{ token: string; user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, referral_code: referralCode }),
  })
}

export function login(email: string, password: string) {
  return request<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function getMe() {
  return request<{ user: AuthUser }>('/api/auth/me')
}

// ── Wyszukiwanie ──────────────────────────────────────────────────────
export interface SearchCriteria {
  city: string
  transaction_type?: string
  property_type?: string
  price_min?: number
  price_max?: number
  portals?: string[]
  limit?: number
}

export interface DealScoreResult {
  score: number
  referenceAverage: number | null
  percentBelowMarket: number | null
  sellerMotivationScore: number | null
  usedReferences: string[]
}

export interface Listing {
  portal: string
  external_id: string
  url: string
  title: string
  price: number | null
  area: number | null
  rooms_count: number | null
  address_city: string
  address_district: string | null
  property_type: string
  marketSegment: 'standard' | 'premium'
  segmentConfidence: number
  dealScore: DealScoreResult | null
}

export interface SearchResponse {
  listings: Listing[]
  total: number
  portals_searched: string[]
  errors?: { portal: string; error: string }[]
  reference_points: any
}

export function search(criteria: SearchCriteria) {
  return request<SearchResponse>('/api/search', {
    method: 'POST',
    body: JSON.stringify(criteria),
  })
}

// ── Watchlisty ────────────────────────────────────────────────────────
export interface Watchlist {
  id: string
  name: string | null
  criteria: SearchCriteria
  is_active: boolean
  created_at: string
}

export function getWatchlists() {
  return request<Watchlist[]>('/api/watchlist')
}

export function createWatchlist(name: string, criteria: SearchCriteria) {
  return request<Watchlist>('/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({ name, criteria }),
  })
}

export function deleteWatchlist(id: string) {
  return request<void>(`/api/watchlist/${id}`, { method: 'DELETE' })
}
