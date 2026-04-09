import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { useTranslationStore } from '../lib/translationStore'

interface TranslatedTextProps {
  text: string | undefined | null
}

/**
 * Renders user-generated text with an optional "Translate" button.
 * Shows original text by default. On click, fetches translation.
 *
 * Usage: <T text={todo.title} />
 */
export default function T({ text }: TranslatedTextProps) {
  const { t, i18n } = useTranslation('common')
  const lang = i18n.language
  const requestTranslation = useTranslationStore(s => s.requestTranslation)
  const cache = useTranslationStore(s => s.cache)
  const [showTranslation, setShowTranslation] = useState(false)

  if (!text?.trim()) return null
  // Default content language is Spanish — no translation needed
  if (lang === 'es') return <>{text}</>

  const cacheKey = `${lang}::${text}`
  const cached = cache.get(cacheKey)
  const isTranslated = showTranslation && cached

  const handleTranslate = () => {
    if (cached) {
      setShowTranslation(true)
      return
    }
    requestTranslation([text], lang)
    setShowTranslation(true)
  }

  return (
    <span className="inline">
      {isTranslated ? cached : text}
      {!showTranslation ? (
        <button
          onClick={(e) => { e.stopPropagation(); handleTranslate() }}
          className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-medium text-crimson-400/70 hover:text-crimson-400 transition-colors align-middle"
        >
          <Languages size={10} />
          {t('common.translate')}
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setShowTranslation(false) }}
          className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-medium text-ink-400 hover:text-ink-200 transition-colors align-middle"
        >
          {t('common.showOriginal')}
        </button>
      )}
    </span>
  )
}
