import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'

const uploadDir = path.resolve(__dirname, '../../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuid()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Formato no soportado'))
  },
})

const router = Router()
router.use(verifyToken)

function parsePost(p: any) {
  return { ...p, media_urls: JSON.parse(p.media_urls || '[]') }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'client') {
      const { rows } = await pool.query('SELECT * FROM posts WHERE client_id = $1 ORDER BY created_at DESC', [req.user!.clientId])
      res.json(rows.map(parsePost))
    } else {
      const { rows } = await pool.query('SELECT * FROM posts ORDER BY created_at DESC')
      res.json(rows.map(parsePost))
    }
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', requireAdmin, upload.array('images', 4), async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, title, content, platform, scheduled_date, type } = req.body
    const files = (req.files as Express.Multer.File[]) || []
    const mediaUrls = files.map(f => `/uploads/${f.filename}`)
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO posts (id, client_id, title, content, platform, scheduled_date, status, media_urls, type)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8) RETURNING *`,
      [id, client_id, title, content || null, platform || 'linkedin', scheduled_date || null, JSON.stringify(mediaUrls), type || 'post']
    )
    res.status(201).json(parsePost(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status, feedback } = req.body
    const { rows: cur } = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id])
    if (!cur.length) { res.status(404).json({ error: 'Post no encontrado' }); return }
    const post = cur[0]

    if (req.user!.role === 'client' && post.client_id !== req.user!.clientId) {
      res.status(403).json({ error: 'Sin acceso' }); return
    }
    const allowed = ['pending', 'approved', 'rejected', 'revision']
    if (!allowed.includes(status)) { res.status(400).json({ error: 'Status inválido' }); return }

    const { rows } = await pool.query(
      'UPDATE posts SET status=$1, feedback=$2 WHERE id=$3 RETURNING *',
      [status, feedback || post.feedback, req.params.id]
    )
    res.json(parsePost(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', requireAdmin, async (req, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT media_urls FROM posts WHERE id = $1', [req.params.id])
    if (rows.length) {
      const urls: string[] = JSON.parse(rows[0].media_urls || '[]')
      urls.forEach(u => {
        const fp = path.join(uploadDir, path.basename(u))
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    }
    await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
