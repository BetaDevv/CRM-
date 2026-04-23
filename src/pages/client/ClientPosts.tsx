import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThumbsUp, ThumbsDown, RotateCcw, Send, CheckCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import T from '../../components/TranslatedText'
import CreatorBadge from '../../components/CreatorBadge'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'
import { postStatusConfig, platformConfig, formatDate } from '../../lib/utils'
import type { PostStatus } from '../../types'

export default function ClientPosts() {
  const { t } = useTranslation(['client', 'common'])
  const { user: _user } = useAuthStore()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackState, setFeedbackState] = useState<Record<string, { show: boolean; text: string }>>({})

  useEffect(() => {
    api.get('/posts').then(r => setPosts(r.data)).finally(() => setLoading(false))
  }, [])

  const handleStatusUpdate = async (postId: string, status: string, feedback?: string) => {
    const { data } = await api.patch(`/posts/${postId}/status`, { status, feedback })
    setPosts(p => p.map(x => x.id === postId ? data : x))
    setFeedbackState(prev => ({ ...prev, [postId]: { show: false, text: '' } }))
  }

  const toggleFeedback = (postId: string) => {
    setFeedbackState(prev => ({
      ...prev,
      [postId]: { show: !prev[postId]?.show, text: prev[postId]?.text || '' },
    }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
    </div>
  )

  return (
    <div className="space-y-4">
      {posts.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center text-center">
          <ThumbsUp size={40} className="text-ink-500 mb-3 opacity-30" />
          <p className="text-ink-300">{t('client:posts.emptyState')}</p>
        </div>
      ) : posts.map(post => {
        const cfg = postStatusConfig[post.status as PostStatus]
        const isPending = post.status === 'pending'
        const pillStyle = isPending
          ? { color: 'var(--accent-light)', background: 'rgb(var(--accent) / 0.15)' }
          : { color: cfg.color, background: cfg.bg }
        const borderColor = isPending ? 'rgb(var(--accent))' : cfg.color
        const fb = feedbackState[post.id]
        return (
          <motion.div key={post.id} layout className="glass-card overflow-hidden">
            <div className="h-1" style={{ background: borderColor }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: platformConfig[post.platform]?.color || '#6b7280' }}>{platformConfig[post.platform]?.short || '?'}</div>
                  <div>
                    <p className="font-semibold text-white text-sm"><T text={post.title} /></p>
                    <p className="text-xs text-ink-400">{post.platform} · {formatDate(post.scheduled_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {post.created_by_name && (
                    <CreatorBadge name={post.created_by_name} avatar={post.created_by_avatar} size="sm" variant="compact" />
                  )}
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={pillStyle}>{t(`common:postStatus.${post.status}`, { defaultValue: cfg.label })}</span>
                </div>
              </div>

              <div className="bg-ink-900/60 rounded-xl p-4 mb-4 border border-white/5">
                <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap"><T text={post.content} translatable /></p>
              </div>

              {post.media_urls?.length > 0 && (
                <div className={`grid gap-2 mb-4 ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.media_urls.map((url: string, i: number) => (
                    <img key={i} src={url} alt="" className="w-full rounded-xl object-cover border border-white/10" style={{ maxHeight: 200 }} />
                  ))}
                </div>
              )}

              {post.feedback && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <p className="text-amber-400 font-semibold mb-0.5">{t('client:posts.teamNote')}</p>
                  <p className="text-amber-200"><T text={post.feedback} translatable /></p>
                </div>
              )}

              {post.status === 'pending' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => handleStatusUpdate(post.id, 'approved')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-bold hover:bg-green-500/20 transition-all">
                      <ThumbsUp size={16} fill="currentColor" /> {t('client:posts.approve')}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => toggleFeedback(post.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                      style={{ background: 'rgb(var(--accent) / 0.12)', color: 'var(--accent-light)', border: '1px solid rgb(var(--accent) / 0.25)' }}>
                      <RotateCcw size={14} /> {t('client:posts.requestChanges')}
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {fb?.show && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="flex gap-2 pt-1">
                          <input type="text" placeholder={t('client:posts.feedbackPlaceholder')} value={fb.text} onChange={e => setFeedbackState(prev => ({ ...prev, [post.id]: { ...prev[post.id], text: e.target.value } }))} className="input-dark text-sm flex-1" />
                          <button onClick={() => handleStatusUpdate(post.id, 'revision', fb.text)}
                            className="px-4 py-2.5 rounded-xl transition-all"
                            style={{ background: 'rgb(var(--accent) / 0.12)', color: 'var(--accent-light)', border: '1px solid rgb(var(--accent) / 0.25)' }}>
                            <Send size={15} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {post.status === 'approved' && <p className="text-sm text-green-400 font-semibold flex items-center gap-2"><CheckCircle size={14} fill="currentColor" /> {t('client:posts.approved')}</p>}
              {post.status === 'revision' && <p className="text-sm text-amber-400 flex items-center gap-2"><RotateCcw size={14} /> {t('client:posts.revisionSent')}</p>}
              {post.status === 'rejected' && <p className="text-sm text-red-400 flex items-center gap-2"><ThumbsDown size={14} /> {t('client:posts.rejected')}</p>}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
