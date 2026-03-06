import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'

const router = Router()
router.use(verifyToken)

async function buildPlan(plan: any) {
  const { rows: milestones } = await pool.query('SELECT * FROM milestones WHERE plan_id = $1 ORDER BY sort_order', [plan.id])
  const { rows: kpis } = await pool.query('SELECT * FROM kpis WHERE plan_id = $1', [plan.id])
  return { ...plan, milestones, kpis }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let rows: any[]
    if (req.user!.role === 'client') {
      const result = await pool.query('SELECT * FROM plans WHERE client_id = $1 ORDER BY created_at DESC', [req.user!.clientId])
      rows = result.rows
    } else {
      const result = await pool.query('SELECT * FROM plans ORDER BY created_at DESC')
      rows = result.rows
    }
    res.json(await Promise.all(rows.map(buildPlan)))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, title, objective, start_date, end_date, milestones = [], kpis = [] } = req.body
    if (!client_id || !title) { res.status(400).json({ error: 'client_id y título requeridos' }); return }

    const planId = uuid()
    await pool.query(
      `INSERT INTO plans (id, client_id, title, objective, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6)`,
      [planId, client_id, title, objective || null, start_date || null, end_date || null]
    )
    for (const [i, m] of milestones.entries()) {
      await pool.query(
        `INSERT INTO milestones (id, plan_id, title, description, date, completed, category, sort_order) VALUES ($1,$2,$3,$4,$5,0,$6,$7)`,
        [uuid(), planId, m.title, m.description || null, m.date || null, m.category || 'strategy', i]
      )
    }
    for (const k of kpis) {
      await pool.query(
        `INSERT INTO kpis (id, plan_id, label, target, current_value) VALUES ($1,$2,$3,$4,$5)`,
        [uuid(), planId, k.label, k.target || null, k.current_value || null]
      )
    }
    const { rows } = await pool.query('SELECT * FROM plans WHERE id = $1', [planId])
    res.status(201).json(await buildPlan(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, objective, start_date, end_date } = req.body
    const { rows } = await pool.query(
      `UPDATE plans SET title=$1, objective=$2, start_date=$3, end_date=$4 WHERE id=$5 RETURNING *`,
      [title, objective || null, start_date || null, end_date || null, req.params.id]
    )
    if (!rows.length) { res.status(404).json({ error: 'Plan no encontrado' }); return }
    res.json(await buildPlan(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', requireAdmin, async (req, res: Response) => {
  try {
    await pool.query('DELETE FROM plans WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Milestone routes ─────────────────────────────────────────────────────────

router.post('/:planId/milestones', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, date, category } = req.body
    if (!title) { res.status(400).json({ error: 'Título requerido' }); return }
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as c FROM milestones WHERE plan_id = $1', [req.params.planId])
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO milestones (id, plan_id, title, description, date, completed, category, sort_order)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7) RETURNING *`,
      [id, req.params.planId, title, description || null, date || null, category || 'strategy', parseInt(countRows[0].c)]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:planId/milestones/:milestoneId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, date, category } = req.body
    const { rows } = await pool.query(
      `UPDATE milestones SET title=$1, description=$2, date=$3, category=$4
       WHERE id=$5 AND plan_id=$6 RETURNING *`,
      [title, description || null, date || null, category || 'strategy', req.params.milestoneId, req.params.planId]
    )
    if (!rows.length) { res.status(404).json({ error: 'Hito no encontrado' }); return }
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:planId/milestones/:milestoneId/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { rows: mRows } = await pool.query(
      'SELECT * FROM milestones WHERE id = $1 AND plan_id = $2',
      [req.params.milestoneId, req.params.planId]
    )
    if (!mRows.length) { res.status(404).json({ error: 'Hito no encontrado' }); return }
    const m = mRows[0]

    if (req.user!.role === 'client') {
      const { rows: pRows } = await pool.query('SELECT client_id FROM plans WHERE id = $1', [req.params.planId])
      if (!pRows.length || pRows[0].client_id !== req.user!.clientId) {
        res.status(403).json({ error: 'Sin acceso' }); return
      }
    }

    const { rows } = await pool.query(
      'UPDATE milestones SET completed=$1 WHERE id=$2 RETURNING *',
      [m.completed ? 0 : 1, m.id]
    )
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:planId/milestones/:milestoneId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM milestones WHERE id = $1 AND plan_id = $2', [req.params.milestoneId, req.params.planId])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── KPI routes ───────────────────────────────────────────────────────────────

router.post('/:planId/kpis', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { label, target, current_value } = req.body
    if (!label) { res.status(400).json({ error: 'Etiqueta requerida' }); return }
    const { rows } = await pool.query(
      `INSERT INTO kpis (id, plan_id, label, target, current_value) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [uuid(), req.params.planId, label, target || null, current_value || null]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:planId/kpis/:kpiId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { label, target, current_value } = req.body
    const { rows } = await pool.query(
      `UPDATE kpis SET label=$1, target=$2, current_value=$3 WHERE id=$4 AND plan_id=$5 RETURNING *`,
      [label, target || null, current_value || null, req.params.kpiId, req.params.planId]
    )
    if (!rows.length) { res.status(404).json({ error: 'KPI no encontrado' }); return }
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:planId/kpis/:kpiId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM kpis WHERE id = $1 AND plan_id = $2', [req.params.kpiId, req.params.planId])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
