/**
 * API документов базы знаний (бэкенд каскадирования).
 * Base URL: VITE_API_URL или по умолчанию http://localhost:8000 в dev.
 */

const getBaseUrl = (): string => {
  const env = (import.meta.env?.VITE_API_URL as string)?.trim() || ''
  if (env) return env.replace(/\/$/, '')
  // В режиме разработки по умолчанию вызываем бэкенд напрямую (порт 8000)
  if (import.meta.env?.DEV) return 'http://localhost:8000'
  return ''
}

export type DocumentTypeId =
  | 'chairman_goals'
  | 'strategy_checklist'
  | 'reglament_checklist'
  | 'department_goals_checklist'
  | 'business_plan_checklist'
  | 'goals_table'

export type DocumentMeta = {
  id: string
  name: string
  document_type: string
  collection_id?: string | null
  size?: number
  content_type?: string
  uploaded_at?: string
  preprocessed: boolean
  parsed_json?: Record<string, unknown>
  /** При загрузке в коллекцию: удалось ли синхронизировать с Open Web UI */
  open_webui_synced?: boolean | null
  /** При загрузке: ошибка синхронизации с Open Web UI */
  open_webui_error?: string | null
}

export type CollectionMeta = {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export type DocumentListResponse = {
  items: DocumentMeta[]
  total: number
}

export type DocumentTypeItem = {
  id: string
  label: string
}

export type PreprocessResponse = {
  document_id: string
  preprocessed: boolean
  parsed_json?: Record<string, unknown>
  error?: string
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = getBaseUrl()
  const url = base ? `${base}${path}` : path
  return fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  })
}

export async function getDocumentTypes(): Promise<DocumentTypeItem[]> {
  const res = await apiFetch('/api/documents/types')
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text?.slice(0, 200) || `Типы документов: ${res.status}`)
  }
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error(
      'Ответ не JSON. Запустите backend на порту 8000 (см. backend/README.md) и обновите страницу.'
    )
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Ответ не JSON. Запустите backend: uvicorn src.main:app --reload --port 8000')
  }
}

export async function listDocuments(
  documentType?: string,
  collectionId?: string | null
): Promise<DocumentListResponse> {
  const params = new URLSearchParams()
  if (documentType) params.set('document_type', documentType)
  if (collectionId) params.set('collection_id', collectionId)
  const q = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch(`/api/documents${q}`)
  const text = await res.text()
  if (!res.ok) throw new Error(text?.slice(0, 200) || `Список документов: ${res.status}`)
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error('Backend не доступен. Запустите: cd backend && uvicorn src.main:app --reload --port 8000')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Ответ не JSON. Убедитесь, что backend запущен на порту 8000.')
  }
}

export async function uploadDocument(
  documentType: DocumentTypeId,
  file: File,
  collectionId?: string | null
): Promise<DocumentMeta> {
  const base = getBaseUrl()
  const params = new URLSearchParams({ document_type: documentType })
  if (collectionId) params.set('collection_id', collectionId)
  const url = base
    ? `${base}/api/documents/upload?${params.toString()}`
    : `/api/documents/upload?${params.toString()}`
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Загрузка: ${res.status}`)
  }
  return res.json()
}

export async function getDocument(documentId: string, includeJson = true): Promise<DocumentMeta> {
  const q = includeJson ? '?include_json=true' : ''
  const res = await apiFetch(`/api/documents/${documentId}${q}`)
  if (!res.ok) throw new Error(`Документ: ${res.status}`)
  return res.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await apiFetch(`/api/documents/${documentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Удаление: ${res.status}`)
}

export async function preprocessDocument(documentId: string): Promise<PreprocessResponse> {
  const res = await apiFetch(`/api/documents/${documentId}/preprocess`, { method: 'POST' })
  if (!res.ok) throw new Error(`Предобработка: ${res.status}`)
  return res.json()
}

// --- Коллекции ---

export async function getCollections(): Promise<CollectionMeta[]> {
  const res = await apiFetch('/api/collections')
  const text = await res.text()
  if (!res.ok) throw new Error(text?.slice(0, 200) || `Коллекции: ${res.status}`)
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error('Backend не доступен. Запустите backend на порту 8000.')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Ответ не JSON.')
  }
}

export async function createCollection(name: string): Promise<CollectionMeta> {
  const res = await apiFetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || 'Новая коллекция' }),
  })
  if (!res.ok) throw new Error(`Создание: ${res.status}`)
  return res.json()
}

export async function updateCollection(collectionId: string, name: string): Promise<CollectionMeta> {
  const res = await apiFetch(`/api/collections/${collectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Переименование: ${res.status}`)
  return res.json()
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const res = await apiFetch(`/api/collections/${collectionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Удаление: ${res.status}`)
}

export type GenerateJsonResponse = {
  collection: CollectionMeta
  documents_processed: number
  errors: string[]
}

export async function generateCollectionJson(collectionId: string): Promise<GenerateJsonResponse> {
  const res = await apiFetch(`/api/collections/${collectionId}/generate-json`, { method: 'POST' })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Генерация JSON: ${res.status}`)
  }
  return res.json()
}

export type CollectionContextResponse = {
  content: string
  document_count: number
  included_count: number
}

/** Контекст коллекции (содержимое документов) для подстановки в промпт чата */
export async function getCollectionContext(collectionId: string): Promise<CollectionContextResponse> {
  const res = await apiFetch(`/api/collections/${collectionId}/context`)
  if (!res.ok) throw new Error(`Контекст коллекции: ${res.status}`)
  const data = await res.json()
  return {
    content: typeof data?.content === 'string' ? data.content : '',
    document_count: typeof data?.document_count === 'number' ? data.document_count : 0,
    included_count: typeof data?.included_count === 'number' ? data.included_count : 0,
  }
}

export type SyncOpenWebUIResponse = {
  open_webui_knowledge_id?: string | null
  files_synced: number
  errors: string[]
  open_webui_url?: string | null
}

/** Синхронизировать коллекцию с Open Web UI (создать Knowledge и загрузить файлы). */
export async function syncCollectionToOpenWebUI(collectionId: string): Promise<SyncOpenWebUIResponse> {
  const res = await apiFetch(`/api/collections/${collectionId}/sync-openwebui`, { method: 'POST' })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Синхронизация: ${res.status}`)
  }
  return res.json()
}

/** Типы шаблонных документов (загружаются один раз в Настройках). */
export const TEMPLATE_DOCUMENT_TYPES = [
  'business_plan_checklist',
  'strategy_checklist',
  'reglament_checklist',
] as const

export type TemplateDocumentTypeId = (typeof TEMPLATE_DOCUMENT_TYPES)[number]

export type TemplateDocumentsResponse = Record<string, DocumentMeta | null>

/** Список шаблонных документов (Бизнес-план, Стратегия, Регламент). */
export async function getTemplateDocuments(): Promise<TemplateDocumentsResponse> {
  const res = await apiFetch('/api/settings/template-documents')
  if (!res.ok) throw new Error(`Шаблонные документы: ${res.status}`)
  return res.json()
}

/** Загрузить или заменить шаблонный документ. */
export async function uploadTemplateDocument(
  documentType: TemplateDocumentTypeId,
  file: File
): Promise<DocumentMeta> {
  const base = getBaseUrl()
  const params = new URLSearchParams({ document_type: documentType })
  const url = `${base}/api/settings/template-documents/upload?${params}`
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Загрузка шаблона: ${res.status}`)
  }
  return res.json()
}
