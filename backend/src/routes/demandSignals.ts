import { Router, Request, Response } from 'express'
import { requireServiceAuth } from '../middleware/serviceAuth'
import { radarDb } from '../db/clients'

// ── "Rynek cień" (punkt 1 innowacji) — kontrakt API Radar <-> CRM ────────
// Radar udostepnia ANONIMOWE sygnaly popytu (czego szukaja uzytkownicy),
// CRM zglasza dopasowania gdy agent ma pasujaca oferte. Dane osobowe
// uzytkownika Radaru NIGDY nie trafiaja do CRM - agent widzi tylko
// kryteria wyszukiwania, nie kim jest szukajacy. Odwrotnie: dane oferty/
// agenta trafiaja do usera dopiero gdy on sam zobaczy je we wlasnym
// panelu Radaru (radar.demand_signal_matches, RLS chroni dostep).
//
// Autoryzacja: klucz serwisowy w naglowku X-Service-Key (nie user JWT) -
// to wywolania miedzy backendami CRM i Radar, nie akcje uzytkownika.

export const demandSignalsRouter = Router()

// ── GET /api/demand-signals ────────────────────────────────────────────
// CRM woła to okresowo (albo przy tworzeniu nowej oferty), zeby sprawdzic
// czy jacys uzytkownicy Radaru czegos takiego szukaja. Zwraca TYLKO
// kryteria - zero danych osobowych. Opcjonalne filtry query: city,
// property_type - zeby CRM nie musial sciagac calej listy za kazdym razem.
demandSignalsRouter.get('/', requireServiceAuth, async (req: Request, res: Response) => {
  const { city, property_type } = req.query

  const { data, error } = await radarDb
    .from('watchlists')
    .select('id, criteria, created_at')
    .eq('is_active', true)

  if (error) return res.status(500).json({ error: error.message })

  let signals = (data || []).map(w => ({
    demand_signal_id: w.id,
    criteria: w.criteria,
    created_at: w.created_at,
  }))

  // Filtrowanie po stronie Radaru (kryteria sa w jsonb, prostsze niz
  // budowac zapytanie SQL po zagniezdzonym polu dla kazdej kombinacji)
  if (city) {
    signals = signals.filter(s => (s.criteria as any)?.city?.toLowerCase() === String(city).toLowerCase())
  }
  if (property_type) {
    signals = signals.filter(s => (s.criteria as any)?.property_type === property_type)
  }

  res.json({ signals, total: signals.length })
})

// ── POST /api/demand-signals/:watchlistId/matches ────────────────────
// CRM woła to, gdy agent ma oferte pasujaca do konkretnego sygnalu
// popytu. Zapisujemy dopasowanie - user zobaczy je we wlasnym panelu
// Radaru (docelowo: nowa sekcja "Oferty od agentow" w Obserwowanych).
demandSignalsRouter.post('/:watchlistId/matches', requireServiceAuth, async (req: Request, res: Response) => {
  const { watchlistId } = req.params
  const { agency_name, agent_display_name, offer_summary, offer_price, offer_area, contact_hint } = req.body

  if (!offer_summary) {
    return res.status(400).json({ error: 'offer_summary jest wymagane' })
  }

  // Sprawdzamy ze watchlist faktycznie istnieje (unikamy smieciowych
  // zapisow do nieistniejacych/usunietych obserwowanych wyszukiwan)
  const { data: watchlist } = await radarDb
    .from('watchlists')
    .select('id')
    .eq('id', watchlistId)
    .maybeSingle()

  if (!watchlist) {
    return res.status(404).json({ error: 'Nie znaleziono takiego sygnalu popytu (watchlist)' })
  }

  const { data, error } = await radarDb
    .from('demand_signal_matches')
    .insert({
      watchlist_id: watchlistId,
      source_system: 'dealbase_crm',
      agency_name,
      agent_display_name,
      offer_summary,
      offer_price,
      offer_area,
      contact_hint,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})
