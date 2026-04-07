import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Trash2, Calendar, Loader2, MessageSquare, Pencil, Clock, Wrench, CheckCircle2, AlertTriangle } from 'lucide-react'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { getTodos, createTodo as createTodoApi, toggleTodo as toggleTodoApi, deleteTodo as deleteTodoApi, updateTodo as updateTodoApi, updateTodoStatus as updateTodoStatusApi, getTodoNotes, addTodoNoteMsg, getCalendarUsers } from '../lib/api'
import type { ItemNote, CalendarUser } from '../lib/api'
import { priorityConfig } from '../lib/utils'
import type { Priority, TodoItem } from '../types'
import NotesPanel from '../components/NotesPanel'
import { useTranslation } from 'react-i18next'
import T from '../components/TranslatedText'

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

function TodoCard({
  todo,
  onToggle,
  onDelete,
  clientLabel,
  onOpenNotes,
  onStartEdit,
  column,
  isOverlay,
}: {
  todo: TodoItem
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  clientLabel?: string
  onOpenNotes?: (todo: TodoItem) => void
  onStartEdit?: (todo: TodoItem) => void
  column: 'pending' | 'in_progress' | 'done'
  isOverlay?: boolean
}) {
  const { t } = useTranslation(['admin', 'common'])
  const cfg = priorityConfig[todo.priority]
  const isDone = column === 'done'
  return (
    <div
      className={`group rounded-xl border transition-all duration-200
        ${isDone
          ? 'bg-ink-800/20 border-white/5 opacity-50'
          : 'bg-ink-800/50 border-white/5 hover:border-white/10'
        }
        ${isOverlay ? 'shadow-2xl shadow-crimson-700/20 ring-1 ring-crimson-500/30 scale-[1.02]' : ''}`}
    >
      <div className="flex items-start gap-3 p-3.5">
        <button
          onClick={() => onToggle(todo.id)}
          className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
            ${isDone ? 'bg-crimson-700 border-crimson-700' : 'border-ink-500 hover:border-crimson-500'}`}
        >
          {isDone && <Check size={11} className="text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${isDone ? 'line-through text-ink-400' : 'text-white'}`}>
              <T text={todo.title} />
            </p>
            {clientLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-crimson-500/10 text-crimson-400 flex-shrink-0">
                {t('admin:todo.fromClient', { clientName: clientLabel })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-300">{categoryKeys[todo.category] ? t(`common:${categoryKeys[todo.category]}`) : todo.category}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenNotes?.(todo) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-crimson-400 hover:bg-crimson-700/20 transition-all"
            >
              <MessageSquare size={13} />
              {t('admin:todo.notes')}
              {(todo.notesCount ?? 0) > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-crimson-500 text-white text-[10px] font-bold rounded-full">
                  {todo.notesCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!clientLabel && onStartEdit && (
            <button onClick={() => onStartEdit(todo)} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all">
              <Pencil size={14} />
            </button>
          )}
          <button onClick={() => onDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[200px] p-2 rounded-xl transition-all duration-200 ${
        isOver ? 'bg-ink-700/40 ring-1 ring-ink-500/50' : ''
      }`}
    >
      {children}
    </div>
  )
}

function DraggableTodoCard({ todo, ...cardProps }: { todo: TodoItem } & Omit<Parameters<typeof TodoCard>[0], 'todo'>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: todo.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-30 z-10' : ''}`}
    >
      <TodoCard todo={todo} {...cardProps} />
    </div>
  )
}

export default function TodoSemanal() {
  const { t } = useTranslation(['admin', 'common'])
  const { clients } = useStore()
  const { user } = useAuthStore()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [notesItem, setNotesItem] = useState<TodoItem | null>(null)
  const [notes, setNotes] = useState<ItemNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<TodoItem | null>(null)
  const [allUsers, setAllUsers] = useState<CalendarUser[]>([])
  const [activeTodo, setActiveTodo] = useState<TodoItem | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as Priority,
    category: 'Contenido', clientId: '',
    startTime: '', endTime: '', assignedTo: '',
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const todo = todos.find(t => t.id === event.active.id)
    setActiveTodo(todo || null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTodo(null)
    const { active, over } = event
    if (!over) return
    const todoId = active.id as string
    const newStatus = over.id as 'pending' | 'in_progress' | 'done'
    // If dropped on another card (not a column), ignore
    if (!['pending', 'in_progress', 'done'].includes(newStatus)) return
    const todo = todos.find(t => t.id === todoId)
    if (!todo || todo.status === newStatus) return
    // Optimistic update
    setTodos(prev => prev.map(t => t.id === todoId ? { ...t, status: newStatus, done: newStatus === 'done' } : t))
    try {
      await updateTodoStatusApi(todoId, newStatus)
    } catch {
      // Revert on error - reload
      getTodos().then(setTodos).catch(() => {})
    }
  }

  const weekOf = new Date().toISOString().split('T')[0]

  const resetForm = () => {
    setForm({ title: '', description: '', priority: 'medium', category: 'Contenido', clientId: '', startTime: '', endTime: '', assignedTo: '' })
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
      clientId: todo.clientId || '',
      startTime: todo.startTime || '',
      endTime: todo.endTime || '',
      assignedTo: todo.assignedTo || '',
    })
    setEditingTodo(todo)
    setShowModal(true)
  }

  useEffect(() => {
    getTodos()
      .then(setTodos)
      .catch(err => console.error('Error fetching todos:', err))
      .finally(() => setLoading(false))
    getCalendarUsers()
      .then(setAllUsers)
      .catch(err => console.error('Error fetching users:', err))
  }, [])

  const handleAdd = async () => {
    if (!form.title) return
    try {
      const newTodo = await createTodoApi({
        title: form.title,
        description: form.description,
        priority: form.priority,
        category: form.category,
        clientId: form.clientId || undefined,
        done: false,
        weekOf,
        status: 'pending',
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        assignedTo: form.assignedTo || undefined,
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
        clientId: form.clientId || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        assignedTo: form.assignedTo || undefined,
      })
      setTodos(prev => prev.map(t => t.id === editingTodo.id ? updated : t))
      closeModal()
    } catch (err) {
      console.error('Error updating todo:', err)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      const updated = await toggleTodoApi(id)
      setTodos(prev => prev.map(t => t.id === id ? updated : t))
    } catch (err) {
      console.error('Error toggling todo:', err)
    }
  }

  const handleDeleteRequest = (todo: TodoItem) => {
    setConfirmDelete(todo)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTodoApi(id)
      setTodos(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('Error deleting todo:', err)
    }
  }

  const openNotes = async (item: TodoItem) => {
    setNotesItem(item)
    setTodos(prev => prev.map(t => t.id === item.id ? { ...t, notesCount: 0 } : t))
    setNotesLoading(true)
    try {
      const data = await getTodoNotes(item.id)
      setNotes(data)
    } catch (err) {
      console.error('Error fetching notes:', err)
    } finally {
      setNotesLoading(false)
    }
  }

  const handleSendNote = async (content: string) => {
    if (!notesItem) return
    try {
      const newNote = await addTodoNoteMsg(notesItem.id, content)
      setNotes(prev => [...prev, newNote])
    } catch (err) {
      console.error('Error sending note:', err)
    }
  }

  const getClientLabel = (todo: TodoItem) => {
    if (!todo.createdBy || !todo.clientId) return undefined
    if (todo.createdBy.startsWith('u_client')) {
      const c = clients.find(cl => cl.id === todo.clientId)
      return c?.company || undefined
    }
    return undefined
  }

  const filtered = todos.filter(t => !filterCat || t.category === filterCat)
  const pending = filtered.filter(t => t.status === 'pending')
  const inProgress = filtered.filter(t => t.status === 'in_progress')
  const done = filtered.filter(t => t.status === 'done')
  const totalCount = todos.length
  const doneCount = todos.filter(t => t.status === 'done').length
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length
  const pendingCount = todos.filter(t => t.status === 'pending').length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-crimson-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="section-title">{t('admin:todo.title')}</h2>
          <p className="text-ink-300 text-sm mt-1">
            {t('admin:todo.completedCount', { done: doneCount, total: totalCount })}
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => { resetForm(); setEditingTodo(null); setShowModal(true) }} className="btn-primary">
          <Plus size={16} /> {t('admin:todo.newTask')}
        </motion.button>
      </div>

      {/* Progress */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-white">{t('admin:todo.weekProgress')}</p>
            <p className="text-xs text-ink-300 mt-0.5">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{progress}%</p>
            <p className="text-xs text-ink-400">{t('admin:todo.completed')}</p>
          </div>
        </div>
        <div className="w-full h-2 bg-ink-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-crimson-gradient rounded-full relative"
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-crimson" />
          </motion.div>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-ink-800/50 text-center">
            <p className="text-lg font-bold text-amber-400">{pendingCount}</p>
            <p className="text-xs text-ink-400">{t('admin:todo.columns.pending')}</p>
          </div>
          <div className="p-3 rounded-xl bg-ink-800/50 text-center">
            <p className="text-lg font-bold text-blue-400">{inProgressCount}</p>
            <p className="text-xs text-ink-400">{t('admin:todo.columns.inProgress')}</p>
          </div>
          <div className="p-3 rounded-xl bg-ink-800/50 text-center">
            <p className="text-lg font-bold text-emerald-400">{doneCount}</p>
            <p className="text-xs text-ink-400">{t('admin:todo.columns.done')}</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${!filterCat ? 'border-crimson-500 bg-crimson-700/20 text-crimson-300' : 'border-white/10 text-ink-300'}`}
        >
          {t('admin:todo.allCategories')}
        </button>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(filterCat === c ? null : c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterCat === c ? 'border-crimson-500 bg-crimson-700/20 text-crimson-300' : 'border-white/10 text-ink-300'}`}
          >
            {t(`common:${categoryKeys[c]}`)}
          </button>
        ))}
      </div>

      {/* Tasks - 3 columns with Drag & Drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-amber-400" />
              <h3 className="font-semibold text-white">{t('admin:todo.columns.pending')}</h3>
              <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full ml-auto">{pending.length}</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto pr-1 thin-scrollbar">
              <DroppableColumn id="pending">
                {pending
                  .sort((a, b) => {
                    const order = { high: 0, medium: 1, low: 2 }
                    return order[a.priority] - order[b.priority]
                  })
                  .map(todo => (
                    <DraggableTodoCard key={todo.id} todo={todo} onToggle={handleToggle} onDelete={() => handleDeleteRequest(todo)} clientLabel={getClientLabel(todo)} onOpenNotes={openNotes} onStartEdit={openEdit} column="pending" />
                  ))}
                {pending.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                    <Check size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">{t('admin:todo.emptyPending')}</p>
                  </div>
                )}
              </DroppableColumn>
            </div>
          </div>

          {/* In Progress */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={16} className="text-blue-400" />
              <h3 className="font-semibold text-white">{t('admin:todo.columns.inProgress')}</h3>
              <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full ml-auto">{inProgress.length}</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto pr-1 thin-scrollbar">
              <DroppableColumn id="in_progress">
                {inProgress
                  .sort((a, b) => {
                    const order = { high: 0, medium: 1, low: 2 }
                    return order[a.priority] - order[b.priority]
                  })
                  .map(todo => (
                    <DraggableTodoCard key={todo.id} todo={todo} onToggle={handleToggle} onDelete={() => handleDeleteRequest(todo)} clientLabel={getClientLabel(todo)} onOpenNotes={openNotes} onStartEdit={openEdit} column="in_progress" />
                  ))}
                {inProgress.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                    <Wrench size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">{t('admin:todo.emptyInProgress')}</p>
                  </div>
                )}
              </DroppableColumn>
            </div>
          </div>

          {/* Done */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h3 className="font-semibold text-white">{t('admin:todo.columns.done')}</h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full ml-auto">{done.length}</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto pr-1 thin-scrollbar">
              <DroppableColumn id="done">
                {done.map(todo => (
                  <DraggableTodoCard key={todo.id} todo={todo} onToggle={handleToggle} onDelete={() => handleDeleteRequest(todo)} clientLabel={getClientLabel(todo)} onOpenNotes={openNotes} onStartEdit={openEdit} column="done" />
                ))}
                {done.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                    <Calendar size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">{t('admin:todo.emptyDone')}</p>
                  </div>
                )}
              </DroppableColumn>
            </div>
          </div>
        </div>

        {/* Drag overlay - ghost card */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeTodo ? (
            <TodoCard
              todo={activeTodo}
              onToggle={() => {}}
              onDelete={() => {}}
              clientLabel={getClientLabel(activeTodo)}
              column={activeTodo.status as 'pending' | 'in_progress' | 'done'}
              isOverlay
            />
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
              className="glass-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto thin-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white text-lg">{editingTodo ? t('admin:todo.editTask') : t('admin:todo.newTask')}</h3>
                <button onClick={closeModal} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                {/* Title */}
                <input
                  type="text"
                  placeholder={t('admin:todo.form.titlePlaceholder')}
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input-dark text-sm"
                />
                {/* Description */}
                <div>
                  <p className="text-xs text-ink-300 mb-1.5">{t('admin:todo.form.descriptionLabel')}</p>
                  <textarea
                    placeholder={t('admin:todo.form.descriptionPlaceholder')}
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="input-dark text-sm resize-none"
                  />
                </div>
                {/* Start/End time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('admin:todo.form.startDateTime')}</p>
                    <input
                      type="datetime-local"
                      value={form.startTime}
                      onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="input-dark text-sm bg-ink-800 border-ink-600 text-white"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('admin:todo.form.endDateTime')}</p>
                    <input
                      type="datetime-local"
                      value={form.endTime}
                      onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="input-dark text-sm bg-ink-800 border-ink-600 text-white"
                    />
                  </div>
                </div>
                {/* Priority + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('admin:todo.form.priority')}</p>
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
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">{t('admin:todo.form.category')}</p>
                    <select
                      value={form.category}
                      onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                      className="input-dark text-sm"
                    >
                      {categories.map(c => <option key={c} value={c} className="bg-ink-800">{t(`common:${categoryKeys[c]}`)}</option>)}
                    </select>
                  </div>
                </div>
                {/* Assigned to */}
                <div>
                  <p className="text-xs text-ink-300 mb-1.5">{t('admin:todo.form.assignTo')}</p>
                  <select
                    value={form.assignedTo}
                    onChange={e => setForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="input-dark text-sm"
                  >
                    <option value="" className="bg-ink-800">{t('admin:todo.form.noAssignment')}</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id} className="bg-ink-800">
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                {/* Client */}
                <div>
                  <p className="text-xs text-ink-300 mb-1.5">{t('admin:todo.form.relatedClient')}</p>
                  <select
                    value={form.clientId}
                    onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value }))}
                    className="input-dark text-sm"
                  >
                    <option value="" className="bg-ink-800">{t('admin:todo.form.noClient')}</option>
                    {clients.map(c => <option key={c.id} value={c.id} className="bg-ink-800">{c.company}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={closeModal} className="btn-ghost flex-1 justify-center">{t('common:common.cancel')}</button>
                <button onClick={editingTodo ? handleEditSubmit : handleAdd} className="btn-primary flex-1 justify-center">
                  {editingTodo ? t('common:common.saveChanges') : t('admin:todo.addTask')}
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
                <h3 className="text-lg font-semibold text-white mb-2">{t('admin:todo.deleteConfirm.title')}</h3>
                <p className="text-ink-400 text-sm mb-6">{t('admin:todo.deleteConfirm.message')}</p>
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

      {/* Notes Panel */}
      <AnimatePresence>
        {notesItem && (
          <NotesPanel
            notes={notes}
            onSend={handleSendNote}
            onClose={() => { setNotesItem(null); setNotes([]) }}
            loading={notesLoading}
            currentUserId={user?.id || ''}
            itemTitle={notesItem.title}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
