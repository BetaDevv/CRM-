import axios from 'axios'
import crypto from 'crypto'
import { pool } from '../db'

// ─── Plausible (per-client API key, Cloud or self-hosted Community Edition) ──
// Modelo B: cada cliente trae su propia cuenta + API key. No hay key global.
// La instancia se almacena por conexión (campo scopes JSON: {baseUrl}). Soporta
// Cloud (https://plausible.io) y Community Edition self-hosted con la misma
// API. Auth: Authorization: Bearer ${apiKey}.
// API key se persiste en plano en platform_connections.access_token (mismo
// patrón que LinkedIn/Meta/GA4/TikTok en este repo). Coherencia > paranoia
// inconsistente. Si en el futuro se cifran tokens, hacer la migración global.
const DEFAULT_PLAUSIBLE_BASE = 'https://plausible.io'
const API_PATH = '/api/v1'
const REQUEST_TIMEOUT_MS = 15_000
const HISTORY_DAYS = 365  // ventana custom para incluir el día de HOY (period=12mo excluye el mes en curso)

/**
 * Construye los params de período como `period=custom&date=YYYY-MM-DD,YYYY-MM-DD`.
 * - Sin esto, Plausible v1 usa "12 meses calendarios completos" y excluye el mes en curso.
 * - El END es HOY_UTC + 1 día para cubrir cualquier timezone del sitio en Plausible
 *   (entre UTC-12 y UTC+14). Sin ese +1, si el sitio está en Europe/Berlin y en Colombia
 *   todavía es ayer UTC, los eventos del "hoy" de Berlin no se incluyen.
 */
function buildPeriodParams(): { period: string; date: string } {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  const end = endDate.toISOString().slice(0, 10)
  const startDate = new Date(today)
  startDate.setUTCDate(startDate.getUTCDate() - HISTORY_DAYS)
  const start = startDate.toISOString().slice(0, 10)
  return { period: 'custom', date: `${start},${end}` }
}

export interface PlausibleConnection {
  access_token?: string
  platform_account_id?: string
  scopes?: string  // JSON: {"baseUrl": "https://..."}
}

/**
 * Normaliza la base URL: agrega https:// si falta, quita trailing slash y
 * cualquier `/api/...` que el usuario haya pegado por error.
 */
export function normalizePlausibleBase(input?: string | null): string {
  const raw = String(input ?? '').trim()
  if (!raw) return DEFAULT_PLAUSIBLE_BASE
  let url = raw
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  url = url.replace(/\/+$/, '').replace(/\/api(\/v\d+)?$/i, '')
  return url
}

function resolveBaseFromConn(conn?: PlausibleConnection): string {
  if (!conn?.scopes) return DEFAULT_PLAUSIBLE_BASE
  try {
    const parsed = JSON.parse(conn.scopes)
    if (parsed && typeof parsed === 'object' && typeof parsed.baseUrl === 'string') {
      return normalizePlausibleBase(parsed.baseUrl)
    }
  } catch { /* legacy '[]' or malformed — usar default */ }
  return DEFAULT_PLAUSIBLE_BASE
}

export interface TestConnectionResult {
  ok: boolean
  error?: string
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function plausibleGet<T = any>(baseUrl: string, apiKey: string, path: string, params: Record<string, any>): Promise<T> {
  const { data } = await axios.get(`${baseUrl}${API_PATH}${path}`, {
    params,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  })
  return data as T
}

function mapPlausibleError(err: any): string {
  const status = err?.response?.status
  if (status === 401) return 'API key inválida'
  if (status === 404) return 'Sitio no encontrado en tu cuenta de Plausible'
  if (status === 429) return 'Rate limit excedido en Plausible'
  if (status >= 500) return 'Plausible no responde (5xx)'
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return 'Timeout al contactar Plausible'
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return 'Error de red al contactar Plausible'
  return err?.response?.data?.error || err?.message || 'Error desconocido al contactar Plausible'
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PlausibleService {
  /**
   * One-shot connectivity check. Single aggregate call with minimal payload.
   * 200 → ok. 401 → invalid key. 404 → site_id not in this account.
   */
  static async testConnection(siteId: string, apiKey: string, baseUrl?: string): Promise<TestConnectionResult> {
    if (!siteId || !apiKey) return { ok: false, error: 'Faltan site_id o api_key' }
    const resolvedBase = normalizePlausibleBase(baseUrl)
    try {
      await plausibleGet(resolvedBase, apiKey, '/stats/aggregate', {
        site_id: siteId,
        period: 'day',
        metrics: 'visitors',
      })
      return { ok: true }
    } catch (err: any) {
      console.error('[plausible.testConnection] failed', {
        baseUrl: resolvedBase,
        siteId,
        apiKeyPrefix: apiKey.slice(0, 6) + '…',
        apiKeyLen: apiKey.length,
        status: err?.response?.status,
        body: err?.response?.data,
        code: err?.code,
        message: err?.message,
      })
      return { ok: false, error: mapPlausibleError(err) }
    }
  }

  /**
   * Pulls timeseries + breakdowns from Plausible and writes them into:
   *   - metric_snapshots (platform='web', one row per metric_type per snapshot_date)
   *   - web_dimensions   (per dimension_type, full replace)
   *
   * Mirrors the legacy /api/metrics/import-plausible upsert/replace contract
   * exactly so computeWeb() doesn't change. Per-call errors are swallowed
   * (best-effort) so a failing breakdown doesn't abort the whole sync.
   */
  static async fetchAndStore(clientId: string, conn: PlausibleConnection): Promise<void> {
    const apiKey = conn?.access_token
    const siteId = conn?.platform_account_id
    const baseUrl = resolveBaseFromConn(conn)
    if (!apiKey) throw new Error('No hay API key de Plausible (token inválido o expirado)')
    if (!siteId) throw new Error('No hay site_id de Plausible configurado')

    const periodParams = buildPeriodParams()

    // ─── Time series ─────────────────────────────────────────────────────────
    // Un solo call con todas las métricas juntas → un row por día por métrica.
    // Usamos period=custom con fecha hasta HOY para incluir el día actual.
    let timeSeries: any[] = []
    try {
      const ts = await plausibleGet<{ results: any[] }>(baseUrl, apiKey, '/stats/timeseries', {
        site_id: siteId,
        ...periodParams,
        metrics: 'visitors,pageviews,visits,bounce_rate,visit_duration',
        interval: 'date',
      })
      timeSeries = Array.isArray(ts?.results) ? ts.results : []
    } catch (err: any) {
      const status = err?.response?.status
      // 401 = key inválida → propagamos para que el worker marque is_active=0
      if (status === 401) throw new Error('Token inválido o expirado (Plausible 401)')
      console.error(`[plausible] timeseries failed for ${clientId}/${siteId} (${baseUrl}):`, mapPlausibleError(err))
    }

    // ─── Breakdowns ──────────────────────────────────────────────────────────
    // Cada breakdown es independiente; si uno falla, el resto sigue.
    const fetchBreakdown = async (property: string, metrics: string): Promise<any[]> => {
      try {
        const data = await plausibleGet<{ results: any[] }>(baseUrl, apiKey, '/stats/breakdown', {
          site_id: siteId,
          ...periodParams,
          property,
          metrics,
          limit: 50,
        })
        return Array.isArray(data?.results) ? data.results : []
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 401) throw new Error('Token inválido o expirado (Plausible 401)')
        console.error(`[plausible] breakdown ${property} failed for ${clientId}/${siteId} (${baseUrl}):`, mapPlausibleError(err))
        return []
      }
    }

    const [pagesRows, sourcesRows, devicesRows, countriesRows] = await Promise.all([
      fetchBreakdown('event:page', 'visitors,pageviews,bounce_rate'),
      fetchBreakdown('visit:source', 'visitors,bounce_rate,visit_duration'),
      fetchBreakdown('visit:device', 'visitors'),
      fetchBreakdown('visit:country', 'visitors'),
    ])

    // Log conteos para diagnóstico — útil cuando todo viene en cero (script no instalado, dominio mal-matcheado, sitio nuevo).
    console.log(
      `[plausible] fetched ${clientId}/${siteId} (${baseUrl}): ` +
      `timeseries=${timeSeries.length} rows, ` +
      `topPages=${pagesRows.length}, sources=${sourcesRows.length}, ` +
      `devices=${devicesRows.length}, countries=${countriesRows.length}`
    )

    // ─── Persistencia ────────────────────────────────────────────────────────
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const metadata = JSON.stringify({ source: 'plausible_api' })

      // Time series → metric_snapshots (UPSERT por unique key — idéntico al import legacy)
      const TS_METRICS: Array<{ type: string; key: keyof any }> = [
        { type: 'visitors',       key: 'visitors' },
        { type: 'pageviews',      key: 'pageviews' },
        { type: 'visits',         key: 'visits' },
        { type: 'bounce_rate',    key: 'bounce_rate' },
        { type: 'visit_duration', key: 'visit_duration' },
      ]
      for (const row of timeSeries) {
        const date = String((row as any).date || '').slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        for (const m of TS_METRICS) {
          const raw = (row as any)[m.key]
          const value = raw == null ? 0 : (typeof raw === 'number' ? raw : parseFloat(String(raw)) || 0)
          await db.query(
            `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date, metadata)
             VALUES ($1, $2, 'web', $3, $4, $5, $6)
             ON CONFLICT (client_id, platform, metric_type, snapshot_date)
             DO UPDATE SET value = EXCLUDED.value, created_at = NOW(), metadata = EXCLUDED.metadata`,
            [crypto.randomUUID(), clientId, m.type, value, date, metadata]
          )
        }
      }

      // Dimensional rows: borramos por dimension_type y reinsertamos (idéntico al import legacy)
      const dimGroups: Array<{
        type: string
        rows: any[]
        toVals: (r: any) => [string, number, number, number, number]  // [name, visitors, pageviews, bounce_rate, visit_duration]
      }> = [
        {
          type: 'top_pages',
          rows: pagesRows,
          toVals: r => [
            String(r.page || r.name || ''),
            Number(r.visitors) || 0,
            Number(r.pageviews) || 0,
            Number(r.bounce_rate) || 0,
            0,
          ],
        },
        {
          type: 'channels',
          rows: sourcesRows,
          toVals: r => [
            String(r.source || r.name || ''),
            Number(r.visitors) || 0,
            0,
            Number(r.bounce_rate) || 0,
            Number(r.visit_duration) || 0,
          ],
        },
        // Plausible no distingue channels vs sources como CSVs distintos.
        // Poblamos sources con el mismo dataset para mantener compat con WebPanel.
        {
          type: 'sources',
          rows: sourcesRows,
          toVals: r => [
            String(r.source || r.name || ''),
            Number(r.visitors) || 0,
            0,
            0,
            0,
          ],
        },
        {
          type: 'devices',
          rows: devicesRows,
          toVals: r => [
            String(r.device || r.name || ''),
            Number(r.visitors) || 0,
            0,
            0,
            0,
          ],
        },
        {
          type: 'countries',
          rows: countriesRows,
          toVals: r => [
            String(r.country || r.name || ''),
            Number(r.visitors) || 0,
            0,
            0,
            0,
          ],
        },
      ]

      for (const g of dimGroups) {
        // Borrar siempre — si la API devolvió 0 filas (sin tráfico), limpiamos lo viejo.
        await db.query(
          `DELETE FROM web_dimensions WHERE client_id = $1 AND dimension_type = $2`,
          [clientId, g.type]
        )
        if (!g.rows.length) continue
        for (const r of g.rows) {
          const [name, visitors, pageviews, bounce_rate, visit_duration] = g.toVals(r)
          if (!name) continue
          await db.query(
            `INSERT INTO web_dimensions (id, client_id, dimension_type, name, visitors, pageviews, bounce_rate, visit_duration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (client_id, dimension_type, name)
             DO UPDATE SET visitors = EXCLUDED.visitors, pageviews = EXCLUDED.pageviews,
                           bounce_rate = EXCLUDED.bounce_rate, visit_duration = EXCLUDED.visit_duration,
                           imported_at = NOW()`,
            [crypto.randomUUID(), clientId, g.type, name, visitors, pageviews, bounce_rate, visit_duration]
          )
        }
      }

      await db.query('COMMIT')
    } catch (txErr) {
      await db.query('ROLLBACK').catch(() => {})
      throw txErr
    } finally {
      db.release()
    }

    await pool.query(
      `UPDATE platform_connections SET last_sync_at = NOW() WHERE client_id = $1 AND platform = 'plausible'`,
      [clientId]
    )
  }
}
