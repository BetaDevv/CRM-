import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Upload, Trash2, X, Loader2,
  HardDrive, Search, Share2, Users as UsersIcon, Download, FileText,
} from 'lucide-react'
import {
  getDocuments, uploadDocuments, deleteDocument, getDocumentDownloadUrl,
} from '../../lib/api'
import type { Document } from '../../lib/api'
import T from '../../components/TranslatedText'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { getFileIcon, formatFileSize, formatDocDate } from '../../lib/documentHelpers'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}
const item = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1 },
}

function getExtensionLabel(originalName: string): string {
  return (originalName.split('.').pop() || '').toUpperCase()
}

export default function ClientDocumentos() {
  const { t } = useTranslation(['client', 'common'])
  const { user } = useAuthStore()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const categories = [
    { value: 'todos', label: t('client:documents.categoryAll') },
    { value: 'general', label: t('client:documents.categoryGeneral') },
    { value: 'contratos', label: t('client:documents.categoryContracts') },
    { value: 'reportes', label: t('client:documents.categoryReports') },
    { value: 'disenos', label: t('client:documents.categoryDesigns') },
    { value: 'otros', label: t('client:documents.categoryOther') },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDocuments(
        undefined,
        filterCategory !== 'todos' ? filterCategory : undefined
      )
      setDocs(data)
    } catch (err) {
      console.error('Error loading documents:', err)
    } finally {
      setLoading(false)
    }
  }, [filterCategory])

  useEffect(() => {
    load()
  }, [load])

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

  const openPreview = useCallback((doc: Document) => {
    setPreviewDoc(doc)
    const isPreviewable = doc.mimeType.startsWith('image/') || doc.mimeType.includes('pdf')
    if (isPreviewable) {
      const url = getDocumentDownloadUrl(doc.id)
      const token = localStorage.getItem('tbs_token')
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.blob())
        .then(blob => setPreviewUrl(URL.createObjectURL(blob)))
    } else {
      setPreviewUrl(null)
    }
  }, [])

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewDoc(null)
    setPreviewUrl(null)
  }, [previewUrl])

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

  const isOwnUpload = (doc: Document) => doc.uploadedBy === user?.id

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6 min-h-screen"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgb(var(--accent) / 0.2)' }}>
            <FolderOpen size={24} style={{ color: 'var(--accent-light)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--ink-100))' }}>
              {t('client:documents.title')}
            </h1>
            <p className="text-sm" style={{ color: 'rgb(var(--ink-400))' }}>
              {t('client:documents.subtitle')}
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-colors"
          style={{ backgroundColor: 'rgb(var(--accent))' }}
        >
          <Upload size={16} />
          {t('client:documents.uploadFiles')}
        </motion.button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="glass-card px-4 py-3 rounded-xl flex items-center gap-2">
          <HardDrive size={16} style={{ color: 'var(--accent-light)' }} />
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>
            {t('client:documents.documentsCount', { count: docs.length })}
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
            placeholder={t('client:documents.searchFile')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-dark w-full pl-9 pr-3 py-2 rounded-xl text-sm"
          />
        </div>

        <div className="flex gap-1">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterCategory === cat.value
                  ? 'border'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
              style={filterCategory === cat.value
                ? { backgroundColor: 'rgb(var(--accent) / 0.3)', color: 'var(--accent-light)', borderColor: 'rgb(var(--accent) / 0.4)' }
                : { color: 'rgb(var(--ink-300))' }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* File Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="p-4 rounded-2xl" style={{ backgroundColor: 'rgb(var(--accent) / 0.1)' }}>
            <FolderOpen size={48} style={{ color: 'var(--accent-light)', opacity: 0.5 }} />
          </div>
          <p className="text-lg font-medium" style={{ color: 'rgb(var(--ink-300))' }}>
            {t('client:documents.noDocuments')}
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--ink-400))' }}>
            {t('client:documents.uploadToStart')}
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm mt-2"
            style={{ backgroundColor: 'rgb(var(--accent))' }}
          >
            <Upload size={16} />
            {t('client:documents.uploadFiles')}
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
            const ownUpload = isOwnUpload(doc)

            return (
              <motion.div
                key={doc.id}
                variants={item}
                layout
                className="group relative glass-card rounded-xl p-4 cursor-pointer transition-all hover:ring-1 hover:ring-[rgb(var(--accent)/0.3)]"
                style={{ minHeight: '180px' }}
                onClick={() => openPreview(doc)}
              >
                {/* Action buttons — top right on hover */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                  <button
                    className="p-1.5 rounded-lg bg-ink-700/80 text-ink-300 hover:bg-ink-600 hover:text-white transition-all"
                    onClick={e => { e.stopPropagation(); handleDownload(doc) }}
                    title={t('client:documents.download')}
                  >
                    <Download size={14} />
                  </button>
                  {ownUpload && (
                    <button
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                      onClick={e => { e.stopPropagation(); setConfirmDelete(doc.id) }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Badge: from admin team */}
                {!ownUpload && (
                  <div
                    className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold z-10"
                    style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}
                  >
                    <UsersIcon size={10} />
                    {t('client:documents.fromTeam')}
                  </div>
                )}

                {/* Badge: shared with admin */}
                {ownUpload && doc.shared && (
                  <div
                    className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold z-10"
                    style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#34D399' }}
                  >
                    <Share2 size={10} />
                    {t('client:documents.shared')}
                  </div>
                )}

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
                  <T text={doc.originalName} />
                </p>

                {/* Size */}
                <p className="text-xs mb-1" style={{ color: 'rgb(var(--ink-400))' }}>
                  {formatFileSize(doc.size)}
                </p>

                {/* Category */}
                <p className="text-xs truncate" style={{ color: 'rgb(var(--ink-300))' }}>
                  <T text={doc.category} />
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

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={closePreview}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              onMouseDown={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={18} style={{ color: 'var(--accent-light)' }} />
                  <p className="text-sm font-medium text-white truncate">{previewDoc.originalName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(previewDoc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ backgroundColor: 'rgb(var(--accent) / 0.2)', color: 'var(--accent-light)' }}
                  >
                    <Download size={13} /> {t('client:documents.download')}
                  </button>
                  <button onClick={closePreview} className="text-ink-400 hover:text-white p-1">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Preview content */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-ink-950/50">
                {previewDoc.mimeType.startsWith('image/') ? (
                  previewUrl ? (
                    <img src={previewUrl} alt={previewDoc.originalName} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                  ) : (
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
                  )
                ) : previewDoc.mimeType.includes('pdf') ? (
                  previewUrl ? (
                    <iframe src={previewUrl} className="w-full h-[75vh] rounded-lg bg-white" title="PDF Preview" />
                  ) : (
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
                  )
                ) : (
                  <div className="text-center py-16">
                    <FileText size={48} className="mx-auto mb-4 text-ink-500" />
                    <p className="text-ink-300 text-sm mb-1">{previewDoc.originalName}</p>
                    <p className="text-ink-500 text-xs mb-4">{t('client:documents.noPreview')}</p>
                    <button
                      onClick={() => handleDownload(previewDoc)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
                      style={{ backgroundColor: 'rgb(var(--accent))' }}
                    >
                      <Download size={14} className="inline mr-1.5" />{t('client:documents.download')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <ClientUploadModal
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
                {t('client:documents.deleteDocument')}
              </h3>
              <p className="text-sm" style={{ color: 'rgb(var(--ink-300))' }}>
                {t('client:documents.deleteWarning')}
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

// ─── Client Upload Modal ────────────────────────────────────────────────────────

function ClientUploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void
  onUploaded: () => void
}) {
  const { t } = useTranslation(['client', 'common'])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [category, setCategory] = useState('general')
  const [shared, setShared] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadCategories = [
    { value: 'general', label: t('client:documents.categoryGeneral') },
    { value: 'contratos', label: t('client:documents.categoryContracts') },
    { value: 'reportes', label: t('client:documents.categoryReports') },
    { value: 'disenos', label: t('client:documents.categoryDesigns') },
    { value: 'otros', label: t('client:documents.categoryOther') },
  ]

  const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.sql', '.csv', '.txt', '.zip']

  const addFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList)
    const valid = arr.filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase()
      return allowedExtensions.includes(ext)
    })
    if (valid.length < arr.length) {
      setError(t('client:documents.someFilesOmitted', { formats: allowedExtensions.join(', ') }))
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
      await uploadDocuments(selectedFiles, undefined, category, shared)
      onUploaded()
    } catch (err: any) {
      setError(err.response?.data?.error || t('client:documents.uploadError'))
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
            {t('client:documents.uploadTitle')}
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
              ? 'border-ink-600/60'
              : 'border-ink-600/60 hover:bg-white/[0.02]'
            }
          `}
          style={dragOver ? { borderColor: 'var(--accent-light)', backgroundColor: 'rgb(var(--accent) / 0.1)' } : {}}
        >
          <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgb(var(--accent) / 0.15)' }}>
            <Upload size={28} style={{ color: 'var(--accent-light)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>
            {t('client:documents.dragDrop')}
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>
            {t('client:documents.allowedFormats')}
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
                {t('client:documents.filesSelected', { count: selectedFiles.length })}
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
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'rgb(var(--ink-300))' }}>
              {t('client:documents.categoryLabel')}
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="input-dark w-full px-3 py-2 rounded-xl text-sm"
            >
              {uploadCategories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Share toggle */}
          <div
            className="flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all hover:bg-white/[0.03]"
            style={{ backgroundColor: 'rgb(var(--ink-700) / 0.3)', border: '1px solid rgb(var(--ink-600) / 0.4)' }}
            onClick={() => setShared(!shared)}
          >
            <div className="flex items-center gap-3">
              <Share2 size={16} style={{ color: shared ? '#34D399' : 'rgb(var(--ink-400))' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink-200))' }}>
                  {t('client:documents.shareWithAdmin')}
                </p>
                <p className="text-xs" style={{ color: 'rgb(var(--ink-400))' }}>
                  {shared ? t('client:documents.shareOnDesc') : t('client:documents.shareOffDesc')}
                </p>
              </div>
            </div>
            <div
              className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${
                shared ? 'bg-emerald-500' : 'bg-ink-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  shared ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
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
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          style={{ backgroundColor: 'rgb(var(--accent))' }}
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('client:documents.uploading')}
            </>
          ) : (
            <>
              <Upload size={16} />
              {selectedFiles.length > 0 ? t('client:documents.uploadCount', { count: selectedFiles.length }) : t('client:documents.uploadFiles')}
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
