import axios from 'axios'
import { pool } from '../db'

const CLIENT_ID = process.env.GA4_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GA4_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.GA4_REDIRECT_URI || 'http://localhost:3001/api/oauth/ga4/callback'
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export interface GA4Tokens {
  access_token: string
  refresh_token: string
  expires_at: Date
  account_id: string // GA4 Property ID (ej: "properties/123456789")
  account_name: string
}

export class GA4Service {
  static getOAuthUrl(clientId: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline', // Necesario para obtener refresh_token
      prompt: 'consent',      // Forzar pantalla de consentimiento para obtener refresh_token siempre
      state: clientId,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  static async exchangeCode(code: string): Promise<GA4Tokens> {
    const { data } = await axios.post(GOOGLE_TOKEN_URL, {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    })

    // Obtener lista de propiedades GA4 disponibles
    const { data: accounts } = await axios.get(
      'https://analyticsadmin.googleapis.com/v1beta/accounts',
      { headers: { Authorization: `Bearer ${data.access_token}` } }
    )
    const firstAccount = accounts.accounts?.[0]

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      account_id: firstAccount?.name || '',
      account_name: firstAccount?.displayName || 'Google Analytics',
    }
  }

  static async refreshTokenIfNeeded(conn: any, clientId: string): Promise<string> {
    if (!conn.token_expires_at || new Date(conn.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
      return conn.access_token
    }
    const { data } = await axios.post(GOOGLE_TOKEN_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    })
    await pool.query(
      `UPDATE platform_connections SET access_token=$1, token_expires_at=$2
       WHERE client_id=$3 AND platform='ga4'`,
      [data.access_token, new Date(Date.now() + data.expires_in * 1000), clientId]
    )
    return data.access_token
  }

  /**
   * Usa la Data API v1 de GA4 para obtener métricas.
   * platform_account_id debe ser el Property ID de GA4 (sin "properties/" prefix).
   */
  static async fetchAndStore(clientId: string, conn: any): Promise<void> {
    if (!conn?.access_token) throw new Error('No hay token de GA4')

    const token = await this.refreshTokenIfNeeded(conn, clientId)
    const propertyId = conn.platform_account_id
    if (!propertyId) throw new Error('No hay Property ID de GA4 configurado')

    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // GA4 Data API — reporte de tráfico diario
    const { data: report } = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'newUsers' },
        ],
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const metricNames = ['sessions', 'active_users', 'page_views', 'bounce_rate', 'avg_session_duration', 'new_users']

    for (const row of (report.rows || [])) {
      const rawDate = row.dimensionValues[0].value // YYYYMMDD
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`

      for (let i = 0; i < metricNames.length; i++) {
        const value = parseFloat(row.metricValues[i]?.value || '0')
        await pool.query(
          `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
           VALUES (gen_random_uuid()::text, $1, 'ga4', $2, $3, $4)
           ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO UPDATE SET value = EXCLUDED.value`,
          [clientId, metricNames[i], value, date]
        )
      }
    }

    await pool.query(
      'UPDATE platform_connections SET last_sync_at = NOW() WHERE client_id = $1 AND platform = $2',
      [clientId, 'ga4']
    )
  }
}
