import cron from 'node-cron'
import { pool } from '../db'
import { LinkedInService } from '../services/linkedin.service'
import { MetaService } from '../services/meta.service'
import { TikTokService } from '../services/tiktok.service'
import { GA4Service } from '../services/ga4.service'

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

export function startMetricsWorker() {
  // Sincronizar cada 6 horas
  cron.schedule('0 */6 * * *', syncAll)

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
