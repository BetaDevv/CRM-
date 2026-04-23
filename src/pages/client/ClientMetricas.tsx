import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart2, Linkedin, Play, BarChart3, Loader2, AlertCircle, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { JSX } from 'react'

import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'
import {
  META_COLOR, GA4_COLOR, WEB_COLOR,
  LinkedInPanel, MetaPanel, TikTokPanel, GA4Panel, WebPanel,
} from '../../components/metrics/PlatformPanels'

type Platform = 'linkedin' | 'meta' | 'tiktok' | 'ga4' | 'web'

type PlatformDef = { key: Platform; label: string; labelKey?: string; icon: JSX.Element; color: string; bg: string }

const PLATFORMS: PlatformDef[] = [
  { key: 'linkedin', label: 'LinkedIn',  icon: <Linkedin size={15} />,                              color: '#0077B5', bg: '#0077B515' },
  { key: 'meta',     label: 'Meta',      icon: <span className="text-[13px] font-black">f</span>,   color: META_COLOR, bg: '#1877F215' },
  { key: 'tiktok',   label: 'TikTok',    icon: <Play size={13} fill="currentColor" />,              color: '#69C9D0',  bg: '#69C9D015' },
  { key: 'ga4',      label: 'Analytics', icon: <BarChart3 size={14} />,                             color: GA4_COLOR,  bg: '#E3740015' },
  { key: 'web',      label: 'Web',       labelKey: 'metrics.web.label', icon: <Globe size={14} />,  color: WEB_COLOR,  bg: '#10B98115' },
]

export default function ClientMetricas() {
  const { t } = useTranslation(['client', 'admin', 'common'])
  const { user } = useAuthStore()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin')

  useEffect(() => {
    if (!user?.clientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.get(`/metrics/${user.clientId}?days=${days}`)
      .then(r => setMetrics(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days, user?.clientId])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
    </div>
  )

  if (!metrics) return (
    <div className="space-y-5">
      <div className="glass-card p-12 flex flex-col items-center text-center">
        <BarChart2 size={40} className="text-ink-500 mb-3 opacity-30" />
        <p className="text-ink-300 mb-1">{t('client:metrics.noMetrics')}</p>
        <p className="text-ink-500 text-sm">{t('client:metrics.noMetricsSubtitle')}</p>
      </div>
    </div>
  )

  const platformData = metrics.platforms?.[activePlatform]
  const platformLabel = (p: PlatformDef) => p.labelKey ? t(`admin:${p.labelKey}`) : p.label

  return (
    <div className="space-y-5">
      {/* Header row: days filter only (no admin controls) */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex gap-1 bg-ink-800/60 rounded-xl p-1 border border-white/5">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${days === d ? 'text-white border' : 'text-ink-400 hover:text-white'}`}
              style={days === d ? { background: 'rgb(var(--accent) / 0.3)', borderColor: 'rgb(var(--accent) / 0.3)' } : {}}>
              {d}{t('admin:metrics.dayAbbr')}
            </button>
          ))}
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {PLATFORMS.map(p => {
          const isConnected = metrics.connections?.[p.key]?.connected
          const hasData = !!metrics.platforms?.[p.key]
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
              <p className="text-ink-300 mb-1">{t('admin:metrics.web.emptyClient')}</p>
              <p className="text-ink-500 text-sm">{t('admin:metrics.teamWillConfigure')}</p>
            </div>
          ) : (
            <div className="glass-card p-12 flex flex-col items-center text-center">
              <AlertCircle size={36} className="text-ink-500 mb-3 opacity-30" />
              <p className="text-ink-300 mb-1">{t('admin:metrics.noDataFor', { platform: platformLabel(PLATFORMS.find(p => p.key === activePlatform) as PlatformDef) })}</p>
              <p className="text-ink-500 text-sm">{t('admin:metrics.teamWillConfigure')}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
