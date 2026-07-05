// ── Generator PDF oferty z agregatora ───────────────────────────────────
// v1: jedno zdjęcie (miniaturka z wyników wyszukiwania - to jedyne zdjęcie
// dostępne na tym etapie, wyniki wyszukiwania portali nie zawierają pełnej
// galerii). Żeby mieć wszystkie zdjęcia z ogłoszenia, trzeba by dobudować
// osobny krok "pobierz pełne dane oferty" per portal (Otodom/OLX/itd. mają
// osobne strony szczegółów) - to nie jest jeszcze zbudowane, do zrobienia
// w kolejnej sesji jeśli okaże się potrzebne.
//
// Branding zgodny z ustalonym systemem InvestRent: granat + złoto na
// kremowym tle, font DejaVu Sans (obsługa polskich znaków).

import PDFDocument from 'pdfkit'
import { PortalListing } from '../portals/types'

const COLORS = {
  navy: '#0D1F3C',
  gold: '#BF9A4A',
  cream: '#F9F6F0',
  textDark: '#1C1C1C',
  textMuted: '#6B6A63',
}

const FONT_REGULAR = `${__dirname}/../../assets/fonts/DejaVuSans.ttf`
const FONT_BOLD = `${__dirname}/../../assets/fonts/DejaVuSans-Bold.ttf`

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

export interface OfferPdfOptions {
  listing: PortalListing
  description: string
  agentName?: string
  agentPhone?: string
  clientName?: string
}

/**
 * Generuje PDF oferty i zwraca go jako Buffer. Zakłada, że zgoda na
 * wykorzystanie zdjęcia została już zweryfikowana PRZED wywołaniem tej
 * funkcji (patrz routes/offerPdf.ts) - ten moduł tylko renderuje.
 */
export async function generateOfferPdf(opts: OfferPdfOptions): Promise<Buffer> {
  const { listing, description, agentName, agentPhone, clientName } = opts

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.registerFont('Regular', FONT_REGULAR)
      doc.registerFont('Bold', FONT_BOLD)

      const pageWidth = doc.page.width
      const margin = 40

      // ── Pasek nagłówkowy (granat) ──────────────────────────────────
      doc.rect(0, 0, pageWidth, 90).fill(COLORS.navy)
      doc.fillColor(COLORS.gold).font('Bold').fontSize(20)
        .text('InvestRent', margin, 30)
      doc.fillColor('#FFFFFF').font('Regular').fontSize(10)
        .text('Nieruchomości nad Bałtykiem · Kołobrzeg', margin, 56)

      if (clientName) {
        doc.fillColor('#FFFFFF').font('Regular').fontSize(9)
          .text(`Przygotowano dla: ${clientName}`, pageWidth - margin - 200, 30, { width: 200, align: 'right' })
      }

      let y = 110

      // ── Zdjęcie ──────────────────────────────────────────────────────
      const imgBuffer = listing.thumbnail_url ? await fetchImageBuffer(listing.thumbnail_url) : null
      if (imgBuffer) {
        try {
          doc.image(imgBuffer, margin, y, { width: pageWidth - margin * 2, height: 280, fit: [pageWidth - margin * 2, 280], align: 'center' })
          y += 295
        } catch {
          // uszkodzony/niewczytywalny obraz - pomijamy, nie wywalamy calego PDF
        }
      }

      // ── Tytuł i cena ───────────────────────────────────────────────
      doc.fillColor(COLORS.textDark).font('Bold').fontSize(18)
        .text(listing.title || 'Oferta nieruchomości', margin, y, { width: pageWidth - margin * 2 })
      y = doc.y + 6

      if (listing.price) {
        doc.fillColor(COLORS.gold).font('Bold').fontSize(22)
          .text(`${Number(listing.price).toLocaleString('pl-PL')} zł`, margin, y)
        y = doc.y + 10
      }

      // ── Kluczowe fakty (siatka) ──────────────────────────────────────
      const facts: [string, string][] = [
        ['Lokalizacja', `${listing.address_district ? listing.address_district + ', ' : ''}${listing.address_city}`],
        ['Powierzchnia', listing.area ? `${listing.area} m²` : '—'],
        ['Liczba pokoi', listing.rooms_count ? String(listing.rooms_count) : '—'],
        ['Typ transakcji', listing.transaction_type === 'sprzedaz' ? 'Sprzedaż' : 'Wynajem'],
      ]

      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor('#E5E1D6').stroke()
      y += 14

      const colWidth = (pageWidth - margin * 2) / 2
      facts.forEach(([label, value], i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = margin + col * colWidth
        const rowY = y + row * 40
        doc.fillColor(COLORS.textMuted).font('Regular').fontSize(9)
          .text(label.toUpperCase(), x, rowY)
        doc.fillColor(COLORS.textDark).font('Bold').fontSize(13)
          .text(value, x, rowY + 13)
      })
      y += Math.ceil(facts.length / 2) * 40 + 16

      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor('#E5E1D6').stroke()
      y += 20

      // ── Opis (wygenerowany, nie kopiowany od ogłoszeniodawcy) ────────
      doc.fillColor(COLORS.navy).font('Bold').fontSize(13).text('Opis nieruchomości', margin, y)
      y = doc.y + 8
      doc.fillColor(COLORS.textDark).font('Regular').fontSize(11)
        .text(description, margin, y, { width: pageWidth - margin * 2, align: 'justify', lineGap: 3 })

      // ── Stopka kontaktowa ─────────────────────────────────────────────
      const footerY = doc.page.height - 80
      doc.rect(0, footerY, pageWidth, 80).fill(COLORS.cream)
      doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).strokeColor(COLORS.gold).lineWidth(2).stroke()
      doc.fillColor(COLORS.navy).font('Bold').fontSize(12)
        .text(agentName || 'InvestRent Nieruchomości', margin, footerY + 18)
      doc.fillColor(COLORS.textMuted).font('Regular').fontSize(10)
        .text(agentPhone || 'kontakt@investrent.com.pl', margin, footerY + 36)
      doc.fillColor(COLORS.textMuted).font('Regular').fontSize(8)
        .text('Materiał przygotowany na podstawie zgody właściciela nieruchomości na wykorzystanie zdjęć.', margin, footerY + 54, { width: pageWidth - margin * 2 })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
