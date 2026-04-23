import AdmZip from 'adm-zip'
import { parse as parseCSV } from 'csv-parse/sync'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlausibleTimeSeriesRow {
  date: string // YYYY-MM-DD
  visitors: number
  pageviews: number
  visits: number
  bounce_rate: number      // 0-100
  visit_duration: number   // seconds
}

export interface PlausibleTopPageRow {
  name: string
  visitors: number
  pageviews: number
  bounce_rate: number
}

export interface PlausibleChannelRow {
  name: string
  visitors: number
  bounce_rate: number
  visit_duration: number
}

export interface PlausibleSimpleRow {
  name: string
  visitors: number
}

export interface PlausibleParsed {
  timeSeries: PlausibleTimeSeriesRow[]
  topPages: PlausibleTopPageRow[]
  channels: PlausibleChannelRow[]
  sources: PlausibleSimpleRow[]
  devices: PlausibleSimpleRow[]
  countries: PlausibleSimpleRow[]
  errors: string[]
  filesProcessed: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(raw: any): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).trim())
  return isFinite(n) ? n : 0
}

function isDateLike(s: any): boolean {
  if (typeof s !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}/.test(s.trim())
}

/**
 * Detect which Plausible CSV this is by inspecting its header row.
 * Falls back to the filename hint (e.g., "visitors.csv") when headers are ambiguous
 * (channels.csv and sources.csv share the same header signature).
 */
type CSVKind = 'visitors' | 'pages' | 'channels' | 'sources' | 'devices' | 'countries' | 'unknown'

function detectKind(headers: string[], fileNameHint: string): CSVKind {
  const hs = headers.map(h => h.toLowerCase().trim())
  const setHas = (...keys: string[]) => keys.every(k => hs.includes(k))
  const name = (fileNameHint || '').toLowerCase()

  // visitors.csv — has `date` column
  if (hs.includes('date') && hs.includes('visitors')) return 'visitors'

  // pages.csv — has time_on_page/scroll_depth
  if (setHas('name', 'visitors') && (hs.includes('time_on_page') || hs.includes('scroll_depth') || hs.includes('pageviews'))) {
    // Careful: visitors.csv also has 'pageviews', but we already ruled it out above.
    // pages.csv is the only dimensional one with time_on_page / scroll_depth.
    if (hs.includes('time_on_page') || hs.includes('scroll_depth')) return 'pages'
  }

  // devices.csv / countries.csv — only name, visitors
  if (setHas('name', 'visitors') && hs.length === 2) {
    if (name.includes('device')) return 'devices'
    if (name.includes('countr')) return 'countries'
    // Fallback by file name alone: any "name,visitors" with 2 cols
    if (name.includes('region')) return 'unknown' // unsupported, skip
    if (name.includes('cit')) return 'unknown'
    if (name.includes('browser')) return 'unknown'
    if (name.includes('os') || name.includes('operating')) return 'unknown'
    if (name.includes('utm')) return 'unknown'
    if (name.includes('conversion')) return 'unknown'
    if (name.includes('custom')) return 'unknown'
    if (name.includes('entry')) return 'unknown'
    if (name.includes('exit')) return 'unknown'
    if (name.includes('referrer')) return 'unknown'
    return 'unknown'
  }

  // channels.csv / sources.csv / referrers.csv — name,visitors,bounce_rate,visit_duration
  if (setHas('name', 'visitors', 'bounce_rate', 'visit_duration')) {
    if (name.includes('channel')) return 'channels'
    if (name.includes('source')) return 'sources'
    // Unknown — treat as sources by default if not explicitly a channel/source/referrer file
    if (name.includes('referrer')) return 'sources'
    return 'unknown'
  }

  return 'unknown'
}

function parseCSVContent(content: string): { headers: string[]; rows: any[] } {
  const records = parseCSV(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, any>[]
  const headers = records.length ? Object.keys(records[0]) : []
  return { headers, rows: records }
}

function processVisitors(rows: any[], result: PlausibleParsed): void {
  for (const row of rows) {
    const date = String(row.date || '').trim()
    if (!isDateLike(date)) continue
    result.timeSeries.push({
      date,
      visitors: toNum(row.visitors),
      pageviews: toNum(row.pageviews),
      visits: toNum(row.visits),
      bounce_rate: toNum(row.bounce_rate),
      visit_duration: toNum(row.visit_duration),
    })
  }
}

function processPages(rows: any[], result: PlausibleParsed): void {
  for (const row of rows) {
    const name = String(row.name || '').trim()
    if (!name) continue
    result.topPages.push({
      name,
      visitors: toNum(row.visitors),
      pageviews: toNum(row.pageviews),
      bounce_rate: toNum(row.bounce_rate),
    })
  }
}

function processChannels(rows: any[], result: PlausibleParsed): void {
  for (const row of rows) {
    const name = String(row.name || '').trim()
    if (!name) continue
    result.channels.push({
      name,
      visitors: toNum(row.visitors),
      bounce_rate: toNum(row.bounce_rate),
      visit_duration: toNum(row.visit_duration),
    })
  }
}

function processSources(rows: any[], result: PlausibleParsed): void {
  for (const row of rows) {
    const name = String(row.name || '').trim()
    if (!name) continue
    result.sources.push({ name, visitors: toNum(row.visitors) })
  }
}

function processDevices(rows: any[], result: PlausibleParsed): void {
  for (const row of rows) {
    const name = String(row.name || '').trim()
    if (!name) continue
    result.devices.push({ name, visitors: toNum(row.visitors) })
  }
}

function processCountries(rows: any[], result: PlausibleParsed): void {
  for (const row of rows) {
    const name = String(row.name || '').trim()
    if (!name) continue
    result.countries.push({ name, visitors: toNum(row.visitors) })
  }
}

function processSingleCSV(
  fileName: string,
  content: string,
  result: PlausibleParsed,
): void {
  let parsed: { headers: string[]; rows: any[] }
  try {
    parsed = parseCSVContent(content)
  } catch (err: any) {
    result.errors.push(`${fileName}: failed to parse CSV — ${err?.message || err}`)
    return
  }
  if (!parsed.rows.length) {
    // Empty CSV — silently skip
    return
  }
  const kind = detectKind(parsed.headers, fileName)
  if (kind === 'unknown') {
    // Not one of the 6 we care about — silently skip (don't pollute errors)
    return
  }
  switch (kind) {
    case 'visitors':  processVisitors(parsed.rows, result); break
    case 'pages':     processPages(parsed.rows, result); break
    case 'channels':  processChannels(parsed.rows, result); break
    case 'sources':   processSources(parsed.rows, result); break
    case 'devices':   processDevices(parsed.rows, result); break
    case 'countries': processCountries(parsed.rows, result); break
  }
  result.filesProcessed.push(`${fileName} (${kind})`)
}

/**
 * Main entry point. Accepts either:
 *   - a ZIP of Plausible CSV exports, or
 *   - a single CSV buffer.
 *
 * The `fileName` hint disambiguates channels.csv vs sources.csv (identical headers),
 * and helps skip irrelevant CSVs (cities, regions, browsers, utm_*, etc.).
 *
 * Defensive: missing/unknown files are skipped silently. Parse errors are collected.
 */
export function parsePlausibleExport(buffer: Buffer, fileName: string): PlausibleParsed {
  const result: PlausibleParsed = {
    timeSeries: [],
    topPages: [],
    channels: [],
    sources: [],
    devices: [],
    countries: [],
    errors: [],
    filesProcessed: [],
  }

  const lowerName = (fileName || '').toLowerCase()
  const isZip = lowerName.endsWith('.zip')

  if (isZip) {
    let zip: AdmZip
    try {
      zip = new AdmZip(buffer)
    } catch (err: any) {
      result.errors.push(`Failed to read ZIP: ${err?.message || err}`)
      return result
    }
    const entries = zip.getEntries()
    for (const entry of entries) {
      if (entry.isDirectory) continue
      const entryName = entry.entryName
      if (!entryName.toLowerCase().endsWith('.csv')) continue
      // Skip macOS metadata files
      if (entryName.includes('__MACOSX/') || entryName.split('/').pop()?.startsWith('._')) continue
      let content: string
      try {
        content = entry.getData().toString('utf8')
      } catch (err: any) {
        result.errors.push(`${entryName}: failed to extract — ${err?.message || err}`)
        continue
      }
      // Strip directory prefix for detection (e.g. "Plausible export .../visitors.csv" → "visitors.csv")
      const baseName = entryName.split('/').pop() || entryName
      processSingleCSV(baseName, content, result)
    }
  } else {
    // Single CSV
    const content = buffer.toString('utf8')
    processSingleCSV(fileName, content, result)
  }

  // Dedup time series by date (last one wins — shouldn't happen in practice)
  const tsMap = new Map<string, PlausibleTimeSeriesRow>()
  for (const r of result.timeSeries) tsMap.set(r.date, r)
  result.timeSeries = Array.from(tsMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return result
}
