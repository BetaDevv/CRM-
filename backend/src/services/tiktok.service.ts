import axios from 'axios'
import { pool } from '../db'

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || ''
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3001/api/oauth/tiktok/callback'
const SCOPES = 'business.get,video.list,video.data,comment.list'

export interface TikTokTokens {
  access_token: string
  refresh_token: string
  expires_at: Date
  refresh_expires_at: Date
  account_id: string
  account_name: string
}

export class TikTokService {
  static getOAuthUrl(clientId: string): string {
    // TikTok Business Center OAuth2
    const params = new URLSearchParams({
      app_id: CLIENT_KEY,
      redirect_uri: REDIRECT_URI,
      state: clientId,
      scope: SCOPES,
    })
    return `https://business-api.tiktok.com/portal/auth?${params}`
  }

  static async exchangeCode(code: string): Promise<TikTokTokens> {
    const { data } = await axios.post(
      'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
      { app_id: CLIENT_KEY, secret: CLIENT_SECRET, auth_code: code },
      { headers: { 'Content-Type': 'application/json' } }
    )

    if (data.code !== 0) throw new Error(`TikTok OAuth error: ${data.message}`)

    const d = data.data
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: new Date(Date.now() + d.expires_in * 1000),
      refresh_expires_at: new Date(Date.now() + d.refresh_token_expires_in * 1000),
      account_id: d.advertiser_id || d.open_id,
      account_name: d.advertiser_name || 'TikTok Business',
    }
  }

  static async refreshTokenIfNeeded(conn: any, clientId: string): Promise<string> {
    if (!conn.token_expires_at || new Date(conn.token_expires_at) > new Date()) {
      return conn.access_token
    }
    // Refresh
    const { data } = await axios.post(
      'https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/',
      { app_id: CLIENT_KEY, secret: CLIENT_SECRET, refresh_token: conn.refresh_token },
      { headers: { 'Content-Type': 'application/json' } }
    )
    if (data.code !== 0) throw new Error('No se pudo refrescar el token de TikTok')

    const d = data.data
    await pool.query(
      `UPDATE platform_connections
       SET access_token=$1, refresh_token=$2, token_expires_at=$3
       WHERE client_id=$4 AND platform='tiktok'`,
      [d.access_token, d.refresh_token, new Date(Date.now() + d.expires_in * 1000), clientId]
    )
    return d.access_token
  }

  static async fetchAndStore(clientId: string, conn: any): Promise<void> {
    if (!conn?.access_token) throw new Error('No hay token de TikTok')

    const token = await this.refreshTokenIfNeeded(conn, clientId)
    const advertiserId = conn.platform_account_id

    // Business Account Info
    const { data: accountData } = await axios.get(
      'https://business-api.tiktok.com/open_api/v1.3/business/get/',
      {
        headers: { 'Access-Token': token },
        params: { business_id: advertiserId },
      }
    )

    const business = accountData.data?.business_info || {}
    const today = new Date().toISOString().split('T')[0]

    const snaps = [
      { type: 'followers', value: business.follower_count || 0 },
      { type: 'following', value: business.following_count || 0 },
      { type: 'video_count', value: business.video_count || 0 },
      { type: 'likes', value: business.likes_count || 0 },
    ]
    for (const s of snaps) {
      await pool.query(
        `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
         VALUES (gen_random_uuid()::text, $1, 'tiktok', $2, $3, $4)
         ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO UPDATE SET value = EXCLUDED.value`,
        [clientId, s.type, s.value, today]
      )
    }

    // Video analytics últimos 30 días
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: videoData } = await axios.post(
      'https://business-api.tiktok.com/open_api/v1.3/business/video/list/',
      { business_id: advertiserId, start_date: since, end_date: today, page_size: 50 },
      { headers: { 'Access-Token': token } }
    )

    const videos = videoData.data?.videos || []
    const totalViews = videos.reduce((s: number, v: any) => s + (v.play_count || 0), 0)
    const totalLikes = videos.reduce((s: number, v: any) => s + (v.like_count || 0), 0)
    const totalComments = videos.reduce((s: number, v: any) => s + (v.comment_count || 0), 0)
    const totalShares = videos.reduce((s: number, v: any) => s + (v.share_count || 0), 0)

    const aggregated = [
      { type: 'total_video_views', value: totalViews },
      { type: 'total_video_likes', value: totalLikes },
      { type: 'total_video_comments', value: totalComments },
      { type: 'total_video_shares', value: totalShares },
    ]
    for (const s of aggregated) {
      await pool.query(
        `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
         VALUES (gen_random_uuid()::text, $1, 'tiktok', $2, $3, $4)
         ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO UPDATE SET value = EXCLUDED.value`,
        [clientId, s.type, s.value, today]
      )
    }

    await pool.query(
      'UPDATE platform_connections SET last_sync_at = NOW() WHERE client_id = $1 AND platform = $2',
      [clientId, 'tiktok']
    )
  }
}
