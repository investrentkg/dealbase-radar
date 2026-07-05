import { Router, Response } from 'express'
import { AuthRequest, requireAuth } from '../middleware/auth'
import { radarDb } from '../db/clients'
import { PortalListing } from '../portals/types'
import { generateOfferDescription } from '../lib/aiDescription'
import { generateOfferPdf } from '../lib/pdfGenerator'

export const offerPdfRouter = Router()

// ── POST /api/offer-pdf ──────────────────────────────────────────────────
// Generuje gotowy PDF oferty z pojedynczego kliknięcia. Dla ofert
// pochodzących z agregatora (nie własnej bazy InvestRent) WYMAGA
// wcześniejszego potwierdzenia zgody na zdjęcia (patrz routes/photoConsent.ts) -
// bez tego zwraca 403, nie generuje niczego.
offerPdfRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { listing, client_name, is_own_listing, agent_name, agent_phone } = req.body as {
    listing: PortalListing
    client_name?: string
    is_own_listing?: boolean
    agent_name?: string
    agent_phone?: string
  }

  if (!listing || !listing.portal || !listing.external_id) {
    return res.status(400).json({ error: 'listing (z portal i external_id) jest wymagane' })
  }

  const listingReference = `${listing.portal}:${listing.external_id}`

  // Gate zgody - pomijany tylko dla własnych ofert InvestRent
  if (!is_own_listing) {
    const { data: consent, error: consentError } = await radarDb
      .from('photo_consent_confirmations')
      .select('id')
      .eq('user_id', req.user!.id)
      .eq('listing_reference', listingReference)
      .limit(1)
      .maybeSingle()

    if (consentError) return res.status(500).json({ error: consentError.message })
    if (!consent) {
      return res.status(403).json({
        error: 'Brak potwierdzonej zgody na wykorzystanie zdjęć tej oferty. Potwierdź zgodę przed wygenerowaniem PDF.',
        requires_consent: true,
        listing_reference: listingReference,
      })
    }
  }

  try {
    const description = await generateOfferDescription(listing)
    const pdfBuffer = await generateOfferPdf({
      listing,
      description,
      agentName: agent_name,
      agentPhone: agent_phone,
      clientName: client_name,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="oferta-${listingReference.replace(':', '-')}.pdf"`)
    res.send(pdfBuffer)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Błąd generowania PDF' })
  }
})
