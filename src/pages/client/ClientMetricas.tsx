import { useState, useEffect } from 'react'
import { BarChart2, Linkedin, Users, Globe, Play, Loader2 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'

function formatShort(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

export default function ClientMetricas() {
  const { t } = useTranslation(['client', 'common'])
  const { user } = useAuthStore()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.clientId) {
      api.get(`/metrics/${user.clientId}`).then(r => setMetrics(r.data)).catch(() => {}).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const li = metrics?.platforms?.linkedin
  const meta = metrics?.platforms?.meta
  const tiktok = metrics?.platforms?.tiktok
  const ga4 = metrics?.platforms?.ga4
  const followersChart = li?.timeSeries?.followers?.slice(-14).filter((_: any, i: number) => i % 2 === 0) || []
  const igFollowersChart = meta?.timeSeries?.ig_followers?.slice(-14).filter((_: any, i: number) => i % 2 === 0) || []

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin text-crimson-400" />
    </div>
  )

  return (
    <div className="space-y-5">
      {!metrics ? (
        <div className="glass-card p-12 flex flex-col items-center text-center">
          <BarChart2 size={40} className="text-ink-500 mb-3 opacity-30" />
          <p className="text-ink-300 mb-1">{t('client:metrics.noMetrics')}</p>
          <p className="text-ink-500 text-sm">{t('client:metrics.noMetricsSubtitle')}</p>
        </div>
      ) : (
        <>
          {/* Plataformas conectadas */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'linkedin', label: 'LinkedIn',  color: '#0077B5', icon: <Linkedin size={12} /> },
              { key: 'meta',     label: 'Meta',      color: '#1877F2', icon: <span className="text-[10px] font-black">f</span> },
              { key: 'tiktok',   label: 'TikTok',    color: '#69C9D0', icon: <Play size={10} fill="currentColor" /> },
              { key: 'ga4',      label: 'Analytics', color: '#E37400', icon: <Globe size={11} /> },
            ].map(p => {
              const connected = metrics.connections?.[p.key]?.connected
              const hasData = !!metrics.platforms?.[p.key]
              if (!connected && !hasData) return null
              return (
                <div key={p.key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
                  style={{ borderColor: p.color + '40', color: p.color, background: p.color + '10' }}>
                  {p.icon} {p.label}
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                </div>
              )
            })}
          </div>

          {/* LinkedIn */}
          {li && (
            <div className="glass-card p-5 space-y-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Linkedin size={15} className="text-blue-400" /> LinkedIn
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('client:metrics.followers'), value: formatShort(li.summary.followers), color: '#0077B5', sub: `+${li.summary.follower_growth_pct}%` },
                  { label: t('client:metrics.impressions30d'), value: formatShort(li.summary.total_impressions), color: '#DC143C', sub: t('client:metrics.last30days') },
                  { label: t('client:metrics.pageViews'), value: formatShort(li.summary.total_page_views), color: '#7C3AED', sub: t('client:metrics.last30days') },
                  { label: t('client:metrics.engagement'), value: `${li.summary.avg_engagement_rate}%`, color: '#F59E0B', sub: t('client:metrics.monthlyAverage') },
                ].map(s => (
                  <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                    <p className="text-xs text-ink-500">{s.sub}</p>
                  </div>
                ))}
              </div>
              {followersChart.length > 0 && (
                <div>
                  <p className="text-xs text-ink-400 mb-3 flex items-center gap-1.5"><Users size={11} /> {t('client:metrics.followerGrowth')}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={followersChart}>
                      <defs>
                        <linearGradient id="gradLI2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0077B5" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0077B5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={s => { const d = new Date(s); return `${d.getDate()}/${d.getMonth()+1}` }} interval={2} />
                      <YAxis tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} width={38} tickFormatter={formatShort} />
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#aaa', fontSize: 10 }} itemStyle={{ color: '#fff', fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" stroke="#0077B5" fill="url(#gradLI2)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          {meta && (
            <div className="glass-card p-5 space-y-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-black">f</span> {t('client:metrics.metaTitle')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('client:metrics.facebookFollowers'), value: formatShort(meta.summary.fb_followers), color: '#1877F2', sub: t('client:metrics.total') },
                  { label: t('client:metrics.instagramFollowers'), value: formatShort(meta.summary.ig_followers), color: '#E1306C', sub: `+${meta.summary.ig_growth_pct}%` },
                  { label: t('client:metrics.reach30d'), value: formatShort(meta.summary.total_reach), color: '#7C3AED', sub: t('client:metrics.last30days') },
                  { label: t('client:metrics.engagementRate'), value: `${meta.summary.avg_engagement_rate}%`, color: '#F59E0B', sub: t('client:metrics.average') },
                ].map(s => (
                  <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                    <p className="text-xs text-ink-500">{s.sub}</p>
                  </div>
                ))}
              </div>
              {igFollowersChart.length > 0 && (
                <div>
                  <p className="text-xs text-ink-400 mb-3 flex items-center gap-1.5"><Users size={11} /> {t('client:metrics.instagramFollowersChart')}</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={igFollowersChart}>
                      <defs>
                        <linearGradient id="gradIG2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E1306C" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#E1306C" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={s => { const d = new Date(s); return `${d.getDate()}/${d.getMonth()+1}` }} interval={2} />
                      <YAxis tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} width={38} tickFormatter={formatShort} />
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#aaa', fontSize: 10 }} itemStyle={{ color: '#fff', fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" stroke="#E1306C" fill="url(#gradIG2)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* TikTok */}
          {tiktok && (
            <div className="glass-card p-5">
              <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                <Play size={13} className="text-[#69C9D0]" fill="currentColor" /> {t('client:metrics.tiktokBusiness')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('client:metrics.followers'), value: formatShort(tiktok.summary.followers), color: '#69C9D0' },
                  { label: t('client:metrics.plays'), value: formatShort(tiktok.summary.video_views), color: '#EE1D52' },
                  { label: t('client:metrics.likes'), value: formatShort(tiktok.summary.likes), color: '#F59E0B' },
                  { label: t('client:metrics.comments'), value: formatShort(tiktok.summary.comments), color: '#7C3AED' },
                ].map(s => (
                  <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GA4 */}
          {ga4 && (
            <div className="glass-card p-5">
              <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                <Globe size={14} className="text-[#E37400]" /> {t('client:metrics.googleAnalytics')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('client:metrics.sessions'), value: formatShort(ga4.summary.total_sessions), color: '#E37400' },
                  { label: t('client:metrics.activeUsers'), value: formatShort(ga4.summary.total_users), color: '#7C3AED' },
                  { label: t('client:metrics.ga4PageViews'), value: formatShort(ga4.summary.total_page_views), color: '#DC143C' },
                  { label: t('client:metrics.newUsers'), value: formatShort(ga4.summary.new_users), color: '#34D399' },
                ].map(s => (
                  <div key={s.label} className="bg-ink-800/40 rounded-xl p-3">
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
