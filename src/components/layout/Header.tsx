import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, X, Sun, Moon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useThemeStore } from '../../store/useThemeStore'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/':             { title: 'Dashboard',           subtitle: 'Bienvenido de vuelta' },
  '/prospectos':   { title: 'Prospectos',           subtitle: 'Pipeline de nuevos negocios' },
  '/clientes':     { title: 'Clientes',             subtitle: 'Tus clientes activos' },
  '/ideas':        { title: 'Ideas Creativas',      subtitle: 'El cerebro de la agencia' },
  '/todo':         { title: 'To-Do Semanal',        subtitle: 'Organiza tu semana' },
  '/aprobaciones': { title: 'Aprobaciones',         subtitle: 'Contenido pendiente de revisión' },
  '/plan':         { title: 'Plan de Marketing',    subtitle: 'Estrategia y timeline por cliente' },
  '/metricas':     { title: 'Métricas',             subtitle: 'Rendimiento de plataformas' },
}

const notifications = [
  { id: 1, text: 'Nexus Inmobiliaria revisó tu propuesta', time: 'hace 5 min', dot: '#34d399' },
  { id: 2, text: 'Nueva publicación pendiente de aprobación', time: 'hace 1 hora', dot: '#f59e0b' },
  { id: 3, text: 'TechNova: hito completado', time: 'hace 2 horas', dot: '#DC143C' },
]

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()
  const isLight = theme === 'light'

  return (
    <motion.button
      onClick={toggleTheme}
      whileTap={{ scale: 0.93 }}
      title={isLight ? 'Modo oscuro' : 'Modo claro'}
      className="relative w-14 h-7 rounded-full border flex-shrink-0 overflow-hidden"
      style={{
        background: isLight ? 'rgb(var(--ink-700))' : 'rgb(var(--ink-700))',
        borderColor: 'rgb(var(--ink-500) / 0.5)',
      }}
    >
      {/* Track icons */}
      <Sun size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-amber-400 opacity-80" />
      <Moon size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-indigo-400 opacity-80" />

      {/* Sliding thumb */}
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center"
        style={{
          left: isLight ? 'calc(100% - 26px)' : '2px',
          background: isLight ? '#f59e0b' : '#6366f1',
        }}
      >
        {isLight
          ? <Sun size={11} className="text-white" />
          : <Moon size={11} className="text-white" />
        }
      </motion.div>
    </motion.button>
  )
}

export default function Header() {
  const location = useLocation()
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const pageKey = Object.keys(pageTitles).find(k =>
    k === '/' ? location.pathname === '/' : location.pathname.startsWith(k)
  ) ?? '/'
  const page = pageTitles[pageKey]

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b sticky top-0 z-30 backdrop-blur-sm"
      style={{ borderBottomColor: 'rgb(var(--ink-600) / 0.4)', backgroundColor: 'rgb(var(--ink-900) / 0.85)' }}>
      {/* Page Info */}
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-bold tracking-tight" style={{ color: 'rgb(var(--ink-100))' }}>{page.title}</h1>
        <p className="text-sm" style={{ color: 'rgb(var(--ink-300))' }}>{page.subtitle}</p>
      </motion.div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <AnimatePresence mode="wait">
          {showSearch ? (
            <motion.div
              key="search-open"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 border rounded-xl px-4 py-2 overflow-hidden"
              style={{ backgroundColor: 'rgb(var(--ink-800))', borderColor: 'rgb(var(--ink-500) / 0.4)' }}
            >
              <Search size={15} style={{ color: 'rgb(var(--ink-300))' }} className="flex-shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent text-sm outline-none flex-1 min-w-0 placeholder-ink-300"
                style={{ color: 'rgb(var(--ink-100))' }}
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery('') }}>
                <X size={14} style={{ color: 'rgb(var(--ink-300))' }} className="hover:text-white" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="search-closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSearch(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border transition-all"
              style={{ backgroundColor: 'rgb(var(--ink-800))', borderColor: 'rgb(var(--ink-500) / 0.4)', color: 'rgb(var(--ink-300))' }}
            >
              <Search size={16} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all"
            style={{ backgroundColor: 'rgb(var(--ink-800))', borderColor: 'rgb(var(--ink-500) / 0.4)', color: 'rgb(var(--ink-300))' }}
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-crimson-500 rounded-full animate-pulse" />
          </motion.button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 glass-card p-3 z-50"
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-2" style={{ color: 'rgb(var(--ink-300))' }}>
                  Notificaciones
                </p>
                {notifications.map(n => (
                  <div key={n.id} className="flex items-start gap-3 px-2 py-2.5 rounded-xl cursor-pointer transition-colors"
                    style={{ color: 'rgb(var(--ink-100))' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgb(var(--ink-700) / 0.5)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: n.dot }} />
                    <div>
                      <p className="text-sm leading-snug">{n.text}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--ink-300))' }}>{n.time}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-crimson-gradient flex items-center justify-center text-white font-bold text-sm cursor-pointer">
          TBS
        </div>
      </div>
    </header>
  )
}
