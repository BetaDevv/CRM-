import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'
import { notifyTodoCompleted, notifyNoteAdded } from '../services/notificationService'
import { CalendarEventService } from '../services/calendarEventService'
import { TODO_STATUS, VALID_TODO_STATUSES } from '../constants'

const router = Router()
router.use(verifyToken)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (user.role === 'admin') {
      const { rows } = await pool.query(
        `SELECT t.*, COALESCE(n.cnt, 0)::int AS notes_count
         FROM todos t
         LEFT JOIN (SELECT item_id, COUNT(*) AS cnt FROM item_notes WHERE item_type='todo' AND author_id != $1 GROUP BY item_id) n ON n.item_id = t.id
         WHERE t.created_by IS NULL
            OR t.created_by = $1
            OR (t.shared = 1 AND t.created_by != $1)
         ORDER BY t.created_at DESC`,
        [user.userId]
      )
      res.json(rows)
    } else {
      const { rows } = await pool.query(
        `SELECT t.*, COALESCE(n.cnt, 0)::int AS notes_count
         FROM todos t
         LEFT JOIN (SELECT item_id, COUNT(*) AS cnt FROM item_notes WHERE item_type='todo' AND author_id != $1 GROUP BY item_id) n ON n.item_id = t.id
         WHERE t.created_by = $1
            OR (t.client_id = $2 AND t.shared = 1 AND (t.created_by IS NULL OR t.created_by != $1))
         ORDER BY t.created_at DESC`,
        [user.userId, user.clientId]
      )
      res.json(rows)
    }
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { title, description, priority, category, client_id, week_of, shared, start_time, end_time, status, assigned_to } = req.body
    const id = uuid()

    const finalClientId = user.role === 'client' ? user.clientId : (client_id || null)
    // For admin: if assigning to a client, auto-share. For client: use the shared flag from body
    const finalShared = user.role === 'admin'
      ? (finalClientId ? 1 : 0)
      : (shared ? 1 : 0)

    const { rows } = await pool.query(
      `INSERT INTO todos (id, title, description, priority, category, client_id, week_of, shared, created_by, start_time, end_time, status, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, title, description || null, priority || 'medium', category || 'General', finalClientId, week_of || null, finalShared, user.userId, start_time || null, end_time || null, status || TODO_STATUS.PENDING, assigned_to || null]
    )

    // Auto-create linked calendar event if time range provided
    if (start_time && end_time) {
      try {
        await CalendarEventService.createFromTodo({
          title,
          description,
          startTime: start_time,
          endTime: end_time,
          creatorId: user.userId,
          clientId: finalClientId,
          todoId: id,
        })
      } catch (eventErr) {
        console.error('Error creating linked calendar event:', eventErr)
      }
    }

    logActivity({ type: 'todo_created', description: `Nueva tarea: ${title}`, entityType: 'todo', entityId: id })
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { title, description, priority, category, client_id, done, shared, start_time, end_time, status, assigned_to } = req.body

    // Check ownership — both admin and client can only edit their own
    const { rows: existing } = await pool.query('SELECT created_by FROM todos WHERE id = $1', [req.params.id])
    if (!existing.length) { res.status(404).json({ error: 'Not found' }); return }
    if (existing[0].created_by && existing[0].created_by !== user.userId) {
      res.status(403).json({ error: 'Solo podés editar tus propios items' }); return
    }

    const finalClientId = user.role === 'client' ? user.clientId : (client_id || null)
    const finalShared = user.role === 'admin'
      ? (finalClientId ? 1 : (shared ? 1 : 0))
      : (shared ? 1 : 0)

    const doneVal = done ? 1 : 0
    const finalStatus = status || (doneVal ? TODO_STATUS.DONE : TODO_STATUS.PENDING)

    const { rows } = await pool.query(
      `UPDATE todos SET title=$1, description=$2, priority=$3, category=$4, client_id=$5, done=$6, shared=$7, start_time=$8, end_time=$9, status=$10, assigned_to=$11
       WHERE id=$12 RETURNING *`,
      [title, description || null, priority || 'medium', category || 'General', finalClientId, doneVal, finalShared, start_time || null, end_time || null, finalStatus, assigned_to || null, req.params.id]
    )

    // Update linked calendar event if time range provided
    if (start_time && end_time) {
      await CalendarEventService.updateFromTodo({
        todoId: req.params.id,
        title,
        description,
        startTime: start_time,
        endTime: end_time,
        clientId: finalClientId,
      })
    }

    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { rows: cur } = await pool.query('SELECT done, title FROM todos WHERE id = $1', [req.params.id])
    if (!cur.length) { res.status(404).json({ error: 'Not found' }); return }
    const newDone = cur[0].done ? 0 : 1
    const newStatus = newDone ? TODO_STATUS.DONE : TODO_STATUS.PENDING
    const { rows } = await pool.query('UPDATE todos SET done=$1, status=$2 WHERE id=$3 RETURNING *', [newDone, newStatus, req.params.id])
    logActivity({ type: 'todo_toggled', description: `Tarea ${newDone ? 'completada' : 'reabierta'}: ${cur[0].title}`, entityType: 'todo', entityId: req.params.id })

    // Notify client when todo is toggled to done
    if (newDone && rows[0].client_id) {
      notifyTodoCompleted({ id: req.params.id, title: rows[0].title, client_id: rows[0].client_id })
    }

    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/status', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!VALID_TODO_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' }); return
    }

    const done = status === TODO_STATUS.DONE ? 1 : 0
    const { rows } = await pool.query(
      'UPDATE todos SET status = $1, done = $2 WHERE id = $3 RETURNING *',
      [status, done, id]
    )

    if (rows.length === 0) { res.status(404).json({ error: 'Not found' }); return }

    // Notify client when todo is completed
    if (status === TODO_STATUS.DONE && rows[0].client_id) {
      notifyTodoCompleted({ id, title: rows[0].title, client_id: rows[0].client_id })
    }

    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!

    // Clients can only delete their own todos
    if (user.role === 'client') {
      const { rows: existing } = await pool.query('SELECT created_by FROM todos WHERE id = $1', [req.params.id])
      if (!existing.length) { res.status(404).json({ error: 'Not found' }); return }
      if (existing[0].created_by !== user.userId) { res.status(403).json({ error: 'No podés eliminar tareas que no creaste' }); return }
    }

    await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/todos/:id/notes — Get conversation notes
router.get('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM item_notes WHERE item_type = $1 AND item_id = $2 ORDER BY created_at ASC',
      ['todo', req.params.id]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/todos/:id/notes — Add a note to the conversation
router.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { content } = req.body
    if (!content?.trim()) { res.status(400).json({ error: 'Contenido requerido' }); return }

    // Verify todo exists
    const { rows: todoRows } = await pool.query('SELECT * FROM todos WHERE id = $1', [req.params.id])
    if (!todoRows.length) { res.status(404).json({ error: 'Not found' }); return }

    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO item_notes (id, item_type, item_id, author_id, author_name, content)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, 'todo', req.params.id, user.userId, user.name, content.trim()]
    )

    // Notify the other party
    notifyNoteAdded({
      itemType: 'todo',
      itemId: req.params.id,
      item: todoRows[0],
      authorUserId: user.userId,
      authorName: user.name,
      content: content.trim(),
    })

    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
