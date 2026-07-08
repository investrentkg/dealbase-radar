// ── Generator PDF oferty z agregatora ───────────────────────────────────
// v2: pełna galeria zdjęć (nie tylko miniaturka) - wyniki wyszukiwania
// portali zawierają pełną tablicę zdjęć (item.images/photos), wcześniej
// wyciągaliśmy z niej tylko pierwsze zdjęcie do miniaturki. Teraz
// wykorzystujemy wszystkie (do 12) - zdjęcie hero na pierwszej stronie +
// siatka pozostałych na drugiej.
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

function drawHeader(doc: PDFKit.PDFDocument, pageWidth: number, margin: number, clientName?: string) {
  doc.rect(0, 0, pageWidth, 90).fill(COLORS.navy)
  doc.fillColor(COLORS.gold).font('Bold').fontSize(20).text('InvestRent', margin, 30)
  doc.fillColor('#FFFFFF').font('Regular').fontSize(10)
    .text('Nieruchomości nad Bałtykiem · Kołobrzeg', margin, 56)
  if (clientName) {
    doc.fillColor('#FFFFFF').font('Regular').fontSize(9)
      .text(`Przygotowano dla: ${clientName}`, pageWidth - margin - 200, 30, { width: 200, align: 'right' })
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
 * wykorzystanie zdjęć została już zweryfikowana PRZED wywołaniem tej
 * funkcji (patrz routes/offerPdf.ts) - ten moduł tylko renderuje.
 */
export async function generateOfferPdf(opts: OfferPdfOptions): Promise<Buffer> {
  const { listing, description, agentName, agentPhone, clientName } = opts

  // Zbierz wszystkie dostępne zdjęcia - pełna galeria jeśli jest, inaczej
  // pojedyncza miniaturka jako fallback (starsze wyniki wyszukiwania mogą
  // jej nie mieć, jeśli zostały zapisane przed tą zmianą)
  const photoUrls = (listing.photos && listing.photos.length > 0)
    ? listing.photos
    : (listing.thumbnail_url ? [listing.thumbnail_url] : [])

  // Pobierz wszystkie zdjęcia równolegle (max 12, ograniczone już w extractPhotos)
  const photoBuffers = (await Promise.all(photoUrls.map(url => fetchImageBuffer(url))))
    .filter((buf): buf is Buffer => !!buf)

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
      const pageHeight = doc.page.height
      const margin = 40

      // ═══════════════════ STRONA 1: zdjęcie hero + fakty ═══════════════
      drawHeader(doc, pageWidth, margin, clientName)
      let y = 110

      const [heroBuffer, ...restBuffers] = photoBuffers
      if (heroBuffer) {
        try {
          doc.image(heroBuffer, margin, y, { width: pageWidth - margin * 2, height: 280, fit: [pageWidth - margin * 2, 280], align: 'center' })
          y += 295
        } catch {
          // uszkodzony/niewczytywalny obraz - pomijamy, nie wywalamy calego PDF
        }
      }

      doc.fillColor(COLORS.textDark).font('Bold').fontSize(18)
        .text(listing.title || 'Oferta nieruchomości', margin, y, { width: pageWidth - margin * 2 })
      y = doc.y + 6

      if (listing.price) {
        doc.fillColor(COLORS.gold).font('Bold').fontSize(22)
          .text(`${Number(listing.price).toLocaleString('pl-PL')} zł`, margin, y)
        y = doc.y + 10
      }

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
        doc.fillColor(COLORS.textMuted).font('Regular').fontSize(9).text(label.toUpperCase(), x, rowY)
        doc.fillColor(COLORS.textDark).font('Bold').fontSize(13).text(value, x, rowY + 13)
      })
      y += Math.ceil(facts.length / 2) * 40 + 10

      if (photoUrls.length > 1) {
        doc.fillColor(COLORS.textMuted).font('Regular').fontSize(9)
          .text(`Zdjęć w tej ofercie: ${photoUrls.length} — pozostałe na kolejnej stronie`, margin, y)
      }

      // ═══════════════════ STRONA 2: siatka pozostałych zdjęć ═══════════
      if (restBuffers.length > 0) {
        doc.addPage()
        drawHeader(doc, pageWidth, margin, clientName)
        doc.fillColor(COLORS.navy).font('Bold').fontSize(14).text('Zdjęcia', margin, 108)

        const gridY0 = 135
        const gap = 10
        const cols = 2
        const cellW = (pageWidth - margin * 2 - gap * (cols - 1)) / cols
        const cellH = 150

        restBuffers.slice(0, 8).forEach((buf, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          const x = margin + col * (cellW + gap)
          const rowY = gridY0 + row * (cellH + gap)
          try {
            doc.image(buf, x, rowY, { width: cellW, height: cellH, fit: [cellW, cellH], align: 'center' })
          } catch {
            // pomijamy pojedyncze uszkodzone zdjecie
          }
        })
      }

      // ═══════════════════ Opis (zawsze na nowej stronie na końcu) ══════
      doc.addPage()
      drawHeader(doc, pageWidth, margin, clientName)
      let dy = 110
      doc.fillColor(COLORS.navy).font('Bold').fontSize(13).text('Opis nieruchomości', margin, dy)
      dy = doc.y + 8
      doc.fillColor(COLORS.textDark).font('Regular').fontSize(11)
        .text(description, margin, dy, { width: pageWidth - margin * 2, align: 'justify', lineGap: 3 })

      // ── Stopka kontaktowa (na ostatniej stronie) ──────────────────────
      const footerY = pageHeight - 80
      doc.rect(0, footerY, pageWidth, 80).fill(COLORS.cream)
      doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).strokeColor(COLORS.gold).lineWidth(2).stroke()
      doc.fillColor(COLORS.navy).font('Bold').fontSize(12).text(agentName || 'InvestRent Nieruchomości', margin, footerY + 18)
      doc.fillColor(COLORS.textMuted).font('Regular').fontSize(10).text(agentPhone || 'kontakt@investrent.com.pl', margin, footerY + 36)
      doc.fillColor(COLORS.textMuted).font('Regular').fontSize(8)
        .text('Materiał przygotowany na podstawie zgody właściciela nieruchomości na wykorzystanie zdjęć.', margin, footerY + 54, { width: pageWidth - margin * 2 })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
