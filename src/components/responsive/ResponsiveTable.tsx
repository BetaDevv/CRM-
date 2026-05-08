import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type ColumnDef<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Clase opcional aplicada al `<th>` y `<td>` correspondiente en desktop. */
  className?: string
  /** Si es true, la columna se omite en la vista mobile (cards). */
  hideOnMobile?: boolean
}

export type ResponsiveTableProps<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  rowKey: (row: T) => string
  /** Override custom para el render de cada fila en mobile. */
  renderMobileCard?: (row: T) => ReactNode
  emptyState?: ReactNode
  className?: string
}

function ResponsiveTable<T>({
  data,
  columns,
  rowKey,
  renderMobileCard,
  emptyState,
  className,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn('text-center text-ink-400 py-8 text-sm', className)}>
        {emptyState ?? 'Sin resultados'}
      </div>
    )
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile)

  return (
    <div className={className}>
      {/* Mobile: cards stacked (<lg) */}
      <div className="lg:hidden">
        {data.map((row) => {
          const key = rowKey(row)
          if (renderMobileCard) {
            return (
              <div key={key} className="mb-3">
                {renderMobileCard(row)}
              </div>
            )
          }
          return (
            <div key={key} className="glass-card p-4 mb-3">
              {mobileColumns.map((c) => (
                <div
                  key={c.key}
                  className="flex justify-between gap-3 py-1.5 text-sm border-b border-white/5 last:border-0"
                >
                  <span className="text-ink-400 shrink-0">{c.header}</span>
                  <span className="text-white font-medium text-right break-words min-w-0">
                    {c.cell(row)}
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Desktop: tabla clásica (≥lg) */}
      <div className="hidden lg:block overflow-x-auto thin-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-400 border-b border-white/10">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-3 py-2 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-white/5 hover:bg-ink-800/40 transition-colors"
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-3 text-white', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ResponsiveTable
export { ResponsiveTable }
