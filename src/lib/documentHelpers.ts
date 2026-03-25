import { File, FileText, FileSpreadsheet, Presentation, Database } from 'lucide-react'

/**
 * Helpers compartidos para las páginas de documentos (admin + cliente).
 * En Django esto sería un utils.py con funciones que usan varias views.
 */

export function getFileIcon(mimeType: string, originalName: string) {
  const ext = originalName.split('.').pop()?.toLowerCase() || ''

  if (mimeType === 'application/pdf' || ext === 'pdf')
    return { Icon: FileText, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' }
  if (mimeType.includes('word') || ['doc', 'docx'].includes(ext))
    return { Icon: FileText, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext))
    return { Icon: FileSpreadsheet, color: '#10B981', bg: 'rgba(16,185,129,0.12)' }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(ext))
    return { Icon: Presentation, color: '#F97316', bg: 'rgba(249,115,22,0.12)' }
  if (ext === 'sql')
    return { Icon: Database, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' }
  if (ext === 'txt')
    return { Icon: FileText, color: '#6B7280', bg: 'rgba(107,114,128,0.12)' }
  if (ext === 'zip')
    return { Icon: File, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' }
  return { Icon: File, color: '#6B7280', bg: 'rgba(107,114,128,0.12)' }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDocDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}
