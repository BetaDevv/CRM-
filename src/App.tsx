import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import ClientPortal from './pages/ClientPortal'
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
  if (!isAdmin() && location.pathname !== '/portal' && location.pathname !== '/aprobaciones') {
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

  useEffect(() => {
    restoreSession()
  }, [])

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Client Portal */}
      <Route path="/portal" element={
        <AuthGuard><ClientPortal /></AuthGuard>
      } />

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
