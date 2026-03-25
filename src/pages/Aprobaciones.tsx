import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, ThumbsUp, RotateCcw, Send, Eye, Calendar, Upload, Image, FileText, CheckCircle, MessageSquare, Loader2, LayoutTemplate, Pencil, Trash2, Copy, Variable } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { postStatusConfig, platformConfig, formatDate } from '../lib/utils'
import { api, getTemplates, createTemplate, updateTemplate, deleteTemplate, useTemplate } from '../lib/api'
import type { PostTemplate } from '../lib/api'
import type { PostStatus } from '../types'
import { useTranslation } from 'react-i18next'

function PlatformBadge({ platform, size = 'md' }: { platform: string; size?: 'sm' | 'md' }) {
  const cfg = platformConfig[platform] || { label: platform, short: platform.slice(0, 2), color: '#6b7280' }
  const cls = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${cls} rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0`} style={{ background: cfg.color }}>
      {cfg.short}
    </div>
  )
}

const statusTabs: { key: PostStatus | 'all'; label: string }[] = [
  { key: 'all',      label: 'Todos' },
  { key: 'pending',  label: 'Pendientes' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'revision', label: 'En Revisión' },
  { key: 'rejected', label: 'Rechazados' },
]

// ─── Client Post Card ────────────────────────────────────────────────────────
function ClientPostCard({ post, client, onStatusUpdate }: { post: any; client?: any; onStatusUpdate: (id: string, status: string, feedback?: string) => void }) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const cfg = postStatusConfig[post.status as PostStatus]
  const hasImages = post.media_urls?.length > 0

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card overflow-hidden"
    >
      {/* Status bar */}
      <div className="h-1 w-full" style={{ background: cfg.color }} />

      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <PlatformBadge platform={post.platform} />
            <div>
              <p className="font-semibold text-white text-sm">{post.title}</p>
              <p className="text-xs text-ink-400 mt-0.5">
                {platformConfig[post.platform]?.label || post.platform} · {formatDate(post.scheduled_date)}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: cfg.color, background: cfg.bg }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Post type indicator */}
        <div className="flex items-center gap-2 mb-3">
          {post.type === 'design' ? <Image size={13} className="text-ink-400" /> : <FileText size={13} className="text-ink-400" />}
          <span className="text-xs text-ink-400">{post.type === 'design' ? 'Diseño / Arte' : 'Publicación de texto'}</span>
        </div>

        {/* Social preview */}
        {post.platform === 'linkedin' && (
          <div className="bg-[#1d2226] rounded-xl p-4 mb-4 border border-white/5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: client?.color || '#DC143C' }}>
                {client?.company?.slice(0, 2) || 'TN'}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{client?.company}</p>
                <p className="text-xs text-[#9fa6ad]">Publicación programada · {formatDate(post.scheduled_date)}</p>
              </div>
            </div>
            <p className="text-sm text-[#e7e9ea] leading-relaxed whitespace-pre-wrap">{post.content}</p>
          </div>
        )}

        {post.platform === 'instagram' && (
          <div className="bg-gradient-to-b from-[#1a1a1a] to-ink-800 rounded-xl p-4 mb-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-white" style={{ fontSize: '8px' }}>
                  {client?.company?.slice(0, 2) || ''}
                </div>
              </div>
              <p className="text-xs font-semibold text-white">{client?.company?.toLowerCase().replace(/ /g, '_')}</p>
            </div>
            <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
          </div>
        )}

        {(post.platform === 'facebook' || post.platform === 'twitter') && (
          <div className="bg-ink-900/60 rounded-xl p-4 mb-4 border border-white/5">
            <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap">{post.content}</p>
          </div>
        )}

        {/* Images */}
        {hasImages && (
          <div className="mb-4">
            <p className="text-xs font-medium text-ink-300 mb-2">Archivos adjuntos ({post.media_urls.length})</p>
            <div className={`grid gap-2 ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {post.media_urls.map((url: string, i: number) => (
                <motion.div key={i} whileHover={{ scale: 1.02 }} onClick={() => setLightboxImg(url)}
                  className="relative rounded-xl overflow-hidden cursor-pointer aspect-video bg-ink-800 border border-white/10">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye size={20} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback from admin */}
        {post.feedback && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1"><MessageSquare size={11} /> Comentario de TheBrandingStudio:</p>
            <p className="text-sm text-amber-100">{post.feedback}</p>
          </div>
        )}

        {/* Actions for CLIENT */}
        {post.status === 'pending' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => onStatusUpdate(post.id, 'approved')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-semibold hover:bg-green-500/20 transition-all">
                <ThumbsUp size={16} fill="currentColor" /> ¡Aprobar!
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowFeedback(v => !v)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-sm font-semibold hover:bg-amber-500/20 transition-all">
                <RotateCcw size={14} /> Pedir cambios
              </motion.button>
            </div>
            <AnimatePresence>
              {showFeedback && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex gap-2 pt-1">
                    <input type="text" placeholder="¿Qué cambiamos? Escribe aquí..." value={feedback} onChange={e => setFeedback(e.target.value)} className="input-dark text-sm flex-1" />
                    <button onClick={() => { onStatusUpdate(post.id, 'revision', feedback); setShowFeedback(false) }}
                      className="px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                      <Send size={15} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {post.status === 'approved' && (
          <div className="flex items-center gap-2 text-green-400 text-sm font-semibold py-2">
            <CheckCircle size={16} fill="currentColor" /> Publicación aprobada
          </div>
        )}

        {post.status === 'revision' && (
          <div className="flex items-center gap-2 text-amber-400 text-sm py-2">
            <RotateCcw size={14} /> Cambios solicitados · En revisión por el equipo
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
            onClick={() => setLightboxImg(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} src={lightboxImg} className="max-w-full max-h-full rounded-2xl object-contain" />
            <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxImg(null)}><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Admin Post Card ─────────────────────────────────────────────────────────
function AdminPostCard({ post, client, onStatusUpdate }: { post: any; client?: any; onStatusUpdate: (id: string, status: string, feedback?: string) => void }) {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const cfg = postStatusConfig[post.status as PostStatus]
  const hasImages = post.media_urls?.length > 0

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-5 border-b border-white/5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <PlatformBadge platform={post.platform} size="sm" />
            <div>
              <p className="font-semibold text-white text-sm">{post.title}</p>
              <p className="text-xs text-ink-400">{client?.company} · {formatDate(post.scheduled_date)}</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
        </div>
      </div>

      <div className="p-5">
        <div className="bg-ink-900/60 rounded-xl p-4 mb-4 border border-white/5">
          <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap line-clamp-4">{post.content}</p>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-ink-400">
            <span className="flex items-center gap-1 capitalize">{platformConfig[post.platform]?.label || post.platform}</span>
            <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(post.scheduled_date)}</span>
            {post.type === 'design' && <span className="flex items-center gap-1"><Image size={11} /> Diseño</span>}
          </div>
        </div>

        {hasImages && (
          <div className={`grid gap-2 mb-4 ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
            {post.media_urls.map((url: string, i: number) => (
              <motion.div key={i} whileHover={{ scale: 1.03 }} onClick={() => setLightboxImg(url)}
                className="aspect-square rounded-xl overflow-hidden cursor-pointer bg-ink-800 border border-white/10">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>
        )}

        {post.feedback && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs">
            <span className="text-amber-400 font-semibold">Cliente:</span>
            <span className="text-amber-200 ml-1.5">{post.feedback}</span>
          </div>
        )}

        <div className="flex items-center gap-2 py-1">
          {post.status === 'pending' && (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
              <Loader2 size={12} className="animate-spin" /> Esperando aprobación del cliente
            </div>
          )}
          {post.status === 'approved' && (
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-semibold">
              <CheckCircle size={14} fill="currentColor" /> Aprobado por el cliente
            </div>
          )}
          {post.status === 'revision' && (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs">
              <RotateCcw size={12} /> Cliente solicitó cambios
            </div>
          )}
          {post.status === 'rejected' && (
            <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
              <X size={14} /> Rechazado por el cliente
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {lightboxImg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
            onClick={() => setLightboxImg(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} src={lightboxImg} className="max-w-full max-h-full rounded-2xl object-contain" />
            <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxImg(null)}><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Aprobaciones() {
  const { t } = useTranslation(['admin', 'common'])
  const { clients } = useStore()
  const { isAdmin, user } = useAuthStore()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState<PostStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)

  // Form
  const [form, setForm] = useState({ clientId: '', title: '', content: '', platform: 'linkedin', scheduledDate: '', type: 'post' })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchPosts = async () => {
    try {
      const { data } = await api.get('/posts')
      setPosts(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPosts() }, [])

  const handleStatusUpdate = async (postId: string, status: string, feedback?: string) => {
    try {
      const { data } = await api.patch(`/posts/${postId}/status`, { status, feedback })
      setPosts(p => p.map(x => x.id === postId ? data : x))
    } catch (e) { console.error(e) }
  }

  const handleCreate = async () => {
    if (!form.clientId || !form.content) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries({ client_id: form.clientId, title: form.title, content: form.content, platform: form.platform, scheduled_date: form.scheduledDate, type: form.type }).forEach(([k, v]) => fd.append(k, v))
      selectedFiles.forEach(f => fd.append('images', f))
      const { data } = await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPosts(p => [data, ...p])
      setForm({ clientId: '', title: '', content: '', platform: 'linkedin', scheduledDate: '', type: 'post' })
      setSelectedFiles([])
      setShowModal(false)
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const filtered = activeStatus === 'all' ? posts : posts.filter(p => p.status === activeStatus)
  const counts: Record<string, number> = {
    all: posts.length,
    pending: posts.filter(p => p.status === 'pending').length,
    approved: posts.filter(p => p.status === 'approved').length,
    revision: posts.filter(p => p.status === 'revision').length,
    rejected: posts.filter(p => p.status === 'rejected').length,
  }

  // ─── Templates State ──────────────────────────────────────────────────────
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<PostTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templatePlatformFilter, setTemplatePlatformFilter] = useState<string>('all')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ title: '', content: '', platform: 'linkedin', category: 'general', industry: '', tags: '', variables: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [useTemplateModal, setUseTemplateModal] = useState<PostTemplate | null>(null)
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})
  const [applyingTemplate, setApplyingTemplate] = useState(false)

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const filters: { platform?: string } = {}
      if (templatePlatformFilter !== 'all') filters.platform = templatePlatformFilter
      const data = await getTemplates(filters)
      setTemplates(data)
    } catch (e) { console.error(e) }
    finally { setLoadingTemplates(false) }
  }

  useEffect(() => { if (showTemplates) fetchTemplates() }, [showTemplates, templatePlatformFilter])

  const handleSaveTemplate = async () => {
    if (!templateForm.title || !templateForm.content) return
    setSavingTemplate(true)
    try {
      const payload = {
        title: templateForm.title,
        content: templateForm.content,
        platform: templateForm.platform,
        category: templateForm.category,
        industry: templateForm.industry || null,
        tags: templateForm.tags ? templateForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        variables: templateForm.variables ? templateForm.variables.split(',').map(v => v.trim()).filter(Boolean) : [],
      }
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload)
      } else {
        await createTemplate(payload)
      }
      setShowTemplateForm(false)
      setEditingTemplate(null)
      setTemplateForm({ title: '', content: '', platform: 'linkedin', category: 'general', industry: '', tags: '', variables: '' })
      fetchTemplates()
    } catch (e) { console.error(e) }
    finally { setSavingTemplate(false) }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (e) { console.error(e) }
  }

  const handleEditTemplate = (tpl: PostTemplate) => {
    setEditingTemplate(tpl)
    setTemplateForm({
      title: tpl.title,
      content: tpl.content,
      platform: tpl.platform,
      category: tpl.category,
      industry: tpl.industry || '',
      tags: tpl.tags.join(', '),
      variables: tpl.variables.join(', '),
    })
    setShowTemplateForm(true)
  }

  const handleUseTemplate = (tpl: PostTemplate) => {
    setUseTemplateModal(tpl)
    const vars: Record<string, string> = {}
    tpl.variables.forEach(v => { vars[v] = '' })
    setTemplateVars(vars)
  }

  const handleApplyTemplate = async () => {
    if (!useTemplateModal) return
    setApplyingTemplate(true)
    try {
      const result = await useTemplate(useTemplateModal.id, templateVars)
      setForm(prev => ({ ...prev, content: result.content, title: result.title, platform: result.platform }))
      setUseTemplateModal(null)
      setShowTemplates(false)
      setShowModal(true)
    } catch (e) { console.error(e) }
    finally { setApplyingTemplate(false) }
  }

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g)
    if (!matches) return []
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
  }

  const handleTemplateContentChange = (content: string) => {
    const vars = extractVariables(content)
    setTemplateForm(prev => ({ ...prev, content, variables: vars.join(', ') }))
  }

  const platformTabs = [
    { key: 'all', label: 'Todos' },
    { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
    { key: 'instagram', label: 'Instagram', color: '#E4405F' },
    { key: 'facebook', label: 'Facebook', color: '#1877F2' },
    { key: 'twitter', label: 'Twitter', color: '#1DA1F2' },
  ]

  const clientName = clients.find(c => c.id === user?.clientId)?.company || 'tu empresa'

  return (
    <div className="space-y-6">
      {/* Header — different for admin vs client */}
      {isAdmin() ? (
        <div className="page-header">
          <div>
            <h2 className="section-title">{t('admin:approvals.title')}</h2>
            <p className="text-ink-300 text-sm mt-1">{t('admin:approvals.pendingReview', { count: counts.pending })}</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink-800/60 border border-white/10 text-ink-200 hover:text-white hover:border-white/20 transition-all text-sm font-medium">
              <LayoutTemplate size={16} /> {t('admin:approvals.templates')}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowModal(true)} className="btn-primary">
              <Plus size={16} /> {t('admin:approvals.newPost')}
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="glass-card p-6 relative overflow-hidden mb-0">
            <div className="absolute top-0 right-0 w-48 h-48 bg-crimson-700/5 rounded-full blur-3xl pointer-events-none" />
            <h2 className="text-2xl font-bold text-white mb-1">{t('admin:approvals.contentApproval')}</h2>
            <p className="text-ink-300">Aquí puedes revisar y aprobar las publicaciones que preparamos para <strong className="text-white">{clientName}</strong>.</p>
            <div className="flex items-center gap-6 mt-4">
              {[
                { label: 'Pendientes', count: counts.pending, color: '#f59e0b' },
                { label: 'Aprobados', count: counts.approved, color: '#34d399' },
                { label: 'En revisión', count: counts.revision, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
                  <p className="text-xs text-ink-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {statusTabs.map(tab => {
          const count = counts[tab.key] || 0
          const cfg = tab.key !== 'all' ? postStatusConfig[tab.key as PostStatus] : null
          const isActive = activeStatus === tab.key
          return (
            <button key={tab.key} onClick={() => setActiveStatus(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border ${isActive ? 'text-white' : 'border-white/10 text-ink-300 bg-ink-800/40 hover:text-white hover:border-white/20'}`}
              style={isActive && cfg ? { color: cfg.color, background: cfg.bg, borderColor: cfg.color + '60' } : isActive ? { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' } : {}}>
              {tab.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-crimson-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnimatePresence>
            {filtered.map(post => (
              isAdmin() ? (
                <AdminPostCard key={post.id} post={post} client={clients.find(c => c.id === post.client_id)} onStatusUpdate={handleStatusUpdate} />
              ) : (
                <ClientPostCard key={post.id} post={post} client={clients.find(c => c.id === post.client_id)} onStatusUpdate={handleStatusUpdate} />
              )
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 text-ink-500">
              <ThumbsUp size={40} className="mb-3 opacity-20" />
              <p className="text-sm">{isAdmin() ? 'Sin publicaciones en esta categoría' : 'No tienes publicaciones pendientes de revisión'}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Templates Panel (slide-in) ────────────────────────────────────── */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end"
            onClick={() => setShowTemplates(false)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xl bg-ink-900 border-l border-white/10 h-full overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              {/* Panel header */}
              <div className="sticky top-0 bg-ink-900/95 backdrop-blur-sm z-10 p-5 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-crimson-700/20 flex items-center justify-center">
                      <LayoutTemplate size={20} className="text-crimson-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{t('admin:approvals.templates.title')}</h3>
                      <p className="text-xs text-ink-400">{templates.length} plantillas disponibles</p>
                    </div>
                  </div>
                  <button onClick={() => setShowTemplates(false)} className="text-ink-400 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                {/* Platform filter tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {platformTabs.map(tab => (
                    <button key={tab.key} onClick={() => setTemplatePlatformFilter(tab.key)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${templatePlatformFilter === tab.key
                        ? 'text-white border-crimson-500/50 bg-crimson-700/20'
                        : 'border-white/10 text-ink-400 hover:text-white hover:border-white/20'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* New template button */}
              <div className="p-5 pb-0">
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setEditingTemplate(null); setTemplateForm({ title: '', content: '', platform: 'linkedin', category: 'general', industry: '', tags: '', variables: '' }); setShowTemplateForm(true) }}
                  className="w-full py-3 rounded-xl border border-dashed border-white/20 text-sm text-ink-300 hover:text-white hover:border-crimson-500/40 transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> {t('admin:approvals.templates.newTemplate')}
                </motion.button>
              </div>

              {/* Template cards */}
              <div className="p-5 space-y-3">
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-crimson-400" /></div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 text-ink-500">
                    <LayoutTemplate size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No hay plantillas{templatePlatformFilter !== 'all' ? ` para ${platformTabs.find(t => t.key === templatePlatformFilter)?.label}` : ''}</p>
                  </div>
                ) : (
                  templates.map(tpl => {
                    const pCfg = platformConfig[tpl.platform] || { label: tpl.platform, short: tpl.platform.slice(0, 2), color: '#6b7280' }
                    return (
                      <motion.div key={tpl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-4 group hover:border-white/20 transition-all">
                        {/* Card header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0" style={{ background: pCfg.color }}>
                              {pCfg.short}
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm">{tpl.title}</p>
                              <p className="text-xs text-ink-400 capitalize">{tpl.category.replace(/_/g, ' ')}{tpl.industry ? ` · ${tpl.industry}` : ''}</p>
                            </div>
                          </div>
                        </div>

                        {/* Content preview */}
                        <div className="bg-ink-900/60 rounded-lg p-3 mb-3 border border-white/5">
                          <p className="text-xs text-ink-200 leading-relaxed line-clamp-3 whitespace-pre-wrap">{tpl.content}</p>
                        </div>

                        {/* Variable pills */}
                        {tpl.variables.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {tpl.variables.map(v => (
                              <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-crimson-700/15 text-crimson-400 border border-crimson-500/20 font-mono">
                                {`{{${v}}}`}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Tags */}
                        {tpl.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {tpl.tags.map(tag => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-ink-300 border border-white/10">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => handleUseTemplate(tpl)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-crimson-700/15 text-crimson-400 border border-crimson-500/20 text-xs font-semibold hover:bg-crimson-700/25 transition-all">
                            <Copy size={13} /> Usar
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => handleEditTemplate(tpl)}
                            className="p-2 rounded-lg bg-white/5 text-ink-300 hover:text-white border border-white/10 hover:border-white/20 transition-all">
                            <Pencil size={13} />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                            <Trash2 size={13} />
                          </motion.button>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Template Form Modal (Create/Edit) ─────────────────────────────── */}
      <AnimatePresence>
        {showTemplateForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowTemplateForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white text-lg">{editingTemplate ? t('admin:approvals.templates.editTemplate') : t('admin:approvals.templates.newTemplate')}</h3>
                <button onClick={() => setShowTemplateForm(false)} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <input type="text" placeholder="Título de la plantilla *" value={templateForm.title}
                  onChange={e => setTemplateForm(p => ({ ...p, title: e.target.value }))} className="input-dark text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={templateForm.platform} onChange={e => setTemplateForm(p => ({ ...p, platform: e.target.value }))} className="input-dark text-sm">
                    <option value="linkedin" className="bg-ink-800">LinkedIn</option>
                    <option value="instagram" className="bg-ink-800">Instagram</option>
                    <option value="facebook" className="bg-ink-800">Facebook</option>
                    <option value="twitter" className="bg-ink-800">Twitter / X</option>
                  </select>
                  <input type="text" placeholder="Categoría" value={templateForm.category}
                    onChange={e => setTemplateForm(p => ({ ...p, category: e.target.value }))} className="input-dark text-sm" />
                </div>
                <input type="text" placeholder="Industria (opcional)" value={templateForm.industry}
                  onChange={e => setTemplateForm(p => ({ ...p, industry: e.target.value }))} className="input-dark text-sm" />
                <div>
                  <textarea placeholder={'Contenido de la plantilla *\nUsa {{variable}} para campos dinámicos'} value={templateForm.content}
                    onChange={e => handleTemplateContentChange(e.target.value)} rows={6} className="input-dark text-sm resize-none font-mono" />
                  {templateForm.variables && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs text-ink-400 mr-1">Variables detectadas:</span>
                      {templateForm.variables.split(',').filter(Boolean).map(v => (
                        <span key={v.trim()} className="text-xs px-2 py-0.5 rounded-full bg-crimson-700/15 text-crimson-400 border border-crimson-500/20 font-mono">
                          {`{{${v.trim()}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <input type="text" placeholder="Tags (separados por coma)" value={templateForm.tags}
                  onChange={e => setTemplateForm(p => ({ ...p, tags: e.target.value }))} className="input-dark text-sm" />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowTemplateForm(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <button onClick={handleSaveTemplate} disabled={savingTemplate} className="btn-primary flex-1 justify-center">
                  {savingTemplate ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <><CheckCircle size={15} /> {editingTemplate ? 'Actualizar' : 'Crear'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Use Template Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {useTemplateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setUseTemplateModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: (platformConfig[useTemplateModal.platform] || { color: '#6b7280' }).color }}>
                    {(platformConfig[useTemplateModal.platform] || { short: '??' }).short}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{useTemplateModal.title}</h3>
                    <p className="text-xs text-ink-400 capitalize">{useTemplateModal.category.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <button onClick={() => setUseTemplateModal(null)} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>

              {/* Template preview */}
              <div className="bg-ink-900/60 rounded-xl p-4 mb-5 border border-white/5">
                <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">{
                  (() => {
                    let preview = useTemplateModal.content
                    for (const [key, value] of Object.entries(templateVars)) {
                      if (value) preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
                    }
                    return preview
                  })()
                }</p>
              </div>

              {/* Variable inputs */}
              {useTemplateModal.variables.length > 0 && (
                <div className="space-y-3 mb-5">
                  <p className="text-xs font-semibold text-ink-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Variable size={13} /> Completa las variables
                  </p>
                  {useTemplateModal.variables.map(v => (
                    <div key={v}>
                      <label className="text-xs text-ink-400 mb-1 block font-mono">{`{{${v}}}`}</label>
                      <input type="text" placeholder={`Escribe ${v}...`} value={templateVars[v] || ''}
                        onChange={e => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                        className="input-dark text-sm" />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setUseTemplateModal(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={handleApplyTemplate} disabled={applyingTemplate}
                  className="btn-primary flex-1 justify-center">
                  {applyingTemplate ? <><Loader2 size={15} className="animate-spin" /> Aplicando...</> : <><Send size={15} /> Aplicar y crear post</>}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin create modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white text-lg">{t('admin:approvals.newPostDesign')}</h3>
                <button onClick={() => setShowModal(false)} className="text-ink-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                {/* Type toggle */}
                <div className="flex gap-2 p-1 bg-ink-800/50 rounded-xl">
                  {[{ k: 'post', l: t('admin:approvals.publication') }, { k: 'design', l: t('admin:approvals.design') }].map(opt => (
                    <button key={opt.k} onClick={() => setForm(p => ({ ...p, type: opt.k }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.type === opt.k ? 'bg-crimson-700 text-white' : 'text-ink-300 hover:text-white'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} className="input-dark text-sm">
                  <option value="" className="bg-ink-800">{t('admin:approvals.selectClient')}</option>
                  {clients.map(c => <option key={c.id} value={c.id} className="bg-ink-800">{c.company}</option>)}
                </select>
                <input type="text" placeholder={t('admin:approvals.titlePlaceholder')} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input-dark text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} className="input-dark text-sm">
                    <option value="linkedin" className="bg-ink-800">LinkedIn</option>
                    <option value="instagram" className="bg-ink-800">Instagram</option>
                    <option value="facebook" className="bg-ink-800">Facebook</option>
                    <option value="twitter" className="bg-ink-800">Twitter / X</option>
                  </select>
                  <input type="date" value={form.scheduledDate} onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))} className="input-dark text-sm" />
                </div>
                <textarea placeholder={t('admin:approvals.contentPlaceholder')} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={4} className="input-dark text-sm resize-none" />

                {/* Image upload */}
                <div>
                  <input ref={fileRef} type="file" multiple accept="image/*,video/mp4" className="hidden" onChange={e => setSelectedFiles(Array.from(e.target.files || []))} />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/20 rounded-xl text-sm text-ink-300 hover:text-white hover:border-crimson-500/50 transition-all">
                    <Upload size={16} /> {selectedFiles.length > 0 ? `${selectedFiles.length} archivo(s) seleccionado(s)` : 'Subir imágenes o videos (opcional)'}
                  </button>
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="relative">
                          <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                          <button onClick={() => setSelectedFiles(p => p.filter((_, idx) => idx !== i))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <button onClick={handleCreate} disabled={submitting} className="btn-primary flex-1 justify-center">
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> Subiendo...</> : <><Send size={15} /> Enviar al cliente</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
