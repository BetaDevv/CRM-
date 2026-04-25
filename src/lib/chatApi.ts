/**
 * OmniSource chat client.
 *
 * Two adapters with the same interface:
 *  - mockAdapter: simula chunks llegando con setTimeout. Útil para desarrollar
 *    la UX antes de que el backend esté listo.
 *  - realAdapter: WebSocket contra `/ws/chat/?token=...` + fallback HTTP a
 *    `POST /chat/message/` y `GET /chat/messages/`.
 *
 * Switch con `VITE_OMNISOURCE_MODE=mock|real` (default: mock).
 */

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
  created_at: string
}

export interface StreamHandlers {
  onChunk: (chunk: string) => void
  onDone: (full: string, createdAt: string) => void
  onError: (message: string) => void
}

export interface ChatAdapter {
  sendMessage(text: string, handlers: StreamHandlers): () => void
  fetchHistory(): Promise<ChatMessage[]>
}

const MODE = (import.meta.env.VITE_OMNISOURCE_MODE ?? 'mock') as 'mock' | 'real'
const TOKEN = import.meta.env.VITE_OMNISOURCE_TOKEN ?? ''
const API_URL = import.meta.env.VITE_OMNISOURCE_API_URL ?? ''
const WS_URL = import.meta.env.VITE_OMNISOURCE_WS_URL ?? ''

const MOCK_REPLIES = [
  'Claro, déjame revisar los datos. En marzo se registraron 1,847 ventas por un total de $234,500 USD, un 12% por encima del mes anterior.',
  'Buena pregunta. Según tus métricas de la última semana, Instagram fue tu canal más fuerte con 4,210 impresiones y un engagement del 6.8%.',
  'Encontré 3 documentos relacionados en tu carpeta. ¿Querés que te resuma el contenido o prefieres abrirlos directamente?',
  'Tu plan estratégico de Q2 tiene 5 hitos pendientes. El más cercano vence en 8 días. ¿Querés que liste los detalles?',
  'No tengo datos suficientes sobre eso todavía. ¿Podrías reformular o darme más contexto?',
]

function pickReply(prompt: string) {
  const idx = Math.abs(prompt.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % MOCK_REPLIES.length
  return MOCK_REPLIES[idx]
}

const mockAdapter: ChatAdapter = {
  sendMessage(text, handlers) {
    const reply = pickReply(text)
    const tokens = reply.split(/(\s+)/)
    let cursor = 0
    let acc = ''
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      if (cursor >= tokens.length) {
        handlers.onDone(acc, new Date().toISOString())
        return
      }
      const next = tokens[cursor++]
      acc += next
      handlers.onChunk(next)
      setTimeout(tick, 35 + Math.random() * 60)
    }

    setTimeout(tick, 280)
    return () => { cancelled = true }
  },

  async fetchHistory() {
    return []
  },
}

const realAdapter: ChatAdapter = {
  sendMessage(text, handlers) {
    if (!WS_URL || !TOKEN) {
      handlers.onError('Falta configurar VITE_OMNISOURCE_WS_URL o VITE_OMNISOURCE_TOKEN')
      return () => {}
    }

    const url = `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(TOKEN)}`
    const ws = new WebSocket(url)
    let acc = ''
    let opened = false

    ws.onopen = () => {
      opened = true
      ws.send(JSON.stringify({ message: text }))
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'connected') return
        if (data.type === 'chunk') {
          acc += data.content ?? ''
          handlers.onChunk(data.content ?? '')
        } else if (data.type === 'done') {
          handlers.onDone(data.content ?? acc, data.created_at ?? new Date().toISOString())
          ws.close()
        } else if (data.type === 'error') {
          handlers.onError(data.content ?? 'Error desconocido')
          ws.close()
        }
      } catch {
        handlers.onError('Respuesta malformada del servidor')
      }
    }

    ws.onerror = () => {
      handlers.onError(opened ? 'Conexión interrumpida' : 'No se pudo conectar al chat')
    }

    ws.onclose = (ev) => {
      if (!opened && ev.code === 4001) handlers.onError('Token inválido')
    }

    return () => { try { ws.close() } catch { /* noop */ } }
  },

  async fetchHistory() {
    if (!API_URL || !TOKEN) return []
    const res = await fetch(`${API_URL}/chat/messages/`, {
      headers: { Authorization: `Token ${TOKEN}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.messages ?? []) as ChatMessage[]
  },
}

export const chatApi: ChatAdapter = MODE === 'real' ? realAdapter : mockAdapter
export const chatMode = MODE
