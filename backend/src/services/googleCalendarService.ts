import { google } from 'googleapis'
import { pool } from '../db'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/oauth/callback'
)

export function getAuthUrl(userId: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: userId,
  })
}

export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
  const { tokens } = await oauth2Client.getToken(code)
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token!,
    expiry_date: tokens.expiry_date || Date.now() + 3600000,
  }
}

async function getAuthClient(userId: string) {
  const result = await pool.query('SELECT * FROM google_calendar_connections WHERE user_id = $1', [userId])
  if (result.rows.length === 0) return null

  const conn = result.rows[0]
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expiry_date: new Date(conn.token_expires_at).getTime(),
  })

  // Auto-refresh if expired
  client.on('tokens', async (tokens) => {
    await pool.query(
      'UPDATE google_calendar_connections SET access_token = $1, token_expires_at = $2 WHERE user_id = $3',
      [tokens.access_token, new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(), userId]
    )
  })

  return client
}

export async function createGoogleEvent(userId: string, event: {
  title: string; description?: string; startTime: string; endTime: string; attendees?: string[]
}): Promise<string | null> {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.startTime, timeZone: 'America/Bogota' },
        end: { dateTime: event.endTime, timeZone: 'America/Bogota' },
        attendees: event.attendees?.map(email => ({ email })),
      },
    })
    return res.data.id || null
  } catch (err) {
    console.error('[GoogleCalendar] Error creating event:', err)
    return null
  }
}

export async function updateGoogleEvent(userId: string, googleEventId: string, event: {
  title?: string; description?: string; startTime?: string; endTime?: string;
}): Promise<boolean> {
  const auth = await getAuthClient(userId)
  if (!auth) return false

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const body: any = {}
    if (event.title) body.summary = event.title
    if (event.description !== undefined) body.description = event.description
    if (event.startTime) body.start = { dateTime: event.startTime, timeZone: 'America/Bogota' }
    if (event.endTime) body.end = { dateTime: event.endTime, timeZone: 'America/Bogota' }

    await calendar.events.patch({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: body,
    })
    return true
  } catch (err) {
    console.error('[GoogleCalendar] Error updating event:', err)
    return false
  }
}

export async function deleteGoogleEvent(userId: string, googleEventId: string): Promise<boolean> {
  const auth = await getAuthClient(userId)
  if (!auth) return false

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId })
    return true
  } catch (err) {
    console.error('[GoogleCalendar] Error deleting event:', err)
    return false
  }
}

export async function syncFromGoogle(userId: string): Promise<any[]> {
  const auth = await getAuthClient(userId)
  if (!auth) return []

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const now = new Date()
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      timeMax: new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    })
    return res.data.items || []
  } catch (err) {
    console.error('[GoogleCalendar] Error syncing:', err)
    return []
  }
}

export async function isConnected(userId: string): Promise<boolean> {
  const result = await pool.query('SELECT id FROM google_calendar_connections WHERE user_id = $1', [userId])
  return result.rows.length > 0
}
