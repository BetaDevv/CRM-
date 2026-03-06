import axios from 'axios'
import { pool } from '../db'

const GRAPH_BASE = 'https://graph.facebook.com/v19.0'
const APP_ID = process.env.META_APP_ID || ''
const APP_SECRET = process.env.META_APP_SECRET || ''
const REDIRECT_URI = process.env.META_REDIRECT_URI || 'http://localhost:3001/api/oauth/meta/callback'
const SCOPES = 'pages_read_engagement,pages_show_list,instagram_basic,instagram_manage_insights,read_insights'

export interface MetaTokens {
  access_token: string
  refresh_token: null // Meta usa long-lived tokens (60 días), no refresh
  expires_at: Date
  account_id: string
  account_name: string
}

export class MetaService {
  static getOAuthUrl(clientId: string): string {
    const params = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      response_type: 'code',
      state: clientId,
    })
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`
  }

  static async exchangeCode(code: string): Promise<MetaTokens> {
    // Paso 1: token de corta duración
    const { data: shortToken } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
      params: { client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: REDIRECT_URI, code },
    })

    // Paso 2: intercambiar por long-lived token (60 días)
    const { data: longToken } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: APP_ID,
        client_secret: APP_SECRET,
        fb_exchange_token: shortToken.access_token,
      },
    })

    // Obtener datos del usuario
    const { data: me } = await axios.get(`${GRAPH_BASE}/me`, {
      params: { access_token: longToken.access_token, fields: 'id,name' },
    })

    return {
      access_token: longToken.access_token,
      refresh_token: null,
      expires_at: new Date(Date.now() + (longToken.expires_in || 5184000) * 1000),
      account_id: me.id,
      account_name: me.name,
    }
  }

  static isExpired(conn: any): boolean {
    if (!conn.token_expires_at) return false
    // Alerta 7 días antes
    const warningDate = new Date(new Date(conn.token_expires_at).getTime() - 7 * 24 * 60 * 60 * 1000)
    return new Date() >= warningDate
  }

  /**
   * Obtiene métricas de Facebook Page + Instagram Business.
   * platform_account_id debe ser el Page ID de Facebook.
   */
  static async fetchAndStore(clientId: string, conn: any): Promise<void> {
    if (!conn?.access_token || this.isExpired(conn)) {
      throw new Error('Token de Meta inválido o expirado')
    }

    const pageId = conn.platform_account_id
    if (!pageId) throw new Error('No hay Page ID configurado')

    const token = conn.access_token
    const today = new Date().toISOString().split('T')[0]
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)
    const until = Math.floor(Date.now() / 1000)

    // Métricas de Facebook Page
    const { data: pageInsights } = await axios.get(`${GRAPH_BASE}/${pageId}/insights`, {
      params: {
        access_token: token,
        metric: 'page_fans,page_impressions,page_reach,page_post_engagements',
        period: 'day',
        since,
        until,
      },
    })

    for (const metric of (pageInsights.data || [])) {
      const typeMap: Record<string, string> = {
        page_fans: 'fb_followers',
        page_impressions: 'impressions',
        page_reach: 'reach',
        page_post_engagements: 'engagements',
      }
      const metricType = typeMap[metric.name]
      if (!metricType) continue

      for (const point of (metric.values || [])) {
        const date = new Date(point.end_time).toISOString().split('T')[0]
        await pool.query(
          `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
           VALUES (gen_random_uuid()::text, $1, 'meta', $2, $3, $4)
           ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO UPDATE SET value = EXCLUDED.value`,
          [clientId, metricType, point.value, date]
        )
      }
    }

    // Buscar cuenta de Instagram asociada a la Page
    const { data: igData } = await axios.get(`${GRAPH_BASE}/${pageId}`, {
      params: { access_token: token, fields: 'instagram_business_account' },
    })

    if (igData.instagram_business_account?.id) {
      const igId = igData.instagram_business_account.id
      const { data: igInsights } = await axios.get(`${GRAPH_BASE}/${igId}/insights`, {
        params: {
          access_token: token,
          metric: 'follower_count,impressions,reach',
          period: 'day',
          since,
          until,
        },
      })

      for (const metric of (igInsights.data || [])) {
        const typeMap: Record<string, string> = {
          follower_count: 'ig_followers',
          impressions: 'ig_impressions',
          reach: 'ig_reach',
        }
        const metricType = typeMap[metric.name]
        if (!metricType) continue

        for (const point of (metric.values || [])) {
          const date = new Date(point.end_time).toISOString().split('T')[0]
          await pool.query(
            `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
             VALUES (gen_random_uuid()::text, $1, 'meta', $2, $3, $4)
             ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO UPDATE SET value = EXCLUDED.value`,
            [clientId, metricType, point.value, date]
          )
        }
      }
    }

    await pool.query(
      'UPDATE platform_connections SET last_sync_at = NOW() WHERE client_id = $1 AND platform = $2',
      [clientId, 'meta']
    )
  }
}
