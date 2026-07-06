import { Request, Response, NextFunction } from 'express'

// ── Autoryzacja miedzy-systemowa (Radar <-> CRM) ─────────────────────
// To NIE jest autoryzacja uzytkownika (patrz middleware/auth.ts) - to
// komunikacja miedzy dwoma backendami. Dlatego osobny, prosty klucz
// serwisowy w nagłówku, a nie JWT z tozsamoscia konkretnego czlowieka.
// Docelowo ten sam klucz bedzie skonfigurowany w Railway CRM, zeby
// mogl wolac te endpointy - patrz notatki sesji "rynek cien".

export function requireServiceAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-service-key']
  const expected = process.env.INTERNAL_SERVICE_API_KEY

  if (!expected) {
    return res.status(503).json({ error: 'Integracja miedzysystemowa nieskonfigurowana (brak INTERNAL_SERVICE_API_KEY)' })
  }
  if (key !== expected) {
    return res.status(401).json({ error: 'Nieprawidlowy klucz serwisowy' })
  }
  next()
}
