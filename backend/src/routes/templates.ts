import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'

const router = Router()

function parseTemplate(row: any) {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    variables: JSON.parse(row.variables || '[]'),
  }
}

// GET /api/templates — list all (optional filters)
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, category, industry } = req.query
    let query = 'SELECT * FROM post_templates WHERE 1=1'
    const params: any[] = []
    let idx = 1

    if (platform) {
      query += ` AND platform = $${idx++}`
      params.push(platform)
    }
    if (category) {
      query += ` AND category = $${idx++}`
      params.push(category)
    }
    if (industry) {
      query += ` AND industry = $${idx++}`
      params.push(industry)
    }

    query += ' ORDER BY created_at DESC'
    const { rows } = await pool.query(query, params)
    res.json(rows.map(parseTemplate))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/templates — create (admin only)
router.post('/', verifyToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, platform, category, industry, tags, variables } = req.body
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO post_templates (id, title, content, platform, category, industry, tags, variables)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, title, content, platform || 'linkedin', category || 'general', industry || null, JSON.stringify(tags || []), JSON.stringify(variables || [])]
    )
    res.status(201).json(parseTemplate(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /api/templates/:id — update (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, platform, category, industry, tags, variables } = req.body
    const { rows } = await pool.query(
      `UPDATE post_templates SET title=$1, content=$2, platform=$3, category=$4, industry=$5, tags=$6, variables=$7
       WHERE id=$8 RETURNING *`,
      [title, content, platform || 'linkedin', category || 'general', industry || null, JSON.stringify(tags || []), JSON.stringify(variables || []), req.params.id]
    )
    if (rows.length === 0) {
      res.status(404).json({ error: 'Template no encontrado' })
      return
    }
    res.json(parseTemplate(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/templates/:id — delete (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM post_templates WHERE id = $1', [req.params.id])
    if (rowCount === 0) {
      res.status(404).json({ error: 'Template no encontrado' })
      return
    }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/templates/:id/use — render template with variables
router.post('/:id/use', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM post_templates WHERE id = $1', [req.params.id])
    if (rows.length === 0) {
      res.status(404).json({ error: 'Template no encontrado' })
      return
    }
    const template = rows[0]
    const vars: Record<string, string> = req.body.variables || {}

    let rendered = template.content
    for (const [key, value] of Object.entries(vars)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }

    res.json({ content: rendered, title: template.title, platform: template.platform })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
