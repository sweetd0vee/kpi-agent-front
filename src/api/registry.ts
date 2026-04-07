import { generateId } from '@/lib/storage'

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

export type StaffRow = {
  id: string
  orgStructureCode: string
  unitName: string
  head: string
  businessUnit: string
  functionalBlockCurator: string
}

export type ProcessRegistryRow = {
  id: string
  processArea: string
  processCode: string
  process: string
  processOwner: string
  leader: string
  businessUnit: string
  top20: string
}

function normalizeStaffRows(value: unknown): StaffRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Partial<StaffRow>
    return {
      id: typeof item.id === 'string' && item.id ? item.id : generateId(),
      orgStructureCode: typeof item.orgStructureCode === 'string' ? item.orgStructureCode : '',
      unitName: typeof item.unitName === 'string' ? item.unitName : '',
      head: typeof item.head === 'string' ? item.head : '',
      businessUnit: typeof item.businessUnit === 'string' ? item.businessUnit : '',
      functionalBlockCurator: typeof item.functionalBlockCurator === 'string' ? item.functionalBlockCurator : '',
    }
  })
}

function normalizeProcessRegistryRows(value: unknown): ProcessRegistryRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Partial<ProcessRegistryRow>
    return {
      id: typeof item.id === 'string' && item.id ? item.id : generateId(),
      processArea: typeof item.processArea === 'string' ? item.processArea : '',
      processCode: typeof item.processCode === 'string' ? item.processCode : '',
      process: typeof item.process === 'string' ? item.process : '',
      processOwner: typeof item.processOwner === 'string' ? item.processOwner : '',
      leader: typeof item.leader === 'string' ? item.leader : '',
      businessUnit: typeof item.businessUnit === 'string' ? item.businessUnit : '',
      top20: typeof item.top20 === 'string' ? item.top20 : '',
    }
  })
}

async function parseTableResponse<T>(
  res: Response,
  normalize: (v: unknown) => T[],
  label: string
): Promise<T[]> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text?.slice(0, 400) || `${label}: ${res.status}`)
  }
  if (text.trimStart().toLowerCase().startsWith('<!')) {
    throw new Error('Backend не доступен. Запустите backend на порту 8000.')
  }
  try {
    const data = JSON.parse(text) as { rows?: unknown } | unknown[]
    if (Array.isArray(data)) return normalize(data)
    return normalize(data?.rows)
  } catch {
    throw new Error('Ответ не JSON. Убедитесь, что backend запущен.')
  }
}

export async function getStaffRows(): Promise<StaffRow[]> {
  const res = await apiFetch('/api/staff')
  return parseTableResponse(res, normalizeStaffRows, 'Штатное расписание')
}

export async function saveStaffRows(rows: StaffRow[]): Promise<StaffRow[]> {
  const res = await apiFetch('/api/staff', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return parseTableResponse(res, normalizeStaffRows, 'Штатное расписание')
}

export async function getProcessRegistryRows(): Promise<ProcessRegistryRow[]> {
  const res = await apiFetch('/api/process-registry')
  return parseTableResponse(res, normalizeProcessRegistryRows, 'Реестр процессов')
}

export async function saveProcessRegistryRows(rows: ProcessRegistryRow[]): Promise<ProcessRegistryRow[]> {
  const res = await apiFetch('/api/process-registry', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return parseTableResponse(res, normalizeProcessRegistryRows, 'Реестр процессов')
}

/** Загрузка .xlsx: полная замена таблицы на сервере. */
export async function uploadProcessRegistryXlsx(file: File): Promise<ProcessRegistryRow[]> {
  const base = getBaseUrl()
  const url = base ? `${base}/api/process-registry/upload` : '/api/process-registry/upload'
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  })
  return parseTableResponse(res, normalizeProcessRegistryRows, 'Реестр процессов')
}
