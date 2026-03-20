import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(verifyToken)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const { rows } = await pool.query(
      'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1',
      [limit]
    )
    res.json(rows)
  } catch (err) {
    console.error('Error fetching activity:', err)
    res.status(500).json({ error: 'Error fetching activity' })
  }
})

export default router
