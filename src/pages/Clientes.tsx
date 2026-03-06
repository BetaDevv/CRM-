import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Mail, Phone, DollarSign, Calendar, Briefcase, ExternalLink,
  CheckCircle, Pencil, Trash2, Loader2, Plus, Upload,
} from 'lucide-react'
import { formatCurrency, formatDate } from '../lib/utils'
import { api } from '../lib/api'
import type { Client } from '../types'

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
  client, onSelect, onEdit,
}: { client: Client; onSelect: (c: Client) => void; onEdit: (c: Client) => void }) {
  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      className="glass-card p-5 cursor-pointer border border-transparent hover:border-white/10 transition-all duration-300 group relative"
      onClick={() => onSelect(client)}
    >
      {/* Edit button on hover */}
      <button
        onClick={e => { e.stopPropagation(); onEdit(client) }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-white/10"
        style={{ color: 'rgb(var(--ink-300))' }}
      >
        <Pencil size={13} />
      </button>

      <div className="flex items-start gap-4 mb-4">
        <ClientAvatar client={client} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold truncate" style={{ color: 'rgb(var(--ink-100))' }}>{client.company}</h3>
          <p className="text-sm truncate" style={{ color: 'rgb(var(--ink-300))' }}>{client.contact}</p>
        </div>
        <span className={`badge flex-shrink-0 ${client.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-ink-600 text-ink-300'}`}>
          {client.status === 'active' ? 'Activo' : 'Pausado'}
        </span>
      </div>

      {client.description && (
        <p className="text-xs mb-4 line-clamp-2" style={{ color: 'rgb(var(--ink-300))' }}>{client.description}</p>
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
          <span>Desde {formatDate(client.startDate || client.start_date)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {client.services.map(s => (
          <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgb(var(--ink-700) / 0.6)', color: 'rgb(var(--ink-200))' }}>{s}</span>
        ))}
      </div>

      <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgb(var(--ink-600) / 0.4)' }}>
        <div>
          <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>Retención mensual</p>
          <p className="font-bold" style={{ color: 'rgb(var(--ink-100))' }}>{formatCurrency(client.monthlyFee || client.monthly_fee || 0)}</p>
        </div>
        <div className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
          style={{ background: client.color + '20', color: client.color }}>
          <ExternalLink size={11} /> Ver más
        </div>
      </div>
    </motion.div>
  )
}

// ─── Client Form Modal ─────────────────────────────────────────────────────────
interface ClientFormData {
  company: string; contact: string; email: string; phone: string;
  industry: string; monthly_fee: string; services: string;
  description: string; color: string; status: string;
}

function ClientModal({
  initial, onClose, onSaved,
}: {
  initial?: Client | null
  onClose: () => void
  onSaved: (c: Client) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
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
    services:    (initial?.services || []).join(', '),
    description: initial?.description || '',
    color:       initial?.color       || '#DC143C',
    status:      initial?.status      || 'active',
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.company || !form.email) return
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
        const { data } = await api.post('/clients', { ...payload, start_date: new Date().toISOString().split('T')[0] })
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
      setLoading(false)
    }
  }

  const initials = form.company ? form.company.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg" style={{ color: 'rgb(var(--ink-100))' }}>
            {initial ? 'Editar Cliente' : 'Nuevo Cliente'}
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
              <Upload size={13} /> {avatarPreview ? 'Cambiar foto' : 'Subir foto'}
            </button>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--ink-400))' }}>Opcional · JPG, PNG hasta 5MB</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'company',     label: 'Empresa *',                    type: 'text' },
            { key: 'contact',     label: 'Contacto Principal',           type: 'text' },
            { key: 'email',       label: 'Email *',                      type: 'email' },
            { key: 'phone',       label: 'Teléfono',                     type: 'tel' },
            { key: 'industry',    label: 'Industria',                    type: 'text' },
            { key: 'monthly_fee', label: 'Retención mensual (USD)',       type: 'number' },
            { key: 'services',    label: 'Servicios (separados por coma)', type: 'text' },
            { key: 'description', label: 'Descripción breve',            type: 'text' },
          ].map(f => (
            <input key={f.key} type={f.type} placeholder={f.label}
              value={(form as Record<string, string>)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="input-dark text-sm" />
          ))}

          {/* Status toggle */}
          <div className="flex gap-2">
            {['active', 'paused'].map(s => (
              <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${form.status === s ? 'bg-crimson-700 text-white border-crimson-700' : 'border-ink-500/30 text-ink-300'}`}>
                {s === 'active' ? 'Activo' : 'Pausado'}
              </button>
            ))}
          </div>

          {/* Color picker */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--ink-300))' }}>Color del cliente</p>
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
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : initial ? 'Guardar cambios' : 'Agregar Cliente'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Client | null>(null)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).finally(() => setLoading(false))
  }, [])

  const handleSaved = (c: Client) => {
    setClients(prev => {
      const exists = prev.some(x => x.id === c.id)
      return exists ? prev.map(x => x.id === c.id ? c : x) : [c, ...prev]
    })
    // Also update selected drawer if open
    if (selected?.id === c.id) setSelected(c)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    await api.delete(`/clients/${id}`)
    setClients(p => p.filter(x => x.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const totalMRR = clients
    .filter(c => c.status === 'active')
    .reduce((a, c) => a + (c.monthlyFee || c.monthly_fee || 0), 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="section-title">Clientes</h2>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--ink-300))' }}>
            {clients.filter(c => c.status === 'active').length} activos · MRR total {formatCurrency(totalMRR)}
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Nuevo Cliente
        </motion.button>
      </div>

      {/* MRR Bar */}
      {totalMRR > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>Distribución MRR</p>
            <p className="text-sm font-bold" style={{ color: 'rgb(var(--ink-100))' }}>{formatCurrency(totalMRR)}</p>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            {clients.filter(c => c.status === 'active').map(c => (
              <motion.div key={c.id} initial={{ width: 0 }}
                animate={{ width: `${((c.monthlyFee || c.monthly_fee || 0) / totalMRR) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full rounded-full" style={{ background: c.color }}
                title={`${c.company}: ${formatCurrency(c.monthlyFee || c.monthly_fee || 0)}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {clients.filter(c => c.status === 'active').map(c => (
              <div key={c.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--ink-300))' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span>{c.company}</span>
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
              <ClientCard key={c.id} client={c} onSelect={setSelected} onEdit={setEditClient} />
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
                  <h3 className="font-bold text-xl" style={{ color: 'rgb(var(--ink-100))' }}>{selected.company}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditClient(selected); setSelected(null) }}
                      className="p-2 rounded-xl transition-all" style={{ color: 'rgb(var(--ink-300))' }}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(selected.id)}
                      className="p-2 rounded-xl text-red-400/60 hover:text-red-400 transition-all">
                      <Trash2 size={15} />
                    </button>
                    <button onClick={() => setSelected(null)} style={{ color: 'rgb(var(--ink-300))' }}><X size={20} /></button>
                  </div>
                </div>

                <ClientAvatar client={selected} size="lg" className="mb-6" />

                <div className="space-y-3">
                  {[
                    { icon: Mail,        label: 'Email',              value: selected.email },
                    { icon: Phone,       label: 'Teléfono',           value: selected.phone || 'N/A' },
                    { icon: Briefcase,   label: 'Industria',          value: selected.industry },
                    { icon: Calendar,    label: 'Cliente desde',      value: formatDate(selected.startDate || selected.start_date) },
                    { icon: DollarSign,  label: 'Retención mensual',  value: formatCurrency(selected.monthlyFee || selected.monthly_fee || 0) },
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
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--ink-300))' }}>Servicios</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.services.map(s => (
                        <span key={s} className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5"
                          style={{ backgroundColor: 'rgb(var(--ink-700) / 0.5)', color: 'rgb(var(--ink-100))' }}>
                          <CheckCircle size={11} className="text-green-400" /> {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.description && (
                  <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: 'rgb(var(--ink-800) / 0.5)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--ink-300))' }}>Descripción</p>
                    <p className="text-sm" style={{ color: 'rgb(var(--ink-200))' }}>{selected.description}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdd && <ClientModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />}
        {editClient && <ClientModal initial={editClient} onClose={() => setEditClient(null)} onSaved={handleSaved} />}
      </AnimatePresence>
    </div>
  )
}
