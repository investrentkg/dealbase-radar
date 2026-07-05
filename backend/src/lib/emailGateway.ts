// ── Integracja e-mail — Resend ──────────────────────────────────────────
// Ten sam dostawca co w DealBase CRM (spójność, jeden dostawca do zarządzania
// w organizacji). Dopóki brak klucza, wysyłka jest no-opem (funkcja zwraca
// info o braku konfiguracji, nie rzuca błędem) - z tego samego powodu co
// w smsGateway.ts: żeby nie wywalać całego flow alertów tylko dlatego że
// e-mail jeszcze nie jest podłączony.

const RESEND_API = 'https://api.resend.com/emails'
const FROM_ADDRESS = 'DealBase Radar <alerty@dealbase.pl>'

export interface EmailSendResult {
  sent: boolean
  reason?: string
  messageId?: string
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<EmailSendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return { sent: false, reason: 'RESEND_API_KEY nie skonfigurowany' }
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    })

    const data = await res.json() as any
    if (!res.ok) {
      return { sent: false, reason: data.message || `HTTP ${res.status}` }
    }
    return { sent: true, messageId: data.id }
  } catch (err: any) {
    return { sent: false, reason: err.message }
  }
}
