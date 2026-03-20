import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Calendar, Target, TrendingUp, ThumbsUp, RotateCcw, Send, ThumbsDown, Loader2, LogOut, BarChart2, CheckCircle, Bell, Linkedin, Users, Eye, Heart, Globe, Play, X, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import type { EventInput, DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import type { DatesSetArg } from '@fullcalendar/core'
import { useAuthStore } from '../store/useAuthStore'
import { useStore } from '../store/useStore'
import { LogoMark } from '../components/Logo'
import { api, getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarUsers, type CalendarEvent, type CalendarUser } from '../lib/api'
import { postStatusConfig, platformConfig, formatDate, categoryColors } from '../lib/utils'
import type { PostStatus } from '../types'

// Category icons are rendered inline using categoryColors only

function formatShort(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

const PORTAL_COLORS = ['#DC143C', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#F97316']

function toDatetimeLocal(isoStr: string): string {
  const d = new Date(isoStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toISOFromLocal(localStr: string): string {
  return new Date(localStr).toISOString()
}

function toFCEvent(event: CalendarEvent): EventInput {
  return {
    id: event.id,
    title: event.title,
    start: event.startTime,
    end: event.endTime,
    allDay: event.allDay,
    backgroundColor: event.color || '#DC143C',
    borderColor: event.color || '#DC143C',
    extendedProps: {
      description: event.description,
      participants: event.participants,
    },
  }
}

/* ─── Client Calendar Modal ─── */
function ClientEventModal({
  mode, initial, users, onSave, onDelete, onClose,
}: {
  mode: 'create' | 'edit'
  initial: { title: string; description: string; startTime: string; endTime: string; allDay: boolean; color: string; participantIds: string[] }
  users: CalendarUser[]
  onSave: (data: any) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [color, setColor] = useState(initial.color)
  const [participantIds, setParticipantIds] = useState<string[]>(initial.participantIds)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const adminUsers = users.filter(u => u.role === 'admin')

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        startTime: toISOFromLocal(startTime),
        endTime: toISOFromLocal(endTime),
        allDay,
        color,
        participantIds,
        isShared: true,
      })
      onClose()
    } catch {} finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try { await onDelete(); onClose() } catch {} finally { setDeleting(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex items-center justify-between p-5 pb-3 border-b border-white/5">
          <h3 className="text-lg font-bold text-white">{mode === 'create' ? 'Nueva Reunion' : 'Editar Evento'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-ink-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-ink-300">Titulo</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del evento..." className="input-dark" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-ink-300">Descripcion</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles..." rows={2} className="input-dark resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setAllDay(!allDay)} className={`relative w-10 h-5 rounded-full transition-colors ${allDay ? 'bg-crimson-600' : 'bg-ink-600'}`}>
              <motion.div animate={{ x: allDay ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 w-4 h-4 bg-white rounded-full" />
            </button>
            <span className="text-sm font-medium text-ink-200">Todo el dia</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-ink-300">Inicio</label>
              <input type={allDay ? 'date' : 'datetime-local'} value={allDay ? startTime.split('T')[0] : startTime} onChange={e => setStartTime(allDay ? e.target.value + 'T00:00' : e.target.value)} className="input-dark text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-ink-300">Fin</label>
              <input type={allDay ? 'date' : 'datetime-local'} value={allDay ? endTime.split('T')[0] : endTime} onChange={e => setEndTime(allDay ? e.target.value + 'T23:59' : e.target.value)} className="input-dark text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2 text-ink-300">Color</label>
            <div className="flex gap-2">
              {PORTAL_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px rgb(var(--ink-800)), 0 0 0 4px ${c}` : 'none' }}>
                  {color === c && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          {adminUsers.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-2 text-ink-300">Invitar al equipo</label>
              <div className="space-y-1">
                {adminUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${participantIds.includes(u.id) ? 'bg-crimson-600 border-crimson-600' : 'border-ink-500'}`}>
                      {participantIds.includes(u.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-ink-100">{u.name}</span>
                    <input type="checkbox" className="sr-only" checked={participantIds.includes(u.id)} onChange={() => setParticipantIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 p-5 pt-3 border-t border-white/5">
          {mode === 'edit' && onDelete && (
            <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all disabled:opacity-50">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Eliminar
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary text-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {mode === 'create' ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function ClientPortal() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { clients } = useStore()
  const [plans, setPlans] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'plan' | 'posts' | 'metrics' | 'calendario'>('plan')
  const [feedbackState, setFeedbackState] = useState<Record<string, { show: boolean; text: string }>>({})

  // Calendar state
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [calUsers, setCalUsers] = useState<CalendarUser[]>([])
  const [calModalOpen, setCalModalOpen] = useState(false)
  const [calModalMode, setCalModalMode] = useState<'create' | 'edit'>('create')
  const [calEditingEvent, setCalEditingEvent] = useState<CalendarEvent | null>(null)
  const [calModalInitial, setCalModalInitial] = useState<any>(null)
  const calRef = useRef<FullCalendar>(null)
  const calDateRangeRef = useRef<{ start: string; end: string } | null>(null)
  const calClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const calLastClickIdRef = useRef<string | null>(null)

  const client = clients.find(c => c.id === user?.clientId)

  useEffect(() => {
    Promise.all([
      api.get('/plans').then(r => setPlans(r.data)),
      api.get('/posts').then(r => setPosts(r.data)),
      user?.clientId ? api.get(`/metrics/${user.clientId}`).then(r => setMetrics(r.data)).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false))
  }, [])

  // Fetch calendar users on mount
  useEffect(() => {
    getCalendarUsers().then(setCalUsers).catch(() => {})
  }, [])

  const fetchCalEvents = useCallback(async (start?: string, end?: string) => {
    const s = start || calDateRangeRef.current?.start
    const e = end || calDateRangeRef.current?.end
    if (!s || !e) return
    try {
      const data = await getCalendarEvents(s, e)
      setCalEvents(data)
    } catch {}
  }, [])

  const handleCalDatesSet = useCallback((info: DatesSetArg) => {
    calDateRangeRef.current = { start: info.startStr, end: info.endStr }
    fetchCalEvents(info.startStr, info.endStr)
  }, [fetchCalEvents])

  const handleCalDateSelect = useCallback((info: DateSelectArg) => {
    setCalEditingEvent(null)
    setCalModalMode('create')
    setCalModalInitial({
      title: '', description: '',
      startTime: info.allDay ? info.startStr + 'T09:00' : toDatetimeLocal(info.startStr),
      endTime: info.allDay ? info.startStr + 'T10:00' : toDatetimeLocal(info.endStr),
      allDay: info.allDay, color: '#DC143C', participantIds: [],
    })
    setCalModalOpen(true)
    calRef.current?.getApi()?.unselect()
  }, [])

  const handleCalEventClick = useCallback((info: EventClickArg) => {
    const eventId = info.event.id
    if (calLastClickIdRef.current === eventId && calClickTimerRef.current) {
      clearTimeout(calClickTimerRef.current)
      calClickTimerRef.current = null
      calLastClickIdRef.current = null
      const ev = calEvents.find(e => e.id === eventId)
      if (!ev) return
      setCalEditingEvent(ev)
      setCalModalMode('edit')
      setCalModalInitial({
        title: ev.title, description: ev.description || '',
        startTime: toDatetimeLocal(ev.startTime), endTime: toDatetimeLocal(ev.endTime),
        allDay: ev.allDay, color: ev.color || '#DC143C',
        participantIds: ev.participants.map(p => p.id),
      })
      setCalModalOpen(true)
      return
    }
    calLastClickIdRef.current = eventId
    calClickTimerRef.current = setTimeout(() => { calClickTimerRef.current = null; calLastClickIdRef.current = null }, 300)
  }, [calEvents])

  const handleCalEventDrop = useCallback(async (info: EventDropArg) => {
    try { await updateCalendarEvent(info.event.id, { startTime: info.event.start?.toISOString(), endTime: (info.event.end || info.event.start)?.toISOString(), allDay: info.event.allDay }); fetchCalEvents() }
    catch { info.revert() }
  }, [fetchCalEvents])

  const handleCalEventResize = useCallback(async (info: EventResizeDoneArg) => {
    try { await updateCalendarEvent(info.event.id, { startTime: info.event.start?.toISOString(), endTime: (info.event.end || info.event.start)?.toISOString() }); fetchCalEvents() }
    catch { info.revert() }
  }, [fetchCalEvents])

  const handleCalSave = useCallback(async (data: any) => {
    if (calModalMode === 'create') { await createCalendarEvent(data) }
    else if (calEditingEvent) { await updateCalendarEvent(calEditingEvent.id, data) }
    fetchCalEvents()
  }, [calModalMode, calEditingEvent, fetchCalEvents])

  const handleCalDelete = useCallback(async () => {
    if (!calEditingEvent) return
    await deleteCalendarEvent(calEditingEvent.id)
    fetchCalEvents()
  }, [calEditingEvent, fetchCalEvents])

  const plan = plans.find(p => p.client_id === user?.clientId)
  const pendingPosts = posts.filter(p => p.status === 'pending')

  const handleStatusUpdate = async (postId: string, status: string, feedback?: string) => {
    const { data } = await api.patch(`/posts/${postId}/status`, { status, feedback })
    setPosts(p => p.map(x => x.id === postId ? data : x))
    setFeedbackState(prev => ({ ...prev, [postId]: { show: false, text: '' } }))
  }

  const toggleFeedback = (postId: string) => {
    setFeedbackState(prev => ({
      ...prev,
      [postId]: { show: !prev[postId]?.show, text: prev[postId]?.text || '' },
    }))
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const completedMilestones = plan?.milestones?.filter((m: any) => m.completed).length || 0
  const totalMilestones = plan?.milestones?.length || 0
  const planProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  const li = metrics?.platforms?.linkedin
  const meta = metrics?.platforms?.meta
  const tiktok = metrics?.platforms?.tiktok
  const ga4 = metrics?.platforms?.ga4
  const followersChart = li?.timeSeries?.followers?.slice(-14).filter((_: any, i: number) => i % 2 === 0) || []
  const igFollowersChart = meta?.timeSeries?.ig_followers?.slice(-14).filter((_: any, i: number) => i % 2 === 0) || []

  if (loading) return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-crimson-400" />
    </div>
  )

  return (
    <div className="min-h-screen bg-ink-950 dot-pattern">
      {/* Top Nav */}
      <nav className="sticky top-0 z-30 bg-ink-900/90 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size="sm" />
          <div>
            <p className="text-white font-bold text-sm leading-none">Portal de Cliente</p>
            <p className="text-ink-400 text-xs">{client?.company || user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingPosts.length > 0 && (
            <button onClick={() => setActiveTab('posts')} className="relative flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all">
              <Bell size={14} />
              {pendingPosts.length} para aprobar
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-crimson-600 rounded-full text-white text-xs flex items-center justify-center font-bold">
                {pendingPosts.length}
              </span>
            </button>
          )}
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-white transition-colors">
            <LogOut size={14} /> Salir
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-7 mb-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: (client?.color || '#DC143C') + '08' }} />
          <div className="relative">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ background: (client?.color || '#DC143C') + '30', border: `2px solid ${client?.color || '#DC143C'}40` }}>
                {client?.company?.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-black text-white mb-1">
                  Hola, <span style={{ color: client?.color || '#DC143C' }}>{user?.name?.split(' ')[0]}</span> 👋
                </h1>
                <p className="text-ink-300 text-sm">
                  Bienvenido al portal de <strong className="text-white">{client?.company}</strong>. Aquí puedes ver el progreso de tu estrategia digital.
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { label: 'Progreso del Plan', value: `${planProgress}%`, color: client?.color || '#DC143C', sub: `${completedMilestones}/${totalMilestones} hitos` },
                { label: 'Publicaciones', value: posts.length.toString(), color: '#7C3AED', sub: `${pendingPosts.length} pendientes de aprobación` },
                { label: 'Seguidores LinkedIn', value: li ? formatShort(li.summary.followers) : '—', color: '#0077B5', sub: li ? `+${li.summary.follower_growth_pct}% este mes` : 'Conectar cuenta' },
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { k: 'plan', l: 'Plan Estratégico' },
            { k: 'posts', l: `Aprobaciones${pendingPosts.length > 0 ? ` (${pendingPosts.length})` : ''}` },
            { k: 'calendario', l: 'Calendario' },
            { k: 'metrics', l: 'Métricas' },
          ].map(tab => (
            <button
              key={tab.k}
              onClick={() => setActiveTab(tab.k as any)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${activeTab === tab.k ? 'bg-crimson-700/20 border-crimson-700/30 text-white' : 'border-white/10 text-ink-300 hover:text-white hover:bg-white/5'}`}
            >
              {tab.l}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── Plan Tab ─── */}
          {activeTab === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-5">
              {plan ? (
                <>
                  {/* Plan info */}
                  <div className="glass-card p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-bold text-white text-lg">{plan.title}</h3>
                        <p className="text-xs text-ink-400 mt-0.5">{formatDate(plan.start_date)} → {formatDate(plan.end_date)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-3xl font-black" style={{ color: client?.color || '#DC143C' }}>{planProgress}%</p>
                        <p className="text-xs text-ink-400">completado</p>
                      </div>
                    </div>
                    {plan.objective && <p className="text-sm text-ink-200 leading-relaxed">{plan.objective}</p>}
                    <div className="mt-4 w-full h-2 bg-ink-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${planProgress}%` }} transition={{ duration: 1.2, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: client?.color || '#DC143C' }} />
                    </div>
                  </div>

                  {/* KPIs */}
                  {plan.kpis?.length > 0 && (
                    <div className="glass-card p-5">
                      <h4 className="font-semibold text-white mb-4 flex items-center gap-2"><Target size={16} className="text-crimson-400" /> Indicadores Clave</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {plan.kpis.map((kpi: any, i: number) => {
                          const cur = parseFloat(kpi.current_value?.replace(/[^0-9.]/g, '') || '0')
                          const tgt = parseFloat(kpi.target?.replace(/[^0-9.]/g, '') || '100')
                          const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0
                          return (
                            <div key={i} className="bg-ink-800/40 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-ink-200">{kpi.label}</p>
                                <p className="text-sm font-bold text-white">{pct}%</p>
                              </div>
                              <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden mb-2">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} className="h-full rounded-full" style={{ background: client?.color || '#DC143C' }} />
                              </div>
                              <div className="flex items-center justify-between text-xs text-ink-400">
                                <span>Actual: <strong className="text-white">{kpi.current_value || '—'}</strong></span>
                                <span>Meta: <strong className="text-white">{kpi.target}</strong></span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="glass-card p-5">
                    <h4 className="font-semibold text-white mb-5 flex items-center gap-2"><Calendar size={16} className="text-crimson-400" /> Timeline de Hitos</h4>
                    <div className="space-y-0">
                      {plan.milestones?.map((m: any, i: number) => {
                        const color = categoryColors[m.category] || '#DC143C'
                        const isLast = i === plan.milestones.length - 1
                        return (
                          <div key={m.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 z-10" style={{ background: m.completed ? color : 'transparent', borderColor: color, boxShadow: m.completed ? `0 0 12px ${color}40` : 'none' }}>
                                {m.completed ? <Check size={14} className="text-white" /> : <div className="w-2 h-2 rounded-full" style={{ background: categoryColors[m.category] || '#DC143C' }} />}
                              </div>
                              {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: m.completed ? color + '60' : 'rgba(255,255,255,0.06)' }} />}
                            </div>
                            <div className={`flex-1 pb-5 ${isLast ? 'pb-0' : ''}`}>
                              <div className={`p-3.5 rounded-xl border transition-all ${m.completed ? 'bg-ink-800/20 border-white/3 opacity-60' : 'bg-ink-800/40 border-white/5'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <h5 className={`text-sm font-semibold ${m.completed ? 'line-through text-ink-400' : 'text-white'}`}>{m.title}</h5>
                                  <span className="text-xs text-ink-400 flex-shrink-0">{formatDate(m.date)}</span>
                                </div>
                                {m.description && <p className="text-xs text-ink-300 mt-1 leading-relaxed">{m.description}</p>}
                                {m.completed && <div className="flex items-center gap-1 text-green-400 text-xs mt-1.5"><CheckCircle size={11} /> Completado</div>}
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
                  <p className="text-ink-300">Tu plan estratégico está siendo preparado.</p>
                  <p className="text-ink-500 text-sm">El equipo de TheBrandingStudio lo tendrá listo pronto.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Posts Tab ─── */}
          {activeTab === 'posts' && (
            <motion.div key="posts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-4">
              {posts.length === 0 ? (
                <div className="glass-card p-12 flex flex-col items-center text-center">
                  <ThumbsUp size={40} className="text-ink-500 mb-3 opacity-30" />
                  <p className="text-ink-300">No hay publicaciones aún. El equipo está trabajando en ellas.</p>
                </div>
              ) : posts.map(post => {
                const cfg = postStatusConfig[post.status as PostStatus]
                const fb = feedbackState[post.id]
                return (
                  <motion.div key={post.id} layout className="glass-card overflow-hidden">
                    <div className="h-1" style={{ background: cfg.color }} />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: platformConfig[post.platform]?.color || '#6b7280' }}>{platformConfig[post.platform]?.short || '?'}</div>
                          <div>
                            <p className="font-semibold text-white text-sm">{post.title}</p>
                            <p className="text-xs text-ink-400">{post.platform} · {formatDate(post.scheduled_date)}</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                      </div>

                      <div className="bg-ink-900/60 rounded-xl p-4 mb-4 border border-white/5">
                        <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      </div>

                      {post.media_urls?.length > 0 && (
                        <div className={`grid gap-2 mb-4 ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {post.media_urls.map((url: string, i: number) => (
                            <img key={i} src={url} alt="" className="w-full rounded-xl object-cover border border-white/10" style={{ maxHeight: 200 }} />
                          ))}
                        </div>
                      )}

                      {post.feedback && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                          <p className="text-amber-400 font-semibold mb-0.5">Nota del equipo:</p>
                          <p className="text-amber-200">{post.feedback}</p>
                        </div>
                      )}

                      {post.status === 'pending' && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => handleStatusUpdate(post.id, 'approved')}
                              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-bold hover:bg-green-500/20 transition-all">
                              <ThumbsUp size={16} fill="currentColor" /> ¡Aprobar!
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => toggleFeedback(post.id)}
                              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-sm font-bold hover:bg-amber-500/20 transition-all">
                              <RotateCcw size={14} /> Pedir cambios
                            </motion.button>
                          </div>
                          <AnimatePresence>
                            {fb?.show && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="flex gap-2 pt-1">
                                  <input type="text" placeholder="¿Qué cambiamos?" value={fb.text} onChange={e => setFeedbackState(prev => ({ ...prev, [post.id]: { ...prev[post.id], text: e.target.value } }))} className="input-dark text-sm flex-1" />
                                  <button onClick={() => handleStatusUpdate(post.id, 'revision', fb.text)}
                                    className="px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20">
                                    <Send size={15} />
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {post.status === 'approved' && <p className="text-sm text-green-400 font-semibold flex items-center gap-2"><CheckCircle size={14} fill="currentColor" /> Publicación aprobada</p>}
                      {post.status === 'revision' && <p className="text-sm text-amber-400 flex items-center gap-2"><RotateCcw size={14} /> Cambios enviados — el equipo los está aplicando</p>}
                      {post.status === 'rejected' && <p className="text-sm text-red-400 flex items-center gap-2"><ThumbsDown size={14} /> Publicación rechazada</p>}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {/* ─── Calendario Tab ─── */}
          {activeTab === 'calendario' && (
            <motion.div key="calendario" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
              <div className="glass-card p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Calendar size={16} className="text-crimson-400" /> Tu Calendario
                  </h4>
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const now = new Date(); const end = new Date(now.getTime() + 60 * 60 * 1000)
                      setCalEditingEvent(null); setCalModalMode('create')
                      setCalModalInitial({ title: '', description: '', startTime: toDatetimeLocal(now.toISOString()), endTime: toDatetimeLocal(end.toISOString()), allDay: false, color: '#DC143C', participantIds: [] })
                      setCalModalOpen(true)
                    }}
                    className="btn-primary text-xs py-2 px-3"
                  >
                    <Plus size={14} /> Nueva reunion
                  </motion.button>
                </div>
                <FullCalendar
                  ref={calRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="timeGridWeek"
                  headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                  locale={esLocale}
                  firstDay={1}
                  slotMinTime="06:00:00"
                  slotMaxTime="22:00:00"
                  slotDuration="00:30:00"
                  snapDuration="00:15:00"
                  editable={true}
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={true}
                  nowIndicator={true}
                  events={calEvents.map(toFCEvent)}
                  eventDrop={handleCalEventDrop}
                  eventResize={handleCalEventResize}
                  select={handleCalDateSelect}
                  eventClick={handleCalEventClick}
                  datesSet={handleCalDatesSet}
                  height="auto"
                  eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
                  slotLabelFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
                />
              </div>
              <AnimatePresence>
                {calModalOpen && calModalInitial && (
                  <ClientEventModal
                    mode={calModalMode}
                    initial={calModalInitial}
                    users={calUsers}
                    onSave={handleCalSave}
                    onDelete={calModalMode === 'edit' ? handleCalDelete : undefined}
                    onClose={() => { setCalModalOpen(false); setCalEditingEvent(null) }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ─── Metrics Tab ─── */}
          {activeTab === 'metrics' && (
            <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-5">
              {!metrics ? (
                <div className="glass-card p-12 flex flex-col items-center text-center">
                  <BarChart2 size={40} className="text-ink-500 mb-3 opacity-30" />
                  <p className="text-ink-300 mb-1">Sin métricas disponibles aún</p>
                  <p className="text-ink-500 text-sm">El equipo de TheBrandingStudio configurará las integraciones contigo.</p>
                </div>
              ) : (
                <>
                  {/* Plataformas conectadas */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'linkedin', label: 'LinkedIn',  color: '#0077B5', icon: <Linkedin size={12} /> },
                      { key: 'meta',     label: 'Meta',      color: '#1877F2', icon: <span className="text-[10px] font-black">f</span> },
                      { key: 'tiktok',   label: 'TikTok',    color: '#69C9D0', icon: <Play size={10} fill="currentColor" /> },
                      { key: 'ga4',      label: 'Analytics', color: '#E37400', icon: <Globe size={11} /> },
                    ].map(p => {
                      const connected = metrics.connections?.[p.key]?.connected
                      const hasData = !!metrics.platforms?.[p.key]
                      if (!connected && !hasData) return null
                      return (
                        <div key={p.key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
                          style={{ borderColor: p.color + '40', color: p.color, background: p.color + '10' }}>
                          {p.icon} {p.label}
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        </div>
                      )
                    })}
                  </div>

                  {/* LinkedIn */}
                  {li && (
                    <div className="glass-card p-5 space-y-4">
                      <h4 className="font-semibold text-white flex items-center gap-2">
                        <Linkedin size={15} className="text-blue-400" /> LinkedIn
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Seguidores', value: formatShort(li.summary.followers), color: '#0077B5', sub: `+${li.summary.follower_growth_pct}%` },
                          { label: 'Impresiones (30d)', value: formatShort(li.summary.total_impressions), color: '#DC143C', sub: 'últimos 30 días' },
                          { label: 'Vistas de página', value: formatShort(li.summary.total_page_views), color: '#7C3AED', sub: 'últimos 30 días' },
                          { label: 'Engagement', value: `${li.summary.avg_engagement_rate}%`, color: '#F59E0B', sub: 'promedio mensual' },
                        ].map(s => (
                          <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                            <p className="text-xs text-ink-500">{s.sub}</p>
                          </div>
                        ))}
                      </div>
                      {followersChart.length > 0 && (
                        <div>
                          <p className="text-xs text-ink-400 mb-3 flex items-center gap-1.5"><Users size={11} /> Crecimiento de seguidores</p>
                          <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={followersChart}>
                              <defs>
                                <linearGradient id="gradLI2" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0077B5" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#0077B5" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={s => { const d = new Date(s); return `${d.getDate()}/${d.getMonth()+1}` }} interval={2} />
                              <YAxis tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} width={38} tickFormatter={formatShort} />
                              <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#aaa', fontSize: 10 }} itemStyle={{ color: '#fff', fontSize: 11 }} />
                              <Area type="monotone" dataKey="value" stroke="#0077B5" fill="url(#gradLI2)" strokeWidth={2} dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meta */}
                  {meta && (
                    <div className="glass-card p-5 space-y-4">
                      <h4 className="font-semibold text-white flex items-center gap-2">
                        <span className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-black">f</span> Meta (Facebook + Instagram)
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Seguidores Facebook', value: formatShort(meta.summary.fb_followers), color: '#1877F2', sub: 'Total' },
                          { label: 'Seguidores Instagram', value: formatShort(meta.summary.ig_followers), color: '#E1306C', sub: `+${meta.summary.ig_growth_pct}%` },
                          { label: `Alcance (30d)`, value: formatShort(meta.summary.total_reach), color: '#7C3AED', sub: 'últimos 30 días' },
                          { label: 'Engagement Rate', value: `${meta.summary.avg_engagement_rate}%`, color: '#F59E0B', sub: 'promedio' },
                        ].map(s => (
                          <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                            <p className="text-xs text-ink-500">{s.sub}</p>
                          </div>
                        ))}
                      </div>
                      {igFollowersChart.length > 0 && (
                        <div>
                          <p className="text-xs text-ink-400 mb-3 flex items-center gap-1.5"><Users size={11} /> Seguidores Instagram</p>
                          <ResponsiveContainer width="100%" height={150}>
                            <AreaChart data={igFollowersChart}>
                              <defs>
                                <linearGradient id="gradIG2" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#E1306C" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#E1306C" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={s => { const d = new Date(s); return `${d.getDate()}/${d.getMonth()+1}` }} interval={2} />
                              <YAxis tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} width={38} tickFormatter={formatShort} />
                              <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#aaa', fontSize: 10 }} itemStyle={{ color: '#fff', fontSize: 11 }} />
                              <Area type="monotone" dataKey="value" stroke="#E1306C" fill="url(#gradIG2)" strokeWidth={2} dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TikTok */}
                  {tiktok && (
                    <div className="glass-card p-5">
                      <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                        <Play size={13} className="text-[#69C9D0]" fill="currentColor" /> TikTok Business
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Seguidores', value: formatShort(tiktok.summary.followers), color: '#69C9D0' },
                          { label: 'Reproducciones', value: formatShort(tiktok.summary.video_views), color: '#EE1D52' },
                          { label: 'Likes', value: formatShort(tiktok.summary.likes), color: '#F59E0B' },
                          { label: 'Comentarios', value: formatShort(tiktok.summary.comments), color: '#7C3AED' },
                        ].map(s => (
                          <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GA4 */}
                  {ga4 && (
                    <div className="glass-card p-5">
                      <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                        <Globe size={14} className="text-[#E37400]" /> Google Analytics (Tráfico Web)
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Sesiones', value: formatShort(ga4.summary.total_sessions), color: '#E37400' },
                          { label: 'Usuarios activos', value: formatShort(ga4.summary.total_users), color: '#7C3AED' },
                          { label: 'Vistas de página', value: formatShort(ga4.summary.total_page_views), color: '#DC143C' },
                          { label: 'Nuevos usuarios', value: formatShort(ga4.summary.new_users), color: '#34D399' },
                        ].map(s => (
                          <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
