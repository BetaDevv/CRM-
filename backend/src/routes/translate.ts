import { Router } from 'express'
import translate from 'google-translate-api-x'
import { verifyToken, AuthRequest } from '../middleware/auth'

const router = Router()

const SUPPORTED_LANGS = ['es', 'en', 'de']

router.post('/',
  (req, res, next) => verifyToken(req as AuthRequest, res, next),
  async (req, res) => {
    const { texts, to } = req.body

    if (!Array.isArray(texts) || !texts.length || !SUPPORTED_LANGS.includes(to)) {
      return res.status(400).json({ error: 'texts (string[]) and to (es|en|de) required' })
    }

    // Filter out empty/whitespace-only strings — don't waste API calls
    const validTexts = texts.map(t => (typeof t === 'string' ? t.trim() : ''))

    try {
      const results = await translate(validTexts, { to, autoCorrect: false })
      const translations = (Array.isArray(results) ? results : [results]).map((r, i) => {
        // If source language equals target, or translation failed, keep original
        if (r.from?.language?.iso === to || !r.text) return validTexts[i]
        return r.text
      })
      res.json({ translations })
    } catch {
      // On any error, return originals — never break the UI
      res.json({ translations: validTexts })
    }
  }
)

export default router
