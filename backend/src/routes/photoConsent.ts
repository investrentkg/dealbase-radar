import { Router, Response } from 'express'
import { AuthRequest, requireAuth } from '../middleware/auth'
import { radarDb } from '../db/clients'

export const photoConsentRouter = Router()

const STATEMENT_TEXT =
  'Skontaktowałem się ze sprzedającym i uzyskałem zgodę na wykorzystanie jego zdjęć w materiale ofertowym. Sprzedający potwierdził, że zdjęcia są jego autorstwa lub własnością.'

// ── GET /api/photo-consent/statement ────────────────────────────────────
// Zwraca aktualną treść oświadczenia do wyświetlenia przed zaznaczeniem
// checkboxa - żeby frontend nigdy nie musiał hardkodować tego tekstu.
photoConsentRouter.get('/statement', requireAuth, (_req: AuthRequest, res: Response) => {
  res.json({ statement_text: STATEMENT_TEXT })
})

// ── GET /api/photo-consent/:listingReference ────────────────────────────
// Sprawdza czy dla danej oferty (np. "otodom:12345") istnieje już
// potwierdzenie zgody - używane do warunkowego odblokowania przycisku
// "Generuj PDF" we frontendzie.
photoConsentRouter.get('/:listingReference', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await radarDb
    .from('photo_consent_confirmations')
    .select('id, confirmed_at')
    .eq('user_id', req.user!.id)
    .eq('listing_reference', req.params.listingReference)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ confirmed: !!data, confirmed_at: data?.confirmed_at || null })
})

// ── POST /api/photo-consent ──────────────────────────────────────────────
// Zapisuje potwierdzenie zgody. Wymagane PRZED wygenerowaniem PDF-a z
// ofertą pochodzącą z agregatora (nie z własnej bazy InvestRent).
photoConsentRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { listing_reference, listing_url, listing_title } = req.body
  if (!listing_reference) {
    return res.status(400).json({ error: 'listing_reference jest wymagane' })
  }

  const { data, error } = await radarDb
    .from('photo_consent_confirmations')
    .insert({
      user_id: req.user!.id,
      listing_reference,
      listing_url: listing_url || null,
      listing_title: listing_title || null,
      statement_text: STATEMENT_TEXT,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})
