import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, Sparkles, Zap, Wrench, CheckCircle, Rocket, Loader2, MessageSquare, Pencil, AlertTriangle, Send } from 'lucide-react'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { getIdeas, createIdea as createIdeaApi, updateIdea as updateIdeaApi, deleteIdea as deleteIdeaApi, getIdeaNotes, addIdeaNoteMsg, markIdeaNotesRead, editIdeaNote, deleteIdeaNote } from '../lib/api'
import type { ItemNote } from '../lib/api'
import { ideaStatusConfig, localToday, getLocale } from '../lib/utils'
import type { Idea, IdeaStatus } from '../types'
import { useTranslation } from 'react-i18next'
import T from '../components/TranslatedText'

const statusColumnKeys: { key: IdeaStatus; labelKey: string; icon: ReactNode }[] = [
  { key: 'brainstorm',  labelKey: 'ideas.columns.brainstorm',    icon: <Zap size={18} /> },
  { key: 'developing',  labelKey: 'ideas.columns.developing', icon: <Wrench size={18} /> },
  { key: 'ready',       labelKey: 'ideas.columns.ready',         icon: <CheckCircle size={18} /> },
  { key: 'implemented', labelKey: 'ideas.columns.implemented',  icon: <Rocket size={18} /> },
]

const commonTagKeys = ['linkedin', 'instagram', 'video', 'design', 'seo', 'email', 'content', 'strategy', 'branding', 'campaign'] as const

function useStatusColumns() {
  const { t } = useTranslation(['admin'])
  return statusColumnKeys.map(col => ({
    ...col,
    label: t(`admin:${col.labelKey}`),
  }))
}

function useCommonTags() {
  const { t } = useTranslation(['admin'])
  return commonTagKeys.map(key => ({
    key,
    label: t(`admin:ideas.tags.${key}`),
  }))
}

function IdeaCard({ idea, onUpdate, onDelete, clientLabel, onOpenDetail, onStartEdit, statusColumns }: {
  idea: Idea
  onUpdate: (id: string, data: Partial<Idea>) => void
  onDelete: () => void
  clientLabel?: string
  onOpenDetail?: (idea: Idea) => void
  onStartEdit?: (idea: Idea) => void
  statusColumns: { key: IdeaStatus; label: string; icon: ReactNode }[]
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
      className="glass-card p-4 group cursor-pointer"
      onClick={() => onOpenDetail?.(idea)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{idea.emoji || '💡'}</span>
          {clientLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--accent) / 0.1)', color: 'var(--accent-light)' }}>
              {t('admin:ideas.fromClient', { clientName: clientLabel })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!clientLabel && onStartEdit && (
            <button onClick={(e) => { e.stopPropagation(); onStartEdit(idea) }} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-[var(--accent-light)] transition-all">
              <Pencil size={14} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-[var(--accent-light)] transition-all">
            <X size={14} />
          </button>
        </div>
      </div>
      <h4 className="font-semibold text-white text-sm mb-1.5 leading-snug"><T text={idea.title} /></h4>
      <p className="text-xs text-ink-300 mb-3 leading-relaxed line-clamp-3"><T text={idea.description} translatable /></p>
      <div className="flex flex-wrap gap-1 mb-3">
        {idea.tags.map(tag => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-200"><T text={tag} /></span>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <select
          value={idea.status}
          onClick={e => e.stopPropagation()}
          onChange={e => onUpdate(idea.id, { status: e.target.value as IdeaStatus })}
          className="bg-transparent text-xs outline-none cursor-pointer"
          style={{ color: cfg.color }}
        >
          {statusColumns.map(s => <option key={s.key} value={s.key} className="bg-ink-800">{s.label}</option>)}
        </select>
        {(idea.notesCount ?? 0) > 0 && (
          <span className="min-w-[16px] h-[16px] px-1 flex items-center justify-center text-white text-[9px] font-bold rounded-full" style={{ background: 'rgb(var(--accent))' }}>
            {idea.notesCount}
          </span>
        )}
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
  const statusColumns = useStatusColumns()
  const commonTags = useCommonTags()
  const { clients } = useStore()
  const { user } = useAuthStore()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [detailIdea, setDetailIdea] = useState<Idea | null>(null)
  const [detailNotes, setDetailNotes] = useState<ItemNote[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
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
        createdAt: localToday(),
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

  const openDetail = async (idea: Idea) => {
    setDetailIdea(idea)
    setDetailLoading(true)
    setNewNoteContent('')
    setEditingNoteId(null)
    try {
      const notes = await getIdeaNotes(idea.id)
      setDetailNotes(notes)
      markIdeaNotesRead(idea.id)
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, notesCount: 0 } : i))
    } catch { setDetailNotes([]) }
    finally { setDetailLoading(false) }
  }

  const handleSendNote = async () => {
    if (!detailIdea || !newNoteContent.trim()) return
    try {
      const note = await addIdeaNoteMsg(detailIdea.id, newNoteContent.trim())
      setDetailNotes(prev => [...prev, note])
      setNewNoteContent('')
    } catch { /* silent */ }
  }

  const handleEditNote = async (noteId: string) => {
    if (!detailIdea || !editNoteContent.trim()) return
    try {
      const updated = await editIdeaNote(detailIdea.id, noteId, editNoteContent.trim())
      setDetailNotes(prev => prev.map(n => n.id === noteId ? updated : n))
      setEditingNoteId(null)
    } catch { /* silent */ }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!detailIdea) return
    try {
      await deleteIdeaNote(detailIdea.id, noteId)
      setDetailNotes(prev => prev.filter(n => n.id !== noteId))
    } catch { /* silent */ }
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
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgb(var(--accent))' }} />
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
                      <IdeaCard idea={idea} onUpdate={handleUpdate} onDelete={() => handleDeleteRequest(idea)} clientLabel={getClientLabel(idea)} onOpenDetail={openDetail} onStartEdit={openEdit} statusColumns={statusColumns} />
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
              <IdeaCard idea={activeIdea} onUpdate={() => {}} onDelete={() => {}} statusColumns={statusColumns} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailIdea && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={() => setDetailIdea(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-0 w-full max-w-4xl max-h-[85vh] overflow-hidden flex"
              onMouseDown={e => e.stopPropagation()}>

              {/* Left: Idea info */}
              <div className="flex-1 p-6 overflow-y-auto thin-scrollbar">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {detailIdea.emoji && <span className="text-2xl">{detailIdea.emoji}</span>}
                    <h3 className="font-bold text-lg text-white">{detailIdea.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { openEdit(detailIdea); setDetailIdea(null) }}
                      className="text-ink-400 hover:text-[var(--accent-light)] transition-all"><Pencil size={16} /></button>
                    <button onClick={() => setDetailIdea(null)} className="text-ink-400 hover:text-white"><X size={18} /></button>
                  </div>
                </div>

                {detailIdea.description && (
                  <p className="text-sm text-ink-200 mb-4 leading-relaxed">{detailIdea.description}</p>
                )}

                {/* Tags */}
                {detailIdea.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {detailIdea.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-300">{tag}</span>
                    ))}
                  </div>
                )}

                {/* Status badge */}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  detailIdea.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400' :
                  detailIdea.status === 'developing' ? 'bg-blue-500/10 text-blue-400' :
                  detailIdea.status === 'brainstorm' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-purple-500/10 text-purple-400'
                }`}>
                  {ideaStatusConfig[detailIdea.status]?.label || detailIdea.status}
                </span>
              </div>

              {/* Right: Comments */}
              <div className="w-[380px] border-l border-white/5 flex flex-col bg-ink-900/50">
                <div className="p-4 border-b border-white/5">
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    <MessageSquare size={14} /> {t('common:notes.comments')} ({detailNotes.length})
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3">
                  {detailLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-ink-400" /></div>
                  ) : detailNotes.length === 0 ? (
                    <p className="text-xs text-ink-400 text-center py-8">{t('common:notes.noNotes')}</p>
                  ) : (
                    detailNotes.map(note => (
                      <div key={note.id} className="flex gap-3 group/note">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: note.author_id === user?.id ? 'rgb(var(--accent) / 0.19)' : 'rgb(var(--ink-700))', color: note.author_id === user?.id ? 'rgb(var(--accent))' : 'rgb(var(--ink-300))' }}>
                          {note.author_name?.slice(0, 2).toUpperCase() || '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{note.author_name}</span>
                            <span className="text-[10px] text-ink-400">
                              {new Date(note.created_at).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {editingNoteId === note.id ? (
                            <div className="mt-1">
                              <textarea value={editNoteContent} onChange={e => setEditNoteContent(e.target.value)}
                                className="input-dark text-sm w-full resize-none" rows={2} autoFocus />
                              <div className="flex gap-2 mt-1">
                                <button onClick={() => handleEditNote(note.id)} className="text-xs" style={{ color: 'var(--accent-light)' }}>{t('common:notes.save')}</button>
                                <button onClick={() => setEditingNoteId(null)} className="text-xs text-ink-400">{t('common:notes.cancel')}</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-ink-200 mt-0.5">{note.content}</p>
                              {note.author_id === user?.id && (
                                <div className="flex gap-2 mt-1 flex">
                                  <button onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content) }}
                                    className="text-[10px] text-ink-400 hover:text-white">{t('common:notes.edit')}</button>
                                  <span className="text-[10px] text-ink-600">·</span>
                                  <button onClick={() => handleDeleteNote(note.id)}
                                    className="text-[10px] text-ink-400 hover:text-red-400">{t('common:notes.delete')}</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t border-white/5 flex gap-2">
                  <input type="text" placeholder={t('common:notes.placeholder')}
                    value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newNoteContent.trim()) handleSendNote() }}
                    className="input-dark text-sm flex-1" />
                  <button onClick={handleSendNote} disabled={!newNoteContent.trim()}
                    className="px-3 py-2 disabled:opacity-30 text-white rounded-xl transition-all" style={{ background: 'rgb(var(--accent))' }}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal - Create / Edit */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-6 w-full max-w-md"
              onMouseDown={e => e.stopPropagation()}
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
                        className={`text-2xl p-2 rounded-xl transition-all ${form.emoji === e ? 'ring-1 ring-[rgb(var(--accent))]' : 'hover:bg-white/5'}`}
                        style={form.emoji === e ? { background: 'rgb(var(--accent) / 0.2)' } : {}}
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
                    {commonTags.map(tag => (
                      <button
                        key={tag.key}
                        onClick={() => toggleTag(tag.label)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          form.tags.includes(tag.label)
                            ? 'border-[rgb(var(--accent))]'
                            : 'border-white/10 text-ink-300 hover:border-white/20'
                        }`}
                        style={form.tags.includes(tag.label) ? { background: 'rgb(var(--accent) / 0.2)', color: 'var(--accent-light)' } : {}}
                      >
                        {tag.label}
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
                    {t('common:common.cancel')}
                  </button>
                  <button
                    onClick={() => { handleDelete(confirmDelete.id); setConfirmDelete(null) }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors"
                  >
                    {t('common:common.delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
