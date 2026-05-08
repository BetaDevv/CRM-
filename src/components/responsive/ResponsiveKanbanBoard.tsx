import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type ResponsiveKanbanBoardProps = {
  children: ReactNode
  /** Cantidad de columnas a renderizar en desktop (≥lg). */
  columnCount: number
  className?: string
}

/**
 * Map fijo de columnas → clase Tailwind.
 * Tailwind no permite interpolación dinámica de `lg:grid-cols-${n}`,
 * por eso el switch manual. Cae a `lg:grid-cols-4` si la cuenta cae
 * fuera del rango soportado.
 */
const lgGridMap: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

function ResponsiveKanbanBoard({ children, columnCount, className }: ResponsiveKanbanBoardProps) {
  const lgGridClass = lgGridMap[columnCount] ?? 'lg:grid-cols-4'

  return (
    <div
      className={cn(
        // Mobile: scroll horizontal con snap. Las columnas hijas controlan su propio min-w.
        'flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 thin-scrollbar',
        // Desktop: grid fijo, sin scroll horizontal ni snap.
        'lg:grid lg:overflow-visible lg:snap-none lg:gap-4 lg:pb-0',
        lgGridClass,
        className,
      )}
    >
      {children}
    </div>
  )
}

export default ResponsiveKanbanBoard
export { ResponsiveKanbanBoard }
