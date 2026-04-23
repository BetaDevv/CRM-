import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Inline horizontal-axis modifier (replaces @dnd-kit/modifiers which isn't installed).
 * Keeps the dragged item locked to the X axis.
 */
const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
})

export interface ClientStripProps<T> {
  /** Already-filtered list (e.g. only active clients). Order defines render order. */
  clients: T[]
  /** Currently selected client id. */
  selectedId: string
  /** Called when user clicks a chip. */
  onSelect: (id: string) => void
  /** Extracts stable id from a client item. */
  getId: (c: T) => string
  /** Each page renders its own chip markup. */
  renderItem: (c: T, active: boolean) => ReactNode
  /** Parent persists the new order (e.g. reorderClients + setClients). */
  onReorder?: (orderedIds: string[]) => void | Promise<void>
  /** Disable drag-to-reorder for a particular page if needed. Default true. */
  allowReorder?: boolean
  className?: string
}

export function ClientStrip<T>({
  clients,
  selectedId,
  onSelect,
  getId,
  renderItem,
  onReorder,
  allowReorder = true,
  className = '',
}: ClientStripProps<T>) {
  const { t } = useTranslation('admin')
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [items, setItems] = useState<T[]>(clients)

  // Keep local order in sync when parent updates clients (e.g. fetchClients returns new list).
  useEffect(() => {
    setItems(clients)
  }, [clients])

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current
    if (!el) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 2)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2)
  }, [])

  useEffect(() => {
    updateOverflow()
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => updateOverflow()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => updateOverflow())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [updateOverflow, items.length])

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(c => getId(c) === active.id)
    const newIndex = items.findIndex(c => getId(c) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const previous = items
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next) // optimistic local update
    if (!onReorder) return
    try {
      await onReorder(next.map(c => getId(c)))
    } catch (err) {
      // Revert on failure; surface minimal signal.
      setItems(previous)
      // eslint-disable-next-line no-console
      console.warn(t('components.clientStrip.reorderError'), err)
    }
  }

  const ids = items.map(c => getId(c))

  return (
    <div className={`relative ${className}`}>
      {/* Left fade + arrow */}
      {canScrollLeft && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-14 z-10"
            style={{ background: 'linear-gradient(to right, rgba(10,10,10,0.9), rgba(10,10,10,0))' }}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => scrollBy(-1)}
            aria-label={t('components.clientStrip.scrollLeft')}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-ink-900/80 backdrop-blur border border-white/10 text-white flex items-center justify-center shadow-lg hover:bg-ink-800"
          >
            <ChevronLeft size={16} />
          </motion.button>
        </>
      )}

      {/* Right fade + arrow */}
      {canScrollRight && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-14 z-10"
            style={{ background: 'linear-gradient(to left, rgba(10,10,10,0.9), rgba(10,10,10,0))' }}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => scrollBy(1)}
            aria-label={t('components.clientStrip.scrollRight')}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-ink-900/80 backdrop-blur border border-white/10 text-white flex items-center justify-center shadow-lg hover:bg-ink-800"
          >
            <ChevronRight size={16} />
          </motion.button>
        </>
      )}

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-1 scroll-smooth"
      >
        {allowReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
              {items.map(c => {
                const id = getId(c)
                return (
                  <SortableChip
                    key={id}
                    id={id}
                    title={t('components.clientStrip.dragToReorder')}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      className="flex-shrink-0 outline-none"
                    >
                      {renderItem(c, id === selectedId)}
                    </button>
                  </SortableChip>
                )
              })}
            </SortableContext>
          </DndContext>
        ) : (
          items.map(c => {
            const id = getId(c)
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className="flex-shrink-0 outline-none"
              >
                {renderItem(c, id === selectedId)}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Internal: a single sortable chip wrapper ────────────────────────────────
interface SortableChipProps {
  id: string
  title: string
  children: ReactNode
}

function SortableChip({ id, title, children }: SortableChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      title={title}
      className={`flex-shrink-0 ${isDragging ? 'ring-2 ring-white/20 rounded-2xl' : ''}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
