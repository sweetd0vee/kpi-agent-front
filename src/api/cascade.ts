export type CascadeRunRequest = {
  reportYear?: string
  managers?: string[]
  persist?: boolean
  useLlm?: boolean
  maxItemsPerDeputy?: number
}

export type CascadeRunSummary = {
  runId: string
  createdAt: string
  status: string
  reportYear: string
  managers: string[]
  useLlm: boolean
  totalManagers: number
  totalDeputies: number
  totalItems: number
  unmatchedManagers: number
  warnings: string[]
}

export type CascadeGoalItem = {
  id: string
  managerName: string
  deputyName: string
  sourceType: string
  sourceRowId: string
  sourceGoalTitle: string
  sourceMetric: string
  businessUnit: string
  department: string
  reportYear: string
  traceRule: string
  confidence: number | null
}

export type CascadeUnmatched = {
  managerName: string
  reason: string
  reportYear: string
}

export type CascadeFallbackGoal = {
  id: string
  managerName: string
  deputyName: string
  sourceType: string
  sourceRowId: string
  sourceGoalTitle: string
  sourceMetric: string
  businessUnit: string
  department: string
  reportYear: string
  reason: string
}

export type CascadeRunResponse = {
  run: CascadeRunSummary
  items: CascadeGoalItem[]
  unmatched: CascadeUnmatched[]
  fallbackGoals: CascadeFallbackGoal[]
}

const getBaseUrl = (): string => {
  const env = (import.meta.env?.VITE_API_URL as string)?.trim() || ''
  if (env) return env.replace(/\/$/, '')
  return ''
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

async function parseJsonResponse<T>(res: Response, errorPrefix: string): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text?.slice(0, 400) || `${errorPrefix}: ${res.status}`)
  }
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error('Backend не доступен. Запустите backend на порту 8000.')
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Ответ не JSON. Убедитесь, что backend запущен.')
  }
}

export async function runCascade(payload: CascadeRunRequest): Promise<CascadeRunResponse> {
  const res = await apiFetch('/api/cascade/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonResponse<CascadeRunResponse>(res, 'Каскадирование')
}

export async function listCascadeRuns(limit = 20): Promise<CascadeRunSummary[]> {
  const res = await apiFetch(`/api/cascade/runs?limit=${encodeURIComponent(String(limit))}`)
  const data = await parseJsonResponse<{ runs?: CascadeRunSummary[] }>(res, 'История запусков')
  return Array.isArray(data?.runs) ? data.runs : []
}

export async function getCascadeRun(runId: string): Promise<CascadeRunResponse> {
  const res = await apiFetch(`/api/cascade/runs/${encodeURIComponent(runId)}`)
  return parseJsonResponse<CascadeRunResponse>(res, 'Детали запуска')
}

export async function deleteCascadeRun(runId: string): Promise<void> {
  const path = `/api/cascade/runs/${encodeURIComponent(runId)}`
  const deleteRes = await apiFetch(path, { method: 'DELETE' })
  if (deleteRes.ok) {
    await parseJsonResponse<{ ok?: boolean }>(deleteRes, 'Удаление запуска')
    return
  }
  if (deleteRes.status !== 405) {
    await parseJsonResponse<{ ok?: boolean }>(deleteRes, 'Удаление запуска')
    return
  }
  const postFallbackRes = await apiFetch(`${path}/delete`, { method: 'POST' })
  await parseJsonResponse<{ ok?: boolean }>(postFallbackRes, 'Удаление запуска')
}
