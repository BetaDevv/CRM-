import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'
import { notifyAdmins } from '../services/notificationService'

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
    const { company, contact, email, phone, industry, budget, status, source, notes, probability } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO prospects (id, company, contact, email, phone, industry, budget, status, source, notes, probability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, company, contact, email, phone || null, industry || null, budget || null, status || 'new', source || 'Web', notes || null, probability ?? 0]
    )
    logActivity({ type: 'prospect_created', description: `Nuevo prospecto: ${company}`, entityType: 'prospect', entityId: id })
    notifyAdmins({
      type: 'prospect_new',
      title: 'Nuevo prospecto',
      description: `Nuevo prospecto: ${company}`,
      entityType: 'prospect',
      entityId: id,
      i18nKey: 'notifications.body.prospectNew',
      i18nParams: { company },
    })
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { company, contact, email, phone, industry, budget, status, source, notes, probability } = req.body
    const { rows } = await pool.query(
      `UPDATE prospects SET company=$1, contact=$2, email=$3, phone=$4, industry=$5,
       budget=$6, status=$7, source=$8, notes=$9, probability=$10 WHERE id=$11 RETURNING *`,
      [company, contact, email, phone || null, industry || null, budget || null, status || 'new', source || 'Web', notes || null, probability ?? 0, req.params.id]
    )
    logActivity({ type: 'prospect_updated', description: `Prospecto actualizado: ${company}`, entityType: 'prospect', entityId: req.params.id })
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Convert prospect to client
router.post('/:id/convert', async (req: AuthRequest, res: Response) => {
  try {
    const { rows: prospectRows } = await pool.query('SELECT * FROM prospects WHERE id = $1', [req.params.id])
    if (!prospectRows.length) { res.status(404).json({ error: 'Prospecto no encontrado' }); return }
    const prospect = prospectRows[0]
    if (prospect.status !== 'won') { res.status(400).json({ error: 'Solo se pueden convertir prospectos con status "won"' }); return }

    // Parse budget to number
    const budgetNum = parseFloat((prospect.budget || '0').replace(/[^0-9.,]/g, '').replace(',', '')) || 0

    const clientColors = ['#EA580C', '#7C3AED', '#F59E0B', '#34D399', '#60A5FA', '#F97316', '#EC4899']
    const color = clientColors[Math.floor(Math.random() * clientColors.length)]
    const clientId = uuid()
    const today = new Date().toISOString().split('T')[0]

    const { rows: clientRows } = await pool.query(
      `INSERT INTO clients (id, company, contact, email, phone, industry, monthly_fee, services, status, start_date, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [clientId, prospect.company, prospect.contact, prospect.email, prospect.phone || null, prospect.industry || null, budgetNum, '[]', 'active', today, color]
    )

    // Update prospect probability to 100 if not already
    await pool.query('UPDATE prospects SET probability = 100 WHERE id = $1', [req.params.id])

    logActivity({ type: 'prospect_converted', description: `Prospecto convertido a cliente: ${prospect.company}`, entityType: 'client', entityId: clientId })

    const client = { ...clientRows[0], services: JSON.parse(clientRows[0].services || '[]'), linkedin_connected: !!clientRows[0].linkedin_connected }
    res.status(201).json(client)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows: cur } = await pool.query('SELECT company FROM prospects WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM prospects WHERE id = $1', [req.params.id])
    if (cur.length) logActivity({ type: 'prospect_deleted', description: `Prospecto eliminado: ${cur[0].company}`, entityType: 'prospect', entityId: req.params.id })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
