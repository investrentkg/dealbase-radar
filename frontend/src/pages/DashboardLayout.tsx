import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'

const NAV_ITEMS = [
  { to: '/wyszukiwarka', label: 'Wyszukiwarka' },
  { to: '/obserwowane', label: 'Obserwowane' },
]

export function DashboardLayout() {
  const { user, logout } = useAuth()

  if (!user) return <Navigate to="/logowanie" replace />

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
              <span className={`w-1.5 h-1.5 rounded-full ${item.to === '/wyszukiwarka' ? '' : ''} bg-line`} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-line">
          <div className="text-xs text-ink-soft mb-2">
            {user.email}
            <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-tint text-blue text-[10px] font-medium uppercase">
              {user.plan}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-ink-soft hover:text-ink transition-colors"
          >
            Wyloguj się
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
