import { useEffect, useState } from 'react'
import type { StrategyGoalRow } from '@/lib/storage'
import styles from '../EditRowModal/EditRowModal.module.css'

export type StrategyGoalField = keyof Omit<StrategyGoalRow, 'id'>

export type EditStrategyGoalField = {
  key: StrategyGoalField
  label: string
  placeholder: string
  multiline?: boolean
}

export type EditStrategyGoalModalProps = {
  open: boolean
  title: string
  row: StrategyGoalRow | null
  fields: EditStrategyGoalField[]
  onSave: (draft: StrategyGoalRow) => void
  onCancel: () => void
}

export function EditStrategyGoalModal({
  open,
  title,
  row,
  fields,
  onSave,
  onCancel,
}: EditStrategyGoalModalProps) {
  const [draft, setDraft] = useState<StrategyGoalRow | null>(null)

  useEffect(() => {
    if (open && row) setDraft({ ...row })
    else setDraft(null)
  }, [open, row])

  const update = (key: StrategyGoalField, value: string) => {
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
      aria-labelledby="edit-strategy-goal-modal-title"
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <h2 id="edit-strategy-goal-modal-title" className={styles.title}>
          {title}
        </h2>
        <form id="edit-strategy-goal-form" onSubmit={handleSubmit} className={styles.formWrap}>
          {fields.map((field) => (
            <div key={field.key} className={styles.field}>
              <label htmlFor={`edit-strategy-${field.key}`} className={styles.label}>
                {field.label}
              </label>
              <textarea
                id={`edit-strategy-${field.key}`}
                className={field.multiline ? styles.textarea : styles.textareaSingle}
                value={draft?.[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(e) => update(field.key, e.target.value)}
                aria-label={field.label}
                rows={field.multiline ? 4 : 1}
              />
            </div>
          ))}
        </form>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            Отмена
          </button>
          <button
            type="submit"
            form="edit-strategy-goal-form"
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
