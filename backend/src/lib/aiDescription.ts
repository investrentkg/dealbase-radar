// ── Generator opisu oferty przez AI ─────────────────────────────────────
// Kluczowe: opis jest generowany OD ZERA na podstawie samych faktów
// (adres, cena, metraż, pokoje itd.), NIE na podstawie oryginalnego opisu
// ogłoszeniodawcy - żeby nigdy nie kopiować cudzej twórczości tekstowej,
// nawet jeśli mamy zgodę na zdjęcia. Fakty (liczby, adres) nie podlegają
// prawu autorskiemu, więc są bezpieczną podstawą wejściową.
//
// Dopóki brak klucza, zwraca prosty opis szablonowy (nie AI, ale bezpieczny
// i funkcjonalny) - ten sam defensywny wzorzec co w email/smsGateway.

import { PortalListing } from '../portals/types'

export function isAiDescriptionConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

function fallbackDescription(listing: PortalListing): string {
  const parts: string[] = []
  parts.push(`Nieruchomość zlokalizowana w ${listing.address_district ? listing.address_district + ', ' : ''}${listing.address_city}.`)
  if (listing.area) parts.push(`Powierzchnia wynosi ${listing.area} m².`)
  if (listing.rooms_count) parts.push(`Liczba pokoi: ${listing.rooms_count}.`)
  if (listing.price) parts.push(`Cena: ${Number(listing.price).toLocaleString('pl-PL')} zł.`)
  parts.push('Zachęcamy do kontaktu w celu umówienia prezentacji i uzyskania szczegółowych informacji.')
  return parts.join(' ')
}

/**
 * Generuje własny opis oferty na podstawie faktów (nie kopiuje oryginalnego
 * tekstu ogłoszeniodawcy). Zwraca 2-3 akapity w profesjonalnym, ciepłym
 * tonie, dopasowanym do stylu InvestRent.
 */
export async function generateOfferDescription(listing: PortalListing): Promise<string> {
  if (!isAiDescriptionConfigured()) {
    return fallbackDescription(listing)
  }

  const facts = [
    `Typ nieruchomości: ${listing.property_type}`,
    `Rodzaj transakcji: ${listing.transaction_type}`,
    `Lokalizacja: ${listing.address_district ? listing.address_district + ', ' : ''}${listing.address_city}`,
    listing.area ? `Powierzchnia: ${listing.area} m²` : null,
    listing.rooms_count ? `Liczba pokoi: ${listing.rooms_count}` : null,
    listing.price ? `Cena: ${Number(listing.price).toLocaleString('pl-PL')} zł` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Napisz profesjonalny, ciepły opis oferty nieruchomości dla biura pośrednictwa InvestRent, WYŁĄCZNIE na podstawie poniższych faktów. NIE zmyślaj żadnych szczegółów, których nie ma na liście (np. stanu wykończenia, widoku, sąsiedztwa) - trzymaj się tylko podanych faktów, opisz je w atrakcyjny, płynny sposób. Długość: 2 krótkie akapity. Bez nagłówka, bez podpisu, sam tekst opisu.

Fakty:
${facts}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return fallbackDescription(listing)

    const data = await res.json() as any
    const text = data.content?.find((c: any) => c.type === 'text')?.text
    return text?.trim() || fallbackDescription(listing)
  } catch {
    return fallbackDescription(listing)
  }
}
