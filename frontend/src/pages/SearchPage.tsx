import { useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import { CityAutocomplete } from '../components/CityAutocomplete'

function scoreColor(score: number) {
  if (score >= 75) return 'bg-[#eaf3de] text-[#3b6d11]'
  if (score >= 55) return 'bg-blue-tint text-blue'
  return 'bg-cream-2 text-ink-soft'
}

export function SearchPage() {
  const [city, setCity] = useState('')
  const [propertyType, setPropertyType] = useState('mieszkanie')
  const [priceMax, setPriceMax] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  // Filtry dodatkowe
  const [priceMin, setPriceMin] = useState('')
  const [areaMin, setAreaMin] = useState('')
  const [areaMax, setAreaMax] = useState('')
  const [roomsMin, setRoomsMin] = useState('')
  const [roomsMax, setRoomsMax] = useState('')
  const [floorMin, setFloorMin] = useState('')
  const [floorMax, setFloorMax] = useState('')
  const [hasElevator, setHasElevator] = useState(false)
  const [marketType, setMarketType] = useState<'' | 'pierwotny' | 'wtorny'>('')
  const [radiusKm, setRadiusKm] = useState('')
  const [placeCoords, setPlaceCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [results, setResults] = useState<api.SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [sortByScore, setSortByScore] = useState(true)

  function buildCriteria(): api.SearchCriteria {
    return {
      city,
      property_type: propertyType,
      transaction_type: 'sprzedaz',
      price_min: priceMin ? Number(priceMin) : undefined,
      price_max: priceMax ? Number(priceMax) : undefined,
      area_min: areaMin ? Number(areaMin) : undefined,
      area_max: areaMax ? Number(areaMax) : undefined,
      rooms_min: roomsMin ? Number(roomsMin) : undefined,
      rooms_max: roomsMax ? Number(roomsMax) : undefined,
      floor_min: floorMin ? Number(floorMin) : undefined,
      floor_max: floorMax ? Number(floorMax) : undefined,
      has_elevator: hasElevator || undefined,
      market_type: marketType || undefined,
      radius_km: radiusKm ? Number(radiusKm) : undefined,
      center_lat: placeCoords?.lat,
      center_lng: placeCoords?.lng,
      limit: 20,
    }
  }

  async function onPlaceSelected(placeId: string) {
    try {
      const details = await api.getPlaceDetails(placeId)
      if (details.geometry?.location) {
        setPlaceCoords({ lat: details.geometry.location.lat, lng: details.geometry.location.lng })
      }
    } catch {
      // Brak wspolrzednych nie blokuje wyszukiwania - promien po prostu nie zadziala
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setResults(null)
    try {
      const res = await api.search(buildCriteria())
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
      await api.createWatchlist(`${city} · ${propertyType}`, buildCriteria())
      setSavedName(city)
      setTimeout(() => setSavedName(null), 3000)
    } catch {
      // Ciche niepowodzenie zapisu watchlisty nie powinno psuc widoku wynikow
    }
  }

  const displayedListings = results
    ? [...results.listings].sort((a, b) => {
        if (!sortByScore) return 0
        return (b.dealScore?.score ?? -1) - (a.dealScore?.score ?? -1)
      })
    : []

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <p className="text-ink-soft text-sm mb-6">Jedno zapytanie przeszukuje wszystkie portale naraz</p>

      <form onSubmit={onSubmit} className="bg-white border border-line rounded-xl p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-ink-soft mb-1">Miasto</label>
            <CityAutocomplete value={city} onChange={setCity} onSelectPlace={onPlaceSelected} />
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
        </div>

        <button
          type="button"
          onClick={() => setShowMoreFilters(s => !s)}
          className="text-xs text-blue font-medium mt-3 hover:underline"
        >
          {showMoreFilters ? '− Mniej filtrów' : '+ Więcej filtrów'}
        </button>

        {showMoreFilters && (
          <div className="mt-4 pt-4 border-t border-line grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Cena min</label>
              <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Metraż od</label>
              <input type="number" value={areaMin} onChange={e => setAreaMin(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Metraż do</label>
              <input type="number" value={areaMax} onChange={e => setAreaMax(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Promień (km)</label>
              <input type="number" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} placeholder="np. 10"
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Pokoje od</label>
              <input type="number" value={roomsMin} onChange={e => setRoomsMin(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Pokoje do</label>
              <input type="number" value={roomsMax} onChange={e => setRoomsMax(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Piętro od</label>
              <input type="number" value={floorMin} onChange={e => setFloorMin(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Piętro do</label>
              <input type="number" value={floorMax} onChange={e => setFloorMax(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Rynek</label>
              <select value={marketType} onChange={e => setMarketType(e.target.value as any)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40">
                <option value="">Dowolny</option>
                <option value="wtorny">Wtórny</option>
                <option value="pierwotny">Pierwotny</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={hasElevator} onChange={e => setHasElevator(e.target.checked)}
                  className="rounded border-line" />
                Tylko z windą
              </label>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {!results && !loading && !error && (
        <div className="text-center py-20 text-ink-soft text-sm border border-dashed border-line rounded-xl">
          <div className="text-3xl mb-3">🔍</div>
          Wpisz miasto i kliknij "Szukaj" — przeszukamy wszystkie portale naraz.
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2 text-ink-soft text-sm">
            <span className="w-2 h-2 rounded-full bg-blue animate-pulse" />
            Przeszukuję portale — pierwsze wyszukiwanie może potrwać do minuty...
          </div>
        </div>
      )}

      {results && !loading && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-ink-soft">
              Znaleziono {results.total} ofert · portale: {results.portals_searched.join(', ')}
              {results.errors && results.errors.length > 0 && (
                <span className="text-red-500"> · błędy: {results.errors.map(e => e.portal).join(', ')}</span>
              )}
            </div>
            {results.total > 0 && (
              <button
                onClick={() => setSortByScore(s => !s)}
                className="text-xs text-ink-soft hover:text-ink border border-line rounded-lg px-3 py-1.5 transition-colors"
              >
                {sortByScore ? '✓ Sortuj wg Deal Score' : 'Sortuj wg Deal Score'}
              </button>
            )}
          </div>

          {results.total === 0 && (
            <div className="text-center py-16 text-ink-soft text-sm border border-dashed border-line rounded-xl">
              Brak wyników dla tych kryteriów. Spróbuj poszerzyć zakres wyszukiwania.
            </div>
          )}

          <div className="space-y-3">
            {displayedListings.map(listing => (
              <div
                key={`${listing.portal}-${listing.external_id}`}
                className={`bg-white border rounded-xl p-4 transition-shadow ${
                  listing.dealScore && listing.dealScore.score >= 80
                    ? 'border-[1.5px] border-[#c9a24a] bg-gradient-to-br from-[#fdf8ec] to-white shadow-[0_8px_24px_-12px_rgba(201,162,74,0.35)]'
                    : 'border-line hover:border-ink-soft/30'
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
                    <div className="text-xs text-ink-soft mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{listing.address_city}{listing.address_district ? `, ${listing.address_district}` : ''}</span>
                      <span>·</span>
                      <span>{listing.area ? `${listing.area} m²` : '—'}</span>
                      {listing.floor != null && (
                        <>
                          <span>·</span>
                          <span>piętro {listing.floor}{listing.floors_total ? `/${listing.floors_total}` : ''}</span>
                        </>
                      )}
                      {listing.has_elevator && (
                        <>
                          <span>·</span>
                          <span>winda</span>
                        </>
                      )}
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
