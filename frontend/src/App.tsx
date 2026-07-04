import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardLayout } from './pages/DashboardLayout'
import { SearchPage } from './pages/SearchPage'
import { WatchlistPage } from './pages/WatchlistPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/logowanie" element={<LoginPage />} />
          <Route path="/rejestracja" element={<RegisterPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="/wyszukiwarka" element={<SearchPage />} />
            <Route path="/obserwowane" element={<WatchlistPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/wyszukiwarka" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
