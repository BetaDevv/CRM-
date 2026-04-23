import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '../../store/useAuthStore'
import { useStore } from '../../store/useStore'
import { api, getActivity, type ActivityLog } from '../../lib/api'
import { getLocale } from '../../lib/utils'

function formatShort(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

export default function ClientDashboard() {
  const { t } = useTranslation(['client', 'common', 'admin'])
  const { user } = useAuthStore()
  const { clients } = useStore()
  const [plans, setPlans] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const client = clients.find(c => c.id === user?.clientId)

  useEffect(() => {
    Promise.all([
      api.get('/plans').then(r => setPlans(r.data)),
      api.get('/posts').then(r => setPosts(r.data)),
      user?.clientId ? api.get(`/metrics/${user.clientId}`).then(r => setMetrics(r.data)).catch(() => {}) : Promise.resolve(),
      getActivity(8).then(setActivity).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const plan = plans.find(p => p.client_id === user?.clientId)
  const pendingPosts = posts.filter(p => p.status === 'pending')

  const completedMilestones = plan?.milestones?.filter((m: any) => m.completed).length || 0
  const totalMilestones = plan?.milestones?.length || 0
  const planProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  const li = metrics?.platforms?.linkedin

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('admin:dashboard.timeAgo.justNow')
    if (mins < 60) return t('admin:dashboard.timeAgo.minutesAgo', { count: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('admin:dashboard.timeAgo.hoursAgo', { count: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('admin:dashboard.timeAgo.daysAgo', { count: days })
    return new Date(dateStr).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
  }

  function translateActivity(a: ActivityLog): string {
    const colonIdx = a.description.lastIndexOf(': ')
    const entityName = colonIdx > -1 ? a.description.slice(colonIdx + 2) : ''
    const key = `admin:dashboard.activity.${a.type}`
    const translated = t(key, { name: entityName, defaultValue: '' })
    return translated || a.description
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-ink-800 border border-white/5 p-8">
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at top left, rgb(var(--accent) / 0.15) 0%, transparent 60%)` }} />
        <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: 'rgb(var(--accent) / 0.1)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} style={{ color: 'var(--accent-light)' }} fill="currentColor" />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent-light)' }}>{client?.company || 'Portal'}</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {t('client:dashboard.hello', { name: user?.name?.split(' ')[0] })} 👋
          </h1>
          <p className="text-ink-200 max-w-xl text-sm">
            {t('client:dashboard.welcome', { company: client?.company }).replace(/<\/?[0-9]+>/g, '')}
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: t('client:dashboard.planProgress'), value: `${planProgress}%`, color: 'var(--accent-hex)', sub: t('client:dashboard.milestones', { completed: completedMilestones, total: totalMilestones }) },
              { label: t('client:dashboard.publications'), value: posts.length.toString(), color: '#7C3AED', sub: t('client:dashboard.pendingApproval', { count: pendingPosts.length }) },
              { label: t('client:dashboard.linkedinFollowers'), value: li ? formatShort(li.summary.followers) : '—', color: '#0077B5', sub: li ? t('client:dashboard.thisMonth', { percent: li.summary.follower_growth_pct }) : t('client:dashboard.connectAccount') },
            ].map(s => (
              <div key={s.label} className="p-3.5">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs font-medium text-ink-200 mt-0.5">{s.label}</p>
                <p className="text-xs text-ink-500 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6">
        <h3 className="font-semibold text-white mb-5">{t('admin:dashboard.recentActivity')}</h3>
        <div className="space-y-4">
          {activity.length === 0 ? (
            <p className="text-sm text-ink-400">{t('admin:dashboard.noRecentActivity')}</p>
          ) : (
            activity.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-3"
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse"
                  style={{ background: 'var(--accent-hex)' }} />
                <div>
                  <p className="text-sm text-white leading-snug">{translateActivity(a)}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
