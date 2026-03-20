import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, X, Sun, Moon, Check, CheckCheck, FileText, UserPlus, ThumbsUp, ThumbsDown, Target, Clock } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useThemeStore } from '../../store/useThemeStore'
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../../lib/api'
import type { Notification } from '../../lib/api'

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

function getNotifIcon(type: string) {
  switch (type) {
    case 'post_pending':        return <FileText size={14} className="text-amber-400" />
    case 'post_approved':       return <ThumbsUp size={14} className="text-emerald-400" />
    case 'post_rejected':       return <ThumbsDown size={14} className="text-red-400" />
    case 'prospect_new':        return <UserPlus size={14} className="text-blue-400" />
    case 'milestone_upcoming':  return <Target size={14} className="text-purple-400" />
    case 'prospect_stale':      return <Clock size={14} className="text-orange-400" />
    default:                    return <Bell size={14} className="text-gray-400" />
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days}d`
  return `hace ${Math.floor(days / 7)}sem`
}

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
      <Sun size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-amber-400 opacity-80" />
      <Moon size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-indigo-400 opacity-80" />

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
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const pageKey = Object.keys(pageTitles).find(k =>
    k === '/' ? location.pathname === '/' : location.pathname.startsWith(k)
  ) ?? '/'
  const page = pageTitles[pageKey]

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount()
      setUnreadCount(count)
    } catch { /* silently fail */ }
  }, [])

  // Fetch full notifications when panel opens
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications()
      setNotifications(data)
      // Also update unread count from the fetched data
      setUnreadCount(data.filter(n => !n.is_read).length)
    } catch { /* silently fail */ }
  }, [])

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Fetch full list when panel opens
  useEffect(() => {
    if (showNotifs) fetchNotifications()
  }, [showNotifs, fetchNotifications])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        showNotifs &&
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifs])

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* silently fail */ }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch { /* silently fail */ }
  }

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
            ref={bellRef}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all"
            style={{ backgroundColor: 'rgb(var(--ink-800))', borderColor: 'rgb(var(--ink-500) / 0.4)', color: 'rgb(var(--ink-300))' }}
          >
            <Bell size={16} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-crimson-500 text-white text-[10px] font-bold rounded-full"
                >
                  <span className="animate-pulse">{unreadCount > 99 ? '99+' : unreadCount}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute right-0 top-12 w-96 glass-card z-50 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b"
                  style={{ borderBottomColor: 'rgb(var(--ink-600) / 0.3)' }}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'rgb(var(--ink-100))' }}>
                      Notificaciones
                    </p>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-crimson-500/20 text-crimson-400">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs transition-colors hover:text-crimson-400"
                      style={{ color: 'rgb(var(--ink-300))' }}
                    >
                      <CheckCheck size={13} />
                      Marcar todas
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-[380px] overflow-y-auto scrollbar-thin"
                  style={{ scrollbarColor: 'rgb(var(--ink-600)) transparent' }}>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Bell size={28} style={{ color: 'rgb(var(--ink-500))' }} />
                      <p className="text-sm" style={{ color: 'rgb(var(--ink-400))' }}>No hay notificaciones</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => !n.is_read && handleMarkRead(n.id)}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b relative"
                        style={{
                          borderBottomColor: 'rgb(var(--ink-700) / 0.3)',
                          backgroundColor: n.is_read ? 'transparent' : 'rgb(var(--ink-700) / 0.25)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'rgb(var(--ink-700) / 0.5)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = n.is_read ? 'transparent' : 'rgb(var(--ink-700) / 0.25)'
                        }}
                      >
                        {/* Unread indicator */}
                        {!n.is_read && (
                          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-crimson-500" />
                        )}

                        {/* Icon */}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: 'rgb(var(--ink-700) / 0.6)' }}>
                          {getNotifIcon(n.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug" style={{ color: 'rgb(var(--ink-100))' }}>
                            {n.title}
                          </p>
                          {n.description && (
                            <p className="text-xs mt-0.5 leading-relaxed truncate" style={{ color: 'rgb(var(--ink-300))' }}>
                              {n.description}
                            </p>
                          )}
                          <p className="text-[11px] mt-1" style={{ color: 'rgb(var(--ink-400))' }}>
                            {timeAgo(n.created_at)}
                          </p>
                        </div>

                        {/* Mark as read icon */}
                        {!n.is_read && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMarkRead(n.id) }}
                            className="flex-shrink-0 mt-1 p-1 rounded-md transition-colors hover:bg-white/10"
                            title="Marcar como leída"
                          >
                            <Check size={13} style={{ color: 'rgb(var(--ink-400))' }} />
                          </button>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
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
