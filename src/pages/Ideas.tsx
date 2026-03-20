import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, Sparkles, Zap, Wrench, CheckCircle, Rocket, Loader2 } from 'lucide-react'
import { getIdeas, createIdea as createIdeaApi, updateIdea as updateIdeaApi, deleteIdea as deleteIdeaApi } from '../lib/api'
import { ideaStatusConfig } from '../lib/utils'
import type { Idea, IdeaStatus } from '../types'

const statusColumns: { key: IdeaStatus; label: string; icon: ReactNode }[] = [
  { key: 'brainstorm',  label: 'Brainstorm',    icon: <Zap size={18} /> },
  { key: 'developing',  label: 'Desarrollando', icon: <Wrench size={18} /> },
  { key: 'ready',       label: 'Lista',         icon: <CheckCircle size={18} /> },
  { key: 'implemented', label: 'Implementada',  icon: <Rocket size={18} /> },
]

const commonTags = ['LinkedIn', 'Instagram', 'Video', 'Diseño', 'SEO', 'Email', 'Contenido', 'Estrategia', 'Branding', 'Campaña']

function IdeaCard({ idea, onUpdate, onDelete }: {
  idea: Idea
  onUpdate: (id: string, data: Partial<Idea>) => void
  onDelete: (id: string) => void
}) {
  const cfg = ideaStatusConfig[idea.status]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      className="glass-card p-4 group"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{idea.emoji || '💡'}</span>
        <button
          onClick={() => onDelete(idea.id)}
          className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all"
        >
          <X size={14} />
        </button>
      </div>
      <h4 className="font-semibold text-white text-sm mb-1.5 leading-snug">{idea.title}</h4>
      <p className="text-xs text-ink-300 mb-3 leading-relaxed line-clamp-3">{idea.description}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {idea.tags.map(t => (
          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-200">{t}</span>
        ))}
      </div>
      <div className="pt-2 border-t border-white/5">
        <select
          value={idea.status}
          onChange={e => onUpdate(idea.id, { status: e.target.value as IdeaStatus })}
          className="w-full bg-transparent text-xs outline-none cursor-pointer"
          style={{ color: cfg.color }}
        >
          {statusColumns.map(s => <option key={s.key} value={s.key} className="bg-ink-800">{s.label}</option>)}
        </select>
      </div>
    </motion.div>
  )
}

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', emoji: '💡', tags: [] as string[], customTag: '',
  })

  useEffect(() => {
    getIdeas()
      .then(setIdeas)
      .catch(err => console.error('Error fetching ideas:', err))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!form.title) return
    try {
      const newIdea = await createIdeaApi({
        title: form.title,
        description: form.description,
        status: 'brainstorm',
        tags: form.tags,
        emoji: form.emoji,
        createdAt: new Date().toISOString().split('T')[0],
      })
      setIdeas(prev => [newIdea, ...prev])
      setForm({ title: '', description: '', emoji: '💡', tags: [], customTag: '' })
      setShowModal(false)
    } catch (err) {
      console.error('Error creating idea:', err)
    }
  }

  const handleUpdate = async (id: string, data: Partial<Idea>) => {
    const existing = ideas.find(i => i.id === id)
    if (!existing) return
    try {
      const merged = { ...existing, ...data }
      const updated = await updateIdeaApi(id, merged)
      setIdeas(prev => prev.map(i => i.id === id ? updated : i))
    } catch (err) {
      console.error('Error updating idea:', err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteIdeaApi(id)
      setIdeas(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      console.error('Error deleting idea:', err)
    }
  }

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }))
  }

  const emojis = ['💡', '🎬', '📈', '📧', '🎨', '🚀', '✨', '🎯', '📱', '🔥']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-crimson-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="section-title">Ideas Creativas</h2>
          <p className="text-ink-300 text-sm mt-1">El cerebro de TheBrandingStudio · {ideas.length} ideas</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowModal(true)} className="btn-primary">
          <Sparkles size={16} /> Nueva Idea
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {statusColumns.map(s => {
          const cfg = ideaStatusConfig[s.key]
          const count = ideas.filter(i => i.status === s.key).length
          return (
            <div key={s.key} className="glass-card p-4 text-center">
              <div className="mb-1" style={{ color: ideaStatusConfig[s.key].color }}>{s.icon}</div>
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs font-medium" style={{ color: cfg.color }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {statusColumns.map(col => {
          const cfg = ideaStatusConfig[col.key]
          const items = ideas.filter(i => i.status === col.key)
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                <span style={{ color: cfg.color }}>{col.icon}</span>
                <span className="text-sm font-semibold" style={{ color: cfg.color }}>{col.label}</span>
                <span className="ml-auto text-xs bg-ink-700 text-ink-300 px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <AnimatePresence>
                {items.map(idea => (
                  <IdeaCard key={idea.id} idea={idea} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </AnimatePresence>
              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-ink-500">
                  <Lightbulb size={24} className="mb-2 opacity-30" />
                  <p className="text-xs">Sin ideas aquí</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white text-lg">Nueva Idea</h3>
                <button onClick={() => setShowModal(false)} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                {/* Emoji picker */}
                <div>
                  <p className="text-xs text-ink-300 mb-2">Elige un emoji</p>
                  <div className="flex flex-wrap gap-2">
                    {emojis.map(e => (
                      <button
                        key={e}
                        onClick={() => setForm(prev => ({ ...prev, emoji: e }))}
                        className={`text-2xl p-2 rounded-xl transition-all ${form.emoji === e ? 'bg-crimson-700/20 ring-1 ring-crimson-500' : 'hover:bg-white/5'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Título de la idea *"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input-dark text-sm"
                />
                <textarea
                  placeholder="Descripción detallada..."
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="input-dark text-sm resize-none"
                />
                <div>
                  <p className="text-xs text-ink-300 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {commonTags.map(t => (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          form.tags.includes(t)
                            ? 'border-crimson-500 bg-crimson-700/20 text-crimson-300'
                            : 'border-white/10 text-ink-300 hover:border-white/20'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <button onClick={handleAdd} className="btn-primary flex-1 justify-center">
                  <Sparkles size={15} /> Agregar Idea
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
