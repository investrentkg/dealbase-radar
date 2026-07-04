import { useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'

function scoreColor(score: number) {
  if (score >= 75) return 'bg-[#eaf3de] text-[#3b6d11]'
  if (score >= 55) return 'bg-blue-tint text-blue'
  return 'bg-cream-2 text-ink-soft'
}

export function SearchPage() {
  const [city, setCity] = useState('')
  const [propertyType, setPropertyType] = useState('mieszkanie')
  const [priceMax, setPriceMax] = useState('')
  const [results, setResults] = useState<api.SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setResults(null)
    try {
      const res = await api.search({
        city,
        property_type: propertyType,
        price_max: priceMax ? Number(priceMax) : undefined,
        transaction_type: 'sprzedaz',
        limit: 20,
      })
      setResults(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Wyszukiwanie nie powiodło się')
    } finally {
      setLoading(false)
    }
  }

  async function saveAsWatchlist() {
    if (!city) return
    try {
      await api.createWatchlist(`${city} · ${propertyType}`, {
        city, property_type: propertyType, price_max: priceMax ? Number(priceMax) : undefined,
        transaction_type: 'sprzedaz',
      })
      setSavedName(city)
      setTimeout(() => setSavedName(null), 3000)
    } catch {
      // Ciche niepowodzenie zapisu watchlisty nie powinno psuc widoku wynikow
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <h1 className="font-serif text-2xl mb-1">Wyszukiwarka</h1>
      <p className="text-ink-soft text-sm mb-6">Jedno zapytanie przeszukuje wszystkie portale naraz</p>

      <form onSubmit={onSubmit} className="bg-white border border-line rounded-xl p-5 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-ink-soft mb-1">Miasto</label>
          <input
            required
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="np. Kołobrzeg"
            className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-ink-soft mb-1">Typ</label>
          <select
            value={propertyType}
            onChange={e => setPropertyType(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40"
          >
            <option value="mieszkanie">Mieszkanie</option>
            <option value="dom">Dom</option>
            <option value="dzialka">Działka</option>
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-ink-soft mb-1">Cena max</label>
          <input
            type="number"
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
            placeholder="bez limitu"
            className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-ink text-cream px-5 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Szukam...' : 'Szukaj'}
        </button>
        {city && (
          <button
            type="button"
            onClick={saveAsWatchlist}
            className="px-4 py-2 rounded-lg text-sm border border-line hover:bg-cream-2 transition-colors"
          >
            {savedName ? '✓ Zapisano' : 'Obserwuj'}
          </button>
        )}
      </form>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-ink-soft text-sm">
          Przeszukuję portale — pierwsze wyszukiwanie może potrwać do minuty...
        </div>
      )}

      {results && !loading && (
        <div>
          <div className="text-sm text-ink-soft mb-4">
            Znaleziono {results.total} ofert · portale: {results.portals_searched.join(', ')}
            {results.errors && results.errors.length > 0 && (
              <span className="text-red-500"> · błędy: {results.errors.map(e => e.portal).join(', ')}</span>
            )}
          </div>

          {results.total === 0 && (
            <div className="text-center py-16 text-ink-soft text-sm border border-dashed border-line rounded-xl">
              Brak wyników dla tych kryteriów. Spróbuj poszerzyć zakres wyszukiwania.
            </div>
          )}

          <div className="space-y-3">
            {results.listings.map(listing => (
              <div
                key={`${listing.portal}-${listing.external_id}`}
                className={`bg-white border rounded-xl p-4 ${
                  listing.dealScore && listing.dealScore.score >= 80
                    ? 'border-[1.5px] border-[#c9a24a] bg-gradient-to-br from-[#fdf8ec] to-white'
                    : 'border-line'
                }`}
              >
                <div className="flex items-center gap-4">
                  {listing.dealScore ? (
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center font-mono font-medium text-sm flex-shrink-0 ${scoreColor(listing.dealScore.score)}`}>
                      {listing.dealScore.score}
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-cream-2 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={listing.url} target="_blank" rel="noreferrer" className="font-medium text-sm hover:text-blue transition-colors truncate block">
                      {listing.title}
                    </a>
                    <div className="text-xs text-ink-soft mt-0.5 flex items-center gap-2">
                      <span>{listing.address_city}{listing.address_district ? `, ${listing.address_district}` : ''}</span>
                      <span>·</span>
                      <span>{listing.area ? `${listing.area} m²` : '—'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                        listing.marketSegment === 'premium' ? 'bg-[#f3e8d8] text-[#8a5a1c]' : 'bg-cream-2 text-ink-soft'
                      }`}>
                        {listing.marketSegment}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono text-sm">{listing.price ? `${listing.price.toLocaleString('pl-PL')} zł` : '—'}</div>
                    <div className="text-xs text-ink-soft">{listing.portal}</div>
                  </div>
                </div>

                {listing.dealScore?.percentBelowMarket != null && (
                  <details className="mt-3">
                    <summary className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#f3e8d8] text-[#8a6a1c] w-fit">
                      ✦ Szczegóły oceny
                    </summary>
                    <div className="text-xs text-ink-soft mt-2 pl-1">
                      {listing.dealScore.percentBelowMarket > 0
                        ? `Cena ${listing.dealScore.percentBelowMarket.toFixed(1)}% poniżej punktu odniesienia.`
                        : `Cena ${Math.abs(listing.dealScore.percentBelowMarket).toFixed(1)}% powyżej punktu odniesienia.`}
                      {' '}Źródła: {listing.dealScore.usedReferences.join(', ') || 'brak wystarczających danych porównawczych'}.
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
