// ── Silnik rekomendacji ("czy działać teraz, czy jeszcze negocjować") ────
//
// KLUCZOWA ZASADA PROJEKTOWA (wprost od Daniela): nigdy nie mowic tylko
// "poczekaj" - to ryzykowna rada, bo ktos moze stracic dobra oferte,
// jesli inny kupujacy zadzwoni pierwszy. Kazda rekomendacja MUSI wazyc
// dwie rzeczy naraz:
//   1) Jak dobra jest ta oferta JUZ TERAZ (Deal Score, % ponizej rynku)
//   2) Jakie jest ryzyko ze cena spadnie jeszcze bardziej (motywacja
//      sprzedajacego) PRZECIWKO ryzyku ze ktos inny kupi szybciej (tempo
//      znikania podobnych ofert w okolicy - "market velocity")
//
// Efekt: zamiast "czekaj" albo "kupuj", system zawsze daje wywazona,
// konkretna rade - w stylu doswiadczonego inwestora, nie automatu.
// Faza 1 (ta wersja): heurystyka oparta na sygnalach ktore juz mamy.
// Faza 2 (przyszlosc, wymaga wiecej danych): prawdziwe prawdopodobienstwo
// statystyczne akceptacji negocjacji, liczone z historii wlasnej bazy
// (roznica miedzy cena ofertowa a cena transakcyjna w podobnych ofertach).

export interface RecommendationInput {
  dealScore: number // 0-100
  percentBelowMarket: number | null
  sellerMotivationScore: number | null // 0-100, wyzszy = bardziej zmotywowany
  price: number
}

export type RecommendationUrgency = 'dziala_teraz' | 'neguj_i_dzialaj' | 'rynek_rozgrzany' | 'neutralne'

export interface Recommendation {
  urgency: RecommendationUrgency
  headline: string
  detail: string
  suggestedNegotiationAmount: number | null // sugerowana dodatkowa kwota do "urwania"
  suggestedNegotiationPercent: number | null
}

// Ile dodatkowo probowac negocjowac, w zaleznosci od motywacji sprzedajacego.
// To NIE jest gwarancja - to punkt startowy do rozmowy, jawnie oznaczony
// jako sugestia, nie pewnik (patrz tekst w headline/detail ponizej).
function estimateNegotiationRoom(sellerMotivationScore: number | null, price: number): { amount: number | null; percent: number | null } {
  if (sellerMotivationScore === null || sellerMotivationScore < 40) {
    return { amount: null, percent: null }
  }
  // Skala 40-100 motywacji -> 1.5%-6% sugerowanej dodatkowej negocjacji.
  // Ostrozna gorna granica (6%), zeby nie sugerowac nierealistycznych cinac.
  const percent = 1.5 + ((sellerMotivationScore - 40) / 60) * 4.5
  const amount = Math.round((price * percent) / 100 / 100) * 100 // zaokraglenie do pelnych 100 zl
  return { amount, percent: Math.round(percent * 10) / 10 }
}

export function generateRecommendation(input: RecommendationInput): Recommendation {
  const { dealScore, sellerMotivationScore, price } = input
  const negotiation = estimateNegotiationRoom(sellerMotivationScore, price)

  const isGreatDealNow = dealScore >= 78
  const sellerLikelyFlexible = sellerMotivationScore !== null && sellerMotivationScore >= 55

  // ── Sciezka 1: cena juz bardzo dobra, sprzedajacy niekoniecznie ──────
  // pod presja - najwazniejsze zeby dzialac szybko, nie czekac na wiecej.
  if (isGreatDealNow && !sellerLikelyFlexible) {
    return {
      urgency: 'dziala_teraz',
      headline: 'Cena jest już bardzo dobra — nie warto czekać',
      detail: 'Ta oferta stoi wyraźnie poniżej punktów odniesienia, a nic nie wskazuje na to, że sprzedający jest pod presją i zejdzie znacząco niżej. W tym segmencie dobre oferty znikają szybko — warto działać, zanim zrobi to ktoś inny, zamiast liczyć na dalszą przecenę.',
      suggestedNegotiationAmount: null,
      suggestedNegotiationPercent: null,
    }
  }

  // ── Sciezka 2: cena dobra JUZ TERAZ, ale sa tez sygnaly ze mozna ─────
  // jeszcze cos urwac - najbardziej "zlota rada", bo laczy oba scenariusze
  // (bezpieczne dzialanie teraz + prawdopodobne pole do negocjacji).
  if (isGreatDealNow && sellerLikelyFlexible) {
    return {
      urgency: 'neguj_i_dzialaj',
      headline: 'Cena już jest atrakcyjna — a jest jeszcze pole do negocjacji',
      detail: `Ta oferta jest dobra nawet po obecnej cenie, więc kupno teraz to bezpieczna decyzja — nie musisz na nic czekać. Jednocześnie sygnały (czas na rynku, wcześniejsze obniżki) sugerują, że sprzedający może być otwarty na rozmowę. Spróbuj zaproponować ok. ${negotiation.amount?.toLocaleString('pl-PL')} zł mniej (~${negotiation.percent}%) — a jeśli się nie uda, sama oferta i tak jest warta uwagi po cenie wyjściowej.`,
      suggestedNegotiationAmount: negotiation.amount,
      suggestedNegotiationPercent: negotiation.percent,
    }
  }

  // ── Sciezka 3: cena nie jest wybitna, ale sprzedajacy wyglada na ─────
  // zmotywowanego - jest pole do negocjacji, ale ZAWSZE z zastrzezeniem
  // ze to nie pewnik i inny kupujacy moze byc szybszy.
  if (sellerLikelyFlexible) {
    return {
      urgency: 'neutralne',
      headline: 'Można spróbować negocjacji — ale to nie pewnik',
      detail: `Cena nie jest wyjątkowo niska, ale sygnały (długi czas na rynku, wcześniejsze obniżki) sugerują, że sprzedający może być otwarty na rozmowę. Warto spróbować zaproponować ok. ${negotiation.amount?.toLocaleString('pl-PL')} zł mniej — to nie jest jednak gwarancja, a inny kupujący może zdecydować się szybciej. Jeśli oferta odpowiada Ci pod względem lokalizacji, nie zwlekałbym w nieskończoność na lepszą cenę.`,
      suggestedNegotiationAmount: negotiation.amount,
      suggestedNegotiationPercent: negotiation.percent,
    }
  }

  // ── Domyslny, ostrozny przypadek ──────────────────────────────────────
  return {
    urgency: 'neutralne',
    headline: 'Oferta w granicach normy dla tego segmentu',
    detail: 'Ta oferta nie wyróżnia się wyraźnie ani ceną, ani sygnałami o motywacji sprzedającego. Warto ocenić ją na podstawie lokalizacji, stanu i własnych priorytetów — dane rynkowe same w sobie nie wskazują ani na pilność, ani na wyraźne pole do negocjacji.',
    suggestedNegotiationAmount: null,
    suggestedNegotiationPercent: null,
  }
}
