import axios from 'axios'
import i18n from '../i18n'

/**
 * Bootstrap the UI language from the server when the visitor has no
 * explicit preference yet. Order of precedence (highest first):
 *   1. user.language in DB (applied in useAuthStore on login/restoreSession)
 *   2. localStorage.tbs_language (set by manual toggle OR previous auto-detect)
 *   3. Server detection via /api/i18n/detect (Accept-Language header)
 *
 * This helper only handles step 3. It runs once on app boot, before the
 * user authenticates, and intentionally does not write to localStorage
 * itself — `i18n` is configured with caches:['localStorage'] so the cache
 * is updated automatically when changeLanguage() is called.
 */
export async function bootstrapLanguage(): Promise<void> {
  // Skip if the user already has a preference cached locally (manual toggle
  // or a previous auto-detect that stuck).
  if (localStorage.getItem('tbs_language')) return

  try {
    // Use a fresh axios call (not the shared `api` instance) so the auth
    // interceptor's 401-redirect logic does not interfere on the public
    // login page.
    const { data } = await axios.get<{ language?: string }>('/api/i18n/detect', { timeout: 5000 })
    const lang = data?.language
    if (lang && lang !== i18n.language) {
      await i18n.changeLanguage(lang)
    }
  } catch {
    // Network error or anything else: keep the i18n fallback in place.
  }
}
