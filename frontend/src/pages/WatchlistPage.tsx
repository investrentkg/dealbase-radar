import { useEffect, useState } from 'react'
import * as api from '../lib/api'

export function WatchlistPage() {
  const [items, setItems] = useState<api.Watchlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getWatchlists()
      .then(setItems)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function remove(id: string) {
    await api.deleteWatchlist(id)
    setItems(items.filter(i => i.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <h1 className="font-serif text-2xl mb-1">Obserwowane wyszukiwania</h1>
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
        {items.map(item => (
          <div key={item.id} className="bg-white border border-line rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{item.name || item.criteria.city}</div>
              <div className="text-xs text-ink-soft mt-0.5">
                {item.criteria.city} · {item.criteria.property_type || 'dowolny typ'}
                {item.criteria.price_max ? ` · do ${item.criteria.price_max.toLocaleString('pl-PL')} zł` : ''}
              </div>
            </div>
            <button
              onClick={() => remove(item.id)}
              className="text-xs text-ink-soft hover:text-red-600 transition-colors"
            >
              Usuń
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
