import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Users, UserCheck, Lightbulb, CheckSquare, ThumbsUp, ArrowUpRight, Zap, Target } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../lib/utils'
import { Link } from 'react-router-dom'
import { getActivity, type ActivityLog } from '../lib/api'

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export default function Dashboard() {
  const { clients, prospects, todos, ideas, posts } = useStore()

  const mrr = clients.filter(c => c.status === 'active').reduce((a, c) => a + c.monthlyFee, 0)
  const pendingPosts = posts.filter(p => p.status === 'pending').length
  const completedTodos = todos.filter(t => t.done).length
  const totalTodos = todos.length
  const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0

  // Pipeline estimado — sum(budget * probability / 100) for active prospects
  const pipelineEstimado = prospects
    .filter(p => p.status !== 'won' && p.status !== 'lost')
    .reduce((acc, p) => {
      const budgetNum = parseFloat((p.budget || '0').replace(/[^0-9.,]/g, '').replace(',', '')) || 0
      const prob = p.probability ?? 0
      return acc + (budgetNum * prob / 100)
    }, 0)

  const metrics = [
    {
      label: 'MRR',
      value: formatCurrency(mrr),
      sub: '+12% vs mes anterior',
      icon: TrendingUp,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.1)',
    },
    {
      label: 'Clientes Activos',
      value: clients.filter(c => c.status === 'active').length.toString(),
      sub: `${clients.length} en total`,
      icon: UserCheck,
      color: '#DC143C',
      bg: 'rgba(220,20,60,0.1)',
    },
    {
      label: 'Prospectos',
      value: prospects.length.toString(),
      sub: `${prospects.filter(p => p.status === 'negotiation').length} en negociación`,
      icon: Users,
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.1)',
    },
    {
      label: 'Pipeline Estimado',
      value: formatCurrency(pipelineEstimado),
      sub: `${prospects.filter(p => p.status !== 'won' && p.status !== 'lost').length} prospectos activos`,
      icon: Target,
      color: '#f97316',
      bg: 'rgba(249,115,22,0.1)',
    },
    {
      label: 'Posts Pendientes',
      value: pendingPosts.toString(),
      sub: 'Esperando aprobación',
      icon: ThumbsUp,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
    },
  ]

  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  useEffect(() => {
    getActivity(10)
      .then(setActivity)
      .catch(() => {})
      .finally(() => setActivityLoading(false))
  }, [])

  function activityColor(type: string): string {
    if (type.startsWith('prospect')) return '#60a5fa'
    if (type.startsWith('client')) return '#34d399'
    if (type.startsWith('post')) return '#DC143C'
    if (type.startsWith('idea')) return '#a78bfa'
    if (type.startsWith('todo')) return '#f59e0b'
    return '#9ca3af'
  }

  function timeAgo(dateStr: string): string {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = Math.max(0, now - then)
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Justo ahora'
    if (mins < 60) return `Hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Hace ${hours}h`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Ayer'
    if (days < 7) return `Hace ${days} días`
    return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-8">

      {/* Hero Banner */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-3xl bg-ink-800 border border-white/5 p-8">
        <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-crimson-700/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-crimson-400" fill="currentColor" />
            <span className="text-crimson-400 text-xs font-semibold uppercase tracking-widest">TheBrandingStudio CRM</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Hola, <span className="text-gradient-crimson">equipo creativo</span> 👋
          </h2>
          <p className="text-ink-200 max-w-xl">
            Tienes <strong className="text-white">{pendingPosts} publicaciones</strong> esperando aprobación y{' '}
            <strong className="text-white">{todos.filter(t => !t.done).length} tareas</strong> pendientes esta semana.
          </p>
          <div className="mt-5 flex items-center gap-6">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-300">Progreso semanal</span>
                <span className="text-xs font-semibold text-white">{progress}%</span>
              </div>
              <div className="w-48 h-1.5 bg-ink-600 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                  className="h-full bg-crimson-gradient rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Metrics */}
      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <motion.div key={m.label} variants={fadeUp} whileHover={{ y: -2 }} className="metric-card">
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: m.bg }}>
                <m.icon size={18} style={{ color: m.color }} />
              </div>
              <ArrowUpRight size={14} className="text-ink-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{m.value}</p>
              <p className="text-sm text-ink-300 mt-0.5">{m.label}</p>
              <p className="text-xs text-ink-400 mt-1">{m.sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Client List */}
        <motion.div variants={fadeUp} className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white">Clientes Activos</h3>
            <Link to="/clientes" className="text-xs text-crimson-400 hover:text-crimson-300 flex items-center gap-1">
              Ver todos <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {clients.filter(c => c.status === 'active').map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                  style={{ background: c.color + '33', border: `1px solid ${c.color}44` }}>
                  {c.company.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{c.company}</p>
                  <p className="text-xs text-ink-300 truncate">{c.services.join(' · ')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-white text-sm">{formatCurrency(c.monthlyFee)}</p>
                  <p className="text-xs text-ink-400">/mes</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div variants={fadeUp} className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white">Actividad Reciente</h3>
          </div>
          <div className="space-y-4">
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-2 h-2 rounded-full mt-1.5 bg-ink-600 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-ink-700 rounded w-3/4" />
                      <div className="h-2 bg-ink-700 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-ink-400">Sin actividad reciente</p>
            ) : (
              activity.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse"
                    style={{ background: activityColor(a.type) }} />
                  <div>
                    <p className="text-sm text-white leading-snug">{a.description}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

      </div>

      {/* Quick Links */}
      <motion.div variants={stagger} className="grid grid-cols-3 gap-4">
        {[
          { to: '/ideas', icon: Lightbulb, label: 'Ideas', count: ideas.length, color: '#a78bfa' },
          { to: '/todo', icon: CheckSquare, label: 'Tareas', count: todos.filter(t => !t.done).length, color: '#f59e0b' },
          { to: '/prospectos', icon: Users, label: 'Prospectos', count: prospects.length, color: '#60a5fa' },
        ].map(item => (
          <motion.div key={item.to} variants={fadeUp} whileHover={{ y: -3 }}>
            <Link to={item.to} className="glass-card-hover p-5 flex items-center gap-4 block">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: item.color + '15' }}>
                <item.icon size={20} style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{item.count}</p>
                <p className="text-sm text-ink-300">{item.label}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

    </motion.div>
  )
}
