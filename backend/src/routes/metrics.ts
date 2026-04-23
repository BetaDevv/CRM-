import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { syncAll } from '../workers/metrics.worker'
import { parseLinkedInExport } from '../services/linkedinImport.service'
import { parsePlausibleExport } from '../services/plausibleImport.service'

const router = Router()
router.use(verifyToken)

const ALLOWED_IMPORT_EXTS = ['.xlsx', '.xls', '.csv']
const ALLOWED_IMPORT_PLATFORMS = new Set(['linkedin', 'web'])

const ALLOWED_PLAUSIBLE_EXTS = ['.zip', '.csv']

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_IMPORT_EXTS.includes(ext)) cb(null, true)
    else cb(new Error(`Formato no soportado: ${ext}. Permitidos: ${ALLOWED_IMPORT_EXTS.join(', ')}`))
  },
})

const plausibleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — Plausible ZIPs can carry many CSVs
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_PLAUSIBLE_EXTS.includes(ext)) cb(null, true)
    else cb(new Error(`Formato no soportado: ${ext}. Permitidos: ${ALLOWED_PLAUSIBLE_EXTS.join(', ')}`))
  },
})

function toDate(d: any): string {
  return new Date(d).toISOString().split('T')[0]
}

function computeLinkedIn(snaps: any[], days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const all = snaps.filter(s => s.platform === 'linkedin')
  const recent = all.filter(s => new Date(s.snapshot_date) >= cutoff)

  // new_followers records are DAILY INCREMENTS (LinkedIn Page Analytics export only gives this).
  // We derive cumulative "followers" on-the-fly as a running sum from baseline 0 on the earliest date.
  const newFollowersAll = all
    .filter(s => s.metric_type === 'new_followers')
    .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())

  // Build full cumulative series across ALL dates
  let running = 0
  const cumulativeAll = newFollowersAll.map(s => {
    running += parseFloat(s.value) || 0
    return { date: s.snapshot_date, value: running }
  })

  // Slice to the selected period
  const cumulativeRecent = cumulativeAll.filter(p => new Date(p.date) >= cutoff)

  const impressions = recent.filter(s => s.metric_type === 'impressions')
  const pageViews = recent.filter(s => s.metric_type === 'page_views')
  const engagement = recent.filter(s => s.metric_type === 'engagement_rate')
  const clicks = recent.filter(s => s.metric_type === 'clicks')

  if (!newFollowersAll.length && !impressions.length) return null

  // Latest cumulative total (grand total across all imported days)
  const latestFollowers = cumulativeAll.length ? cumulativeAll[cumulativeAll.length - 1].value : 0
  // Cumulative at the cutoff — value BEFORE the period started
  const firstInPeriod = cumulativeRecent[0]?.value ?? 0
  const prevFollowers = firstInPeriod > 0 ? firstInPeriod : 0
  const followerGrowth = prevFollowers > 0 ? (((latestFollowers - prevFollowers) / prevFollowers) * 100) : 0
  // Sum of new followers in the selected period
  const newFollowersPeriod = recent
    .filter(s => s.metric_type === 'new_followers')
    .reduce((s, m) => s + (parseFloat(m.value) || 0), 0)

  return {
    summary: {
      followers: Math.round(latestFollowers),
      new_followers_period: Math.round(newFollowersPeriod),
      follower_growth_pct: parseFloat(followerGrowth.toFixed(1)),
      total_impressions: Math.round(impressions.reduce((s, m) => s + parseFloat(m.value), 0)),
      total_page_views: Math.round(pageViews.reduce((s, m) => s + parseFloat(m.value), 0)),
      avg_engagement_rate: engagement.length
        ? parseFloat((engagement.reduce((s, m) => s + parseFloat(m.value), 0) / engagement.length).toFixed(2))
        : 0,
      total_clicks: Math.round(clicks.reduce((s, m) => s + parseFloat(m.value), 0)),
    },
    timeSeries: {
      followers: cumulativeRecent.map(p => ({ date: toDate(p.date), value: Math.round(p.value) })),
      impressions: impressions.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      page_views: pageViews.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      engagement: engagement.map(m => ({ date: toDate(m.snapshot_date), value: parseFloat(parseFloat(m.value).toFixed(2)) })),
    },
    // LinkedIn Page Analytics export does not expose topPosts or demographics.
    // Community Management API approval is pending — returning empty arrays until real data is wired.
    topPosts: [],
    demographics: {
      seniority: [],
      industry: [],
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

/**
 * Compute the Web (Plausible) platform block. Returns null if no web data at all.
 *
 * - Time series (visitors/pageviews/visits/bounce_rate/visit_duration) lives in metric_snapshots
 *   with platform='web', one record per metric_type per snapshot_date.
 * - Dimensional breakdowns (topPages, channels, devices, countries, sources) come from a
 *   separate `web_dimensions` table (passed in via `dimensionRows` — see GET handler).
 * - `visitors_growth_pct` compares the selected period vs the immediately prior period of
 *   equal length (e.g. last 30 days vs 30 days before that).
 */
function computeWeb(snaps: any[], dimensionRows: any[], days: number) {
  const all = snaps.filter(s => s.platform === 'web')

  const now = new Date()
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days)
  const prevCutoff = new Date(cutoff); prevCutoff.setDate(prevCutoff.getDate() - days)

  const inPeriod = (d: string) => new Date(d) >= cutoff
  const inPrevPeriod = (d: string) => new Date(d) >= prevCutoff && new Date(d) < cutoff

  const recent = all.filter(s => inPeriod(s.snapshot_date))
  const prev = all.filter(s => inPrevPeriod(s.snapshot_date))

  // If we have no temporal snapshots AND no dimensional rows for this client, surface as null
  if (!all.length && !dimensionRows.length) return null

  const visitorsRecent     = recent.filter(s => s.metric_type === 'visitors')
  const pageviewsRecent    = recent.filter(s => s.metric_type === 'pageviews')
  const visitsRecent       = recent.filter(s => s.metric_type === 'visits')
  const bounceRateRecent   = recent.filter(s => s.metric_type === 'bounce_rate')
  const durationRecent     = recent.filter(s => s.metric_type === 'visit_duration')

  const visitorsPrev = prev.filter(s => s.metric_type === 'visitors').reduce((s, m) => s + parseFloat(m.value), 0)

  const sum = (arr: any[]) => arr.reduce((s, m) => s + parseFloat(m.value), 0)
  const avgNonZero = (arr: any[]) => {
    const nz = arr.filter(m => parseFloat(m.value) > 0)
    return nz.length ? (nz.reduce((s, m) => s + parseFloat(m.value), 0) / nz.length) : 0
  }

  const totalVisitors = Math.round(sum(visitorsRecent))
  const totalPageviews = Math.round(sum(pageviewsRecent))
  const totalVisits = Math.round(sum(visitsRecent))
  const avgBounce = parseFloat(avgNonZero(bounceRateRecent).toFixed(1))
  const avgDuration = Math.round(avgNonZero(durationRecent))

  const growth = visitorsPrev > 0
    ? ((totalVisitors - visitorsPrev) / visitorsPrev) * 100
    : 0

  // Dimensional slicing (already filtered in SQL to this client, just group & sort)
  const byType = (type: string) => dimensionRows.filter(d => d.dimension_type === type)

  const topPages = byType('top_pages')
    .map(d => ({
      name: d.name,
      visitors: Math.round(parseFloat(d.visitors) || 0),
      pageviews: Math.round(parseFloat(d.pageviews) || 0),
      bounce_rate: parseFloat(parseFloat(d.bounce_rate || 0).toFixed(1)),
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10)

  const channelsRaw = byType('channels').map(d => ({
    name: d.name,
    visitors: Math.round(parseFloat(d.visitors) || 0),
  }))
  const channelsTotal = channelsRaw.reduce((s, c) => s + c.visitors, 0)
  const channels = channelsRaw
    .sort((a, b) => b.visitors - a.visitors)
    .map(c => ({ ...c, share: channelsTotal ? parseFloat(((c.visitors / channelsTotal) * 100).toFixed(1)) : 0 }))

  const devicesRaw = byType('devices').map(d => ({
    name: d.name,
    visitors: Math.round(parseFloat(d.visitors) || 0),
  }))
  const devicesTotal = devicesRaw.reduce((s, c) => s + c.visitors, 0)
  const devices = devicesRaw
    .sort((a, b) => b.visitors - a.visitors)
    .map(c => ({ ...c, share: devicesTotal ? parseFloat(((c.visitors / devicesTotal) * 100).toFixed(1)) : 0 }))

  const countries = byType('countries')
    .map(d => ({ name: d.name, visitors: Math.round(parseFloat(d.visitors) || 0) }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10)

  const sources = byType('sources')
    .map(d => ({ name: d.name, visitors: Math.round(parseFloat(d.visitors) || 0) }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10)

  return {
    summary: {
      visitors: totalVisitors,
      pageviews: totalPageviews,
      visits: totalVisits,
      avg_bounce_rate: avgBounce,
      avg_visit_duration: avgDuration,
      visitors_growth_pct: parseFloat(growth.toFixed(1)),
    },
    timeSeries: {
      visitors: visitorsRecent.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
      pageviews: pageviewsRecent.map(m => ({ date: toDate(m.snapshot_date), value: Math.round(parseFloat(m.value)) })),
    },
    dimensions: {
      topPages,
      channels,
      devices,
      countries,
      sources,
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

    // Snapshots: last 90 days for socials, last 2 years for web (Plausible exports can cover long ranges)
    const { rows: snaps } = await pool.query(
      `SELECT platform, metric_type, value, snapshot_date
       FROM metric_snapshots
       WHERE client_id = $1
         AND (
           (platform <> 'web' AND snapshot_date >= NOW() - INTERVAL '90 days')
           OR (platform = 'web' AND snapshot_date >= NOW() - INTERVAL '2 years')
         )
       ORDER BY snapshot_date ASC`,
      [clientId]
    )

    // Web (Plausible) dimensional breakdowns — separate table, no time dimension
    const { rows: webDims } = await pool.query(
      `SELECT dimension_type, name, visitors, pageviews, bounce_rate, visit_duration, extra
       FROM web_dimensions
       WHERE client_id = $1`,
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
        web:      computeWeb(snaps, webDims, days),
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

// POST /api/metrics/import — admin-only manual XLSX import (LinkedIn for now)
// multipart/form-data: file (single), client_id, platform
router.post('/import', requireAdmin, importUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Archivo requerido (campo "file")' })
      return
    }

    const client_id = String(req.body?.client_id || '').trim()
    const platform = String(req.body?.platform || '').trim().toLowerCase()
    const kind = String(req.body?.kind || '').trim().toLowerCase()

    if (!client_id) {
      res.status(400).json({ error: 'client_id es requerido' })
      return
    }
    if (!platform || !ALLOWED_IMPORT_PLATFORMS.has(platform)) {
      res.status(400).json({ error: `platform inválida. Soportadas: ${Array.from(ALLOWED_IMPORT_PLATFORMS).join(', ')}` })
      return
    }
    const ALLOWED_KINDS = new Set(['content', 'visitors', 'followers'])
    if (!ALLOWED_KINDS.has(kind)) {
      res.status(400).json({ error: `kind inválido. Soportados: ${Array.from(ALLOWED_KINDS).join(', ')}` })
      return
    }

    // Verify client exists
    const { rows: clientRows } = await pool.query('SELECT id FROM clients WHERE id = $1', [client_id])
    if (!clientRows.length) {
      res.status(404).json({ error: 'Cliente no encontrado' })
      return
    }

    // Parse the uploaded buffer
    const parsed = parseLinkedInExport(file.buffer, kind as 'content' | 'visitors' | 'followers')

    console.log(`[metrics/import] file=${file.originalname} size=${file.size}B client=${client_id} platform=${platform} kind=${kind}`)
    console.log(`[metrics/import] sheetsProcessed=${JSON.stringify(parsed.sheetsProcessed)} metrics=${parsed.metrics.length} errors=${parsed.errors.length}`)
    if (parsed.errors.length) console.log(`[metrics/import] errors:`, parsed.errors)
    if (parsed.sheetNamesAll) console.log(`[metrics/import] allSheets=${JSON.stringify(parsed.sheetNamesAll)}`)
    if (parsed.headersByProcessedSheet) console.log(`[metrics/import] headersByProcessedSheet=${JSON.stringify(parsed.headersByProcessedSheet, null, 2)}`)

    if (!parsed.metrics.length) {
      res.status(422).json({
        imported: 0,
        skipped: 0,
        errors: parsed.errors.length ? parsed.errors : ['No se encontraron métricas válidas en el archivo.'],
        dateRange: null,
        sheetsProcessed: parsed.sheetsProcessed,
        sheetNamesAll: parsed.sheetNamesAll,
        headersByProcessedSheet: parsed.headersByProcessedSheet,
      })
      return
    }

    // Bulk upsert within a transaction
    const client = await pool.connect()
    let imported = 0
    const skipped = 0
    try {
      await client.query('BEGIN')
      const metadata = JSON.stringify({ source: 'xlsx_import' })

      for (const m of parsed.metrics) {
        const id = crypto.randomUUID()
        await client.query(
          `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (client_id, platform, metric_type, snapshot_date)
           DO UPDATE SET value = EXCLUDED.value, created_at = NOW(), metadata = EXCLUDED.metadata`,
          [id, client_id, platform, m.metric_type, m.value, m.snapshot_date, metadata]
        )
        imported++
      }

      await client.query('COMMIT')
    } catch (txErr: any) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('Error en transacción de import:', txErr)
      res.status(500).json({ error: 'Error al persistir métricas', detail: txErr?.message })
      return
    } finally {
      client.release()
    }

    res.json({
      imported,
      skipped,
      errors: parsed.errors,
      dateRange: parsed.dateRange,
      sheetsProcessed: parsed.sheetsProcessed,
    })
  } catch (err: any) {
    console.error('Error en /metrics/import:', err)
    res.status(500).json({ error: err?.message || 'Error interno del servidor' })
  }
})

// POST /api/metrics/import-plausible — admin-only Plausible CSV/ZIP import
// multipart/form-data: file (single, .zip or .csv), client_id
router.post('/import-plausible', requireAdmin, plausibleUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Archivo requerido (campo "file")' })
      return
    }

    const client_id = String(req.body?.client_id || '').trim()
    if (!client_id) {
      res.status(400).json({ error: 'client_id es requerido' })
      return
    }

    // Verify client exists
    const { rows: clientRows } = await pool.query('SELECT id FROM clients WHERE id = $1', [client_id])
    if (!clientRows.length) {
      res.status(404).json({ error: 'Cliente no encontrado' })
      return
    }

    const parsed = parsePlausibleExport(file.buffer, file.originalname)

    const tsCount = parsed.timeSeries.length
    const dimCount = parsed.topPages.length + parsed.channels.length + parsed.sources.length +
                     parsed.devices.length + parsed.countries.length

    console.log(`[metrics/import-plausible] file=${file.originalname} size=${file.size}B client=${client_id}`)
    console.log(`[metrics/import-plausible] filesProcessed=${JSON.stringify(parsed.filesProcessed)}`)
    console.log(`[metrics/import-plausible] timeSeriesRows=${tsCount} dimensionRows=${dimCount} errors=${parsed.errors.length}`)
    if (parsed.errors.length) console.log(`[metrics/import-plausible] errors:`, parsed.errors)

    if (!tsCount && !dimCount) {
      res.status(422).json({
        timeSeriesRows: 0,
        dimensionRows: 0,
        filesProcessed: parsed.filesProcessed,
        errors: parsed.errors.length ? parsed.errors : ['No se encontraron datos válidos en el archivo.'],
        dateRange: null,
      })
      return
    }

    // Date range from the time series (if any)
    let dateRange: { min: string; max: string } | null = null
    if (tsCount) {
      let min = parsed.timeSeries[0].date
      let max = min
      for (const r of parsed.timeSeries) {
        if (r.date < min) min = r.date
        if (r.date > max) max = r.date
      }
      dateRange = { min, max }
    }

    const db = await pool.connect()
    let timeSeriesRows = 0
    let dimensionRows = 0
    try {
      await db.query('BEGIN')
      const metadata = JSON.stringify({ source: 'plausible_import' })

      // Time series → metric_snapshots (upsert by unique key)
      const TS_METRICS: Array<{ type: string; get: (r: typeof parsed.timeSeries[0]) => number }> = [
        { type: 'visitors',       get: r => r.visitors },
        { type: 'pageviews',      get: r => r.pageviews },
        { type: 'visits',         get: r => r.visits },
        { type: 'bounce_rate',    get: r => r.bounce_rate },
        { type: 'visit_duration', get: r => r.visit_duration },
      ]
      for (const row of parsed.timeSeries) {
        for (const m of TS_METRICS) {
          const value = m.get(row)
          const id = crypto.randomUUID()
          await db.query(
            `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date, metadata)
             VALUES ($1, $2, 'web', $3, $4, $5, $6)
             ON CONFLICT (client_id, platform, metric_type, snapshot_date)
             DO UPDATE SET value = EXCLUDED.value, created_at = NOW(), metadata = EXCLUDED.metadata`,
            [id, client_id, m.type, value, row.date, metadata]
          )
          timeSeriesRows++
        }
      }

      // Dimensional rows: delete existing per dimension_type, then insert fresh
      const dimGroups: Array<{ type: string; rows: any[]; toVals: (r: any) => [number, number, number, number] }> = [
        { type: 'top_pages', rows: parsed.topPages, toVals: r => [r.visitors, r.pageviews, r.bounce_rate, 0] },
        { type: 'channels',  rows: parsed.channels, toVals: r => [r.visitors, 0, r.bounce_rate, r.visit_duration] },
        { type: 'sources',   rows: parsed.sources,  toVals: r => [r.visitors, 0, 0, 0] },
        { type: 'devices',   rows: parsed.devices,  toVals: r => [r.visitors, 0, 0, 0] },
        { type: 'countries', rows: parsed.countries, toVals: r => [r.visitors, 0, 0, 0] },
      ]
      for (const g of dimGroups) {
        if (!g.rows.length) continue
        await db.query(
          `DELETE FROM web_dimensions WHERE client_id = $1 AND dimension_type = $2`,
          [client_id, g.type]
        )
        for (const r of g.rows) {
          const id = crypto.randomUUID()
          const [visitors, pageviews, bounce_rate, visit_duration] = g.toVals(r)
          await db.query(
            `INSERT INTO web_dimensions (id, client_id, dimension_type, name, visitors, pageviews, bounce_rate, visit_duration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (client_id, dimension_type, name)
             DO UPDATE SET visitors = EXCLUDED.visitors, pageviews = EXCLUDED.pageviews,
                           bounce_rate = EXCLUDED.bounce_rate, visit_duration = EXCLUDED.visit_duration,
                           imported_at = NOW()`,
            [id, client_id, g.type, r.name, visitors, pageviews, bounce_rate, visit_duration]
          )
          dimensionRows++
        }
      }

      await db.query('COMMIT')
    } catch (txErr: any) {
      await db.query('ROLLBACK').catch(() => {})
      console.error('Error en transacción de import-plausible:', txErr)
      res.status(500).json({ error: 'Error al persistir métricas web', detail: txErr?.message })
      return
    } finally {
      db.release()
    }

    res.json({
      timeSeriesRows,
      dimensionRows,
      filesProcessed: parsed.filesProcessed,
      errors: parsed.errors,
      dateRange,
    })
  } catch (err: any) {
    console.error('Error en /metrics/import-plausible:', err)
    res.status(500).json({ error: err?.message || 'Error interno del servidor' })
  }
})

export default router
