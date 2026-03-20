import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { logActivity } from '../services/activityLogger'
import { v4 as uuid } from 'uuid'

const router = Router()
router.use(verifyToken)
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
