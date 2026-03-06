import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Building2, Mail, Phone, DollarSign, Tag, Pencil, Trash2, Loader2 } from 'lucide-react'
import { prospectStatusConfig } from '../lib/utils'
import { api } from '../lib/api'
import type { Prospect, ProspectStatus } from '../types'

const columns: { key: ProspectStatus; label: string }[] = [
  { key: 'new',         label: 'Nuevos' },
  { key: 'contacted',   label: 'Contactados' },
  { key: 'proposal',    label: 'Propuesta' },
  { key: 'negotiation', label: 'Negociación' },
  { key: 'won',         label: 'Ganados' },
  { key: 'lost',        label: 'Perdidos' },
]

const emptyForm = {
  company: '', contact: '', email: '', phone: '',
  industry: '', budget: '', source: 'Web', notes: '',
}

function ProspectCard({
  prospect,
  onUpdate,
  onEdit,
  onDelete,
}: {
  prospect: Prospect
  onUpdate: (id: string, data: Partial<Prospect>) => void
  onEdit: (p: Prospect) => void
  onDelete: (id: string) => void
}) {
  const cfg = prospectStatusConfig[prospect.status]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className="glass-card-hover p-4 group relative"
    >
      {/* Action buttons — absolute overlay on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 z-10 bg-ink-900/80 backdrop-blur-sm rounded-lg p-0.5 transition-opacity">
        <button
          onClick={() => onEdit(prospect)}
          className="p-1.5 rounded text-ink-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={() => onDelete(prospect.id)}
          className="p-1.5 rounded text-ink-400 hover:text-crimson-400 hover:bg-crimson-500/10 transition-all"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-ink-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {prospect.company.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
          {cfg.label}
        </span>
      </div>
      <p className="font-semibold text-white text-sm mb-1">{prospect.company}</p>
      <p className="text-xs text-ink-300 mb-3">{prospect.contact}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <Mail size={11} /> <span>{prospect.email}</span>
        </div>
        {prospect.budget && (
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <DollarSign size={11} /> <span>{prospect.budget}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <Tag size={11} /> <span>{prospect.source}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <select
          value={prospect.status}
          onChange={e => onUpdate(prospect.id, { status: e.target.value as ProspectStatus })}
          className="w-full bg-transparent text-xs text-ink-300 outline-none cursor-pointer"
          onClick={e => e.stopPropagation()}
        >
          {columns.map(c => <option key={c.key} value={c.key} className="bg-ink-800">{c.label}</option>)}
        </select>
      </div>
    </motion.div>
  )
}

interface ProspectForm {
  company: string; contact: string; email: string; phone: string;
  industry: string; budget: string; source: string; notes: string;
}

function ProspectModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Prospect | null
  onClose: () => void
  onSave: (form: ProspectForm) => Promise<void>
}) {
  const [form, setForm] = useState<ProspectForm>(
    initial
      ? { company: initial.company, contact: initial.contact, email: initial.email,
          phone: initial.phone || '', industry: initial.industry || '',
          budget: initial.budget || '', source: initial.source, notes: initial.notes || '' }
      : emptyForm
  )
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!form.company || !form.email) return
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="glass-card p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">{initial ? 'Editar Prospecto' : 'Nuevo Prospecto'}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {[
            { key: 'company',  label: 'Empresa *',   type: 'text' },
            { key: 'contact',  label: 'Contacto',    type: 'text' },
            { key: 'email',    label: 'Email *',      type: 'email' },
            { key: 'phone',    label: 'Teléfono',    type: 'tel' },
            { key: 'industry', label: 'Industria',   type: 'text' },
            { key: 'budget',   label: 'Presupuesto', type: 'text' },
          ].map(f => (
            <input
              key={f.key}
              type={f.type}
              placeholder={f.label}
              value={(form as Record<string, string>)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="input-dark text-sm"
            />
          ))}
          <select
            value={form.source}
            onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))}
            className="input-dark text-sm"
          >
            {['Web', 'LinkedIn', 'Referido', 'Instagram', 'Evento', 'Otro'].map(s => (
              <option key={s} value={s} className="bg-ink-800">{s}</option>
            ))}
          </select>
          <textarea
            placeholder="Notas..."
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            rows={2}
            className="input-dark text-sm resize-none"
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : initial ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Prospectos() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCol, setActiveCol] = useState<ProspectStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editProspect, setEditProspect] = useState<Prospect | null>(null)

  useEffect(() => {
    api.get('/prospects').then(r => setProspects(r.data)).finally(() => setLoading(false))
  }, [])

  const handleAdd = async (form: ProspectForm) => {
    const { data } = await api.post('/prospects', { ...form, status: 'new' })
    setProspects(p => [data, ...p])
    setShowModal(false)
  }

  const handleEdit = async (form: ProspectForm) => {
    if (!editProspect) return
    const { data } = await api.put(`/prospects/${editProspect.id}`, { ...form, status: editProspect.status })
    setProspects(p => p.map(x => x.id === editProspect.id ? data : x))
    setEditProspect(null)
  }

  const handleStatusUpdate = async (id: string, patch: Partial<Prospect>) => {
    const prospect = prospects.find(p => p.id === id)
    if (!prospect) return
    const { data } = await api.put(`/prospects/${id}`, { ...prospect, ...patch })
    setProspects(p => p.map(x => x.id === id ? data : x))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este prospecto?')) return
    await api.delete(`/prospects/${id}`)
    setProspects(p => p.filter(x => x.id !== id))
  }

  const byColumn = (key: ProspectStatus) => prospects.filter(p => p.status === key)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="section-title">Pipeline de Prospectos</h2>
          <p className="text-ink-300 text-sm mt-1">{prospects.length} prospectos en total</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus size={16} /> Nuevo Prospecto
        </motion.button>
      </div>

      {/* Stats Row */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {columns.map(col => {
          const cfg = prospectStatusConfig[col.key]
          const count = byColumn(col.key).length
          return (
            <motion.button
              key={col.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveCol(activeCol === col.key ? 'all' : col.key)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all duration-200
                ${activeCol === col.key
                  ? 'border-current text-white'
                  : 'border-white/10 text-ink-300 hover:text-white hover:border-white/20 bg-ink-800/40'
                }`}
              style={activeCol === col.key ? { color: cfg.color, borderColor: cfg.color, background: cfg.bg } : {}}
            >
              {col.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-current/20 text-current" style={{ color: cfg.color }}>{count}</span>
            </motion.button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-crimson-400" />
        </div>
      )}

      {/* Kanban View */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {columns.map(col => {
            const cfg = prospectStatusConfig[col.key]
            const items = byColumn(col.key)
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-xs font-semibold text-ink-200">{col.label}</span>
                  </div>
                  <span className="text-xs text-ink-400">{items.length}</span>
                </div>
                <div className="space-y-3 min-h-[120px]">
                  <AnimatePresence>
                    {items.map(p => (
                      <ProspectCard
                        key={p.id}
                        prospect={p}
                        onUpdate={handleStatusUpdate}
                        onEdit={setEditProspect}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <ProspectModal onClose={() => setShowModal(false)} onSave={handleAdd} />
        )}
        {editProspect && (
          <ProspectModal initial={editProspect} onClose={() => setEditProspect(null)} onSave={handleEdit} />
        )}
      </AnimatePresence>
    </div>
  )
}
