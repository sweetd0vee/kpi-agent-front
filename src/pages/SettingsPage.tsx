import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import * as XLSX from 'xlsx'
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
import { downloadJsonFile } from '@/lib/downloadJson'
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

type KpiRefRow = { id: string; name: string; unit: string }

const KPI_REF_KEY = 'kpi-ref-registry'

function loadKpiRef(): KpiRefRow[] {
  try {
    const raw = localStorage.getItem(KPI_REF_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as KpiRefRow[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveKpiRef(rows: KpiRefRow[]): void {
  localStorage.setItem(KPI_REF_KEY, JSON.stringify(rows))
}

const KPI_REF_HEADER_MAP: Record<string, 'name' | 'unit'> = {
  'Наименование количественного КПЭ': 'name',
  'Наименование КПЭ': 'name',
  'КПЭ': 'name',
  'Ед. измерения': 'unit',
  'ед. изм.': 'unit',
  'Единица измерения': 'unit',
}

function parseKpiRefXlsx(file: File): Promise<KpiRefRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Не удалось прочитать файл'))
          return
        }
        const wb = XLSX.read(data, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        if (!sheetName) { reject(new Error('В файле нет листов')); return }
        const rawRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, defval: '', raw: false }) as unknown[][]
        if (!Array.isArray(rawRows) || rawRows.length < 2) { resolve([]); return }

        const headers = rawRows[0].map((h) => String(h ?? '').trim())
        const colMap = new Map<number, 'name' | 'unit'>()
        headers.forEach((h, i) => { const field = KPI_REF_HEADER_MAP[h]; if (field) colMap.set(i, field) })

        const result: KpiRefRow[] = []
        for (let i = 1; i < rawRows.length; i++) {
          const cells = rawRows[i] as unknown[]
          const row: Record<string, string> = { name: '', unit: '' }
          colMap.forEach((field, idx) => { row[field] = String(cells[idx] ?? '').trim() })
          if (row.name || row.unit) {
            result.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, name: row.name, unit: row.unit })
          }
        }
        resolve(result)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Ошибка разбора xlsx'))
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
}

function KpiReferenceSection() {
  const [rows, setRows] = useState<KpiRefRow[]>(loadKpiRef)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const persist = (next: KpiRefRow[]) => {
    setRows(next)
    saveKpiRef(next)
  }

  const handleImportClick = () => {
    setImportError(null)
    importInputRef.current?.click()
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) {
      setImportError('Выберите файл .xlsx')
      return
    }
    parseKpiRefXlsx(file)
      .then((imported) => {
        if (imported.length === 0) {
          setImportError('В файле нет данных. Ожидаемые заголовки: «Наименование количественного КПЭ», «Ед. измерения».')
          return
        }
        persist([...rows, ...imported])
        setImportError(null)
      })
      .catch((err) => setImportError(err instanceof Error ? err.message : 'Ошибка загрузки файла'))
  }

  const startEdit = (row: KpiRefRow) => {
    setEditId(row.id)
    setEditName(row.name)
    setEditUnit(row.unit)
  }

  const saveEdit = () => {
    if (!editId) return
    persist(rows.map((r) => (r.id === editId ? { ...r, name: editName, unit: editUnit } : r)))
    setEditId(null)
  }

  const cancelEdit = () => setEditId(null)

  const removeRow = (id: string) => {
    persist(rows.filter((r) => r.id !== id))
    if (editId === id) setEditId(null)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Реестр количественных КПЭ</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={handleImportClick}
            style={{ padding: '0.45rem 0.875rem', fontSize: '0.8125rem', fontWeight: 500, background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Импортировать
          </button>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => persist([])}
              style={{ padding: '0.45rem 0.875rem', fontSize: '0.8125rem', fontWeight: 500, color: '#1e3a8a', background: 'transparent', border: '1px solid #1e3a8a', borderRadius: '8px', cursor: 'pointer' }}
            >
              Очистить
            </button>
          )}
        </div>
      </div>

      {importError && (
        <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '0.8125rem' }}>
          {importError}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ background: '#1e3a8a', color: '#fff', padding: '0.5rem 0.75rem', textAlign: 'left', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                Наименование количественного КПЭ
              </th>
              <th style={{ background: '#1e3a8a', color: '#fff', padding: '0.5rem 0.75rem', textAlign: 'left', border: '1px solid #cbd5e1', fontWeight: 600, width: '180px' }}>
                Ед. измерения
              </th>
              <th style={{ background: '#1e3a8a', color: '#fff', padding: '0.5rem 0.75rem', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 600, width: '100px' }}>
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                  Пока нет записей. Импортируйте данные из xlsx.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                {editId === row.id ? (
                  <>
                    <td style={{ padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0' }}>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8125rem' }}
                        autoFocus
                      />
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0' }}>
                      <input
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8125rem' }}
                      />
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <button type="button" onClick={saveEdit} style={{ marginRight: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        ✓
                      </button>
                      <button type="button" onClick={cancelEdit} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}>
                        ✗
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', wordBreak: 'break-word' }}>
                      {row.name || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0' }}>
                      {row.unit || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <button type="button" onClick={() => startEdit(row)} style={{ marginRight: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}>
                        ✎
                      </button>
                      <button type="button" onClick={() => removeRow(row.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Удалить">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function SettingsPage() {
  const location = useLocation()
  const isStrategyGoals = location.pathname === '/strategy-goals'
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

  const downloadTemplateChecklistJson = useCallback(() => {
    if (!templateChecklist) return
    const parsedJson = buildTemplateParsedJson(templateChecklist)
    const baseName = templateChecklist.documentName || templateChecklist.documentType || 'checklist'
    downloadJsonFile(parsedJson, baseName)
  }, [templateChecklist])

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
        <h1 className={styles.title}>{isStrategyGoals ? 'Цели стратегии' : 'Настройки'}</h1>
        <p className={styles.subtitle}>
          {isStrategyGoals ? (
            <>
              Загрузите документ <strong>«Стратегия»</strong>, чтобы он автоматически подставлялся в новые коллекции на вкладке
              «База знаний».
            </>
          ) : (
            <>
              Здесь загружаются основные документы, которые не меняются в течение года:
              <strong> Бизнес-план</strong>, <strong>Стратегия</strong> и <strong>Регламент</strong>.
              Они автоматически подставляются в каждую новую коллекцию на вкладке «База знаний».
            </>
          )}
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

      {!isStrategyGoals && (
        <section className={styles.section}>
          <KpiReferenceSection />
        </section>
      )}

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
            downloadJson: downloadTemplateChecklistJson,
          }}
        />
      )}
    </div>
  )
}
