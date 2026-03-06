import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Trash2, Calendar } from 'lucide-react'
import { useStore } from '../store/useStore'
import { priorityConfig, generateId } from '../lib/utils'
import type { Priority, TodoItem } from '../types'

const categories = ['Contenido', 'Diseño', 'Ventas', 'Reportes', 'Estrategia', 'Admin', 'Otro']
function TodoCard({
  todo,
  onToggle,
  onDelete,
}: {
  todo: TodoItem
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const cfg = priorityConfig[todo.priority]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className={`group flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200
        ${todo.done
          ? 'bg-ink-800/20 border-white/5 opacity-50'
          : 'bg-ink-800/50 border-white/5 hover:border-white/10'
        }`}
    >
      <button
        onClick={() => onToggle(todo.id)}
        className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
          ${todo.done ? 'bg-crimson-700 border-crimson-700' : 'border-ink-500 hover:border-crimson-500'}`}
      >
        {todo.done && <Check size={11} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${todo.done ? 'line-through text-ink-400' : 'text-white'}`}>
          {todo.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: cfg.color, background: cfg.bg }}>
            {cfg.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-300">{todo.category}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-crimson-400 transition-all flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  )
}

export default function TodoSemanal() {
  const { todos, addTodo, toggleTodo, deleteTodo, clients } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as Priority,
    category: 'Contenido', clientId: '', dueDate: '',
  })

  const weekOf = new Date().toISOString().split('T')[0]

  const handleAdd = () => {
    if (!form.title) return
    addTodo({
      id: generateId(),
      title: form.title,
      description: form.description,
      priority: form.priority,
      category: form.category,
      clientId: form.clientId || undefined,
      dueDate: form.dueDate || undefined,
      done: false,
      weekOf,
    })
    setForm({ title: '', description: '', priority: 'medium', category: 'Contenido', clientId: '', dueDate: '' })
    setShowModal(false)
  }

  const filtered = todos.filter(t => !filterCat || t.category === filterCat)
  const pending = filtered.filter(t => !t.done)
  const done = filtered.filter(t => t.done)
  const progress = todos.length > 0 ? Math.round((todos.filter(t => t.done).length / todos.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="section-title">To-Do Semanal</h2>
          <p className="text-ink-300 text-sm mt-1">
            {todos.filter(t => t.done).length}/{todos.length} completadas esta semana
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} /> Nueva Tarea
        </motion.button>
      </div>

      {/* Progress */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-white">Progreso de la semana</p>
            <p className="text-xs text-ink-300 mt-0.5">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{progress}%</p>
            <p className="text-xs text-ink-400">completado</p>
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

        {/* Category breakdown */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {['high', 'medium', 'low'].map(p => {
            const cfg = priorityConfig[p as Priority]
            const count = todos.filter(t => t.priority === p && !t.done).length
            return (
              <div key={p} className="p-3 rounded-xl bg-ink-800/50 text-center">
                <p className="text-lg font-bold" style={{ color: cfg.color }}>{count}</p>
                <p className="text-xs text-ink-400">{cfg.label} prioridad</p>
              </div>
            )
          })}
          <div className="p-3 rounded-xl bg-ink-800/50 text-center">
            <p className="text-lg font-bold text-green-400">{todos.filter(t => t.done).length}</p>
            <p className="text-xs text-ink-400">Completadas</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${!filterCat ? 'border-crimson-500 bg-crimson-700/20 text-crimson-300' : 'border-white/10 text-ink-300'}`}
        >
          Todas
        </button>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(filterCat === c ? null : c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterCat === c ? 'border-crimson-500 bg-crimson-700/20 text-crimson-300' : 'border-white/10 text-ink-300'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-crimson-500 animate-pulse" />
            <h3 className="font-semibold text-white">Pendientes</h3>
            <span className="text-xs bg-crimson-700/20 text-crimson-400 px-2 py-0.5 rounded-full ml-auto">{pending.length}</span>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {pending
                .sort((a, b) => {
                  const order = { high: 0, medium: 1, low: 2 }
                  return order[a.priority] - order[b.priority]
                })
                .map(todo => (
                  <TodoCard key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                ))}
            </AnimatePresence>
            {pending.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                <Check size={32} className="mb-2 opacity-30" />
                <p className="text-sm">¡Todo al día!</p>
              </div>
            )}
          </div>
        </div>

        {/* Done */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h3 className="font-semibold text-white">Completadas</h3>
            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full ml-auto">{done.length}</span>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {done.map(todo => (
                <TodoCard key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
              ))}
            </AnimatePresence>
            {done.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-ink-500">
                <Calendar size={32} className="mb-2 opacity-30" />
                <p className="text-sm">Aún sin completar</p>
              </div>
            )}
          </div>
        </div>
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
                <h3 className="font-bold text-white text-lg">Nueva Tarea</h3>
                <button onClick={() => setShowModal(false)} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Título de la tarea *"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input-dark text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-ink-300 mb-1.5">Prioridad</p>
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
                    <p className="text-xs text-ink-300 mb-1.5">Categoría</p>
                    <select
                      value={form.category}
                      onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                      className="input-dark text-sm"
                    >
                      {categories.map(c => <option key={c} value={c} className="bg-ink-800">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-ink-300 mb-1.5">Cliente relacionado (opcional)</p>
                  <select
                    value={form.clientId}
                    onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value }))}
                    className="input-dark text-sm"
                  >
                    <option value="" className="bg-ink-800">Sin cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id} className="bg-ink-800">{c.company}</option>)}
                  </select>
                </div>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="input-dark text-sm"
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <button onClick={handleAdd} className="btn-primary flex-1 justify-center">Agregar Tarea</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
