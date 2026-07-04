import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      navigate('/wyszukiwarka')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się zalogować')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="bg-white border border-line rounded-2xl p-8">
          <h1 className="font-serif text-2xl mb-1">Zaloguj się</h1>
          <p className="text-ink-soft text-sm mb-6">Wróć do namierzania okazji</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue"
                placeholder="ty@przyklad.pl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Hasło</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-blue/40 focus:border-blue"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-cream py-2.5 rounded-lg font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-soft mt-6">
          Nie masz jeszcze konta?{' '}
          <Link to="/rejestracja" className="text-blue font-medium hover:underline">
            Dołącz do bety
          </Link>
        </p>
      </div>
    </div>
  )
}
