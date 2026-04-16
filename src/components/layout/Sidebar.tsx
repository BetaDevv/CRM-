import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, UserCheck, Lightbulb,
  CheckSquare, ThumbsUp, Map, ChevronLeft, ChevronRight,
  BarChart2, LogOut, UserCog, CalendarDays, FolderOpen,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import { LogoMark } from '../Logo'
import { useThemeStore } from '../../store/useThemeStore'

const adminNav = [
  { path: '/',             icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/prospectos',   icon: Users,           labelKey: 'nav.prospects' },
  { path: '/clientes',     icon: UserCheck,       labelKey: 'nav.clients' },
  { path: '/ideas',        icon: Lightbulb,       labelKey: 'nav.ideas' },
  { path: '/todo',         icon: CheckSquare,     labelKey: 'nav.todoWeekly' },
  { path: '/aprobaciones', icon: ThumbsUp,        labelKey: 'nav.approvals' },
  { path: '/plan',         icon: Map,             labelKey: 'nav.marketingPlan' },
  { path: '/calendario',   icon: CalendarDays,    labelKey: 'nav.calendar' },
  { path: '/metricas',     icon: BarChart2,       labelKey: 'nav.metrics' },
  { path: '/usuarios',    icon: UserCog,         labelKey: 'nav.users' },
  { path: '/documentos',  icon: FolderOpen,      labelKey: 'nav.documents' },
]

const clientNav = [
  { path: '/portal',             icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/portal/plan',        icon: Map,             labelKey: 'nav.plan' },
  { path: '/portal/aprobaciones', icon: ThumbsUp,       labelKey: 'nav.approvals' },
  { path: '/portal/ideas',       icon: Lightbulb,       labelKey: 'nav.ideas' },
  { path: '/portal/todo',        icon: CheckSquare,     labelKey: 'nav.todo' },
  { path: '/portal/actividad',   icon: CalendarDays,    labelKey: 'nav.activity' },
  { path: '/portal/metricas',    icon: BarChart2,       labelKey: 'nav.metrics' },
  { path: '/portal/documentos', icon: FolderOpen,      labelKey: 'nav.documents' },
]

export default function Sidebar() {
  const { t } = useTranslation('common')
  const { sidebarCollapsed, toggleSidebar } = useStore()
  const { user, logout } = useAuthStore()
  const { theme } = useThemeStore()
  const location = useLocation()
  const navigate = useNavigate()

  const isClient = user?.role === 'client'
  const navItems = isClient ? clientNav : adminNav
  const homePath = isClient ? '/portal' : '/'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full overflow-hidden flex-shrink-0"
      style={{
        backgroundColor: 'rgb(var(--ink-900))',
        borderRight: '1px solid rgb(var(--ink-600) / 0.4)',
      }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-crimson-700/5 to-transparent" />
      </div>

      {/* Logo — fixed height matches Header */}
      <div
        className="relative flex items-center px-4 flex-shrink-0"
        style={{
          height: '88px',
          borderBottom: '1px solid rgb(var(--ink-600) / 0.4)',
        }}
      >
        <AnimatePresence mode="wait">
          {sidebarCollapsed ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              className="flex-shrink-0 cursor-pointer"
              onClick={() => navigate(homePath)}
            >
              <LogoMark size="md" />
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="cursor-pointer"
              onClick={() => navigate(homePath)}
            >
              <img
                src={theme === 'light' ? '/logo-full-black.png' : '/logo-full-white.png'}
                alt="Nextgenbrand"
                className="h-7 object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = item.path === '/' || item.path === '/portal'
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path)

          return (
            <NavLink key={item.path} to={item.path}>
              <motion.div
                whileHover={{ x: sidebarCollapsed ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                title={sidebarCollapsed ? t(item.labelKey) : undefined}
                className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-colors duration-150 cursor-pointer
                  ${isActive
                    ? 'bg-crimson-700/20 border border-crimson-700/30'
                    : 'hover:bg-white/5 border border-transparent'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
                style={{ color: isActive ? 'rgb(var(--ink-100))' : 'rgb(var(--ink-300))' }}
              >
                {/* Animated background on active */}
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute inset-0 rounded-xl bg-crimson-700/10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}

                <item.icon
                  size={18}
                  className={`flex-shrink-0 relative z-10 transition-colors duration-150 ${
                    isActive ? 'text-crimson-400' : ''
                  }`}
                />

                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="relative z-10 whitespace-nowrap"
                    >
                      {t(item.labelKey)}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active left indicator */}
                {isActive && !sidebarCollapsed && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-crimson-500 rounded-full"
                  />
                )}
              </motion.div>
            </NavLink>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div
        className="px-2 py-3 space-y-1"
        style={{ borderTop: '1px solid rgb(var(--ink-600) / 0.4)' }}
      >
        <AnimatePresence>
          {!sidebarCollapsed && user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-2 mb-1"
            >
              <p className="text-xs font-semibold truncate" style={{ color: 'rgb(var(--ink-100))' }}>{user.name}</p>
              <p className="text-xs truncate" style={{ color: 'rgb(var(--ink-300))' }}>{user.email}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLogout}
          title={t('header.logout')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-ink-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={15} className="flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs">
                {t('header.logout')}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={toggleSidebar}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-all text-sm ${sidebarCollapsed ? 'justify-center' : ''}`}
          style={{ color: 'rgb(var(--ink-300))' }}
        >
          {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs">
                {t('nav.collapse')}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  )
}
