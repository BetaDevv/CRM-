import { Router, Request, Response } from 'express'

const router = Router()

const SUPPORTED = ['es', 'en', 'de'] as const
type Lang = typeof SUPPORTED[number]

/**
 * Parse the Accept-Language header and pick the highest-priority tag that
 * matches one of our supported languages. Falls back to 'en' if nothing
 * matches. Header format example: "de-DE,de;q=0.9,en;q=0.8,es;q=0.7".
 */
function parseAcceptLanguage(header: string | undefined): Lang {
  if (!header) return 'en'
  const entries = header
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find(p => p.trim().startsWith('q='))
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1
      return { tag: tag.toLowerCase(), q: isNaN(q) ? 0 : q }
    })
    .filter(e => e.tag)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of entries) {
    const primary = tag.split('-')[0]
    if ((SUPPORTED as readonly string[]).includes(primary)) return primary as Lang
  }
  return 'en'
}

// GET /api/i18n/detect — public, no auth.
// Used by the frontend on first visit to pick a sensible default language
// based on the user's browser Accept-Language header.
router.get('/detect', (req: Request, res: Response) => {
  const language = parseAcceptLanguage(req.headers['accept-language'])
  res.json({ language, source: 'accept-language' })
})

export default router
