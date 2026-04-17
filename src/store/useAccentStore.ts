import { create } from 'zustand'

interface AccentState {
  accentColor: string
  setAccentColor: (color: string) => void
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const [rs, gs, bs] = [r, g, b].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function adjustColor(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function applyAccent(hex: string) {
  const root = document.documentElement
  const lum = getLuminance(hex)
  const isLight = lum > 0.4

  root.style.setProperty('--accent', hexToRgb(hex))
  root.style.setProperty('--accent-hex', hex)
  root.style.setProperty('--accent-light', adjustColor(hex, 30))
  root.style.setProperty('--accent-dark', adjustColor(hex, -30))
  root.style.setProperty('--accent-glow', `0 0 20px ${hex}4D, 0 0 60px ${hex}1A`)
  root.style.setProperty('--accent-text', isLight ? '#000000' : '#ffffff')
  root.style.setProperty('--accent-text-rgb', isLight ? '0 0 0' : '255 255 255')
}

const DEFAULT_ACCENT = '#DC143C'

// No persist — accent is always loaded from DB for clients, default for admin
export const useAccentStore = create<AccentState>()((set) => ({
  accentColor: DEFAULT_ACCENT,
  setAccentColor: (color: string) => {
    set({ accentColor: color })
    applyAccent(color)
  },
}))

// Apply default on load
applyAccent(DEFAULT_ACCENT)
