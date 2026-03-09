import { generateId, type GoalRow, type LeaderGoalRow } from '@/lib/storage'

const getBaseUrl = (): string => {
  const env = (import.meta.env?.VITE_API_URL as string)?.trim() || ''
  if (env) return env.replace(/\/$/, '')
  if (import.meta.env?.DEV) return 'http://localhost:8000'
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

function normalizeGoalRows(value: unknown): GoalRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Partial<GoalRow>
    return {
      id: typeof item.id === 'string' && item.id ? item.id : generateId(),
      lastName: typeof item.lastName === 'string' ? item.lastName : '',
      goal: typeof item.goal === 'string' ? item.goal : '',
      metricGoals: typeof item.metricGoals === 'string' ? item.metricGoals : '',
      weightQ: typeof item.weightQ === 'string' ? item.weightQ : '',
      weightYear: typeof item.weightYear === 'string' ? item.weightYear : '',
      q1: typeof item.q1 === 'string' ? item.q1 : '',
      q2: typeof item.q2 === 'string' ? item.q2 : '',
      q3: typeof item.q3 === 'string' ? item.q3 : '',
      q4: typeof item.q4 === 'string' ? item.q4 : '',
      reportYear: typeof item.reportYear === 'string' ? item.reportYear : '',
      year: typeof item.year === 'string' ? item.year : '',
    }
  })
}

async function parseRowsResponse(res: Response, errorPrefix: string): Promise<GoalRow[]> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text?.slice(0, 200) || `${errorPrefix}: ${res.status}`)
  }
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error('Backend не доступен. Запустите backend на порту 8000.')
  }
  try {
    const data = JSON.parse(text) as { rows?: GoalRow[] } | GoalRow[]
    if (Array.isArray(data)) return normalizeGoalRows(data)
    return normalizeGoalRows(data?.rows)
  } catch {
    throw new Error('Ответ не JSON. Убедитесь, что backend запущен.')
  }
}

export async function getKpiRows(): Promise<GoalRow[]> {
  const res = await apiFetch('/api/kpi')
  return parseRowsResponse(res, 'КПЭ')
}

export async function saveKpiRows(rows: GoalRow[]): Promise<GoalRow[]> {
  const res = await apiFetch('/api/kpi', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return parseRowsResponse(res, 'КПЭ')
}

export async function getPprRows(): Promise<GoalRow[]> {
  const res = await apiFetch('/api/ppr')
  return parseRowsResponse(res, 'ППР')
}

export async function savePprRows(rows: GoalRow[]): Promise<GoalRow[]> {
  const res = await apiFetch('/api/ppr', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return parseRowsResponse(res, 'ППР')
}

function normalizeLeaderGoalRows(value: unknown): LeaderGoalRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Partial<LeaderGoalRow>
    return {
      id: typeof item.id === 'string' && item.id ? item.id : generateId(),
      lastName: typeof item.lastName === 'string' ? item.lastName : '',
      goalNum: typeof item.goalNum === 'string' ? item.goalNum : '',
      name: typeof item.name === 'string' ? item.name : '',
      goalType: typeof item.goalType === 'string' ? item.goalType : '',
      goalKind: typeof item.goalKind === 'string' ? item.goalKind : '',
      unit: typeof item.unit === 'string' ? item.unit : '',
      q1Weight: typeof item.q1Weight === 'string' ? item.q1Weight : '',
      q1Value: typeof item.q1Value === 'string' ? item.q1Value : '',
      q2Weight: typeof item.q2Weight === 'string' ? item.q2Weight : '',
      q2Value: typeof item.q2Value === 'string' ? item.q2Value : '',
      q3Weight: typeof item.q3Weight === 'string' ? item.q3Weight : '',
      q3Value: typeof item.q3Value === 'string' ? item.q3Value : '',
      q4Weight: typeof item.q4Weight === 'string' ? item.q4Weight : '',
      q4Value: typeof item.q4Value === 'string' ? item.q4Value : '',
      yearWeight: typeof item.yearWeight === 'string' ? item.yearWeight : '',
      yearValue: typeof item.yearValue === 'string' ? item.yearValue : '',
      comments: typeof item.comments === 'string' ? item.comments : '',
      methodDesc: typeof item.methodDesc === 'string' ? item.methodDesc : '',
      sourceInfo: typeof item.sourceInfo === 'string' ? item.sourceInfo : '',
      reportYear: typeof item.reportYear === 'string' ? item.reportYear : '',
    }
  })
}

async function parseLeaderGoalRowsResponse(res: Response, errorPrefix: string): Promise<LeaderGoalRow[]> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text?.slice(0, 200) || `${errorPrefix}: ${res.status}`)
  }
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error('Backend не доступен. Запустите backend на порту 8000.')
  }
  try {
    const data = JSON.parse(text) as { rows?: LeaderGoalRow[] } | LeaderGoalRow[]
    if (Array.isArray(data)) return normalizeLeaderGoalRows(data)
    return normalizeLeaderGoalRows(data?.rows)
  } catch {
    throw new Error('Ответ не JSON. Убедитесь, что backend запущен.')
  }
}

export async function getLeaderGoalRows(): Promise<LeaderGoalRow[]> {
  const res = await apiFetch('/api/leader-goals')
  return parseLeaderGoalRowsResponse(res, 'Линейный менеджмент')
}

export async function saveLeaderGoalRows(rows: LeaderGoalRow[]): Promise<LeaderGoalRow[]> {
  const res = await apiFetch('/api/leader-goals', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return parseLeaderGoalRowsResponse(res, 'Линейный менеджмент')
}
