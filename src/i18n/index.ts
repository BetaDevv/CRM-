import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Common translations
import commonEs from './locales/es/common.json'
import commonEn from './locales/en/common.json'
import commonDe from './locales/de/common.json'

// Admin translations
import adminEs from './locales/es/admin.json'
import adminEn from './locales/en/admin.json'
import adminDe from './locales/de/admin.json'

// Client translations
import clientEs from './locales/es/client.json'
import clientEn from './locales/en/client.json'
import clientDe from './locales/de/client.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: commonEs, admin: adminEs, client: clientEs },
      en: { common: commonEn, admin: adminEn, client: clientEn },
      de: { common: commonDe, admin: adminDe, client: clientDe },
    },
    lng: 'es', // default language
    fallbackLng: 'es',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'tbs_language',
      caches: ['localStorage'],
    },
  })

// Keep <html lang> in sync with the active i18n language so any code (or
// third-party lib) reading document.documentElement.lang stays correct.
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
}

export default i18n
