import axios from 'axios'
import { pool } from '../db'

const LI_BASE = 'https://api.linkedin.com/v2'
const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || ''
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/api/oauth/linkedin/callback'
// Scopes para Company Pages analytics
const SCOPES = 'r_organization_social rw_organization_admin r_basicprofile'

export interface LinkedInTokens {
  access_token: string
  refresh_token: null
  expires_at: Date
  account_id: string
  account_name: string
}

export class LinkedInService {
  static getOAuthUrl(clientId: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state: clientId,
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`
  }

  static async exchangeCode(code: string): Promise<LinkedInTokens> {
    const { data } = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    const profile = await axios.get(`${LI_BASE}/me?projection=(id,localizedFirstName,localizedLastName)`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })

    return {
      access_token: data.access_token,
      refresh_token: null,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      account_id: profile.data.id,
      account_name: `${profile.data.localizedFirstName} ${profile.data.localizedLastName}`,
    }
  }

  // LinkedIn no emite refresh tokens — el usuario debe re-autenticar cuando expire
  static isExpired(conn: any): boolean {
    if (!conn.token_expires_at) return false
    return new Date(conn.token_expires_at) <= new Date()
  }

  /**
   * Obtiene métricas de la página de empresa y las almacena en metric_snapshots.
   * Requiere: access_token + platform_account_id (LinkedIn Organization URN)
   */
  static async fetchAndStore(clientId: string, conn: any): Promise<void> {
    if (!conn?.access_token || this.isExpired(conn)) {
      throw new Error('Token de LinkedIn inválido o expirado')
    }

    const orgId = conn.platform_account_id
    if (!orgId) throw new Error('No hay Organization ID configurado')

    const headers = { Authorization: `Bearer ${conn.access_token}` }
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    // Follower statistics
    const { data: followerData } = await axios.get(
      `${LI_BASE}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}`,
      { headers }
    )

    // Share (post) statistics — últimos 30 días por día
    const { data: shareData } = await axios.get(
      `${LI_BASE}/organizationalEntityShareStatistics?q=organizationalEntity` +
      `&organizationalEntity=urn:li:organization:${orgId}` +
      `&timeIntervals.timeGranularityType=DAY` +
      `&timeIntervals.timeRange.start=${thirtyDaysAgo}` +
      `&timeIntervals.timeRange.end=${now}`,
      { headers }
    )

    const today = new Date().toISOString().split('T')[0]
    const totalFollowers = followerData.elements?.[0]?.followerCountsByAssociationType?.find(
      (f: any) => f.associationType === 'MEMBER'
    )?.followerCounts?.organicFollowerCount || 0

    await pool.query(
      `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
       VALUES (gen_random_uuid()::text, $1, 'linkedin', 'followers', $2, $3)
       ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO UPDATE SET value = EXCLUDED.value`,
      [clientId, totalFollowers, today]
    )

    // Procesar estadísticas diarias de posts
    for (const element of (shareData.elements || [])) {
      const date = new Date(element.timeRange?.start).toISOString().split('T')[0]
      const stats = element.totalShareStatistics || {}

      const dailyMetrics = [
        { type: 'impressions', value: stats.impressionCount || 0 },
        { type: 'clicks', value: stats.clickCount || 0 },
        { type: 'engagement_rate', value: stats.engagement ? stats.engagement * 100 : 0 },
      ]
      for (const m of dailyMetrics) {
        await pool.query(
          `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
           VALUES (gen_random_uuid()::text, $1, 'linkedin', $2, $3, $4)
           ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO UPDATE SET value = EXCLUDED.value`,
          [clientId, m.type, m.value, date]
        )
      }
    }

    await pool.query(
      'UPDATE platform_connections SET last_sync_at = NOW() WHERE client_id = $1 AND platform = $2',
      [clientId, 'linkedin']
    )
  }
}
