import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'

const router = Router()
router.use(verifyToken, requireAdmin)

router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM todos ORDER BY created_at DESC')
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, category, client_id, week_of, due_date } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO todos (id, title, description, priority, category, client_id, week_of, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, title, description || null, priority || 'medium', category || 'General', client_id || null, week_of || null, due_date || null]
    )
    logActivity({ type: 'todo_created', description: `Nueva tarea: ${title}`, entityType: 'todo', entityId: id })
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, category, client_id, done, due_date } = req.body
    const { rows } = await pool.query(
      `UPDATE todos SET title=$1, description=$2, priority=$3, category=$4, client_id=$5, done=$6, due_date=$7
       WHERE id=$8 RETURNING *`,
      [title, description || null, priority || 'medium', category || 'General', client_id || null, done ? 1 : 0, due_date || null, req.params.id]
    )
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/toggle', async (req, res: Response) => {
  try {
    const { rows: cur } = await pool.query('SELECT done, title FROM todos WHERE id = $1', [req.params.id])
    if (!cur.length) { res.status(404).json({ error: 'Not found' }); return }
    const newDone = cur[0].done ? 0 : 1
    const { rows } = await pool.query('UPDATE todos SET done=$1 WHERE id=$2 RETURNING *', [newDone, req.params.id])
    logActivity({ type: 'todo_toggled', description: `Tarea ${newDone ? 'completada' : 'reabierta'}: ${cur[0].title}`, entityType: 'todo', entityId: req.params.id })
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req, res: Response) => {
  try {
    await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
