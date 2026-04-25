import { create } from 'zustand'
import { chatApi, type ChatMessage } from '../lib/chatApi'

const MAX_LENGTH = 10000

interface UIMessage extends ChatMessage {
  id: string
  streaming?: boolean
}

interface ChatState {
  isOpen: boolean
  messages: UIMessage[]
  input: string
  isStreaming: boolean
  error: string | null
  cancelStream: (() => void) | null

  open: () => void
  close: () => void
  toggle: () => void
  setInput: (v: string) => void
  send: () => void
  reset: () => void
  loadHistory: () => Promise<void>
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  input: '',
  isStreaming: false,
  error: null,
  cancelStream: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set(s => ({ isOpen: !s.isOpen })),
  setInput: (v) => set({ input: v.slice(0, MAX_LENGTH) }),

  send: () => {
    const { input, isStreaming } = get()
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: UIMessage = {
      id: uid(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    const assistantMsg: UIMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      streaming: true,
    }

    set(s => ({
      messages: [...s.messages, userMsg, assistantMsg],
      input: '',
      isStreaming: true,
      error: null,
    }))

    const cancel = chatApi.sendMessage(text, {
      onChunk: (chunk) => {
        set(s => ({
          messages: s.messages.map(m =>
            m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m
          ),
        }))
      },
      onDone: (full, createdAt) => {
        set(s => ({
          messages: s.messages.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: full, created_at: createdAt, streaming: false }
              : m
          ),
          isStreaming: false,
          cancelStream: null,
        }))
      },
      onError: (msg) => {
        set(s => ({
          messages: s.messages.filter(m => m.id !== assistantMsg.id),
          isStreaming: false,
          error: msg,
          cancelStream: null,
        }))
      },
    })

    set({ cancelStream: cancel })
  },

  reset: () => {
    const { cancelStream } = get()
    if (cancelStream) cancelStream()
    set({ messages: [], error: null, isStreaming: false, cancelStream: null })
  },

  loadHistory: async () => {
    try {
      const history = await chatApi.fetchHistory()
      set({ messages: history.map(m => ({ ...m, id: uid() })) })
    } catch {
      /* silencioso: el historial es opcional */
    }
  },
}))

export const CHAT_MAX_LENGTH = MAX_LENGTH
