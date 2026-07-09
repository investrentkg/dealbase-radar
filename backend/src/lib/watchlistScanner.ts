// ── Skaner watchlist — brakujący "silnik" monitoringu rynku ────────────
// Kontekst: watchlists/alerts_log/notification_preferences (CRUD) już
// istniały, ale nic nie sprawdzało ich cyklicznie względem nowych ofert -
// patrz notatka w routes/alerts.ts. Ten plik to właśnie ten brakujący
// element: dla każdej aktywnej watchlisty odpytuje agregator (te same
// portale co ręczne wyszukiwanie), porównuje z tym co już było
// zaalarmowane (alerts_log = zarówno log jak i deduplikacja), i dla
// naprawdę nowych ofert wysyła jeden zbiorczy e-mail na użytkownika
// (nie osobny mail na każdą ofertę - zalewałoby skrzynkę).
//
// Uruchamiane cyklicznie (2x dziennie) przez zaplanowany workflow GitHub
// Actions - patrz .github/workflows/scan-watchlists.yml.

import { radarDb } from '../db/clients'
import { searchAllPortals } from '../portals'
import { PortalSearchParams, PortalListing } from '../portals/types'
import { sendEmail, isEmailConfigured } from './emailGateway'

interface WatchlistRow {
  id: string
  user_id: string
  name: string | null
  criteria: PortalSearchParams
  is_active: boolean
  last_live_scan_at: string | null
}

interface ScanSummaryItem {
  watchlist_id: string
  watchlist_name: string
  candidates_found: number
  new_listings: number
  email_sent: boolean
  email_skip_reason?: string
  throttled?: boolean
}

export interface ScanResult {
  ok: boolean
  watchlists_scanned: number
  total_new_listings: number
  emails_sent: number
  summary: ScanSummaryItem[]
  errors: string[]
}

function listingKey(listing: PortalListing): string {
  return `${listing.portal}:${listing.external_id}`
}

function formatListingHtml(l: PortalListing): string {
  const price = l.price ? `${Number(l.price).toLocaleString('pl-PL')} zł` : 'cena nieznana'
  const area = l.area ? `${l.area} m²` : ''
  const rooms = l.rooms_count ? `${l.rooms_count} pok.` : ''
  const details = [area, rooms].filter(Boolean).join(' · ')
  return `<li style="margin-bottom:12px;">
    <a href="${l.url}" style="font-weight:600;color:#185FA5;text-decoration:none;">${l.title || 'Oferta bez tytułu'}</a><br>
    <span style="color:#5c594f;font-size:13px;">${l.address_district || l.address_city} · ${details} · ${price} · ${l.portal}${l.is_private ? ' · sprzedaż prywatna' : ''}</span>
  </li>`
}

/**
 * Skanuje JEDNĄ watchlistę: szuka ofert wg jej kryteriów, zwraca tylko te,
 * które nie były jeszcze wcześniej zaalarmowane dla tej watchlisty.
 *
 * Zabezpieczenie kosztowe: żywe zapytanie do agregatora (Apify) wykonujemy
 * maksymalnie raz na LIVE_SCAN_THROTTLE_HOURS per watchlist, niezależnie od
 * tego jak często odpala się cron. To ten sam wzorzec co w CRM-ie
 * (saved-searches, LIVE_REFRESH_HOURS) — działa jako siatka bezpieczeństwa,
 * gdyby częstotliwość crona kiedyś wzrosła bez ponownej analizy kosztów.
 */
const LIVE_SCAN_THROTTLE_HOURS = 4

async function scanSingleWatchlist(watchlist: WatchlistRow): Promise<{ newListings: PortalListing[]; candidatesTotal: number; error?: string; throttled?: boolean }> {
  const now = new Date()
  const lastScan = watchlist.last_live_scan_at ? new Date(watchlist.last_live_scan_at) : null
  const throttled = !!lastScan && (now.getTime() - lastScan.getTime()) < LIVE_SCAN_THROTTLE_HOURS * 3600000

  if (throttled) {
    return { newListings: [], candidatesTotal: 0, throttled: true }
  }

  try {
    const results = await searchAllPortals(watchlist.criteria)
    const candidates = results.flatMap(r => r.listings)

    await radarDb.from('watchlists').update({ last_live_scan_at: now.toISOString() }).eq('id', watchlist.id)

    if (candidates.length === 0) return { newListings: [], candidatesTotal: 0 }

    const keys = candidates.map(listingKey)
    const { data: alreadyAlerted } = await radarDb
      .from('alerts_log')
      .select('listing_reference')
      .eq('watchlist_id', watchlist.id)
      .in('listing_reference', keys)

    const alertedSet = new Set((alreadyAlerted || []).map(a => a.listing_reference))
    const newListings = candidates.filter(c => !alertedSet.has(listingKey(c)))

    return { newListings, candidatesTotal: candidates.length }
  } catch (err: any) {
    return { newListings: [], candidatesTotal: 0, error: err?.message || 'nieznany błąd wyszukiwania' }
  }
}

/**
 * Główna funkcja: skanuje WSZYSTKIE aktywne watchlisty, wysyła zbiorcze
 * maile (jeden na użytkownika, nie na watchlistę), zapisuje log dla
 * deduplikacji przy kolejnym uruchomieniu.
 */
export async function scanAllWatchlists(): Promise<ScanResult> {
  const errors: string[] = []
  const summary: ScanSummaryItem[] = []

  const { data: watchlists, error: wlError } = await radarDb
    .from('watchlists')
    .select('id, user_id, name, criteria, is_active, last_live_scan_at')
    .eq('is_active', true)

  if (wlError) {
    return { ok: false, watchlists_scanned: 0, total_new_listings: 0, emails_sent: 0, summary: [], errors: [wlError.message] }
  }

  const rows = (watchlists || []) as WatchlistRow[]

  // Grupuję nowe wyniki per użytkownik, żeby wysłać JEDEN zbiorczy mail,
  // nawet jeśli ktoś ma kilka watchlist z nowymi trafieniami naraz.
  const newListingsByUser = new Map<string, { listing: PortalListing; watchlistId: string; watchlistName: string }[]>()

  for (const wl of rows) {
    const { newListings, candidatesTotal, error, throttled } = await scanSingleWatchlist(wl)
    if (error) errors.push(`watchlist ${wl.id} (${wl.name || 'bez nazwy'}): ${error}`)

    summary.push({
      watchlist_id: wl.id,
      watchlist_name: wl.name || wl.criteria.city || 'bez nazwy',
      candidates_found: candidatesTotal,
      new_listings: newListings.length,
      email_sent: false,
      ...(throttled ? { throttled: true } : {}),
    })

    if (newListings.length > 0) {
      const bucket = newListingsByUser.get(wl.user_id) || []
      newListings.forEach(listing => bucket.push({ listing, watchlistId: wl.id, watchlistName: wl.name || wl.criteria.city || 'Twoja watchlista' }))
      newListingsByUser.set(wl.user_id, bucket)
    }
  }

  let emailsSent = 0

  for (const [userId, items] of newListingsByUser.entries()) {
    const [{ data: prefs }, { data: user }] = await Promise.all([
      radarDb.from('notification_preferences').select('email_enabled').eq('user_id', userId).maybeSingle(),
      radarDb.from('users').select('email').eq('id', userId).maybeSingle(),
    ])

    const emailEnabled = prefs?.email_enabled !== false
    let emailSent = false
    let skipReason: string | undefined

    if (!user?.email) {
      skipReason = 'brak adresu email użytkownika'
    } else if (!emailEnabled) {
      skipReason = 'użytkownik wyłączył powiadomienia email'
    } else if (!isEmailConfigured()) {
      skipReason = 'RESEND_API_KEY nieskonfigurowany'
    } else {
      const grouped = new Map<string, typeof items>()
      items.forEach(it => {
        const bucket = grouped.get(it.watchlistName) || []
        bucket.push(it)
        grouped.set(it.watchlistName, bucket)
      })

      const sectionsHtml = Array.from(grouped.entries()).map(([wlName, its]) => `
        <h3 style="color:#21201c;font-size:15px;margin:20px 0 8px;">${wlName} (${its.length} ${its.length === 1 ? 'nowa oferta' : 'nowych ofert'})</h3>
        <ul style="list-style:none;padding:0;margin:0;">${its.map(it => formatListingHtml(it.listing)).join('')}</ul>
      `).join('')

      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#185FA5;">Nowe oferty w Twoich watchlistach</h2>
          <p style="color:#5c594f;">DealBase Radar namierzył ${items.length} ${items.length === 1 ? 'nową ofertę pasującą' : 'nowych ofert pasujących'} do Twoich zapisanych kryteriów.</p>
          ${sectionsHtml}
        </div>
      `

      const result = await sendEmail({
        to: user.email,
        subject: `DealBase Radar: ${items.length} ${items.length === 1 ? 'nowa oferta' : 'nowych ofert'} dla Ciebie`,
        html,
      })
      emailSent = result.sent
      skipReason = result.sent ? undefined : result.reason
    }

    if (emailSent) emailsSent++

    const logRows = items.map(it => ({
      user_id: userId,
      watchlist_id: it.watchlistId,
      channel: 'email' as const,
      listing_reference: listingKey(it.listing),
    }))
    await radarDb.from('alerts_log').insert(logRows)

    const affectedWatchlistIds = new Set(items.map(it => it.watchlistId))
    summary.forEach(s => {
      if (affectedWatchlistIds.has(s.watchlist_id)) {
        s.email_sent = emailSent
        if (!emailSent) s.email_skip_reason = skipReason
      }
    })
  }

  return {
    ok: errors.length === 0,
    watchlists_scanned: rows.length,
    total_new_listings: summary.reduce((sum, s) => sum + s.new_listings, 0),
    emails_sent: emailsSent,
    summary,
    errors,
  }
}
