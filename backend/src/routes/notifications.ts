import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(verifyToken)

// GET /api/notifications — user's notifications (latest 50)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.userId]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/notifications/unread — unread count
router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = 0',
      [req.user!.userId]
    )
    res.json({ count: rows[0].count })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.userId]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = $1 AND is_read = 0',
      [req.user!.userId]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
