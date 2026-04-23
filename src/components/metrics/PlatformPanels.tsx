import { motion } from 'framer-motion'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, Users, Eye, Heart, MessageSquare, Share2,
  ExternalLink, ArrowUpRight, ArrowDownRight,
  RefreshCw, Globe, Play, ThumbsUp,
  FileText, Network, Monitor, MapPin, Clock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLocale } from '../../lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────
export const CRIMSON = '#EA580C'
export const META_COLOR = '#1877F2'
export const GA4_COLOR = '#E37400'
export const IG_COLOR = '#E1306C'
export const WEB_COLOR = '#10B981'
export const WEB_COLOR_ALT = '#8B5CF6'
export const CHART_COLORS = ['#EA580C', '#7C3AED', '#F59E0B', '#34D399', '#60A5FA']

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function formatShort(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

export function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
export const CustomTooltip = ({ active, payload, label }: any) => {
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

// ─── StatCard ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color, trend }: {
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

// ─── LinkedIn Panel ────────────────────────────────────────────────────────────
export function LinkedInPanel({ data, days }: { data: any; days: number }) {
  const { t } = useTranslation(['admin', 'common'])
  const followersChart = data.timeSeries?.followers?.filter((_: any, i: number) => i % 2 === 0) || []
  const impressionsChart = data.timeSeries?.impressions?.slice(-14) || []
  const engagementChart = data.timeSeries?.engagement?.slice(-14) || []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin:metrics.followers')}
          value={formatShort(data.summary.followers)}
          sub={data.summary.new_followers_period !== undefined
            ? `+${formatShort(data.summary.new_followers_period)} · ${t('admin:metrics.lastDays', { days })}`
            : t('admin:metrics.totalAccumulated')}
          icon={Users}
          color="#0077B5"
          trend={data.summary.follower_growth_pct}
        />
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

        {data.demographics?.seniority?.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-semibold text-white mb-5">{t('admin:metrics.audienceSeniority')}</h4>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={data.demographics.seniority} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3}>
                  {data.demographics.seniority.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {data.demographics.seniority.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-ink-300">
                  <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {s.label} <span className="text-ink-500">({s.value}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.demographics?.industry?.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-semibold text-white mb-4">{t('admin:metrics.followerIndustry')}</h4>
            <div className="space-y-2.5">
              {data.demographics.industry.map((item: any, i: number) => (
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
        )}
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
export function MetaPanel({ data, days }: { data: any; days: number }) {
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
export function TikTokPanel({ data }: { data: any }) {
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
export function GA4Panel({ data, days }: { data: any; days: number }) {
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

// ─── Web (Plausible) Panel ───────────────────────────────────────────────────
/**
 * Renders Plausible-sourced website analytics. Data is pushed in via admin CSV/ZIP
 * import (manual — Plausible has no OAuth in our setup). Admin and client see the
 * EXACT same panel body; import controls live on the parent page (admin-only).
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m <= 0) return `${s}s`
  return `${m}m ${s}s`
}

export function WebPanel({ data, days }: { data: any; days: number }) {
  const { t } = useTranslation(['admin', 'common'])
  const s = data?.summary || {}
  const visitorsSeries = (data?.timeSeries?.visitors || []).slice(-days)
  const pageviewsSeries = (data?.timeSeries?.pageviews || []).slice(-days)
  const topPages = data?.dimensions?.topPages || []
  const channels = data?.dimensions?.channels || []
  const devices = data?.dimensions?.devices || []
  const countries = data?.dimensions?.countries || []

  const viewsPerVisit = s.visits > 0 ? (s.pageviews / s.visits).toFixed(2) : '0.00'

  return (
    <div className="space-y-5">
      {/* Top row: 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin:metrics.web.uniqueVisitors')}
          value={formatShort(s.visitors || 0)}
          sub={t('admin:metrics.lastDays', { days })}
          icon={Users}
          color={WEB_COLOR}
          trend={s.visitors_growth_pct}
        />
        <StatCard
          label={t('admin:metrics.web.pageviews')}
          value={formatShort(s.pageviews || 0)}
          sub={t('admin:metrics.web.viewsPerVisit', { n: viewsPerVisit })}
          icon={Eye}
          color={WEB_COLOR_ALT}
        />
        <StatCard
          label={t('admin:metrics.web.bounceRate')}
          value={`${(s.avg_bounce_rate ?? 0).toFixed(1)}%`}
          sub={t('admin:metrics.web.lowerIsBetter')}
          icon={TrendingUp}
          color="#F59E0B"
        />
        <StatCard
          label={t('admin:metrics.web.avgVisitDuration')}
          value={formatDuration(s.avg_visit_duration || 0)}
          sub={t('admin:metrics.periodAverage')}
          icon={Clock}
          color="#60A5FA"
        />
      </div>

      {/* Middle row: visitors area + pageviews bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-2">{t('admin:metrics.web.visitorsOverTime')}</h4>
          <p className="text-xs text-ink-400 mb-5">{t('admin:metrics.lastDays', { days })}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={visitorsSeries}>
              <defs>
                <linearGradient id="gradWeb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={WEB_COLOR} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={WEB_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke={WEB_COLOR} fill="url(#gradWeb)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white mb-2">{t('admin:metrics.web.pageviewsOverTime')}</h4>
          <p className="text-xs text-ink-400 mb-5">{t('admin:metrics.lastDays', { days })}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pageviewsSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShort} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={WEB_COLOR_ALT} radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: top pages + channels donut + devices donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card p-5">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
            <FileText size={14} style={{ color: 'var(--accent-light)' }} /> {t('admin:metrics.web.topPages')}
          </h4>
          <div className="space-y-2.5">
            {topPages.slice(0, 10).map((p: any, i: number) => {
              const max = topPages[0]?.visitors || 1
              const width = Math.max(4, (p.visitors / max) * 100)
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-xs text-ink-300 truncate" title={p.name}>{p.name}</span>
                    <span className="text-xs font-medium text-white flex-shrink-0">{formatShort(p.visitors)}</span>
                  </div>
                  <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 0.7, delay: i * 0.05 }}
                      className="h-full rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                </div>
              )
            })}
            {!topPages.length && (
              <p className="text-xs text-ink-500 italic">—</p>
            )}
          </div>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Network size={14} style={{ color: 'var(--accent-light)' }} /> {t('admin:metrics.web.channels')}
          </h4>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={channels} dataKey="visitors" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3}>
                {channels.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {channels.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-ink-300">
                <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {c.name} <span className="text-ink-500">({c.share}%)</span>
              </div>
            ))}
            {!channels.length && <p className="text-xs text-ink-500 italic">—</p>}
          </div>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Monitor size={14} style={{ color: 'var(--accent-light)' }} /> {t('admin:metrics.web.devices')}
          </h4>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={devices} dataKey="visitors" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3}>
                {devices.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {devices.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-ink-300">
                <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {d.name} <span className="text-ink-500">({d.share}%)</span>
              </div>
            ))}
            {!devices.length && <p className="text-xs text-ink-500 italic">—</p>}
          </div>
        </div>
      </div>

      {/* Footer row: top countries */}
      {countries.length > 0 && (
        <div className="glass-card p-5">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
            <MapPin size={14} style={{ color: 'var(--accent-light)' }} /> {t('admin:metrics.web.topCountries')}
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {countries.slice(0, 10).map((c: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-3 rounded-xl bg-ink-800/40 border border-white/5"
              >
                <p className="text-xs text-ink-400 truncate" title={c.name}>{c.name}</p>
                <p className="text-sm font-bold text-white mt-0.5">{formatShort(c.visitors)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
