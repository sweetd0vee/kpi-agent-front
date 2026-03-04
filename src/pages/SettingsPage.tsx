import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getTemplateDocuments,
  getDocument,
  processTemplateDocument,
  submitTemplateChecklist,
  uploadTemplateDocument,
  type DepartmentChecklistItem,
  type TemplateDocumentTypeId,
  type DocumentMeta,
} from '@/api/documents'
import { TemplateChecklistModal, type TemplateChecklistState } from './TemplateChecklistModal'
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

const TEMPLATE_EXTENSIONS = ['.docx', '.txt']

function normalizeChecklistItems(raw: unknown): DepartmentChecklistItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>
    return {
      id: String(obj.id ?? '').trim(),
      text: String(obj.text ?? '').trim(),
      section: String(obj.section ?? '').trim(),
      checked: Boolean(obj.checked),
    }
  })
}

function getTemplateTitle(typeId: TemplateDocumentTypeId): string {
  const label = TEMPLATE_SLOTS.find((slot) => slot.id === typeId)?.label ?? 'Чеклист'
  return `Чеклист: ${label}`
}

function buildTemplateParsedJson(state: TemplateChecklistState): Record<string, unknown> {
  const items = state.items.map((item) => ({
    id: String(item.id ?? '').trim(),
    text: String(item.text ?? '').trim(),
    section: String(item.section ?? '').trim(),
    checked: Boolean(item.checked),
  }))
  if (state.mode === 'rules') {
    return { rules: items }
  }
  const sections: string[] = []
  const seen = new Set<string>()
  items.forEach((item) => {
    const section = item.section?.trim()
    if (section && !seen.has(section)) {
      seen.add(section)
      sections.push(section)
    }
  })
  return { sections, items }
}

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
  const [templateChecklist, setTemplateChecklist] = useState<TemplateChecklistState | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const abortRef = useRef<AbortController | null>(null)
  const preprocessAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!templateChecklist?.loading) return
    const id = setInterval(() => {
      setTemplateChecklist((prev) => {
        if (!prev?.loading) return prev
        const next = Math.min((prev.loadingProgress ?? 0) + 8, 90)
        return next === (prev.loadingProgress ?? 0) ? prev : { ...prev, loadingProgress: next }
      })
    }, 800)
    return () => clearInterval(id)
  }, [templateChecklist?.loading])

  const loadTemplates = useCallback(async (signal?: AbortSignal) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const s = signal ?? controller.signal
    setError(null)
    setLoading(true)
    try {
      const data = await getTemplateDocuments(s)
      if (!s.aborted) setTemplateDocs(data)
    } catch (e) {
      if (!s.aborted) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки')
      }
    } finally {
      if (!s.aborted) setLoading(false)
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadTemplates(controller.signal)
    return () => {
      controller.abort()
      abortRef.current?.abort()
    }
  }, [loadTemplates])

  const updateTemplateDoc = useCallback((doc: DocumentMeta) => {
    setTemplateDocs((prev) => ({ ...prev, [doc.document_type]: doc }))
  }, [])

  const openTemplateChecklistForDoc = useCallback(
    async (doc: DocumentMeta, typeId: TemplateDocumentTypeId, forceProcess = false) => {
      const mode: TemplateChecklistState['mode'] = typeId === 'reglament_checklist' ? 'rules' : 'items'
      preprocessAbortRef.current?.abort()
      const controller = new AbortController()
      preprocessAbortRef.current = controller
      const { signal } = controller
      setTemplateChecklist({
        documentId: doc.id,
        documentName: doc.name,
        documentType: typeId,
        title: getTemplateTitle(typeId),
        mode,
        items: [],
        loading: true,
        loadingProgress: 0,
      })
      try {
        let parsed: Record<string, unknown> | undefined
        if (!forceProcess && doc.preprocessed) {
          const full = await getDocument(doc.id, true, signal)
          parsed = full.parsed_json as Record<string, unknown> | undefined
        }
        if (!parsed) {
          const prep = await processTemplateDocument(doc.id, signal)
          if (prep.error) {
            setTemplateChecklist((prev) =>
              prev ? { ...prev, loading: false, error: prep.error ?? 'Ошибка обработки' } : null
            )
            return
          }
          parsed = prep.parsed_json as Record<string, unknown> | undefined
          if (prep.preprocessed) updateTemplateDoc({ ...doc, preprocessed: true })
        }
        if (!parsed || typeof parsed !== 'object') {
          setTemplateChecklist((prev) =>
            prev ? { ...prev, loading: false, error: 'LLM не вернул данные для проверки' } : null
          )
          return
        }
        const itemsSource =
          typeId === 'reglament_checklist'
            ? (parsed as { rules?: unknown }).rules
            : (parsed as { items?: unknown }).items
        const items = normalizeChecklistItems(itemsSource)
        setTemplateChecklist((prev) =>
          prev ? { ...prev, loading: false, items, error: undefined } : null
        )
        updateTemplateDoc({ ...doc, preprocessed: true })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return
        }
        setTemplateChecklist((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: e instanceof Error ? e.message : 'Ошибка обработки документа',
              }
            : null
        )
      } finally {
        if (preprocessAbortRef.current === controller) preprocessAbortRef.current = null
      }
    },
    [updateTemplateDoc]
  )

  const toggleTemplateChecklistItem = useCallback((index: number) => {
    setTemplateChecklist((prev) => {
      if (!prev) return null
      const next = [...prev.items]
      next[index] = { ...next[index], checked: !next[index].checked }
      return { ...prev, items: next }
    })
  }, [])

  const updateTemplateChecklistItem = useCallback(
    (index: number, field: keyof DepartmentChecklistItem, value: string | boolean) => {
      setTemplateChecklist((prev) => {
        if (!prev) return null
        const next = [...prev.items]
        next[index] = { ...next[index], [field]: value }
        return { ...prev, items: next }
      })
    },
    []
  )

  const addTemplateChecklistItem = useCallback(() => {
    setTemplateChecklist((prev) => {
      if (!prev) return null
      return {
        ...prev,
        items: [...prev.items, { id: '', text: '', section: '', checked: false }],
      }
    })
  }, [])

  const removeTemplateChecklistItem = useCallback((index: number) => {
    setTemplateChecklist((prev) => {
      if (!prev) return null
      const next = prev.items.filter((_, i) => i !== index)
      return { ...prev, items: next }
    })
  }, [])

  const submitTemplateChecklistHandler = useCallback(async () => {
    if (!templateChecklist) return
    setTemplateChecklist((prev) => (prev ? { ...prev, submitting: true, error: undefined } : null))
    try {
      const parsedJson = buildTemplateParsedJson(templateChecklist)
      const updated = await submitTemplateChecklist(templateChecklist.documentId, parsedJson)
      updateTemplateDoc(updated)
      setTemplateChecklist(null)
    } catch (e) {
      setTemplateChecklist((prev) =>
        prev
          ? {
              ...prev,
              submitting: false,
              error: e instanceof Error ? e.message : 'Ошибка сохранения',
            }
          : null
      )
    }
  }, [templateChecklist, updateTemplateDoc])

  const handleUpload = useCallback(
    async (typeId: TemplateDocumentTypeId, file: File) => {
      setError(null)
      const lowerName = file.name.toLowerCase()
      const ext = lowerName.includes('.') ? `.${lowerName.split('.').pop()}` : ''
      if (!TEMPLATE_EXTENSIONS.includes(ext)) {
        setError('Файл должен быть в формате .docx или .txt')
        return
      }
      setUploading(typeId)
      try {
        const doc = await uploadTemplateDocument(typeId, file)
        updateTemplateDoc(doc)
        await openTemplateChecklistForDoc(doc, typeId, true)
      } catch (e) {
        setError(e instanceof Error ? e.message : `Ошибка загрузки: ${file.name}`)
      } finally {
        setUploading(null)
      }
    },
    [openTemplateChecklistForDoc, updateTemplateDoc]
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

  const onRetry = useCallback(() => {
    setError(null)
    loadTemplates()
  }, [loadTemplates])

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
          <span>{error}</span>
          <button type="button" className={styles.retryButton} onClick={onRetry}>
            Повторить
          </button>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Стандартные документы</h2>
        <p className={styles.sectionDesc}>
          Загрузите каждый документ один раз. Форматы: DOCX или TXT.
        </p>
        {loading ? (
          <div className={styles.loadingWrap}>
            <div className={styles.loadingSpinner} aria-hidden />
            <p className={styles.loading}>Загрузка списка документов…</p>
          </div>
        ) : (
          <ul className={styles.cards}>
            {TEMPLATE_SLOTS.map((slot) => {
              const doc = templateDocs[slot.id] ?? null
              const isUploading = uploading === slot.id
              const isProcessing =
                !!doc &&
                templateChecklist?.documentId === doc.id &&
                (templateChecklist.loading || templateChecklist.submitting)
              const isBusy = isUploading || isProcessing
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
                      accept=".docx,.txt"
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
                          {doc.preprocessed && <span className={styles.cardJsonBadge}>JSON</span>}
                        </span>
                        <div className={styles.cardFileActions}>
                          <button
                            type="button"
                            className={styles.cardActionBtn}
                            onClick={() => openTemplateChecklistForDoc(doc, slot.id)}
                            disabled={isBusy}
                            title="Проверить JSON"
                          >
                            {doc.preprocessed ? 'Проверить JSON' : 'Обработать'}
                          </button>
                          {doc.preprocessed && (
                            <button
                              type="button"
                              className={styles.cardActionBtnGhost}
                              onClick={() => openTemplateChecklistForDoc(doc, slot.id, true)}
                              disabled={isBusy}
                              title="Повторно обработать через LLM"
                            >
                              Переобработать
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.cardReplace}
                            onClick={() => fileInputRefs.current[slot.id]?.click()}
                            disabled={isBusy}
                            title="Заменить файл"
                          >
                            {isUploading ? 'Загрузка…' : 'Заменить'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.cardAttach}
                        onClick={() => fileInputRefs.current[slot.id]?.click()}
                        disabled={isBusy}
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
        )}
      </section>

      {templateChecklist && (
        <TemplateChecklistModal
          state={templateChecklist}
          actions={{
            onClose: () => setTemplateChecklist(null),
            cancelProcessing: () => {
              preprocessAbortRef.current?.abort()
              preprocessAbortRef.current = null
              setTemplateChecklist(null)
            },
            toggleItem: toggleTemplateChecklistItem,
            updateItem: updateTemplateChecklistItem,
            addItem: addTemplateChecklistItem,
            removeItem: removeTemplateChecklistItem,
            submit: submitTemplateChecklistHandler,
          }}
        />
      )}
    </div>
  )
}
