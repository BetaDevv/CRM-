import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useAccentStore } from './store/useAccentStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Prospectos from './pages/Prospectos'
import Clientes from './pages/Clientes'
import Ideas from './pages/Ideas'
import TodoSemanal from './pages/TodoSemanal'
import Aprobaciones from './pages/Aprobaciones'
import PlanMarketing from './pages/PlanMarketing'
import Metricas from './pages/Metricas'
import Usuarios from './pages/Usuarios'
import Calendario from './pages/Calendario'
import Documentos from './pages/Documentos'
import ClientDashboard from './pages/client/ClientDashboard'
import ClientPlan from './pages/client/ClientPlan'
import ClientPosts from './pages/client/ClientPosts'
import ClientMetricas from './pages/client/ClientMetricas'
import ClientDocumentos from './pages/client/ClientDocumentos'
import ClientTodos from './pages/client/ClientTodos'
import ClientIdeas from './pages/client/ClientIdeas'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, restoreSession, isAdmin } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    restoreSession()
  }, [])

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Client users → portal only
  if (!isAdmin() && !location.pathname.startsWith('/portal')) {
    return <Navigate to="/portal" replace />
  }

  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuthStore()
  if (!isAdmin()) return <Navigate to="/portal" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { restoreSession } = useAuthStore()
  // Trigger accent store rehydration — applies CSS variables on load
  useAccentStore()

  useEffect(() => {
    restoreSession()
  }, [])

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

      {/* Client Portal — Layout-wrapped */}
      <Route path="/portal" element={
        <AuthGuard><Layout /></AuthGuard>
      }>
        <Route index element={<ClientDashboard />} />
        <Route path="plan" element={<ClientPlan />} />
        <Route path="aprobaciones" element={<ClientPosts />} />
        <Route path="metricas" element={<ClientMetricas />} />
        <Route path="documentos" element={<ClientDocumentos />} />
        <Route path="todo" element={<ClientTodos />} />
        <Route path="ideas" element={<ClientIdeas />} />
      </Route>

      {/* Admin routes via Layout */}
      <Route path="/" element={
        <AuthGuard><AdminGuard><Layout /></AdminGuard></AuthGuard>
      }>
        <Route index element={<Dashboard />} />
        <Route path="prospectos" element={<Prospectos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="ideas" element={<Ideas />} />
        <Route path="todo" element={<TodoSemanal />} />
        <Route path="aprobaciones" element={<Aprobaciones />} />
        <Route path="plan" element={<PlanMarketing />} />
        <Route path="metricas" element={<Metricas />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="documentos" element={<Documentos />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
