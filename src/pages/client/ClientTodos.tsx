import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Trash2, Calendar, Loader2, Share2, Users, MessageSquare, Pencil, Clock, Wrench, CheckCircle2, AlertTriangle, Paperclip, FileText, Download, Eye, Send } from 'lucide-react'
import { DndContext, DragOverlay, closestCenter, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import T from '../../components/TranslatedText'
import CreatorBadge from '../../components/CreatorBadge'
import { useAuthStore } from '../../store/useAuthStore'
import { getTodos, createTodo as createTodoApi, deleteTodo as deleteTodoApi, updateTodo as updateTodoApi, updateTodoStatus, getTodoNotes, addTodoNoteMsg, markTodoNotesRead, editTodoNote, deleteTodoNote, getTodoAttachments, getCalendarUsers } from '../../lib/api'
import type { ItemNote, TodoAttachment, CalendarUser } from '../../lib/api'
import { priorityConfig, localToday, getLocale } from '../../lib/utils'
import type { Priority, TodoItem } from '../../types'

const categoryKeys: Record<string, string> = {
  'Contenido': 'categories.content',
  'Diseño': 'categories.design',
  'Ventas': 'categories.sales',
  'Reportes': 'categories.reports',
  'Estrategia': 'categories.strategy',
  'Admin': 'categories.admin',
  'Otro': 'categories.other',
}
const categories = Object.keys(categoryKeys)

function TodoCardContent({
  todo,
  isOwn,
  onOpenDetail,
  onStartEdit,
  onDelete,
  isDragging,
  t,
}: {
  todo: TodoItem
  isOwn: boolean
  onOpenDetail?: (todo: TodoItem) => void
  onStartEdit?: (todo: TodoItem) => void
  onDelete: (id: string) => void
  isDragging?: boolean
  t: (key: string) => string
}) {
  const cfg = priorityConfig[todo.priority]
  return (
    <div
      onClick={() => onOpenDetail?.(todo)}
      className={`group rounded-xl border transition-all duration-200 cursor-pointer
        ${isDragging ? 'opacity-30' : ''}
        ${todo.status === 'done'
          ? 'bg-ink-800/20 border-white/5 opacity-50'
          : 'bg-ink-800/50 border-white/5 hover:border-white/10'
        }`}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${todo.status === 'done' ? 'line-through text-ink-400' : 'text-white'}`}>
              <T text={todo.title} />
            </p>
            {!isOwn && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 flex items-center gap-1 flex-shrink-0">
                <Users size={10} /> {t('common:sharing.fromTeam')}
              </span>
            )}
          </div>
          {todo.description && (
            <p className="text-xs text-ink-400 mt-0.5 line-clamp-2"><T text={todo.description} translatable /></p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: cfg.color, background: cfg.bg }}>
              {t(`common:priority.${todo.priority}`)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-300"><T text={todo.category} /></span>
            {todo.startTime && (
              <span className="text-xs text-ink-400 flex items-center gap-1">
                <Clock size={10} />
                {new Date(todo.startTime).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })}
              </span>
            )}
            {(todo.notesCount ?? 0) > 0 && (
              <span className="min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full" style={{ backgroundColor: 'rgb(var(--accent))', color: 'var(--accent-text)' }}>
                {todo.notesCount}
              </span>
            )}
            {todo.createdByName && (
              <CreatorBadge name={todo.createdByName} avatar={todo.createdByAvatar} size="sm" variant="compact" className="ml-auto" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isOwn && onStartEdit && (
            <button onClick={(e) => { e.stopPropagation(); onStartEdit(todo) }} className="opacity-0 group-hover:opacity-100 text-ink-400 transition-all hover:text-[var(--accent-light)]">
              <Pencil size={14} />
            </button>
          )}
          {isOwn && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(todo.id) }} className="opacity-0 group-hover:opacity-100 text-ink-400 transition-all hover:text-[var(--accent-light)]">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DraggableTodoCard({
  todo,
  onDelete,
  isOwn,
  onOpenDetail,
  onStartEdit,
  t,
}: {
  todo: TodoItem
  onDelete: (id: string) => void
  isOwn: boolean
  onOpenDetail?: (todo: TodoItem) => void
  onStartEdit?: (todo: TodoItem) => void
  t: (key: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: todo.id,
    disabled: !isOwn,
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div ref={setNodeRef} style={style} {...(isOwn ? { ...listeners, ...attributes } : {})} className={isOwn ? 'cursor-grab active:cursor-grabbing' : ''}>
      <TodoCardContent
        todo={todo}
        isOwn={isOwn}
        onOpenDetail={onOpenDetail}
        onStartEdit={onStartEdit}
        onDelete={onDelete}
        isDragging={isDragging}
        t={t}
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

export default function ClientTodos() {
  const { t } = useTranslation(['client', 'common', 'admin'])
  const { user } = useAuthStore()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [shared, setShared] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<TodoItem | null>(null)
  const [detailTodo, setDetailTodo] = useState<TodoItem | null>(null)
  const [detailNotes, setDetailNotes] = useState<ItemNote[]>([])
  const [detailAttachments, setDetailAttachments] = useState<TodoAttachment[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<CalendarUser[]>([])
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as Priority,
    category: 'Contenido', startTime: '', endTime: '',
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const weekOf = localToday()

  const resetForm = () => {
    setForm({ title: '', description: '', priority: 'medium', category: 'Contenido', startTime: '', endTime: '' })
    setShared(false)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTodo(null)
    resetForm()
  }

  const openEdit = (todo: TodoItem) => {
    setForm({
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority,
      category: todo.category,
      startTime: todo.startTime || '',
      endTime: todo.endTime || '',
    })
    setShared(!!todo.shared)
    setEditingTodo(todo)
    setShowModal(true)
  }

  useEffect(() => {
    getTodos()
      .then(setTodos)
      .catch(err => console.error('Error fetching todos:', err))
      .finally(() => setLoading(false))
    getCalendarUsers().then(setAllUsers).catch(() => {})
  }, [])

  const handleAdd = async () => {
    if (!form.title) return
    try {
      const newTodo = await createTodoApi({
        title: form.title,
        description: form.description,
        priority: form.priority,
        category: form.category,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        done: false,
        status: 'pending',
        weekOf,
        shared,
      })
      setTodos(prev => [newTodo, ...prev])
      closeModal()
    } catch (err) {
      console.error('Error creating todo:', err)
    }
  }

  const handleEditSubmit = async () => {
    if (!editingTodo || !form.title) return
    try {
      const updated = await updateTodoApi(editingTodo.id, {
        ...editingTodo,
        title: form.title,
        description: form.description,
        priority: form.priority,
        category: form.category,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        shared,
      })
      setTodos(prev => prev.map(t => t.id === editingTodo.id ? updated : t))
      closeModal()
    } catch (err) {
      console.error('Error updating todo:', err)
    }
  }

  const handleStatusChange = async (id: string, status: 'pending' | 'in_progress' | 'done') => {
    try {
      const updated = await updateTodoStatus(id, status)
      setTodos(prev => prev.map(t => t.id === id ? updated : t))
    } catch (err) {
      console.error('Error updating todo status:', err)
    }
  }

  const handleDeleteRequest = (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (todo) setConfirmDelete(todo)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTodoApi(id)
      setTodos(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('Error deleting todo:', err)
    }
  }

  const openDetail = async (todo: TodoItem) => {
    setDetailTodo(todo)
    setDetailLoading(true)
    setNewNoteContent('')
    setEditingNoteId(null)
    try {
      const [atts, notes] = await Promise.all([getTodoAttachments(todo.id), getTodoNotes(todo.id)])
      setDetailAttachments(atts)
      setDetailNotes(notes)
      markTodoNotesRead(todo.id)
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, notesCount: 0 } : t))
    } catch { setDetailAttachments([]); setDetailNotes([]) }
    finally { setDetailLoading(false) }
  }

  const handleSendNote = async () => {
    if (!detailTodo || !newNoteContent.trim()) return
    try {
      const note = await addTodoNoteMsg(detailTodo.id, newNoteContent.trim())
      setDetailNotes(prev => [...prev, note])
      setNewNoteContent('')
    } catch { /* silent */ }
  }

  const handleEditNote = async (noteId: string) => {
    if (!detailTodo || !editNoteContent.trim()) return
    try {
      const updated = await editTodoNote(detailTodo.id, noteId, editNoteContent.trim())
      setDetailNotes(prev => prev.map(n => n.id === noteId ? updated : n))
      setEditingNoteId(null)
    } catch { /* silent */ }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!detailTodo) return
    try {
      await deleteTodoNote(detailTodo.id, noteId)
      setDetailNotes(prev => prev.filter(n => n.id !== noteId))
    } catch { /* silent */ }
  }

  const isOwn = (todo: TodoItem) => todo.createdBy === user?.id

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over) return

    const todoId = active.id as string
    const newStatus = over.id as 'pending' | 'in_progress' | 'done'
    const todo = todos.find(t => t.id === todoId)
    if (!todo || todo.status === newStatus) return

    await handleStatusChange(todoId, newStatus)
  }

  const activeDragTodo = activeDragId ? todos.find(t => t.id === activeDragId) : null

  const filtered = todos.filter(t => !filterCat || t.category === filterCat)
  const pending = filtered.filter(t => t.status === 'pending')
  const inProgress = filtered.filter(t => t.status === 'in_progress')
  const done = filtered.filter(t => t.status === 'done')
  const progress = todos.length > 0 ? Math.round((todos.filter(t => t.status === 'done').length / todos.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgb(var(--accent))' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="section-title">{t('client:todos.title')}</h2>
          <p className="text-ink-300 text-sm mt-1">
            {t('client:todos.completedCount', { done: todos.filter(t => t.status === 'done').length, total: todos.length })}
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => { resetForm(); setEditingTodo(null); setShowModal(true) }} className="btn-primary">
          <Plus size={16} /> {t('client:todos.newTask')}
        </motion.button>
      </div>

      {/* Progress */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-white">{t('client:todos.yourProgress')}</p>
            <p className="text-xs text-ink-300 mt-0.5">
              {new Date().toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{progress}%</p>
            <p className="text-xs text-ink-400">{t('client:todos.completed')}</p>
          </div>
        </div>
        <div className="w-full h-2 bg-ink-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full relative"
            style={{ background: `linear-gradient(90deg, rgb(var(--accent)), var(--accent-light))` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white" style={{ boxShadow: '0 0 8px rgb(var(--accent))' }} />
          </motion.div>
        </div>

        {/* Priority breakdown */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {(['high', 'medium', 'low'] as Priority[]).map(p => {
            const cfg = priorityConfig[p]
            const count = todos.filter(td => td.priority === p && td.status !== 'done').length
            return (
              <div key={p} className="p-3 rounded-xl bg-ink-800/50 text-center">
                <p className="text-lg font-bold" style={{ color: cfg.color }}>{count}</p>
                <p className="text-xs text-ink-400">{t(`common:priority.${p}`)} {t('client:todos.prioritySuffix')}</p>
              </div>
            )
          })}
          <div className="p-3 rounded-xl bg-ink-800/50 text-center">
            <p className="text-lg font-bold text-green-400">{todos.filter(t => t.status === 'done').length}</p>
            <p className="text-xs text-ink-400">{t('client:todos.completedLabel')}</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${!filterCat ? 'border-white/10 text-ink-300' : 'border-white/10 text-ink-300'}`}
          style={!filterCat ? { borderColor: 'var(--accent-light)', backgroundColor: 'rgb(var(--accent) / 0.2)', color: 'var(--accent-light)' } : {}}
        >
          {t('client:todos.allFilter')}
        </button>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(filterCat === c ? null : c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterCat === c ? '' : 'border-white/10 text-ink-300'}`}
            style={filterCat === c ? { borderColor: 'var(--accent-light)', backgroundColor: 'rgb(var(--accent) / 0.2)', color: 'var(--accent-light)' } : {}}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Tasks - 3 columns with DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pendientes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-amber-400" />
              <h3 className="font-semibold text-amber-400">{t('client:todos.pending')}</h3>
              <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full ml-auto">{pending.length}</span>
            </div>
            <DroppableColumn id="pending">
              <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 thin-scrollbar">
                {pending
                  .sort((a, b) => {
                    const order = { high: 0, medium: 1, low: 2 }
                    return order[a.priority] - order[b.priority]
                  })
                  .map(todo => (
                    <DraggableTodoCard key={todo.id} todo={todo} onDelete={handleDeleteRequest} isOwn={isOwn(todo)} onOpenDetail={openDetail} onStartEdit={openEdit} t={t} />
                  ))}
                {pending.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                    <Check size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">{t('client:todos.allCaughtUp')}</p>
                  </div>
                )}
              </div>
            </DroppableColumn>
          </div>

          {/* Desarrollando */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={16} className="text-blue-400" />
              <h3 className="font-semibold text-blue-400">{t('client:todos.developing')}</h3>
              <span className="text-xs bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded-full ml-auto">{inProgress.length}</span>
            </div>
            <DroppableColumn id="in_progress">
              <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 thin-scrollbar">
                {inProgress
                  .sort((a, b) => {
                    const order = { high: 0, medium: 1, low: 2 }
                    return order[a.priority] - order[b.priority]
                  })
                  .map(todo => (
                    <DraggableTodoCard key={todo.id} todo={todo} onDelete={handleDeleteRequest} isOwn={isOwn(todo)} onOpenDetail={openDetail} onStartEdit={openEdit} t={t} />
                  ))}
                {inProgress.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                    <Wrench size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">{t('client:todos.nothingInProgress')}</p>
                  </div>
                )}
              </div>
            </DroppableColumn>
          </div>

          {/* Completadas */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h3 className="font-semibold text-emerald-400">{t('client:todos.completedLabel')}</h3>
              <span className="text-xs bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded-full ml-auto">{done.length}</span>
            </div>
            <DroppableColumn id="done">
              <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 thin-scrollbar">
                {done.map(todo => (
                  <DraggableTodoCard key={todo.id} todo={todo} onDelete={handleDeleteRequest} isOwn={isOwn(todo)} onOpenDetail={openDetail} onStartEdit={openEdit} t={t} />
                ))}
                {done.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                    <Calendar size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">{t('client:todos.noneCompleted')}</p>
                  </div>
                )}
              </div>
            </DroppableColumn>
          </div>
        </div>

        <DragOverlay>
          {activeDragTodo ? (
            <div className="w-[320px]">
              <TodoCardContent
                todo={activeDragTodo}
                isOwn={isOwn(activeDragTodo)}
                onDelete={() => {}}
                t={t}
              />
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
                <h3 className="font-bold text-white text-lg">{editingTodo ? t('client:todos.editTask') : t('client:todos.newTask')}</h3>
                <button onClick={closeModal} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={t('client:todos.taskTitlePlaceholder')}
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input-dark text-sm"
                />
                <textarea
                  placeholder={t('client:todos.taskDescPlaceholder')}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="input-dark text-sm resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('client:todos.startDateTime')}</p>
                    <input
                      type="datetime-local"
                      value={form.startTime}
                      onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="bg-ink-800 border border-ink-600 text-white rounded-xl text-sm w-full px-3 py-2"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('client:todos.endDateTime')}</p>
                    <input
                      type="datetime-local"
                      value={form.endTime}
                      onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="bg-ink-800 border border-ink-600 text-white rounded-xl text-sm w-full px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('client:todos.priorityLabel')}</p>
                    <div className="flex flex-col gap-1.5">
                      {(['high', 'medium', 'low'] as Priority[]).map(p => {
                        const cfg = priorityConfig[p]
                        return (
                          <button
                            key={p}
                            onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-all border
                              ${form.priority === p ? 'border-current' : 'border-transparent bg-ink-700/50'}`}
                            style={form.priority === p ? { color: cfg.color, background: cfg.bg, borderColor: cfg.color } : {}}
                          >
                            {t(`common:priority.${p}`)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('client:todos.categoryLabel')}</p>
                    <select
                      value={form.category}
                      onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                      className="input-dark text-sm"
                    >
                      {categories.map(c => <option key={c} value={c} className="bg-ink-800">{c}</option>)}
                    </select>
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
                        {t('client:todos.shareWithAdmin')}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>
                        {shared ? t('client:todos.shareOnDesc') : t('client:todos.shareOffDesc')}
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
                <button onClick={editingTodo ? handleEditSubmit : handleAdd} className="btn-primary flex-1 justify-center">
                  {editingTodo ? t('common:common.saveChanges') : t('client:todos.addTask')}
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
                <h3 className="text-lg font-semibold text-white mb-2">{t('client:todos.deleteConfirmTitle')}</h3>
                <p className="text-ink-400 text-sm mb-6">{t('client:todos.deleteConfirmMessage')}</p>
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

      {/* Detail Modal */}
      <AnimatePresence>
        {detailTodo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={() => { setDetailTodo(null); setDetailNotes([]); setNewNoteContent(''); setEditingNoteId(null) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto thin-scrollbar"
              onMouseDown={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-white">{detailTodo.title}</h3>
                <div className="flex items-center gap-2">
                  {isOwn(detailTodo) && (
                    <button onClick={() => { openEdit(detailTodo); setDetailTodo(null); setDetailNotes([]); setNewNoteContent(''); setEditingNoteId(null) }}
                      className="text-ink-400 transition-all hover:text-[var(--accent-light)]"><Pencil size={16} /></button>
                  )}
                  <button onClick={() => { setDetailTodo(null); setDetailNotes([]); setNewNoteContent(''); setEditingNoteId(null) }} className="text-ink-400 hover:text-white"><X size={18} /></button>
                </div>
              </div>

              {/* Creator */}
              {detailTodo.createdByName && (
                <div className="flex items-center gap-2 mb-4 text-xs text-ink-400">
                  <span>{t('common:common.createdBy')}:</span>
                  <CreatorBadge name={detailTodo.createdByName} avatar={detailTodo.createdByAvatar} size="md" variant="full" />
                </div>
              )}

              {/* Description */}
              {detailTodo.description && (
                <p className="text-sm text-ink-200 mb-4 leading-relaxed">{detailTodo.description}</p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ color: priorityConfig[detailTodo.priority].color, background: priorityConfig[detailTodo.priority].bg }}>
                  {t(`common:priority.${detailTodo.priority}`)}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-ink-300">
                  {categoryKeys[detailTodo.category] ? t(`common:${categoryKeys[detailTodo.category]}`) : detailTodo.category}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  detailTodo.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' :
                  detailTodo.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {detailTodo.status === 'done' ? t('client:todos.completedLabel') :
                   detailTodo.status === 'in_progress' ? t('client:todos.developing') :
                   t('client:todos.pending')}
                </span>
              </div>

              {/* Time info */}
              {detailTodo.startTime && (
                <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{ backgroundColor: 'rgb(var(--ink-700) / 0.3)' }}>
                  <Calendar size={16} style={{ color: 'var(--accent-light)' }} />
                  <div>
                    <p className="text-sm text-white font-medium">
                      {new Date(detailTodo.startTime).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-ink-300 mt-0.5">
                      {new Date(detailTodo.startTime).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}
                      {detailTodo.endTime && ` — ${new Date(detailTodo.endTime).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Assigned user */}
              {detailTodo.assignedTo && (() => {
                const assignee = allUsers.find(u => u.id === detailTodo.assignedTo)
                return assignee ? (
                  <div className="flex items-center gap-2 text-xs text-ink-300 mb-5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgb(var(--accent) / 0.2)', color: 'var(--accent-light)' }}>
                      {assignee.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{t('admin:todo.assignedTo')}: <strong className="text-white">{assignee.name}</strong></span>
                  </div>
                ) : null
              })()}

              {/* Attachments section */}
              <div className="border-t border-white/5 pt-4">
                <p className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                  <Paperclip size={14} /> {t('common:notes.attachments', { defaultValue: 'Attachments' })} ({detailAttachments.length})
                </p>

                {detailLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-ink-400" /></div>
                ) : detailAttachments.length === 0 ? (
                  <p className="text-xs text-ink-400 text-center py-4">{t('common:notes.noAttachments', { defaultValue: 'No attachments' })}</p>
                ) : (
                  <div className="space-y-2">
                    {detailAttachments.filter(a => a.mime_type.startsWith('image/')).length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {detailAttachments.filter(a => a.mime_type.startsWith('image/')).map(att => (
                          <div key={att.id} className="group/att relative rounded-xl overflow-hidden border border-white/5">
                            <img src={att.url} alt={att.original_name} className="w-full h-28 object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/att:opacity-100 transition-all flex items-center justify-center">
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"><Eye size={14} /></a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {detailAttachments.filter(a => !a.mime_type.startsWith('image/')).map(att => (
                      <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-800/50 border border-white/5 group/att">
                        <FileText size={16} className="text-ink-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{att.original_name}</p>
                          <p className="text-[10px] text-ink-400">{(att.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-ink-400 hover:text-white transition-all"><Download size={14} /></a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments section */}
              <div className="border-t border-white/5 pt-4 mt-2">
                <p className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                  <MessageSquare size={14} /> {t('common:notes.comments', { defaultValue: 'Comments' })} ({detailNotes.length})
                </p>

                <div className="max-h-[300px] overflow-y-auto thin-scrollbar space-y-3 mb-3">
                  {detailNotes.length === 0 ? (
                    <p className="text-xs text-ink-400 text-center py-4">{t('common:notes.noNotes')}</p>
                  ) : (
                    detailNotes.map(note => (
                      <div key={note.id} className="flex gap-3 group/note">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
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
                                <button onClick={() => setEditingNoteId(null)} className="text-xs text-ink-400 hover:text-ink-200">{t('common:notes.cancel')}</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-ink-200 mt-0.5 leading-relaxed">{note.content}</p>
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

                {/* New comment input */}
                <div className="flex gap-2">
                  <input type="text" placeholder={t('common:notes.placeholder')}
                    value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newNoteContent.trim()) handleSendNote() }}
                    className="input-dark text-sm flex-1" />
                  <button onClick={handleSendNote} disabled={!newNoteContent.trim()}
                    className="px-3 py-2 disabled:opacity-30 rounded-xl transition-all" style={{ backgroundColor: 'rgb(var(--accent))', color: 'var(--accent-text)' }}>
                    <Send size={14} />
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
