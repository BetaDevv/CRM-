import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { logActivity } from '../services/activityLogger'
import { v4 as uuid } from 'uuid'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = Router()
router.use(verifyToken)

// --- Profile endpoints (any authenticated user) ---

const avatarsDir = path.join(__dirname, '../../../uploads/avatars')
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true })

const photoStorage = multer.diskStorage({
  destination: avatarsDir,
  filename: (_req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`)
})
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()))
  }
})

// GET /api/users/me
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, client_id, profile_photo, accent_color, language, created_at FROM users WHERE id = $1',
      [req.user?.userId]
    )
    if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return }
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/users/me/language — set the current user's language preference
// Body: { language: 'es' | 'en' | 'de' | null }. Passing null clears the preference
// (falls back to browser detection on next login).
const ALLOWED_LANGUAGES = ['es', 'en', 'de'] as const
router.patch('/me/language', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) { res.status(401).json({ error: 'No autenticado' }); return }

    const raw = req.body?.language
    const normalized: string | null =
      (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === ''))
        ? null
        : String(raw).trim()

    if (normalized !== null && !ALLOWED_LANGUAGES.includes(normalized as typeof ALLOWED_LANGUAGES[number])) {
      res.status(400).json({ error: `Invalid language. Allowed: ${ALLOWED_LANGUAGES.join(', ')} or null` })
      return
    }

    await pool.query('UPDATE users SET language = $1 WHERE id = $2', [normalized, userId])
    res.json({ language: normalized })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /api/users/me
router.put('/me', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return }
    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role, client_id, profile_photo',
      [name.trim(), req.user?.userId]
    )
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/users/me/photo
router.post('/me/photo', uploadPhoto.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }
    const photoPath = `/uploads/avatars/${req.file.filename}`
    await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [photoPath, req.user?.userId])
    res.json({ profilePhoto: photoPath })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/users/me/accent-color — set or clear the current user's accent override
// Body: { color: string | null }. Passing null or '' resets to client default.
// Response mirrors /api/clients/me/settings resolution so UI can refresh immediately.
router.patch('/me/accent-color', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) { res.status(401).json({ error: 'No autenticado' }); return }

    const raw = req.body?.color
    const normalized = (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === ''))
      ? null
      : String(raw).trim()

    await pool.query('UPDATE users SET accent_color = $1 WHERE id = $2', [normalized, userId])

    // Resolve fallback chain: user.accent_color → client.accent_color → '#DC143C'
    const { rows } = await pool.query(
      `SELECT u.accent_color AS user_accent_color, c.accent_color AS client_accent_color
       FROM users u
       LEFT JOIN clients c ON c.id = u.client_id
       WHERE u.id = $1`,
      [userId]
    )
    const row = rows[0] || { user_accent_color: null, client_accent_color: null }
    const resolved = row.user_accent_color || row.client_accent_color || '#DC143C'

    res.json({
      accent_color: resolved,
      user_accent_color: row.user_accent_color ?? null,
      client_accent_color: row.client_accent_color ?? null,
    })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// --- Admin-only endpoints below ---
router.use(requireAdmin)

// GET /api/users — List all users (no password_hash)
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, client_id, avatar, active, created_at, last_login FROM users ORDER BY created_at DESC'
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/users — Create user
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, client_id } = req.body
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' }); return
    }

    // Check duplicate email
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.length > 0) {
      res.status(409).json({ error: 'Ya existe un usuario con ese email' }); return
    }

    const id = uuid()
    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO users (id, email, password_hash, role, name, client_id, active)
       VALUES ($1,$2,$3,$4,$5,$6,1)
       RETURNING id, email, name, role, client_id, avatar, active, created_at, last_login`,
      [id, email, password_hash, role || 'client', name, client_id || null]
    )

    logActivity({ type: 'user_created', description: `Nuevo usuario: ${name} (${role || 'client'})`, entityType: 'user', entityId: id })
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /api/users/:id — Update user
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, email, role, client_id, active } = req.body
    const { rows } = await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, client_id=$4, active=$5
       WHERE id=$6
       RETURNING id, email, name, role, client_id, avatar, active, created_at, last_login`,
      [name, email, role, client_id || null, active !== undefined ? (active ? 1 : 0) : 1, id]
    )
    if (!rows.length) { res.status(404).json({ error: 'Usuario no encontrado' }); return }

    logActivity({ type: 'user_updated', description: `Usuario actualizado: ${name}`, entityType: 'user', entityId: id })
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/users/:id/reset-password
router.patch('/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { new_password } = req.body
    if (!new_password || new_password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' }); return
    }

    const password_hash = await bcrypt.hash(new_password, 10)
    const { rowCount } = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id])
    if (!rowCount) { res.status(404).json({ error: 'Usuario no encontrado' }); return }

    logActivity({ type: 'user_password_reset', description: `Contraseña restablecida para usuario ${id}`, entityType: 'user', entityId: id })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/users/:id/toggle-active
router.patch('/:id/toggle-active', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query(
      `UPDATE users SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END
       WHERE id = $1
       RETURNING id, email, name, role, client_id, avatar, active, created_at, last_login`,
      [id]
    )
    if (!rows.length) { res.status(404).json({ error: 'Usuario no encontrado' }); return }

    const status = rows[0].active ? 'activado' : 'desactivado'
    logActivity({ type: 'user_toggled', description: `Usuario ${status}: ${rows[0].name}`, entityType: 'user', entityId: id })
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/users/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    // Prevent deleting yourself
    if (req.user?.userId === id) {
      res.status(400).json({ error: 'No puedes eliminar tu propio usuario' }); return
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id])
    if (!rowCount) { res.status(404).json({ error: 'Usuario no encontrado' }); return }

    logActivity({ type: 'user_deleted', description: `Usuario eliminado: ${id}`, entityType: 'user', entityId: id })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
