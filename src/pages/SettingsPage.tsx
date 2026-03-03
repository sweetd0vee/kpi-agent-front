import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getTemplateDocuments,
  uploadTemplateDocument,
  type TemplateDocumentTypeId,
  type DocumentMeta,
} from '@/api/documents'
import styles from './SettingsPage.module.css'

const TEMPLATE_SLOTS: {
  id: TemplateDocumentTypeId
  label: string
  description: string
  icon: 'plan' | 'strategy' | 'reglament'
}[] = [
  { id: 'business_plan_checklist', label: 'Бизнес-план', description: 'Стандартный документ бизнес-планирования', icon: 'plan' },
  { id: 'strategy_checklist', label: 'Стратегия', description: 'Чеклист по стратегии банка', icon: 'strategy' },
  { id: 'reglament_checklist', label: 'Регламент', description: 'Чеклист по регламенту банка', icon: 'reglament' },
]

function DocIcon({ type }: { type: 'plan' | 'strategy' | 'reglament' }) {
  const className = `${styles.docIcon} ${styles[`docIcon_${type}`]}`
  if (type === 'plan') {
    return (
      <svg className={className} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
      </svg>
    )
  }
  if (type === 'strategy') {
    return (
      <svg className={className} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    )
  }
  return (
    <svg className={className} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" /><path d="M8 11h8" />
    </svg>
  )
}

export function SettingsPage() {
  const [templateDocs, setTemplateDocs] = useState<Record<string, DocumentMeta | null>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  const handleDrop = (typeId: TemplateDocumentTypeId, e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove(styles.cardDragOver)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(typeId, file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add(styles.cardDragOver)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove(styles.cardDragOver)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <div className={styles.loadingSpinner} aria-hidden />
          <p className={styles.loading}>Загрузка настроек…</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Настройки</h1>
        <p className={styles.subtitle}>
          Здесь загружаются стандартные документы, которые не меняются в течение года:
          <strong> Бизнес-план</strong>, <strong>Стратегия</strong> и <strong>Регламент</strong>.
          Они автоматически подставляются в каждую новую коллекцию на вкладке «База знаний».
        </p>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Стандартные документы</h2>
        <p className={styles.sectionDesc}>
          Загрузите каждый документ один раз. Форматы: PDF, DOCX, XLSX, TXT.
        </p>
        <ul className={styles.cards}>
          {TEMPLATE_SLOTS.map((slot) => {
            const doc = templateDocs[slot.id] ?? null
            const isUploading = uploading === slot.id
            return (
              <li key={slot.id} className={styles.card}>
                <div
                  className={`${styles.cardInner} ${doc ? styles.cardFilled : ''}`}
                  onDrop={(e) => handleDrop(slot.id, e)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className={styles.cardHeader}>
                    <DocIcon type={slot.icon} />
                    <div className={styles.cardTitles}>
                      <h3 className={styles.cardLabel}>{slot.label}</h3>
                      <p className={styles.cardDesc}>{slot.description}</p>
                    </div>
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
                    <div className={styles.cardFile}>
                      <span className={styles.cardFileName} title={doc.name}>
                        {doc.name}
                      </span>
                      <button
                        type="button"
                        className={styles.cardReplace}
                        onClick={() => fileInputRefs.current[slot.id]?.click()}
                        disabled={isUploading}
                        title="Заменить файл"
                      >
                        {isUploading ? 'Загрузка…' : 'Заменить'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.cardAttach}
                      onClick={() => fileInputRefs.current[slot.id]?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <span className={styles.cardAttachSpinner} aria-hidden />
                          Загрузка…
                        </>
                      ) : (
                        <>
                          <span className={styles.cardAttachIcon}>+</span>
                          Выберите файл или перетащите сюда
                        </>
                      )}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
