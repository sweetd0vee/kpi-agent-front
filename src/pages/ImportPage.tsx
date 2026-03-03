import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  generateCollectionJson,
  listDocuments,
  uploadDocument,
  deleteDocument,
  getTemplateDocuments,
  type DocumentMeta,
  type CollectionMeta,
} from '@/api/documents'
import { downloadGoalsTemplate } from '@/lib/exportGoals'
import styles from './ImportPage.module.css'

type SlotTypeId = 'business_plan_checklist' | 'strategy_checklist' | 'reglament_checklist' | 'department_goals_checklist' | 'chairman_goals'

const SLOT_TYPES: { id: SlotTypeId; label: string }[] = [
  { id: 'business_plan_checklist', label: 'Бизнес-план' },
  { id: 'strategy_checklist', label: 'Стратегия' },
  { id: 'reglament_checklist', label: 'Регламент' },
  { id: 'department_goals_checklist', label: 'Положение о департаменте' },
  { id: 'chairman_goals', label: 'Свои цели' },
]

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  )
}

export function ImportPage() {
  const [collections, setCollections] = useState<CollectionMeta[]>([])
  const [collectionName, setCollectionName] = useState('')
  const [collectionDescription, setCollectionDescription] = useState('')
  const [files, setFiles] = useState<Record<SlotTypeId, File | null>>({
    business_plan_checklist: null,
    strategy_checklist: null,
    reglament_checklist: null,
    department_goals_checklist: null,
    chairman_goals: null,
  })
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingJsonId, setGeneratingJsonId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirmCollection, setDeleteConfirmCollection] = useState<CollectionMeta | null>(null)
  const [docsByCollection, setDocsByCollection] = useState<Record<string, Record<string, DocumentMeta[]>>>({})
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'mine' | 'processed'>('mine')
  const [templateDocs, setTemplateDocs] = useState<Record<string, DocumentMeta | null>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  const setFile = (typeId: SlotTypeId, file: File | null) => {
    setFiles((prev) => ({ ...prev, [typeId]: file }))
  }

  const handleCreate = useCallback(async () => {
    const name = collectionName.trim() || 'Без названия'
    setError(null)
    setCreating(true)
    try {
      const col = await createCollection(name)
      setCollections((prev) => [col, ...prev])
      setDocsByCollection((prev) => ({ ...prev, [col.id]: {} }))
      setFilterMode('mine')
      setSearchQuery('')
      setUploading(true)
      const owuErrors: string[] = []
      for (const slot of SLOT_TYPES) {
        const file = files[slot.id]
        if (file) {
          try {
            const res = await uploadDocument(slot.id, file, col.id)
            if (res.open_webui_synced === false && res.open_webui_error) {
              owuErrors.push(`${file.name}: ${res.open_webui_error}`)
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : `Ошибка загрузки: ${slot.label}`)
          }
        }
      }
      if (owuErrors.length > 0) {
        setError((prev) => (prev ? `${prev}. ` : '') + `Open Web UI: не удалось синхронизировать файлы (${owuErrors.length}): ${owuErrors.slice(0, 3).join('; ')}${owuErrors.length > 3 ? '…' : ''}. В чате приложения контекст коллекции будет полным; в чате Open Web UI могут быть видны не все файлы.`)
      }
      setUploading(false)
      setCollectionName('')
      setCollectionDescription('')
      setFiles((prev) => ({
        ...prev,
        business_plan_checklist: null,
        strategy_checklist: null,
        reglament_checklist: null,
        department_goals_checklist: null,
        chairman_goals: null,
      }))
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
    setEditingName(c.name)
  }

  const saveEdit = useCallback(async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null)
      return
    }
    setError(null)
    try {
      await updateCollection(editingId, editingName.trim())
      setCollections((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, name: editingName.trim() } : c))
      )
      setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка переименования')
    }
  }, [editingId, editingName])

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
          Описание
          <textarea
            className={styles.descriptionInput}
            placeholder="Краткое описание коллекции"
            value={collectionDescription}
            onChange={(e) => setCollectionDescription(e.target.value)}
            rows={3}
          />
        </label>
        <div className={styles.slotsGrid}>
          {SLOT_TYPES.map((slot) => {
            const isTemplateSlot =
              slot.id === 'business_plan_checklist' ||
              slot.id === 'strategy_checklist' ||
              slot.id === 'reglament_checklist'
            const templateDoc = isTemplateSlot ? (templateDocs[slot.id] ?? null) : null
            const fromTemplate = isTemplateSlot && templateDoc != null

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
              return (
                <li key={col.id} className={styles.collectionCard}>
                  <div className={styles.cardHead}>
                    {isEditing ? (
                      <input
                        type="text"
                        className={styles.cardNameInput}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') setEditingId(null)
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
                        title="Переименовать"
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
