import { useCallback, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { BoardGoalsPage } from '@/pages/KpiPage'
import { LeaderGoalsPage } from '@/pages/LeaderGoalsPage'
import { ImportPage } from '@/pages/ImportPage'
import { ChatPage } from '@/pages/Chat'
import { DashboardsPage } from '@/pages/DashboardsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { StrategyGoalsPage } from '@/pages/StrategyGoalsPage'
import { ProcessRegistryPage } from '@/pages/ProcessRegistryPage'
import { StaffPage } from '@/pages/StaffPage'
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
        <Route path="/" element={<Navigate to="/strategy-goals" replace />} />
        <Route path="/login" element={<Navigate to="/strategy-goals" replace />} />
        <Route path="/board-goals" element={<BoardGoalsPage />} />
        <Route path="/kpi" element={<Navigate to="/board-goals" replace />} />
        <Route path="/ppr" element={<Navigate to="/board-goals" replace />} />
        <Route path="/goals" element={<Navigate to="/board-goals" replace />} />
        <Route path="/leader-goals" element={<LeaderGoalsPage />} />
        <Route path="/strategy-goals" element={<StrategyGoalsPage />} />
        <Route path="/process-registry" element={<ProcessRegistryPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/knowledge" element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dashboards" element={<DashboardsPage />} />
      </Routes>
    </Layout>
  )
}

export default App
