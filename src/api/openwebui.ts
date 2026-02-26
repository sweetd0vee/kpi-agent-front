/**
 * Open Web UI API client (for instance running in Docker).
 * Base URL: passed from settings, or VITE_OPEN_WEBUI_URL, or same origin.
 */

function getBaseUrl(override?: string): string {
  if (override != null && override !== '') return override.replace(/\/$/, '')
  return (import.meta.env.VITE_OPEN_WEBUI_URL as string) || ''
}

const getHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
})

export type OpenWebUIModel = {
  id: string
  name?: string
  [key: string]: unknown
}

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type ChatCompletionRequest = {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  files?: { type: 'file' | 'collection'; id: string }[]
}

export type ChatCompletionResponse = {
  id?: string
  choices?: Array<{
    message?: { role: string; content: string }
    delta?: { content?: string }
    finish_reason?: string
  }>
  error?: { message: string }
}

export type FileUploadResponse = {
  id: string
  filename?: string
  [key: string]: unknown
}

export type FileStatusResponse = {
  status: 'pending' | 'completed' | 'failed'
  error?: string
}

export async function getModels(apiKey: string, baseUrl?: string): Promise<OpenWebUIModel[]> {
  const base = getBaseUrl(baseUrl)
  const res = await fetch(`${base}/api/models`, {
    headers: getHeaders(apiKey),
  })
  if (!res.ok) throw new Error(`Models: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data?.data ?? []
}

export type KnowledgeItem = {
  id: string
  name?: string
  title?: string
  [key: string]: unknown
}

export async function getKnowledgeList(
  apiKey: string,
  baseUrl?: string
): Promise<KnowledgeItem[]> {
  const base = getBaseUrl(baseUrl)
  if (!base) {
    throw new Error(
      'Укажите URL Open Web UI в настройках (например, http://localhost:3000). Список коллекций загружается с сервера Open Web UI.'
    )
  }
  const res = await fetch(`${base}/api/v1/knowledge/`, {
    headers: getHeaders(apiKey),
  })
  const raw = await res.text()
  if (raw.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error(
      `Сервер вернул HTML вместо JSON (код ${res.status}). Проверьте URL Open Web UI в настройках и что запрос идёт на правильный хост (например http://localhost:3000), а не на этот сайт.`
    )
  }
  if (!res.ok) throw new Error(`Коллекции: ${res.status}. ${raw.slice(0, 200)}`)
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(
      `Ответ сервера не JSON. Проверьте URL Open Web UI в настройках. Начало ответа: ${raw.slice(0, 80)}…`
    )
  }
  const list = Array.isArray(data)
    ? data
    : (data as { items?: unknown[] })?.items ?? (data as { data?: unknown[] })?.data ?? []
  return list.map((k: Record<string, unknown>) => ({
    id: String(k.id ?? k.knowledge_id ?? ''),
    name: String(k.name ?? k.title ?? k.id ?? ''),
    title: String(k.title ?? k.name ?? k.id ?? ''),
    ...k,
  }))
}

function normalizeChatResponse(data: unknown): ChatCompletionResponse {
  if (data == null || typeof data !== 'object') return { error: { message: 'Пустой ответ от сервера' } }
  const obj = data as Record<string, unknown>
  // Стандартный формат: { choices: [{ message: { content } }] }
  if (Array.isArray(obj.choices) && obj.choices.length > 0) return obj as ChatCompletionResponse
  // Вариант обёртки: { data: { choices } }
  const inner = obj.data as Record<string, unknown> | undefined
  if (inner && Array.isArray(inner.choices) && inner.choices.length > 0)
    return inner as ChatCompletionResponse
  const err = (obj.error as { message?: string } | undefined)?.message
  return { choices: [], error: { message: err || 'Неожиданный формат ответа от сервера' } }
}

export async function chatCompletions(
  apiKey: string,
  body: ChatCompletionRequest,
  baseUrl?: string
): Promise<ChatCompletionResponse> {
  const base = getBaseUrl(baseUrl)
  const res = await fetch(`${base}/api/chat/completions`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({ ...body, stream: false }),
  })
  const raw = await res.text()
  let data: unknown = null
  if (raw.trim().length > 0) {
    try {
      data = JSON.parse(raw)
    } catch {
      if (!res.ok) throw new Error(`Chat: ${res.status}. Ответ не JSON: ${raw.slice(0, 150)}…`)
      return { error: { message: `Ответ не JSON (начало): ${raw.slice(0, 120)}…` } }
    }
  }
  if (!res.ok) {
    const errMsg =
      (data && typeof data === 'object' && (data as { error?: { message?: string } })?.error?.message) ||
      `Chat: ${res.status}`
    throw new Error(typeof errMsg === 'string' ? errMsg : `Chat: ${res.status}`)
  }
  if (data == null || typeof data !== 'object') {
    const emptyBody = raw.trim().length === 0
    const snippet = raw.trim().slice(0, 100)
    const detail = emptyBody
      ? `HTTP ${res.status}, тело ответа пусто (0 байт).`
      : `HTTP ${res.status}, длина тела: ${raw.length} байт. Начало: ${snippet}${raw.length > 100 ? '…' : ''}`
    return {
      error: {
        message: `Пустой или неверный ответ от сервера. ${detail} Проверьте: в настройках указан полный URL Open Web UI (например http://localhost:3000); модель доступна; попробуйте без вложений.`,
      },
    }
  }
  return normalizeChatResponse(data)
}

export async function uploadFile(
  apiKey: string,
  file: File,
  baseUrl?: string
): Promise<FileUploadResponse> {
  const base = getBaseUrl(baseUrl)
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${base}/api/v1/files/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.detail || data?.message || `Upload: ${res.status}`)
  return data
}

export async function getFileStatus(
  apiKey: string,
  fileId: string,
  baseUrl?: string
): Promise<FileStatusResponse> {
  const base = getBaseUrl(baseUrl)
  const res = await fetch(`${base}/api/v1/files/${fileId}/process/status`, {
    headers: getHeaders(apiKey),
  })
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  return res.json()
}

export async function waitForFileReady(
  apiKey: string,
  fileId: string,
  options: { timeout?: number; interval?: number; baseUrl?: string } = {}
): Promise<void> {
  const { timeout = 120000, interval = 2000, baseUrl } = options
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const { status, error } = await getFileStatus(apiKey, fileId, baseUrl)
    if (status === 'completed') return
    if (status === 'failed') throw new Error(error || 'File processing failed')
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error('File processing timeout')
}
