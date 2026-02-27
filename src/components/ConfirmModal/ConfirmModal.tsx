import { useEffect, useRef, useState } from 'react'
import styles from './ConfirmModal.module.css'

export type ConfirmModalProps = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmModal({
  open,
  title = 'Подтверждение',
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmModalProps) {
  const [closing, setClosing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) setClosing(false)
  }, [open])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleClose = (action: 'confirm' | 'cancel') => {
    setClosing(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (action === 'confirm') onConfirm()
      else onCancel()
    }, 200)
  }

  if (!open) return null

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.overlayOut : ''}`}
      onClick={() => !closing && handleClose('cancel')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id="confirm-modal-title" className={styles.title}>
            {title}
          </h2>
        )}
        <p id="confirm-modal-desc" className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnCancel}`}
            onClick={() => handleClose('cancel')}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${danger ? styles.btnConfirm : ''}`}
            onClick={() => handleClose('confirm')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
