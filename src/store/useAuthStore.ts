import { create } from 'zustand'
import { api } from '../lib/api'

interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'client'
  name: string
  clientId: string | null
  profile_photo: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  restoreSession: () => void
  updateUser: (updates: Partial<AuthUser>) => void
  isAdmin: () => boolean
  isClient: () => boolean
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('tbs_token', data.token)
      localStorage.setItem('tbs_user', JSON.stringify(data.user))
      set({ user: data.user, token: data.token, loading: false })
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  logout: () => {
    localStorage.removeItem('tbs_token')
    localStorage.removeItem('tbs_user')
    set({ user: null, token: null })
  },

  updateUser: (updates) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...updates }
    set({ user: updated })
    localStorage.setItem('tbs_user', JSON.stringify(updated))
  },

  restoreSession: () => {
    const token = localStorage.getItem('tbs_token')
    const userStr = localStorage.getItem('tbs_user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ token, user })
      } catch {
        localStorage.removeItem('tbs_token')
        localStorage.removeItem('tbs_user')
      }
    }
  },

  isAdmin: () => get().user?.role === 'admin',
  isClient: () => get().user?.role === 'client',
  isAuthenticated: () => !!get().user && !!get().token,
}))
