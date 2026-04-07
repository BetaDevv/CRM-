import { create } from 'zustand'
import { api } from './api'

interface TranslationState {
  cache: Map<string, string>
  pending: Set<string>
  getTranslation: (text: string, lang: string) => string
  requestTranslation: (texts: string[], lang: string) => void
  clearCache: () => void
}

// Batching: collect requests and send in one API call
let batchQueue: { text: string; lang: string }[] = []
let batchTimer: ReturnType<typeof setTimeout> | null = null

function cacheKey(text: string, lang: string) {
  return `${lang}::${text}`
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  cache: new Map(),
  pending: new Set(),

  getTranslation(text: string, lang: string) {
    if (!text?.trim()) return text
    const key = cacheKey(text, lang)
    return get().cache.get(key) ?? text
  },

  requestTranslation(texts: string[], lang: string) {
    const { cache, pending } = get()
    const needed = texts.filter(t => {
      if (!t?.trim()) return false
      const key = cacheKey(t, lang)
      return !cache.has(key) && !pending.has(key)
    })

    if (!needed.length) return

    // Mark as pending
    set(state => {
      const newPending = new Set(state.pending)
      needed.forEach(t => newPending.add(cacheKey(t, lang)))
      return { pending: newPending }
    })

    // Add to batch queue
    needed.forEach(t => batchQueue.push({ text: t, lang }))

    // Debounce: wait 150ms to collect more requests, then fire
    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = setTimeout(() => flushBatch(set, get), 150)
  },

  clearCache() {
    set({ cache: new Map(), pending: new Set() })
  },
}))

async function flushBatch(
  set: (fn: (s: TranslationState) => Partial<TranslationState>) => void,
  get: () => TranslationState
) {
  const batch = [...batchQueue]
  batchQueue = []
  batchTimer = null

  if (!batch.length) return

  // Group by target language
  const byLang = new Map<string, string[]>()
  batch.forEach(({ text, lang }) => {
    const arr = byLang.get(lang) || []
    arr.push(text)
    byLang.set(lang, arr)
  })

  for (const [lang, texts] of byLang) {
    try {
      // Send max 50 texts per request to avoid timeouts
      for (let i = 0; i < texts.length; i += 50) {
        const chunk = texts.slice(i, i + 50)
        const { data } = await api.post('/translate', { texts: chunk, to: lang })
        const translations: string[] = data.translations

        set(state => {
          const newCache = new Map(state.cache)
          const newPending = new Set(state.pending)
          chunk.forEach((text, idx) => {
            const key = cacheKey(text, lang)
            newCache.set(key, translations[idx] || text)
            newPending.delete(key)
          })
          return { cache: newCache, pending: newPending }
        })
      }
    } catch {
      // On error, cache originals so we don't retry endlessly
      set(state => {
        const newCache = new Map(state.cache)
        const newPending = new Set(state.pending)
        texts.forEach(text => {
          const key = cacheKey(text, lang)
          newCache.set(key, text)
          newPending.delete(key)
        })
        return { cache: newCache, pending: newPending }
      })
    }
  }
}
