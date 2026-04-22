import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserPlus, Shield, UserCheck, UserX, Key,
  Trash2, X, Loader2, Eye, EyeOff, AlertTriangle,
  Copy, Check, Power, Zap, Globe, Search, Building2,
} from 'lucide-react'
import {
  getUsers, createUser, toggleUserActive, resetUserPassword, deleteUser,
  getApiKeys, createApiKey, toggleApiKey, deleteApiKey,
  api,
} from '../lib/api'
import type { User, ApiKey } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'

interface ClientOption {
  id: string
  company: string
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function relativeTime(date: string | null, neverLabel: string) {
  if (!date) return neverLabel
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
  } catch {
    return neverLabel
  }
}

export default function Usuarios() {
  const { t } = useTranslation(['admin', 'common'])
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client', client_id: '' })

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    open: boolean
    title: string
    message: string
    action: () => Promise<void>
    destructive?: boolean
  }>({ open: false, title: '', message: '', action: async () => {} })

  // Reset password dialog
  const [resetDialog, setResetDialog] = useState<{ open: boolean; userId: string; userName: string }>({
    open: false, userId: '', userName: '',
  })
  const [newPassword, setNewPassword] = useState('')

  // Search across all user groups
  const [search, setSearch] = useState('')

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', user_id: '', role: 'client', client_id: '', scopes: 'read' })
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [submittingKey, setSubmittingKey] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [usersData, clientsRes, keysData] = await Promise.all([
        getUsers(),
        api.get('/clients'),
        getApiKeys(),
      ])
      setUsers(usersData)
      setClients(clientsRes.data.map((c: any) => ({ id: c.id, company: c.company })))
      setApiKeys(keysData)
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.name || !form.email || !form.password) return
    setSubmitting(true)
    try {
      const newUser = await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        client_id: form.role === 'client' ? form.client_id || undefined : undefined,
      })
      setUsers(prev => [newUser, ...prev])
      setShowModal(false)
      setForm({ name: '', email: '', password: '', role: 'client', client_id: '' })
      setShowPassword(false)
    } catch (err: any) {
      alert(err.response?.data?.error || t('admin:users.form.errorCreating'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(user: User) {
    try {
      const updated = await toggleUserActive(user.id)
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
    } catch (err) {
      console.error('Error toggling user:', err)
    }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      alert(t('admin:users.form.passwordMinLength'))
      return
    }
    try {
      await resetUserPassword(resetDialog.userId, newPassword)
      setResetDialog({ open: false, userId: '', userName: '' })
      setNewPassword('')
    } catch (err) {
      console.error('Error resetting password:', err)
    }
  }

  async function handleDelete(user: User) {
    setConfirm({
      open: true,
      title: t('admin:users.confirmDelete.title'),
      message: t('admin:users.confirmDelete.message', { name: user.name }),
      destructive: true,
      action: async () => {
        try {
          await deleteUser(user.id)
          setUsers(prev => prev.filter(u => u.id !== user.id))
        } catch (err: any) {
          alert(err.response?.data?.error || t('admin:users.confirmDelete.errorDeleting'))
        }
        setConfirm(prev => ({ ...prev, open: false }))
      },
    })
  }

  // API Key handlers
  async function handleCreateApiKey() {
    if (!apiKeyForm.name || !apiKeyForm.user_id || !apiKeyForm.role) return
    setSubmittingKey(true)
    try {
      const newKey = await createApiKey({
        name: apiKeyForm.name,
        user_id: apiKeyForm.user_id,
        role: apiKeyForm.role,
        client_id: apiKeyForm.role === 'client' ? apiKeyForm.client_id || undefined : undefined,
        scopes: apiKeyForm.scopes,
      })
      setApiKeys(prev => [newKey, ...prev])
      setCreatedKey(newKey.full_key || null)
      setApiKeyForm({ name: '', user_id: '', role: 'client', client_id: '', scopes: 'read' })
    } catch (err: any) {
      alert(err.response?.data?.error || t('admin:users.apiKeys.form.errorCreating'))
    } finally {
      setSubmittingKey(false)
    }
  }

  async function handleToggleApiKey(key: ApiKey) {
    try {
      const updated = await toggleApiKey(key.id)
      setApiKeys(prev => prev.map(k => (k.id === updated.id ? { ...k, is_active: updated.is_active } : k)))
    } catch (err) {
      console.error('Error toggling API key:', err)
    }
  }

  async function handleDeleteApiKey(key: ApiKey) {
    setConfirm({
      open: true,
      title: t('admin:users.apiKeys.confirmDelete.title'),
      message: t('admin:users.apiKeys.confirmDelete.message', { name: key.name }),
      destructive: true,
      action: async () => {
        try {
          await deleteApiKey(key.id)
          setApiKeys(prev => prev.filter(k => k.id !== key.id))
        } catch (err: any) {
          alert(err.response?.data?.error || t('admin:users.apiKeys.confirmDelete.errorDeleting'))
        }
        setConfirm(prev => ({ ...prev, open: false }))
      },
    })
  }

  function maskKey(key: string) {
    if (!key || key.length < 8) return '****'
    return key.slice(0, 4) + '****...' + key.slice(-4)
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  // Stats
  const totalUsers = users.length
  const adminCount = users.filter(u => u.role === 'admin').length
  const clientCount = users.filter(u => u.role === 'client').length
  const inactiveCount = users.filter(u => !u.active).length

  // Grouping: admins/team first, then clients alphabetically, then orphan client-role users
  type UserGroup = {
    key: string
    kind: 'team' | 'client' | 'orphan'
    label: string
    users: User[]
  }

  const groups = useMemo<UserGroup[]>(() => {
    const q = search.trim().toLowerCase()
    const matches = (u: User) =>
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)

    // Team: admins OR users without a client_id
    const teamUsers = users
      .filter(u => u.role === 'admin' || !u.clientId)
      .filter(matches)

    // Per-client groups
    const clientGroups: UserGroup[] = [...clients]
      .sort((a, b) => a.company.localeCompare(b.company))
      .map(c => ({
        key: `client-${c.id}`,
        kind: 'client' as const,
        label: c.company,
        users: users.filter(u => u.role !== 'admin' && u.clientId === c.id).filter(matches),
      }))

    // Orphans: client-role users with a client_id that doesn't match any known client
    const knownClientIds = new Set(clients.map(c => c.id))
    const orphanUsers = users
      .filter(u => u.role !== 'admin' && u.clientId && !knownClientIds.has(u.clientId))
      .filter(matches)

    const result: UserGroup[] = []
    if (teamUsers.length > 0 || !q) {
      result.push({ key: 'team', kind: 'team', label: t('admin:users.team'), users: teamUsers })
    }
    result.push(...clientGroups)
    if (orphanUsers.length > 0) {
      result.push({ key: 'orphan', kind: 'orphan', label: t('admin:users.noClient'), users: orphanUsers })
    }

    // When searching, hide empty groups
    return q ? result.filter(g => g.users.length > 0) : result
  }, [users, clients, search, t])

  const stats = [
    { label: t('admin:users.stats.total'), value: totalUsers, icon: Users, color: 'text-white' },
    { label: t('admin:users.stats.admins'), value: adminCount, icon: Shield, color: 'text-[var(--accent-light)]' },
    { label: t('admin:users.stats.clients'), value: clientCount, icon: UserCheck, color: 'text-blue-400' },
    { label: t('admin:users.stats.inactive'), value: inactiveCount, icon: UserX, color: 'text-ink-400' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-light)' }} />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin:users.title')}</h1>
          <p className="text-sm text-ink-300 mt-1">{t('admin:users.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={16} />
          {t('admin:users.newUser')}
        </motion.button>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {stats.map(s => (
          <motion.div key={s.label} variants={item} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <s.icon size={18} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-ink-300 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative"
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('admin:users.searchPlaceholder')}
          className="input-dark w-full pl-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </motion.div>

      {/* Grouped Users */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        <AnimatePresence mode="popLayout">
          {groups.map((group, gi) => {
            const isTeam = group.kind === 'team'
            const groupIcon = isTeam ? Shield : Building2
            const GroupIcon = groupIcon
            return (
              <motion.section
                key={group.key}
                layout
                variants={item}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: gi * 0.04 }}
                className="glass-card overflow-hidden"
              >
                {/* Group header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isTeam
                          ? 'ring-1 ring-[rgb(var(--accent)_/_0.3)]'
                          : 'bg-ink-800/60 ring-1 ring-white/5'
                      }`}
                      style={isTeam ? { background: 'rgb(var(--accent) / 0.15)', color: 'var(--accent-light)' } : {}}
                    >
                      <GroupIcon size={16} className={isTeam ? '' : 'text-ink-300'} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">{group.label}</h2>
                      <p className="text-[11px] text-ink-400">
                        {t('admin:users.userCount', { count: group.users.length })}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: 'rgb(var(--accent))', color: 'var(--accent-text)' }}
                  >
                    {group.users.length}
                  </span>
                </div>

                {/* Group body: user cards grid */}
                {group.users.length === 0 ? (
                  <div className="text-center py-8 text-ink-500 text-sm">
                    {t('admin:users.emptyGroup')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                    <AnimatePresence mode="popLayout">
                      {group.users.map((user, ui) => (
                        <motion.div
                          key={user.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: ui * 0.02 }}
                          className="relative rounded-2xl bg-ink-900/40 hover:bg-ink-800/50 border border-white/5 hover:border-white/10 p-4 transition-all"
                        >
                          {/* Top row: avatar + name/email + role pill */}
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                user.active
                                  ? 'ring-1 ring-[rgb(var(--accent)_/_0.3)]'
                                  : 'bg-ink-700 text-ink-400 ring-1 ring-ink-600/30'
                              }`}
                              style={user.active ? { background: `linear-gradient(to bottom right, rgb(var(--accent) / 0.4), rgb(var(--accent) / 0.15))`, color: 'var(--accent-light)' } : {}}
                            >
                              {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                getInitials(user.name)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm truncate ${user.active ? 'text-white' : 'text-ink-400'}`}>
                                {user.name}
                              </p>
                              <p className="text-xs text-ink-400 truncate">{user.email}</p>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                user.role === 'admin'
                                  ? 'ring-1 ring-[rgb(var(--accent)_/_0.3)] bg-[rgb(var(--accent)_/_0.2)] text-[var(--accent-light)]'
                                  : 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                              }`}
                            >
                              {user.role === 'admin' ? <Shield size={10} /> : <UserCheck size={10} />}
                              {user.role === 'admin' ? t('admin:users.role.admin') : t('admin:users.role.client')}
                            </span>
                          </div>

                          {/* Bottom row: status + last login + actions */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                  user.active
                                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                                    : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${user.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                {user.active ? t('admin:users.status.active') : t('admin:users.status.inactive')}
                              </span>
                              <span className="text-[10px] text-ink-500">
                                {relativeTime(user.lastLogin, t('admin:users.never'))}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleToggle(user)}
                                title={user.active ? t('admin:users.deactivate') : t('admin:users.activate')}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  user.active
                                    ? 'text-ink-400 hover:text-amber-400 hover:bg-amber-500/10'
                                    : 'text-ink-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                              >
                                {user.active ? <UserX size={14} /> : <UserCheck size={14} />}
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setResetDialog({ open: true, userId: user.id, userName: user.name })}
                                title={t('admin:users.resetPasswordModal.title')}
                                className="p-1.5 rounded-lg text-ink-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                              >
                                <Key size={14} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDelete(user)}
                                title={t('common:common.delete')}
                                className="p-1.5 rounded-lg text-ink-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={14} />
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.section>
            )
          })}
        </AnimatePresence>

        {users.length === 0 && (
          <div className="glass-card text-center py-12 text-ink-400">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p>{t('admin:users.noUsers')}</p>
          </div>
        )}

        {users.length > 0 && groups.length === 0 && (
          <div className="glass-card text-center py-10 text-ink-400 text-sm">
            {t('admin:users.noSearchResults')}
          </div>
        )}
      </motion.div>

      {/* ═══ API Keys Section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Globe size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('admin:users.apiKeys.title')}</h2>
              <p className="text-xs text-ink-300">{t('admin:users.apiKeys.subtitle')}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setShowApiKeyModal(true); setCreatedKey(null) }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Zap size={14} />
            {t('admin:users.apiKeys.generate')}
          </motion.button>
        </div>

        <motion.div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.key')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.role')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.client')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.scopes')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.lastUsed')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-ink-300 uppercase tracking-wider">{t('admin:users.apiKeys.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {apiKeys.map((ak, i) => (
                    <motion.tr
                      key={ak.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-white">{ak.name}</span>
                          {ak.user_name && (
                            <p className="text-xs text-ink-400 mt-0.5">{ak.user_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono text-ink-300 bg-ink-800/50 px-2 py-1 rounded">
                          {maskKey(ak.key)}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          ak.role === 'admin'
                            ? 'ring-1 ring-[rgb(var(--accent)_/_0.3)] bg-[rgb(var(--accent)_/_0.2)] text-[var(--accent-light)]'
                            : 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                        }`}>
                          {ak.role === 'admin' ? <Shield size={12} /> : <UserCheck size={12} />}
                          {ak.role === 'admin' ? t('admin:users.role.admin') : t('admin:users.role.client')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-300 text-xs">{ak.client_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-ink-300 bg-ink-800/50 px-2 py-0.5 rounded">
                          {ak.scopes}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          ak.is_active
                            ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ak.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {ak.is_active ? t('admin:users.apiKeys.status.active') : t('admin:users.apiKeys.status.inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-400 text-xs">
                        {ak.last_used_at ? relativeTime(ak.last_used_at, t('admin:users.never')) : t('admin:users.never')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleToggleApiKey(ak)}
                            title={ak.is_active ? t('admin:users.deactivate') : t('admin:users.activate')}
                            className={`p-1.5 rounded-lg transition-colors ${
                              ak.is_active
                                ? 'text-ink-400 hover:text-amber-400 hover:bg-amber-500/10'
                                : 'text-ink-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            <Power size={15} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteApiKey(ak)}
                            title={t('common:common.delete')}
                            className="p-1.5 rounded-lg text-ink-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={15} />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {apiKeys.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <Key size={40} className="mx-auto mb-3 opacity-40" />
              <p>{t('admin:users.apiKeys.noKeys')}</p>
              <p className="text-xs mt-1">{t('admin:users.apiKeys.noKeysHint')}</p>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Create API Key Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={() => { setShowApiKeyModal(false); setCreatedKey(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onMouseDown={e => e.stopPropagation()}
              className="glass-card w-full max-w-md p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Zap size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {createdKey ? t('admin:users.apiKeys.generated') : t('admin:users.apiKeys.newKey')}
                  </h3>
                </div>
                <button onClick={() => { setShowApiKeyModal(false); setCreatedKey(null) }} className="text-ink-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {createdKey ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300">
                        {t('admin:users.apiKeys.copyWarning')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-white bg-ink-900 px-3 py-2 rounded-lg break-all">
                        {createdKey}
                      </code>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => copyToClipboard(createdKey)}
                        className={`p-2 rounded-lg transition-colors ${
                          copiedKey
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-ink-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                      </motion.button>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowApiKeyModal(false); setCreatedKey(null) }}
                    className="w-full btn-primary"
                  >
                    {t('admin:users.apiKeys.done')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.apiKeys.form.name')}</label>
                      <input
                        type="text"
                        value={apiKeyForm.name}
                        onChange={e => setApiKeyForm(f => ({ ...f, name: e.target.value }))}
                        placeholder={t('admin:users.apiKeys.form.namePlaceholder')}
                        className="input-dark w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.apiKeys.form.associatedUser')}</label>
                      <select
                        value={apiKeyForm.user_id}
                        onChange={e => setApiKeyForm(f => ({ ...f, user_id: e.target.value }))}
                        className="input-dark w-full"
                      >
                        <option value="">{t('admin:users.apiKeys.form.selectUser')}</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.apiKeys.form.keyRole')}</label>
                      <select
                        value={apiKeyForm.role}
                        onChange={e => setApiKeyForm(f => ({ ...f, role: e.target.value, client_id: '' }))}
                        className="input-dark w-full"
                      >
                        <option value="client">{t('admin:users.apiKeys.form.clientReadOnly')}</option>
                        <option value="admin">{t('admin:users.apiKeys.form.adminFullCrud')}</option>
                      </select>
                    </div>

                    <AnimatePresence>
                      {apiKeyForm.role === 'client' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.apiKeys.form.assignedClient')}</label>
                          <select
                            value={apiKeyForm.client_id}
                            onChange={e => setApiKeyForm(f => ({ ...f, client_id: e.target.value }))}
                            className="input-dark w-full"
                          >
                            <option value="">{t('admin:users.apiKeys.form.selectClient')}</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>{c.company}</option>
                            ))}
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div>
                      <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.apiKeys.form.scopes')}</label>
                      <select
                        value={apiKeyForm.scopes}
                        onChange={e => setApiKeyForm(f => ({ ...f, scopes: e.target.value }))}
                        className="input-dark w-full"
                      >
                        <option value="read">{t('admin:users.apiKeys.form.readOnly')}</option>
                        <option value="read,write">{t('admin:users.apiKeys.form.readWrite')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowApiKeyModal(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:text-white hover:bg-white/5 transition-all border border-white/10"
                    >
                      {t('common:common.cancel')}
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCreateApiKey}
                      disabled={submittingKey || !apiKeyForm.name || !apiKeyForm.user_id || (apiKeyForm.role === 'client' && !apiKeyForm.client_id)}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingKey ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                      {t('admin:users.apiKeys.form.generate')}
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onMouseDown={e => e.stopPropagation()}
              className="glass-card w-full max-w-md p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{t('admin:users.newUser')}</h3>
                <button onClick={() => setShowModal(false)} className="text-ink-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.form.name')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={t('admin:users.form.namePlaceholder')}
                    className="input-dark w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.form.email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder={t('admin:users.form.emailPlaceholder')}
                    className="input-dark w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.form.password')}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={t('admin:users.form.passwordPlaceholder')}
                      className="input-dark w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.form.role')}</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value, client_id: '' }))}
                    className="input-dark w-full"
                  >
                    <option value="client">{t('admin:users.role.client')}</option>
                    <option value="admin">{t('admin:users.role.admin')}</option>
                  </select>
                </div>

                <AnimatePresence>
                  {form.role === 'client' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.form.assignedClient')}</label>
                      <select
                        value={form.client_id}
                        onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                        className="input-dark w-full"
                      >
                        <option value="">{t('admin:users.form.noAssignment')}</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.company}</option>
                        ))}
                      </select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:text-white hover:bg-white/5 transition-all border border-white/10"
                >
                  {t('common:common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  disabled={submitting || !form.name || !form.email || !form.password}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {t('admin:users.form.create')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Dialog */}
      <AnimatePresence>
        {resetDialog.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={() => { setResetDialog({ open: false, userId: '', userName: '' }); setNewPassword('') }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onMouseDown={e => e.stopPropagation()}
              className="glass-card w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white">{t('admin:users.resetPasswordModal.title')}</h3>
                  <p className="text-xs text-ink-300">{resetDialog.userName}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-300 mb-1.5 font-medium">{t('admin:users.resetPasswordModal.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={t('admin:users.form.passwordPlaceholder')}
                  className="input-dark w-full"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setResetDialog({ open: false, userId: '', userName: '' }); setNewPassword('') }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:text-white hover:bg-white/5 transition-all border border-white/10"
                >
                  {t('common:common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 6}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('admin:users.resetPasswordModal.reset')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirm.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseDown={() => setConfirm(prev => ({ ...prev, open: false }))}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onMouseDown={e => e.stopPropagation()}
              className="glass-card w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="font-bold text-white">{confirm.title}</h3>
              </div>
              <p className="text-sm text-ink-300">{confirm.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm(prev => ({ ...prev, open: false }))}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:text-white hover:bg-white/5 transition-all border border-white/10"
                >
                  {t('common:common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={confirm.action}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
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
