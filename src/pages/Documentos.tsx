import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Upload, Trash2, X, Loader2,
  HardDrive, Filter, Search,
} from 'lucide-react'
import {
  getDocuments, uploadDocuments, deleteDocument, getDocumentDownloadUrl, api,
} from '../lib/api'
import type { Document } from '../lib/api'
import { getFileIcon, formatFileSize, formatDocDate } from '../lib/documentHelpers'
import { useTranslation } from 'react-i18next'

interface ClientOption {
  id: string
  company: string
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}
const item = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1 },
}

const categoryValues = ['todos', 'general', 'contratos', 'reportes', 'disenos', 'otros'] as const

function getExtensionLabel(originalName: string): string {
  return (originalName.split('.').pop() || '').toUpperCase()
}

const categoryLabelKeys: Record<string, string> = {
  todos: 'documents.categories.all',
  general: 'documents.categories.general',
  contratos: 'documents.categories.contracts',
  reportes: 'documents.categories.reports',
  disenos: 'documents.categories.designs',
  otros: 'documents.categories.other',
}

export default function Documentos() {
  const { t } = useTranslation(['admin', 'common'])
  const [docs, setDocs] = useState<Document[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClient, setFilterClient] = useState('')
  const [filterCategory, setFilterCategory] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDocuments(
        filterClient || undefined,
        filterCategory !== 'todos' ? filterCategory : undefined
      )
      setDocs(data)
    } catch (err) {
      console.error('Error loading documents:', err)
    } finally {
      setLoading(false)
    }
  }, [filterClient, filterCategory])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api.get('/clients').then(({ data }) => {
      setClients(data.map((c: any) => ({ id: c.id, company: c.company })))
    })
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id)
      setDocs(prev => prev.filter(d => d.id !== id))
      setConfirmDelete(null)
    } catch (err) {
      console.error('Error deleting document:', err)
    }
  }

  const handleDownload = (doc: Document) => {
    const url = getDocumentDownloadUrl(doc.id)
    const token = localStorage.getItem('tbs_token')
    // Use fetch to download with auth
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = doc.originalName
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  // Filtered docs by search
  const filtered = docs.filter(d =>
    d.originalName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Stats
  const totalSize = docs.reduce((sum, d) => sum + d.size, 0)
  const typeBreakdown = docs.reduce((acc, d) => {
    const ext = getExtensionLabel(d.originalName) || 'OTHER'
    acc[ext] = (acc[ext] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6 min-h-screen"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-crimson-700/20">
            <FolderOpen size={24} className="text-crimson-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--ink-100))' }}>
              {t('admin:documents.title')}
            </h1>
            <p className="text-sm" style={{ color: 'rgb(var(--ink-400))' }}>
              {t('admin:documents.subtitle')}
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-crimson-700 hover:bg-crimson-600 text-white font-medium text-sm transition-colors"
        >
          <Upload size={16} />
          {t('admin:documents.uploadFiles')}
        </motion.button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="glass-card px-4 py-3 rounded-xl flex items-center gap-2">
          <HardDrive size={16} className="text-crimson-400" />
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>
            {t('admin:documents.documentsCount', { count: docs.length })}
          </span>
          <span className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>
            ({formatFileSize(totalSize)})
          </span>
        </div>
        {Object.entries(typeBreakdown).slice(0, 5).map(([ext, count]) => (
          <div key={ext} className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'rgb(var(--ink-700) / 0.5)', color: 'rgb(var(--ink-300))' }}>
            {ext}: {count}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder={t('admin:documents.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-dark w-full pl-9 pr-3 py-2 rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'rgb(var(--ink-400))' }} />
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="input-dark px-3 py-2 rounded-xl text-sm"
          >
            <option value="">{t('admin:documents.allClients')}</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.company}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1">
          {categoryValues.map(catVal => (
            <button
              key={catVal}
              onClick={() => setFilterCategory(catVal)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterCategory === catVal
                  ? 'bg-crimson-700/30 text-crimson-300 border border-crimson-700/40'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
              style={{ color: filterCategory !== catVal ? 'rgb(var(--ink-300))' : undefined }}
            >
              {t(`admin:${categoryLabelKeys[catVal]}`)}
            </button>
          ))}
        </div>
      </div>

      {/* File Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-crimson-400" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="p-4 rounded-2xl bg-crimson-700/10">
            <FolderOpen size={48} className="text-crimson-400/50" />
          </div>
          <p className="text-lg font-medium" style={{ color: 'rgb(var(--ink-300))' }}>
            {t('admin:documents.noDocuments')}
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--ink-400))' }}>
            {t('admin:documents.noDocumentsHint')}
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-crimson-700 hover:bg-crimson-600 text-white font-medium text-sm mt-2"
          >
            <Upload size={16} />
            {t('admin:documents.uploadFiles')}
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          {filtered.map(doc => {
            const { Icon, color, bg } = getFileIcon(doc.mimeType, doc.originalName)
            const ext = getExtensionLabel(doc.originalName)

            return (
              <motion.div
                key={doc.id}
                variants={item}
                layout
                className="group relative glass-card rounded-xl p-4 cursor-pointer transition-all hover:ring-1 hover:ring-crimson-700/30"
                style={{ minHeight: '180px' }}
                onClick={() => handleDownload(doc)}
              >
                {/* Delete button — top right on hover */}
                <button
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 opacity-0 group-hover:opacity-100 transition-all z-10"
                  onClick={e => { e.stopPropagation(); setConfirmDelete(doc.id) }}
                >
                  <Trash2 size={14} />
                </button>

                {/* File icon */}
                <div
                  className="w-full flex items-center justify-center py-5 rounded-lg mb-3"
                  style={{ backgroundColor: bg }}
                >
                  <Icon size={40} style={{ color }} />
                </div>

                {/* Extension badge */}
                <div
                  className="absolute top-14 right-6 px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: color, color: '#fff' }}
                >
                  {ext}
                </div>

                {/* File name */}
                <p
                  className="text-sm font-medium truncate mb-1"
                  style={{ color: 'rgb(var(--ink-100))' }}
                  title={doc.originalName}
                >
                  {doc.originalName}
                </p>

                {/* Size */}
                <p className="text-xs mb-1" style={{ color: 'rgb(var(--ink-400))' }}>
                  {formatFileSize(doc.size)}
                </p>

                {/* Client */}
                <p className="text-xs truncate" style={{ color: 'rgb(var(--ink-300))' }}>
                  {doc.clientName || t('admin:documents.noClient')}
                </p>

                {/* Date */}
                <p className="text-[10px] mt-1" style={{ color: 'rgb(var(--ink-500))' }}>
                  {formatDocDate(doc.createdAt)}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <UploadModal
            clients={clients}
            onClose={() => setShowUpload(false)}
            onUploaded={() => { setShowUpload(false); load() }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card rounded-2xl p-6 w-full max-w-sm space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold" style={{ color: 'rgb(var(--ink-100))' }}>
                {t('admin:documents.deleteTitle')}
              </h3>
              <p className="text-sm" style={{ color: 'rgb(var(--ink-300))' }}>
                {t('admin:documents.deleteMessage')}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
                  style={{ color: 'rgb(var(--ink-300))' }}
                >
                  {t('common:common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDelete(confirmDelete)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                >
                  {t('common:common.delete')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({
  clients,
  onClose,
  onUploaded,
}: {
  clients: ClientOption[]
  onClose: () => void
  onUploaded: () => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [clientId, setClientId] = useState('')
  const [category, setCategory] = useState('general')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.sql', '.csv', '.txt', '.zip']

  const addFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList)
    const valid = arr.filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase()
      return allowedExtensions.includes(ext)
    })
    if (valid.length < arr.length) {
      setError(t('admin:documents.uploadModal.someFilesSkipped', { formats: allowedExtensions.join(', ') }))
    } else {
      setError('')
    }
    setSelectedFiles(prev => [...prev, ...valid])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    setUploading(true)
    setError('')
    try {
      await uploadDocuments(selectedFiles, clientId || undefined, category)
      onUploaded()
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin:documents.uploadModal.errorUploading'))
    } finally {
      setUploading(false)
    }
  }

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass-card rounded-2xl p-6 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--ink-100))' }}>
            {t('admin:documents.uploadModal.title')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} style={{ color: 'rgb(var(--ink-400))' }} />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer
            transition-all duration-200
            ${dragOver
              ? 'border-crimson-500 bg-crimson-700/10'
              : 'border-ink-600/60 hover:border-crimson-700/50 hover:bg-white/[0.02]'
            }
          `}
        >
          <div className="p-3 rounded-xl bg-crimson-700/15">
            <Upload size={28} className="text-crimson-400" />
          </div>
          <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>
            {t('admin:documents.uploadModal.dragOrClick')}
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>
            {t('admin:documents.uploadModal.allowedFormats')}
          </p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={allowedExtensions.join(',')}
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {/* Selected files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>
                {selectedFiles.length > 1
                  ? t('admin:documents.uploadModal.filesSelectedPlural', { count: selectedFiles.length })
                  : t('admin:documents.uploadModal.filesSelected', { count: selectedFiles.length })}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>
                {formatFileSize(totalSize)}
              </p>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {selectedFiles.map((f, i) => {
                const { Icon, color } = getFileIcon(f.type, f.name)
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'rgb(var(--ink-700) / 0.4)' }}
                  >
                    <Icon size={16} style={{ color }} />
                    <span className="text-sm flex-1 truncate" style={{ color: 'rgb(var(--ink-200))' }}>
                      {f.name}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'rgb(var(--ink-400))' }}>
                      {formatFileSize(f.size)}
                    </span>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                    >
                      <X size={14} className="text-red-400" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'rgb(var(--ink-300))' }}>
              {t('admin:documents.uploadModal.clientOptional')}
            </label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="input-dark w-full px-3 py-2 rounded-xl text-sm"
            >
              <option value="">{t('admin:documents.noClient')}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'rgb(var(--ink-300))' }}>
              {t('admin:documents.uploadModal.category')}
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="input-dark w-full px-3 py-2 rounded-xl text-sm"
            >
              {categoryValues.filter(v => v !== 'todos').map(v => (
                <option key={v} value={v}>{t(`admin:${categoryLabelKeys[v]}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Upload button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-crimson-700 hover:bg-crimson-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('admin:documents.uploadModal.uploading')}
            </>
          ) : (
            <>
              <Upload size={16} />
              {selectedFiles.length > 0
                ? (selectedFiles.length > 1
                    ? t('admin:documents.uploadModal.uploadCountPlural', { count: selectedFiles.length })
                    : t('admin:documents.uploadModal.uploadCount', { count: selectedFiles.length }))
                : t('admin:documents.uploadModal.upload')}
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
