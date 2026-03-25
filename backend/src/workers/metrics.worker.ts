import cron from 'node-cron'
import { pool } from '../db'
import { LinkedInService } from '../services/linkedin.service'
import { MetaService } from '../services/meta.service'
import { TikTokService } from '../services/tiktok.service'
import { GA4Service } from '../services/ga4.service'
import { sendWeeklyMetricsSummary } from '../services/emailService'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function syncConnection(conn: any) {
  const { client_id, platform } = conn
  try {
    switch (platform) {
      case 'linkedin': await LinkedInService.fetchAndStore(client_id, conn); break
      case 'meta':     await MetaService.fetchAndStore(client_id, conn);     break
      case 'tiktok':   await TikTokService.fetchAndStore(client_id, conn);   break
      case 'ga4':      await GA4Service.fetchAndStore(client_id, conn);      break
    }
    console.log(`  ✓ ${platform} → ${conn.company || client_id}`)
  } catch (err: any) {
    console.error(`  ✗ ${platform} → ${conn.company || client_id}: ${err.message}`)

    // Si el token es inválido, marcar como inactivo para no seguir intentando
    if (err.message?.includes('inválido') || err.message?.includes('401') || err.message?.includes('expirado')) {
      await pool.query(
        'UPDATE platform_connections SET is_active = 0 WHERE client_id = $1 AND platform = $2',
        [client_id, platform]
      )
    }
  }
}

async function syncAll() {
  console.log('\n🔄 Iniciando sincronización de métricas...')
  try {
    const { rows: connections } = await pool.query(`
      SELECT pc.*, c.company
      FROM platform_connections pc
      JOIN clients c ON pc.client_id = c.id
      WHERE pc.is_active = 1
      ORDER BY pc.platform, pc.client_id
    `)

    if (!connections.length) {
      console.log('  Sin conexiones activas configuradas.')
      return
    }

    for (const conn of connections) {
      await syncConnection(conn)
      await delay(1200) // Respetar rate limits entre clientes
    }
  } catch (err: any) {
    console.error('Error en sincronización de métricas:', err.message)
  }
  console.log('✅ Sincronización completada\n')
}

async function sendWeeklySummaries() {
  console.log('\n📊 Enviando resúmenes semanales de métricas...')
  try {
    // Get all clients that have active platform connections
    const { rows: clients } = await pool.query(`
      SELECT DISTINCT c.id, c.company
      FROM clients c
      JOIN platform_connections pc ON pc.client_id = c.id AND pc.is_active = 1
      WHERE c.status = 'active'
    `)

    if (!clients.length) {
      console.log('  Sin clientes con conexiones activas.')
      return
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    for (const client of clients) {
      try {
        // Find the client's user account
        const { rows: userRows } = await pool.query(
          "SELECT email, name FROM users WHERE client_id = $1 AND role = 'client'",
          [client.id]
        )
        if (!userRows.length) continue

        // Get last 7 days of metric snapshots (key-value format: platform + metric_type + value)
        const { rows: snapshots } = await pool.query(`
          SELECT platform, metric_type,
            MAX(value) as max_val,
            SUM(value) as sum_val,
            ROUND(AVG(value)::numeric, 2) as avg_val
          FROM metric_snapshots
          WHERE client_id = $1 AND snapshot_date >= $2
          GROUP BY platform, metric_type
        `, [client.id, sevenDaysAgo.toISOString()])

        if (!snapshots.length) continue

        // Build a lookup: { platform: { metric_type: { max, sum, avg } } }
        const lookup: Record<string, Record<string, { max: number; sum: number; avg: number }>> = {}
        for (const s of snapshots) {
          if (!lookup[s.platform]) lookup[s.platform] = {}
          lookup[s.platform][s.metric_type] = {
            max: parseFloat(s.max_val) || 0,
            sum: parseFloat(s.sum_val) || 0,
            avg: parseFloat(s.avg_val) || 0,
          }
        }

        const metrics: any = {}
        if (lookup.linkedin) {
          metrics.linkedin = {
            followers: lookup.linkedin.followers?.max || 0,
            impressions: lookup.linkedin.impressions?.sum || 0,
            engagement: lookup.linkedin.engagement_rate?.avg || 0,
          }
        }
        if (lookup.meta) {
          metrics.meta = {
            fbFollowers: lookup.meta.fb_followers?.max || 0,
            igFollowers: lookup.meta.ig_followers?.max || 0,
            reach: lookup.meta.reach?.sum || 0,
          }
        }
        if (lookup.tiktok) {
          metrics.tiktok = {
            followers: lookup.tiktok.followers?.max || 0,
            videoViews: lookup.tiktok.video_views?.sum || 0,
          }
        }
        if (lookup.ga4) {
          metrics.ga4 = {
            sessions: lookup.ga4.sessions?.sum || 0,
            pageViews: lookup.ga4.page_views?.sum || 0,
            users: lookup.ga4.users?.max || 0,
          }
        }

        await sendWeeklyMetricsSummary({
          to: userRows[0].email,
          clientName: userRows[0].name || client.company,
          metrics,
        })
        console.log(`  ✓ Resumen enviado a ${client.company}`)
      } catch (err: any) {
        console.error(`  ✗ Error enviando resumen a ${client.company}: ${err.message}`)
      }
    }
  } catch (err: any) {
    console.error('Error en envío de resúmenes semanales:', err.message)
  }
  console.log('✅ Resúmenes semanales completados\n')
}

export function startMetricsWorker() {
  // Sincronizar cada 6 horas
  cron.schedule('0 */6 * * *', syncAll)

  // Resumen semanal de métricas: cada lunes a las 9:00 AM
  cron.schedule('0 9 * * 1', sendWeeklySummaries)
  console.log('📧 Cron de resúmenes semanales activo (lunes 9:00 AM)')

  // También ejecutar al arranque si hay conexiones (después de 10s para dejar iniciar el servidor)
  setTimeout(() => {
    pool.query("SELECT COUNT(*) as c FROM platform_connections WHERE is_active = 1")
      .then(({ rows }) => {
        if (parseInt(rows[0].c) > 0) syncAll()
      })
      .catch(() => {})
  }, 10000)

  console.log('⏰ Worker de métricas activo (cada 6h)')
}

// Exponer para trigger manual desde endpoint admin
export { syncAll }
