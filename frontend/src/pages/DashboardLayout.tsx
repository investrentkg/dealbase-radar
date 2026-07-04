import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'

const NAV_ITEMS = [
  { to: '/wyszukiwarka', label: 'Wyszukiwarka' },
  { to: '/obserwowane', label: 'Obserwowane' },
  { to: '/alerty', label: 'Alerty' },
  { to: '/trend-rynku', label: 'Trend rynku' },
]

const PAGE_TITLES: Record<string, string> = {
  '/wyszukiwarka': 'Wyszukiwarka',
  '/obserwowane': 'Obserwowane wyszukiwania',
  '/alerty': 'Alerty',
  '/trend-rynku': 'Trend rynku',
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/logowanie" replace />

  const trial = user.plan === 'basic' ? daysLeft(user.trial_ends_at) : null

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-line bg-cream-2 flex flex-col">
        <div className="p-5 border-b border-line">
          <Logo />
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-2.5 text-sm border-l-2 transition-colors ${
                  isActive
                    ? 'text-ink font-medium bg-white border-blue'
                    : 'text-ink-soft border-transparent hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-line">
          <div className="text-xs text-ink-soft mb-2 truncate">
            {user.email}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-1.5 py-0.5 rounded bg-blue-tint text-blue text-[10px] font-medium uppercase">
              {user.plan}
            </span>
            {trial !== null && (
              <span className="text-[11px] text-ink-soft">
                {trial > 0 ? `trial: ${trial} dni` : 'trial zakończony'}
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="text-sm text-ink-soft hover:text-ink transition-colors"
          >
            Wyloguj się
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-line bg-white flex items-center px-8 flex-shrink-0">
          <h2 className="text-sm font-medium text-ink-soft">
            {PAGE_TITLES[location.pathname] || ''}
          </h2>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
