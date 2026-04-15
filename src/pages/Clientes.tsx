import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Mail, Phone, DollarSign, Calendar, Briefcase, ExternalLink,
  CheckCircle, Pencil, Trash2, Loader2, Plus, Upload,
  Clock, MessageSquare, Send, FileText, UserPlus, Bell, AlertTriangle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, formatDate, localToday } from '../lib/utils'
import {
  api,
  getClientNotes, addClientNote, deleteClientNote,
  getClientActivity,
} from '../lib/api'
import type { Client } from '../types'
import type { ClientNote, ActivityLog } from '../lib/api'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store/useStore'
import T from '../components/TranslatedText'

const clientColors = ['#DC143C', '#7C3AED', '#F59E0B', '#34D399', '#60A5FA', '#F97316', '#EC4899']

// ─── Avatar helper ─────────────────────────────────────────────────────────────
function ClientAvatar({
  client, size = 'md', className = '',
}: { client: Client; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const [imgError, setImgError] = useState(false)
  const initials = client.company.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const sizeClasses = { sm: 'w-9 h-9 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-xl' }

  if (client.avatar_url && !imgError) {
    return (
      <img
        src={client.avatar_url}
        alt={client.company}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} rounded-2xl object-cover flex-shrink-0 ${className}`}
        style={{ border: `1px solid ${client.color}40` }}
      />
    )
  }
  return (
    <div
      className={`${sizeClasses[size]} rounded-2xl flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ background: client.color + '25', border: `1px solid ${client.color}40` }}
    >
      {initials}
    </div>
  )
}

// ─── Client Card ───────────────────────────────────────────────────────────────
function ClientCard({
  client, onSelect, onEdit, onDelete,
}: { client: Client; onSelect: (c: Client) => void; onEdit: (c: Client) => void; onDelete: (c: Client) => void }) {
  const { t } = useTranslation(['admin', 'common'])
  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      className="glass-card p-5 cursor-pointer border border-transparent hover:border-white/10 transition-all duration-300 group relative"
      onClick={() => onSelect(client)}
    >
      {/* Action buttons on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={e => { e.stopPropagation(); onEdit(client) }}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
          style={{ color: 'rgb(var(--ink-300))' }}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(client) }}
          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all text-ink-400 hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-start gap-4 mb-4">
        <ClientAvatar client={client} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold truncate" style={{ color: 'rgb(var(--ink-100))' }}><T text={client.company} /></h3>
          <p className="text-sm truncate" style={{ color: 'rgb(var(--ink-300))' }}><T text={client.contact} /></p>
        </div>
        <span className={`badge flex-shrink-0 ${client.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-ink-600 text-ink-300'}`}>
          {client.status === 'active' ? t('admin:clients.status.active') : t('admin:clients.status.paused')}
        </span>
      </div>

      {client.description && (
        <p className="text-xs mb-4 line-clamp-2" style={{ color: 'rgb(var(--ink-300))' }}><T text={client.description} translatable /></p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--ink-300))' }}>
          <Mail size={12} style={{ color: 'rgb(var(--ink-400))' }} />
          <span className="truncate">{client.email}</span>
        </div>
        {client.phone && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--ink-300))' }}>
            <Phone size={12} style={{ color: 'rgb(var(--ink-400))' }} />
            <span>{client.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--ink-300))' }}>
          <Calendar size={12} style={{ color: 'rgb(var(--ink-400))' }} />
          <span>{t('admin:clients.since', { date: formatDate(client.startDate || client.start_date || '') })}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {client.services.map(s => (
          <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgb(var(--ink-700) / 0.6)', color: 'rgb(var(--ink-200))' }}><T text={s} /></span>
        ))}
      </div>

      <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgb(var(--ink-600) / 0.4)' }}>
        <div>
          <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>{t('admin:clients.monthlyRetention')}</p>
          <p className="font-bold" style={{ color: 'rgb(var(--ink-100))' }}>{formatCurrency(client.monthlyFee || client.monthly_fee || 0, client.currency || 'USD')}</p>
        </div>
        <div className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
          style={{ background: client.color + '20', color: client.color }}>
          <ExternalLink size={11} /> {t('admin:clients.viewMore')}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Client Form Modal ─────────────────────────────────────────────────────────
interface ClientFormData {
  company: string; contact: string; email: string; phone: string;
  industry: string; monthly_fee: string; currency: string; services: string;
  description: string; color: string; status: string; start_date: string;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'COP', 'MXN', 'ARS', 'BRL', 'CLP'] as const

function ClientModal({
  initial, onClose, onSaved,
}: {
  initial?: Client | null
  onClose: () => void
  onSaved: (c: Client) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const fileRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial?.avatar_url || null)
  const [form, setForm] = useState<ClientFormData>({
    company:     initial?.company     || '',
    contact:     initial?.contact     || '',
    email:       initial?.email       || '',
    phone:       initial?.phone       || '',
    industry:    initial?.industry    || '',
    monthly_fee: String(initial?.monthlyFee || initial?.monthly_fee || ''),
    currency:    initial?.currency || 'USD',
    services:    (initial?.services || []).join(', '),
    description: initial?.description || '',
    color:       initial?.color       || '#DC143C',
    status:      initial?.status      || 'active',
    start_date:  initial?.startDate || initial?.start_date || localToday(),
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.company || !form.email) return
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      const payload = {
        ...form,
        monthly_fee: parseFloat(form.monthly_fee) || 0,
        services: form.services.split(',').map(s => s.trim()).filter(Boolean),
      }

      let saved: Client
      if (initial) {
        const { data } = await api.put(`/clients/${initial.id}`, payload)
        saved = data
      } else {
        const { data } = await api.post('/clients', payload)
        saved = data
      }

      // Upload avatar separately if changed
      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        const { data: withAvatar } = await api.patch(`/clients/${saved.id}/avatar`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        saved = withAvatar
      }

      onSaved(saved)
      onClose()
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const initials = form.company ? form.company.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg" style={{ color: 'rgb(var(--ink-100))' }}>
            {initial ? t('admin:clients.editClient') : t('admin:clients.newClient')}
          </h3>
          <button onClick={onClose} style={{ color: 'rgb(var(--ink-300))' }} className="hover:text-white"><X size={18} /></button>
        </div>

        {/* Avatar upload */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            {avatarPreview
              ? <img src={avatarPreview} alt="" className="w-16 h-16 rounded-2xl object-cover" style={{ border: `2px solid ${form.color}40` }} />
              : <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-xl" style={{ background: form.color + '30', border: `2px solid ${form.color}40` }}>{initials}</div>
            }
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all"
              style={{ borderColor: 'rgb(var(--ink-500) / 0.4)', color: 'rgb(var(--ink-200))' }}>
              <Upload size={13} /> {avatarPreview ? t('admin:clients.form.changePhoto') : t('admin:clients.form.uploadPhoto')}
            </button>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--ink-400))' }}>{t('admin:clients.form.photoHint')}</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'company',     label: t('admin:clients.form.company'),                    type: 'text' },
            { key: 'contact',     label: t('admin:clients.form.mainContact'),           type: 'text' },
            { key: 'email',       label: t('admin:clients.form.email'),                      type: 'email' },
            { key: 'phone',       label: t('admin:clients.form.phone'),    type: 'tel' },
            { key: 'industry',    label: t('admin:clients.form.industry'),   type: 'text' },
            { key: 'services',    label: t('admin:clients.form.services'), type: 'text' },
            { key: 'description', label: t('admin:clients.form.description'),            type: 'text' },
            { key: 'start_date', label: t('admin:clients.form.startDate'),              type: 'date' },
          ].map(f => (
            <input key={f.key} type={f.type} placeholder={f.label}
              value={(form as unknown as Record<string, string>)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="input-dark text-sm" />
          ))}

          {/* Monthly fee + Currency */}
          <div className="flex gap-2">
            <input type="number" placeholder={t('admin:clients.form.monthlyFee')}
              value={form.monthly_fee}
              onChange={e => setForm(prev => ({ ...prev, monthly_fee: e.target.value }))}
              className="input-dark text-sm flex-1" />
            <select value={form.currency}
              onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))}
              className="input-dark text-sm w-24">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Status toggle */}
          <div className="flex gap-2">
            {['active', 'paused'].map(s => (
              <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${form.status === s ? 'bg-crimson-700 text-white border-crimson-700' : 'border-ink-500/30 text-ink-300'}`}>
                {s === 'active' ? t('admin:clients.status.active') : t('admin:clients.status.paused')}
              </button>
            ))}
          </div>

          {/* Color picker */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--ink-300))' }}>{t('admin:clients.form.clientColor')}</p>
            <div className="flex gap-2 flex-wrap">
              {clientColors.map(c => (
                <button key={c} onClick={() => setForm(prev => ({ ...prev, color: c }))}
                  className="w-7 h-7 rounded-lg transition-transform hover:scale-110"
                  style={{ background: c, boxShadow: form.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : initial ? t('common:common.saveChanges') : t('admin:clients.addClient')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Activity type config ─────────────────────────────────────────────────────
const activityTypeConfig: Record<string, { color: string; icon: typeof Clock }> = {
  client_created:  { color: '#34d399', icon: UserPlus },
  client_updated:  { color: '#60a5fa', icon: Pencil },
  post_approved:   { color: '#34d399', icon: CheckCircle },
  post_created:    { color: '#a78bfa', icon: FileText },
  note_added:      { color: '#f59e0b', icon: MessageSquare },
  todo_completed:  { color: '#34d399', icon: CheckCircle },
  prospect_created:{ color: '#60a5fa', icon: UserPlus },
  idea_updated:    { color: '#a78bfa', icon: Bell },
}
const defaultActivityConfig = { color: '#6b7280', icon: Clock }

function relativeTime(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
}

// ─── Activity Timeline ───────────────────────────────────────────────────────
function ActivityTimeline({ clientId }: { clientId: string }) {
  const { t } = useTranslation(['admin', 'common'])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getClientActivity(clientId).then(setActivities).finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-crimson-400" /></div>
  if (!activities.length) return <p className="text-center py-8 text-sm" style={{ color: 'rgb(var(--ink-400))' }}>{t('admin:clients.noActivity')}</p>

  return (
    <div className="relative pl-6 space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ backgroundColor: 'rgb(var(--ink-600) / 0.5)' }} />

      {activities.map((a, i) => {
        const cfg = activityTypeConfig[a.type] || defaultActivityConfig
        const Icon = cfg.icon
        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative flex items-start gap-3 py-3"
          >
            {/* Dot */}
            <div className="absolute -left-6 top-3.5 w-[18px] h-[18px] rounded-full flex items-center justify-center z-10"
              style={{ backgroundColor: cfg.color + '20', border: `2px solid ${cfg.color}` }}>
              <Icon size={9} style={{ color: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug" style={{ color: 'rgb(var(--ink-200))' }}><T text={a.description} translatable /></p>
              <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--ink-400))' }}>{relativeTime(a.created_at)}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Notes Panel ─────────────────────────────────────────────────────────────
function NotesPanel({ clientId }: { clientId: string }) {
  const { t } = useTranslation(['admin', 'common'])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getClientNotes(clientId).then(setNotes).finally(() => setLoading(false))
  }, [clientId])

  const handleAdd = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      const note = await addClientNote(clientId, content)
      setNotes(prev => [note, ...prev])
      setContent('')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    await deleteClientNote(clientId, noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="glass-card p-3 space-y-2">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={t('admin:clients.addNotePlaceholder')}
          rows={3}
          className="input-dark text-sm w-full resize-none"
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAdd() }}
        />
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
            disabled={!content.trim() || saving}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {t('admin:clients.addNoteButton')}
          </motion.button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-crimson-400" /></div>}

      {!loading && !notes.length && (
        <p className="text-center py-6 text-sm" style={{ color: 'rgb(var(--ink-400))' }}>{t('admin:clients.noNotes')}</p>
      )}

      <AnimatePresence>
        {notes.map(note => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="glass-card p-4 group relative"
          >
            <p className="text-sm leading-relaxed pr-6" style={{ color: 'rgb(var(--ink-200))' }}><T text={note.content} translatable /></p>
            <div className="flex items-center gap-2 mt-2">
              {note.author && (
                <span className="text-xs font-medium" style={{ color: 'rgb(var(--ink-300))' }}><T text={note.author} /></span>
              )}
              <span className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>{relativeTime(note.created_at)}</span>
            </div>
            <button
              onClick={() => handleDelete(note.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-red-500/10"
              style={{ color: 'rgb(var(--ink-400))' }}
            >
              <Trash2 size={13} className="hover:text-red-400" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Clientes() {
  const { t } = useTranslation(['admin', 'common'])
  const fetchClients = useStore(s => s.fetchClients)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Client | null>(null)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'info' | 'historial' | 'notas'>('info')
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null })

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).finally(() => setLoading(false))
  }, [])

  const handleSaved = (c: Client) => {
    setClients(prev => {
      const exists = prev.some(x => x.id === c.id)
      return exists ? prev.map(x => x.id === c.id ? c : x) : [c, ...prev]
    })
    if (selected?.id === c.id) setSelected(c)
    fetchClients() // Sync global store
  }

  const handleDelete = (client: Client) => {
    setConfirmDel({ open: true, client })
  }

  const executeDelete = async () => {
    if (!confirmDel.client) return
    try {
      await api.delete(`/clients/${confirmDel.client.id}`)
      setClients(p => p.filter(x => x.id !== confirmDel.client!.id))
      if (selected?.id === confirmDel.client.id) setSelected(null)
      fetchClients() // Sync global store
    } catch {
      // silent — server error
    }
    setConfirmDel({ open: false, client: null })
  }

  const totalMRR = clients
    .filter(c => c.status === 'active')
    .reduce((a, c) => a + (c.monthlyFee || c.monthly_fee || 0), 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="section-title">{t('admin:clients.title')}</h2>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--ink-300))' }}>
            {t('admin:clients.activeMRR', { count: clients.filter(c => c.status === 'active').length, amount: formatCurrency(totalMRR) })}
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> {t('admin:clients.newClient')}
        </motion.button>
      </div>

      {/* MRR Bar */}
      {totalMRR > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>{t('admin:clients.mrrDistribution')}</p>
            <p className="text-sm font-bold" style={{ color: 'rgb(var(--ink-100))' }}>{formatCurrency(totalMRR)}</p>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            {clients.filter(c => c.status === 'active').map(c => (
              <motion.div key={c.id} initial={{ width: 0 }}
                animate={{ width: `${((c.monthlyFee || c.monthly_fee || 0) / totalMRR) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full rounded-full" style={{ background: c.color }}
                title={`${c.company}: ${formatCurrency(c.monthlyFee || c.monthly_fee || 0, c.currency || 'USD')}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {clients.filter(c => c.status === 'active').map(c => (
              <div key={c.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--ink-300))' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span><T text={c.company} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-crimson-400" />
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence>
            {clients.map(c => (
              <ClientCard key={c.id} client={c} onSelect={(c) => { setDrawerTab('info'); setSelected(c) }} onEdit={setEditClient} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md h-full overflow-y-auto"
              style={{ backgroundColor: 'rgb(var(--ink-900))', borderLeft: '1px solid rgb(var(--ink-600) / 0.4)' }}
              onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-xl" style={{ color: 'rgb(var(--ink-100))' }}><T text={selected.company} /></h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditClient(selected); setSelected(null) }}
                      className="p-2 rounded-xl transition-all" style={{ color: 'rgb(var(--ink-300))' }}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(selected)}
                      className="p-2 rounded-xl text-red-400/60 hover:text-red-400 transition-all">
                      <Trash2 size={15} />
                    </button>
                    <button onClick={() => setSelected(null)} style={{ color: 'rgb(var(--ink-300))' }}><X size={20} /></button>
                  </div>
                </div>

                {/* Tab buttons */}
                <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: 'rgb(var(--ink-800) / 0.6)' }}>
                  {([
                    { key: 'info' as const, label: t('admin:clients.drawer.info'), icon: Briefcase },
                    { key: 'historial' as const, label: t('admin:clients.drawer.history'), icon: Clock },
                    { key: 'notas' as const, label: t('admin:clients.drawer.notes'), icon: MessageSquare },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setDrawerTab(tab.key)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: drawerTab === tab.key ? 'rgb(var(--ink-700))' : 'transparent',
                        color: drawerTab === tab.key ? 'rgb(var(--ink-100))' : 'rgb(var(--ink-400))',
                      }}
                    >
                      <tab.icon size={13} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {drawerTab === 'info' && (
                    <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                      <ClientAvatar client={selected} size="lg" className="mb-6" />

                      <div className="space-y-3">
                        {[
                          { icon: Mail,        label: t('admin:clients.drawer.email'),              value: selected.email },
                          { icon: Phone,       label: t('admin:clients.drawer.phone'),           value: selected.phone || 'N/A' },
                          { icon: Briefcase,   label: t('admin:clients.drawer.industry'),          value: selected.industry },
                          { icon: Calendar,    label: t('admin:clients.drawer.clientSince'),      value: formatDate(selected.startDate || selected.start_date || '') },
                          { icon: DollarSign,  label: t('admin:clients.drawer.monthlyRetention'),  value: formatCurrency(selected.monthlyFee || selected.monthly_fee || 0, selected.currency || 'USD') },
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: 'rgb(var(--ink-800) / 0.5)' }}>
                            <item.icon size={16} style={{ color: 'rgb(var(--ink-400))' }} className="flex-shrink-0" />
                            <div>
                              <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>{item.label}</p>
                              <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-100))' }}>{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selected.services?.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--ink-300))' }}>{t('admin:clients.drawer.services')}</p>
                          <div className="flex flex-wrap gap-2">
                            {selected.services.map(s => (
                              <span key={s} className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5"
                                style={{ backgroundColor: 'rgb(var(--ink-700) / 0.5)', color: 'rgb(var(--ink-100))' }}>
                                <CheckCircle size={11} className="text-green-400" /> <T text={s} />
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selected.description && (
                        <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: 'rgb(var(--ink-800) / 0.5)' }}>
                          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--ink-300))' }}>{t('admin:clients.drawer.description')}</p>
                          <p className="text-sm" style={{ color: 'rgb(var(--ink-200))' }}><T text={selected.description} translatable /></p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {drawerTab === 'historial' && (
                    <motion.div key="historial" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                      <ActivityTimeline clientId={selected.id} />
                    </motion.div>
                  )}

                  {drawerTab === 'notas' && (
                    <motion.div key="notas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                      <NotesPanel clientId={selected.id} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdd && <ClientModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />}
        {editClient && <ClientModal initial={editClient} onClose={() => setEditClient(null)} onSaved={handleSaved} />}
      </AnimatePresence>

      {/* ─── Delete Confirmation Dialog ─── */}
      <AnimatePresence>
        {confirmDel.open && confirmDel.client && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmDel({ open: false, client: null })}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="glass-card w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="font-bold text-white">{t('admin:clients.deleteConfirmTitle')}</h3>
              </div>
              <p className="text-sm text-ink-300">
                {t('admin:clients.deleteConfirmMessage', { name: confirmDel.client.company })}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDel({ open: false, client: null })}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:text-white hover:bg-white/5 transition-all border border-white/10"
                >
                  {t('common:common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={executeDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  {t('common:common.delete')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
