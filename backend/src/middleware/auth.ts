import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { radarDb } from '../db/clients'

// Wzorowane na middleware/auth.ts z investrent-crm, ale bez wielo-tenancji
// (Radar to konta indywidualnych inwestorow, nie agencji) i bez rol
// agent/manager - tu liczy sie tylko plan subskrypcji (basic/pro/vip).
//
// UWAGA: obsluguje DWA rownolegle systemy tozsamosci (celowo, nie tymczasowo):
//   1) Nasz wlasny system (email/haslo, bcrypt + jwt.sign) - radar.users
//   2) Supabase Auth (logowanie Google) - auth.users + radar.profiles
// Token probujemy zweryfikowac najpierw jako nasz wlasny JWT; jesli to
// zawiedzie, sprawdzamy czy to token wydany przez Supabase. Docelowo (patrz
// notatki sesji) system 1 moze zostac wygaszony na rzecz Supabase Auth
// w calosci, ale to osobna decyzja - na razie oba dzialaja rownolegle.

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    plan: 'basic' | 'pro' | 'vip'
  }
}

async function tryOwnJwt(token: string): Promise<AuthRequest['user'] | null> {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || '') as AuthRequest['user']
  } catch {
    return null
  }
}

async function trySupabaseAuth(token: string): Promise<AuthRequest['user'] | null> {
  try {
    const { data, error } = await radarDb.auth.getUser(token)
    if (error || !data.user) return null

    const { data: profile } = await radarDb
      .from('profiles')
      .select('plan')
      .eq('id', data.user.id)
      .maybeSingle()

    return {
      id: data.user.id,
      email: data.user.email || '',
      plan: (profile?.plan as 'basic' | 'pro' | 'vip') || 'basic',
    }
  } catch {
    return null
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' })
  }

  const token = header.slice(7)
  const user = (await tryOwnJwt(token)) || (await trySupabaseAuth(token))

  if (!user) {
    return res.status(401).json({ error: 'Nieprawidlowy lub wygasly token' })
  }

  req.user = user
  next()
}

// ── Wymagaj konkretnego planu lub wyzszego ──────────────────────────────
const PLAN_RANK = { basic: 0, pro: 1, vip: 2 } as const

export function requirePlan(minPlan: keyof typeof PLAN_RANK) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Brak autoryzacji' })
    if (PLAN_RANK[req.user.plan] < PLAN_RANK[minPlan]) {
      return res.status(403).json({
        error: `Ta funkcja wymaga planu ${minPlan} lub wyzszego`,
        current_plan: req.user.plan
      })
    }
    next()
  }
}
