import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Target, TrendingUp, Calendar, ChevronRight, Zap, Plus, X, Trash2,
  Loader2, Pencil, PenLine, Megaphone, Search, BarChart2, Palette,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { categoryColors, formatDate } from '../lib/utils'
import { api, reorderClients } from '../lib/api'
import type { MarketingMilestone, Client } from '../types'
import { useTranslation } from 'react-i18next'
import T from '../components/TranslatedText'
import { ClientStrip } from '../components/ClientStrip'

function useCategoryLabels() {
  const { t } = useTranslation(['admin'])
  return {
    strategy:  t('admin:plan.categories.strategy'),
    content:   t('admin:plan.categories.content'),
    ads:       t('admin:plan.categories.ads'),
    seo:       t('admin:plan.categories.seo'),
    analytics: t('admin:plan.categories.analytics'),
    design:    t('admin:plan.categories.design'),
  } as Record<string, string>
}

function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const props = { size, className: 'flex-shrink-0' }
  switch (category) {
    case 'strategy':  return <Target {...props} />
    case 'content':   return <PenLine {...props} />
    case 'ads':       return <Megaphone {...props} />
    case 'seo':       return <Search {...props} />
    case 'analytics': return <BarChart2 {...props} />
    case 'design':    return <Palette {...props} />
    default:          return <Target {...props} />
  }
}

function MilestoneNode({ milestone, index, total, onToggle, onDelete, onEdit, isAdmin }: {
  milestone: MarketingMilestone; index: number; total: number
  onToggle: () => void; onDelete: () => void; onEdit: () => void; isAdmin: boolean
}) {
  const categoryLabels = useCategoryLabels()
  const color = categoryColors[milestone.category] || '#EA580C'
  const isLast = index === total - 1

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <motion.div
          whileHover={{ scale: 1.15 }}
          onClick={onToggle}
          className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer z-10 flex-shrink-0 border-2 transition-all duration-300"
          style={{
            background: milestone.completed ? color : 'transparent',
            borderColor: color,
            boxShadow: milestone.completed ? `0 0 16px ${color}50` : 'none',
          }}
        >
          {milestone.completed
            ? <Check size={16} className="text-white" />
            : <span style={{ color }}><CategoryIcon category={milestone.category} size={14} /></span>
          }
        </motion.div>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1" style={{
            background: milestone.completed ? `linear-gradient(to bottom, ${color}, ${color}40)` : 'rgba(255,255,255,0.06)',
          }} />
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.06 }}
        className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}
      >
        <motion.div
          whileHover={{ x: 3 }}
          className={`glass-card p-4 border transition-all duration-300 ${milestone.completed ? 'opacity-55' : 'hover:border-white/10'}`}
          style={{ borderColor: milestone.completed ? `${color}30` : 'rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex-1 cursor-pointer" onClick={onToggle}>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full mb-1 inline-flex items-center gap-1" style={{ color, background: color + '15' }}>
                <CategoryIcon category={milestone.category} size={10} />
                {categoryLabels[milestone.category]}
              </span>
              <h4 className={`font-semibold text-sm ${milestone.completed ? 'line-through text-ink-400' : 'text-white'}`}>
                <T text={milestone.title} />
              </h4>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs text-ink-400">
                <Calendar size={11} /><span>{formatDate(milestone.date)}</span>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); onEdit() }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-ink-500 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete() }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-ink-500 hover:text-[var(--accent-light)] hover:bg-[rgb(var(--accent)_/_0.1)] transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-ink-300 leading-relaxed"><T text={milestone.description} translatable /></p>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── Modals ────────────────────────────────────────────────────────────────────

interface MilestoneForm { title: string; description: string; date: string; category: string }
interface KpiForm { label: string; target: string; current_value: string }

function NewPlanModal({ clients, onClose, onCreated }: {
  clients: any[]; onClose: () => void; onCreated: (plan: any) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const categoryLabels = useCategoryLabels()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [milestones, setMilestones] = useState<MilestoneForm[]>([{ title: '', description: '', date: '', category: 'strategy' }])
  const [kpis, setKpis] = useState<KpiForm[]>([{ label: '', target: '', current_value: '' }])

  const categories = ['strategy', 'content', 'ads', 'seo', 'analytics', 'design']

  const addMilestone = () => setMilestones(p => [...p, { title: '', description: '', date: '', category: 'strategy' }])
  const removeMilestone = (i: number) => setMilestones(p => p.filter((_, idx) => idx !== i))
  const updateMilestone = (i: number, field: keyof MilestoneForm, val: string) =>
    setMilestones(p => p.map((m, idx) => idx === i ? { ...m, [field]: val } : m))

  const addKpi = () => setKpis(p => [...p, { label: '', target: '', current_value: '' }])
  const removeKpi = (i: number) => setKpis(p => p.filter((_, idx) => idx !== i))
  const updateKpi = (i: number, field: keyof KpiForm, val: string) =>
    setKpis(p => p.map((k, idx) => idx === i ? { ...k, [field]: val } : k))

  const handleCreate = async () => {
    if (!clientId || !title || !startDate || !endDate) { setError(t('admin:plan.newPlanModal.requiredFields')); return }
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/plans', {
        client_id: clientId, title, objective, start_date: startDate, end_date: endDate,
        milestones: milestones.filter(m => m.title.trim()),
        kpis: kpis.filter(k => k.label.trim()),
      })
      onCreated(data); onClose()
    } catch (e: any) {
      setError(e.response?.data?.error || t('admin:plan.newPlanModal.errorCreating'))
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }} transition={{ duration: 0.25 }}
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h3 className="font-bold text-white text-xl">{t('admin:plan.newPlanModal.title')}</h3>
            <p className="text-xs text-ink-400 mt-0.5">{t('admin:plan.newPlanModal.step', { step })}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {[{ n: 1, l: t('admin:plan.newPlanModal.steps.info') }, { n: 2, l: t('admin:plan.newPlanModal.steps.milestones') }, { n: 3, l: t('admin:plan.newPlanModal.steps.kpis') }].map(s => (
              <div key={s.n} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${step >= s.n ? '' : 'border-ink-600 text-ink-500'}`}
                  style={step >= s.n ? { background: 'rgb(var(--accent))', borderColor: 'rgb(var(--accent))', color: 'var(--accent-text)' } : {}}>
                  {step > s.n ? <Check size={13} /> : s.n}
                </div>
                <span className={`text-xs font-medium ${step === s.n ? 'text-white' : 'text-ink-500'}`}>{s.l}</span>
                {s.n < 3 && <div className={`flex-1 h-px w-8 ${step > s.n ? '' : 'bg-ink-700'}`} style={step > s.n ? { background: 'rgb(var(--accent))' } : {}} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">{t('admin:plan.newPlanModal.clientLabel')}</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className="input-dark text-sm">
                  {clients.map(c => <option key={c.id} value={c.id} className="bg-ink-800">{c.company}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">{t('admin:plan.newPlanModal.planTitle')}</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('admin:plan.newPlanModal.planTitlePlaceholder')} className="input-dark text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">{t('admin:plan.newPlanModal.mainObjective')}</label>
                <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={3} placeholder={t('admin:plan.newPlanModal.objectivePlaceholder')} className="input-dark text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-300 mb-1.5">{t('admin:plan.newPlanModal.startDate')}</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-dark text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-300 mb-1.5">{t('admin:plan.newPlanModal.endDate')}</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-dark text-sm" />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <p className="text-sm text-ink-300">{t('admin:plan.newPlanModal.defineMilestones')}</p>
              {milestones.map((m, i) => (
                <div key={i} className="p-4 bg-ink-800/50 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-300">{t('admin:plan.newPlanModal.milestoneNumber', { number: i + 1 })}</span>
                    {milestones.length > 1 && (
                      <button onClick={() => removeMilestone(i)} className="text-ink-500 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <input type="text" value={m.title} onChange={e => updateMilestone(i, 'title', e.target.value)} placeholder={t('admin:plan.newPlanModal.milestoneTitlePlaceholder')} className="input-dark text-sm" />
                  <input type="text" value={m.description} onChange={e => updateMilestone(i, 'description', e.target.value)} placeholder={t('admin:plan.newPlanModal.milestoneDescPlaceholder')} className="input-dark text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={m.date} onChange={e => updateMilestone(i, 'date', e.target.value)} className="input-dark text-sm" />
                    <select value={m.category} onChange={e => updateMilestone(i, 'category', e.target.value)} className="input-dark text-sm">
                      {categories.map(c => <option key={c} value={c} className="bg-ink-800">{categoryLabels[c]}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <button onClick={addMilestone} className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-sm text-ink-300 hover:text-white hover:border-[rgb(var(--accent)_/_0.5)] transition-all flex items-center justify-center gap-2">
                <Plus size={14} /> {t('admin:plan.addMilestone')}
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <p className="text-sm text-ink-300">{t('admin:plan.newPlanModal.defineKpis')}</p>
              {kpis.map((k, i) => (
                <div key={i} className="p-4 bg-ink-800/50 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-300">{t('admin:plan.newPlanModal.kpiNumber', { number: i + 1 })}</span>
                    {kpis.length > 1 && (
                      <button onClick={() => removeKpi(i)} className="text-ink-500 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <input type="text" value={k.label} onChange={e => updateKpi(i, 'label', e.target.value)} placeholder={t('admin:plan.newPlanModal.kpiLabelPlaceholder')} className="input-dark text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={k.target} onChange={e => updateKpi(i, 'target', e.target.value)} placeholder={t('admin:plan.newPlanModal.kpiTargetPlaceholder')} className="input-dark text-sm" />
                    <input type="text" value={k.current_value} onChange={e => updateKpi(i, 'current_value', e.target.value)} placeholder={t('admin:plan.newPlanModal.kpiCurrentPlaceholder')} className="input-dark text-sm" />
                  </div>
                </div>
              ))}
              <button onClick={addKpi} className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-sm text-ink-300 hover:text-white hover:border-[rgb(var(--accent)_/_0.5)] transition-all flex items-center justify-center gap-2">
                <Plus size={14} /> {t('admin:plan.newPlanModal.addKpi')}
              </button>
            </motion.div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-white/5">
          <button onClick={step > 1 ? () => setStep(s => s - 1) : onClose} className="btn-ghost">
            {step > 1 ? t('admin:plan.newPlanModal.previous') : t('common:common.cancel')}
          </button>
          <div className="flex gap-3">
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && (!clientId || !title || !startDate || !endDate)) { setError(t('admin:plan.newPlanModal.requiredFields')); return }
                  setError(''); setStep(s => s + 1)
                }}
                className="btn-primary"
              >
                {t('admin:plan.newPlanModal.next')} <ChevronRight size={15} />
              </button>
            ) : (
              <button onClick={handleCreate} disabled={loading} className="btn-primary">
                {loading ? <><Loader2 size={15} className="animate-spin" /> {t('admin:plan.newPlanModal.creating')}</> : <><Zap size={15} /> {t('admin:plan.newPlanModal.createPlan')}</>}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EditPlanModal({ plan, onClose, onSaved }: {
  plan: any; onClose: () => void; onSaved: (updated: any) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const [title, setTitle] = useState(plan.title || '')
  const [objective, setObjective] = useState(plan.objective || '')
  const [startDate, setStartDate] = useState(plan.start_date?.split('T')[0] || '')
  const [endDate, setEndDate] = useState(plan.end_date?.split('T')[0] || '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!title) return
    setLoading(true)
    try {
      const { data } = await api.put(`/plans/${plan.id}`, { title, objective, start_date: startDate, end_date: endDate })
      onSaved(data); onClose()
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} className="glass-card p-6 w-full max-w-md"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">{t('admin:plan.editPlan')}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder={t('admin:plan.editPlanModal.titlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)} className="input-dark text-sm" />
          <textarea placeholder={t('admin:plan.editPlanModal.objectivePlaceholder')} value={objective} onChange={e => setObjective(e.target.value)} rows={3} className="input-dark text-sm resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-dark text-sm" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-dark text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : t('common:common.saveChanges')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function AddMilestoneModal({ planId, onClose, onAdded }: {
  planId: string; onClose: () => void; onAdded: (m: any) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const categoryLabels = useCategoryLabels()
  const categories = ['strategy', 'content', 'ads', 'seo', 'analytics', 'design']
  const [form, setForm] = useState({ title: '', description: '', date: '', category: 'strategy' })
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!form.title) return
    setLoading(true)
    try {
      const { data } = await api.post(`/plans/${planId}/milestones`, form)
      onAdded(data); onClose()
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} className="glass-card p-6 w-full max-w-md"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">{t('admin:plan.addMilestoneModal.title')}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder={t('admin:plan.addMilestoneModal.titlePlaceholder')} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input-dark text-sm" />
          <input type="text" placeholder={t('admin:plan.addMilestoneModal.descPlaceholder')} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input-dark text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="input-dark text-sm" />
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as typeof form.category }))} className="input-dark text-sm">
              {categories.map(c => <option key={c} value={c} className="bg-ink-800">{categoryLabels[c]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> {t('common:common.add')}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EditMilestoneModal({ planId, milestone, onClose, onSaved }: {
  planId: string; milestone: MarketingMilestone; onClose: () => void; onSaved: (m: any) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const categoryLabels = useCategoryLabels()
  const categories = ['strategy', 'content', 'ads', 'seo', 'analytics', 'design']
  const [form, setForm] = useState({
    title: milestone.title || '',
    description: milestone.description || '',
    date: milestone.date?.split('T')[0] || '',
    category: milestone.category || 'strategy',
  })
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!form.title) return
    setLoading(true)
    try {
      const { data } = await api.put(`/plans/${planId}/milestones/${milestone.id}`, form)
      onSaved(data); onClose()
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} className="glass-card p-6 w-full max-w-md"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">{t('admin:plan.editMilestoneModal.title')}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder={t('admin:plan.addMilestoneModal.titlePlaceholder')} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input-dark text-sm" />
          <input type="text" placeholder={t('admin:plan.addMilestoneModal.descPlaceholder')} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input-dark text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="input-dark text-sm" />
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as typeof form.category }))} className="input-dark text-sm">
              {categories.map(c => <option key={c} value={c} className="bg-ink-800">{categoryLabels[c]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : t('common:common.saveChanges')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EditKpiModal({ planId, kpi, onClose, onSaved, onDeleted }: {
  planId: string; kpi: any; onClose: () => void; onSaved: (k: any) => void; onDeleted: (id: string) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const [form, setForm] = useState({ label: kpi.label || '', target: kpi.target || '', current_value: kpi.current_value || '' })
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!form.label) return
    setLoading(true)
    try {
      const { data } = await api.put(`/plans/${planId}/kpis/${kpi.id}`, form)
      onSaved(data); onClose()
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!confirm(t('admin:plan.deleteKpiConfirm'))) return
    await api.delete(`/plans/${planId}/kpis/${kpi.id}`)
    onDeleted(kpi.id); onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} className="glass-card p-6 w-full max-w-sm"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">{t('admin:plan.editKpiModal.title')}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder={t('admin:plan.editKpiModal.labelPlaceholder')} value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} className="input-dark text-sm" />
          <input type="text" placeholder={t('admin:plan.editKpiModal.targetPlaceholder')} value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} className="input-dark text-sm" />
          <input type="text" placeholder={t('admin:plan.editKpiModal.currentPlaceholder')} value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} className="input-dark text-sm" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={handleDelete} className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs">
            <Trash2 size={13} />
          </button>
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : t('common:common.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlanMarketing() {
  const { t } = useTranslation(['admin', 'common'])
  const categoryLabels = useCategoryLabels()
  const { clients, setClients } = useStore()
  const { isAdmin } = useAuthStore()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '')
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [showEditPlan, setShowEditPlan] = useState(false)
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [editingKpi, setEditingKpi] = useState<any | null>(null)
  const [editingMilestone, setEditingMilestone] = useState<MarketingMilestone | null>(null)

  useEffect(() => {
    api.get('/plans').then(r => {
      setPlans(r.data)
      if (r.data.length > 0) setSelectedClientId(r.data[0].client_id)
    }).finally(() => setLoading(false))
  }, [])

  const handleCreated = (plan: any) => { setPlans(p => [plan, ...p]); setSelectedClientId(plan.client_id) }

  const handlePlanSaved = (updated: any) => {
    setPlans(p => p.map(x => x.id === updated.id ? updated : x))
  }

  const handleDeletePlan = async () => {
    if (!plan || !confirm(t('admin:plan.deletePlanConfirm'))) return
    await api.delete(`/plans/${plan.id}`)
    const remaining = plans.filter(p => p.id !== plan.id)
    setPlans(remaining)
    setSelectedClientId(remaining[0]?.client_id || '')
  }

  const toggleMilestone = async (planId: string, milestoneId: string) => {
    try {
      await api.patch(`/plans/${planId}/milestones/${milestoneId}/toggle`)
      const { data } = await api.get('/plans')
      setPlans(data)
    } catch (e) { console.error(e) }
  }

  const handleDeleteMilestone = async (planId: string, milestoneId: string) => {
    if (!confirm(t('admin:plan.deleteMilestoneConfirm'))) return
    await api.delete(`/plans/${planId}/milestones/${milestoneId}`)
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, milestones: p.milestones.filter((m: any) => m.id !== milestoneId) }
      : p
    ))
  }

  const handleMilestoneAdded = (milestone: any) => {
    if (!plan) return
    setPlans(prev => prev.map(p => p.id === plan.id
      ? { ...p, milestones: [...(p.milestones || []), milestone] }
      : p
    ))
  }

  const handleMilestoneSaved = (updated: any) => {
    if (!plan) return
    setPlans(prev => prev.map(p => p.id === plan.id
      ? { ...p, milestones: p.milestones.map((m: any) => m.id === updated.id ? updated : m) }
      : p
    ))
  }

  const handleKpiSaved = (updated: any) => {
    if (!plan) return
    setPlans(prev => prev.map(p => p.id === plan.id
      ? { ...p, kpis: p.kpis.map((k: any) => k.id === updated.id ? updated : k) }
      : p
    ))
  }

  const handleKpiDeleted = (kpiId: string) => {
    if (!plan) return
    setPlans(prev => prev.map(p => p.id === plan.id
      ? { ...p, kpis: p.kpis.filter((k: any) => k.id !== kpiId) }
      : p
    ))
  }

  const plan = plans.find(p => p.client_id === selectedClientId)
  const client = clients.find(c => c.id === selectedClientId)
  const completedCount = plan?.milestones?.filter((m: any) => m.completed).length || 0
  const totalCount = plan?.milestones?.length || 0
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const clientsWithPlans = clients.filter(c => plans.some(p => p.client_id === c.id))
  const admin = isAdmin()

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="section-title">{t('admin:plan.title')}</h2>
          <p className="text-ink-300 text-sm mt-1">{t('admin:plan.subtitle', { count: plans.length })}</p>
        </div>
        {admin && (
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowNewPlan(true)} className="btn-primary">
            <Plus size={16} /> {t('admin:plan.newPlan')}
          </motion.button>
        )}
      </div>

      {clientsWithPlans.length > 0 && (
        <ClientStrip<Client>
          clients={clientsWithPlans}
          selectedId={selectedClientId}
          onSelect={setSelectedClientId}
          getId={c => c.id}
          onReorder={async orderedIds => {
            await reorderClients(orderedIds)
            // Apply the new relative order of visible clients to the global list.
            const byId = new Map(clients.map(c => [c.id, c]))
            const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean) as Client[]
            const missing = clients.filter(c => !orderedIds.includes(c.id))
            setClients([...reordered, ...missing])
          }}
          renderItem={(c, active) => (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all duration-200 ${active ? 'text-white' : 'border-white/10 text-ink-300 bg-ink-800/40'}`}
              style={active ? { background: c.color + '20', borderColor: c.color + '60', color: c.color } : {}}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: c.color }}>
                {c.company.slice(0, 1)}
              </div>
              {c.company}
            </motion.div>
          )}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
        </div>
      )}

      {!loading && plan && client ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Timeline */}
          <div className="xl:col-span-2 space-y-4">
            {/* Plan Header */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: client.color + '10' }} />
              <div className="relative">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white" style={{ background: client.color + '30', border: `1px solid ${client.color}50` }}>
                    {client.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg"><T text={plan.title} /></h3>
                    <p className="text-xs text-ink-400 mt-0.5">{formatDate(plan.start_date)} → {formatDate(plan.end_date)}</p>
                  </div>
                  {admin && (
                    <div className="flex gap-1.5">
                      <button onClick={() => setShowEditPlan(true)} className="p-2 rounded-xl text-ink-400 hover:text-white hover:bg-white/10 transition-all">
                        <Pencil size={14} />
                      </button>
                      <button onClick={handleDeletePlan} className="p-2 rounded-xl text-ink-400 hover:text-[var(--accent-light)] hover:bg-[rgb(var(--accent)_/_0.1)] transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {plan.objective && <p className="text-sm text-ink-200 leading-relaxed mb-4"><T text={plan.objective} translatable /></p>}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-ink-400">{t('admin:plan.planProgress')}</span>
                      <span className="text-xs font-bold text-white">{t('admin:plan.milestonesCount', { completed: completedCount, total: totalCount })}</span>
                    </div>
                    <div className="w-full h-1.5 bg-ink-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full rounded-full" style={{ background: `linear-gradient(to right, ${client.color}, ${client.color}cc)` }} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: client.color }}>{progress}%</div>
                </div>
              </div>
            </motion.div>

            {/* Category legend */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <span key={key} className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: categoryColors[key] + '15', color: categoryColors[key] }}>
                  <CategoryIcon category={key} size={10} />
                  {label}
                </span>
              ))}
            </div>

            {/* Timeline */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Zap size={16} style={{ color: 'var(--accent-light)' }} /> {t('admin:plan.timelineTitle')}
                </h4>
                {admin && (
                  <button onClick={() => setShowAddMilestone(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-700 text-ink-300 hover:text-white hover:bg-ink-600 border border-white/10 text-xs transition-all">
                    <Plus size={12} /> {t('admin:plan.addMilestone')}
                  </button>
                )}
              </div>
              {plan.milestones?.length > 0 ? plan.milestones.map((milestone: MarketingMilestone, i: number) => (
                <MilestoneNode
                  key={milestone.id}
                  milestone={milestone}
                  index={i}
                  total={plan.milestones.length}
                  onToggle={() => toggleMilestone(plan.id, milestone.id)}
                  onDelete={() => handleDeleteMilestone(plan.id, milestone.id)}
                  onEdit={() => setEditingMilestone(milestone)}
                  isAdmin={admin}
                />
              )) : (
                <p className="text-ink-400 text-sm">{t('admin:plan.noMilestones')}</p>
              )}
            </div>
          </div>

          {/* KPIs + sidebar */}
          <div className="space-y-5">
            {(plan.kpis?.length > 0 || admin) && (
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Target size={16} style={{ color: 'var(--accent-light)' }} /> KPIs
                  </h4>
                  {admin && (
                    <button
                      onClick={async () => {
                        const label = prompt(t('admin:plan.editKpiModal.labelPlaceholder'))
                        if (!label) return
                        const target = prompt(t('admin:plan.editKpiModal.targetPlaceholder')) || ''
                        const { data } = await api.post(`/plans/${plan.id}/kpis`, { label, target, current_value: '' })
                        setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, kpis: [...(p.kpis || []), data] } : p))
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ink-700 text-ink-300 hover:text-white hover:bg-ink-600 border border-white/10 text-xs transition-all"
                    >
                      <Plus size={11} /> KPI
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {plan.kpis?.map((kpi: any, i: number) => {
                    const cur = parseFloat(kpi.current_value?.replace(/[^0-9.]/g, '') || '0')
                    const tgt = parseFloat(kpi.target?.replace(/[^0-9.]/g, '') || '100')
                    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0
                    return (
                      <motion.div key={kpi.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="p-3 rounded-xl bg-ink-800/50 group">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-ink-200"><T text={kpi.label} translatable /></p>
                          <div className="flex items-center gap-2">
                            <div><span className="text-sm font-bold text-white">{kpi.current_value || '—'}</span><span className="text-xs text-ink-400"> / {kpi.target}</span></div>
                            {admin && (
                              <button onClick={() => setEditingKpi(kpi)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-400 hover:text-white transition-all">
                                <Pencil size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-ink-700 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="h-full rounded-full" style={{ background: `linear-gradient(to right, ${client.color}, ${client.color}80)` }} />
                        </div>
                        <p className="text-xs text-ink-500 mt-1 text-right">{pct}%</p>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            <div className="glass-card p-5">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={16} style={{ color: 'var(--accent-light)' }} /> {t('admin:plan.byCategory')}
              </h4>
              <div className="space-y-2.5">
                {Object.keys(categoryColors).map(cat => {
                  const total = plan.milestones?.filter((m: any) => m.category === cat).length || 0
                  const done = plan.milestones?.filter((m: any) => m.category === cat && m.completed).length || 0
                  if (total === 0) return null
                  const color = categoryColors[cat]
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span style={{ color }}><CategoryIcon category={cat} size={13} /></span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-ink-300">{categoryLabels[cat]}</span>
                          <span className="text-xs text-ink-400">{done}/{total}</span>
                        </div>
                        <div className="h-1 bg-ink-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%`, background: color }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Proximos hitos */}
            <div className="glass-card p-5">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar size={16} style={{ color: 'var(--accent-light)' }} /> {t('admin:plan.upcomingMilestones')}
              </h4>
              <div className="space-y-2">
                {plan.milestones?.filter((m: any) => !m.completed).slice(0, 3).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-800/50">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: categoryColors[m.category] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{m.title}</p>
                      <p className="text-xs text-ink-400">{formatDate(m.date)}</p>
                    </div>
                    <ChevronRight size={12} className="text-ink-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <Target size={40} className="mb-4 opacity-50" style={{ color: 'rgb(var(--accent))' }} />
          <p className="text-lg font-semibold text-white mb-2">{t('admin:plan.noPlan')}</p>
          <p className="text-sm text-ink-300 mb-5">{t('admin:plan.noPlanDesc')}</p>
          {admin && (
            <button onClick={() => setShowNewPlan(true)} className="btn-primary">
              <Plus size={16} /> {t('admin:plan.createPlan')}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showNewPlan && <NewPlanModal clients={clients} onClose={() => setShowNewPlan(false)} onCreated={handleCreated} />}
        {showEditPlan && plan && <EditPlanModal plan={plan} onClose={() => setShowEditPlan(false)} onSaved={handlePlanSaved} />}
        {showAddMilestone && plan && <AddMilestoneModal planId={plan.id} onClose={() => setShowAddMilestone(false)} onAdded={handleMilestoneAdded} />}
        {editingMilestone && plan && (
          <EditMilestoneModal planId={plan.id} milestone={editingMilestone} onClose={() => setEditingMilestone(null)} onSaved={handleMilestoneSaved} />
        )}
        {editingKpi && plan && (
          <EditKpiModal planId={plan.id} kpi={editingKpi} onClose={() => setEditingKpi(null)} onSaved={handleKpiSaved} onDeleted={handleKpiDeleted} />
        )}
      </AnimatePresence>
    </div>
  )
}
