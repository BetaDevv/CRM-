import { motion } from 'framer-motion'

interface LogoProps {
  collapsed?: boolean
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

export function LogoMark({ size = 'md', animate = false }: { size?: 'sm' | 'md' | 'lg'; animate?: boolean }) {
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36

  const Wrapper = animate ? motion.div : 'div'
  const animProps = animate ? {
    whileHover: { rotate: 360, scale: 1.05 },
    transition: { duration: 0.6, ease: 'backOut' as const },
  } : {}

  return (
    <Wrapper {...animProps} style={{ display: 'inline-block' }}>
      <svg width={dim} height={dim} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer diamond */}
        <path d="M18 1 L35 18 L18 35 L1 18 Z" fill="#DC143C" />
        {/* Inner glow */}
        <path d="M18 4 L32 18 L18 32 L4 18 Z" fill="#A50E2D" />
        {/* Lightning bolt */}
        <path
          d="M21 8 L14 20 L19.5 20 L15 28 L24 16 L18.5 16 Z"
          fill="white"
        />
        {/* Top highlight */}
        <path d="M18 1 L35 18 L18 4 L1 18 Z" fill="rgba(255,255,255,0.12)" />
      </svg>
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
            The<span className="text-crimson-400">Branding</span>
          </p>
          <p className="text-ink-300 text-xs font-semibold tracking-widest uppercase leading-tight">
            Studio
          </p>
        </motion.div>
      )}
    </div>
  )
}

export function LogoLogin() {
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 100, delay: 0.2 }}
      >
        <LogoMark size="lg" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <h1 className="text-2xl font-black text-white tracking-tight">
          The<span className="text-crimson-400">Branding</span>Studio
        </h1>
        <p className="text-ink-400 text-xs tracking-widest uppercase mt-0.5">CRM Platform</p>
      </motion.div>
    </div>
  )
}

export default LogoFull
