import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'

const router = Router()
router.use(verifyToken, requireAdmin)

router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM prospects ORDER BY created_at DESC')
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { company, contact, email, phone, industry, budget, status, source, notes } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO prospects (id, company, contact, email, phone, industry, budget, status, source, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, company, contact, email, phone || null, industry || null, budget || null, status || 'new', source || 'Web', notes || null]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { company, contact, email, phone, industry, budget, status, source, notes } = req.body
    const { rows } = await pool.query(
      `UPDATE prospects SET company=$1, contact=$2, email=$3, phone=$4, industry=$5,
       budget=$6, status=$7, source=$8, notes=$9 WHERE id=$10 RETURNING *`,
      [company, contact, email, phone || null, industry || null, budget || null, status || 'new', source || 'Web', notes || null, req.params.id]
    )
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM prospects WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
