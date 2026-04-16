import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, Sparkles, Zap, Wrench, CheckCircle, Rocket, Loader2, Share2, Users, MessageSquare, Pencil, AlertTriangle, Send } from 'lucide-react'
import { DndContext, DragOverlay, closestCenter, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import T from '../../components/TranslatedText'
import { useAuthStore } from '../../store/useAuthStore'
import { getIdeas, createIdea as createIdeaApi, updateIdea as updateIdeaApi, deleteIdea as deleteIdeaApi, getIdeaNotes, addIdeaNoteMsg, markIdeaNotesRead, editIdeaNote, deleteIdeaNote } from '../../lib/api'
import type { ItemNote } from '../../lib/api'
import { ideaStatusConfig, localToday, getLocale } from '../../lib/utils'
import type { Idea, IdeaStatus } from '../../types'

const commonTags = ['LinkedIn', 'Instagram', 'Video', 'Diseno', 'SEO', 'Email', 'Contenido', 'Estrategia', 'Branding', 'Campana']

function IdeaCardContent({ idea, onUpdate, onDelete, isOwn, onOpenDetail, onStartEdit, isDragging, t, statusColumns }: {
  idea: Idea
  onUpdate: (id: string, data: Partial<Idea>) => void
  onDelete: (id: string) => void
  isOwn: boolean
  onOpenDetail?: (idea: Idea) => void
  onStartEdit?: (idea: Idea) => void
  isDragging?: boolean
  t: (key: string) => string
  statusColumns: { key: IdeaStatus; label: string; icon: ReactNode }[]
}) {
  const cfg = ideaStatusConfig[idea.status]
  return (
    <div
      className={`glass-card p-4 group cursor-pointer ${isDragging ? 'opacity-30' : ''}`}
      onClick={() => onOpenDetail?.(idea)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{idea.emoji || '\ud83d\udca1'}</span>
          {!isOwn && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 flex items-center gap-1">
              <Users size={10} /> {t('common:sharing.fromTeam')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOwn && onStartEdit && (
            <button onClick={(e) => { e.stopPropagation(); onStartEdit(idea) }} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all">
              <Pencil size={14} />
            </button>
          )}
          {isOwn && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(idea.id) }} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all">
              <X size={14} />
            </button>
          )}
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
        {isOwn ? (
          <select
            value={idea.status}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); onUpdate(idea.id, { status: e.target.value as IdeaStatus }) }}
            className="bg-transparent text-xs outline-none cursor-pointer"
            style={{ color: cfg.color }}
          >
            {statusColumns.map(s => <option key={s.key} value={s.key} className="bg-ink-800">{s.label}</option>)}
          </select>
        ) : (
          <span className="text-xs font-medium" style={{ color: cfg.color }}>{statusColumns.find(s => s.key === idea.status)?.label}</span>
        )}
        {(idea.notesCount ?? 0) > 0 && (
          <span className="min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-crimson-500 text-white text-[9px] font-bold rounded-full">
            {idea.notesCount}
          </span>
        )}
      </div>
    </div>
  )
}

function DraggableIdeaCard({ idea, onUpdate, onDelete, isOwn, onOpenDetail, onStartEdit, t, statusColumns }: {
  idea: Idea
  onUpdate: (id: string, data: Partial<Idea>) => void
  onDelete: (id: string) => void
  isOwn: boolean
  onOpenDetail?: (idea: Idea) => void
  onStartEdit?: (idea: Idea) => void
  t: (key: string) => string
  statusColumns: { key: IdeaStatus; label: string; icon: ReactNode }[]
}) {
  const canDrag = isOwn
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: idea.id,
    disabled: !canDrag,
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div ref={setNodeRef} style={style} {...(canDrag ? { ...listeners, ...attributes } : {})} className={canDrag ? 'cursor-grab active:cursor-grabbing' : ''}>
      <IdeaCardContent
        idea={idea}
        onUpdate={onUpdate}
        onDelete={onDelete}
        isOwn={isOwn}
        onOpenDetail={onOpenDetail}
        onStartEdit={onStartEdit}
        isDragging={isDragging}
        t={t}
        statusColumns={statusColumns}
      />
    </div>
  )
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] rounded-xl transition-all duration-200 ${isOver ? 'bg-ink-800/50 ring-1 ring-ink-600' : ''}`}
    >
      {children}
    </div>
  )
}

export default function ClientIdeas() {
  const { t } = useTranslation(['client', 'common'])
  const { user } = useAuthStore()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [shared, setShared] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Idea | null>(null)
  const [detailIdea, setDetailIdea] = useState<Idea | null>(null)
  const [detailNotes, setDetailNotes] = useState<ItemNote[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', emoji: '\ud83d\udca1', tags: [] as string[], customTag: '',
  })

  const statusColumns: { key: IdeaStatus; label: string; icon: ReactNode }[] = [
    { key: 'brainstorm',  label: t('client:ideas.brainstorm'),   icon: <Zap size={18} /> },
    { key: 'developing',  label: t('client:ideas.developing'),   icon: <Wrench size={18} /> },
    { key: 'ready',       label: t('client:ideas.ready'),        icon: <CheckCircle size={18} /> },
    { key: 'implemented', label: t('client:ideas.implemented'),  icon: <Rocket size={18} /> },
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const resetForm = () => {
    setForm({ title: '', description: '', emoji: '\ud83d\udca1', tags: [], customTag: '' })
    setShared(false)
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
      emoji: idea.emoji || '\ud83d\udca1',
      tags: idea.tags || [],
      customTag: '',
    })
    setShared(!!idea.shared)
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
        createdAt: localToday(),
        shared,
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
        shared,
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

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }))
  }

  const isOwn = (idea: Idea) => idea.createdBy === user?.id

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over) return

    const ideaId = active.id as string
    const newStatus = over.id as IdeaStatus
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea || idea.status === newStatus) return

    // Only allow own ideas to be moved
    if (!isOwn(idea)) return

    await handleUpdate(ideaId, { status: newStatus })
  }

  const activeDragIdea = activeDragId ? ideas.find(i => i.id === activeDragId) : null

  const emojis = ['\ud83d\udca1', '\ud83c\udfac', '\ud83d\udcc8', '\ud83d\udce7', '\ud83c\udfa8', '\ud83d\ude80', '\u2728', '\ud83c\udfaf', '\ud83d\udcf1', '\ud83d\udd25']

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
          <h2 className="section-title">{t('client:ideas.title')}</h2>
          <p className="text-ink-300 text-sm mt-1">{t('client:ideas.subtitle', { count: ideas.length })}</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => { resetForm(); setEditingIdea(null); setShowModal(true) }} className="btn-primary">
          <Sparkles size={16} /> {t('client:ideas.newIdea')}
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

      {/* Kanban with DnD */}
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
                  <div className="max-h-[520px] overflow-y-auto space-y-3 pr-1 thin-scrollbar">
                    {items.map(idea => (
                      <DraggableIdeaCard key={idea.id} idea={idea} onUpdate={handleUpdate} onDelete={(id) => { const i = ideas.find(x => x.id === id); if (i) setConfirmDelete(i); }} isOwn={isOwn(idea)} onOpenDetail={openDetail} onStartEdit={openEdit} t={t} statusColumns={statusColumns} />
                    ))}
                    {items.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-ink-500">
                        <Lightbulb size={24} className="mb-2 opacity-30" />
                        <p className="text-xs">{t('client:ideas.noIdeasHere')}</p>
                      </div>
                    )}
                  </div>
                </DroppableColumn>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeDragIdea ? (
            <div className="w-[280px]">
              <IdeaCardContent
                idea={activeDragIdea}
                onUpdate={() => {}}
                onDelete={() => {}}
                isOwn={isOwn(activeDragIdea)}
                t={t}
                statusColumns={statusColumns}
              />
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
                    {isOwn(detailIdea) && (
                      <button onClick={() => { openEdit(detailIdea); setDetailIdea(null) }}
                        className="text-ink-400 hover:text-crimson-400 transition-all"><Pencil size={16} /></button>
                    )}
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
                          style={{ background: note.author_id === user?.id ? '#DC143C30' : 'rgb(var(--ink-700))', color: note.author_id === user?.id ? '#DC143C' : 'rgb(var(--ink-300))' }}>
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
                                <button onClick={() => handleEditNote(note.id)} className="text-xs text-crimson-400">{t('common:notes.save')}</button>
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
                    className="px-3 py-2 bg-crimson-700 hover:bg-crimson-600 disabled:opacity-30 text-white rounded-xl transition-all">
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
                <h3 className="font-bold text-white text-lg">{editingIdea ? t('client:ideas.editIdea') : t('client:ideas.newIdea')}</h3>
                <button onClick={closeModal} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                {/* Emoji picker */}
                <div>
                  <p className="text-xs text-ink-300 mb-2">{t('client:ideas.chooseEmoji')}</p>
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
                  placeholder={t('client:ideas.ideaTitlePlaceholder')}
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input-dark text-sm"
                />
                <textarea
                  placeholder={t('client:ideas.ideaDescPlaceholder')}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="input-dark text-sm resize-none"
                />
                <div>
                  <p className="text-xs text-ink-300 mb-2">{t('client:ideas.tags')}</p>
                  <div className="flex flex-wrap gap-2">
                    {commonTags.map(tg => (
                      <button
                        key={tg}
                        onClick={() => toggleTag(tg)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          form.tags.includes(tg)
                            ? 'border-crimson-500 bg-crimson-700/20 text-crimson-300'
                            : 'border-white/10 text-ink-300 hover:border-white/20'
                        }`}
                      >
                        {tg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Share toggle */}
                <div
                  className="flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all hover:bg-white/[0.03]"
                  style={{ backgroundColor: 'rgb(var(--ink-700) / 0.3)', border: '1px solid rgb(var(--ink-600) / 0.4)' }}
                  onClick={() => setShared(!shared)}
                >
                  <div className="flex items-center gap-3">
                    <Share2 size={16} style={{ color: shared ? '#34D399' : 'rgb(var(--ink-400))' }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>
                        {t('client:ideas.shareWithAdmin')}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>
                        {shared ? t('client:ideas.shareOnDesc') : t('client:ideas.shareOffDesc')}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${shared ? 'bg-emerald-500' : 'bg-ink-600'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${shared ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={closeModal} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
                <button onClick={editingIdea ? handleEditSubmit : handleAdd} className="btn-primary flex-1 justify-center">
                  <Sparkles size={15} /> {editingIdea ? t('common:common.saveChanges') : t('client:ideas.addIdea')}
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-ink-900 border border-ink-700 rounded-2xl p-6 max-w-sm mx-4"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{t('client:ideas.deleteIdea')}</h3>
                <p className="text-ink-400 text-sm mb-6">{t('client:ideas.deleteWarning')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-4 py-2 bg-ink-700 text-ink-300 rounded-xl hover:bg-ink-600 transition-colors"
                  >
                    {t('common:common.cancel')}
                  </button>
                  <button
                    onClick={async () => {
                      await handleDelete(confirmDelete.id)
                      setConfirmDelete(null)
                    }}
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
