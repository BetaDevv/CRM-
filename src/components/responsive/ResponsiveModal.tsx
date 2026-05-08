import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export type ResponsiveModalProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  size?: ModalSize
  children: ReactNode
  footer?: ReactNode
  className?: string
}

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

function ResponsiveModal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  className,
}: ResponsiveModalProps) {
  // Cerrar con tecla Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Lock scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="responsive-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            key="responsive-modal-card"
            role="dialog"
            aria-modal="true"
            className={cn(
              'glass-card relative w-full mx-4 max-h-[90vh] overflow-y-auto thin-scrollbar p-6',
              sizeMap[size],
              className,
            )}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {title !== undefined && (
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="text-ink-400 hover:text-white transition-colors p-1 -m-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="text-sm text-ink-100">{children}</div>

            {footer !== undefined && (
              <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap gap-2 justify-end">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ResponsiveModal
export { ResponsiveModal }
