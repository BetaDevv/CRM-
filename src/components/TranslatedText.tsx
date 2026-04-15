import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { useTranslationStore } from '../lib/translationStore'

interface TranslatedTextProps {
  text: string | undefined | null
  /** Show translate button. Default: false — just renders text without button */
  translatable?: boolean
}

/**
 * Renders user-generated text with an optional "Translate" button.
 * By default just renders the text. Pass translatable to show the translate button.
 *
 * Usage:
 *   <T text={client.company} />              — just renders text
 *   <T text={idea.description} translatable /> — renders text with translate button
 */
export default function T({ text, translatable }: TranslatedTextProps) {
  const { t, i18n } = useTranslation('common')
  const lang = i18n.language
  const requestTranslation = useTranslationStore(s => s.requestTranslation)
  const cache = useTranslationStore(s => s.cache)
  const [showTranslation, setShowTranslation] = useState(false)

  if (!text?.trim()) return null
  if (lang === 'es' || !translatable) return <>{text}</>

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
