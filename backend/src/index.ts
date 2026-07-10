import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { authRouter } from './routes/auth'
import { searchRouter } from './routes/search'
import { dealScoreRouter } from './routes/dealscore'
import { auctionsRouter } from './routes/auctions'
import { watchlistRouter } from './routes/watchlist'
import { alertsRouter } from './routes/alerts'
import { cronRouter } from './routes/cron'
import { photoConsentRouter } from './routes/photoConsent'
import { offerPdfRouter } from './routes/offerPdf'
import { geocodeRouter } from './routes/geocode'
import { demandSignalsRouter } from './routes/demandSignals'
import { requireAuth } from './middleware/auth'
import { scanAllWatchlists } from './lib/watchlistScanner'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// ── Health check (jak w CRM: /health endpoint do weryfikacji po deployu) ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dealbase-radar-backend', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/search', searchRouter)
app.use('/api/deal-score', dealScoreRouter)
app.use('/api/auctions', auctionsRouter)
app.use('/api/watchlist', watchlistRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/cron', cronRouter)
app.use('/api/photo-consent', photoConsentRouter)
app.use('/api/offer-pdf', offerPdfRouter)
app.use('/api/geocode', requireAuth, geocodeRouter)
app.use('/api/demand-signals', demandSignalsRouter)

const PORT = process.env.PORT || 4100
app.listen(PORT, () => {
  console.log(`DealBase Radar backend running on port ${PORT}`)

  // Skaner watchlist — wcześniej odpalany 4x/dzień przez GitHub Actions
  // (zjadał limit minut Actions). Backend działa 24/7 na Railway, więc
  // harmonogram żyje bezpośrednio w procesie — zero dodatkowego kosztu,
  // niezależność od limitu GH Actions. scan-watchlists.yml zostaje jako
  // ręczny fallback (workflow_dispatch).
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => scanAllWatchlists(), 60000)
    setInterval(() => scanAllWatchlists(), 5 * 60 * 60 * 1000)
    console.log('🔍 Watchlist Scanner — scheduler uruchomiony (co 5h)')
  }
})
