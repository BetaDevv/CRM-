import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'

const uploadDir = path.resolve(__dirname, '../../../uploads/avatars')
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
  return { ...c, services: JSON.parse(c.services || '[]'), linkedin_connected: !!c.linkedin_connected, monthly_fee: parseFloat(c.monthly_fee) || 0 }
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

// GET /api/clients/me/settings — Get current client's settings (for portal)
// Returns resolved accent_color using fallback: user.accent_color → client.accent_color → '#EA580C'
// Also exposes raw user_accent_color and client_accent_color so UI can tell if user overrode.
router.get('/me/settings', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.clientId) { res.status(400).json({ error: 'No client' }); return }
    const { rows } = await pool.query(
      `SELECT c.avatar_url, c.company, c.accent_color AS client_accent_color, u.accent_color AS user_accent_color
       FROM clients c
       LEFT JOIN users u ON u.id = $2
       WHERE c.id = $1`,
      [user.clientId, user.userId]
    )
    if (!rows.length) { res.status(404).json({ error: 'Not found' }); return }
    const row = rows[0]
    const resolved = row.user_accent_color || row.client_accent_color || '#EA580C'
    res.json({
      company: row.company,
      avatar_url: row.avatar_url,
      accent_color: resolved,
      user_accent_color: row.user_accent_color ?? null,
      client_accent_color: row.client_accent_color ?? null,
    })
  } catch { res.status(500).json({ error: 'Error interno' }) }
})

// PATCH /api/clients/:id/accent — Update accent color
router.patch('/:id/accent', async (req: AuthRequest, res: Response) => {
  try {
    const { accent_color } = req.body
    if (!accent_color) { res.status(400).json({ error: 'Color required' }); return }
    await pool.query('UPDATE clients SET accent_color = $1 WHERE id = $2', [accent_color, req.params.id])
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'Error interno' }) }
})

router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description, currency, accent_color } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO clients (id, company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description, currency, accent_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, company, contact, email, phone || null, industry || null, monthly_fee || 0, JSON.stringify(services || []), status || 'active', start_date || new Date().toISOString().split('T')[0], color || '#EA580C', description || null, currency || 'USD', accent_color || null]
    )
    logActivity({ type: 'client_created', description: `Nuevo cliente: ${company}`, entityType: 'client', entityId: id })
    res.status(201).json(parseClient(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { company, contact, email, phone, industry, monthly_fee, services, status, color, description, linkedin_connected, start_date, currency, accent_color } = req.body
    const { rows } = await pool.query(
      `UPDATE clients SET company=$1, contact=$2, email=$3, phone=$4, industry=$5, monthly_fee=$6,
       services=$7, status=$8, color=$9, description=$10, linkedin_connected=$11, start_date=$12, currency=$13, accent_color=$14 WHERE id=$15 RETURNING *`,
      [company, contact, email, phone || null, industry || null, monthly_fee || 0, JSON.stringify(services || []), status || 'active', color || '#EA580C', description || null, linkedin_connected ? 1 : 0, start_date || null, currency || 'USD', accent_color || null, id]
    )
    if (!rows.length) { res.status(404).json({ error: 'Cliente no encontrado' }); return }
    logActivity({ type: 'client_updated', description: `Cliente actualizado: ${company}`, entityType: 'client', entityId: id })
    res.json(parseClient(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/avatar', requireAdmin, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file
    if (!file) { res.status(400).json({ error: 'No se recibió imagen' }); return }
    const avatarUrl = `/uploads/avatars/${file.filename}`
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

// ─── Client Notes ──────────────────────────────────────────────────────────────

router.get('/:id/notes', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM client_notes WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/:id/notes', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body
    if (!content?.trim()) { res.status(400).json({ error: 'Contenido requerido' }); return }
    const id = uuid()
    const author = req.user?.name || 'Admin'
    const { rows } = await pool.query(
      'INSERT INTO client_notes (id, client_id, content, author) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, req.params.id, content.trim(), author]
    )
    // Get client company for the activity log
    const { rows: clientRows } = await pool.query('SELECT company FROM clients WHERE id = $1', [req.params.id])
    const company = clientRows[0]?.company || 'cliente'
    logActivity({ type: 'note_added', description: `Nota agregada para ${company}`, entityType: 'client', entityId: req.params.id })
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id/notes/:noteId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM client_notes WHERE id = $1 AND client_id = $2', [req.params.noteId, req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Client Activity ───────────────────────────────────────────────────────────

router.get('/:id/activity', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.params.id
    // Get the client company name for ILIKE matching
    const { rows: clientRows } = await pool.query('SELECT company FROM clients WHERE id = $1', [clientId])
    const company = clientRows[0]?.company || ''

    const { rows } = await pool.query(
      `SELECT * FROM activity_log
       WHERE (entity_type = 'client' AND entity_id = $1)
          OR description ILIKE $2
       ORDER BY created_at DESC LIMIT 20`,
      [clientId, `%${company}%`]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
