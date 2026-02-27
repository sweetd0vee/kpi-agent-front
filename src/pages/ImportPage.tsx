import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  listDocuments,
  uploadDocument,
  deleteDocument,
  preprocessDocument,
  type DocumentMeta,
  type CollectionMeta,
} from '@/api/documents'
import styles from './ImportPage.module.css'

type SlotTypeId = 'business_plan_checklist' | 'strategy_checklist' | 'reglament_checklist' | 'department_goals_checklist' | 'chairman_goals'

const SLOT_TYPES: { id: SlotTypeId; label: string }[] = [
  { id: 'business_plan_checklist', label: 'Бизнес-план' },
  { id: 'strategy_checklist', label: 'Стратегия' },
  { id: 'reglament_checklist', label: 'Регламент' },
  { id: 'department_goals_checklist', label: 'Положение о департаменте' },
  { id: 'chairman_goals', label: 'Цели председателя' },
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
  const [preprocessing, setPreprocessing] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [docsByCollection, setDocsByCollection] = useState<Record<string, Record<string, DocumentMeta[]>>>({})
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'mine' | 'processed'>('mine')
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
      setUploading(true)
      for (const slot of SLOT_TYPES) {
        const file = files[slot.id]
        if (file) {
          try {
            await uploadDocument(slot.id, file, col.id)
          } catch (e) {
            setError(e instanceof Error ? e.message : `Ошибка загрузки: ${slot.label}`)
          }
        }
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
      setError(e instanceof Error ? e.message : 'Ошибка создания коллекции')
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

  const handlePreprocess = useCallback(async (doc: DocumentMeta, collectionId: string) => {
    setError(null)
    setPreprocessing(doc.id)
    try {
      const res = await preprocessDocument(doc.id)
      if (res.error) setError(res.error)
      else await loadDocumentsForCollection(collectionId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка предобработки')
    } finally {
      setPreprocessing(null)
    }
  }, [loadDocumentsForCollection])

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

  const filteredCollections = collections.filter((col) => {
    const matchesSearch = !searchQuery.trim() || col.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    const matchesFilter = filterMode === 'mine' || hasProcessedDocs(col.id)
    return matchesSearch && matchesFilter
  })

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>База знаний</h1>
        <p className={styles.subtitle}>
          Создайте коллекцию: введите название и прикрепите по одному файлу в каждую ячейку. После загрузки файлы можно обработать LLM в JSON (имя_json).
        </p>
      </header>

      <section className={styles.createCard}>
        <h2 className={styles.createTitle}>Новая коллекция</h2>
        <label className={styles.nameLabel}>
          Название коллекции
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
          {SLOT_TYPES.map((slot) => (
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
                <button
                  type="button"
                  className={styles.cellAttach}
                  onClick={() => fileInputRefs.current[slot.id]?.click()}
                >
                  Прикрепить файл
                </button>
              )}
            </div>
          ))}
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
                    <div className={styles.cardActions}>
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
                        onClick={() => handleDeleteCollection(col.id)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className={styles.cardSlots}>
                    {SLOT_TYPES.map((slot) => {
                      const doc = (docs[slot.id] ?? [])[0]
                      return (
                        <div key={slot.id} className={styles.cardSlot}>
                          <span className={styles.cardSlotLabel}>{slot.label}</span>
                          {doc ? (
                            <div className={styles.cardSlotDoc}>
                              <span className={styles.cardSlotName} title={doc.name}>
                                {doc.name}
                                {doc.preprocessed && <span className={styles.cardSlotJson}>_json</span>}
                              </span>
                              <div className={styles.cardSlotActions}>
                                {!doc.preprocessed && (
                                  <button
                                    type="button"
                                    className={styles.cardSlotBtn}
                                    onClick={() => handlePreprocess(doc, col.id)}
                                    disabled={!!preprocessing}
                                    title="Обработать LLM → JSON"
                                  >
                                    {preprocessing === doc.id ? '…' : 'В JSON'}
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
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
