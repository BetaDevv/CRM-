import { motion } from 'framer-motion'
import { LogoMark } from '../components/Logo'
import { useTranslation } from 'react-i18next'

const APP_NAME = 'NextGenCRM'

interface LegalSection {
  heading: string
  body: string
}

interface LegalContent {
  title: string
  backToLogin: string
  sections: LegalSection[]
}

interface LegalPageProps {
  content: Record<string, LegalContent>
  lastUpdated: string
}

export default function LegalPage({ content, lastUpdated }: LegalPageProps) {
  const { i18n } = useTranslation()
  const lang = (i18n.language || 'es') as string
  const c = content[lang] || content.es

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgb(var(--ink-900))' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <div className="flex items-center gap-3">
            <LogoMark size="sm" />
            <span className="font-bold text-white">{APP_NAME}</span>
          </div>
          <a href="/login" className="text-sm text-ink-400 hover:text-crimson-400 transition-colors">
            {c.backToLogin}
          </a>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black text-white mb-2"
        >
          {c.title}
        </motion.h1>
        <p className="text-sm text-ink-400 mb-10">
          {lang === 'es' ? 'Última actualización' : lang === 'de' ? 'Zuletzt aktualisiert' : 'Last updated'}: {lastUpdated}
        </p>

        {/* Sections */}
        <div className="space-y-8">
          {c.sections.map((section, i) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.03 }}
            >
              <h2 className="text-lg font-bold text-white mb-3">{section.heading}</h2>
              <div
                className="text-sm leading-relaxed text-ink-300 whitespace-pre-line [&_strong]:text-ink-200 [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{
                  __html: section.body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                }}
              />
            </motion.section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-white/5 text-center text-xs text-ink-500">
          &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  )
}
