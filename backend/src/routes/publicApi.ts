import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyApiKey, requireAdminKey, ApiKeyRequest } from '../middleware/apiKey'
import { v4 as uuid } from 'uuid'

const router = Router()
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

// All routes require API key
router.use(verifyApiKey)

// ─── Helper: enforce client scope ──────────────────────────────────────────────
function enforceClientScope(req: ApiKeyRequest, res: Response, clientId: string | null): boolean {
  if (req.apiKey!.role === 'client' && req.apiKey!.clientId !== clientId) {
    res.status(403).json({ error: 'Access denied: you can only access your own data' })
    return false
  }
  return true
}

// ─── /me — Key info ────────────────────────────────────────────────────────────
router.get('/me', (req: ApiKeyRequest, res: Response) => {
  res.json({
    id: req.apiKey!.id,
    role: req.apiKey!.role,
    clientId: req.apiKey!.clientId,
    scopes: req.apiKey!.scopes,
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT-SCOPED ENDPOINTS (any API key)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /clients/:id — Get single client
router.get('/clients/:id', async (req: ApiKeyRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!enforceClientScope(req, res, id)) return

    const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [id])
    if (!rows.length) { res.status(404).json({ error: 'Client not found' }); return }

    const c = rows[0]
    c.services = JSON.parse(c.services || '[]')
    res.json(c)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /posts — List posts
router.get('/posts', async (req: ApiKeyRequest, res: Response) => {
  try {
    if (req.apiKey!.role === 'client') {
      const { rows } = await pool.query(
        'SELECT * FROM posts WHERE client_id = $1 ORDER BY created_at DESC',
        [req.apiKey!.clientId]
      )
      res.json(rows)
    } else {
      const { rows } = await pool.query('SELECT * FROM posts ORDER BY created_at DESC')
      res.json(rows)
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /plans — List plans
router.get('/plans', async (req: ApiKeyRequest, res: Response) => {
  try {
    if (req.apiKey!.role === 'client') {
      const { rows } = await pool.query(
        `SELECT p.*, json_agg(DISTINCT jsonb_build_object('id', m.id, 'title', m.title, 'date', m.date, 'completed', m.completed, 'category', m.category)) FILTER (WHERE m.id IS NOT NULL) as milestones
         FROM plans p
         LEFT JOIN milestones m ON m.plan_id = p.id
         WHERE p.client_id = $1
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [req.apiKey!.clientId]
      )
      res.json(rows)
    } else {
      const { rows } = await pool.query(
        `SELECT p.*, c.company as client_name,
         json_agg(DISTINCT jsonb_build_object('id', m.id, 'title', m.title, 'date', m.date, 'completed', m.completed, 'category', m.category)) FILTER (WHERE m.id IS NOT NULL) as milestones
         FROM plans p
         LEFT JOIN clients c ON p.client_id = c.id
         LEFT JOIN milestones m ON m.plan_id = p.id
         GROUP BY p.id, c.company
         ORDER BY p.created_at DESC`
      )
      res.json(rows)
    }
  } catch (err) {
    console.error('Public API plans error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /metrics/:clientId — Get metrics
router.get('/metrics/:clientId', async (req: ApiKeyRequest, res: Response) => {
  try {
    const { clientId } = req.params
    if (!enforceClientScope(req, res, clientId)) return

    const days = parseInt(req.query.days as string) || 30

    const { rows } = await pool.query(
      `SELECT * FROM metric_snapshots
       WHERE client_id = $1 AND snapshot_date >= NOW() - INTERVAL '1 day' * $2
       ORDER BY snapshot_date DESC`,
      [clientId, days]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /documents — List documents with file paths
router.get('/documents', async (req: ApiKeyRequest, res: Response) => {
  try {
    let rows: any[]
    if (req.apiKey!.role === 'client') {
      const result = await pool.query(
        `SELECT d.*, c.company as client_name FROM documents d
         LEFT JOIN clients c ON d.client_id = c.id
         WHERE d.client_id = $1
         ORDER BY d.created_at DESC`,
        [req.apiKey!.clientId]
      )
      rows = result.rows
    } else {
      const result = await pool.query(
        `SELECT d.*, c.company as client_name FROM documents d
         LEFT JOIN clients c ON d.client_id = c.id
         ORDER BY d.created_at DESC`
      )
      rows = result.rows
    }

    // Enrich with download_url
    const enriched = rows.map(d => ({
      id: d.id,
      original_name: d.original_name,
      mime_type: d.mime_type,
      size: d.size,
      path: d.path,
      download_url: `${BACKEND_URL}${d.path}`,
      client_id: d.client_id,
      client_name: d.client_name,
      category: d.category,
      created_at: d.created_at,
    }))

    res.json(enriched)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /documents/:id/path — Get specific document path
router.get('/documents/:id/path', async (req: ApiKeyRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id])

    if (!rows.length) { res.status(404).json({ error: 'Document not found' }); return }

    const doc = rows[0]
    if (req.apiKey!.role === 'client' && doc.client_id !== req.apiKey!.clientId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    res.json({
      id: doc.id,
      original_name: doc.original_name,
      mime_type: doc.mime_type,
      size: doc.size,
      path: doc.path,
      download_url: `${BACKEND_URL}${doc.path}`,
      client_id: doc.client_id,
      category: doc.category,
      created_at: doc.created_at,
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /events — List events
router.get('/events', async (req: ApiKeyRequest, res: Response) => {
  try {
    if (req.apiKey!.role === 'client') {
      const { rows } = await pool.query(
        'SELECT * FROM events WHERE client_id = $1 ORDER BY start_time DESC',
        [req.apiKey!.clientId]
      )
      res.json(rows)
    } else {
      const { rows } = await pool.query('SELECT * FROM events ORDER BY start_time DESC')
      res.json(rows)
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN-ONLY ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// --- Clients CRUD (admin) ---
router.get('/clients', requireAdminKey, async (_req: ApiKeyRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY company')
    rows.forEach(c => { c.services = JSON.parse(c.services || '[]') })
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/clients', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO clients (id, company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, company, contact, email, phone || null, industry || null, monthly_fee || 0,
       JSON.stringify(services || []), status || 'active', start_date || null, color || '#DC143C', description || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Public API create client error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/clients/:id', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { id } = req.params
    const { company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description } = req.body
    const { rows } = await pool.query(
      `UPDATE clients SET company=COALESCE($2,company), contact=COALESCE($3,contact), email=COALESCE($4,email),
       phone=COALESCE($5,phone), industry=COALESCE($6,industry), monthly_fee=COALESCE($7,monthly_fee),
       services=COALESCE($8,services), status=COALESCE($9,status), start_date=COALESCE($10,start_date),
       color=COALESCE($11,color), description=COALESCE($12,description)
       WHERE id=$1 RETURNING *`,
      [id, company, contact, email, phone, industry, monthly_fee,
       services ? JSON.stringify(services) : null, status, start_date, color, description]
    )
    if (!rows.length) { res.status(404).json({ error: 'Client not found' }); return }
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/clients/:id', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rowCount } = await pool.query('DELETE FROM clients WHERE id = $1', [id])
    if (!rowCount) { res.status(404).json({ error: 'Client not found' }); return }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- Prospects CRUD (admin) ---
router.get('/prospects', requireAdminKey, async (_req: ApiKeyRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM prospects ORDER BY created_at DESC')
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/prospects', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { company, contact, email, phone, industry, budget, status, source, notes, probability } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO prospects (id, company, contact, email, phone, industry, budget, status, source, notes, probability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, company, contact, email, phone || null, industry || null, budget || null,
       status || 'new', source || 'API', notes || null, probability || 0]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Public API create prospect error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/prospects/:id', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { id } = req.params
    const { company, contact, email, phone, industry, budget, status, source, notes, probability } = req.body
    const { rows } = await pool.query(
      `UPDATE prospects SET company=COALESCE($2,company), contact=COALESCE($3,contact), email=COALESCE($4,email),
       phone=COALESCE($5,phone), industry=COALESCE($6,industry), budget=COALESCE($7,budget),
       status=COALESCE($8,status), source=COALESCE($9,source), notes=COALESCE($10,notes), probability=COALESCE($11,probability)
       WHERE id=$1 RETURNING *`,
      [id, company, contact, email, phone, industry, budget, status, source, notes, probability]
    )
    if (!rows.length) { res.status(404).json({ error: 'Prospect not found' }); return }
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/prospects/:id', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rowCount } = await pool.query('DELETE FROM prospects WHERE id = $1', [id])
    if (!rowCount) { res.status(404).json({ error: 'Prospect not found' }); return }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- Posts (admin: create) ---
router.post('/posts', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { client_id, title, content, platform, scheduled_date, status, type } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO posts (id, client_id, title, content, platform, scheduled_date, status, type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, client_id, title, content || null, platform || 'linkedin',
       scheduled_date || null, status || 'pending', type || 'post']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Public API create post error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- Todos (admin) ---
router.get('/todos', requireAdminKey, async (_req: ApiKeyRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM todos ORDER BY created_at DESC')
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/todos', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { title, description, priority, category, client_id, week_of, due_date } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO todos (id, title, description, priority, category, client_id, week_of, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, title, description || null, priority || 'medium', category || 'General',
       client_id || null, week_of || null, due_date || null]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- Ideas (admin) ---
router.get('/ideas', requireAdminKey, async (_req: ApiKeyRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ideas ORDER BY created_at DESC')
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/ideas', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { title, description, status, tags, emoji, client_id } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO ideas (id, title, description, status, tags, emoji, client_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, title, description || null, status || 'brainstorm',
       JSON.stringify(tags || []), emoji || null, client_id || null]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- Users (admin) ---
router.get('/users', requireAdminKey, async (_req: ApiKeyRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, client_id, active, created_at, last_login FROM users ORDER BY created_at DESC'
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- Events (admin: create) ---
router.post('/events', requireAdminKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { title, description, start_time, end_time, all_day, color, client_id } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO events (id, title, description, start_time, end_time, all_day, color, creator_id, client_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, title, description || null, start_time, end_time, all_day || false,
       color || null, req.apiKey!.userId, client_id || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Public API create event error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
