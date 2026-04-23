import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, Users, Eye, Heart, MessageSquare, Share2,
  Linkedin, ExternalLink, Loader2, AlertCircle, ArrowUpRight, ArrowDownRight,
  RefreshCw, Unlink, Globe, BarChart3, Play, ThumbsUp, FileDown,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'
import { localToday, getLocale } from '../lib/utils'
import { useTranslation } from 'react-i18next'
import type { JSX } from 'react'

const CRIMSON = '#EA580C'
const META_COLOR = '#1877F2'
const GA4_COLOR = '#E37400'
const IG_COLOR = '#E1306C'
const CHART_COLORS = ['#EA580C', '#7C3AED', '#F59E0B', '#34D399', '#60A5FA']

type Platform = 'linkedin' | 'meta' | 'tiktok' | 'ga4'

const PLATFORMS: { key: Platform; label: string; icon: JSX.Element; color: string; bg: string }[] = [
  { key: 'linkedin', label: 'LinkedIn',  icon: <Linkedin size={15} />,  color: '#0077B5', bg: '#0077B515' },
  { key: 'meta',     label: 'Meta',      icon: <span className="text-[13px] font-black">f</span>, color: META_COLOR,   bg: '#1877F215' },
  { key: 'tiktok',   label: 'TikTok',    icon: <Play size={13} fill="currentColor" />,              color: '#69C9D0',    bg: '#69C9D015' },
  { key: 'ga4',      label: 'Analytics', icon: <BarChart3 size={14} />, color: GA4_COLOR,  bg: '#E3740015' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs" style={{ borderColor: 'rgb(var(--accent) / 0.3)' }}>
      <p className="text-ink-300 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#fff' }} className="font-semibold">
          {typeof p.value === 'number' ? p.value.toLocaleString(getLocale()) : p.value}
        </p>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub: string; icon: any; color: string; trend?: number
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="metric-card">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '15' }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-ink-300">{label}</p>
        <p className="text-xs text-ink-400 mt-0.5">{sub}</p>
      </div>
    </motion.div>
  )
}

function formatShort(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
}

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

// ─── LinkedIn Panel ────────────────────────────────────────────────────────────
function LinkedInPanel({ data, days }: { data: any; days: number }) {
  const { t } = useTranslation(['admin', 'common'])
  const followersChart = data.timeSeries?.followers?.filter((_: any, i: number) => i % 2 === 0) || []
  const impressionsChart = data.timeSeries?.impressions?.slice(-14) || []
  const engagementChart = data.timeSeries?.engagement?.slice(-14) || []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('admin:metrics.followers')} value={formatShort(data.summary.followers)} sub={t('admin:metrics.totalAccumulated')} icon={Users} color="#0077B5" trend={data.summary.follower_growth_pct} />
        <StatCard label={t('admin:metrics.impressions', { days })} value={formatShort(data.summary.total_impressions)} sub={t('admin:metrics.lastDays', { days })} icon={Eye} color={CRIMSON} />
        <StatCard label={t('admin:metrics.pageViews')} value={formatShort(data.summary.total_page_views)} sub={t('admin:metrics.lastDays', { days })} icon={ExternalLink} color="#7C3AED" />
        <StatCard label={t('admin:metrics.engagementRate')} value={`${data.summary.avg_engagement_rate}%`} sub={t('admin:metrics.periodAverage')} icon={Heart} color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="font-semibold text-white">{t('admin:metrics.followerGrowth')}</h4>
              <p className="text-xs text-ink-400">{t('admin:metrics.lastDays', { days })}</p>
            </div>
            <p className={`text-sm font-bold ${data.summary.follower_growth_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.summary.follower_growth_pct >= 0 ? '+' : ''}{data.summary.follower_growth_pct}%
            </p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={followersChart}>
              <defs>
                <linearGradient id="gradLI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0077B5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0077B5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#0077B5" fill="url(#gradLI)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-2">{t('admin:metrics.dailyImpressions')}</h4>
          <p className="text-xs text-ink-400 mb-5">{t('admin:metrics.lastTwoWeeks')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={impressionsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={CRIMSON} radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="font-semibold text-white">{t('admin:metrics.engagementRate')}</h4>
              <p className="text-xs text-ink-400">{t('admin:metrics.dailyPercentage')}</p>
            </div>
            <p className="text-lg font-bold text-amber-400">{data.summary.avg_engagement_rate}%</p>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={engagementChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, 10]} unit="%" width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', strokeWidth: 0, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-5">{t('admin:metrics.audienceSeniority')}</h4>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={data.demographics?.seniority || []} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3}>
                {(data.demographics?.seniority || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {(data.demographics?.seniority || []).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-ink-300">
                <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {s.label} <span className="text-ink-500">({s.value}%)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-4">{t('admin:metrics.followerIndustry')}</h4>
          <div className="space-y-2.5">
            {(data.demographics?.industry || []).map((item: any, i: number) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-ink-300">{item.label}</span>
                  <span className="text-xs font-medium text-white">{item.value}%</span>
                </div>
                <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${item.value}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.topPosts?.length > 0 && (
        <div className="glass-card p-5">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-5">
            <TrendingUp size={16} style={{ color: 'var(--accent-light)' }} /> {t('admin:metrics.topPosts')}
          </h4>
          <div className="space-y-3">
            {data.topPosts.map((post: any, i: number) => (
              <motion.div key={post.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-start gap-4 p-4 rounded-xl bg-ink-800/40 hover:bg-ink-800/60 transition-colors">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'rgb(var(--accent) / 0.2)', color: 'var(--accent-light)' }}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{post.title}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{post.date}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{formatShort(post.impressions)}</p>
                    <p className="text-xs text-ink-400 flex items-center gap-1"><Eye size={9} /> {t('admin:metrics.imp')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-amber-400">{post.engagement}%</p>
                    <p className="text-xs text-ink-400">{t('admin:metrics.eng')}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-400">
                    <span className="flex items-center gap-1"><Heart size={11} className="text-red-400" /> {post.reactions}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={11} className="text-blue-400" /> {post.comments}</span>
                    <span className="flex items-center gap-1"><Share2 size={11} className="text-green-400" /> {post.shares}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Meta Panel ────────────────────────────────────────────────────────────────
function MetaPanel({ data, days }: { data: any; days: number }) {
  const { t } = useTranslation(['admin', 'common'])
  const igFollowersChart = data.timeSeries?.ig_followers?.filter((_: any, i: number) => i % 2 === 0) || []
  const reachChart = data.timeSeries?.reach?.slice(-14) || []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('admin:metrics.fbFollowers')} value={formatShort(data.summary.fb_followers)} sub={t('admin:metrics.totalAccumulated')} icon={Users} color={META_COLOR} />
        <StatCard label={t('admin:metrics.igFollowers')} value={formatShort(data.summary.ig_followers)} sub={t('admin:metrics.totalAccumulated')} icon={Users} color={IG_COLOR} trend={data.summary.ig_growth_pct} />
        <StatCard label={t('admin:metrics.reach', { days })} value={formatShort(data.summary.total_reach)} sub={t('admin:metrics.lastDays', { days })} icon={Eye} color="#7C3AED" />
        <StatCard label={t('admin:metrics.engagementRate')} value={`${data.summary.avg_engagement_rate}%`} sub={t('admin:metrics.periodAverage')} icon={Heart} color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-2">{t('admin:metrics.igGrowth')}</h4>
          <p className="text-xs text-ink-400 mb-5">{t('admin:metrics.followersLastDays', { days })}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={igFollowersChart}>
              <defs>
                <linearGradient id="gradIG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={IG_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={IG_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke={IG_COLOR} fill="url(#gradIG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-2">{t('admin:metrics.dailyReach')}</h4>
          <p className="text-xs text-ink-400 mb-5">{t('admin:metrics.lastTwoWeeks')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={reachChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={META_COLOR} radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── TikTok Panel ──────────────────────────────────────────────────────────────
function TikTokPanel({ data }: { data: any }) {
  const { t } = useTranslation(['admin', 'common'])
  const s = data.summary
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard label={t('admin:metrics.followers')} value={formatShort(s.followers)} sub={t('admin:metrics.totalAccumulated')} icon={Users} color="#69C9D0" />
      <StatCard label={t('admin:metrics.tiktokPlays')} value={formatShort(s.video_views)} sub={t('admin:metrics.last30Days')} icon={Play} color="#EE1D52" />
      <StatCard label={t('admin:metrics.totalLikes')} value={formatShort(s.likes)} sub={t('admin:metrics.last30Days')} icon={ThumbsUp} color="#F59E0B" />
      <StatCard label={t('admin:metrics.comments')} value={formatShort(s.comments)} sub={t('admin:metrics.last30Days')} icon={MessageSquare} color="#7C3AED" />
      <StatCard label={t('admin:metrics.shares')} value={formatShort(s.shares)} sub={t('admin:metrics.last30Days')} icon={Share2} color="#34D399" />
    </div>
  )
}

// ─── GA4 Panel ────────────────────────────────────────────────────────────────
function GA4Panel({ data, days }: { data: any; days: number }) {
  const { t } = useTranslation(['admin', 'common'])
  const s = data.summary
  const sessionsChart = data.timeSeries?.sessions?.slice(-14) || []
  const pageViewsChart = data.timeSeries?.page_views?.slice(-14) || []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label={t('admin:metrics.sessions', { days })} value={formatShort(s.total_sessions)} sub={t('admin:metrics.lastDays', { days })} icon={Globe} color={GA4_COLOR} />
        <StatCard label={t('admin:metrics.activeUsers')} value={formatShort(s.total_users)} sub={t('admin:metrics.lastDays', { days })} icon={Users} color="#7C3AED" />
        <StatCard label={t('admin:metrics.pageViews')} value={formatShort(s.total_page_views)} sub={t('admin:metrics.lastDays', { days })} icon={Eye} color={CRIMSON} />
        <StatCard label={t('admin:metrics.newUsers')} value={formatShort(s.new_users)} sub={t('admin:metrics.lastDays', { days })} icon={ArrowUpRight} color="#34D399" />
        <StatCard label={t('admin:metrics.bounceRate')} value={`${s.avg_bounce_rate.toFixed(1)}%`} sub={t('admin:metrics.periodAverage')} icon={TrendingUp} color="#F59E0B" />
        <StatCard label={t('admin:metrics.avgDuration')} value={`${Math.round(s.avg_session_duration)}s`} sub={t('admin:metrics.perSession')} icon={RefreshCw} color="#60A5FA" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-2">{t('admin:metrics.dailySessions')}</h4>
          <p className="text-xs text-ink-400 mb-5">{t('admin:metrics.lastTwoWeeks')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={sessionsChart}>
              <defs>
                <linearGradient id="gradGA4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GA4_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GA4_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke={GA4_COLOR} fill="url(#gradGA4)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-2">{t('admin:metrics.pageViewsChart')}</h4>
          <p className="text-xs text-ink-400 mb-5">{t('admin:metrics.lastTwoWeeks')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pageViewsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={CRIMSON} radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
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

  const activeClients = clients.filter(c => c.status === 'active')

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
                  {p.label}
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
                </>
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
                    <p className="text-ink-300 mb-1">{t('admin:metrics.noDataFor', { platform: PLATFORMS.find(p => p.key === activePlatform)?.label })}</p>
                    <p className="text-ink-500 text-sm">{t('admin:metrics.teamWillConfigure')}</p>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
