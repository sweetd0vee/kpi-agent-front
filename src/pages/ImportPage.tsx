import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  generateCollectionJson,
  getDocument,
  listDocuments,
  preprocessDocument,
  submitDocumentChecklist,
  uploadDocument,
  deleteDocument,
  getTemplateDocuments,
  getDepartments,
  getResponsibles,
  processDepartmentRegulation,
  submitDepartmentChecklist,
  type DocumentMeta,
  type CollectionMeta,
  type DepartmentItem,
  type DepartmentChecklistItem,
} from '@/api/documents'
import { PaperclipIcon, PersonIcon } from '@/components/Icons'
import { downloadGoalsTemplate } from '@/lib/exportGoals'
import { downloadJsonFile } from '@/lib/downloadJson'
import { DepartmentChecklistModal } from './Import/DepartmentChecklistModal'
import { PromptsTab } from './Import/PromptsTab'
import { TemplateChecklistModal, type TemplateChecklistState } from './TemplateChecklistModal'
import { SLOT_TYPES, TEMPLATE_SLOT_IDS, createInitialFiles, type SlotTypeId } from './Import/constants'
import styles from './ImportPage.module.css'

const CHECKLIST_LABELS: Record<string, string> = {
  business_plan_checklist: 'Бизнес-план',
  strategy_checklist: 'Стратегия',
  reglament_checklist: 'Регламент',
}

type CollectionCardDraft = {
  name: string
  department: string
  responsibles: string
  summary: string
}

function getChecklistTitle(typeId: string): string {
  const label = CHECKLIST_LABELS[typeId] ?? 'Чеклист'
  return `Чеклист: ${label}`
}

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

function buildChecklistParsedJson(state: TemplateChecklistState): Record<string, unknown> {
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

export function ImportPage() {
  const [collections, setCollections] = useState<CollectionMeta[]>([])
  const [activeTab, setActiveTab] = useState<'collections' | 'prompts'>('collections')
  const [collectionName, setCollectionName] = useState('')
  const [collectionDepartment, setCollectionDepartment] = useState('')
  const [collectionResponsibles, setCollectionResponsibles] = useState('')
  const [collectionSummary, setCollectionSummary] = useState('')
  const [files, setFiles] = useState<Record<SlotTypeId, File | null>>(createInitialFiles)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingJsonId, setGeneratingJsonId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<CollectionCardDraft | null>(null)
  const [deleteConfirmCollection, setDeleteConfirmCollection] = useState<CollectionMeta | null>(null)
  const [docsByCollection, setDocsByCollection] = useState<Record<string, Record<string, DocumentMeta[]>>>({})
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'mine' | 'processed'>('mine')
  const [templateDocs, setTemplateDocs] = useState<Record<string, DocumentMeta | null>>({})
  const [responsiblesOptions, setResponsiblesOptions] = useState<string[]>([])
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentItem[]>([])
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const departmentAbortRef = useRef<AbortController | null>(null)
  const checklistAbortRef = useRef<AbortController | null>(null)
  // Модальное окно валидации чеклиста по положению о департаменте
  const [departmentChecklist, setDepartmentChecklist] = useState<{
    documentId: string
    collectionId: string
    documentName: string
    department: string
    goals: DepartmentChecklistItem[]
    tasks: DepartmentChecklistItem[]
    loading?: boolean
    loadingProgress?: number
    error?: string
    submitting?: boolean
  } | null>(null)
  const [documentChecklist, setDocumentChecklist] = useState<(TemplateChecklistState & { collectionId: string }) | null>(
    null
  )

  const loadCollections = useCallback(async () => {
    try {
      const list = await getCollections()
      setCollections(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить коллекции')
    }
  }, [])

  const loadDocumentsForCollection = useCallback(async (collectionId: string) => {
    try {
      const res = await listDocuments(undefined, collectionId)
      const by: Record<string, DocumentMeta[]> = {}
      SLOT_TYPES.forEach((s) => (by[s.id] = []))
      res.items.forEach((d) => {
        if (by[d.document_type]) by[d.document_type].push(d)
      })
      Object.keys(by).forEach((key) => {
        by[key].sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))
      })
      setDocsByCollection((prev) => ({ ...prev, [collectionId]: by }))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    setError(null)
    loadCollections()
  }, [loadCollections])

  useEffect(() => {
    let active = true
    getResponsibles()
      .then((items) => {
        if (!active) return
        setResponsiblesOptions(items)
      })
      .catch(() => {
        if (!active) return
        setResponsiblesOptions([])
      })
    getDepartments()
      .then((items) => {
        if (!active) return
        setDepartmentOptions(items)
      })
      .catch(() => {
        if (!active) return
        setDepartmentOptions([])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    collections.forEach((c) => loadDocumentsForCollection(c.id))
  }, [collections, loadDocumentsForCollection])

  const loadTemplateDocs = useCallback(async () => {
    try {
      const data = await getTemplateDocuments()
      setTemplateDocs(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadTemplateDocs()
  }, [loadTemplateDocs])

  // Прогресс загрузки при обработке документа LLM (индикативный, до 90% пока ждём ответа)
  useEffect(() => {
    if (!departmentChecklist?.loading) return
    const id = setInterval(() => {
      setDepartmentChecklist((prev) => {
        if (!prev?.loading) return prev
        const next = Math.min((prev.loadingProgress ?? 0) + 8, 90)
        return next === (prev.loadingProgress ?? 0) ? prev : { ...prev, loadingProgress: next }
      })
    }, 800)
    return () => clearInterval(id)
  }, [departmentChecklist?.loading])

  useEffect(() => {
    if (!documentChecklist?.loading) return
    const id = setInterval(() => {
      setDocumentChecklist((prev) => {
        if (!prev?.loading) return prev
        const next = Math.min((prev.loadingProgress ?? 0) + 8, 90)
        return next === (prev.loadingProgress ?? 0) ? prev : { ...prev, loadingProgress: next }
      })
    }, 800)
    return () => clearInterval(id)
  }, [documentChecklist?.loading])

  const setFile = (typeId: SlotTypeId, file: File | null) => {
    setFiles((prev) => ({ ...prev, [typeId]: file }))
  }

  const handleCreate = useCallback(async () => {
    const name = collectionName.trim() || 'Без названия'
    setError(null)
    setCreating(true)
    try {
      const col = await createCollection({
        name,
        department: collectionDepartment.trim(),
        responsibles: collectionResponsibles.trim(),
        summary: collectionSummary.trim(),
      })
      setCollections((prev) => [col, ...prev])
      setDocsByCollection((prev) => ({ ...prev, [col.id]: {} }))
      setFilterMode('mine')
      setSearchQuery('')
      setUploading(true)
      const owuErrors: string[] = []
      let departmentDocId: string | null = null
      for (const slot of SLOT_TYPES) {
        const file = files[slot.id]
        if (file) {
          try {
            const res = await uploadDocument(slot.id, file, col.id)
            if (slot.id === 'department_goals_checklist') departmentDocId = res.id
            if (res.open_webui_synced === false && res.open_webui_error) {
              owuErrors.push(`${file.name}: ${res.open_webui_error}`)
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : `Ошибка загрузки: ${slot.label}`)
          }
        }
      }
      if (departmentDocId) {
        departmentAbortRef.current?.abort()
        const controller = new AbortController()
        departmentAbortRef.current = controller
        const { signal } = controller
        setDepartmentChecklist({
          documentId: departmentDocId,
          collectionId: col.id,
          documentName: files.department_goals_checklist?.name ?? 'Положение о департаменте',
          department: '',
          goals: [],
          tasks: [],
          loading: true,
          loadingProgress: 0,
        })
        try {
          const prep = await processDepartmentRegulation(departmentDocId, signal)
          if (prep.error) {
            setDepartmentChecklist((prev) =>
              prev
                ? { ...prev, loading: false, error: prep.error ?? 'Ошибка обработки' }
                : null
            )
          } else if (prep.parsed_json) {
            const j = prep.parsed_json as {
              department?: string
              goals?: Array<{ id?: string; text?: string; section?: string; checked?: boolean }>
              tasks?: Array<{ id?: string; text?: string; section?: string; checked?: boolean }>
            }
            const goals: DepartmentChecklistItem[] = (j.goals ?? []).map((g) => ({
              id: String(g.id ?? ''),
              text: String(g.text ?? ''),
              section: String(g.section ?? ''),
              checked: Boolean(g.checked),
            }))
            const tasks: DepartmentChecklistItem[] = (j.tasks ?? []).map((t) => ({
              id: String(t.id ?? ''),
              text: String(t.text ?? ''),
              section: String(t.section ?? ''),
              checked: Boolean(t.checked),
            }))
            setDepartmentChecklist((prev) =>
              prev
                ? {
                    ...prev,
                    loading: false,
                    department: String(j.department ?? ''),
                    goals,
                    tasks,
                  }
                : null
            )
          } else {
            setDepartmentChecklist((prev) =>
              prev ? { ...prev, loading: false, error: 'Нет данных от LLM' } : null
            )
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') {
            // Пользователь отменил обработку
          } else {
            setDepartmentChecklist((prev) =>
              prev
                ? {
                    ...prev,
                    loading: false,
                    error: e instanceof Error ? e.message : 'Ошибка обработки документа',
                  }
                : null
            )
          }
        } finally {
          if (departmentAbortRef.current === controller) departmentAbortRef.current = null
        }
      }
      if (owuErrors.length > 0) {
        setError((prev) => (prev ? `${prev}. ` : '') + `Open Web UI: не удалось синхронизировать файлы (${owuErrors.length}): ${owuErrors.slice(0, 3).join('; ')}${owuErrors.length > 3 ? '…' : ''}. В чате приложения контекст коллекции будет полным; в чате Open Web UI могут быть видны не все файлы.`)
      }
      setUploading(false)
      setCollectionName('')
      setCollectionDepartment('')
      setCollectionResponsibles('')
      setCollectionSummary('')
      setFiles(createInitialFiles())
      await loadDocumentsForCollection(col.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка создания коллекции'
      const isNetwork =
        typeof msg === 'string' &&
        (msg.includes('Failed to fetch') || msg.includes('Load failed') || msg.includes('NetworkError'))
      setError(isNetwork ? 'Не удалось подключиться к серверу. Запустите бэкенд (порт 8000).' : msg)
      setCreating(false)
      setUploading(false)
    } finally {
      setCreating(false)
    }
  }, [collectionName, files, loadDocumentsForCollection])

  const handleDrop = (typeId: SlotTypeId, e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove(styles.cellDragOver)
    const file = e.dataTransfer.files?.[0]
    if (file) setFile(typeId, file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add(styles.cellDragOver)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove(styles.cellDragOver)
  }

  const startEdit = (c: CollectionMeta) => {
    setEditingId(c.id)
    setEditingDraft({
      name: c.name ?? '',
      department: c.department ?? '',
      responsibles: c.responsibles ?? '',
      summary: c.summary ?? '',
    })
  }

  const updateEditingDraft = (patch: Partial<CollectionCardDraft>) => {
    setEditingDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingDraft(null)
  }

  const saveEdit = useCallback(async () => {
    if (!editingId || !editingDraft) {
      cancelEdit()
      return
    }
    const payload = {
      name: editingDraft.name.trim() || 'Без названия',
      department: editingDraft.department.trim(),
      responsibles: editingDraft.responsibles.trim(),
      summary: editingDraft.summary.trim(),
    }
    setError(null)
    try {
      const updated = await updateCollection(editingId, payload)
      setCollections((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, ...updated } : c))
      )
      cancelEdit()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }, [editingId, editingDraft])

  const handleDeleteCollection = useCallback(async (id: string) => {
    setDeleteConfirmCollection(null)
    setError(null)
    try {
      await deleteCollection(id)
      setCollections((prev) => prev.filter((c) => c.id !== id))
      setDocsByCollection((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }, [])

  const handleDeleteDoc = useCallback(async (doc: DocumentMeta, collectionId: string) => {
    setError(null)
    try {
      await deleteDocument(doc.id)
      await loadDocumentsForCollection(collectionId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }, [loadDocumentsForCollection])

  const hasProcessedDocs = (collectionId: string) => {
    const docs = docsByCollection[collectionId] ?? {}
    return Object.values(docs).some((arr) => arr.some((d) => d.preprocessed))
  }

  const openDepartmentChecklistForDoc = useCallback(
    async (doc: DocumentMeta, collectionId: string) => {
      departmentAbortRef.current?.abort()
      const controller = new AbortController()
      departmentAbortRef.current = controller
      const { signal } = controller
      setDepartmentChecklist({
        documentId: doc.id,
        collectionId,
        documentName: doc.name,
        department: '',
        goals: [],
        tasks: [],
        loading: true,
        loadingProgress: 0,
        error: undefined,
      })
      try {
        const prep = await processDepartmentRegulation(doc.id, signal)
        if (prep.error) {
          setDepartmentChecklist((prev) =>
            prev ? { ...prev, loading: false, error: prep.error ?? 'Ошибка' } : null
          )
          return
        }
        if (!prep.parsed_json) {
          setDepartmentChecklist((prev) =>
            prev ? { ...prev, loading: false, error: 'Нет данных от LLM' } : null
          )
          return
        }
        const j = prep.parsed_json as {
          department?: string
          goals?: Array<{ id?: string; text?: string; section?: string; checked?: boolean }>
          tasks?: Array<{ id?: string; text?: string; section?: string; checked?: boolean }>
        }
        const goals: DepartmentChecklistItem[] = (j.goals ?? []).map((g) => ({
          id: String(g.id ?? ''),
          text: String(g.text ?? ''),
          section: String(g.section ?? ''),
          checked: Boolean(g.checked),
        }))
        const tasks: DepartmentChecklistItem[] = (j.tasks ?? []).map((t) => ({
          id: String(t.id ?? ''),
          text: String(t.text ?? ''),
          section: String(t.section ?? ''),
          checked: Boolean(t.checked),
        }))
        setDepartmentChecklist((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                department: String(j.department ?? ''),
                goals,
                tasks,
              }
            : null
        )
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return
        }
        setDepartmentChecklist((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: e instanceof Error ? e.message : 'Ошибка обработки',
              }
            : null
        )
      } finally {
        if (departmentAbortRef.current === controller) departmentAbortRef.current = null
      }
    },
    []
  )

  const openChecklistForDoc = useCallback(
    async (doc: DocumentMeta, collectionId: string, forceProcess = false) => {
      const mode: TemplateChecklistState['mode'] =
        doc.document_type === 'reglament_checklist' ? 'rules' : 'items'
      checklistAbortRef.current?.abort()
      const controller = new AbortController()
      checklistAbortRef.current = controller
      const { signal } = controller
      setDocumentChecklist({
        documentId: doc.id,
        collectionId,
        documentName: doc.name,
        documentType: doc.document_type,
        title: getChecklistTitle(doc.document_type),
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
          const prep = await preprocessDocument(doc.id, signal)
          if (prep.error) {
            setDocumentChecklist((prev) =>
              prev ? { ...prev, loading: false, error: prep.error ?? 'Ошибка обработки' } : null
            )
            return
          }
          parsed = prep.parsed_json as Record<string, unknown> | undefined
          if (prep.preprocessed) {
            await loadDocumentsForCollection(collectionId)
          }
        }
        if (!parsed || typeof parsed !== 'object') {
          setDocumentChecklist((prev) =>
            prev ? { ...prev, loading: false, error: 'LLM не вернул данные для проверки' } : null
          )
          return
        }
        const itemsSource =
          mode === 'rules' ? (parsed as { rules?: unknown }).rules : (parsed as { items?: unknown }).items
        const items = normalizeChecklistItems(itemsSource)
        setDocumentChecklist((prev) =>
          prev ? { ...prev, loading: false, items, error: undefined } : null
        )
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return
        }
        setDocumentChecklist((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: e instanceof Error ? e.message : 'Ошибка обработки документа',
              }
            : null
        )
      } finally {
        if (checklistAbortRef.current === controller) checklistAbortRef.current = null
      }
    },
    [loadDocumentsForCollection]
  )

  const updateDepartmentChecklist = useCallback(
    (updater: (prev: NonNullable<typeof departmentChecklist>) => Partial<typeof departmentChecklist>) => {
      setDepartmentChecklist((prev) => (prev ? { ...prev, ...updater(prev) } : null))
    },
    []
  )

  const toggleGoalChecked = useCallback((index: number) => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const next = [...prev.goals]
      next[index] = { ...next[index], checked: !next[index].checked }
      return { ...prev, goals: next }
    })
  }, [])

  const toggleTaskChecked = useCallback((index: number) => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const next = [...prev.tasks]
      next[index] = { ...next[index], checked: !next[index].checked }
      return { ...prev, tasks: next }
    })
  }, [])

  const updateGoal = useCallback((index: number, field: keyof DepartmentChecklistItem, value: string | boolean) => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const next = [...prev.goals]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, goals: next }
    })
  }, [])

  const updateTask = useCallback((index: number, field: keyof DepartmentChecklistItem, value: string | boolean) => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const next = [...prev.tasks]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, tasks: next }
    })
  }, [])

  const addGoal = useCallback(() => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const id = `${prev.goals.length + 1}.${(prev.goals.filter((g) => g.id.startsWith(`${prev.goals.length + 1}.`)).length + 1)}`
      return {
        ...prev,
        goals: [...prev.goals, { id, text: '', section: '', checked: false }],
      }
    })
  }, [])

  const addTask = useCallback(() => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const n = prev.tasks.length + 1
      const id = `${n}`
      return {
        ...prev,
        tasks: [...prev.tasks, { id, text: '', section: '', checked: false }],
      }
    })
  }, [])

  const removeGoal = useCallback((index: number) => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const next = prev.goals.filter((_, i) => i !== index)
      return { ...prev, goals: next }
    })
  }, [])

  const removeTask = useCallback((index: number) => {
    setDepartmentChecklist((prev) => {
      if (!prev) return null
      const next = prev.tasks.filter((_, i) => i !== index)
      return { ...prev, tasks: next }
    })
  }, [])

  const toggleChecklistItem = useCallback((index: number) => {
    setDocumentChecklist((prev) => {
      if (!prev) return null
      const next = [...prev.items]
      next[index] = { ...next[index], checked: !next[index].checked }
      return { ...prev, items: next }
    })
  }, [])

  const updateChecklistItem = useCallback(
    (index: number, field: keyof DepartmentChecklistItem, value: string | boolean) => {
      setDocumentChecklist((prev) => {
        if (!prev) return null
        const next = [...prev.items]
        next[index] = { ...next[index], [field]: value }
        return { ...prev, items: next }
      })
    },
    []
  )

  const addChecklistItem = useCallback(() => {
    setDocumentChecklist((prev) => {
      if (!prev) return null
      return {
        ...prev,
        items: [...prev.items, { id: '', text: '', section: '', checked: false }],
      }
    })
  }, [])

  const removeChecklistItem = useCallback((index: number) => {
    setDocumentChecklist((prev) => {
      if (!prev) return null
      const next = prev.items.filter((_, i) => i !== index)
      return { ...prev, items: next }
    })
  }, [])

  const submitDepartmentChecklistHandler = useCallback(async () => {
    if (!departmentChecklist) return
    setDepartmentChecklist((prev) => (prev ? { ...prev, submitting: true, error: undefined } : null))
    try {
      await submitDepartmentChecklist(departmentChecklist.documentId, {
        department: departmentChecklist.department || null,
        goals: departmentChecklist.goals,
        tasks: departmentChecklist.tasks,
      })
      setDepartmentChecklist(null)
      await loadDocumentsForCollection(departmentChecklist.collectionId)
    } catch (e) {
      setDepartmentChecklist((prev) =>
        prev
          ? {
              ...prev,
              submitting: false,
              error: e instanceof Error ? e.message : 'Ошибка сохранения',
            }
          : null
      )
    }
  }, [departmentChecklist, loadDocumentsForCollection])

  const submitChecklistHandler = useCallback(async () => {
    if (!documentChecklist) return
    setDocumentChecklist((prev) => (prev ? { ...prev, submitting: true, error: undefined } : null))
    try {
      const parsedJson = buildChecklistParsedJson(documentChecklist)
      await submitDocumentChecklist(documentChecklist.documentId, parsedJson)
      setDocumentChecklist(null)
      await loadDocumentsForCollection(documentChecklist.collectionId)
    } catch (e) {
      setDocumentChecklist((prev) =>
        prev
          ? {
              ...prev,
              submitting: false,
              error: e instanceof Error ? e.message : 'Ошибка сохранения',
            }
          : null
      )
    }
  }, [documentChecklist, loadDocumentsForCollection])

  const downloadChecklistJson = useCallback(() => {
    if (!documentChecklist) return
    const parsedJson = buildChecklistParsedJson(documentChecklist)
    const baseName = documentChecklist.documentName || documentChecklist.documentType || 'checklist'
    downloadJsonFile(parsedJson, baseName)
  }, [documentChecklist])

  const handleGenerateJson = useCallback(
    async (col: CollectionMeta) => {
      setError(null)
      setGeneratingJsonId(col.id)
      try {
        const res = await generateCollectionJson(col.id)
        setCollections((prev) => [res.collection, ...prev])
        setDocsByCollection((prev) => ({ ...prev, [res.collection.id]: {} }))
        await loadDocumentsForCollection(res.collection.id)
        if (res.errors.length > 0) {
          setError(`Создана коллекция «${res.collection.name}» (обработано ${res.documents_processed} из ${res.errors.length + res.documents_processed}). Ошибки: ${res.errors.join('; ')}`)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка генерации JSON')
      } finally {
        setGeneratingJsonId(null)
      }
    },
    [loadDocumentsForCollection]
  )

  const filteredCollections = collections.filter((col) => {
    const matchesSearch = !searchQuery.trim() || col.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    const isJsonCollection = (col.name || '').endsWith(' (JSON)')
    const isProcessed = hasProcessedDocs(col.id) || isJsonCollection
    const matchesFilter =
      filterMode === 'mine' ? !isProcessed : isProcessed
    return matchesSearch && matchesFilter
  })

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>База знаний</h1>
      </header>

      <datalist id="responsibles-options">
        {responsiblesOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="departments-options">
        {departmentOptions.map((dep) => (
          <option key={dep.id} value={dep.name} />
        ))}
      </datalist>

      <div className={styles.tabs} role="tablist" aria-label="Разделы базы знаний">
        <button
          id="knowledge-tab-collections-btn"
          type="button"
          role="tab"
          aria-selected={activeTab === 'collections'}
          aria-controls="knowledge-tab-collections"
          tabIndex={activeTab === 'collections' ? 0 : -1}
          className={activeTab === 'collections' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setActiveTab('collections')}
        >
          Коллекции
        </button>
        <button
          id="knowledge-tab-prompts-btn"
          type="button"
          role="tab"
          aria-selected={activeTab === 'prompts'}
          aria-controls="knowledge-tab-prompts"
          tabIndex={activeTab === 'prompts' ? 0 : -1}
          className={activeTab === 'prompts' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setActiveTab('prompts')}
        >
          Промпты
        </button>
      </div>

      {activeTab === 'collections' ? (
        <div
          role="tabpanel"
          id="knowledge-tab-collections"
          aria-labelledby="knowledge-tab-collections-btn"
          className={styles.tabPanel}
        >
          <section className={styles.createCard}>
            <h2 className={styles.createTitle}>Новая коллекция</h2>
            {error && (
              <div className={styles.error} role="alert">
                <p style={{ margin: 0 }}>{error}</p>
                <p className={styles.errorHint}>
                  Убедитесь, что бэкенд запущен (например, порт 8000) и доступен по адресу из настроек.
                </p>
                <button
                  type="button"
                  className={styles.errorRetry}
                  onClick={() => setError(null)}
                  aria-label="Закрыть"
                >
                  Закрыть
                </button>
              </div>
            )}
            <label className={styles.nameLabel}>
              Название
              <input
                type="text"
                className={styles.nameInput}
                placeholder="Введите название коллекции"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
              />
            </label>
            <label className={styles.descriptionLabel}>
              Краткое описание
              <textarea
                className={styles.descriptionInput}
                placeholder="Например: ключевые цели и ожидаемый результат"
                value={collectionSummary}
                onChange={(e) => setCollectionSummary(e.target.value)}
                rows={3}
              />
            </label>
            <div className={styles.inlineFieldsRow}>
              <label className={`${styles.descriptionLabel} ${styles.inlineField}`}>
                ФИО ответственные
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="Например: ключевые цели и ожидаемый результат"
                  list="responsibles-options"
                  value={collectionResponsibles}
                  onChange={(e) => setCollectionResponsibles(e.target.value)}
                />
              </label>
              <label className={`${styles.descriptionLabel} ${styles.inlineField}`}>
                Подразделение
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="Выберите подразделение"
                  list="departments-options"
                  value={collectionDepartment}
                  onChange={(e) => setCollectionDepartment(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.slotsGrid}>
              {SLOT_TYPES.map((slot) => {
                const isTemplateSlot = TEMPLATE_SLOT_IDS.includes(slot.id)
                const templateDoc = isTemplateSlot ? (templateDocs[slot.id] ?? null) : null

                if (isTemplateSlot) {
                  return (
                    <div key={slot.id} className={`${styles.cell} ${styles.cellFromTemplate}`}>
                      <div className={styles.cellTop}>
                        <div className={styles.cellIcon}>
                          <PaperclipIcon />
                        </div>
                        <span className={styles.cellLabel}>{slot.label}</span>
                      </div>
                      {templateDoc ? (
                        <div className={styles.cellFile}>
                          <span className={styles.cellFileName} title={templateDoc.name}>
                            {templateDoc.name}
                          </span>
                          <span className={styles.cellTemplateBadge}>из настроек</span>
                        </div>
                      ) : (
                        <span className={styles.cellTemplateHint}>
                          Загрузите в <Link to="/settings" className={styles.cellTemplateLink}>Настройках</Link>
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <div
                    key={slot.id}
                    className={styles.cell}
                    onDrop={(e) => handleDrop(slot.id, e)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <div className={styles.cellTop}>
                      <div className={styles.cellIcon}>
                        <PaperclipIcon />
                      </div>
                      <span className={styles.cellLabel}>{slot.label}</span>
                      {slot.id === 'chairman_goals' && (
                        <button
                          type="button"
                          className={styles.cellTemplateBtn}
                          onClick={() => downloadGoalsTemplate()}
                          title="Скачать шаблон таблицы целей (ППР)"
                        >
                          Скачать шаблон
                        </button>
                      )}
                    </div>
                    <input
                      ref={(el) => { fileInputRefs.current[slot.id] = el }}
                      type="file"
                      className={styles.hiddenInput}
                      accept=".pdf,.docx,.xlsx,.xls,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        setFile(slot.id, f ?? null)
                        e.target.value = ''
                      }}
                    />
                    {files[slot.id] ? (
                      <div className={styles.cellFile}>
                        <span className={styles.cellFileName} title={files[slot.id]!.name}>
                          {files[slot.id]!.name}
                        </span>
                        <button
                          type="button"
                          className={styles.cellRemove}
                          onClick={() => setFile(slot.id, null)}
                          title="Убрать файл"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.cellAttach}
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                        >
                          Прикрепить файл
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            <div className={styles.createActions}>
              <button
                type="button"
                className={styles.createBtn}
                onClick={handleCreate}
                disabled={creating || uploading}
              >
                {creating ? 'Создание…' : uploading ? 'Загрузка файлов…' : 'Создать'}
              </button>
            </div>
          </section>

          <section className={styles.collectionsSection}>
            <h2 className={styles.collectionsTitle}>Коллекции</h2>
            <div className={styles.collectionsToolbar}>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Поиск коллекции"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Поиск коллекций"
              />
              <div className={styles.filterBtns}>
                <button
                  type="button"
                  className={filterMode === 'mine' ? styles.filterBtnActive : styles.filterBtn}
                  onClick={() => setFilterMode('mine')}
                >
                  <PersonIcon className={styles.filterBtnIcon} />
                  Мои
                </button>
                <button
                  type="button"
                  className={filterMode === 'processed' ? styles.filterBtnActive : styles.filterBtn}
                  onClick={() => setFilterMode('processed')}
                >
                  Обработанные
                </button>
              </div>
            </div>
            {collections.length === 0 ? (
              <div className={styles.empty}>
                <p>Пока нет коллекций. Создайте первую выше.</p>
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className={styles.empty}>
                <p>
                  {filterMode === 'processed'
                    ? 'Нет коллекций с обработанными документами (_json).'
                    : 'Ни одна коллекция не подходит под поиск.'}
                </p>
              </div>
            ) : (
              <ul className={styles.collectionsGrid}>
                {filteredCollections.map((col) => {
                  const docs = docsByCollection[col.id] ?? {}
                  const isEditing = editingId === col.id
                  const isGenerating = generatingJsonId === col.id
                  const hasDocs = Object.values(docs).some((arr) => arr.length > 0)
                  const departmentValue = (col.department ?? '').trim() || '—'
                  const responsiblesValue = (col.responsibles ?? '').trim() || '—'
                  const summaryValue = (col.summary ?? '').trim() || '—'
                  return (
                    <li key={col.id} className={styles.collectionCard}>
                      <div className={styles.cardHead}>
                        {isEditing ? (
                          <input
                            type="text"
                            className={styles.cardNameInput}
                            value={editingDraft?.name ?? ''}
                            onChange={(e) => updateEditingDraft({ name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            autoFocus
                          />
                        ) : (
                          <h3 className={styles.cardName}>{col.name}</h3>
                        )}
                        <div className={styles.cardHeadActions}>
                          <button
                            type="button"
                            className={styles.cardBtn}
                            onClick={() => startEdit(col)}
                            title="Редактировать карточку"
                            disabled={isEditing}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={styles.cardBtnDanger}
                            onClick={() => setDeleteConfirmCollection(col)}
                            title="Удалить"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className={styles.cardMeta}>
                        {isEditing ? (
                          <>
                            <div className={styles.cardMetaRowGrid}>
                              <label className={styles.cardMetaField}>
                                ФИО ответственные
                                <input
                                  type="text"
                                  className={styles.cardMetaTextarea}
                                  list="responsibles-options"
                                  value={editingDraft?.responsibles ?? ''}
                                  onChange={(e) => updateEditingDraft({ responsibles: e.target.value })}
                                  placeholder="Например: ключевые цели и ожидаемый результат"
                                />
                              </label>
                              <label className={styles.cardMetaField}>
                                Подразделение
                                <input
                                  type="text"
                                  className={styles.cardMetaTextarea}
                                  list="departments-options"
                                  value={editingDraft?.department ?? ''}
                                  onChange={(e) => updateEditingDraft({ department: e.target.value })}
                                  placeholder="Выберите подразделение"
                                />
                              </label>
                            </div>
                            <label className={styles.cardMetaField}>
                              Краткое описание
                              <textarea
                                className={styles.cardMetaTextarea}
                                rows={2}
                                value={editingDraft?.summary ?? ''}
                                onChange={(e) => updateEditingDraft({ summary: e.target.value })}
                                placeholder="Краткое описание коллекции"
                              />
                            </label>
                            <div className={styles.cardMetaActions}>
                              <button type="button" className={styles.cardMetaSaveBtn} onClick={saveEdit}>
                                Сохранить
                              </button>
                              <button type="button" className={styles.cardMetaCancelBtn} onClick={cancelEdit}>
                                Отмена
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className={styles.cardMetaList}>
                            <div className={styles.cardMetaRow}>
                              <span className={styles.cardMetaLabel}>ФИО ответственные</span>
                              <span className={styles.cardMetaValue} title={responsiblesValue}>
                                {responsiblesValue}
                              </span>
                            </div>
                            <div className={styles.cardMetaRow}>
                              <span className={styles.cardMetaLabel}>Подразделение</span>
                              <span className={styles.cardMetaValue} title={departmentValue}>
                                {departmentValue}
                              </span>
                            </div>
                            <div className={styles.cardMetaRow}>
                              <span className={styles.cardMetaLabel}>Краткое описание</span>
                              <span className={styles.cardMetaValue} title={summaryValue}>
                                {summaryValue}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={styles.cardSlotsGrid}>
                        {SLOT_TYPES.map((slot) => {
                          const doc = (docs[slot.id] ?? [])[0]
                          return (
                            <div key={slot.id} className={styles.cardSlotCell}>
                              <span className={styles.cardSlotLabel}>{slot.label}</span>
                              {doc ? (
                                <div className={styles.cardSlotDoc}>
                                  <span className={styles.cardSlotName} title={doc.name}>
                                    {doc.name}
                                    {doc.preprocessed && <span className={styles.cardSlotJson}>_json</span>}
                                  </span>
                                  <div className={styles.cardSlotActions}>
                                    {slot.id === 'department_goals_checklist' && !doc.preprocessed && (
                                      <button
                                        type="button"
                                        className={styles.cardSlotBtn}
                                        onClick={() => openDepartmentChecklistForDoc(doc, col.id)}
                                        title="Обработать документ и сформировать чеклист"
                                      >
                                        Сформировать чеклист
                                      </button>
                                    )}
                                    {(slot.id === 'business_plan_checklist' ||
                                      slot.id === 'strategy_checklist' ||
                                      slot.id === 'reglament_checklist') && (
                                      <button
                                        type="button"
                                        className={styles.cardSlotBtn}
                                        onClick={() => openChecklistForDoc(doc, col.id)}
                                        title={
                                          doc.preprocessed
                                            ? 'Проверить и при необходимости поправить JSON'
                                            : 'Обработать документ и сформировать чеклист'
                                        }
                                      >
                                        {doc.preprocessed ? 'Проверить JSON' : 'Обработать'}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className={styles.cardSlotDel}
                                      onClick={() => handleDeleteDoc(doc, col.id)}
                                      title="Удалить"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className={styles.cardSlotEmpty}>—</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {!(col.name || '').endsWith(' (JSON)') && (
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.cardGenerateJsonBtn}
                            onClick={() => handleGenerateJson(col)}
                            disabled={isGenerating || !hasDocs}
                            title="Преобразовать все файлы коллекции через LLM в JSON и создать новую коллекцию для прикрепления к чату"
                          >
                            {isGenerating ? 'Генерация…' : 'Сгенерировать JSON'}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="knowledge-tab-prompts"
          aria-labelledby="knowledge-tab-prompts-btn"
          className={styles.tabPanel}
        >
          <PromptsTab />
        </div>
      )}

      {departmentChecklist && (
        <DepartmentChecklistModal
          state={departmentChecklist}
          actions={{
            onClose: () => setDepartmentChecklist(null),
            cancelProcessing: () => {
              departmentAbortRef.current?.abort()
              departmentAbortRef.current = null
              setDepartmentChecklist(null)
            },
            updateDepartment: (value) => updateDepartmentChecklist(() => ({ department: value })),
            toggleGoalChecked,
            toggleTaskChecked,
            updateGoal,
            updateTask,
            addGoal,
            addTask,
            removeGoal,
            removeTask,
            submit: submitDepartmentChecklistHandler,
          }}
        />
      )}

      {documentChecklist && (
        <TemplateChecklistModal
          state={documentChecklist}
          actions={{
            onClose: () => setDocumentChecklist(null),
            cancelProcessing: () => {
              checklistAbortRef.current?.abort()
              checklistAbortRef.current = null
              setDocumentChecklist(null)
            },
            toggleItem: toggleChecklistItem,
            updateItem: updateChecklistItem,
            addItem: addChecklistItem,
            removeItem: removeChecklistItem,
            submit: submitChecklistHandler,
            downloadJson: downloadChecklistJson,
          }}
        />
      )}

      {deleteConfirmCollection && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmCollection(null)} aria-modal="true" role="dialog">
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <p className={styles.modalText}>Удалить коллекцию «{deleteConfirmCollection.name}»?</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnConfirm}
                onClick={() => handleDeleteCollection(deleteConfirmCollection.id)}
              >
                Да
              </button>
              <button
                type="button"
                className={styles.modalBtnCancel}
                onClick={() => setDeleteConfirmCollection(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
