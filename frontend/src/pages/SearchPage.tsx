import { useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import { CityAutocomplete } from '../components/CityAutocomplete'
import { NegotiationSimulator } from '../components/NegotiationSimulator'

function scoreColor(score: number) {
  if (score >= 75) return 'bg-[#eaf3de] text-[#3b6d11]'
  if (score >= 55) return 'bg-blue-tint text-blue'
  return 'bg-cream-2 text-ink-soft'
}

export function SearchPage() {
  const [city, setCity] = useState('')
  const [propertyType, setPropertyType] = useState('mieszkanie')
  const [transactionType, setTransactionType] = useState<'sprzedaz' | 'wynajem'>('sprzedaz')
  const [priceMax, setPriceMax] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [pricePerM2Min, setPricePerM2Min] = useState('')
  const [pricePerM2Max, setPricePerM2Max] = useState('')
  const [areaMin, setAreaMin] = useState('')
  const [areaMax, setAreaMax] = useState('')
  const [roomsMin, setRoomsMin] = useState('')
  const [roomsMax, setRoomsMax] = useState('')
  const [floorMin, setFloorMin] = useState('')
  const [floorMax, setFloorMax] = useState('')
  const [marketType, setMarketType] = useState<'' | 'pierwotny' | 'wtorny'>('')
  const [sellerType, setSellerType] = useState<'' | 'agencja' | 'prywatny'>('')
  const [radiusKm, setRadiusKm] = useState('0')
  const [placeCoords, setPlaceCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [hasElevator, setHasElevator] = useState(false)
  const [keywordsInclude, setKeywordsInclude] = useState('')
  const [keywordsExclude, setKeywordsExclude] = useState('')

  const [results, setResults] = useState<api.SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [sortByScore, setSortByScore] = useState(true)

  function buildCriteria(): api.SearchCriteria {
    return {
      city,
      property_type: propertyType,
      transaction_type: transactionType,
      price_min: priceMin ? Number(priceMin) : undefined,
      price_max: priceMax ? Number(priceMax) : undefined,
      price_per_m2_min: pricePerM2Min ? Number(pricePerM2Min) : undefined,
      price_per_m2_max: pricePerM2Max ? Number(pricePerM2Max) : undefined,
      area_min: areaMin ? Number(areaMin) : undefined,
      area_max: areaMax ? Number(areaMax) : undefined,
      rooms_min: roomsMin ? Number(roomsMin) : undefined,
      rooms_max: roomsMax ? Number(roomsMax) : undefined,
      floor_min: floorMin ? Number(floorMin) : undefined,
      floor_max: floorMax ? Number(floorMax) : undefined,
      has_elevator: hasElevator || undefined,
      market_type: marketType || undefined,
      seller_type: sellerType || undefined,
      keywords_include: keywordsInclude || undefined,
      keywords_exclude: keywordsExclude || undefined,
      radius_km: radiusKm && radiusKm !== '0' ? Number(radiusKm) : undefined,
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
        {/* Rzad 1: lokalizacja, promien, typ nieruchomosci, typ oferty, cena */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-ink-soft mb-1">Lokalizacja</label>
            <CityAutocomplete value={city} onChange={setCity} onSelectPlace={onPlaceSelected} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Promień</label>
            <select value={radiusKm} onChange={e => setRadiusKm(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40">
              <option value="0">+ 0 km</option>
              <option value="5">+ 5 km</option>
              <option value="10">+ 10 km</option>
              <option value="20">+ 20 km</option>
              <option value="50">+ 50 km</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Rodzaj nieruchomości</label>
            <select value={propertyType} onChange={e => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40">
              <option value="mieszkanie">Mieszkanie</option>
              <option value="dom">Dom</option>
              <option value="dzialka">Działka</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Typ oferty</label>
            <select value={transactionType} onChange={e => setTransactionType(e.target.value as any)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40">
              <option value="sprzedaz">Na sprzedaż</option>
              <option value="wynajem">Na wynajem</option>
            </select>
          </div>
        </div>

        {/* Rzad 2: ceny */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Cena (zł) od</label>
            <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Cena (zł) do</label>
            <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Cena za m² od</label>
            <input type="number" value={pricePerM2Min} onChange={e => setPricePerM2Min(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Cena za m² do</label>
            <input type="number" value={pricePerM2Max} onChange={e => setPricePerM2Max(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
          </div>
        </div>

        {/* Rzad 3: metraz, pokoje, pietro, rynek, sprzedajacy */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-soft mb-1">Metraż od</label>
              <input type="number" value={areaMin} onChange={e => setAreaMin(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-soft mb-1">do</label>
              <input type="number" value={areaMax} onChange={e => setAreaMax(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-soft mb-1">Pokoje od</label>
              <input type="number" value={roomsMin} onChange={e => setRoomsMin(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-soft mb-1">do</label>
              <input type="number" value={roomsMax} onChange={e => setRoomsMax(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-soft mb-1">Piętro od</label>
              <input type="number" value={floorMin} onChange={e => setFloorMin(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-soft mb-1">do</label>
              <input type="number" value={floorMax} onChange={e => setFloorMax(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
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
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Sprzedający</label>
            <select value={sellerType} onChange={e => setSellerType(e.target.value as any)}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40">
              <option value="">Agencje i prywatni</option>
              <option value="agencja">Tylko agencje</option>
              <option value="prywatny">Tylko prywatni</option>
            </select>
          </div>
        </div>

        {/* Slowa kluczowe */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Słowa kluczowe — zawiera</label>
            <input value={keywordsInclude} onChange={e => setKeywordsInclude(e.target.value)} placeholder="np. balkon, ogród"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Słowa kluczowe — wyklucza</label>
            <input value={keywordsExclude} onChange={e => setKeywordsExclude(e.target.value)} placeholder="np. parter, suterena"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMoreFilters(s => !s)}
          className="text-xs text-blue font-medium mb-3 hover:underline"
        >
          {showMoreFilters ? '− Mniej filtrów' : '+ Dodatki (winda, itp.)'}
        </button>

        {showMoreFilters && (
          <div className="pt-3 border-t border-line mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
              <input type="checkbox" checked={hasElevator} onChange={e => setHasElevator(e.target.checked)}
                className="rounded border-line" />
              Tylko z windą
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-ink text-cream px-5 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Szukam...' : 'Szukaj ogłoszeń'}
          </button>
          {city && (
            <button
              type="button"
              onClick={saveAsWatchlist}
              className="px-4 py-2 rounded-lg text-sm border border-line hover:bg-cream-2 transition-colors"
            >
              {savedName ? '✓ Zapisano jako alert' : '🔔 Zapisz jako alert'}
            </button>
          )}
        </div>
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

                {listing.recommendation && (
                  <div className="mt-3 bg-blue-tint rounded-lg p-3">
                    <div className="text-xs font-semibold text-blue mb-1">💡 {listing.recommendation.headline}</div>
                    <div className="text-xs text-ink-soft">{listing.recommendation.detail}</div>
                  </div>
                )}

                {listing.hyperlocalComp && (
                  <div className="mt-3 bg-[#eaf3de] rounded-lg p-3">
                    <div className="text-xs font-semibold text-[#3b6d11] mb-1">📍 Ta sama ulica</div>
                    <div className="text-xs text-[#3b6d11]">
                      Na {listing.hyperlocalComp.street} znaleźliśmy {listing.hyperlocalComp.sampleSize} innych ofert
                      {listing.hyperlocalComp.avgPricePerM2 ? ` ze średnią ${Math.round(listing.hyperlocalComp.avgPricePerM2).toLocaleString('pl-PL')} zł/m²` : ''} — najdokładniejsze możliwe porównanie, dokładniejsze niż średnia dzielnicy.
                    </div>
                  </div>
                )}

                {listing.legalFlags && listing.legalFlags.length > 0 && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-red-700 mb-1">⚠ Sprawdź przed decyzją</div>
                    <ul className="text-xs text-red-700 space-y-0.5">
                      {listing.legalFlags.map((flag, i) => (
                        <li key={i}>• {flag.label}</li>
                      ))}
                    </ul>
                    <div className="text-[11px] text-red-600/70 mt-1.5">
                      Wykryte na podstawie treści ogłoszenia — nie zastępuje sprawdzenia księgi wieczystej.
                    </div>
                  </div>
                )}

                {listing.price && <NegotiationSimulator listing={listing} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
