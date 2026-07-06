import { Router, Response } from 'express'
import { AuthRequest, requireAuth } from '../middleware/auth'
import { searchAllPortals, getPortalsStatus } from '../portals'
import { PortalSearchParams, PortalListing } from '../portals/types'
import { calculateDealScore } from '../lib/dealScoreEngine'
import { generateRecommendation } from '../lib/recommendationEngine'
import { detectLegalFlags } from '../lib/legalRiskDetector'
import { getRcnComparables } from '../lib/cenogram'
import { detectMarketSegment, detectMarketSegmentDetailed } from '../lib/marketSegment'
import { marketIntelDb } from '../db/clients'

export const searchRouter = Router()

// ── GET /api/search/status ─────────────────────────────────────────────
searchRouter.get('/status', requireAuth, (_req: AuthRequest, res: Response) => {
  res.json(getPortalsStatus())
})

// ── POST /api/search ───────────────────────────────────────────────────
// Rdzen Modulu 1 (agregator + Deal Score). Reuzywa dokladnie tej samej
// infrastruktury Apify co DealBase CRM (7 portali) - patrz src/portals/,
// skopiowane bezposrednio z investrent-crm/backend/src/portals.
searchRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const params: PortalSearchParams = {
    transaction_type: req.body.transaction_type || 'sprzedaz',
    property_type: req.body.property_type,
    city: req.body.city,
    district: req.body.district,
    price_min: req.body.price_min,
    price_max: req.body.price_max,
    area_min: req.body.area_min,
    area_max: req.body.area_max,
    rooms_min: req.body.rooms_min,
    rooms_max: req.body.rooms_max,
    radius_km: req.body.radius_km,
    center_lat: req.body.center_lat,
    center_lng: req.body.center_lng,
    limit: req.body.limit || 30,
  }

  if (!params.city) {
    return res.status(400).json({ error: 'city jest wymagane' })
  }
  const city: string = params.city

  const portalNames: string[] | undefined = Array.isArray(req.body.portals) ? req.body.portals : undefined
  const results = await searchAllPortals(params, portalNames)

  let allListings: PortalListing[] = results.flatMap(r => r.listings)
  const errors = results.filter(r => r.error).map(r => ({ portal: r.portal, error: r.error }))

  // ── Filtry dodatkowe (posortalowe, po stronie Radaru) ────────────────
  // Nie wszystkie adaptery portali wspieraja pietro/winde/typ rynku jako
  // parametr zapytania do Apify - zamiast zmieniac kazdy adapter osobno,
  // filtrujemy juz pobrane wyniki. Bezpieczniejsze i dziala identycznie
  // niezaleznie od portalu.
  const { floor_min, floor_max, has_elevator, market_type, seller_type, price_per_m2_min, price_per_m2_max, keywords_include, keywords_exclude } = req.body
  if (floor_min !== undefined) {
    allListings = allListings.filter(l => l.floor === null || l.floor === undefined || l.floor >= floor_min)
  }
  if (floor_max !== undefined) {
    allListings = allListings.filter(l => l.floor === null || l.floor === undefined || l.floor <= floor_max)
  }
  if (has_elevator === true) {
    allListings = allListings.filter(l => l.has_elevator === true)
  }
  if (market_type) {
    allListings = allListings.filter(l => !l.market_type || l.market_type === market_type)
  }
  if (seller_type === 'agencja') {
    allListings = allListings.filter(l => l.is_private !== true)
  }
  if (seller_type === 'prywatny') {
    allListings = allListings.filter(l => l.is_private === true)
  }
  if (price_per_m2_min !== undefined || price_per_m2_max !== undefined) {
    allListings = allListings.filter(l => {
      if (!l.area || !l.price) return true // brak danych - nie odrzucamy, tylko nie da sie policzyc
      const pricePerM2 = l.price / l.area
      if (price_per_m2_min !== undefined && pricePerM2 < price_per_m2_min) return false
      if (price_per_m2_max !== undefined && pricePerM2 > price_per_m2_max) return false
      return true
    })
  }
  if (keywords_include) {
    const words: string[] = keywords_include.toLowerCase().split(',').map((w: string) => w.trim()).filter(Boolean)
    allListings = allListings.filter(l => {
      const text = `${l.title} ${l.description || ''}`.toLowerCase()
      return words.some(w => text.includes(w))
    })
  }
  if (keywords_exclude) {
    const words: string[] = keywords_exclude.toLowerCase().split(',').map((w: string) => w.trim()).filter(Boolean)
    allListings = allListings.filter(l => {
      const text = `${l.title} ${l.description || ''}`.toLowerCase()
      return !words.some(w => text.includes(w))
    })
  }

  // ── Segmentacja rynkowa: standard vs premium/kurortowy ───────────────
  // Kluczowa poprawka po odkryciu na danych z Kolobrzegu: dzielnica z
  // portalu jest zawodna (czesto null), a "zwykle" i "luksusowe" budynki
  // stoja czasem przy tej samej ulicy w miastach nadmorskich. Segment
  // wykrywamy z TRESCI oferty (tytul/opis) - dziala wszedzie w Polsce,
  // nie tylko w miastach uzdrowiskowych. Patrz lib/marketSegment.ts.
  const segmentOf = (l: PortalListing) => detectMarketSegment({
    title: l.title, description: l.description,
  })

  const citiesInResults = new Set(allListings.map(l => (l.address_city || city).toLowerCase()))
  citiesInResults.add(city.toLowerCase())

  // ── Punkt 1: RCN / Cenogram — jedno zapytanie per miasto ─────────────
  // WAZNE OGRANICZENIE (uczciwie komunikowane w odpowiedzi API): RCN nie
  // ma pojecia "segment premium" - zwraca mediane dla calego miasta, wiec
  // dla ofert premium ten punkt odniesienia jest z natury mniej precyzyjny
  // niz punkty 2 i 3 ponizej, ktore SA segmentowane poprawnie. To lepsze
  // niz udawac precyzje ktorej nie mamy.
  const rcnByCity = new Map<string, Awaited<ReturnType<typeof getRcnComparables>>>()
  await Promise.all(
    Array.from(citiesInResults).map(async (c) => {
      const stats = await getRcnComparables({
        city: c,
        district: null,
        street: null,
        buildingNumber: null,
        propertyType: params.property_type || 'mieszkanie',
        area: (params.area_min && params.area_max) ? (params.area_min + params.area_max) / 2 : 50,
        marketType: null,
      }).catch(err => {
        console.error(`[search] Blad Cenogram/RCN dla ${c}:`, err.message)
        return null
      })
      rcnByCity.set(c, stats)
    })
  )
  function rcnForListing(l: PortalListing) {
    return rcnByCity.get((l.address_city || city).toLowerCase()) ?? rcnByCity.get(city.toLowerCase()) ?? null
  }
  const rcnSummary = Array.from(rcnByCity.entries()).map(([c, stats]) => ({
    city: c,
    median_price_per_m2: stats?.medianPricePerM2 ?? null,
    sample_size: stats?.count ?? 0,
    note: 'RCN nie rozroznia segmentu premium/standard - to mediana dla calego miasta',
  }))

  // ── Punkt 2: srednia z BIEZACEGO wyszukiwania, segmentowana ──────────
  const listingsAvgBySegment = { standard: null as number | null, premium: null as number | null }
  for (const seg of ['standard', 'premium'] as const) {
    const prices = allListings
      .filter(l => segmentOf(l) === seg)
      .map(l => (l.area && l.price) ? l.price / l.area : null)
      .filter((v): v is number => v !== null && v > 0)
    listingsAvgBySegment[seg] = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  }

  // ── Punkt 3: rosnaca wlasna baza (market_intel), segmentowana ────────
  // To jest ten "coraz madrzejszy asystent" z ustalen sesji brandingowej -
  // baza rosnie z kazdym wyszukiwaniem w systemie (wielu userow, w czasie),
  // TERAZ poprawnie odseparowana na standard/premium zamiast jednej liczby.
  const archiveTrendBySegment = { standard: null as { avg: number | null; count: number } | null, premium: null as { avg: number | null; count: number } | null }
  await Promise.all(
    (['standard', 'premium'] as const).map(async (seg) => {
      const { data, error } = await marketIntelDb
        .from('portal_listings_archive')
        .select('price_per_m2')
        .ilike('city', `%${city}%`)
        .eq('market_segment', seg)
        .not('price_per_m2', 'is', null)
        .limit(500)

      if (error || !data || data.length === 0) {
        archiveTrendBySegment[seg] = { avg: null, count: 0 }
        return
      }
      const values = data.map((r: any) => r.price_per_m2).filter((v: number) => v > 0)
      const avg = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : null
      archiveTrendBySegment[seg] = { avg, count: values.length }
    })
  )

  // ── Pobranie historii z wlasnej bazy PRZED liczeniem score ───────────
  // Potrzebne do prawdziwego (nie pustego) wskaznika motywacji sprzedajacego:
  // ile dni oferta jest na rynku i czy cena juz kiedys spadla. Bez tego
  // sellerMotivationScore bylby zawsze null - a to podstawa rekomendacji
  // "czy dzialac teraz czy jeszcze negocjowac" (patrz recommendationEngine.ts).
  const archiveKeys = allListings.map(l => `${l.portal}:${l.external_id}`)
  const { data: archiveRows } = await marketIntelDb
    .from('portal_listings_archive')
    .select('source_portal, source_listing_id, price, first_seen_at, price_history')
    .in('source_portal', [...new Set(allListings.map(l => l.portal))])

  const archiveByKey = new Map<string, { price: number | null; firstSeenAt: string; priceHistory: any[] }>()
  for (const row of archiveRows || []) {
    const key = `${row.source_portal}:${row.source_listing_id}`
    if (archiveKeys.includes(key)) {
      archiveByKey.set(key, { price: row.price, firstSeenAt: row.first_seen_at, priceHistory: row.price_history || [] })
    }
  }

  // ── Hiperlokalny sasiad: sprzedaze/oferty z TEJ SAMEJ ULICY ──────────
  // Najsilniejszy mozliwy punkt odniesienia - dokladniejszy niz srednia
  // dzielnicy. Ograniczenie: portale nie podaja numeru budynku osobno,
  // wiec porownujemy na poziomie ulicy, nie dokladnie tej samej klatki -
  // i tak to jasno nazywamy w UI (nie obiecujemy wiecej niz dowozimy).
  const streetsInResults = [...new Set(allListings.map(l => l.address_street).filter((s): s is string => !!s))]
  const hyperlocalByStreet = new Map<string, { avgPricePerM2: number | null; count: number }>()
  if (streetsInResults.length > 0) {
    const { data: streetRows } = await marketIntelDb
      .from('portal_listings_archive')
      .select('street, price_per_m2')
      .eq('city', city)
      .in('street', streetsInResults)
      .not('price_per_m2', 'is', null)

    for (const street of streetsInResults) {
      const rows = (streetRows || []).filter((r: any) => r.street === street)
      const prices = rows.map((r: any) => r.price_per_m2).filter((p: number) => p > 0)
      hyperlocalByStreet.set(street, {
        avgPricePerM2: prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null,
        count: prices.length,
      })
    }
  }
  function hyperlocalCompForListing(l: PortalListing) {
    if (!l.address_street) return null
    const comp = hyperlocalByStreet.get(l.address_street)
    // Wymagamy min. 2 innych ofert na tej samej ulicy, zeby "srednia" mialo
    // sens statystyczny - 1 punkt danych to nie porownanie, to przypadek.
    if (!comp || comp.count < 2) return null
    return { street: l.address_street, avgPricePerM2: comp.avgPricePerM2, sampleSize: comp.count }
  }

  function dynamicsForListing(l: PortalListing) {
    const prior = archiveByKey.get(`${l.portal}:${l.external_id}`)
    const firstSeen = prior?.firstSeenAt ? new Date(prior.firstSeenAt) : (l.posted_at ? new Date(l.posted_at) : new Date())
    const daysOnMarket = Math.max(0, Math.floor((Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24)))

    let priceDropCount = 0
    let priceDropTotalPercent = 0
    if (prior?.price && l.price && prior.price > l.price) {
      priceDropCount = (prior.priceHistory?.length || 0) + 1
      priceDropTotalPercent = ((prior.price - l.price) / prior.price) * 100
    }

    return {
      daysOnMarket,
      priceDropCount,
      priceDropTotalPercent,
      // Tempo znikania/pojawiania sie podobnych ofert w okolicy - wymaga
      // osobnej analizy czasowej ktorej jeszcze nie zbieramy w wystarczajacej
      // gestosci. Zero = brak sygnalu (neutralne), nie falszywy sygnal.
      similarListingsDisappearedLast30d: 0,
      similarListingsAddedLast30d: 0,
    }
  }

  const scoredListings = allListings.map(listing => {
    const segmentInfo = detectMarketSegmentDetailed({ title: listing.title, description: listing.description })
    if (!listing.area || !listing.price) {
      return { ...listing, marketSegment: segmentInfo.segment, segmentConfidence: segmentInfo.confidence, dealScore: null, recommendation: null, legalFlags: detectLegalFlags(listing) }
    }
    const segment = segmentInfo.segment
    const offerPricePerM2 = listing.price / listing.area
    const rcnStats = rcnForListing(listing)
    const archiveTrend = archiveTrendBySegment[segment]
    const hyperlocal = hyperlocalCompForListing(listing)
    const score = calculateDealScore({
      offerPricePerM2,
      references: {
        transactionAvgPricePerM2: rcnStats?.medianPricePerM2 ?? null,
        listingsAvgPricePerM2: listingsAvgBySegment[segment],
        archiveTrendPricePerM2: archiveTrend?.avg ?? null,
        hyperlocalPricePerM2: hyperlocal?.avgPricePerM2 ?? null,
      },
      dynamics: dynamicsForListing(listing),
    })
    return { ...listing, marketSegment: segment, segmentConfidence: segmentInfo.confidence, dealScore: score, recommendation: generateRecommendation({
      dealScore: score.score,
      percentBelowMarket: score.percentBelowMarket,
      sellerMotivationScore: score.sellerMotivationScore,
      price: listing.price,
    }), legalFlags: detectLegalFlags(listing), hyperlocalComp: hyperlocal }
  })

  // ── Zapis do wspolnej bazy rynkowej (market_intel) ──────────────────
  // Fire-and-forget - nie blokujemy odpowiedzi na uzytkownika, jesli
  // zapis archiwum zawiedzie (np. duplikat), to nie problem uzytkownika.
  archiveListings(allListings, archiveByKey).catch(err =>
    console.error('[search] Blad archiwizacji do market_intel:', err.message)
  )

  res.json({
    listings: scoredListings,
    total: scoredListings.length,
    portals_searched: results.map(r => r.portal),
    errors: errors.length > 0 ? errors : undefined,
    reference_points: {
      rcn_by_city: rcnSummary,
      listings_avg_by_segment: listingsAvgBySegment,
      archive_trend_by_segment: {
        standard: archiveTrendBySegment.standard,
        premium: archiveTrendBySegment.premium,
      },
    },
  })
})

async function archiveListings(
  listings: PortalListing[],
  archiveByKey: Map<string, { price: number | null; firstSeenAt: string; priceHistory: any[] }>
) {
  if (listings.length === 0) return

  const rows = listings.map(l => {
    const prior = archiveByKey.get(`${l.portal}:${l.external_id}`)
    // Budujemy prawdziwa historie cen w czasie - dopisujemy nowy wpis TYLKO
    // gdy cena sie realnie zmienila od ostatniego zapisu (nie kazde
    // wyszukiwanie, zeby nie zaśmiecac historii identycznymi wpisami).
    const priceChanged = prior?.price !== undefined && prior.price !== null && l.price !== null && prior.price !== l.price
    const priceHistory = prior?.priceHistory ? [...prior.priceHistory] : []
    if (priceChanged || priceHistory.length === 0) {
      priceHistory.push({ date: new Date().toISOString(), price: l.price })
    }

    return {
      source_portal: l.portal,
      source_listing_id: l.external_id,
      property_type: l.property_type,
      transaction_type: l.transaction_type,
      city: l.address_city,
      district: l.address_district,
      street: l.address_street,
      area_m2: l.area,
      rooms_count: l.rooms_count,
      price: l.price,
      price_per_m2: (l.area && l.price) ? l.price / l.area : null,
      market_segment: detectMarketSegment({ title: l.title, description: l.description }),
      last_seen_at: new Date().toISOString(),
      price_history: priceHistory,
      raw_data: l,
    }
  })

  // Upsert po (source_portal, source_listing_id) - patrz unique constraint
  // w schema-market-intelligence.sql
  const { error } = await marketIntelDb
    .from('portal_listings_archive')
    .upsert(rows, { onConflict: 'source_portal,source_listing_id' })

  if (error) throw error
}
