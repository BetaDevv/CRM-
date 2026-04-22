import { motion } from 'framer-motion'

export interface CreatorBadgeProps {
  name?: string | null
  avatar?: string | null
  size?: 'sm' | 'md'
  variant?: 'compact' | 'full'
  className?: string
}

/**
 * Small horizontal badge showing who created/uploaded a given object.
 * - `compact` variant renders just the first token of the name (e.g., "Hans").
 * - `full` renders the complete name.
 * Renders nothing when `name` is falsy so it tolerates legacy objects
 * that came in before the backend started returning creator info.
 */
export default function CreatorBadge({
  name,
  avatar,
  size = 'sm',
  variant = 'compact',
  className = '',
}: CreatorBadgeProps) {
  if (!name) return null

  const displayName = variant === 'compact' ? name.split(' ')[0] : name
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  const isSm = size === 'sm'
  const dim = isSm ? 'w-5 h-5' : 'w-7 h-7'
  const textCls = isSm ? 'text-[11px]' : 'text-sm'
  const initialCls = isSm ? 'text-[10px]' : 'text-xs'

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      title={name}
      className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}
    >
      <span
        className={`${dim} rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-ink-700 text-ink-200 font-semibold ${initialCls}`}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </span>
      <span className={`${textCls} text-ink-300 truncate`}>{displayName}</span>
    </motion.span>
  )
}
