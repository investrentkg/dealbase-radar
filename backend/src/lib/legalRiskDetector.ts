// ── Wykrywanie czerwonych flag prawnych z tresci ogloszenia ──────────────
// Inspiracja: prawdziwa opinia uzytkownika konkurencji, ktory sam wykryl
// info o zadluzonej nieruchomosci w opisie ogloszenia szybciej niz
// pracownik kancelarii komornika - bo te informacje SA w tekscie, tylko
// nikt ich nie wyciaga automatycznie i systematycznie.
//
// WAZNE ZASTRZEZENIE (musi trafic do UI, nie tylko do kodu): to jest
// heurystyka na podstawie SLOW w opisie - nie substytut sprawdzenia ksiegi
// wieczystej. Wykrywa SYGNALY do sprawdzenia, nie potwierdza faktow.
// Fałszywie ujemne (ryzyko nie wspomniane w opisie) sa mozliwe i typowe -
// dlatego zawsze pokazujemy to jako "sprawdz to", nie jako "to jest ryzyko/
// nie jest ryzykiem" w formie ostatecznego werdyktu.

export type LegalFlagCategory =
  | 'hipoteka_zadluzenie'
  | 'spor_sadowy'
  | 'brak_ksiegi_wieczystej'
  | 'udzial_wspolwlasnosc'
  | 'wynajem_lokatorzy'
  | 'stan_prawny_niejasny'

export interface LegalFlag {
  category: LegalFlagCategory
  label: string
  matchedPhrase: string
}

const FLAG_PATTERNS: { category: LegalFlagCategory; label: string; patterns: string[] }[] = [
  {
    category: 'hipoteka_zadluzenie',
    label: 'Możliwe obciążenie hipoteczne / zadłużenie',
    patterns: ['hipoteka', 'zadłużon', 'zaległości', 'komornicz', 'egzekuc', 'wierzyciel'],
  },
  {
    category: 'spor_sadowy',
    label: 'Możliwy spór prawny dotyczący nieruchomości',
    patterns: ['spór sądowy', 'toczy się postępowanie', 'roszczenie', 'zasiedzenie', 'sprawa w sądzie'],
  },
  {
    category: 'brak_ksiegi_wieczystej',
    label: 'Możliwy brak lub niekompletność księgi wieczystej',
    patterns: ['brak księgi wieczystej', 'w trakcie zakładania księgi', 'nieuregulowany stan prawny', 'bez księgi'],
  },
  {
    category: 'udzial_wspolwlasnosc',
    label: 'Sprzedaż udziału / współwłasność (nie pełna własność)',
    patterns: ['udział w', 'współwłasność', 'część nieruchomości', 'ułamkow'],
  },
  {
    category: 'wynajem_lokatorzy',
    label: 'Nieruchomość może być zamieszkana przez najemcę/lokatora',
    patterns: ['z lokatorem', 'wynajęte do', 'obecny najemca', 'umowa najmu do', 'zamieszkałe przez'],
  },
  {
    category: 'stan_prawny_niejasny',
    label: 'Wzmianka o niejasnym lub złożonym stanie prawnym',
    patterns: ['skomplikowany stan prawny', 'do wyjaśnienia', 'wymaga uregulowania', 'stan prawny do ustalenia'],
  },
]

export function detectLegalFlags(listing: { title?: string | null; description?: string | null }): LegalFlag[] {
  const text = `${listing.title || ''} ${listing.description || ''}`.toLowerCase()
  const flags: LegalFlag[] = []

  for (const rule of FLAG_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (text.includes(pattern)) {
        flags.push({ category: rule.category, label: rule.label, matchedPhrase: pattern })
        break // jedna flaga per kategoria, nie duplikujemy przy kilku dopasowaniach tej samej kategorii
      }
    }
  }

  return flags
}
