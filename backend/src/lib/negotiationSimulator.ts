// ── Symulator negocjacji — UCZCIWY SZKIELET, nie gotowa statystyka ────────
//
// STATUS (wazne, przeczytaj przed modyfikacja): to jest wersja HEURYSTYCZNA,
// nie prawdziwa statystyka akceptacji ofert. Prawdziwa wersja wymaga
// sparowania konkretnych ofert portalowych z ich faktyczna cena
// transakcyjna z RCN (patrz market_intel.listing_transaction_matches -
// tabela juz istnieje, czeka na dane). Dopoki nie zbierzemy wystarczajaco
// duzo dopasowan o wysokiej pewnosci (realistycznie: miesiace uzytkowania),
// ten modul NIE MA PRAWA udawac ze podaje prawdziwe prawdopodobienstwo.
//
// Dlatego zwracamy tylko OPISOWE, ostrozne widelki (nizsze/umiarkowane/
// wysokie), nie liczby typu "67% szans" - bo taka liczba sugerowalaby
// precyzje, ktorej jeszcze nie mamy. To bylby dokladnie ten sam blad,
// przed ktorym przestrzegal Daniel przy module predykcji cen (recommendation
// Engine.ts) - fałszywa pewnosc gorsza niz brak porady.
//
// PLAN ROZWOJU (nie usuwac tego komentarza dopoki nie zostanie zrealizowany):
//   1. Zbudowac joba (cron, podobnie jak istniejacy cron.ts skanujacy
//      watchlisty) ktory okresowo probuje parowac zniknięte z portalu
//      oferty (z market_intel.portal_listings_archive, tam gdzie
//      last_seen_at jest stare = prawdopodobnie sprzedane/wycofane)
//      z transakcjami RCN o zblizonym adresie/metrazu/cenie/dacie.
//   2. Zapisywac dopasowania do market_intel.listing_transaction_matches
//      z match_confidence (0-1).
//   3. Gdy liczba dopasowan o wysokiej pewnosci (>0.7) w danym segmencie/
//      miescie przekroczy sensowny prog (np. 30+), PRZELACZYC ten modul
//      na prawdziwa statystyke (rozklad: oferta X% ponizej wywolawczej ->
//      Y% akceptacji) zamiast opisowych widelek ponizej.
//   4. Do tego czasu: ten plik zwraca tylko szacunki oparte o ROZNICE
//      MIEDZY PROPONOWANA OFERTA A PUNKTAMI ODNIESIENIA (RCN/hiperlokalny),
//      nie o rzeczywiste wyniki negocjacji.

export type AcceptanceLikelihood = 'niskie' | 'umiarkowane' | 'wysokie' | 'brak_danych'

export interface NegotiationSimulatorInput {
  proposedPrice: number
  askingPrice: number
  referenceAvgPricePerM2: number | null // najlepszy dostepny punkt odniesienia (hiperlokalny > RCN > oferty)
  area: number | null
}

export interface NegotiationSimulatorResult {
  likelihood: AcceptanceLikelihood
  proposedDiscountPercent: number
  message: string
  dataMaturity: 'heurystyka' | 'statystyka' // dzis zawsze 'heurystyka' - patrz komentarz u gory pliku
  sampleSize: number // 0 dopoki nie wdrozymy prawdziwego parowania (krok 1-3 powyzej)
}

export function simulateNegotiation(input: NegotiationSimulatorInput): NegotiationSimulatorResult {
  const proposedDiscountPercent = ((input.askingPrice - input.proposedPrice) / input.askingPrice) * 100

  // Jesli w ogole nie mamy punktu odniesienia, nie zgadujemy - mowimy wprost.
  if (input.referenceAvgPricePerM2 === null || !input.area) {
    return {
      likelihood: 'brak_danych',
      proposedDiscountPercent: Math.round(proposedDiscountPercent * 10) / 10,
      message: 'Za mało danych porównawczych dla tej lokalizacji, żeby ocenić szansę na akceptację. Sama różnica między Twoją propozycją a ceną wywoławczą to ' + Math.round(proposedDiscountPercent * 10) / 10 + '%.',
      dataMaturity: 'heurystyka',
      sampleSize: 0,
    }
  }

  const proposedPricePerM2 = input.proposedPrice / input.area
  const percentBelowReference = ((input.referenceAvgPricePerM2 - proposedPricePerM2) / input.referenceAvgPricePerM2) * 100

  // Widelki CELOWO ostrozne i opisowe - patrz uzasadnienie w komentarzu
  // na gorze pliku. To NIE sa wyliczone prawdopodobienstwa, to pasma.
  let likelihood: AcceptanceLikelihood
  let message: string

  if (percentBelowReference <= 0) {
    likelihood = 'wysokie'
    message = `Twoja propozycja (${Math.round(proposedDiscountPercent * 10) / 10}% poniżej ceny wywoławczej) jest na poziomie średniej rynkowej lub wyżej — to zwykle realistyczny punkt startowy do rozmowy.`
  } else if (percentBelowReference <= 8) {
    likelihood = 'umiarkowane'
    message = `Twoja propozycja jest ok. ${Math.round(percentBelowReference)}% poniżej średniej rynkowej dla tej okolicy. To wciąż w rozsądnych granicach negocjacji, ale spodziewaj się kontrpropozycji.`
  } else {
    likelihood = 'niskie'
    message = `Twoja propozycja jest znacząco (${Math.round(percentBelowReference)}%) poniżej średniej rynkowej dla tej okolicy. Możliwe, że sprzedający odrzuci ją bez kontrpropozycji — rozważ mniej agresywne otwarcie.`
  }

  return {
    likelihood,
    proposedDiscountPercent: Math.round(proposedDiscountPercent * 10) / 10,
    message: message + ' (Szacunek na podstawie różnicy cenowej, nie historii realnych negocjacji — ta funkcja będzie precyzyjniejsza z czasem, w miarę zbierania danych.)',
    dataMaturity: 'heurystyka',
    sampleSize: 0,
  }
}
