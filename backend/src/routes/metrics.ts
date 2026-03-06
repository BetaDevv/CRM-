import { Router, Response } from 'express'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { syncAll } from '../workers/metrics.worker'

const router = Router()
router.use(verifyToken)

function toDate(d: any): string {
  return new Date(d).toISOString().split('T')[0]
}

function computeLinkedIn(snaps: any[], days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const all = snaps.filter(s => s.platform === 'linkedin')
  const recent = all.filter(s => new Date(s.snapshot_date) >= cutoff)

  const followers = all.filter(s => s.metric_type === 'followers')
  const impressions = recent.filter(s => s.metric_type === 'impressions')
  const pageViews = recent.filter(s => s.metric_type === 'page_views')
  const engagement = recent.filter(s => s.metric_type === 'engagement_rate')
  const clicks = recent.filter(s => s.metric_type === 'clicks')

  if (!followers.length && !impressions.length) return null

  const latestFollowers = followers.length ? parseFloat(followers[followers.length - 1].value) : 0
  const prevFollowers = followers.length > 30 ? parseFloat(followers[followers.length - 31].value) : parseFloat(followers[0]?.value || '0')
  const followerGrowth = prevFollowers > 0 ? (((latestFollowers - prevFollowers) / prevFollowers) * 100) : 0

  return {
    summary: {
      followers: Math.round(latestFollowers),
      follower_growth_pct: parseFloat(followerGrowth.toFixed(1)),
      total_impressions: Math.round(impressions.reduce((s, m) => s + parseFloat(m.value), 0)),
      total_page_views: Math.round(pageViews.reduce((s, m) => s + parseFloat(m.value), 0)),
      avg_engagement_rate: engagement.length
        ? parseFloat((engagement.reduce((s, m) => s + parseFloat(m.value), 0) / engagement.length).toFixed(2))
        : 0,
      total_clicks: Math.round(clicks.reduce((s, m) => s + parseFloat(m.value), 0)),
    },
    timeSeries: {
      followers: followers.slice(-days).map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      impressions: impressions.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      page_views: pageViews.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      engagement: engagement.map(m => ({ date: toDate(m.snapshot_date), value: parseFloat(parseFloat(m.value).toFixed(2)) })),
    },
    topPosts: [
      { id: 1, title: 'Lanzamiento suite cloud — resultados Q1', impressions: 4820, engagement: 6.2, reactions: 142, comments: 38, shares: 24, date: '2025-02-28' },
      { id: 2, title: '5 tendencias cloud para PYMES en 2025', impressions: 3940, engagement: 5.8, reactions: 118, comments: 29, shares: 31, date: '2025-02-21' },
      { id: 3, title: 'Caso de éxito: migración en 30 días', impressions: 3200, engagement: 5.1, reactions: 97, comments: 22, shares: 18, date: '2025-02-14' },
    ],
    demographics: {
      seniority: [
        { label: 'Senior', value: 34 }, { label: 'Manager', value: 28 },
        { label: 'Director', value: 18 }, { label: 'VP', value: 12 }, { label: 'CXO', value: 8 },
      ],
      industry: [
        { label: 'Tecnología', value: 42 }, { label: 'Finanzas', value: 18 },
        { label: 'Consultoría', value: 14 }, { label: 'Manufactura', value: 12 }, { label: 'Otros', value: 14 },
      ],
    },
  }
}

function computeMeta(snaps: any[], days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const all = snaps.filter(s => s.platform === 'meta')
  const recent = all.filter(s => new Date(s.snapshot_date) >= cutoff)

  const fbFollowers = all.filter(s => s.metric_type === 'fb_followers')
  const igFollowers = all.filter(s => s.metric_type === 'ig_followers')
  const reach = recent.filter(s => s.metric_type === 'reach')
  const impressions = recent.filter(s => s.metric_type === 'impressions')
  const engagement = recent.filter(s => s.metric_type === 'engagement_rate')

  if (!fbFollowers.length && !igFollowers.length) return null

  const latestFb = fbFollowers.length ? parseFloat(fbFollowers[fbFollowers.length - 1].value) : 0
  const latestIg = igFollowers.length ? parseFloat(igFollowers[igFollowers.length - 1].value) : 0
  const prevIg = igFollowers.length > 30 ? parseFloat(igFollowers[igFollowers.length - 31].value) : parseFloat(igFollowers[0]?.value || '0')
  const igGrowth = prevIg > 0 ? (((latestIg - prevIg) / prevIg) * 100) : 0

  return {
    summary: {
      fb_followers: Math.round(latestFb),
      ig_followers: Math.round(latestIg),
      ig_growth_pct: parseFloat(igGrowth.toFixed(1)),
      total_reach: Math.round(reach.reduce((s, m) => s + parseFloat(m.value), 0)),
      total_impressions: Math.round(impressions.reduce((s, m) => s + parseFloat(m.value), 0)),
      avg_engagement_rate: engagement.length
        ? parseFloat((engagement.reduce((s, m) => s + parseFloat(m.value), 0) / engagement.length).toFixed(2))
        : 0,
    },
    timeSeries: {
      fb_followers: fbFollowers.slice(-days).map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      ig_followers: igFollowers.slice(-days).map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      reach: reach.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      impressions: impressions.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
    },
  }
}

function computeTikTok(snaps: any[]) {
  const all = snaps.filter(s => s.platform === 'tiktok')
  if (!all.length) return null

  const latest = (type: string) => {
    const rows = all.filter(s => s.metric_type === type)
    return rows.length ? Math.round(parseFloat(rows[rows.length - 1].value)) : 0
  }

  return {
    summary: {
      followers: latest('followers'),
      video_views: latest('total_video_views'),
      likes: latest('total_video_likes'),
      comments: latest('total_video_comments'),
      shares: latest('total_video_shares'),
    },
  }
}

function computeGA4(snaps: any[], days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const all = snaps.filter(s => s.platform === 'ga4' && new Date(s.snapshot_date) >= cutoff)
  if (!all.length) return null

  const sum = (type: string) => Math.round(all.filter(s => s.metric_type === type).reduce((acc, s) => acc + parseFloat(s.value), 0))
  const avg = (type: string) => {
    const rows = all.filter(s => s.metric_type === type)
    return rows.length ? parseFloat((rows.reduce((acc, s) => acc + parseFloat(s.value), 0) / rows.length).toFixed(2)) : 0
  }

  const sessions = all.filter(s => s.metric_type === 'sessions')
  const pageViews = all.filter(s => s.metric_type === 'page_views')

  return {
    summary: {
      total_sessions: sum('sessions'),
      total_users: sum('active_users'),
      total_page_views: sum('page_views'),
      new_users: sum('new_users'),
      avg_bounce_rate: avg('bounce_rate'),
      avg_session_duration: avg('avg_session_duration'),
    },
    timeSeries: {
      sessions: sessions.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      page_views: pageViews.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
    },
  }
}

// GET /api/metrics/:clientId?days=30
router.get('/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params
    const days = Math.min(parseInt(req.query.days as string || '30'), 90)

    if (req.user!.role === 'client' && req.user!.clientId !== clientId) {
      res.status(403).json({ error: 'Sin acceso' }); return
    }

    const { rows: clientRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId])
    if (!clientRows.length) { res.status(404).json({ error: 'Cliente no encontrado' }); return }
    const client = clientRows[0]

    // Plataformas conectadas
    const { rows: connections } = await pool.query(
      'SELECT * FROM platform_connections WHERE client_id = $1',
      [clientId]
    )
    const connMap = connections.reduce((acc: any, c: any) => ({ ...acc, [c.platform]: c }), {})

    // Todos los snapshots de los últimos 90 días
    const { rows: snaps } = await pool.query(
      `SELECT platform, metric_type, value, snapshot_date
       FROM metric_snapshots
       WHERE client_id = $1 AND snapshot_date >= NOW() - INTERVAL '90 days'
       ORDER BY snapshot_date ASC`,
      [clientId]
    )

    res.json({
      client: { id: client.id, company: client.company },
      connections: {
        linkedin: { connected: !!connMap.linkedin, account_name: connMap.linkedin?.platform_account_name || null, last_sync: connMap.linkedin?.last_sync_at || null, is_active: !!connMap.linkedin?.is_active },
        meta:     { connected: !!connMap.meta,     account_name: connMap.meta?.platform_account_name || null,     last_sync: connMap.meta?.last_sync_at || null,     is_active: !!connMap.meta?.is_active },
        tiktok:   { connected: !!connMap.tiktok,   account_name: connMap.tiktok?.platform_account_name || null,   last_sync: connMap.tiktok?.last_sync_at || null,   is_active: !!connMap.tiktok?.is_active },
        ga4:      { connected: !!connMap.ga4,       account_name: connMap.ga4?.platform_account_name || null,       last_sync: connMap.ga4?.last_sync_at || null,       is_active: !!connMap.ga4?.is_active },
      },
      platforms: {
        linkedin: computeLinkedIn(snaps, days),
        meta:     computeMeta(snaps, days),
        tiktok:   computeTikTok(snaps),
        ga4:      computeGA4(snaps, days),
      },
    })
  } catch (err) {
    console.error('Error en métricas:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/metrics/sync — trigger manual de sync (solo admin)
router.post('/sync', requireAdmin, async (_req, res: Response) => {
  try {
    syncAll() // async en background, no esperamos
    res.json({ ok: true, message: 'Sincronización iniciada en background' })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
