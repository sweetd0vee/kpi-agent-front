import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { GoalsPage } from '@/pages/GoalsPage'
import { KpiPage } from '@/pages/KpiPage'
import { ImportPage } from '@/pages/ImportPage'
import { ChatPage } from '@/pages/Chat'
import { DashboardsPage } from '@/pages/DashboardsPage'
import { SettingsPage } from '@/pages/SettingsPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/kpi" replace />} />
        <Route path="/ppr" element={<GoalsPage />} />
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
