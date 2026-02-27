import { useEffect, useState } from 'react'
import type { GoalRow } from '@/lib/storage'
import styles from './EditRowModal.module.css'

export type GoalField = keyof Omit<GoalRow, 'id'>

export type EditRowField = {
  key: GoalField
  label: string
  placeholder: string
  multiline?: boolean
}

export type EditRowModalProps = {
  open: boolean
  title: string
  row: GoalRow | null
  fields: EditRowField[]
  onSave: (draft: GoalRow) => void
  onCancel: () => void
}

export function EditRowModal({
  open,
  title,
  row,
  fields,
  onSave,
  onCancel,
}: EditRowModalProps) {
  const [draft, setDraft] = useState<GoalRow | null>(null)

  useEffect(() => {
    if (open && row) {
      setDraft({ ...row })
    } else {
      setDraft(null)
    }
  }, [open, row])

  const update = (key: GoalField, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (draft) onSave(draft)
  }

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-row-modal-title"
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <h2 id="edit-row-modal-title" className={styles.title}>
          {title}
        </h2>
        <form id="edit-row-form" onSubmit={handleSubmit} className={styles.formWrap}>
          {fields.map((field) => (
            <div key={field.key} className={styles.field}>
              <label htmlFor={`edit-${field.key}`} className={styles.label}>
                {field.label}
              </label>
              {field.multiline ? (
                <textarea
                  id={`edit-${field.key}`}
                  className={styles.textarea}
                  value={draft?.[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(e) => update(field.key, e.target.value)}
                  aria-label={field.label}
                />
              ) : (
                <input
                  type="text"
                  id={`edit-${field.key}`}
                  className={styles.input}
                  value={draft?.[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(e) => update(field.key, e.target.value)}
                  aria-label={field.label}
                />
              )}
            </div>
          ))}
        </form>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            Отмена
          </button>
          <button
            type="submit"
            form="edit-row-form"
            className={`${styles.btn} ${styles.btnSave}`}
            disabled={!draft}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
