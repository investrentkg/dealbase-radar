import { useState } from 'react'
import * as api from '../lib/api'

export function NegotiationSimulator({ listing }: { listing: api.Listing }) {
  const [proposedPrice, setProposedPrice] = useState('')
  const [result, setResult] = useState<api.NegotiationResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function check() {
    if (!proposedPrice || !listing.price) return
    setLoading(true)
    try {
      const res = await api.simulateNegotiation({
        proposedPrice: Number(proposedPrice),
        askingPrice: listing.price,
        referenceAvgPricePerM2: listing.dealScore?.referenceAverage ?? null,
        area: listing.area,
      })
      setResult(res)
    } catch {
      // ciche niepowodzenie - nie blokuje reszty karty oferty
    } finally {
      setLoading(false)
    }
  }

  const likelihoodColor = {
    wysokie: 'text-[#3b6d11] bg-[#eaf3de]',
    umiarkowane: 'text-blue bg-blue-tint',
    niskie: 'text-red-700 bg-red-50',
    brak_danych: 'text-ink-soft bg-cream-2',
  }

  return (
    <div className="mt-3 border border-line rounded-lg p-3">
      <div className="text-xs font-semibold mb-2">🤝 Symulator negocjacji</div>
      <div className="flex gap-2 mb-2">
        <input
          type="number"
          value={proposedPrice}
          onChange={e => setProposedPrice(e.target.value)}
          placeholder="Twoja propozycja (zł)"
          className="flex-1 px-2.5 py-1.5 border border-line rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue/40"
        />
        <button
          onClick={check}
          disabled={loading || !proposedPrice}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-ink text-cream disabled:opacity-40"
        >
          {loading ? '...' : 'Sprawdź'}
        </button>
      </div>
      {result && (
        <div className={`text-xs rounded-lg p-2.5 ${likelihoodColor[result.likelihood]}`}>
          {result.message}
        </div>
      )}
    </div>
  )
}
