import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(verifyToken)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20

    // Client users: scope strictly to their company's client_id.
    // activity_log has no client_id column, so derive it by joining to the
    // related entity (based on entity_type + entity_id).
    if (req.user?.role === 'client') {
      const clientId = req.user.clientId
      if (!clientId) {
        res.json([])
        return
      }
      const { rows } = await pool.query(
        `SELECT a.* FROM activity_log a
         WHERE (
           (a.entity_type = 'client'   AND a.entity_id = $1)
           OR (a.entity_type = 'todo'     AND a.entity_id IN (SELECT id FROM todos     WHERE client_id = $1))
           OR (a.entity_type = 'idea'     AND a.entity_id IN (SELECT id FROM ideas     WHERE client_id = $1))
           OR (a.entity_type = 'post'     AND a.entity_id IN (SELECT id FROM posts     WHERE client_id = $1))
           OR (a.entity_type = 'document' AND a.entity_id IN (SELECT id FROM documents WHERE client_id = $1))
           OR (a.entity_type = 'event'    AND a.entity_id IN (SELECT id FROM events    WHERE client_id = $1))
         )
         ORDER BY a.created_at DESC
         LIMIT $2`,
        [clientId, limit]
      )
      res.json(rows)
      return
    }

    // Admin (and any non-client role): preserve existing global behavior.
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
