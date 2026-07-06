import { Router, Response } from 'express'
import { AuthRequest } from '../middleware/auth'

export const geocodeRouter = Router()

// GET /api/geocode/autocomplete?q=... — Places autocomplete przez backend
geocodeRouter.get('/autocomplete', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) return res.json({ predictions: [] })
    if (!q || (q as string).length < 2) return res.json({ predictions: [] })

    const input = encodeURIComponent((q as string) + ', Polska')
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&language=pl&components=country:pl&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json() as any
    res.json({ predictions: data.predictions || [] })
  } catch (err: any) {
    res.status(500).json({ predictions: [], error: err.message })
  }
})

// GET /api/geocode/details?place_id=... — Place details przez backend
geocodeRouter.get('/details', async (req: AuthRequest, res: Response) => {
  try {
    const { place_id } = req.query
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey || !place_id) return res.status(400).json({ error: 'Brak parametrów' })

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=address_components,geometry&language=pl&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json() as any
    res.json(data.result || {})
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
