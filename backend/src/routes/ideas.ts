import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'

const router = Router()
router.use(verifyToken, requireAdmin)

function parseIdea(i: any) {
  return { ...i, tags: JSON.parse(i.tags || '[]') }
}

router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ideas ORDER BY created_at DESC')
    res.json(rows.map(parseIdea))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, status, tags, emoji, client_id } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO ideas (id, title, description, status, tags, emoji, client_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, title, description || null, status || 'brainstorm', JSON.stringify(tags || []), emoji || '💡', client_id || null]
    )
    res.status(201).json(parseIdea(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, status, tags, emoji } = req.body
    const { rows } = await pool.query(
      `UPDATE ideas SET title=$1, description=$2, status=$3, tags=$4, emoji=$5 WHERE id=$6 RETURNING *`,
      [title, description || null, status || 'brainstorm', JSON.stringify(tags || []), emoji || '💡', req.params.id]
    )
    res.json(parseIdea(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req, res: Response) => {
  try {
    await pool.query('DELETE FROM ideas WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
