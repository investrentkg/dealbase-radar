import { useEffect, useState } from 'react'
import * as api from '../lib/api'

export function WatchlistPage() {
  const [items, setItems] = useState<api.Watchlist[]>([])
  const [matches, setMatches] = useState<Record<string, api.DemandMatch[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getWatchlists()
      .then(async list => {
        setItems(list)
        // Sprawdzamy dopasowania od agentow (Rynek cień) dla kazdej watchlisty -
        // ciche niepowodzenie per-item, zeby jeden blad nie zepsul reszty listy.
        const results = await Promise.all(
          list.map(async w => {
            try {
              const m = await api.getWatchlistMatches(w.id)
              return [w.id, m] as const
            } catch {
              return [w.id, []] as const
            }
          })
        )
        setMatches(Object.fromEntries(results))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function remove(id: string) {
    await api.deleteWatchlist(id)
    setItems(items.filter(i => i.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <p className="text-ink-soft text-sm mb-6">Zapisane kryteria — tu trafią przyszłe alerty</p>

      {loading && <div className="text-ink-soft text-sm">Ładowanie...</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-ink-soft text-sm border border-dashed border-line rounded-xl">
          Nie masz jeszcze żadnych obserwowanych wyszukiwań.
          <br />Zapisz kryteria z poziomu wyszukiwarki, klikając „Obserwuj".
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => {
          const itemMatches = matches[item.id] || []
          return (
            <div key={item.id} className="bg-white border border-line rounded-xl overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{item.name || item.criteria.city}</div>
                  <div className="text-xs text-ink-soft mt-0.5">
                    {item.criteria.city} · {item.criteria.property_type || 'dowolny typ'}
                    {item.criteria.price_max ? ` · do ${item.criteria.price_max.toLocaleString('pl-PL')} zł` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {itemMatches.length > 0 && (
                    <button
                      onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#eaf3de] text-[#3b6d11] hover:bg-[#dcecc9] transition-colors"
                    >
                      🏠 {itemMatches.length} {itemMatches.length === 1 ? 'oferta od agenta' : 'oferty od agentów'}
                    </button>
                  )}
                  <button
                    onClick={() => remove(item.id)}
                    className="text-xs text-ink-soft hover:text-red-600 transition-colors"
                  >
                    Usuń
                  </button>
                </div>
              </div>

              {expanded === item.id && itemMatches.length > 0 && (
                <div className="border-t border-line bg-cream-2 p-4 space-y-3">
                  {itemMatches.map(m => (
                    <div key={m.id} className="bg-white rounded-lg p-3 border border-line">
                      <div className="text-xs font-semibold mb-1">
                        {m.agency_name || 'Biuro nieruchomości'}
                        {m.agent_display_name ? ` · ${m.agent_display_name}` : ''}
                      </div>
                      <div className="text-xs text-ink-soft mb-1">{m.offer_summary}</div>
                      <div className="text-xs text-ink-soft flex gap-3">
                        {m.offer_price && <span>{m.offer_price.toLocaleString('pl-PL')} zł</span>}
                        {m.offer_area && <span>{m.offer_area} m²</span>}
                      </div>
                      {m.contact_hint && (
                        <div className="text-xs text-blue mt-1.5">📞 {m.contact_hint}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
