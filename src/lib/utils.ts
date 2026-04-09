import type { ProspectStatus, Priority, PostStatus, IdeaStatus } from '../types'

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

export const prospectStatusConfig: Record<ProspectStatus, { label: string; color: string; bg: string }> = {
  new:         { label: 'Nuevo',        color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  contacted:   { label: 'Contactado',   color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  proposal:    { label: 'Propuesta',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  negotiation: { label: 'Negociación',  color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  won:         { label: 'Ganado ✓',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  lost:        { label: 'Perdido',      color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

export const priorityConfig: Record<Priority, { label: string; color: string; bg: string }> = {
  high:   { label: 'Alta',   color: '#DC143C', bg: 'rgba(220,20,60,0.1)' },
  medium: { label: 'Media',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  low:    { label: 'Baja',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

export const postStatusConfig: Record<PostStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approved: { label: 'Aprobado',   color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  rejected: { label: 'Rechazado',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  revision: { label: 'Revisión',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
}

export const ideaStatusConfig: Record<IdeaStatus, { label: string; color: string; bg: string }> = {
  brainstorm:   { label: 'Brainstorm',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  developing:   { label: 'Desarrollando', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  ready:        { label: 'Lista',       color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  implemented:  { label: 'Implementada', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
}

export const platformConfig: Record<string, { label: string; short: string; color: string }> = {
  linkedin:  { label: 'LinkedIn',  short: 'in', color: '#0A66C2' },
  instagram: { label: 'Instagram', short: 'IG', color: '#E4405F' },
  facebook:  { label: 'Facebook',  short: 'Fb', color: '#1877F2' },
  twitter:   { label: 'Twitter',   short: 'X',  color: '#1DA1F2' },
}

export const categoryColors: Record<string, string> = {
  strategy:  '#DC143C',
  content:   '#7C3AED',
  ads:       '#F59E0B',
  seo:       '#34D399',
  analytics: '#60A5FA',
  design:    '#F97316',
}
