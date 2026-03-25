import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, Sparkles, Zap, Wrench, CheckCircle, Rocket, Loader2, MessageSquare, Pencil, AlertTriangle } from 'lucide-react'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { getIdeas, createIdea as createIdeaApi, updateIdea as updateIdeaApi, deleteIdea as deleteIdeaApi, getIdeaNotes, addIdeaNoteMsg } from '../lib/api'
import type { ItemNote } from '../lib/api'
import { ideaStatusConfig } from '../lib/utils'
import type { Idea, IdeaStatus } from '../types'
import NotesPanel from '../components/NotesPanel'
import { useTranslation } from 'react-i18next'

const statusColumns: { key: IdeaStatus; label: string; icon: ReactNode }[] = [
  { key: 'brainstorm',  label: 'Brainstorm',    icon: <Zap size={18} /> },
  { key: 'developing',  label: 'Desarrollando', icon: <Wrench size={18} /> },
  { key: 'ready',       label: 'Lista',         icon: <CheckCircle size={18} /> },
  { key: 'implemented', label: 'Implementada',  icon: <Rocket size={18} /> },
]

const commonTags = ['LinkedIn', 'Instagram', 'Video', 'Diseño', 'SEO', 'Email', 'Contenido', 'Estrategia', 'Branding', 'Campaña']

function IdeaCard({ idea, onUpdate, onDelete, clientLabel, onOpenNotes, onStartEdit }: {
  idea: Idea
  onUpdate: (id: string, data: Partial<Idea>) => void
  onDelete: () => void
  clientLabel?: string
  onOpenNotes?: (idea: Idea) => void
  onStartEdit?: (idea: Idea) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
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
        <div className="flex items-center gap-2">
          <span className="text-2xl">{idea.emoji || '💡'}</span>
          {clientLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-crimson-500/10 text-crimson-400">
              {t('admin:ideas.fromClient', { clientName: clientLabel })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!clientLabel && onStartEdit && (
            <button onClick={() => onStartEdit(idea)} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all">
              <Pencil size={14} />
            </button>
          )}
          <button onClick={() => onDelete()} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all">
            <X size={14} />
          </button>
        </div>
      </div>
      <h4 className="font-semibold text-white text-sm mb-1.5 leading-snug">{idea.title}</h4>
      <p className="text-xs text-ink-300 mb-3 leading-relaxed line-clamp-3">{idea.description}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {idea.tags.map(t => (
          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-200">{t}</span>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <select
          value={idea.status}
          onChange={e => onUpdate(idea.id, { status: e.target.value as IdeaStatus })}
          className="bg-transparent text-xs outline-none cursor-pointer"
          style={{ color: cfg.color }}
        >
          {statusColumns.map(s => <option key={s.key} value={s.key} className="bg-ink-800">{s.label}</option>)}
        </select>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenNotes?.(idea) }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-crimson-400 hover:bg-crimson-700/20 transition-all"
        >
          <MessageSquare size={13} />
          {t('admin:ideas.notes')}
          {(idea.notesCount ?? 0) > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-crimson-500 text-white text-[10px] font-bold rounded-full">
              {idea.notesCount}
            </span>
          )}
        </button>
      </div>
    </motion.div>
  )
}

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`max-h-[520px] overflow-y-auto space-y-3 pr-1 thin-scrollbar min-h-[200px] p-2 rounded-xl transition-colors ${isOver ? 'bg-ink-800/50 ring-1 ring-ink-600' : ''}`}
    >
      {children}
    </div>
  )
}

function DraggableIdeaCard({ idea, children }: { idea: Idea; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${isDragging ? 'opacity-30 z-50' : ''}`}
    >
      {children}
    </div>
  )
}

export default function Ideas() {
  const { t } = useTranslation(['admin', 'common'])
  const { clients } = useStore()
  const { user } = useAuthStore()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [notesItem, setNotesItem] = useState<Idea | null>(null)
  const [notesData, setNotesData] = useState<ItemNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Idea | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', emoji: '💡', tags: [] as string[], customTag: '', clientId: '',
  })

  const [activeIdea, setActiveIdea] = useState<Idea | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const idea = ideas.find(i => i.id === event.active.id)
    setActiveIdea(idea || null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveIdea(null)
    const { active, over } = event
    if (!over) return

    const ideaId = active.id as string
    const newStatus = over.id as string

    // Check if dropped on a valid column
    if (!statusColumns.some(col => col.key === newStatus)) return

    const idea = ideas.find(i => i.id === ideaId)
    if (!idea || idea.status === newStatus) return

    // Optimistic update
    setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, status: newStatus as IdeaStatus } : i))

    try {
      await updateIdeaApi(ideaId, { ...idea, status: newStatus as IdeaStatus })
    } catch {
      // Revert on error
      setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, status: idea.status } : i))
    }
  }

  const resetForm = () => {
    setForm({ title: '', description: '', emoji: '💡', tags: [], customTag: '', clientId: '' })
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingIdea(null)
    resetForm()
  }

  const openEdit = (idea: Idea) => {
    setForm({
      title: idea.title,
      description: idea.description || '',
      emoji: idea.emoji || '💡',
      tags: idea.tags || [],
      customTag: '',
      clientId: idea.clientId || '',
    })
    setEditingIdea(idea)
    setShowModal(true)
  }

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
        clientId: form.clientId || undefined,
        createdAt: new Date().toISOString().split('T')[0],
      })
      setIdeas(prev => [newIdea, ...prev])
      closeModal()
    } catch (err) {
      console.error('Error creating idea:', err)
    }
  }

  const handleEditSubmit = async () => {
    if (!editingIdea || !form.title) return
    try {
      const updated = await updateIdeaApi(editingIdea.id, {
        ...editingIdea,
        title: form.title,
        description: form.description,
        emoji: form.emoji,
        tags: form.tags,
        clientId: form.clientId || undefined,
      })
      setIdeas(prev => prev.map(i => i.id === editingIdea.id ? updated : i))
      closeModal()
    } catch (err) {
      console.error('Error updating idea:', err)
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

  const handleDeleteRequest = (idea: Idea) => {
    setConfirmDelete(idea)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteIdeaApi(id)
      setIdeas(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      console.error('Error deleting idea:', err)
    }
  }

  const openNotes = async (item: Idea) => {
    setNotesItem(item)
    setIdeas(prev => prev.map(i => i.id === item.id ? { ...i, notesCount: 0 } : i))
    setNotesLoading(true)
    try {
      const data = await getIdeaNotes(item.id)
      setNotesData(data)
    } catch (err) {
      console.error('Error fetching notes:', err)
    } finally {
      setNotesLoading(false)
    }
  }

  const handleSendNote = async (content: string) => {
    if (!notesItem) return
    try {
      const newNote = await addIdeaNoteMsg(notesItem.id, content)
      setNotesData(prev => [...prev, newNote])
    } catch (err) {
      console.error('Error sending note:', err)
    }
  }

  const getClientLabel = (idea: Idea) => {
    if (!idea.createdBy || !idea.clientId) return undefined
    const c = clients.find(cl => cl.id === idea.clientId)
    // Only show label for ideas NOT created by admin (created by client)
    if (idea.createdBy.startsWith('u_client')) return c?.company || undefined
    return undefined
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
          <h2 className="section-title">{t('admin:ideas.title')}</h2>
          <p className="text-ink-300 text-sm mt-1">{t('admin:ideas.subtitle', { count: ideas.length })}</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => { resetForm(); setEditingIdea(null); setShowModal(true) }} className="btn-primary">
          <Sparkles size={16} /> {t('admin:ideas.newIdea')}
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                <DroppableColumn id={col.key}>
                  {items.map(idea => (
                    <DraggableIdeaCard key={idea.id} idea={idea}>
                      <IdeaCard idea={idea} onUpdate={handleUpdate} onDelete={() => handleDeleteRequest(idea)} clientLabel={getClientLabel(idea)} onOpenNotes={openNotes} onStartEdit={openEdit} />
                    </DraggableIdeaCard>
                  ))}
                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-ink-500">
                      <Lightbulb size={24} className="mb-2 opacity-30" />
                      <p className="text-xs">{t('admin:ideas.noIdeas')}</p>
                    </div>
                  )}
                </DroppableColumn>
              </div>
            )
          })}
        </div>
        <DragOverlay>
          {activeIdea ? (
            <div className="opacity-90 pointer-events-none">
              <IdeaCard idea={activeIdea} onUpdate={() => {}} onDelete={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal - Create / Edit */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white text-lg">{editingIdea ? t('admin:ideas.editIdea') : t('admin:ideas.newIdea')}</h3>
                <button onClick={closeModal} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                {/* Emoji picker */}
                <div>
                  <p className="text-xs text-ink-300 mb-2">{t('admin:ideas.form.chooseEmoji')}</p>
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
                  placeholder={t('admin:ideas.form.titlePlaceholder')}
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input-dark text-sm"
                />
                <textarea
                  placeholder={t('admin:ideas.form.descriptionPlaceholder')}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="input-dark text-sm resize-none"
                />
                <div>
                  <p className="text-xs text-ink-300 mb-2">{t('admin:ideas.form.tags')}</p>
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
                <div>
                  <p className="text-xs text-ink-300 mb-1.5">{t('admin:ideas.form.relatedClient')}</p>
                  <select
                    value={form.clientId}
                    onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value }))}
                    className="input-dark text-sm"
                  >
                    <option value="" className="bg-ink-800">{t('admin:ideas.form.noClient')}</option>
                    {clients.map(c => <option key={c.id} value={c.id} className="bg-ink-800">{c.company}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={closeModal} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
                <button onClick={editingIdea ? handleEditSubmit : handleAdd} className="btn-primary flex-1 justify-center">
                  <Sparkles size={15} /> {editingIdea ? t('common:common.saveChanges') : t('admin:ideas.addIdea')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Dialog */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-ink-900 border border-ink-700 rounded-2xl p-6 max-w-sm mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{t('admin:ideas.deleteConfirm.title')}</h3>
                <p className="text-ink-400 text-sm mb-6">{t('admin:ideas.deleteConfirm.message')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-4 py-2 bg-ink-700 text-ink-300 rounded-xl hover:bg-ink-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { handleDelete(confirmDelete.id); setConfirmDelete(null) }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Panel */}
      <AnimatePresence>
        {notesItem && (
          <NotesPanel
            notes={notesData}
            onSend={handleSendNote}
            onClose={() => { setNotesItem(null); setNotesData([]) }}
            loading={notesLoading}
            currentUserId={user?.id || ''}
            itemTitle={notesItem.title}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
