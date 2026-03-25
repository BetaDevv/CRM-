import { Router, Response } from 'express'
import crypto from 'crypto'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'

const router = Router()

// All routes require JWT auth + admin role (these are management endpoints)
router.use(verifyToken)
router.use(requireAdmin)

// GET /api/api-keys — List all API keys
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT ak.*, u.name as user_name, u.email as user_email, c.company as client_name
      FROM api_keys ak
      LEFT JOIN users u ON ak.user_id = u.id
      LEFT JOIN clients c ON ak.client_id = c.id
      ORDER BY ak.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    console.error('Error listing API keys:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/api-keys — Create API key
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, user_id, role, client_id, scopes } = req.body

    if (!name || !user_id || !role) {
      res.status(400).json({ error: 'name, user_id, and role are required' })
      return
    }

    if (role === 'client' && !client_id) {
      res.status(400).json({ error: 'client_id is required for client API keys' })
      return
    }

    const id = uuid()
    const key = 'tbs_' + crypto.randomBytes(32).toString('hex')

    const { rows } = await pool.query(
      `INSERT INTO api_keys (id, key, name, user_id, role, client_id, scopes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, key, name, user_id, role, client_id || null, scopes || 'read']
    )

    // Return the full key only on creation — it won't be shown again
    res.status(201).json({ ...rows[0], full_key: key })
  } catch (err) {
    console.error('Error creating API key:', err)
    res.status(500).json({ error: 'Error al crear API key' })
  }
})

// DELETE /api/api-keys/:id — Delete/revoke API key
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rowCount } = await pool.query('DELETE FROM api_keys WHERE id = $1', [id])

    if (!rowCount) {
      res.status(404).json({ error: 'API key no encontrada' })
      return
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Error deleting API key:', err)
    res.status(500).json({ error: 'Error al eliminar API key' })
  }
})

// PATCH /api/api-keys/:id/toggle — Toggle active/inactive
router.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const { rows } = await pool.query(
      `UPDATE api_keys SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
       WHERE id = $1 RETURNING *`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ error: 'API key no encontrada' })
      return
    }

    res.json(rows[0])
  } catch (err) {
    console.error('Error toggling API key:', err)
    res.status(500).json({ error: 'Error al actualizar API key' })
  }
})

export default router
