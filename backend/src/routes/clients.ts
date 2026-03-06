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
    cb(null, `avatar-${uuid()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(new Error('Formato no soportado'))
  },
})

const router = Router()
router.use(verifyToken)

function parseClient(c: any) {
  return { ...c, services: JSON.parse(c.services || '[]'), linkedin_connected: !!c.linkedin_connected }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'client') {
      const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.user!.clientId])
      res.json(rows.length ? [parseClient(rows[0])] : [])
    } else {
      const { rows } = await pool.query('SELECT * FROM clients ORDER BY company')
      res.json(rows.map(parseClient))
    }
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO clients (id, company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, company, contact, email, phone || null, industry || null, monthly_fee || 0, JSON.stringify(services || []), status || 'active', start_date || new Date().toISOString().split('T')[0], color || '#DC143C', description || null]
    )
    res.status(201).json(parseClient(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { company, contact, email, phone, industry, monthly_fee, services, status, color, description, linkedin_connected } = req.body
    const { rows } = await pool.query(
      `UPDATE clients SET company=$1, contact=$2, email=$3, phone=$4, industry=$5, monthly_fee=$6,
       services=$7, status=$8, color=$9, description=$10, linkedin_connected=$11 WHERE id=$12 RETURNING *`,
      [company, contact, email, phone || null, industry || null, monthly_fee || 0, JSON.stringify(services || []), status || 'active', color || '#DC143C', description || null, linkedin_connected ? 1 : 0, id]
    )
    if (!rows.length) { res.status(404).json({ error: 'Cliente no encontrado' }); return }
    res.json(parseClient(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/avatar', requireAdmin, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file
    if (!file) { res.status(400).json({ error: 'No se recibió imagen' }); return }
    const avatarUrl = `/uploads/${file.filename}`
    const { rows } = await pool.query(
      'UPDATE clients SET avatar_url=$1 WHERE id=$2 RETURNING *',
      [avatarUrl, req.params.id]
    )
    if (!rows.length) { res.status(404).json({ error: 'Cliente no encontrado' }); return }
    res.json(parseClient(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
