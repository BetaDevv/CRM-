import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'
import { sendEventInvite } from '../services/emailService'
import { createNotification } from '../services/notificationService'
import * as googleCal from '../services/googleCalendarService'
import * as microsoftCal from '../services/microsoftCalendarService'

const router = Router()

// ─── GET /oauth/callback — Google OAuth callback (NO auth required) ─────────
router.get('/oauth/callback', async (req, res: Response) => {
  const { code, state: userId, error } = req.query as Record<string, string>
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

  if (error) {
    res.redirect(`${FRONTEND_URL}/calendario?google=error&message=${encodeURIComponent(error)}`)
    return
  }

  if (!code || !userId) {
    res.redirect(`${FRONTEND_URL}/calendario?google=error&message=missing_params`)
    return
  }

  try {
    const tokens = await googleCal.exchangeCode(code)
    const id = uuid()

    await pool.query(
      `INSERT INTO google_calendar_connections (id, user_id, access_token, refresh_token, token_expires_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at`,
      [id, userId, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date).toISOString()]
    )

    res.redirect(`${FRONTEND_URL}/calendario?google=connected`)
  } catch (err) {
    console.error('Error in Google OAuth callback:', err)
    res.redirect(`${FRONTEND_URL}/calendario?google=error&message=token_exchange_failed`)
  }
})

// ─── GET /microsoft/callback — Microsoft OAuth callback (NO auth required) ──
router.get('/microsoft/callback', async (req, res: Response) => {
  console.log('[MicrosoftOAuth] Callback received, query:', req.query)
  const { code, state: userId, error, error_description } = req.query as Record<string, string>
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

  if (error) {
    console.error('[MicrosoftOAuth] Error from Microsoft:', error, error_description)
    res.redirect(`${FRONTEND_URL}/calendario?microsoft=error&message=${encodeURIComponent(error_description || error)}`)
    return
  }

  if (!code || !userId) {
    console.error('[MicrosoftOAuth] Missing code or userId:', { code: !!code, userId })
    res.redirect(`${FRONTEND_URL}/calendario?microsoft=error&message=missing_params`)
    return
  }

  try {
    console.log('[MicrosoftOAuth] Exchanging code for tokens...')
    const tokens = await microsoftCal.exchangeCode(code)
    console.log('[MicrosoftOAuth] Tokens received, refresh_token:', !!tokens.refresh_token)
    const id = uuid()

    await pool.query(
      `INSERT INTO microsoft_calendar_connections (id, user_id, access_token, refresh_token, token_expires_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at`,
      [id, userId, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date).toISOString()]
    )

    console.log('[MicrosoftOAuth] Connection saved for user:', userId)
    res.redirect(`${FRONTEND_URL}/calendario?microsoft=connected`)
  } catch (err) {
    console.error('[MicrosoftOAuth] Error exchanging token:', err)
    res.redirect(`${FRONTEND_URL}/calendario?microsoft=error&message=token_exchange_failed`)
  }
})

// All other routes require auth
router.use(verifyToken)

// ─── GET /events — list events for current user ─────────────────────────────
router.get('/events', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const { start, end } = req.query as { start?: string; end?: string }

    const clientId = req.user!.clientId || null

    const { rows } = await pool.query(
      `SELECT e.*,
        u_creator.name AS created_by_name,
        u_creator.avatar AS created_by_avatar,
        COALESCE(
          (SELECT json_agg(json_build_object('id', ep2.user_id, 'status', ep2.status, 'name', u2.name, 'email', u2.email))
           FROM event_participants ep2
           JOIN users u2 ON ep2.user_id = u2.id
           WHERE ep2.event_id = e.id), '[]'::json
        ) as participants,
        (SELECT json_build_object('title', ms.title, 'category', ms.category, 'date', ms.date)
         FROM milestones ms WHERE ms.id = e.milestone_id) as milestone
      FROM events e
      LEFT JOIN users u_creator ON u_creator.id = e.creator_id
      WHERE (
        e.creator_id = $1
        OR e.id IN (SELECT ep.event_id FROM event_participants ep WHERE ep.user_id = $1)
        OR ($4::text IS NOT NULL AND e.client_id = $4)
      )
        AND ($2::timestamptz IS NULL OR e.end_time > $2)
        AND ($3::timestamptz IS NULL OR e.start_time < $3)
      ORDER BY e.start_time ASC`,
      [userId, start || null, end || null, clientId]
    )

    res.json(rows)
  } catch (err) {
    console.error('Error fetching events:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── POST /events — create event ────────────────────────────────────────────
router.post('/events', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const {
      title, description, start_time, end_time, all_day,
      color, client_id, todo_id, milestone_id, is_shared, participants,
    } = req.body

    const id = uuid()

    const { rows } = await pool.query(
      `INSERT INTO events (id, title, description, start_time, end_time, all_day, color, creator_id, client_id, todo_id, milestone_id, is_shared)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, title, description || null, start_time, end_time, all_day || false, color || null, userId, client_id || null, todo_id || null, milestone_id || null, is_shared || false]
    )

    const event = rows[0]
    const participantList: any[] = []

    // Insert participants
    if (participants && Array.isArray(participants) && participants.length > 0) {
      for (const pUserId of participants) {
        const epId = uuid()
        await pool.query(
          `INSERT INTO event_participants (id, event_id, user_id, status)
           VALUES ($1,$2,$3,'pending') ON CONFLICT (event_id, user_id) DO NOTHING`,
          [epId, id, pUserId]
        )

        // Get participant info for response and email
        const { rows: userRows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [pUserId])
        if (userRows.length > 0) {
          participantList.push({ id: pUserId, status: 'pending', name: userRows[0].name, email: userRows[0].email })

          // Send email invite (non-blocking)
          if (is_shared) {
            sendEventInvite({
              to: userRows[0].email,
              eventTitle: title,
              eventDescription: description,
              startTime: start_time,
              endTime: end_time,
              organizerName: req.user!.name,
            }).catch(err => console.error('[Email] Error:', err))
          }
        }
      }
    }

    // Create in Google Calendar (non-blocking)
    googleCal.isConnected(userId).then(async (connected) => {
      if (!connected) return
      const attendeeEmails = participantList.map(p => p.email)
      const googleEventId = await googleCal.createGoogleEvent(userId, {
        title,
        description,
        startTime: start_time,
        endTime: end_time,
        attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      })
      if (googleEventId) {
        await pool.query('UPDATE events SET google_event_id = $1 WHERE id = $2', [googleEventId, id])
      }
    }).catch(err => console.error('[GoogleCalendar] Error:', err))

    // Create in Microsoft Calendar (non-blocking)
    console.log('[MicrosoftCalendar] Checking connection for user:', userId)
    microsoftCal.isConnected(userId).then(async (connected) => {
      console.log('[MicrosoftCalendar] isConnected:', connected)
      if (!connected) return
      const attendeeEmails = participantList.map(p => p.email)
      console.log('[MicrosoftCalendar] Creating event:', { title, start_time, end_time })
      const microsoftEventId = await microsoftCal.createMicrosoftEvent(userId, {
        title,
        description,
        startTime: start_time,
        endTime: end_time,
        attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      })
      console.log('[MicrosoftCalendar] Result:', microsoftEventId)
      if (microsoftEventId) {
        await pool.query('UPDATE events SET microsoft_event_id = $1 WHERE id = $2', [microsoftEventId, id])
        console.log('[MicrosoftCalendar] Event ID saved to DB')
      } else {
        console.warn('[MicrosoftCalendar] createMicrosoftEvent returned null — check service logs above')
      }
    }).catch(err => console.error('[MicrosoftCalendar] Error:', err))

    logActivity({ type: 'event_created', description: `Nuevo evento: ${title}`, entityType: 'event', entityId: id, actor: req.user!.name })

    res.status(201).json({ ...event, participants: participantList })
  } catch (err) {
    console.error('Error creating event:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── PUT /events/:id — update event ─────────────────────────────────────────
router.put('/events/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const eventId = req.params.id

    // Check ownership or admin
    const { rows: existing } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (!existing.length) { res.status(404).json({ error: 'Evento no encontrado' }); return }
    if (existing[0].creator_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'No tienes permiso para editar este evento' }); return
    }

    const {
      title, description, start_time, end_time, all_day,
      color, client_id, todo_id, milestone_id, is_shared,
    } = req.body

    const { rows } = await pool.query(
      `UPDATE events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time),
        all_day = COALESCE($5, all_day),
        color = COALESCE($6, color),
        client_id = $7,
        todo_id = $8,
        milestone_id = $9,
        is_shared = COALESCE($10, is_shared),
        updated_at = NOW()
      WHERE id = $11 RETURNING *`,
      [title, description, start_time, end_time, all_day, color, client_id ?? existing[0].client_id, todo_id ?? existing[0].todo_id, milestone_id ?? existing[0].milestone_id, is_shared, eventId]
    )

    // Update Google Calendar event (non-blocking)
    if (existing[0].google_event_id) {
      googleCal.updateGoogleEvent(userId, existing[0].google_event_id, {
        title, description, startTime: start_time, endTime: end_time,
      }).catch(err => console.error('[GoogleCalendar] Update error:', err))
    }

    // Update Microsoft Calendar event (non-blocking)
    if (existing[0].microsoft_event_id) {
      microsoftCal.updateMicrosoftEvent(userId, existing[0].microsoft_event_id, {
        title, description, startTime: start_time, endTime: end_time,
      }).catch(err => console.error('[MicrosoftCalendar] Update error:', err))
    }

    logActivity({ type: 'event_updated', description: `Evento actualizado: ${rows[0].title}`, entityType: 'event', entityId: eventId, actor: req.user!.name })

    res.json(rows[0])
  } catch (err) {
    console.error('Error updating event:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── DELETE /events/:id — delete event ───────────────────────────────────────
router.delete('/events/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const eventId = req.params.id

    const { rows: existing } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (!existing.length) { res.status(404).json({ error: 'Evento no encontrado' }); return }
    if (existing[0].creator_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'No tienes permiso para eliminar este evento' }); return
    }

    // Delete from Google Calendar (non-blocking)
    if (existing[0].google_event_id) {
      googleCal.deleteGoogleEvent(userId, existing[0].google_event_id)
        .catch(err => console.error('[GoogleCalendar] Delete error:', err))
    }

    // Delete from Microsoft Calendar (non-blocking)
    if (existing[0].microsoft_event_id) {
      microsoftCal.deleteMicrosoftEvent(userId, existing[0].microsoft_event_id)
        .catch(err => console.error('[MicrosoftCalendar] Delete error:', err))
    }

    await pool.query('DELETE FROM events WHERE id = $1', [eventId])

    logActivity({ type: 'event_deleted', description: `Evento eliminado: ${existing[0].title}`, entityType: 'event', entityId: eventId, actor: req.user!.name })

    res.json({ ok: true })
  } catch (err) {
    console.error('Error deleting event:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── PATCH /events/:id/client-note — client adds note to event ───────────────
router.patch('/events/:id/client-note', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const eventId = req.params.id
    const { note } = req.body as { note: string }

    // Fetch event
    const { rows: existing } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (!existing.length) { res.status(404).json({ error: 'Evento no encontrado' }); return }

    const event = existing[0]

    // Verify: user is participant OR event.client_id matches user's clientId
    const { rows: userRows } = await pool.query('SELECT client_id FROM users WHERE id = $1', [userId])
    const userClientId = userRows[0]?.client_id

    const { rows: participantRows } = await pool.query(
      'SELECT 1 FROM event_participants WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    )

    const isParticipant = participantRows.length > 0
    const isClientMatch = userClientId && event.client_id === userClientId
    const isCreator = event.creator_id === userId

    if (!isParticipant && !isClientMatch && !isCreator) {
      res.status(403).json({ error: 'No tienes permiso para agregar notas a este evento' }); return
    }

    // Update client_note
    const { rows: updated } = await pool.query(
      `UPDATE events SET client_note = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [note || null, eventId]
    )

    // Notify event creator (admin) if note was added by someone else
    if (event.creator_id !== userId && note) {
      createNotification({
        userId: event.creator_id,
        type: 'event_note',
        title: 'Nota de cliente en evento',
        description: `El cliente agregó una nota al evento: ${event.title}`,
        entityType: 'event',
        entityId: eventId,
        i18nKey: 'notifications.body.eventNote',
        i18nParams: { title: event.title },
      }).catch(err => console.error('Error creating notification:', err))
    }

    res.json(updated[0])
  } catch (err) {
    console.error('Error adding client note:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── POST /events/:id/participants — add participants ────────────────────────
router.post('/events/:id/participants', async (req: AuthRequest, res: Response) => {
  try {
    const eventId = req.params.id
    const { participants } = req.body as { participants: string[] }

    const { rows: existing } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (!existing.length) { res.status(404).json({ error: 'Evento no encontrado' }); return }

    const added: any[] = []
    for (const pUserId of participants) {
      const epId = uuid()
      await pool.query(
        `INSERT INTO event_participants (id, event_id, user_id, status)
         VALUES ($1,$2,$3,'pending') ON CONFLICT (event_id, user_id) DO NOTHING`,
        [epId, eventId, pUserId]
      )

      const { rows: userRows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [pUserId])
      if (userRows.length > 0) {
        added.push({ id: pUserId, status: 'pending', name: userRows[0].name, email: userRows[0].email })

        // Send email invite (non-blocking)
        sendEventInvite({
          to: userRows[0].email,
          eventTitle: existing[0].title,
          eventDescription: existing[0].description,
          startTime: existing[0].start_time,
          endTime: existing[0].end_time,
          organizerName: req.user!.name,
        }).catch(err => console.error('[Email] Error:', err))
      }
    }

    res.status(201).json(added)
  } catch (err) {
    console.error('Error adding participants:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── DELETE /events/:id/participants/:userId — remove participant ────────────
router.delete('/events/:id/participants/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { id: eventId, userId: targetUserId } = req.params
    await pool.query(
      'DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2',
      [eventId, targetUserId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('Error removing participant:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── GET /google/connect — get Google OAuth URL ──────────────────────────────
router.get('/google/connect', async (req: AuthRequest, res: Response) => {
  try {
    const url = googleCal.getAuthUrl(req.user!.userId)
    res.json({ url })
  } catch (err) {
    console.error('Error getting Google auth URL:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// (OAuth callback moved above verifyToken middleware)

// ─── POST /google/sync — sync events from Google Calendar ───────────────────
router.post('/google/sync', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const googleEvents = await googleCal.syncFromGoogle(userId)

    let imported = 0
    for (const gEvent of googleEvents) {
      if (!gEvent.id || !gEvent.summary) continue

      // Check if already imported
      const { rows: existing } = await pool.query(
        'SELECT id FROM events WHERE google_event_id = $1 AND creator_id = $2',
        [gEvent.id, userId]
      )

      if (existing.length > 0) {
        // Update existing
        await pool.query(
          `UPDATE events SET
            title = $1, description = $2,
            start_time = $3, end_time = $4,
            updated_at = NOW()
          WHERE google_event_id = $5 AND creator_id = $6`,
          [
            gEvent.summary,
            gEvent.description || null,
            gEvent.start?.dateTime || gEvent.start?.date,
            gEvent.end?.dateTime || gEvent.end?.date,
            gEvent.id,
            userId,
          ]
        )
      } else {
        // Insert new
        const id = uuid()
        const allDay = !gEvent.start?.dateTime
        await pool.query(
          `INSERT INTO events (id, title, description, start_time, end_time, all_day, creator_id, google_event_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            gEvent.summary,
            gEvent.description || null,
            gEvent.start?.dateTime || gEvent.start?.date,
            gEvent.end?.dateTime || gEvent.end?.date,
            allDay,
            userId,
            gEvent.id,
          ]
        )
        imported++
      }
    }

    res.json({ ok: true, imported, total: googleEvents.length })
  } catch (err) {
    console.error('Error syncing from Google:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── GET /google/status — check Google Calendar connection ───────────────────
router.get('/google/status', async (req: AuthRequest, res: Response) => {
  try {
    const connected = await googleCal.isConnected(req.user!.userId)
    res.json({ connected })
  } catch (err) {
    console.error('Error checking Google status:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── DELETE /google/disconnect — remove Google Calendar connection ───────────
router.delete('/google/disconnect', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM google_calendar_connections WHERE user_id = $1', [req.user!.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error('Error disconnecting Google:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── GET /microsoft/connect — get Microsoft OAuth URL ───────────────────────
router.get('/microsoft/connect', async (req: AuthRequest, res: Response) => {
  try {
    const url = microsoftCal.getAuthUrl(req.user!.userId)
    res.json({ url })
  } catch (err) {
    console.error('Error getting Microsoft auth URL:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── POST /microsoft/sync — sync events from Microsoft Calendar ─────────────
router.post('/microsoft/sync', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const msEvents = await microsoftCal.syncFromMicrosoft(userId)

    let imported = 0
    for (const msEvent of msEvents) {
      if (!msEvent.id || !msEvent.subject) continue

      // Check if already imported
      const { rows: existing } = await pool.query(
        'SELECT id FROM events WHERE microsoft_event_id = $1 AND creator_id = $2',
        [msEvent.id, userId]
      )

      const startTime = msEvent.start?.dateTime || null
      const endTime = msEvent.end?.dateTime || null

      if (existing.length > 0) {
        // Update existing
        await pool.query(
          `UPDATE events SET
            title = $1, description = $2,
            start_time = $3, end_time = $4,
            updated_at = NOW()
          WHERE microsoft_event_id = $5 AND creator_id = $6`,
          [
            msEvent.subject,
            msEvent.bodyPreview || null,
            startTime,
            endTime,
            msEvent.id,
            userId,
          ]
        )
      } else {
        // Insert new
        const id = uuid()
        const allDay = msEvent.isAllDay || false
        await pool.query(
          `INSERT INTO events (id, title, description, start_time, end_time, all_day, creator_id, microsoft_event_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            msEvent.subject,
            msEvent.bodyPreview || null,
            startTime,
            endTime,
            allDay,
            userId,
            msEvent.id,
          ]
        )
        imported++
      }
    }

    res.json({ ok: true, imported, total: msEvents.length })
  } catch (err) {
    console.error('Error syncing from Microsoft:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── GET /microsoft/status — check Microsoft Calendar connection ────────────
router.get('/microsoft/status', async (req: AuthRequest, res: Response) => {
  try {
    const connected = await microsoftCal.isConnected(req.user!.userId)
    res.json({ connected })
  } catch (err) {
    console.error('Error checking Microsoft status:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── DELETE /microsoft/disconnect — remove Microsoft Calendar connection ─────
router.delete('/microsoft/disconnect', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM microsoft_calendar_connections WHERE user_id = $1', [req.user!.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error('Error disconnecting Microsoft:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── GET /users — list all users for participant picker ──────────────────────
router.get('/users', async (_req, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE active = 1 ORDER BY name ASC')
    res.json(rows)
  } catch (err) {
    console.error('Error fetching users:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
