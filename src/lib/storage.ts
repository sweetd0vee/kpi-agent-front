import type { StoredChat } from '@/types/chat'

const CHATS_KEY = 'kpi-cascading-chats'
const SETTINGS_KEY = 'kpi-cascading-settings'
const UPLOADED_FILES_KEY = 'kpi-cascading-uploaded-files'
const COLLECTIONS_KEY = 'kpi-cascading-collections'
const GOALS_KEY = 'kpi-cascading-goals'
const KPI_GOALS_KEY = 'kpi-cascading-kpi-goals'

export type StoredUploadedFile = {
  fileId: string
  name: string
  uploadedAt: number
}

export type StoredCollection = {
  id: string
  name: string
  fileIds: string[]
  createdAt: number
  updatedAt: number
}

export type ChatSettings = {
  apiUrl: string
  apiKey: string
}

export type GoalRow = {
  id: string
  lastName: string
  goal: string
  weightQ: string
  weightYear: string
  q1: string
  q2: string
  q3: string
  q4: string
  year: string
}

export type GoalsState = {
  rows: GoalRow[]
}

export function getChats(): StoredChat[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredChat[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveChats(chats: StoredChat[]): void {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
}

export function getSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { apiUrl: '', apiKey: '' }
    return JSON.parse(raw) as ChatSettings
  } catch {
    return { apiUrl: '', apiKey: '' }
  }
}

export function saveSettings(settings: ChatSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function getUploadedFiles(): StoredUploadedFile[] {
  try {
    const raw = localStorage.getItem(UPLOADED_FILES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredUploadedFile[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveUploadedFiles(files: StoredUploadedFile[]): void {
  localStorage.setItem(UPLOADED_FILES_KEY, JSON.stringify(files))
}

export function getCollections(): StoredCollection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredCollection[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveCollections(collections: StoredCollection[]): void {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
}

const EMPTY_GOALS_STATE: GoalsState = { rows: [] }

function normalizeGoalRows(value: unknown): GoalRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Partial<GoalRow>
    return {
      id: typeof item.id === 'string' ? item.id : generateId(),
      lastName: typeof item.lastName === 'string' ? item.lastName : '',
      goal: typeof item.goal === 'string' ? item.goal : '',
      weightQ: typeof item.weightQ === 'string' ? item.weightQ : '',
      weightYear: typeof item.weightYear === 'string' ? item.weightYear : '',
      q1: typeof item.q1 === 'string' ? item.q1 : '',
      q2: typeof item.q2 === 'string' ? item.q2 : '',
      q3: typeof item.q3 === 'string' ? item.q3 : '',
      q4: typeof item.q4 === 'string' ? item.q4 : '',
      year: typeof item.year === 'string' ? item.year : '',
    }
  })
}

export function getGoalsState(): GoalsState {
  try {
    const raw = localStorage.getItem(GOALS_KEY)
    if (!raw) return EMPTY_GOALS_STATE
    const parsedJson = JSON.parse(raw)
    if (!parsedJson || typeof parsedJson !== 'object') return EMPTY_GOALS_STATE
    const parsed = parsedJson as Partial<GoalsState> & {
      chairman?: GoalRow[]
      directors?: GoalRow[]
    }
    const rows = normalizeGoalRows(parsed?.rows)
    if ('rows' in parsed) {
      return { rows }
    }
    const legacyRows = [...normalizeGoalRows(parsed?.chairman), ...normalizeGoalRows(parsed?.directors)]
    return { rows: legacyRows }
  } catch {
    return EMPTY_GOALS_STATE
  }
}

export function saveGoalsState(state: GoalsState): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(state))
}

export function hasGoalsState(): boolean {
  return localStorage.getItem(GOALS_KEY) !== null
}

export function getKpiState(): GoalsState {
  try {
    const raw = localStorage.getItem(KPI_GOALS_KEY)
    if (!raw) return EMPTY_GOALS_STATE
    const parsedJson = JSON.parse(raw)
    if (!parsedJson || typeof parsedJson !== 'object') return EMPTY_GOALS_STATE
    const parsed = parsedJson as Partial<GoalsState>
    const rows = normalizeGoalRows(parsed?.rows)
    return { rows }
  } catch {
    return EMPTY_GOALS_STATE
  }
}

export function saveKpiState(state: GoalsState): void {
  localStorage.setItem(KPI_GOALS_KEY, JSON.stringify(state))
}
