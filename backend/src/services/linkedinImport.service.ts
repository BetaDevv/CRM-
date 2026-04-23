import * as XLSX from 'xlsx'

export type LinkedInMetricType =
  | 'followers'
  | 'new_followers'
  | 'impressions'
  | 'clicks'
  | 'engagement_rate'
  | 'page_views'
  | 'unique_visitors'

export type ImportKind = 'content' | 'visitors' | 'followers'

export interface ParsedMetric {
  snapshot_date: string // YYYY-MM-DD
  metric_type: LinkedInMetricType
  value: number
}

export interface ParseResult {
  metrics: ParsedMetric[]
  errors: string[]
  dateRange: { min: string; max: string } | null
  sheetsProcessed: string[]
  sheetNamesAll?: string[]
  headersByProcessedSheet?: Record<string, string[]>
  columnMapping?: Record<string, string>
}

type ColumnMatcher = {
  type: LinkedInMetricType
  primary: RegExp
  prefer?: RegExp        // weak preference (+10), e.g. section filter like "overview/übersicht"
  preferStrong?: RegExp  // strong preference (+100), typically "total/insgesamt/gesamt"
  avoid?: RegExp
}

const PREFER_TOTAL = /insgesamt|gesamt|total|overall|t[oó]taux|totales?/i
const DATE_HEADER_REGEX = /^(date|datum|fecha|day|tag|día|dia)$/i

const CONTENT_MATCHERS: ColumnMatcher[] = [
  {
    type: 'impressions',
    primary: /impression|eindr[üu]cke|impresiones/i,
    prefer: PREFER_TOTAL,
    avoid: /individual|individuell|unique|einzeln|[uú]nic/i,
  },
  {
    type: 'clicks',
    primary: /klick|click|clic/i,
    prefer: PREFER_TOTAL,
    avoid: /rate|ctr|porcentaje/i,
  },
  {
    type: 'engagement_rate',
    primary: /engagement rate|interaction(s)? rate|interaktionsrate|tasa de interacci[oó]n|engagement/i,
    prefer: PREFER_TOTAL,
  },
]

const VISITORS_MATCHERS: ColumnMatcher[] = [
  {
    type: 'page_views',
    primary: /aufrufe|page views?|seitenaufrufe|vistas de p[aá]gina|vistas|visits?/i,
    prefer: /übersicht|overview|home|inicio/i,  // prefer main Overview page over sub-sections (careers/culture)
    preferStrong: PREFER_TOTAL,                   // but above all, prefer the "total" column over device-specific
    avoid: /individual|individuell|unique|einzeln|eindeutig|[uú]nic|visitor|besucher|visitante/i,
  },
  {
    type: 'unique_visitors',
    primary: /individuell|unique|eindeutig|[uú]nic|besucher|visitor|visitante/i,
    prefer: /übersicht|overview|home|inicio/i,
    preferStrong: PREFER_TOTAL,
  },
]

const FOLLOWERS_MATCHERS: ColumnMatcher[] = [
  {
    // LinkedIn's follower export is daily NEW followers only (not cumulative totals).
    type: 'new_followers',
    primary: /follower|seguidor|abonne/i,
    prefer: PREFER_TOTAL,
    avoid: /sponsored|gesponsert|organisch|organic|automatisch|invited|eingeladen/i,
  },
]

function parseDate(raw: any): string | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !isNaN(raw.getTime())) return toISO(raw)
  if (typeof raw === 'number' && isFinite(raw)) {
    if (raw > 1 && raw < 80000) {
      const ms = Math.round((raw - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) return toISO(d)
    }
    return null
  }
  const s = String(raw).trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3]
    const dt = new Date(Date.UTC(y, m - 1, d))
    if (!isNaN(dt.getTime())) return toISO(dt)
  }
  const slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (slash) {
    const a = +slash[1], b = +slash[2]
    let y = +slash[3]
    if (y < 100) y += y >= 70 ? 1900 : 2000
    const now = new Date()
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
    const candMDY = tryDate(y, a, b)
    const candDMY = tryDate(y, b, a)
    const withinRange = (d: Date | null) => d && d >= twoYearsAgo && d <= new Date(now.getFullYear() + 1, 0, 1)
    if (withinRange(candMDY)) return toISO(candMDY!)
    if (withinRange(candDMY)) return toISO(candDMY!)
    if (candMDY) return toISO(candMDY)
    if (candDMY) return toISO(candDMY)
  }
  const fallback = new Date(s)
  if (!isNaN(fallback.getTime())) return toISO(fallback)
  return null
}

function tryDate(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (isNaN(dt.getTime())) return null
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt
}

function toISO(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseNumber(raw: any): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return isFinite(raw) ? raw : null
  let s = String(raw).trim()
  if (!s) return null
  s = s.replace(/%/g, '').replace(/\s/g, '').replace(/,/g, '')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

/**
 * Find the first sheet in the workbook whose first 10 rows contain a recognizable date
 * column header. Returns { sheetName, headerRowIdx, dateColIdx, headers, rows } or null.
 */
function findDailySheet(workbook: XLSX.WorkBook): {
  sheetName: string
  headerRowIdx: number
  dateColIdx: number
  headers: string[]
  rows: any[][]
} | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    let rows: any[][]
    try {
      rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false, blankrows: false })
    } catch { continue }
    if (!rows.length) continue

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r] || []
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (typeof cell === 'string' && DATE_HEADER_REGEX.test(cell.trim())) {
          const headers: string[] = (rows[r] || []).map((h: any) => String(h ?? '').trim())
          return { sheetName, headerRowIdx: r, dateColIdx: c, headers, rows }
        }
      }
    }
  }
  return null
}

function findBestColumn(headers: string[], m: ColumnMatcher): number {
  let bestIdx = -1
  let bestScore = 0
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (!m.primary.test(h)) continue
    if (m.avoid && m.avoid.test(h)) continue
    let score = 1
    if (m.prefer && m.prefer.test(h)) score += 10
    if (m.preferStrong && m.preferStrong.test(h)) score += 100
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}

function extractMetrics(
  sheetName: string,
  rows: any[][],
  headerRowIdx: number,
  dateColIdx: number,
  headers: string[],
  matchers: ColumnMatcher[],
  result: ParseResult,
): void {
  const typeToCol = new Map<LinkedInMetricType, number>()
  for (const m of matchers) {
    if (typeToCol.has(m.type)) continue
    const idx = findBestColumn(headers, m)
    if (idx >= 0) typeToCol.set(m.type, idx)
  }

  if (!typeToCol.size) {
    result.errors.push(`Sheet "${sheetName}": no metric columns matched for this kind.`)
    return
  }

  // Log + expose the mapping
  const mapping: Record<string, string> = {}
  for (const [t, i] of typeToCol.entries()) mapping[t] = headers[i]
  result.columnMapping = mapping
  console.log(`[linkedinImport] sheet="${sheetName}" picked:`, mapping)

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row.length) continue
    const dateStr = parseDate(row[dateColIdx])
    if (!dateStr) continue
    for (const [metricType, colIdx] of typeToCol.entries()) {
      const raw = row[colIdx]
      if (raw == null || raw === '') continue
      const value = parseNumber(raw)
      if (value == null || isNaN(value)) continue
      result.metrics.push({ snapshot_date: dateStr, metric_type: metricType, value })
    }
  }
}

/**
 * Main entry point. Parses a LinkedIn Page Analytics XLSX/CSV export into daily metric
 * snapshots. The `kind` parameter matches the 3 LinkedIn export flavors:
 *   - 'content':  daily impressions / clicks / engagement rate (sheet "Kennzahlen" in DE)
 *   - 'visitors': daily page views / unique visitors (sheet "Besuchskennzahlen" in DE)
 *   - 'followers': daily NEW followers (sheet "Neue Follower innen" in DE) — LinkedIn
 *     doesn't export cumulative totals, only daily increments.
 *
 * Defensive: missing sheets/columns are collected as errors, never thrown.
 */
export function parseLinkedInExport(buffer: Buffer, kind: ImportKind): ParseResult {
  const result: ParseResult = {
    metrics: [],
    errors: [],
    dateRange: null,
    sheetsProcessed: [],
    sheetNamesAll: [],
    headersByProcessedSheet: {},
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false })
  } catch (err: any) {
    result.errors.push(`Failed to read workbook: ${err?.message || err}`)
    return result
  }

  result.sheetNamesAll = [...(workbook.SheetNames || [])]
  if (!result.sheetNamesAll.length) {
    result.errors.push('Workbook has no sheets.')
    return result
  }

  const daily = findDailySheet(workbook)
  if (!daily) {
    result.errors.push('No sheet with a recognizable date column (Date/Datum/Fecha) found.')
    return result
  }

  result.sheetsProcessed.push(daily.sheetName)
  result.headersByProcessedSheet![daily.sheetName] = daily.headers

  const matchers =
    kind === 'content' ? CONTENT_MATCHERS :
    kind === 'visitors' ? VISITORS_MATCHERS :
    FOLLOWERS_MATCHERS

  extractMetrics(daily.sheetName, daily.rows, daily.headerRowIdx, daily.dateColIdx, daily.headers, matchers, result)

  // Dedup by (date, metric_type)
  const dedup = new Map<string, ParsedMetric>()
  for (const m of result.metrics) {
    dedup.set(`${m.snapshot_date}::${m.metric_type}`, m)
  }
  result.metrics = Array.from(dedup.values())

  if (result.metrics.length) {
    let min = result.metrics[0].snapshot_date
    let max = min
    for (const m of result.metrics) {
      if (m.snapshot_date < min) min = m.snapshot_date
      if (m.snapshot_date > max) max = m.snapshot_date
    }
    result.dateRange = { min, max }
  }

  return result
}
