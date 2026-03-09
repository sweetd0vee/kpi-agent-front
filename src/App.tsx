import { useCallback, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { GoalsPage } from '@/pages/GoalsPage'
import { KpiPage } from '@/pages/KpiPage'
import { LeaderGoalsPage } from '@/pages/LeaderGoalsPage'
import { ImportPage } from '@/pages/ImportPage'
import { ChatPage } from '@/pages/Chat'
import { DashboardsPage } from '@/pages/DashboardsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { clearAuthenticated, isAuthenticated, setAuthenticated } from '@/lib/auth'

function App() {
  const [authenticated, setAuthenticatedState] = useState(() => isAuthenticated())

  const handleLogin = useCallback(() => {
    setAuthenticated()
    setAuthenticatedState(true)
  }, [])

  const handleLogout = useCallback(() => {
    clearAuthenticated()
    setAuthenticatedState(false)
  }, [])

  if (!authenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to="/kpi" replace />} />
        <Route path="/login" element={<Navigate to="/kpi" replace />} />
        <Route path="/ppr" element={<GoalsPage />} />
        <Route path="/leader-goals" element={<LeaderGoalsPage />} />
        <Route path="/goals" element={<Navigate to="/ppr" replace />} />
        <Route path="/kpi" element={<KpiPage />} />
        <Route path="/knowledge" element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dashboards" element={<DashboardsPage />} />
      </Routes>
    </Layout>
  )
}

export default App
