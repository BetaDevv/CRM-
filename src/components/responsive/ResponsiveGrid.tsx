import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Cols = { sm?: number; md?: number; lg?: number; xl?: number }
type Gap = 'sm' | 'md' | 'lg'

export type ResponsiveGridProps = {
  children: ReactNode
  /** Columnas por breakpoint. Default: { sm:1, md:2, lg:3, xl:4 }. */
  cols?: Cols
  gap?: Gap
  className?: string
}

/**
 * Tailwind no permite interpolación dinámica de `sm:grid-cols-${n}`.
 * Usamos mapas estáticos por breakpoint con un rango razonable (1–6).
 */
const smMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
}

const mdMap: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
}

const lgMap: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

const xlMap: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
}

const gapMap: Record<Gap, string> = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
}

const DEFAULT_COLS: Required<Cols> = { sm: 1, md: 2, lg: 3, xl: 4 }

function ResponsiveGrid({
  children,
  cols,
  gap = 'md',
  className,
}: ResponsiveGridProps) {
  const merged: Required<Cols> = { ...DEFAULT_COLS, ...cols }

  // Base = columnas mobile (sm), pero `grid-cols-1` no lleva prefijo `sm:`.
  // Para sm=1 usamos `grid-cols-1`; para sm>1 usamos el prefijo `sm:`.
  const smClass =
    merged.sm === 1 ? 'grid-cols-1' : (smMap[merged.sm] ?? 'sm:grid-cols-2')

  const mdClass = mdMap[merged.md] ?? 'md:grid-cols-2'
  const lgClass = lgMap[merged.lg] ?? 'lg:grid-cols-3'
  const xlClass = xlMap[merged.xl] ?? 'xl:grid-cols-4'

  return (
    <div className={cn('grid', smClass, mdClass, lgClass, xlClass, gapMap[gap], className)}>
      {children}
    </div>
  )
}

export default ResponsiveGrid
export { ResponsiveGrid }
