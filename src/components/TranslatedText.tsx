import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useTranslationStore } from '../lib/translationStore'

interface TranslatedTextProps {
  text: string | undefined | null
}

/**
 * Renders user-generated text translated to the current app language.
 * Falls back to original text if translation isn't available yet or fails.
 *
 * Usage: <T text={todo.title} />
 */
export default function T({ text }: TranslatedTextProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const getTranslation = useTranslationStore(s => s.getTranslation)
  const requestTranslation = useTranslationStore(s => s.requestTranslation)
  const requested = useRef(false)

  useEffect(() => {
    if (!text?.trim() || lang === 'es') {
      requested.current = false
      return
    }
    requested.current = true
    requestTranslation([text], lang)
  }, [text, lang, requestTranslation])

  if (!text) return null
  // Default content language is Spanish — no translation needed
  if (lang === 'es') return <>{text}</>

  return <>{getTranslation(text, lang)}</>
}
