import type { StoredChat } from '@/types/chat'

const CHATS_KEY = 'kpi-cascading-chats'
const SETTINGS_KEY = 'kpi-cascading-settings'
const UPLOADED_FILES_KEY = 'kpi-cascading-uploaded-files'
const COLLECTIONS_KEY = 'kpi-cascading-collections'
const GOALS_KEY = 'kpi-cascading-goals'
const KPI_GOALS_KEY = 'kpi-cascading-kpi-goals'
const LEADER_GOALS_KEY = 'kpi-cascading-leader-goals'
const PROMPTS_KEY = 'kpi-cascading-prompts'
const CHAT_ATTACHABLES_KEY = 'kpi-cascading-chat-attachables'
const DEMO_CLEAR_KEY = 'kpi-cascading-demo-cleared'

function clearDemoGoalsOnce(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(DEMO_CLEAR_KEY) === '1') return
    if (localStorage.getItem(GOALS_KEY)) localStorage.removeItem(GOALS_KEY)
    if (localStorage.getItem(KPI_GOALS_KEY)) localStorage.removeItem(KPI_GOALS_KEY)
    localStorage.setItem(DEMO_CLEAR_KEY, '1')
  } catch {
    // ignore storage errors (private mode, blocked storage, etc.)
  }
}

clearDemoGoalsOnce()

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

export type StoredPrompt = {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export type ChatSettings = {
  apiUrl: string
  apiKey: string
}

/** Сохранённое приложение к чату: таблица (Цели правления/Цели руководителей/Цели стратегии) или фрагмент базы знаний */
export type StoredAttachable = {
  id: string
  type: 'board_goals' | 'leader_goals' | 'strategy_goals' | 'knowledge_chunk'
  label: string
  content: string
  /** Описание фильтров на момент сохранения (для воспроизведения логики отбора) */
  filterDescription?: string
  createdAt: number
}

export type GoalRow = {
  id: string
  lastName: string
  /** UUID из справочника `leaders` (подставляется бэкендом по ФИО). */
  leaderId?: string
  businessUnit: string
  department: string
  goal: string
  metricGoals: string
  weightQ: string
  weightYear: string
  q1: string
  q2: string
  q3: string
  q4: string
  /** Год, за который цели (например 2026). Отображается как «Отчётный год». */
  reportYear: string
  /** Итог за год (значение). */
  year: string
}

export type GoalsState = {
  rows: GoalRow[]
}

/** Строка таблицы «Руководители» — шапка по шаблону формы целей (data/lead_goals_template.csv) */
export type LeaderGoalRow = {
  id: string
  /** ФИО руководителя */
  lastName: string
  goalNum: string
  name: string
  goalType: string
  goalKind: string
  unit: string
  q1Weight: string
  q1Value: string
  q2Weight: string
  q2Value: string
  q3Weight: string
  q3Value: string
  q4Weight: string
  q4Value: string
  yearWeight: string
  yearValue: string
  comments: string
  methodDesc: string
  sourceInfo: string
  /** Отчётный год (например 2026) */
  reportYear: string
}

export type LeaderGoalsState = {
  rows: LeaderGoalRow[]
}

export type StrategyGoalRow = {
  id: string
  businessUnit: string
  segment: string
  strategicPriority: string
  goalObjective: string
  initiative: string
  initiativeType: string
  responsiblePersonOwner: string
  otherUnitsInvolved: string
  budget: string
  startDate: string
  endDate: string
  kpi: string
  unitOfMeasure: string
  targetValue2025: string
  targetValue2026: string
  targetValue2027: string
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

function normalizePrompt(value: unknown): StoredPrompt {
  const item = (value ?? {}) as Partial<StoredPrompt>
  const createdAt = typeof item.createdAt === 'number' ? item.createdAt : Date.now()
  return {
    id: typeof item.id === 'string' && item.id ? item.id : generateId(),
    title: typeof item.title === 'string' ? item.title : '',
    content: typeof item.content === 'string' ? item.content : '',
    createdAt,
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : createdAt,
  }
}

export function getPrompts(): StoredPrompt[] {
  try {
    const raw = localStorage.getItem(PROMPTS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredPrompt[]
    if (!Array.isArray(list)) return []
    return list.map(normalizePrompt)
  } catch {
    return []
  }
}

export function savePrompts(prompts: StoredPrompt[]): void {
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts))
}

export function getAttachables(): StoredAttachable[] {
  try {
    const raw = localStorage.getItem(CHAT_ATTACHABLES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredAttachable[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveAttachables(items: StoredAttachable[]): void {
  localStorage.setItem(CHAT_ATTACHABLES_KEY, JSON.stringify(items))
}

export function addAttachable(item: Omit<StoredAttachable, 'id' | 'createdAt'>): StoredAttachable {
  const list = getAttachables()
  const now = Date.now()
  const newItem: StoredAttachable = {
    ...item,
    id: generateId(),
    createdAt: now,
  }
  saveAttachables([...list, newItem])
  return newItem
}

export function removeAttachable(id: string): void {
  saveAttachables(getAttachables().filter((a) => a.id !== id))
}

const ATTACHABLE_TYPE_BASE: Record<StoredAttachable['type'], string> = {
  board_goals: 'Цели правления',
  leader_goals: 'Цели руководителей',
  strategy_goals: 'Цели стратегии',
  knowledge_chunk: 'Фрагмент',
}

/** Имя по умолчанию для новой таблицы: «КПЭ - 1», «КПЭ - 2» и т.д., если предыдущие заняты. */
export function getDefaultAttachableLabel(type: StoredAttachable['type']): string {
  const base = ATTACHABLE_TYPE_BASE[type]
  const list = getAttachables().filter((a) => a.type === type)
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*(\\d+)$`)
  let maxN = 0
  list.forEach((a) => {
    const m = a.label.trim().match(re)
    if (m) maxN = Math.max(maxN, Number(m[1]))
  })
  return `${base} - ${maxN + 1}`
}

export function updateAttachable(id: string, updates: Partial<Pick<StoredAttachable, 'label'>>): void {
  const list = getAttachables()
  const next = list.map((a) => (a.id === id ? { ...a, ...updates } : a))
  saveAttachables(next)
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
      leaderId: typeof item.leaderId === 'string' && item.leaderId ? item.leaderId : undefined,
      businessUnit: typeof item.businessUnit === 'string' ? item.businessUnit : '',
      department: typeof item.department === 'string' ? item.department : '',
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

const EMPTY_LEADER_GOALS_STATE: LeaderGoalsState = { rows: [] }

function normalizeLeaderGoalRow(item: Partial<LeaderGoalRow>): LeaderGoalRow {
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
}

function normalizeLeaderGoalRows(value: unknown): LeaderGoalRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => normalizeLeaderGoalRow(row as Partial<LeaderGoalRow>))
}

export function getLeaderGoalsState(): LeaderGoalsState {
  try {
    const raw = localStorage.getItem(LEADER_GOALS_KEY)
    if (!raw) return EMPTY_LEADER_GOALS_STATE
    const parsed = JSON.parse(raw) as Partial<LeaderGoalsState>
    const rows = normalizeLeaderGoalRows(parsed?.rows)
    return { rows }
  } catch {
    return EMPTY_LEADER_GOALS_STATE
  }
}

export function saveLeaderGoalsState(state: LeaderGoalsState): void {
  localStorage.setItem(LEADER_GOALS_KEY, JSON.stringify(state))
}
