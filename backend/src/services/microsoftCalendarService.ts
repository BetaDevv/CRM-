import { Client } from '@microsoft/microsoft-graph-client'
import { pool } from '../db'

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || ''
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || ''
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/calendar/microsoft/callback'
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common'

const SCOPES = ['Calendars.ReadWrite', 'offline_access', 'User.Read']

const TOKEN_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`

// ─── Generate OAuth URL ─────────────────────────────────────────────────────
export function getAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state: userId,
    response_mode: 'query',
  })
  return `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?${params}`
}

// ─── Exchange auth code for tokens ──────────────────────────────────────────
export async function exchangeCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
}> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const data = await response.json() as Record<string, any>
  if (data.error) {
    throw new Error(`Microsoft token exchange error: ${data.error_description || data.error}`)
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + (data.expires_in || 3600) * 1000,
  }
}

// ─── Refresh access token ───────────────────────────────────────────────────
async function refreshAccessToken(userId: string, refreshToken: string): Promise<{ access_token: string; expiry_date: number } | null> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES.join(' '),
      }),
    })

    const data = await response.json() as Record<string, any>
    if (data.error) {
      console.error('[MicrosoftCalendar] Token refresh error:', data.error_description || data.error)
      return null
    }

    const expiry_date = Date.now() + (data.expires_in || 3600) * 1000

    // Update tokens in DB
    await pool.query(
      `UPDATE microsoft_calendar_connections SET access_token = $1, refresh_token = COALESCE($2, refresh_token), token_expires_at = $3 WHERE user_id = $4`,
      [data.access_token, data.refresh_token || null, new Date(expiry_date).toISOString(), userId]
    )

    return { access_token: data.access_token, expiry_date }
  } catch (err) {
    console.error('[MicrosoftCalendar] Token refresh failed:', err)
    return null
  }
}

// ─── Get authenticated Graph client for a user ─────────────────────────────
async function getGraphClient(userId: string): Promise<Client | null> {
  const result = await pool.query('SELECT * FROM microsoft_calendar_connections WHERE user_id = $1', [userId])
  if (result.rows.length === 0) return null

  const conn = result.rows[0]
  let accessToken = conn.access_token

  // Check if token is expired (or will expire in next 5 minutes)
  const expiresAt = new Date(conn.token_expires_at).getTime()
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(userId, conn.refresh_token)
    if (!refreshed) return null
    accessToken = refreshed.access_token
  }

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
  })
}

// ─── Create event in Microsoft Calendar ─────────────────────────────────────
export async function createMicrosoftEvent(
  userId: string,
  event: { title: string; description?: string; startTime: string; endTime: string; attendees?: string[] }
): Promise<string | null> {
  const client = await getGraphClient(userId)
  if (!client) return null

  try {
    const msEvent = {
      subject: event.title,
      body: { contentType: 'text' as const, content: event.description || '' },
      start: { dateTime: event.startTime, timeZone: 'UTC' },
      end: { dateTime: event.endTime, timeZone: 'UTC' },
      attendees: (event.attendees || []).map(email => ({
        emailAddress: { address: email },
        type: 'required' as const,
      })),
    }

    const result = await client.api('/me/events').post(msEvent)
    console.log('[MicrosoftCalendar] Event created:', result.id)
    return result.id || null
  } catch (err: any) {
    console.error('[MicrosoftCalendar] Error creating event:', err?.message || err?.code || err)
    return null
  }
}

// ─── Update event in Microsoft Calendar ─────────────────────────────────────
export async function updateMicrosoftEvent(
  userId: string,
  microsoftEventId: string,
  event: { title?: string; description?: string; startTime?: string; endTime?: string }
): Promise<boolean> {
  const client = await getGraphClient(userId)
  if (!client) return false

  try {
    const patch: any = {}
    if (event.title) patch.subject = event.title
    if (event.description !== undefined) patch.body = { contentType: 'text', content: event.description }
    if (event.startTime) patch.start = { dateTime: event.startTime, timeZone: 'UTC' }
    if (event.endTime) patch.end = { dateTime: event.endTime, timeZone: 'UTC' }

    await client.api(`/me/events/${microsoftEventId}`).patch(patch)
    return true
  } catch (err) {
    console.error('[MicrosoftCalendar] Error updating event:', err)
    return false
  }
}

// ─── Delete event from Microsoft Calendar ───────────────────────────────────
export async function deleteMicrosoftEvent(userId: string, microsoftEventId: string): Promise<boolean> {
  const client = await getGraphClient(userId)
  if (!client) return false

  try {
    await client.api(`/me/events/${microsoftEventId}`).delete()
    return true
  } catch (err) {
    console.error('[MicrosoftCalendar] Error deleting event:', err)
    return false
  }
}

// ─── Sync events FROM Microsoft Calendar ────────────────────────────────────
export async function syncFromMicrosoft(userId: string): Promise<any[]> {
  const client = await getGraphClient(userId)
  if (!client) return []

  try {
    const now = new Date()
    const past = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const future = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate())

    const result = await client.api('/me/calendarView')
      .query({ startDateTime: past.toISOString(), endDateTime: future.toISOString() })
      .top(100)
      .get()

    return result.value || []
  } catch (err) {
    console.error('[MicrosoftCalendar] Error syncing:', err)
    return []
  }
}

// ─── Check if connected ────────────────────────────────────────────────────
export async function isConnected(userId: string): Promise<boolean> {
  const result = await pool.query('SELECT id FROM microsoft_calendar_connections WHERE user_id = $1', [userId])
  return result.rows.length > 0
}
