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
            NextGen<span style={{ color: 'var(--accent-light)' }}>CRM</span>
          </p>
        </motion.div>
      )}
    </div>
  )
}

export function LogoLogin() {
  const { theme } = useThemeStore()
  const src = theme === 'light' ? '/logo-full-black.png' : '/logo-full-white.png'

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 100, delay: 0.2 }}
      >
        <img src={src} alt="Nextgenbrand" className="h-16 w-auto object-contain" />
      </motion.div>
    </div>
  )
}

export default LogoFull
