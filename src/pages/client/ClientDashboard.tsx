import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { useStore } from '../../store/useStore'
import { api } from '../../lib/api'

function formatShort(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

export default function ClientDashboard() {
  const { t } = useTranslation(['client', 'common'])
  const { user } = useAuthStore()
  const { clients } = useStore()
  const [plans, setPlans] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const client = clients.find(c => c.id === user?.clientId)

  useEffect(() => {
    Promise.all([
      api.get('/plans').then(r => setPlans(r.data)),
      api.get('/posts').then(r => setPosts(r.data)),
      user?.clientId ? api.get(`/metrics/${user.clientId}`).then(r => setMetrics(r.data)).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false))
  }, [])

  const plan = plans.find(p => p.client_id === user?.clientId)
  const pendingPosts = posts.filter(p => p.status === 'pending')

  const completedMilestones = plan?.milestones?.filter((m: any) => m.completed).length || 0
  const totalMilestones = plan?.milestones?.length || 0
  const planProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  const li = metrics?.platforms?.linkedin

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin text-crimson-400" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: (client?.color || '#DC143C') + '08' }} />
        <div className="relative">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ background: (client?.color || '#DC143C') + '30', border: `2px solid ${client?.color || '#DC143C'}40` }}>
              {client?.company?.slice(0, 2).toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white mb-1">
                {t('client:dashboard.hello', { name: user?.name?.split(' ')[0] })} <span style={{ color: client?.color || '#DC143C' }}></span> 👋
              </h1>
              <p className="text-ink-300 text-sm">
                {t('client:dashboard.welcome', { company: client?.company })}
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: t('client:dashboard.planProgress'), value: `${planProgress}%`, color: client?.color || '#DC143C', sub: t('client:dashboard.milestones', { completed: completedMilestones, total: totalMilestones }) },
              { label: t('client:dashboard.publications'), value: posts.length.toString(), color: '#7C3AED', sub: t('client:dashboard.pendingApproval', { count: pendingPosts.length }) },
              { label: t('client:dashboard.linkedinFollowers'), value: li ? formatShort(li.summary.followers) : '—', color: '#0077B5', sub: li ? t('client:dashboard.thisMonth', { percent: li.summary.follower_growth_pct }) : t('client:dashboard.connectAccount') },
            ].map(s => (
              <div key={s.label} className="bg-ink-800/50 rounded-xl p-3.5">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs font-medium text-ink-200 mt-0.5">{s.label}</p>
                <p className="text-xs text-ink-500 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
