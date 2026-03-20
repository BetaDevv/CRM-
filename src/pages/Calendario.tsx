import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import esLocale from '@fullcalendar/core/locales/es'
import type { EventInput, DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import type { DatesSetArg } from '@fullcalendar/core'
import {
  Calendar as CalendarIcon, X, Plus, Trash2, Users, Link2,
  RefreshCw, Loader2, Check, ExternalLink,
} from 'lucide-react'
import {
  getCalendarEvents, createCalendarEvent, updateCalendarEvent,
  deleteCalendarEvent, getCalendarUsers, getGoogleCalendarStatus,
  connectGoogleCalendar, disconnectGoogleCalendar, syncGoogleCalendar,
  getTodos, getMilestones,
  type CalendarEvent, type CalendarUser, type Milestone,
} from '../lib/api'
import type { TodoItem } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { useStore } from '../store/useStore'

/* ─── Color Presets ─── */
const COLOR_PRESETS = [
  '#DC143C', '#3B82F6', '#10B981', '#8B5CF6',
  '#F59E0B', '#EC4899', '#14B8A6', '#F97316',
]

/* ─── Helper: hex to rgba for Apple Calendar-style transparency ─── */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* ─── Helper: convert API event to FullCalendar event ─── */
function toFCEvent(event: CalendarEvent): EventInput {
  const color = event.color || '#DC143C'
  return {
    id: event.id,
    title: event.title,
    start: event.startTime,
    end: event.endTime,
    allDay: event.allDay,
    backgroundColor: hexToRgba(color, 0.15),
    borderColor: 'transparent',
    textColor: color,
    extendedProps: {
      description: event.description,
      creatorId: event.creatorId,
      clientId: event.clientId,
      todoId: event.todoId,
      milestoneId: event.milestoneId,
      isShared: event.isShared,
      participants: event.participants,
      googleEventId: event.googleEventId,
      solidColor: color,
    },
  }
}

/* ─── Helper: format datetime-local value ─── */
function toDatetimeLocal(isoStr: string): string {
  const d = new Date(isoStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toISOFromLocal(localStr: string): string {
  return new Date(localStr).toISOString()
}

/* ─── Event Modal ─── */
const MILESTONE_CATEGORY_COLORS: Record<string, string> = {
  strategy: '#3B82F6',
  design: '#EC4899',
  content: '#10B981',
  ads: '#F59E0B',
  analytics: '#8B5CF6',
}

function EventModal({
  mode,
  initial,
  users,
  todos,
  milestones,
  onSave,
  onDelete,
  onClose,
}: {
  mode: 'create' | 'edit'
  initial: {
    id?: string
    title: string
    description: string
    startTime: string
    endTime: string
    allDay: boolean
    color: string
    participantIds: string[]
    clientId: string
    todoId: string
    milestoneId: string
    isShared: boolean
  }
  users: CalendarUser[]
  todos: TodoItem[]
  milestones: Milestone[]
  clients: { id: string; company: string }[]
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
  const [clientId, setClientId] = useState(initial.clientId)
  const [todoId, setTodoId] = useState(initial.todoId)
  const [milestoneId, setMilestoneId] = useState(initial.milestoneId)

  // Filter milestones by selected client
  const filteredMilestones = clientId ? milestones.filter(m => {
    // milestones have clientName from the API, but we need to match by client id
    // The milestone's plan belongs to a client — we match via the client dropdown
    const client = clients.find(c => c.id === clientId)
    return client && m.clientName === client.company
  }) : []
  const [isShared, setIsShared] = useState(initial.isShared)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)

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
        clientId: clientId || null,
        todoId: todoId || null,
        milestoneId: milestoneId || null,
        isShared: isShared || participantIds.length > 0,
      })
      onClose()
    } catch {
      // error handled silently
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch {
      // error handled silently
    } finally {
      setDeleting(false)
    }
  }

  const toggleParticipant = (userId: string) => {
    setParticipantIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 pb-3 border-b border-white/5 bg-[#111] backdrop-blur-xl">
          <h3 className="text-lg font-bold text-white">
            {mode === 'create' ? 'Nuevo Evento' : 'Editar Evento'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-ink-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-ink-300">Titulo</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nombre del evento..."
              className="input-dark"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-ink-300">Descripcion</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalles del evento..."
              rows={3}
              className="input-dark resize-none"
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAllDay(!allDay)}
              className={`relative w-10 h-5 rounded-full transition-colors ${allDay ? 'bg-crimson-600' : 'bg-ink-600'}`}
            >
              <motion.div
                animate={{ x: allDay ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full"
              />
            </button>
            <span className="text-sm font-medium text-ink-200">Todo el dia</span>
          </div>

          {/* Date/Time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-ink-300">Inicio</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? startTime.split('T')[0] : startTime}
                onChange={e => setStartTime(allDay ? e.target.value + 'T00:00' : e.target.value)}
                className="input-dark text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-ink-300">Fin</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? endTime.split('T')[0] : endTime}
                onChange={e => setEndTime(allDay ? e.target.value + 'T23:59' : e.target.value)}
                className="input-dark text-sm"
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-medium mb-2 text-ink-300">Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px #111, 0 0 0 4px ${c}` : 'none' }}
                >
                  {color === c && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div>
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className="flex items-center gap-2 text-sm font-medium text-ink-200 transition-colors hover:text-crimson-400"
            >
              <Users size={14} />
              Participantes {participantIds.length > 0 && `(${participantIds.length})`}
            </button>
            <AnimatePresence>
              {showParticipants && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                    {users.map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${participantIds.includes(u.id) ? 'bg-crimson-600 border-crimson-600' : 'border-ink-500'}`}>
                          {participantIds.includes(u.id) && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-white">{u.name}</p>
                          <p className="text-xs truncate text-ink-400">{u.email}</p>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: u.role === 'admin' ? 'rgba(220,20,60,0.15)' : 'rgba(59,130,246,0.15)', color: u.role === 'admin' ? '#DC143C' : '#3B82F6' }}>
                          {u.role}
                        </span>
                        <input type="checkbox" className="sr-only" checked={participantIds.includes(u.id)} onChange={() => toggleParticipant(u.id)} />
                      </label>
                    ))}
                    {users.length === 0 && (
                      <p className="text-xs py-2 text-center text-ink-400">No hay usuarios disponibles</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Link to Client */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-ink-300">
              <Link2 size={12} className="inline mr-1" />Cliente
            </label>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setMilestoneId('') }}
              className="input-dark text-sm"
            >
              <option value="">Sin cliente</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          </div>

          {/* Link to Todo */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-ink-300">
              <Link2 size={12} className="inline mr-1" />Vincular a tarea
            </label>
            <select value={todoId} onChange={e => setTodoId(e.target.value)} className="input-dark text-sm">
              <option value="">Sin tarea vinculada</option>
              {todos.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* Link to Milestone — only shown when client is selected */}
          {clientId && (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-ink-300">
                <Link2 size={12} className="inline mr-1" />Vincular a hito del plan
              </label>
              {filteredMilestones.length > 0 ? (
                <>
                  <select value={milestoneId} onChange={e => setMilestoneId(e.target.value)} className="input-dark text-sm">
                    <option value="">Sin hito vinculado</option>
                    {filteredMilestones.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title} — {m.category} {m.completed ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                  {milestoneId && (() => {
                    const m = filteredMilestones.find(ms => ms.id === milestoneId)
                    if (!m) return null
                    const catColor = MILESTONE_CATEGORY_COLORS[m.category] || '#6B7280'
                    return (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: hexToRgba(catColor, 0.1), borderLeft: `3px solid ${catColor}` }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: catColor }}>{m.title}</p>
                          <p className="text-xs truncate text-ink-400">{m.planTitle} · {m.category}</p>
                        </div>
                        {m.date && <span className="text-xs flex-shrink-0 text-ink-400">{m.date}</span>}
                        {m.completed && <Check size={12} style={{ color: catColor }} />}
                      </div>
                    )
                  })()}
                </>
              ) : (
                <p className="text-xs py-2 text-ink-400">Este cliente no tiene hitos en su plan de marketing</p>
              )}
            </div>
          )}

          {/* Shared Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsShared(!isShared)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isShared || participantIds.length > 0 ? 'bg-crimson-600' : 'bg-ink-600'}`}
            >
              <motion.div
                animate={{ x: (isShared || participantIds.length > 0) ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full"
              />
            </button>
            <span className="text-sm font-medium text-ink-200">Evento compartido</span>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex items-center gap-3 p-5 pt-3 border-t border-white/5 bg-[#111]">
          {mode === 'edit' && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Eliminar
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

/* ─── Main Calendar Component ─── */
export default function Calendario() {
  const { user } = useAuthStore()
  const { clients } = useStore()
  const calendarRef = useRef<FullCalendar>(null)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [users, setUsers] = useState<CalendarUser[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [milestonesList, setMilestonesList] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // Google Calendar
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email?: string }>({ connected: false })

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [modalInitial, setModalInitial] = useState<any>(null)

  // Double-click detection
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastClickIdRef = useRef<string | null>(null)

  // Ref to always have latest events for click handler
  const eventsRef = useRef<CalendarEvent[]>([])
  eventsRef.current = events

  // Current date range for fetching
  const dateRangeRef = useRef<{ start: string; end: string } | null>(null)

  // Fetch events
  const fetchEvents = useCallback(async (start?: string, end?: string) => {
    const s = start || dateRangeRef.current?.start
    const e = end || dateRangeRef.current?.end
    if (!s || !e) return
    try {
      const data = await getCalendarEvents(s, e)
      setEvents(data)
    } catch {
      // silently fail
    }
  }, [])

  // Initial data load
  useEffect(() => {
    Promise.all([
      getCalendarUsers().catch(() => []),
      getTodos().catch(() => []),
      getMilestones().catch(() => []),
      getGoogleCalendarStatus().catch(() => ({ connected: false })),
    ]).then(([usersData, todosData, milestonesData, gStatus]) => {
      setUsers(usersData)
      setTodos(todosData)
      setMilestonesList(milestonesData)
      setGoogleStatus(gStatus)
    }).finally(() => setLoading(false))

    // Check for Google OAuth redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'connected') {
      getGoogleCalendarStatus().then(setGoogleStatus).catch(() => {})
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // FullCalendar events array
  const fcEvents: EventInput[] = events.map(toFCEvent)

  /* ─── Handlers ─── */

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    const start = info.startStr
    const end = info.endStr
    dateRangeRef.current = { start, end }
    fetchEvents(start, end)
  }, [fetchEvents])

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    const start = info.startStr
    const end = info.endStr
    const allDay = info.allDay

    setEditingEvent(null)
    setModalMode('create')
    setModalInitial({
      title: '',
      description: '',
      startTime: allDay ? start + 'T09:00' : toDatetimeLocal(start),
      endTime: allDay ? start + 'T10:00' : toDatetimeLocal(end),
      allDay,
      color: '#DC143C',
      participantIds: [],
      clientId: '',
      todoId: '',
      milestoneId: '',
      isShared: false,
    })
    setModalOpen(true)

    // Unselect
    const calApi = calendarRef.current?.getApi()
    calApi?.unselect()
  }, [])

  const openEventModal = useCallback((eventId: string) => {
    const ev = eventsRef.current.find(e => e.id === eventId)
    if (!ev) return

    setEditingEvent(ev)
    setModalMode('edit')
    setModalInitial({
      id: ev.id,
      title: ev.title,
      description: ev.description || '',
      startTime: toDatetimeLocal(ev.startTime),
      endTime: toDatetimeLocal(ev.endTime),
      allDay: ev.allDay,
      color: ev.color || '#DC143C',
      participantIds: ev.participants.map(p => p.id),
      clientId: ev.clientId || '',
      todoId: ev.todoId || '',
      milestoneId: ev.milestoneId || '',
      isShared: ev.isShared,
    })
    setModalOpen(true)
  }, [])

  const handleEventClick = useCallback((info: EventClickArg) => {
    openEventModal(info.event.id)
  }, [openEventModal])

  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const { event } = info
    try {
      await updateCalendarEvent(event.id, {
        startTime: event.start?.toISOString(),
        endTime: (event.end || event.start)?.toISOString(),
        allDay: event.allDay,
      })
      fetchEvents()
    } catch {
      info.revert()
    }
  }, [fetchEvents])

  const handleEventResize = useCallback(async (info: EventResizeDoneArg) => {
    const { event } = info
    try {
      await updateCalendarEvent(event.id, {
        startTime: event.start?.toISOString(),
        endTime: (event.end || event.start)?.toISOString(),
      })
      fetchEvents()
    } catch {
      info.revert()
    }
  }, [fetchEvents])

  const handleSaveEvent = useCallback(async (data: any) => {
    if (modalMode === 'create') {
      await createCalendarEvent(data)
    } else if (editingEvent) {
      await updateCalendarEvent(editingEvent.id, data)
      // Handle participants change
      if (data.participantIds) {
        const currentIds = editingEvent.participants.map(p => p.id)
        const newIds = data.participantIds as string[]
        const toAdd = newIds.filter(id => !currentIds.includes(id))
        const toRemove = currentIds.filter(id => !newIds.includes(id))
        if (toAdd.length > 0) {
          const { addEventParticipants } = await import('../lib/api')
          await addEventParticipants(editingEvent.id, toAdd)
        }
        for (const uid of toRemove) {
          const { removeEventParticipant } = await import('../lib/api')
          await removeEventParticipant(editingEvent.id, uid)
        }
      }
    }
    fetchEvents()
  }, [modalMode, editingEvent, fetchEvents])

  const handleDeleteEvent = useCallback(async () => {
    if (!editingEvent) return
    await deleteCalendarEvent(editingEvent.id)
    fetchEvents()
  }, [editingEvent, fetchEvents])

  const handleConnectGoogle = async () => {
    try {
      const url = await connectGoogleCalendar()
      window.open(url, '_blank')
    } catch {
      // silently fail
    }
  }

  const handleDisconnectGoogle = async () => {
    try {
      await disconnectGoogleCalendar()
      setGoogleStatus({ connected: false })
    } catch {
      // silently fail
    }
  }

  const handleSyncGoogle = async () => {
    setSyncing(true)
    try {
      await syncGoogleCalendar()
      fetchEvents()
    } catch {
      // silently fail
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-crimson-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 space-y-5 h-full flex flex-col"
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-crimson-700/20">
            <CalendarIcon size={22} className="text-crimson-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Mi Calendario
            </h1>
            <p className="text-sm mt-0.5 text-ink-400">
              Eventos, reuniones y deadlines
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* New Event button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              const now = new Date()
              const end = new Date(now.getTime() + 60 * 60 * 1000)
              setEditingEvent(null)
              setModalMode('create')
              setModalInitial({
                title: '',
                description: '',
                startTime: toDatetimeLocal(now.toISOString()),
                endTime: toDatetimeLocal(end.toISOString()),
                allDay: false,
                color: '#DC143C',
                participantIds: [],
                todoId: '',
                milestoneId: '',
                isShared: false,
              })
              setModalOpen(true)
            }}
            className="btn-primary text-sm"
          >
            <Plus size={16} /> Nuevo evento
          </motion.button>

          {/* Google Calendar */}
          {!googleStatus.connected ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleConnectGoogle}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 hover:bg-white/5 transition-all text-ink-200"
            >
              <ExternalLink size={14} /> Conectar Google Calendar
            </motion.button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                {googleStatus.email || 'Google conectado'}
              </span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSyncGoogle}
                disabled={syncing}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 text-ink-300"
                title="Sincronizar"
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              </motion.button>
              <button
                onClick={handleDisconnectGoogle}
                className="text-xs text-ink-400 hover:text-red-400 transition-colors underline"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── FullCalendar ─── */}
      <div className="glass-card flex-1 p-4 rounded-2xl overflow-hidden fc-dark-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          locale={esLocale}
          firstDay={1}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:15:00"
          snapDuration="00:15:00"
          editable={true}
          droppable={true}
          eventResizableFromStart={true}
          selectable={true}
          selectMirror={true}
          unselectAuto={true}
          selectOverlap={true}
          dayMaxEvents={true}
          nowIndicator={true}
          events={fcEvents}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDidMount={(info) => {
            info.el.style.cursor = 'pointer'
            info.el.addEventListener('dblclick', (e) => {
              e.preventDefault()
              e.stopPropagation()
              openEventModal(info.event.id)
            })
          }}
          datesSet={handleDatesSet}
          height="auto"
          stickyHeaderDates={true}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
        />
      </div>

      {/* ─── Event Modal ─── */}
      <AnimatePresence>
        {modalOpen && modalInitial && (
          <EventModal
            mode={modalMode}
            initial={modalInitial}
            users={users}
            todos={todos}
            milestones={milestonesList}
            clients={clients.map(c => ({ id: c.id, company: c.company }))}
            onSave={handleSaveEvent}
            onDelete={modalMode === 'edit' ? handleDeleteEvent : undefined}
            onClose={() => { setModalOpen(false); setEditingEvent(null) }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
