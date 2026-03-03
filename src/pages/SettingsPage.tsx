import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getTemplateDocuments,
  uploadTemplateDocument,
  type TemplateDocumentTypeId,
  type DocumentMeta,
} from '@/api/documents'
import styles from './SettingsPage.module.css'

const TEMPLATE_SLOTS: { id: TemplateDocumentTypeId; label: string }[] = [
  { id: 'business_plan_checklist', label: 'Бизнес-план' },
  { id: 'strategy_checklist', label: 'Стратегия' },
  { id: 'reglament_checklist', label: 'Регламент' },
]

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

export function SettingsPage() {
  const [templateDocs, setTemplateDocs] = useState<Record<string, DocumentMeta | null>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>>({})

  const loadTemplates = useCallback(async () => {
    setError(null)
    try {
      const data = await getTemplateDocuments()
      setTemplateDocs(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleUpload = useCallback(
    async (typeId: TemplateDocumentTypeId, file: File) => {
      setError(null)
      setUploading(typeId)
      try {
        const doc = await uploadTemplateDocument(typeId, file)
        setTemplateDocs((prev) => ({ ...prev, [typeId]: doc }))
      } catch (e) {
        setError(e instanceof Error ? e.message : `Ошибка загрузки: ${file.name}`)
      } finally {
        setUploading(null)
      }
    },
    []
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Загрузка настроек…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Настройки</h1>
        <p className={styles.subtitle}>
          Бизнес-план, Стратегия и Регламент загружаются один раз в году в правильном формате.
          Они автоматически подставляются в каждую новую коллекцию на вкладке «База знаний».
        </p>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Шаблонные документы</h2>
        <div className={styles.slotsGrid}>
          {TEMPLATE_SLOTS.map((slot) => {
            const doc = templateDocs[slot.id] ?? null
            const isUploading = uploading === slot.id
            return (
              <div key={slot.id} className={styles.cell}>
                <div className={styles.cellTop}>
                  <div className={styles.cellIcon}>
                    <PaperclipIcon />
                  </div>
                  <span className={styles.cellLabel}>{slot.label}</span>
                </div>
                <input
                  ref={(el) => { fileInputRefs.current[slot.id] = el }}
                  type="file"
                  className={styles.hiddenInput}
                  accept=".pdf,.docx,.xlsx,.xls,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(slot.id, f)
                    e.target.value = ''
                  }}
                />
                {doc ? (
                  <div className={styles.cellFile}>
                    <span className={styles.cellFileName} title={doc.name}>
                      {doc.name}
                    </span>
                    <button
                      type="button"
                      className={styles.cellReplace}
                      onClick={() => fileInputRefs.current[slot.id]?.click()}
                      disabled={isUploading}
                      title="Заменить файл"
                    >
                      {isUploading ? '…' : 'Заменить'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.cellAttach}
                    onClick={() => fileInputRefs.current[slot.id]?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Загрузка…' : 'Прикрепить файл'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
