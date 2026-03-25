import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'
import { sendNoteNotification } from '../services/emailService'

const router = Router()
router.use(verifyToken)

function parseIdea(i: any) {
  return { ...i, tags: JSON.parse(i.tags || '[]') }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (user.role === 'admin') {
      const { rows } = await pool.query(
        `SELECT i.*, COALESCE(n.cnt, 0)::int AS notes_count
         FROM ideas i
         LEFT JOIN (SELECT item_id, COUNT(*) AS cnt FROM item_notes WHERE item_type='idea' AND author_id != $1 GROUP BY item_id) n ON n.item_id = i.id
         WHERE i.created_by IS NULL
            OR i.created_by = $1
            OR (i.shared = 1 AND i.created_by != $1)
         ORDER BY i.created_at DESC`,
        [user.userId]
      )
      res.json(rows.map(parseIdea))
    } else {
      const { rows } = await pool.query(
        `SELECT i.*, COALESCE(n.cnt, 0)::int AS notes_count
         FROM ideas i
         LEFT JOIN (SELECT item_id, COUNT(*) AS cnt FROM item_notes WHERE item_type='idea' AND author_id != $1 GROUP BY item_id) n ON n.item_id = i.id
         WHERE i.created_by = $1
            OR (i.client_id = $2 AND i.shared = 1 AND (i.created_by IS NULL OR i.created_by != $1))
         ORDER BY i.created_at DESC`,
        [user.userId, user.clientId]
      )
      res.json(rows.map(parseIdea))
    }
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { title, description, status, tags, emoji, client_id, shared } = req.body
    const id = uuid()

    const finalClientId = user.role === 'client' ? user.clientId : (client_id || null)
    const finalShared = user.role === 'admin'
      ? (finalClientId ? 1 : 0)
      : (shared ? 1 : 0)

    const { rows } = await pool.query(
      `INSERT INTO ideas (id, title, description, status, tags, emoji, client_id, shared, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, title, description || null, status || 'brainstorm', JSON.stringify(tags || []), emoji || '💡', finalClientId, finalShared, user.userId]
    )
    logActivity({ type: 'idea_created', description: `Nueva idea: ${title}`, entityType: 'idea', entityId: id })
    res.status(201).json(parseIdea(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { title, description, status, tags, emoji, shared } = req.body

    // Check ownership — clients can only edit their own ideas, admins can edit all
    const { rows: existing } = await pool.query('SELECT created_by FROM ideas WHERE id = $1', [req.params.id])
    if (!existing.length) { res.status(404).json({ error: 'Not found' }); return }
    if (user.role !== 'admin' && existing[0].created_by && existing[0].created_by !== user.userId) {
      res.status(403).json({ error: 'Solo podés editar tus propios items' }); return
    }

    const finalShared = shared ? 1 : 0

    const { rows } = await pool.query(
      `UPDATE ideas SET title=$1, description=$2, status=$3, tags=$4, emoji=$5, shared=$6 WHERE id=$7 RETURNING *`,
      [title, description || null, status || 'brainstorm', JSON.stringify(tags || []), emoji || '💡', finalShared, req.params.id]
    )
    logActivity({ type: 'idea_updated', description: `Idea actualizada: ${title}`, entityType: 'idea', entityId: req.params.id })
    res.json(parseIdea(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!

    // Clients can only delete their own ideas
    if (user.role === 'client') {
      const { rows: existing } = await pool.query('SELECT created_by FROM ideas WHERE id = $1', [req.params.id])
      if (!existing.length) { res.status(404).json({ error: 'Not found' }); return }
      if (existing[0].created_by !== user.userId) { res.status(403).json({ error: 'No podés eliminar ideas que no creaste' }); return }
    }

    await pool.query('DELETE FROM ideas WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/ideas/:id/notes — Get conversation notes
router.get('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM item_notes WHERE item_type = $1 AND item_id = $2 ORDER BY created_at ASC',
      ['idea', req.params.id]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/ideas/:id/notes — Add a note to the conversation
router.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { content } = req.body
    if (!content?.trim()) { res.status(400).json({ error: 'Contenido requerido' }); return }

    // Verify idea exists
    const { rows: ideaRows } = await pool.query('SELECT * FROM ideas WHERE id = $1', [req.params.id])
    if (!ideaRows.length) { res.status(404).json({ error: 'Not found' }); return }

    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO item_notes (id, item_type, item_id, author_id, author_name, content)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, 'idea', req.params.id, user.userId, user.name, content.trim()]
    )

    // Create notification for the OTHER party
    const idea = ideaRows[0]
    if (idea.created_by && idea.created_by !== user.userId) {
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuid(), idea.created_by, 'note_added', 'Nueva nota en tu idea', `${user.name}: ${content.trim().substring(0, 100)}`, 'idea', req.params.id]
      )
      const { rows: ownerRows } = await pool.query('SELECT email, name FROM users WHERE id = $1', [idea.created_by])
      if (ownerRows.length) {
        sendNoteNotification({
          to: ownerRows[0].email,
          recipientName: ownerRows[0].name,
          senderName: user.name,
          itemType: 'idea',
          itemTitle: idea.title,
          note: content.trim(),
        })
      }
    } else if (idea.shared && idea.client_id) {
      const { rows: adminRows } = await pool.query("SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 1")
      if (adminRows.length) {
        await pool.query(
          `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuid(), adminRows[0].id, 'note_added', 'Nueva nota en idea compartida', `${user.name}: ${content.trim().substring(0, 100)}`, 'idea', req.params.id]
        )
        sendNoteNotification({
          to: adminRows[0].email,
          recipientName: adminRows[0].name,
          senderName: user.name,
          itemType: 'idea',
          itemTitle: idea.title,
          note: content.trim(),
        })
      }
    }

    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
