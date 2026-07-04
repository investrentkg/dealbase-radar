import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { useAuth } from '../context/AuthContext'

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
        checked ? 'bg-blue' : 'bg-line'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function AlertsPage() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<api.NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canUseSmsAndPush = user?.plan === 'pro' || user?.plan === 'vip'

  useEffect(() => {
    api.getAlertPreferences()
      .then(setPrefs)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function update(patch: Partial<api.NotificationPreferences>) {
    if (!prefs) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api.updateAlertPreferences(patch)
      setPrefs(updated)
    } catch (err: any) {
      setError(err.message || 'Nie udało się zapisać')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h1 className="font-serif text-2xl mb-1">Alerty</h1>
      <p className="text-ink-soft text-sm mb-6">Jak i kiedy chcesz się dowiadywać o nowych okazjach</p>

      {loading && <div className="text-ink-soft text-sm">Ładowanie...</div>}
      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {prefs && (
        <div className="bg-white border border-line rounded-xl divide-y divide-line">
          <div className="p-5 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">E-mail</div>
              <div className="text-xs text-ink-soft mt-0.5">Dostępne we wszystkich planach</div>
            </div>
            <Toggle checked={prefs.email_enabled} onChange={v => update({ email_enabled: v })} disabled={saving} />
          </div>

          <div className="p-5 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">SMS</div>
              <div className="text-xs text-ink-soft mt-0.5">
                {canUseSmsAndPush ? 'Krótka wiadomość przy wysokim Deal Score' : 'Wymaga planu Pro lub wyższego'}
              </div>
            </div>
            <Toggle checked={prefs.sms_enabled} onChange={v => update({ sms_enabled: v })} disabled={saving || !canUseSmsAndPush} />
          </div>

          <div className="p-5 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Powiadomienie push</div>
              <div className="text-xs text-ink-soft mt-0.5">
                {canUseSmsAndPush ? 'Z aplikacji mobilnej (wkrótce)' : 'Wymaga planu Pro lub wyższego'}
              </div>
            </div>
            <Toggle checked={prefs.push_enabled} onChange={v => update({ push_enabled: v })} disabled={saving || !canUseSmsAndPush} />
          </div>

          <div className="p-5">
            <div className="font-medium text-sm mb-2">Częstotliwość</div>
            <div className="flex gap-2">
              <button
                onClick={() => update({ frequency: 'instant' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  prefs.frequency === 'instant' ? 'bg-blue text-white border-blue' : 'border-line text-ink-soft'
                }`}
              >
                Natychmiast
              </button>
              <button
                onClick={() => update({ frequency: 'daily_digest' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  prefs.frequency === 'daily_digest' ? 'bg-blue text-white border-blue' : 'border-line text-ink-soft'
                }`}
              >
                Codzienne podsumowanie
              </button>
            </div>
          </div>
        </div>
      )}

      {!canUseSmsAndPush && (
        <div className="mt-4 text-xs text-ink-soft bg-cream-2 rounded-lg p-3">
          Twój obecny plan: <span className="font-medium uppercase">{user?.plan}</span>. Przejdź na Pro, żeby odblokować SMS i push.
        </div>
      )}
    </div>
  )
}
