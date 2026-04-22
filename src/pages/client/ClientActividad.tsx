import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Check, Loader2, X, Plus, MessageSquare, Users, User, CheckSquare, Flag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import T from '../../components/TranslatedText'
import CreatorBadge from '../../components/CreatorBadge'
import { getCalendarEvents, addClientNoteToEvent, getGoogleCalendarStatus, connectGoogleCalendar, disconnectGoogleCalendar, getMicrosoftCalendarStatus, connectMicrosoftCalendar, disconnectMicrosoftCalendar, type CalendarEvent } from '../../lib/api'
import { formatDate, categoryColors, getLocale } from '../../lib/utils'

export default function ClientActividad() {
  const { t } = useTranslation(['client', 'common'])
  const [clientEvents, setClientEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [noteEvent, setNoteEvent] = useState<CalendarEvent | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [microsoftConnected, setMicrosoftConnected] = useState(false)
  const [microsoftLoading, setMicrosoftLoading] = useState(false)

  useEffect(() => {
    // Fetch client events (full year range)
    getCalendarEvents(
      new Date(new Date().getFullYear(), 0, 1).toISOString(),
      new Date(new Date().getFullYear(), 11, 31).toISOString()
    ).then(events => {
      setClientEvents(events.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()))
    }).catch(() => {}).finally(() => setLoading(false))

    // Check Google Calendar status
    getGoogleCalendarStatus().then(s => setGoogleConnected(s.connected)).catch(() => {})

    // Check Microsoft Calendar status
    getMicrosoftCalendarStatus().then(s => setMicrosoftConnected(s.connected)).catch(() => {})
  }, [])

  const openNoteEditor = (event: CalendarEvent) => {
    setNoteEvent(event)
    setNoteText(event.clientNote || '')
  }

  const handleSaveNote = async () => {
    if (!noteEvent) return
    setNoteSaving(true)
    try {
      const updated = await addClientNoteToEvent(noteEvent.id, noteText)
      setClientEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
    } catch (err) {
      console.error('Error saving note:', err)
    } finally {
      setNoteSaving(false)
      setNoteEvent(null)
      setNoteText('')
    }
  }

  const handleGoogleConnect = async () => {
    setGoogleLoading(true)
    try {
      if (googleConnected) {
        await disconnectGoogleCalendar()
        setGoogleConnected(false)
      } else {
        const url = await connectGoogleCalendar()
        window.location.href = url
      }
    } catch {} finally { setGoogleLoading(false) }
  }

  const handleMicrosoftConnect = async () => {
    setMicrosoftLoading(true)
    try {
      if (microsoftConnected) {
        await disconnectMicrosoftCalendar()
        setMicrosoftConnected(false)
      } else {
        const url = await connectMicrosoftCalendar()
        window.location.href = url
      }
    } catch {} finally { setMicrosoftLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Google Calendar connect */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-white text-sm">{t('client:activity.syncGoogle')}</h4>
          <p className="text-xs text-ink-400 mt-0.5">
            {googleConnected ? t('client:activity.calendarConnected') : t('client:activity.calendarDisconnected')}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={handleGoogleConnect}
          disabled={googleLoading}
          className={`flex items-center gap-1.5 text-xs py-2 px-3 rounded-xl font-medium transition-all ${
            googleConnected
              ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
              : 'btn-primary'
          }`}
        >
          {googleLoading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
          {googleConnected ? t('client:activity.disconnect') : t('client:activity.connectGoogle')}
        </motion.button>
      </div>

      {/* Microsoft Calendar connect */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-white text-sm">{t('client:activity.syncMicrosoft')}</h4>
          <p className="text-xs text-ink-400 mt-0.5">
            {microsoftConnected ? t('client:activity.microsoftConnected') : t('client:activity.microsoftDisconnected')}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={handleMicrosoftConnect}
          disabled={microsoftLoading}
          className={`flex items-center gap-1.5 text-xs py-2 px-3 rounded-xl font-medium transition-all ${
            microsoftConnected
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
              : 'btn-primary'
          }`}
        >
          {microsoftLoading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
          {microsoftConnected ? t('client:activity.disconnect') : t('client:activity.connectMicrosoft')}
        </motion.button>
      </div>

      {/* Activity timeline */}
      <div className="glass-card p-6">
        <h4 className="font-semibold text-white flex items-center gap-2 mb-6">
          <Calendar size={16} style={{ color: 'var(--accent-light)' }} /> {t('client:activity.activityLog')}
        </h4>

        {clientEvents.length > 0 ? (
          <div className="space-y-0">
            {clientEvents.map((event, i) => {
              const startDate = new Date(event.startTime)
              const endDate = new Date(event.endTime)
              const dateStr = startDate.toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
              const timeStr = startDate.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) + ' - ' + endDate.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
              const isLast = i === clientEvents.length - 1
              const isPast = startDate < new Date()

              return (
                <div key={event.id} className="flex gap-4 group">
                  {/* Timeline dot and line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 transition-all ${isPast ? 'opacity-50' : 'ring-4'}`}
                      style={{ backgroundColor: event.color || 'var(--accent-hex)' }}
                    />
                    {!isLast && <div className="w-0.5 flex-1 mt-1 bg-white/5" />}
                  </div>

                  {/* Event card */}
                  <div className={`pb-5 flex-1 ${isLast ? 'pb-0' : ''}`}>
                    <div
                      onClick={() => setSelectedEvent(event)}
                      className={`glass-card p-4 cursor-pointer hover:border-ink-600 transition-all border border-white/5 ${isPast ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h5 className="font-semibold text-white text-sm"><T text={event.title} /></h5>
                        <span className="text-xs text-ink-400 flex-shrink-0 flex items-center gap-1">
                          <Calendar size={11} />
                          {dateStr}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <p className="text-xs text-ink-400">{timeStr}</p>
                        {event.createdByName && (
                          <CreatorBadge name={event.createdByName} avatar={event.createdByAvatar} size="sm" variant="compact" className="ml-auto" />
                        )}
                      </div>

                      {event.description && (
                        <p className="text-xs text-ink-300 mb-2 leading-relaxed"><T text={event.description} translatable /></p>
                      )}

                      {/* Participants */}
                      {event.participants.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Users size={11} className="text-ink-500" />
                          <span className="text-xs text-ink-400">
                            <T text={event.participants.map(p => p.name).join(', ')} />
                          </span>
                        </div>
                      )}

                      {/* Milestone badge if linked */}
                      {event.milestone && (
                        <div
                          className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{
                            backgroundColor: (categoryColors[event.milestone.category] || 'var(--accent-hex)') + '15',
                            borderLeft: '3px solid ' + (categoryColors[event.milestone.category] || 'var(--accent-hex)'),
                          }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[event.milestone.category] || 'var(--accent-hex)' }} />
                          <span className="text-xs font-medium" style={{ color: categoryColors[event.milestone.category] || 'var(--accent-hex)' }}>
                            <T text={event.milestone.title} />
                          </span>
                          {event.milestone.date && (
                            <span className="text-xs text-ink-400 ml-auto">{formatDate(event.milestone.date)}</span>
                          )}
                        </div>
                      )}

                      {/* Client note section */}
                      <div className="mt-3 pt-3 border-t border-white/5">
                        {event.clientNote ? (
                          <div className="flex items-start gap-2">
                            <MessageSquare size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-light)' }} />
                            <div className="flex-1">
                              <p className="text-xs text-ink-200"><T text={event.clientNote} translatable /></p>
                              <button onClick={(e) => { e.stopPropagation(); openNoteEditor(event) }} className="text-xs mt-1 hover:underline" style={{ color: 'var(--accent-light)' }}>{t('client:activity.editNote')}</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); openNoteEditor(event) }} className="text-xs text-ink-400 transition-colors flex items-center gap-1 hover:text-[var(--accent-light)]">
                            <Plus size={12} /> {t('client:activity.addNote')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-ink-500">
            <Calendar size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{t('client:activity.noEvents')}</p>
          </div>
        )}
      </div>

      {/* Event detail modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={() => setSelectedEvent(null)}
          >
            <motion.div
              className="bg-ink-900 border border-ink-700 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto thin-scrollbar"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onMouseDown={e => e.stopPropagation()}
            >
              {/* Color bar at top */}
              <div className="h-1 rounded-full mb-4" style={{ backgroundColor: selectedEvent.color || '#3B82F6' }} />

              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-2"><T text={selectedEvent.title} /></h3>

              {/* Creator */}
              {selectedEvent.createdByName && (
                <div className="flex items-center gap-2 mb-3 text-xs text-ink-400">
                  <span>{t('common:common.createdBy')}:</span>
                  <CreatorBadge name={selectedEvent.createdByName} avatar={selectedEvent.createdByAvatar} size="md" variant="full" />
                </div>
              )}

              {/* Date/Time */}
              <div className="flex items-center gap-2 text-ink-400 text-sm mb-3">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(selectedEvent.startTime).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {' '}
                  {new Date(selectedEvent.startTime).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}
                  {' - '}
                  {new Date(selectedEvent.endTime).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Description if exists */}
              {selectedEvent.description && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-ink-300 mb-1">{t('client:activity.description')}</h4>
                  <p className="text-ink-400 text-sm"><T text={selectedEvent.description} translatable /></p>
                </div>
              )}

              {/* Participants */}
              {selectedEvent.participants?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-ink-300 mb-2">{t('client:activity.participants')}</h4>
                  <div className="space-y-1">
                    {selectedEvent.participants.map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-sm text-ink-400">
                        <User className="w-3 h-3" />
                        <span><T text={p.name} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked todo info if exists */}
              {selectedEvent.todoId && (
                <div className="mb-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-400 text-sm">
                    <CheckSquare className="w-4 h-4" />
                    <span>{t('client:activity.linkedToTask')}</span>
                  </div>
                </div>
              )}

              {/* Milestone if linked */}
              {selectedEvent.milestone && (
                <div className="mb-4 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-400 text-sm">
                    <Flag className="w-4 h-4" />
                    <span><T text={selectedEvent.milestone.title} /></span>
                  </div>
                </div>
              )}

              {/* Client note */}
              {selectedEvent.clientNote && (
                <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'rgb(var(--accent) / 0.1)', border: '1px solid rgb(var(--accent) / 0.2)' }}>
                  <div className="flex items-center gap-2 text-sm mb-1" style={{ color: 'var(--accent-light)' }}>
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-medium">{t('client:activity.yourNote')}</span>
                  </div>
                  <p className="text-ink-300 text-sm"><T text={selectedEvent.clientNote} translatable /></p>
                </div>
              )}

              {/* Close button */}
              <button
                onClick={() => setSelectedEvent(null)}
                className="mt-4 w-full py-2 bg-ink-700 text-ink-300 rounded-xl hover:bg-ink-600 transition-colors"
              >
                {t('common:common.close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note editor modal */}
      <AnimatePresence>
        {noteEvent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={() => setNoteEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onMouseDown={e => e.stopPropagation()}
              className="glass-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{t('client:activity.noteForEvent')}</h3>
                <button onClick={() => setNoteEvent(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-ink-400"><X size={18} /></button>
              </div>
              <p className="text-sm text-ink-300 mb-3"><T text={noteEvent.title} /></p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={t('client:activity.notePlaceholder')}
                rows={4}
                className="input-dark resize-none w-full text-sm mb-4"
                autoFocus
              />
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setNoteEvent(null)} className="btn-ghost text-sm">{t('common:common.cancel')}</button>
                <button onClick={handleSaveNote} disabled={noteSaving} className="btn-primary text-sm disabled:opacity-50">
                  {noteSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {t('client:activity.saveNote')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
