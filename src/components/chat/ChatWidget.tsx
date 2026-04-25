import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X, Send, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { useChatStore, CHAT_MAX_LENGTH } from '../../store/useChatStore'
import { chatMode } from '../../lib/chatApi'

export default function ChatWidget() {
  const {
    isOpen, messages, input, isStreaming, error,
    toggle, close, setInput, send, reset,
  } = useChatStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen && !isStreaming) inputRef.current?.focus()
  }, [isOpen, isStreaming])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <motion.button
        onClick={toggle}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-white animate-pulse-crimson"
        style={{ background: 'linear-gradient(135deg, var(--accent-hex), var(--accent-dark))' }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="w-6 h-6" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MessageCircle className="w-6 h-6" strokeWidth={2.5} fill="currentColor" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] sm:w-[400px] h-[calc(100vh-7rem)] sm:max-h-[680px] glass-card flex flex-col overflow-hidden"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-ink-600/30 bg-ink-800/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 p-1.5"
                  style={{ background: 'linear-gradient(135deg, var(--accent-hex), var(--accent-dark))' }}
                >
                  <img src="/logo-n-white.png" alt="" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-white truncate">Asistente IA</h3>
                  <p className="text-[11px] text-ink-200 truncate">
                    {chatMode === 'mock' ? 'Modo demo · sin backend' : 'OmniSource · en línea'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={reset}
                    aria-label="Limpiar conversación"
                    className="p-2 rounded-lg text-ink-200 hover:text-white hover:bg-ink-700/60 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={close}
                  aria-label="Cerrar"
                  className="p-2 rounded-lg text-ink-200 hover:text-white hover:bg-ink-700/60 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto thin-scrollbar px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 p-2.5"
                    style={{ background: 'linear-gradient(135deg, var(--accent-hex), var(--accent-dark))' }}
                  >
                    <img src="/logo-n-white.png" alt="NextGenCRM" className="w-full h-full object-contain" />
                  </div>
                  <h4 className="text-white font-semibold mb-1.5">Hola 👋</h4>
                  <p className="text-sm text-ink-200 leading-relaxed">
                    Preguntá lo que quieras sobre tus datos, métricas o documentos. Te respondo en tiempo real.
                  </p>
                </div>
              )}

              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === 'user'
                        ? 'text-white rounded-br-md'
                        : 'bg-ink-700/70 text-ink-100 border border-ink-600/40 rounded-bl-md'
                    }`}
                    style={
                      m.role === 'user'
                        ? { background: 'linear-gradient(135deg, var(--accent-hex), var(--accent-dark))' }
                        : undefined
                    }
                  >
                    {m.content || (m.streaming && <TypingDots />)}
                    {m.streaming && m.content && <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-current animate-pulse" />}
                  </div>
                </motion.div>
              ))}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-ink-600/30 bg-ink-800/80 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isStreaming ? 'Esperando respuesta…' : 'Escribí tu mensaje…'}
                  disabled={isStreaming}
                  rows={1}
                  maxLength={CHAT_MAX_LENGTH}
                  className="input-dark resize-none thin-scrollbar text-sm py-2.5 max-h-32 disabled:opacity-50"
                  style={{ minHeight: '42px' }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  aria-label="Enviar"
                  className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, var(--accent-hex), var(--accent-dark))' }}
                >
                  {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              {input.length > CHAT_MAX_LENGTH * 0.9 && (
                <p className="text-[11px] text-ink-300 mt-1.5 text-right">
                  {input.length} / {CHAT_MAX_LENGTH}
                </p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink-200"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  )
}
