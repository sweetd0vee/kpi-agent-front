import { useEffect, useState } from 'react'
import styles from '../EditRowModal/EditRowModal.module.css'

export type RegistryRowField<Row extends { id: string }> = {
  key: keyof Omit<Row, 'id'> & string
  label: string
  placeholder: string
  multiline?: boolean
}

export type EditRegistryRowModalProps<Row extends { id: string }> = {
  open: boolean
  title: string
  row: Row | null
  fields: RegistryRowField<Row>[]
  formId: string
  ariaTitleId: string
  fieldIdPrefix: string
  onSave: (draft: Row) => void
  onCancel: () => void
}

export function EditRegistryRowModal<Row extends { id: string }>({
  open,
  title,
  row,
  fields,
  formId,
  ariaTitleId,
  fieldIdPrefix,
  onSave,
  onCancel,
}: EditRegistryRowModalProps<Row>) {
  const [draft, setDraft] = useState<Row | null>(null)

  useEffect(() => {
    if (open && row) setDraft({ ...row })
    else setDraft(null)
  }, [open, row])

  const update = (key: keyof Omit<Row, 'id'>, value: string) => {
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
      aria-labelledby={ariaTitleId}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <h2 id={ariaTitleId} className={styles.title}>
          {title}
        </h2>
        <form id={formId} onSubmit={handleSubmit} className={styles.formWrap}>
          {fields.map((field) => (
            <div key={String(field.key)} className={styles.field}>
              <label htmlFor={`${fieldIdPrefix}-${String(field.key)}`} className={styles.label}>
                {field.label}
              </label>
              <textarea
                id={`${fieldIdPrefix}-${String(field.key)}`}
                className={field.multiline ? styles.textarea : styles.textareaSingle}
                value={draft?.[field.key] != null ? String(draft[field.key]) : ''}
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
          <button type="submit" form={formId} className={`${styles.btn} ${styles.btnSave}`} disabled={!draft}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
