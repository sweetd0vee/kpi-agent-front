import { generateId } from '@/lib/storage'

const getBaseUrl = (): string => {
  const env = (import.meta.env?.VITE_API_URL as string)?.trim() || ''
  if (env) return env.replace(/\/$/, '')
  // Без VITE_API_URL — относительные /api/* (в dev запросы идут через proxy Vite → тот же origin, без лишнего CORS)
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

/** Строка из API (camelCase или snake_case). */
function strField(row: Record<string, unknown>, camel: string, snake: string): string {
  const a = row[camel]
  const b = row[snake]
  if (typeof a === 'string') return a
  if (typeof b === 'string') return b
  if (a != null && typeof a !== 'object') return String(a)
  if (b != null && typeof b !== 'object') return String(b)
  return ''
}

function rowId(row: Record<string, unknown>): string {
  const raw = row.id
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (raw != null && typeof raw !== 'object') return String(raw).trim() || generateId()
  return generateId()
}

function normalizeStaffRows(value: unknown): StaffRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Record<string, unknown>
    return {
      id: rowId(item),
      orgStructureCode: strField(item, 'orgStructureCode', 'org_structure_code'),
      unitName: strField(item, 'unitName', 'unit_name'),
      head: strField(item, 'head', 'head'),
      businessUnit: strField(item, 'businessUnit', 'business_unit'),
      functionalBlockCurator: strField(item, 'functionalBlockCurator', 'functional_block_curator'),
    }
  })
}

function normalizeProcessRegistryRows(value: unknown): ProcessRegistryRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Record<string, unknown>
    return {
      id: rowId(item),
      processArea: strField(item, 'processArea', 'process_area'),
      processCode: strField(item, 'processCode', 'process_code'),
      process: strField(item, 'process', 'process'),
      processOwner: strField(item, 'processOwner', 'process_owner'),
      leader: strField(item, 'leader', 'leader'),
      businessUnit: strField(item, 'businessUnit', 'business_unit'),
      top20: strField(item, 'top20', 'top_20'),
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

/** Загрузка .xlsx: полная замена таблицы на сервере. */
export async function uploadStaffXlsx(file: File): Promise<StaffRow[]> {
  const base = getBaseUrl()
  const url = base ? `${base}/api/staff/upload` : '/api/staff/upload'
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
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
