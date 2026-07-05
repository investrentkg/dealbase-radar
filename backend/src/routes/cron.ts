import { Router, Request, Response } from 'express'
import { scanAllWatchlists } from '../lib/watchlistScanner'

export const cronRouter = Router()

// ── POST /api/cron/scan-watchlists ──────────────────────────────────────
// Wyzwalane cyklicznie (2x dziennie) przez zaplanowany workflow GitHub
// Actions - patrz .github/workflows/scan-watchlists.yml. Zabezpieczone
// nagłówkiem x-cron-secret (CRON_SECRET w zmiennych środowiskowych),
// analogicznie do x-diag-key w investrent-crm.
cronRouter.post('/scan-watchlists', async (req: Request, res: Response) => {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret || req.headers['x-cron-secret'] !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const result = await scanAllWatchlists()
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Błąd skanowania watchlist' })
  }
})
