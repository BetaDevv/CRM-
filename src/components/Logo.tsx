import { motion } from 'framer-motion'
import { useThemeStore } from '../store/useThemeStore'

interface LogoProps {
  collapsed?: boolean
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

export function LogoMark({ size = 'md', animate = false }: { size?: 'sm' | 'md' | 'lg'; animate?: boolean }) {
  const dim = size === 'sm' ? 28 : size === 'lg' ? 52 : 36
  const { theme } = useThemeStore()
  const src = theme === 'light' ? '/logo-n-black.png' : '/logo-n-white.png'

  const Wrapper = animate ? motion.div : 'div'
  const animProps = animate ? {
    whileHover: { scale: 1.08 },
    transition: { duration: 0.3, ease: 'easeOut' as const },
  } : {}

  return (
    <Wrapper {...animProps} style={{ display: 'inline-block' }}>
      <img src={src} alt="NextGenCRM" width={dim} height={dim} className="object-contain" />
    </Wrapper>
  )
}

export function LogoFull({ collapsed = false, size = 'md' }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} animate />
      {!collapsed && (
        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-white font-black text-sm leading-none tracking-tight">
            NextGen<span className="text-crimson-400">CRM</span>
          </p>
        </motion.div>
      )}
    </div>
  )
}

export function LogoLogin() {
  const { theme } = useThemeStore()
  const fullSrc = theme === 'light' ? '/logo-full-black.png' : '/logo-full-white.png'

  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 100, delay: 0.2 }}
      >
        <img src={fullSrc} alt="Nextgenbrand" className="h-8 object-contain" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <h1 className="text-3xl font-black text-white tracking-tight">
          NextGen<span className="text-crimson-400">CRM</span>
        </h1>
        <p className="text-ink-400 text-[11px] tracking-[0.2em] uppercase mt-1.5">by Nextgenbrand</p>
      </motion.div>
    </div>
  )
}

export default LogoFull
