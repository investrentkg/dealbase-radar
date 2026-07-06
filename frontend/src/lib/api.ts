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
  district?: string
  transaction_type?: string
  property_type?: string
  price_min?: number
  price_max?: number
  price_per_m2_min?: number
  price_per_m2_max?: number
  area_min?: number
  area_max?: number
  rooms_min?: number
  rooms_max?: number
  floor_min?: number
  floor_max?: number
  has_elevator?: boolean
  market_type?: 'pierwotny' | 'wtorny'
  seller_type?: 'agencja' | 'prywatny'
  keywords_include?: string
  keywords_exclude?: string
  radius_km?: number
  center_lat?: number
  center_lng?: number
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
  floor?: number | null
  floors_total?: number | null
  has_elevator?: boolean | null
  market_type?: string | null
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

// ── Alerty ────────────────────────────────────────────────────────────
export interface NotificationPreferences {
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
  frequency: 'instant' | 'daily_digest'
}

export function getAlertPreferences() {
  return request<NotificationPreferences>('/api/alerts/preferences')
}

export function updateAlertPreferences(prefs: Partial<NotificationPreferences>) {
  return request<NotificationPreferences>('/api/alerts/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  })
}

// ── Geocode / autocomplete miast ─────────────────────────────────────
export interface PlacePrediction {
  place_id: string
  description: string
}

export function autocompleteCity(query: string) {
  return request<{ predictions: PlacePrediction[] }>(`/api/geocode/autocomplete?q=${encodeURIComponent(query)}`)
}

export function getPlaceDetails(placeId: string) {
  return request<{ address_components?: any[]; geometry?: { location: { lat: number; lng: number } } }>(
    `/api/geocode/details?place_id=${encodeURIComponent(placeId)}`
  )
}
