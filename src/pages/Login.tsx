import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/useAuthStore'
import { LogoLogin } from '../components/Logo'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const { login, loading, error, isAuthenticated, isAdmin } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(isAdmin() ? '/' : '/portal', { replace: true })
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (!email || !password) { setLocalError(t('login.fillAll')); return }
    try {
      await login(email, password)
      const { isAdmin: checkAdmin } = useAuthStore.getState()
      navigate(checkAdmin() ? '/' : '/portal', { replace: true })
    } catch (err: any) {
      setLocalError(err.message)
    }
  }

  const displayError = localError || error

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4 relative overflow-hidden">

      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-crimson-700/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-crimson-900/10 rounded-full blur-[100px]" />
        <div className="dot-pattern absolute inset-0 opacity-40" />

        {/* Animated floating elements */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-crimson-500 rounded-full"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{ y: [-10, 10, -10], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <LogoLogin />
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold text-white mb-1">{t('login.title')}</h2>
            <p className="text-sm text-ink-300 mb-7">{t('login.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">{t('login.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="input-dark"
                  autoFocus
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">{t('login.password')}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-dark pr-11"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {displayError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                  >
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{displayError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.01 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                className="w-full flex items-center justify-center gap-2 bg-crimson-700 hover:bg-crimson-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-crimson mt-2"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> {t('login.loading')}</>
                ) : (
                  <>{t('login.submit')} <ArrowRight size={16} /></>
                )}
              </motion.button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-ink-500">
                {t('login.inviteOnly')}
                <br />{t('login.contactAdmin')}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Bottom tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-ink-500 mt-6 space-y-1"
        >
          <p>{t('login.copyright')}</p>
          <div className="flex items-center justify-center gap-3">
            <a href="/privacy" className="text-ink-500 hover:text-crimson-400 transition-colors underline underline-offset-2">
              {t('login.privacyPolicy')}
            </a>
            <span className="text-ink-600">·</span>
            <a href="/terms" className="text-ink-500 hover:text-crimson-400 transition-colors underline underline-offset-2">
              {t('login.termsOfService')}
            </a>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
