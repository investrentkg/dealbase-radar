import { Router, Response } from 'express'
import { AuthRequest, requireAuth } from '../middleware/auth'
import { calculateDealScore, DealScoreInput } from '../lib/dealScoreEngine'
import { simulateNegotiation } from '../lib/negotiationSimulator'

export const dealScoreRouter = Router()

// ── POST /api/deal-score/calculate ────────────────────────────────────
// Liczy Deal Score dla pojedynczej oferty. Docelowo references.* beda
// pobierane automatycznie (Cenogram/RCN + srednia z wynikow search +
// portal_listings_archive), na razie przyjmuje je jako input do testow.
dealScoreRouter.post('/calculate', requireAuth, (req: AuthRequest, res: Response) => {
  const input: DealScoreInput = req.body

  if (!input.offerPricePerM2) {
    return res.status(400).json({ error: 'offerPricePerM2 jest wymagane' })
  }

  const result = calculateDealScore(input)
  res.json(result)
})

// ── POST /api/deal-score/negotiation-simulator ────────────────────────
// UWAGA: to wersja heurystyczna, nie statystyka prawdziwych negocjacji -
// patrz obszerny komentarz w lib/negotiationSimulator.ts o planie rozwoju.
dealScoreRouter.post('/negotiation-simulator', requireAuth, (req: AuthRequest, res: Response) => {
  const { proposedPrice, askingPrice, referenceAvgPricePerM2, area } = req.body

  if (!proposedPrice || !askingPrice) {
    return res.status(400).json({ error: 'proposedPrice i askingPrice sa wymagane' })
  }

  const result = simulateNegotiation({
    proposedPrice,
    askingPrice,
    referenceAvgPricePerM2: referenceAvgPricePerM2 ?? null,
    area: area ?? null,
  })
  res.json(result)
})
