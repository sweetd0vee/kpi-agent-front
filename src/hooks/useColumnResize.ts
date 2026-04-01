import { useCallback, useRef, useState } from 'react'

type ColumnResizeOptions = {
  minWidth?: number
  maxWidth?: number
}

/**
 * Перетаскивание границы заголовка колонки для изменения ширины (таблицы целей).
 */
export function useColumnResize(editingRowId: string | null, options?: ColumnResizeOptions) {
  const minWidth = options?.minWidth ?? 60
  const maxWidth = options?.maxWidth ?? 1200
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const resizeStateRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)

  const startColumnResize = useCallback(
    (key: string, e: React.MouseEvent<HTMLDivElement>) => {
      if (editingRowId) return
      e.preventDefault()
      e.stopPropagation()

      const thEl = e.currentTarget.parentElement as HTMLElement | null
      const startWidth = thEl?.getBoundingClientRect().width ?? 120

      resizeStateRef.current = { key, startX: e.clientX, startWidth }

      const onMouseMove = (ev: MouseEvent) => {
        const state = resizeStateRef.current
        if (!state) return
        const dx = ev.clientX - state.startX
        const next = Math.max(minWidth, Math.min(maxWidth, state.startWidth + dx))
        setColWidths((prev) => ({ ...prev, [state.key]: next }))
      }

      const onMouseUp = () => {
        resizeStateRef.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [editingRowId, minWidth, maxWidth]
  )

  return { colWidths, startColumnResize }
}
