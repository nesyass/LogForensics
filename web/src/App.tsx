import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { LoadingBlock } from './components/ui'
import { useAuth } from './context/AuthContext'
import { AlertsPage } from './pages/AlertsPage'
import { EventsPage } from './pages/EventsPage'
import { ExportsPage } from './pages/ExportsPage'
import { IpsPage } from './pages/IpsPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OverviewPage } from './pages/OverviewPage'
import { SourcesPage } from './pages/SourcesPage'
import { TimelinePage } from './pages/TimelinePage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <LoadingBlock label="Restoring local session…" />
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="ips" element={<IpsPage />} />
        <Route path="exports" element={<ExportsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
