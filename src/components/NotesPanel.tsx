import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, MessageSquare, Send, Loader2 } from 'lucide-react'
import type { ItemNote } from '../lib/api'

/**
 * Panel de conversación reutilizable para notas en todos/ideas.
 * Equivalente en Django: un template tag o un include reutilizable.
 * Se usa en: TodoSemanal, Ideas, ClientTodos, ClientIdeas.
 */
export default function NotesPanel({ notes, onSend, onClose, loading, currentUserId, itemTitle }: {
  notes: ItemNote[]
  onSend: (content: string) => void
  onClose: () => void
  loading: boolean
  currentUserId: string
  itemTitle: string
}) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [notes])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} className="glass-card w-full max-w-md flex flex-col" style={{ maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <MessageSquare size={18} className="text-crimson-400" /> Notas
            </h3>
            <p className="text-xs text-ink-400 mt-0.5">{itemTitle}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={18} /></button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 thin-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-crimson-400" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-ink-500">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              <p className="text-sm">Sin notas aun</p>
              <p className="text-xs text-ink-500 mt-1">Escribe la primera nota</p>
            </div>
          ) : notes.map(note => {
            const isMe = note.author_id === currentUserId
            return (
              <div key={note.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? 'bg-crimson-700/20 border border-crimson-700/30'
                    : 'bg-ink-800/60 border border-white/5'
                }`}>
                  <p className="text-xs font-semibold mb-1" style={{ color: isMe ? '#DC143C' : '#60A5FA' }}>
                    {note.author_name}
                  </p>
                  <p className="text-sm text-white leading-relaxed">{note.content}</p>
                  <p className="text-[10px] text-ink-500 mt-1 text-right">
                    {new Date(note.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="p-4 border-t border-white/5">
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onSend(text.trim()); setText('') } }}
              placeholder="Escribe una nota..."
              className="input-dark text-sm flex-1"
              autoFocus
            />
            <button
              onClick={() => { if (text.trim()) { onSend(text.trim()); setText('') } }}
              disabled={!text.trim()}
              className="px-4 py-2.5 rounded-xl bg-crimson-700 hover:bg-crimson-600 disabled:opacity-30 text-white transition-all"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
