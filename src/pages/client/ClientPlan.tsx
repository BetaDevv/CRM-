import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Calendar, Target, TrendingUp, CheckCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import T from '../../components/TranslatedText'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/utils'

export default function ClientPlan() {
  const { t } = useTranslation(['client', 'common'])
  const { user } = useAuthStore()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/plans').then(r => setPlans(r.data)).finally(() => setLoading(false))
  }, [])

  const plan = plans.find(p => p.client_id === user?.clientId)

  const completedMilestones = plan?.milestones?.filter((m: any) => m.completed).length || 0
  const totalMilestones = plan?.milestones?.length || 0
  const planProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      {plan ? (
        <>
          {/* Plan info */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-white text-lg"><T text={plan.title} /></h3>
                <p className="text-xs text-ink-400 mt-0.5">{formatDate(plan.start_date)} → {formatDate(plan.end_date)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-3xl font-black" style={{ color: 'var(--accent-hex)' }}>{planProgress}%</p>
                <p className="text-xs text-ink-400">{t('client:plan.completed')}</p>
              </div>
            </div>
            {plan.objective && <p className="text-sm text-ink-200 leading-relaxed"><T text={plan.objective} translatable /></p>}
            <div className="mt-4 w-full h-2 bg-ink-700 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${planProgress}%` }} transition={{ duration: 1.2, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: 'var(--accent-hex)' }} />
            </div>
          </div>

          {/* KPIs */}
          {plan.kpis?.length > 0 && (
            <div className="glass-card p-5">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2"><Target size={16} style={{ color: 'var(--accent-light)' }} /> {t('client:plan.keyIndicators')}</h4>
              <div className="grid grid-cols-2 gap-4">
                {plan.kpis.map((kpi: any, i: number) => {
                  const cur = parseFloat(kpi.current_value?.replace(/[^0-9.]/g, '') || '0')
                  const tgt = parseFloat(kpi.target?.replace(/[^0-9.]/g, '') || '100')
                  const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0
                  return (
                    <div key={i} className="bg-ink-800/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-ink-200"><T text={kpi.label} translatable /></p>
                        <p className="text-sm font-bold text-white">{pct}%</p>
                      </div>
                      <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden mb-2">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} className="h-full rounded-full" style={{ background: 'var(--accent-hex)' }} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-ink-400">
                        <span>{t('client:plan.actual')}: <strong className="text-white"><T text={kpi.current_value || '—'} /></strong></span>
                        <span>{t('client:plan.target')}: <strong className="text-white"><T text={kpi.target} /></strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="glass-card p-5">
            <h4 className="font-semibold text-white mb-5 flex items-center gap-2"><Calendar size={16} style={{ color: 'var(--accent-light)' }} /> {t('client:plan.milestonesTimeline')}</h4>
            <div className="space-y-0">
              {plan.milestones?.map((m: any, i: number) => {
                const isLast = i === plan.milestones.length - 1
                return (
                  <div key={m.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 z-10" style={{ background: m.completed ? 'rgb(var(--accent))' : 'transparent', borderColor: 'rgb(var(--accent))', boxShadow: m.completed ? '0 0 12px rgb(var(--accent) / 0.25)' : 'none' }}>
                        {m.completed ? <Check size={14} style={{ color: 'var(--accent-text)' }} /> : <div className="w-2 h-2 rounded-full" style={{ background: 'rgb(var(--accent))' }} />}
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: m.completed ? 'rgb(var(--accent) / 0.37)' : 'rgba(255,255,255,0.06)' }} />}
                    </div>
                    <div className={`flex-1 pb-5 ${isLast ? 'pb-0' : ''}`}>
                      <div className={`p-3.5 rounded-xl border transition-all ${m.completed ? 'bg-ink-800/20 border-white/3 opacity-60' : 'bg-ink-800/40 border-white/5'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h5 className={`text-sm font-semibold ${m.completed ? 'line-through text-ink-400' : 'text-white'}`}><T text={m.title} /></h5>
                          <span className="text-xs text-ink-400 flex-shrink-0">{formatDate(m.date)}</span>
                        </div>
                        {m.description && <p className="text-xs text-ink-300 mt-1 leading-relaxed"><T text={m.description} translatable /></p>}
                        {m.completed && <div className="flex items-center gap-1 text-green-400 text-xs mt-1.5"><CheckCircle size={11} /> {t('client:plan.milestoneCompleted')}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card p-12 flex flex-col items-center text-center">
          <TrendingUp size={40} className="text-ink-500 mb-3 opacity-30" />
          <p className="text-ink-300">{t('client:plan.emptyTitle')}</p>
          <p className="text-ink-500 text-sm">{t('client:plan.emptySubtitle')}</p>
        </div>
      )}
    </div>
  )
}
