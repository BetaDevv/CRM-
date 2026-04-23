import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Linkedin, ExternalLink, Loader2, AlertCircle,
  RefreshCw, Unlink, BarChart3, Play, FileDown,
  Upload, X, CheckCircle2, Globe,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { api, importMetrics, importPlausible } from '../lib/api'
import { localToday, getLocale } from '../lib/utils'
import { useTranslation } from 'react-i18next'
import type { JSX } from 'react'
import {
  CRIMSON, META_COLOR, GA4_COLOR, WEB_COLOR,
  LinkedInPanel, MetaPanel, TikTokPanel, GA4Panel, WebPanel,
} from '../components/metrics/PlatformPanels'

type Platform = 'linkedin' | 'meta' | 'tiktok' | 'ga4' | 'web'

type PlatformDef = { key: Platform; label: string; labelKey?: string; icon: JSX.Element; color: string; bg: string }

const PLATFORMS: PlatformDef[] = [
  { key: 'linkedin', label: 'LinkedIn',  icon: <Linkedin size={15} />,  color: '#0077B5', bg: '#0077B515' },
  { key: 'meta',     label: 'Meta',      icon: <span className="text-[13px] font-black">f</span>, color: META_COLOR,   bg: '#1877F215' },
  { key: 'tiktok',   label: 'TikTok',    icon: <Play size={13} fill="currentColor" />,              color: '#69C9D0',    bg: '#69C9D015' },
  { key: 'ga4',      label: 'Analytics', icon: <BarChart3 size={14} />, color: GA4_COLOR,  bg: '#E3740015' },
  { key: 'web',      label: 'Web',       labelKey: 'metrics.web.label', icon: <Globe size={14} />,     color: WEB_COLOR,  bg: '#10B98115' },
]

function ConnectionBadge({ connected, name, lastSync, platform, clientId, onDisconnect }: {
  connected: boolean; name?: string; lastSync?: string; platform: string; clientId: string; onDisconnect: () => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const handleConnect = () => {
    window.location.href = `/api/oauth/${platform}/connect/${clientId}`
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {name || t('admin:metrics.connected')}
        </div>
        {lastSync && (
          <span className="text-xs text-ink-500">
            {t('admin:metrics.syncLabel')} {new Date(lastSync).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button onClick={onDisconnect} className="flex items-center gap-1 text-xs text-ink-500 hover:text-red-400 transition-colors">
          <Unlink size={12} /> {t('admin:metrics.disconnect')}
        </button>
      </div>
    )
  }
  return (
    <button onClick={handleConnect}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all" style={{ background: 'rgb(var(--accent) / 0.2)', borderColor: 'rgb(var(--accent) / 0.3)', color: 'var(--accent-light)' }}>
      <ExternalLink size={12} /> {t('admin:metrics.connectReal')}
    </button>
  )
}

// ─── Connect CTA ──────────────────────────────────────────────────────────────
function ConnectCTA({ platform, clientId, color, icon }: { platform: string; clientId: string; color: string; icon: JSX.Element }) {
  const { t } = useTranslation(['admin', 'common'])
  const platformKey = platform as 'linkedin' | 'meta' | 'tiktok' | 'ga4'
  const info = {
    title: t(`admin:metrics.connect.${platformKey}.title`),
    desc: t(`admin:metrics.connect.${platformKey}.desc`),
    steps: [
      t(`admin:metrics.connect.${platformKey}.step1`),
      t(`admin:metrics.connect.${platformKey}.step2`),
      t(`admin:metrics.connect.${platformKey}.step3`),
    ],
  }

  return (
    <div className="glass-card p-6 border border-white/5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-xl font-black"
          style={{ background: color }}>
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-white mb-1">{info.title}</h4>
          <p className="text-sm text-ink-300 mb-4">{info.desc}</p>
          <div className="space-y-1 mb-5">
            {info.steps.map((step, i) => (
              <p key={i} className="text-xs text-ink-400">
                <span className="text-white font-medium">{i + 1}.</span> {step}
              </p>
            ))}
          </div>
          <a href={`/api/oauth/${platform}/connect/${clientId}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: color }}>
            <ExternalLink size={14} /> {t('admin:metrics.connectAccount')}
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Metricas() {
  const { t } = useTranslation(['admin', 'common'])
  const { clients } = useStore()
  const { isAdmin, user } = useAuthStore()
  const [selectedClientId, setSelectedClientId] = useState('')
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importKind, setImportKind] = useState<'content' | 'visitors' | 'followers' | null>(null)
  const [plausibleOpen, setPlausibleOpen] = useState(false)

  const activeClients = clients.filter(c => c.status === 'active')
  const selectedClient = clients.find(c => c.id === selectedClientId)

  const reloadMetrics = () => {
    if (!selectedClientId) return
    setLoading(true)
    api.get(`/metrics/${selectedClientId}?days=${days}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isAdmin() && activeClients.length > 0 && !selectedClientId) {
      setSelectedClientId(activeClients[0].id)
    } else if (!isAdmin() && user?.clientId) {
      setSelectedClientId(user.clientId)
    }
  }, [clients.length])

  useEffect(() => {
    if (!selectedClientId) return
    setLoading(true)
    setData(null)
    api.get(`/metrics/${selectedClientId}?days=${days}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedClientId, days])

  const handleDisconnect = async (platform: string) => {
    if (!confirm(t('admin:metrics.disconnectConfirm', { platform }))) return
    await api.delete(`/oauth/${platform}/disconnect/${selectedClientId}`)
    setData((d: any) => d ? { ...d, connections: { ...d.connections, [platform]: { connected: false } } } : d)
  }

  const handleSync = async () => {
    setSyncing(true)
    await api.post('/metrics/sync').catch(console.error)
    setTimeout(() => setSyncing(false), 2000)
  }

  const handleExport = async () => {
    if (!selectedClientId) return
    setExporting(true)
    try {
      const response = await api.get(`/reports/${selectedClientId}?days=${days}`, {
        responseType: 'blob',
      })
      const clientName = clients.find(c => c.id === selectedClientId)?.company || 'cliente'
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `reporte-${clientName.replace(/\s+/g, '-')}-${localToday()}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exportando reporte:', err)
    } finally {
      setExporting(false)
    }
  }

  const conn = data?.connections?.[activePlatform]
  const platformData = data?.platforms?.[activePlatform]
  const platformLabel = (p: PlatformDef) => p.labelKey ? t(`admin:${p.labelKey}`) : p.label

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="section-title">{t('admin:metrics.title')}</h2>
          <p className="text-ink-300 text-sm mt-1">{t('admin:metrics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Days filter */}
          <div className="flex gap-1 bg-ink-800/60 rounded-xl p-1 border border-white/5">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${days === d ? 'text-white border' : 'text-ink-400 hover:text-white'}`}
                style={days === d ? { background: 'rgb(var(--accent) / 0.3)', borderColor: 'rgb(var(--accent) / 0.3)' } : {}}>
                {d}{t('admin:metrics.dayAbbr')}
              </button>
            ))}
          </div>
          {selectedClientId && data && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border hover:text-white transition-all disabled:opacity-50" style={{ background: 'rgb(var(--accent) / 0.2)', borderColor: 'rgb(var(--accent) / 0.3)', color: 'var(--accent-light)' }}>
              <FileDown size={13} className={exporting ? 'animate-bounce' : ''} />
              {exporting ? t('admin:metrics.exporting') : t('admin:metrics.exportPDF')}
            </button>
          )}
          {isAdmin() && activePlatform === 'linkedin' && selectedClientId && (
            <>
              <button onClick={() => setImportKind('content')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border hover:text-white transition-all"
                style={{ background: 'rgb(var(--accent) / 0.2)', borderColor: 'rgb(var(--accent) / 0.3)', color: 'var(--accent-light)' }}>
                <Upload size={13} />
                {t('admin:metrics.import.buttonContent')}
              </button>
              <button onClick={() => setImportKind('visitors')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border hover:text-white transition-all"
                style={{ background: 'rgb(var(--accent) / 0.2)', borderColor: 'rgb(var(--accent) / 0.3)', color: 'var(--accent-light)' }}>
                <Upload size={13} />
                {t('admin:metrics.import.buttonVisitors')}
              </button>
              <button onClick={() => setImportKind('followers')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border hover:text-white transition-all"
                style={{ background: 'rgb(var(--accent) / 0.2)', borderColor: 'rgb(var(--accent) / 0.3)', color: 'var(--accent-light)' }}>
                <Upload size={13} />
                {t('admin:metrics.import.buttonFollowers')}
              </button>
            </>
          )}
          {isAdmin() && activePlatform === 'web' && selectedClientId && (
            <button onClick={() => setPlausibleOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border hover:text-white transition-all"
              style={{ background: WEB_COLOR + '20', borderColor: WEB_COLOR + '50', color: WEB_COLOR }}>
              <Upload size={13} />
              {t('admin:metrics.import.buttonPlausible')}
            </button>
          )}
          {isAdmin() && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-ink-800/60 border border-white/10 text-ink-300 hover:text-white transition-all disabled:opacity-50">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? t('admin:metrics.syncing') : t('admin:metrics.syncNow')}
            </button>
          )}
        </div>
      </div>

      {/* Client selector — admin only */}
      {isAdmin() && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {activeClients.map(c => (
            <motion.button key={c.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedClientId(c.id)}
              className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all duration-200
                ${selectedClientId === c.id ? 'text-white' : 'border-white/10 text-ink-300 bg-ink-800/40'}`}
              style={selectedClientId === c.id ? { background: c.color + '20', borderColor: c.color + '60', color: c.color } : {}}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white" style={{ background: c.color }}>
                {c.company.slice(0, 1)}
              </div>
              {c.company}
            </motion.button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
        </div>
      )}

      {!loading && !data && (
        <div className="glass-card p-12 flex flex-col items-center text-center">
          <AlertCircle size={40} className="text-ink-500 mb-3 opacity-40" />
          <p className="text-ink-300">{t('admin:metrics.selectClient')}</p>
        </div>
      )}

      {!loading && data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* Platform tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {PLATFORMS.map(p => {
              const isConnected = data.connections?.[p.key]?.connected
              const hasData = !!data.platforms?.[p.key]
              return (
                <motion.button key={p.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setActivePlatform(p.key)}
                  className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all duration-200
                    ${activePlatform === p.key ? 'text-white' : 'border-white/10 text-ink-300 bg-ink-800/40'}`}
                  style={activePlatform === p.key ? { background: p.bg, borderColor: p.color + '40', color: p.color } : {}}>
                  <span style={activePlatform === p.key ? { color: p.color } : {}}>{p.icon}</span>
                  {platformLabel(p)}
                  {(isConnected || hasData) && (
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-500'}`} />
                  )}
                </motion.button>
              )
            })}
          </div>

          {/* Connection status + disconnect */}
          {isAdmin() && selectedClientId && (
            <div className="flex items-center gap-4 flex-wrap">
              <ConnectionBadge
                connected={conn?.connected}
                name={conn?.account_name}
                lastSync={conn?.last_sync}
                platform={activePlatform}
                clientId={selectedClientId}
                onDisconnect={() => handleDisconnect(activePlatform)}
              />
            </div>
          )}

          {/* Platform content */}
          <AnimatePresence mode="wait">
            <motion.div key={activePlatform} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
              {platformData ? (
                <>
                  {activePlatform === 'linkedin' && <LinkedInPanel data={platformData} days={days} />}
                  {activePlatform === 'meta'     && <MetaPanel     data={platformData} days={days} />}
                  {activePlatform === 'tiktok'   && <TikTokPanel   data={platformData} />}
                  {activePlatform === 'ga4'      && <GA4Panel      data={platformData} days={days} />}
                  {activePlatform === 'web'      && <WebPanel      data={platformData} days={days} />}
                </>
              ) : activePlatform === 'web' ? (
                <div className="glass-card p-12 flex flex-col items-center text-center">
                  <Globe size={40} className="text-ink-500 mb-3 opacity-40" />
                  <p className="text-ink-300 mb-1">
                    {isAdmin() ? t('admin:metrics.web.emptyAdmin') : t('admin:metrics.web.emptyClient')}
                  </p>
                  <p className="text-ink-500 text-sm">{t('admin:metrics.import.plausibleHint')}</p>
                </div>
              ) : (
                isAdmin() ? (
                  <ConnectCTA
                    platform={activePlatform}
                    clientId={selectedClientId}
                    color={PLATFORMS.find(p => p.key === activePlatform)?.color || CRIMSON}
                    icon={PLATFORMS.find(p => p.key === activePlatform)?.icon || <ExternalLink size={18} />}
                  />
                ) : (
                  <div className="glass-card p-12 flex flex-col items-center text-center">
                    <AlertCircle size={36} className="text-ink-500 mb-3 opacity-30" />
                    <p className="text-ink-300 mb-1">{t('admin:metrics.noDataFor', { platform: platformLabel(PLATFORMS.find(p => p.key === activePlatform) as PlatformDef) })}</p>
                    <p className="text-ink-500 text-sm">{t('admin:metrics.teamWillConfigure')}</p>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* Import XLSX Modal */}
      <AnimatePresence>
        {importKind && selectedClient && (
          <ImportLinkedInModal
            client={selectedClient}
            kind={importKind}
            onClose={() => setImportKind(null)}
            onSuccess={() => {
              setImportKind(null)
              reloadMetrics()
            }}
          />
        )}
      </AnimatePresence>

      {/* Import Plausible Modal */}
      <AnimatePresence>
        {plausibleOpen && selectedClient && (
          <ImportPlausibleModal
            client={selectedClient}
            onClose={() => setPlausibleOpen(false)}
            onSuccess={() => {
              setPlausibleOpen(false)
              reloadMetrics()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Import LinkedIn XLSX Modal ───────────────────────────────────────────────
function ImportLinkedInModal({ client, kind, onClose, onSuccess }: {
  client: { id: string; company: string }
  kind: 'content' | 'visitors' | 'followers'
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<
    | { kind: 'success'; count: number; min: string; max: string }
    | { kind: 'error'; message: string; errors?: string[]; sheetNamesAll?: string[]; sheetsProcessed?: string[]; headersByProcessedSheet?: Record<string, string[]> }
    | null
  >(null)

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return
    setFile(files[0])
    setFeedback(null)
  }

  const handleSubmit = async () => {
    if (!file) {
      setFeedback({ kind: 'error', message: t('admin:metrics.import.noFileSelected') })
      return
    }
    setUploading(true)
    setFeedback(null)
    try {
      const res = await importMetrics(client.id, 'linkedin', kind, file)
      if (res.imported > 0) {
        setFeedback({
          kind: 'success',
          count: res.imported,
          min: res.dateRange?.min || '-',
          max: res.dateRange?.max || '-',
        })
        setTimeout(onSuccess, 1500)
      } else {
        setFeedback({
          kind: 'error',
          message: res.errors?.[0] || 'No data',
          errors: res.errors,
          sheetNamesAll: (res as any).sheetNamesAll,
          sheetsProcessed: res.sheetsProcessed,
          headersByProcessedSheet: (res as any).headersByProcessedSheet,
        })
      }
    } catch (err: any) {
      const data = err?.response?.data
      const msg = data?.error || (data?.errors?.[0]) || err?.message || 'Unknown error'
      setFeedback({
        kind: 'error',
        message: msg,
        errors: data?.errors,
        sheetNamesAll: data?.sheetNamesAll,
        sheetsProcessed: data?.sheetsProcessed,
        headersByProcessedSheet: data?.headersByProcessedSheet,
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onMouseDown={e => e.stopPropagation()}
        className="glass-card p-6 w-full max-w-lg border border-white/10"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Linkedin size={18} style={{ color: '#0077B5' }} />
              {t('admin:metrics.import.modalTitle')}
            </h3>
            <div className="flex gap-4 mt-2 text-xs text-ink-400 flex-wrap">
              <span>{t('admin:metrics.import.clientLabel')}: <span className="text-white font-medium">{client.company}</span></span>
              <span>{t('admin:metrics.import.platformLabel')}: <span className="text-white font-medium">LinkedIn</span></span>
              <span>{t('admin:metrics.import.kindLabel')}: <span className="text-white font-medium capitalize">{kind === 'content' ? t('admin:metrics.import.kind.content') : kind === 'visitors' ? t('admin:metrics.import.kind.visitors') : t('admin:metrics.import.kind.followers')}</span></span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
          className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[color:var(--accent-light)] bg-[rgb(var(--accent)/0.1)]'
              : 'border-ink-600 bg-ink-800/40 hover:border-ink-500'
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Upload size={28} className="mx-auto mb-3 text-ink-400" />
          {file ? (
            <div>
              <p className="text-sm text-white font-medium truncate">{file.name}</p>
              <p className="text-xs text-ink-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <p className="text-sm text-ink-300">{t('admin:metrics.import.dropzoneHint')}</p>
          )}
        </label>

        {/* Feedback */}
        <AnimatePresence>
          {feedback?.kind === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs"
            >
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <p>{t('admin:metrics.import.successToast', { count: feedback.count })}</p>
                <p className="text-emerald-400/70 mt-0.5">{feedback.min} → {feedback.max}</p>
              </div>
            </motion.div>
          )}
          {feedback?.kind === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-2 max-h-64 overflow-y-auto thin-scrollbar"
            >
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span className="font-semibold">{feedback.message}</span>
              </div>
              {!!feedback.sheetNamesAll?.length && (
                <div className="pl-5 text-ink-300">
                  <div className="font-semibold text-ink-200 mb-0.5">{t('admin:metrics.import.diag.sheetsAll')}</div>
                  <div className="font-mono text-[11px] break-words">{feedback.sheetNamesAll.join(' · ')}</div>
                </div>
              )}
              {!!feedback.sheetsProcessed?.length && (
                <div className="pl-5 text-ink-300">
                  <div className="font-semibold text-ink-200 mb-0.5">{t('admin:metrics.import.diag.sheetsProcessed')}</div>
                  <div className="font-mono text-[11px] break-words">{feedback.sheetsProcessed.join(' · ')}</div>
                </div>
              )}
              {feedback.headersByProcessedSheet && Object.keys(feedback.headersByProcessedSheet).length > 0 && (
                <div className="pl-5 text-ink-300">
                  <div className="font-semibold text-ink-200 mb-0.5">{t('admin:metrics.import.diag.headers')}</div>
                  {Object.entries(feedback.headersByProcessedSheet).map(([sheet, headers]) => (
                    <div key={sheet} className="font-mono text-[11px] break-words mb-1">
                      <span className="text-amber-300">[{sheet}]</span> {headers.join(' | ')}
                    </div>
                  ))}
                </div>
              )}
              {!!feedback.errors?.length && feedback.errors.length > 1 && (
                <div className="pl-5 text-ink-300">
                  <div className="font-semibold text-ink-200 mb-0.5">{t('admin:metrics.import.diag.errors')}</div>
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                    {feedback.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-ink-800 border border-white/10 text-ink-300 hover:text-white transition-all disabled:opacity-50"
          >
            {t('common:common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'rgb(var(--accent))' }}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {t('admin:metrics.import.submitButton')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Import Plausible ZIP/CSV Modal ───────────────────────────────────────────
function ImportPlausibleModal({ client, onClose, onSuccess }: {
  client: { id: string; company: string }
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<
    | { kind: 'success'; timeSeriesRows: number; dimensionRows: number; filesProcessed: string[]; min: string; max: string }
    | { kind: 'error'; message: string; errors?: string[]; filesProcessed?: string[] }
    | null
  >(null)

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return
    setFile(files[0])
    setFeedback(null)
  }

  const handleSubmit = async () => {
    if (!file) {
      setFeedback({ kind: 'error', message: t('admin:metrics.import.noFileSelected') })
      return
    }
    setUploading(true)
    setFeedback(null)
    try {
      const res = await importPlausible(client.id, file)
      if (res.timeSeriesRows > 0 || res.dimensionRows > 0) {
        setFeedback({
          kind: 'success',
          timeSeriesRows: res.timeSeriesRows,
          dimensionRows: res.dimensionRows,
          filesProcessed: res.filesProcessed || [],
          min: res.dateRange?.min || '-',
          max: res.dateRange?.max || '-',
        })
        setTimeout(onSuccess, 1800)
      } else {
        setFeedback({
          kind: 'error',
          message: res.errors?.[0] || 'No data',
          errors: res.errors,
          filesProcessed: res.filesProcessed,
        })
      }
    } catch (err: any) {
      const data = err?.response?.data
      const msg = data?.error || data?.errors?.[0] || err?.message || 'Unknown error'
      setFeedback({
        kind: 'error',
        message: msg,
        errors: data?.errors,
        filesProcessed: data?.filesProcessed,
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onMouseDown={e => e.stopPropagation()}
        className="glass-card p-6 w-full max-w-lg border border-white/10"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe size={18} style={{ color: WEB_COLOR }} />
              {t('admin:metrics.import.plausibleModalTitle')}
            </h3>
            <div className="flex gap-4 mt-2 text-xs text-ink-400 flex-wrap">
              <span>{t('admin:metrics.import.clientLabel')}: <span className="text-white font-medium">{client.company}</span></span>
              <span>{t('admin:metrics.import.platformLabel')}: <span className="text-white font-medium">Plausible</span></span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
          className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[color:var(--accent-light)] bg-[rgb(var(--accent)/0.1)]'
              : 'border-ink-600 bg-ink-800/40 hover:border-ink-500'
          }`}
        >
          <input
            type="file"
            accept=".zip,.csv"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Upload size={28} className="mx-auto mb-3 text-ink-400" />
          {file ? (
            <div>
              <p className="text-sm text-white font-medium truncate">{file.name}</p>
              <p className="text-xs text-ink-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <p className="text-sm text-ink-300">{t('admin:metrics.import.plausibleHint')}</p>
          )}
        </label>

        {/* Feedback */}
        <AnimatePresence>
          {feedback?.kind === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs"
            >
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>{t('admin:metrics.import.plausibleSuccess', { ts: feedback.timeSeriesRows, dim: feedback.dimensionRows })}</p>
                {feedback.min !== '-' && (
                  <p className="text-emerald-400/70">{feedback.min} → {feedback.max}</p>
                )}
                {!!feedback.filesProcessed.length && (
                  <p className="text-emerald-400/70">
                    <span className="font-medium">{t('admin:metrics.import.filesProcessed')}:</span>{' '}
                    <span className="font-mono text-[11px]">{feedback.filesProcessed.join(' · ')}</span>
                  </p>
                )}
              </div>
            </motion.div>
          )}
          {feedback?.kind === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-2 max-h-64 overflow-y-auto thin-scrollbar"
            >
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span className="font-semibold">{feedback.message}</span>
              </div>
              {!!feedback.filesProcessed?.length && (
                <div className="pl-5 text-ink-300">
                  <div className="font-semibold text-ink-200 mb-0.5">{t('admin:metrics.import.filesProcessed')}:</div>
                  <div className="font-mono text-[11px] break-words">{feedback.filesProcessed.join(' · ')}</div>
                </div>
              )}
              {!!feedback.errors?.length && feedback.errors.length > 1 && (
                <div className="pl-5 text-ink-300">
                  <div className="font-semibold text-ink-200 mb-0.5">{t('admin:metrics.import.diag.errors')}</div>
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                    {feedback.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-ink-800 border border-white/10 text-ink-300 hover:text-white transition-all disabled:opacity-50"
          >
            {t('common:common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: WEB_COLOR }}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {t('admin:metrics.import.submitButton')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
