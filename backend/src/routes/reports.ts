import { Router, Response } from 'express'
import PDFDocument from 'pdfkit'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(verifyToken)

const CRIMSON = '#EA580C'
const DARK_TEXT = '#333333'
const LIGHT_TEXT = '#666666'
const SECTION_BG = '#F8F8F8'

function toDate(d: any): string {
  return new Date(d).toISOString().split('T')[0]
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString('es-CO')
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc
    .rect(50, y, doc.page.width - 100, 30)
    .fill(SECTION_BG)

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(CRIMSON)
    .text(title, 60, y + 8, { width: doc.page.width - 120 })

  return y + 40
}

function drawMetricRow(doc: PDFKit.PDFDocument, label: string, value: string, y: number, isAlt: boolean): number {
  if (isAlt) {
    doc.rect(50, y - 2, doc.page.width - 100, 20).fill('#FAFAFA')
  }
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(LIGHT_TEXT)
    .text(label, 65, y, { width: 250 })
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(DARK_TEXT)
    .text(value, 320, y, { width: 200, align: 'right' })
  return y + 22
}

function checkPageBreak(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed > doc.page.height - 80) {
    doc.addPage()
    return 50
  }
  return y
}

// GET /api/reports/:clientId?days=30
router.get('/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params
    const days = Math.min(parseInt(req.query.days as string || '30'), 90)

    if (req.user!.role === 'client' && req.user!.clientId !== clientId) {
      res.status(403).json({ error: 'Sin acceso' })
      return
    }

    // Fetch client
    const { rows: clientRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId])
    if (!clientRows.length) {
      res.status(404).json({ error: 'Cliente no encontrado' })
      return
    }
    const client = clientRows[0]

    // Fetch connections
    const { rows: connections } = await pool.query(
      'SELECT * FROM platform_connections WHERE client_id = $1',
      [clientId]
    )
    const connMap = connections.reduce((acc: any, c: any) => ({ ...acc, [c.platform]: c }), {})

    // Fetch snapshots
    const { rows: snaps } = await pool.query(
      `SELECT platform, metric_type, value, snapshot_date
       FROM metric_snapshots
       WHERE client_id = $1 AND snapshot_date >= NOW() - INTERVAL '90 days'
       ORDER BY snapshot_date ASC`,
      [clientId]
    )

    // Fetch posts summary
    const { rows: postCounts } = await pool.query(
      `SELECT status, COUNT(*)::int as count FROM posts WHERE client_id = $1 GROUP BY status`,
      [clientId]
    )

    // Compute metrics per platform
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const now = new Date()
    const dateFrom = new Date(now)
    dateFrom.setDate(dateFrom.getDate() - days)
    const dateFromStr = dateFrom.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    const dateToStr = now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

    // ─── Build PDF ────────────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Reporte de Métricas — ${client.company}`,
        Author: 'NextGenCRM',
      },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${client.company.replace(/\s+/g, '-')}-${toDate(now)}.pdf"`)
    doc.pipe(res)

    // ─── Header ─────────────────────────────────────────────────
    // Diamond icon (simplified)
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor(CRIMSON)
      .text('◆', 50, 40, { continued: true })
      .fontSize(22)
      .text(' NextGenCRM', { baseline: 'alphabetic' })

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(LIGHT_TEXT)
      .text('Agencia de Marketing Digital', 50, 72)

    // Divider line
    doc
      .moveTo(50, 92)
      .lineTo(doc.page.width - 50, 92)
      .strokeColor(CRIMSON)
      .lineWidth(2)
      .stroke()

    // Report title
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(DARK_TEXT)
      .text('Reporte de Métricas', 50, 108)

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(LIGHT_TEXT)
      .text(`Cliente: ${client.company}`, 50, 132)
      .text(`Periodo: ${dateFromStr} — ${dateToStr}`, 50, 148)
      .text(`Generado: ${now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 50, 164)

    let y = 195

    // ─── LinkedIn Section ───────────────────────────────────────
    const liSnaps = snaps.filter((s: any) => s.platform === 'linkedin')
    if (liSnaps.length > 0 || connMap.linkedin) {
      y = checkPageBreak(doc, y, 160)
      y = drawSectionTitle(doc, 'LinkedIn', y)

      const allFollowers = liSnaps.filter((s: any) => s.metric_type === 'followers')
      const recentImpressions = liSnaps.filter((s: any) => s.metric_type === 'impressions' && new Date(s.snapshot_date) >= cutoff)
      const recentPageViews = liSnaps.filter((s: any) => s.metric_type === 'page_views' && new Date(s.snapshot_date) >= cutoff)
      const recentEngagement = liSnaps.filter((s: any) => s.metric_type === 'engagement_rate' && new Date(s.snapshot_date) >= cutoff)

      const latestFollowers = allFollowers.length ? Math.round(parseFloat(allFollowers[allFollowers.length - 1].value)) : 0
      const prevFollowers = allFollowers.length > 30 ? parseFloat(allFollowers[allFollowers.length - 31].value) : parseFloat(allFollowers[0]?.value || '0')
      const followerGrowth = prevFollowers > 0 ? (((latestFollowers - prevFollowers) / prevFollowers) * 100) : 0

      const totalImpressions = Math.round(recentImpressions.reduce((s: number, m: any) => s + parseFloat(m.value), 0))
      const totalPageViews = Math.round(recentPageViews.reduce((s: number, m: any) => s + parseFloat(m.value), 0))
      const avgEngagement = recentEngagement.length
        ? parseFloat((recentEngagement.reduce((s: number, m: any) => s + parseFloat(m.value), 0) / recentEngagement.length).toFixed(2))
        : 0

      y = drawMetricRow(doc, 'Seguidores', formatNum(latestFollowers), y, false)
      y = drawMetricRow(doc, `Crecimiento (${days} días)`, `${followerGrowth >= 0 ? '+' : ''}${followerGrowth.toFixed(1)}%`, y, true)
      y = drawMetricRow(doc, `Impresiones (${days}d)`, formatNum(totalImpressions), y, false)
      y = drawMetricRow(doc, `Vistas de Página (${days}d)`, formatNum(totalPageViews), y, true)
      y = drawMetricRow(doc, 'Engagement Rate (prom.)', `${avgEngagement}%`, y, false)
      y += 10
    }

    // ─── Meta Section ───────────────────────────────────────────
    const metaSnaps = snaps.filter((s: any) => s.platform === 'meta')
    if (metaSnaps.length > 0 || connMap.meta) {
      y = checkPageBreak(doc, y, 160)
      y = drawSectionTitle(doc, 'Meta (Facebook + Instagram)', y)

      const fbFollowers = metaSnaps.filter((s: any) => s.metric_type === 'fb_followers')
      const igFollowers = metaSnaps.filter((s: any) => s.metric_type === 'ig_followers')
      const reach = metaSnaps.filter((s: any) => s.metric_type === 'reach' && new Date(s.snapshot_date) >= cutoff)
      const impressions = metaSnaps.filter((s: any) => s.metric_type === 'impressions' && new Date(s.snapshot_date) >= cutoff)
      const engagement = metaSnaps.filter((s: any) => s.metric_type === 'engagement_rate' && new Date(s.snapshot_date) >= cutoff)

      const latestFb = fbFollowers.length ? Math.round(parseFloat(fbFollowers[fbFollowers.length - 1].value)) : 0
      const latestIg = igFollowers.length ? Math.round(parseFloat(igFollowers[igFollowers.length - 1].value)) : 0
      const totalReach = Math.round(reach.reduce((s: number, m: any) => s + parseFloat(m.value), 0))
      const totalImpressions = Math.round(impressions.reduce((s: number, m: any) => s + parseFloat(m.value), 0))
      const avgEngagement = engagement.length
        ? parseFloat((engagement.reduce((s: number, m: any) => s + parseFloat(m.value), 0) / engagement.length).toFixed(2))
        : 0

      y = drawMetricRow(doc, 'Seguidores Facebook', formatNum(latestFb), y, false)
      y = drawMetricRow(doc, 'Seguidores Instagram', formatNum(latestIg), y, true)
      y = drawMetricRow(doc, `Alcance (${days}d)`, formatNum(totalReach), y, false)
      y = drawMetricRow(doc, `Impresiones (${days}d)`, formatNum(totalImpressions), y, true)
      y = drawMetricRow(doc, 'Engagement Rate (prom.)', `${avgEngagement}%`, y, false)
      y += 10
    }

    // ─── TikTok Section ─────────────────────────────────────────
    const ttSnaps = snaps.filter((s: any) => s.platform === 'tiktok')
    if (ttSnaps.length > 0 || connMap.tiktok) {
      y = checkPageBreak(doc, y, 140)
      y = drawSectionTitle(doc, 'TikTok', y)

      const latest = (type: string) => {
        const rows = ttSnaps.filter((s: any) => s.metric_type === type)
        return rows.length ? Math.round(parseFloat(rows[rows.length - 1].value)) : 0
      }

      y = drawMetricRow(doc, 'Seguidores', formatNum(latest('followers')), y, false)
      y = drawMetricRow(doc, 'Reproducciones', formatNum(latest('total_video_views')), y, true)
      y = drawMetricRow(doc, 'Likes', formatNum(latest('total_video_likes')), y, false)
      y = drawMetricRow(doc, 'Comentarios', formatNum(latest('total_video_comments')), y, true)
      y = drawMetricRow(doc, 'Compartidos', formatNum(latest('total_video_shares')), y, false)
      y += 10
    }

    // ─── GA4 Section ────────────────────────────────────────────
    const ga4Snaps = snaps.filter((s: any) => s.platform === 'ga4' && new Date(s.snapshot_date) >= cutoff)
    if (ga4Snaps.length > 0 || connMap.ga4) {
      y = checkPageBreak(doc, y, 160)
      y = drawSectionTitle(doc, 'Google Analytics 4', y)

      const sum = (type: string) => Math.round(ga4Snaps.filter((s: any) => s.metric_type === type).reduce((acc: number, s: any) => acc + parseFloat(s.value), 0))
      const avg = (type: string) => {
        const rows = ga4Snaps.filter((s: any) => s.metric_type === type)
        return rows.length ? parseFloat((rows.reduce((acc: number, s: any) => acc + parseFloat(s.value), 0) / rows.length).toFixed(2)) : 0
      }

      y = drawMetricRow(doc, `Sesiones (${days}d)`, formatNum(sum('sessions')), y, false)
      y = drawMetricRow(doc, 'Usuarios activos', formatNum(sum('active_users')), y, true)
      y = drawMetricRow(doc, 'Vistas de página', formatNum(sum('page_views')), y, false)
      y = drawMetricRow(doc, 'Nuevos usuarios', formatNum(sum('new_users')), y, true)
      y = drawMetricRow(doc, 'Tasa de rebote (prom.)', `${avg('bounce_rate').toFixed(1)}%`, y, false)
      y = drawMetricRow(doc, 'Duración media de sesión', `${Math.round(avg('avg_session_duration'))}s`, y, true)
      y += 10
    }

    // ─── Posts Summary ──────────────────────────────────────────
    if (postCounts.length > 0) {
      y = checkPageBreak(doc, y, 120)
      y = drawSectionTitle(doc, 'Resumen de Publicaciones', y)

      const statusLabels: Record<string, string> = {
        approved: 'Aprobados',
        pending: 'Pendientes',
        revision: 'En revisión',
        rejected: 'Rechazados',
        draft: 'Borradores',
        published: 'Publicados',
      }

      postCounts.forEach((row: any, i: number) => {
        y = drawMetricRow(doc, statusLabels[row.status] || row.status, row.count.toString(), y, i % 2 === 1)
      })
      y += 10
    }

    // ─── No data notice ────────────────────────────────────────
    const hasAnyData = liSnaps.length > 0 || metaSnaps.length > 0 || ttSnaps.length > 0 || ga4Snaps.length > 0 || postCounts.length > 0
    if (!hasAnyData) {
      y = checkPageBreak(doc, y, 60)
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor(LIGHT_TEXT)
        .text('No hay datos de métricas disponibles para este cliente en el periodo seleccionado.', 50, y, {
          width: doc.page.width - 100,
          align: 'center',
        })
      y += 40
    }

    // ─── Footer ─────────────────────────────────────────────────
    const footerY = doc.page.height - 50
    doc
      .moveTo(50, footerY - 10)
      .lineTo(doc.page.width - 50, footerY - 10)
      .strokeColor('#E0E0E0')
      .lineWidth(0.5)
      .stroke()

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#999999')
      .text(
        `Generado por NextGenCRM — ${now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        50,
        footerY,
        { width: doc.page.width - 100, align: 'center' }
      )

    doc.end()
  } catch (err) {
    console.error('Error generando reporte:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error generando reporte' })
    }
  }
})

export default router
