/**
 * API документов базы знаний (бэкенд каскадирования).
 * Base URL: VITE_API_URL; иначе относительные URL (в dev — proxy Vite на бэкенд).
 */

const getBaseUrl = (): string => {
  const env = (import.meta.env?.VITE_API_URL as string)?.trim() || ''
  if (env) return env.replace(/\/$/, '')
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
  parsed_json_path?: string
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
  department?: string
  period?: string
  responsibles?: string
  summary?: string
  status?: string
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
  parsed_json_path?: string
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

export async function getDocument(
  documentId: string,
  includeJson = true,
  signal?: AbortSignal
): Promise<DocumentMeta> {
  const q = includeJson ? '?include_json=true' : ''
  const res = await apiFetch(`/api/documents/${documentId}${q}`, { signal })
  if (!res.ok) throw new Error(`Документ: ${res.status}`)
  return res.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await apiFetch(`/api/documents/${documentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Удаление: ${res.status}`)
}

export async function preprocessDocument(
  documentId: string,
  signal?: AbortSignal
): Promise<PreprocessResponse> {
  const res = await apiFetch(`/api/documents/${documentId}/preprocess`, {
    method: 'POST',
    signal,
  })
  if (!res.ok) throw new Error(`Предобработка: ${res.status}`)
  return res.json()
}

/** Обработать «Положение о департаменте» через LLM; результат для валидации (не сохраняется на сервере). */
export async function processDepartmentRegulation(
  documentId: string,
  signal?: AbortSignal
): Promise<PreprocessResponse> {
  const res = await apiFetch(`/api/documents/${documentId}/process-department-regulation`, {
    method: 'POST',
    signal,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Обработка положения: ${res.status}`)
  }
  return res.json()
}

export type DepartmentChecklistItem = {
  id: string
  text: string
  section: string
  checked: boolean
}

export type DepartmentChecklistPayload = {
  department?: string | null
  goals: DepartmentChecklistItem[]
  tasks: DepartmentChecklistItem[]
}

/** Сохранить проверенный пользователем чеклист (JSON в MinIO/хранилище, привязка к документу). */
export async function submitDepartmentChecklist(
  documentId: string,
  payload: DepartmentChecklistPayload
): Promise<DocumentMeta> {
  const res = await apiFetch(`/api/documents/${documentId}/submit-department-checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Сохранение чеклиста: ${res.status}`)
  }
  return res.json()
}

/** Обработать шаблонный документ (БП/Стратегия/Регламент) через LLM и сохранить JSON. */
export async function processTemplateDocument(
  documentId: string,
  signal?: AbortSignal
): Promise<PreprocessResponse> {
  const res = await apiFetch(`/api/settings/template-documents/${documentId}/preprocess`, {
    method: 'POST',
    signal,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Обработка шаблона: ${res.status}`)
  }
  return res.json()
}

/** Сохранить проверенный JSON для шаблонного документа. */
export async function submitTemplateChecklist(
  documentId: string,
  parsedJson: Record<string, unknown>
): Promise<DocumentMeta> {
  const res = await apiFetch(`/api/settings/template-documents/${documentId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parsed_json: parsedJson }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Сохранение шаблона: ${res.status}`)
  }
  return res.json()
}

/** Сохранить проверенный JSON для чеклиста в коллекции (БП/Стратегия/Регламент). */
export async function submitDocumentChecklist(
  documentId: string,
  parsedJson: Record<string, unknown>
): Promise<DocumentMeta> {
  const res = await apiFetch(`/api/documents/${documentId}/submit-checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parsed_json: parsedJson }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Сохранение чеклиста: ${res.status}`)
  }
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

export type CreateCollectionPayload = {
  name: string
  department?: string
  period?: string
  responsibles?: string
  summary?: string
  status?: string
}

export type UpdateCollectionPayload = {
  name?: string
  department?: string
  period?: string
  responsibles?: string
  summary?: string
  status?: string
}

export async function createCollection(payload: CreateCollectionPayload): Promise<CollectionMeta> {
  const res = await apiFetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name || 'Новая коллекция',
      department: payload.department,
      period: payload.period,
      responsibles: payload.responsibles,
      summary: payload.summary,
      status: payload.status,
    }),
  })
  if (!res.ok) throw new Error(`Создание: ${res.status}`)
  return res.json()
}

export async function updateCollection(
  collectionId: string,
  payload: UpdateCollectionPayload
): Promise<CollectionMeta> {
  const res = await apiFetch(`/api/collections/${collectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      department: payload.department,
      period: payload.period,
      responsibles: payload.responsibles,
      summary: payload.summary,
      status: payload.status,
    }),
  })
  if (!res.ok) throw new Error(`Обновление: ${res.status}`)
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

type ResponsiblesListResponse = {
  items: string[]
}

export async function getResponsibles(): Promise<string[]> {
  const res = await apiFetch('/api/reference/responsibles')
  const text = await res.text()
  if (!res.ok) throw new Error(text?.slice(0, 200) || `Ответственные: ${res.status}`)
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error('Backend не доступен. Запустите backend на порту 8000.')
  }
  try {
    const data = JSON.parse(text) as ResponsiblesListResponse
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    throw new Error('Ответ не JSON.')
  }
}

/** Типы шаблонных документов (загружаются один раз в Настройках). */
export const TEMPLATE_DOCUMENT_TYPES = ['strategy_checklist', 'reglament_checklist'] as const

export type TemplateDocumentTypeId = (typeof TEMPLATE_DOCUMENT_TYPES)[number]

export type TemplateDocumentsResponse = Record<string, DocumentMeta | null>

const SETTINGS_REQUEST_TIMEOUT_MS = 8_000

/** Список шаблонных документов (Стратегия, Регламент). */
export async function getTemplateDocuments(
  externalSignal?: AbortSignal
): Promise<TemplateDocumentsResponse> {
  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SETTINGS_REQUEST_TIMEOUT_MS)
  const signal =
    externalSignal == null
      ? controller.signal
      : mergeAbortSignals(externalSignal, controller.signal)

  try {
    const res = await apiFetch('/api/settings/template-documents', { signal })
    if (!res.ok) throw new Error(`Шаблонные документы: ${res.status}`)
    return res.json()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return {}
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const c = new AbortController()
  const abort = () => c.abort()
  a.addEventListener('abort', abort)
  b.addEventListener('abort', abort)
  return c.signal
}

/** Загрузить или заменить шаблонный документ (сохраняется в MinIO в свой бакет при USE_MINIO=true). */
export async function uploadTemplateDocument(
  documentType: TemplateDocumentTypeId,
  file: File
): Promise<DocumentMeta> {
  const params = new URLSearchParams({ document_type: documentType })
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(`/api/settings/template-documents/upload?${params}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Загрузка шаблона: ${res.status}`)
  }
  return res.json()
}
