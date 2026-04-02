import type { GoalRow, LeaderGoalRow, StrategyGoalRow } from '@/lib/storage'
import { generateId } from '@/lib/storage'
import { buildHeaderFieldLookup } from '@/lib/xlsxImportHeaders'
import * as XLSX from 'xlsx'

/** Ожидаемые заголовки в xlsx (порядок не важен; сопоставление после нормализации пробелов/регистра/ё) */
const HEADER_TO_FIELD: Record<string, keyof Omit<GoalRow, 'id'>> = {
  ФИО: 'lastName',
  'Бизнес/блок': 'businessUnit',
  Департамент: 'department',
  Подразделение: 'department',
  'UUID руководителя': 'leaderId',
  'SCAI Цель': 'goal',
  'Метрические цели': 'metricGoals',
  'вес квартал': 'weightQ',
  'Вес квартал': 'weightQ',
  'вес год': 'weightYear',
  'Вес год': 'weightYear',
  '1 квартал': 'q1',
  '2 квартал': 'q2',
  '3 квартал': 'q3',
  '4 квартал': 'q4',
  'Отчётный год': 'reportYear',
  'Отчетный год': 'reportYear',
  Год: 'year',
}

const resolveBoardField = buildHeaderFieldLookup(HEADER_TO_FIELD)

function normalizeCell(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      const d = value.getDate()
      const m = value.getMonth() + 1
      const y = value.getFullYear()
      return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
    }
  }
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value)
  return String(value).trim()
}

/**
 * Парсит xlsx файл и возвращает массив строк целей.
 * Первая строка листа — заголовки (ФИО, SCAI Цель, Метрические цели, Вес квартал, Вес год, 1 квартал, 2 квартал, 3 квартал, 4 квартал, Год).
 */
export function parseKpiXlsxToRows(file: File): Promise<GoalRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Не удалось прочитать файл'))
          return
        }
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          reject(new Error('В файле нет листов'))
          return
        }
        const sheet = workbook.Sheets[firstSheetName]
        const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as unknown[][]

        if (!Array.isArray(rawRows) || rawRows.length < 2) {
          resolve([])
          return
        }

        const headerCells = rawRows[0] as unknown[]
        const colIndexToField = new Map<number, keyof Omit<GoalRow, 'id'>>()
        headerCells.forEach((cell, index) => {
          const field = resolveBoardField(cell)
          if (field) colIndexToField.set(index, field)
        })

        const rows: GoalRow[] = []
        for (let i = 1; i < rawRows.length; i++) {
          const cells = rawRows[i] as unknown[]
          const row: Record<string, string> = {
            lastName: '',
            leaderId: '',
            businessUnit: '',
            department: '',
            goal: '',
            metricGoals: '',
            weightQ: '',
            weightYear: '',
            q1: '',
            q2: '',
            q3: '',
            q4: '',
            reportYear: '',
            year: '',
          }
          colIndexToField.forEach((field, colIndex) => {
            row[field] = normalizeCell(cells[colIndex])
          })
          const hasAny = Object.keys(row).some((k) => row[k] !== '')
          if (hasAny) {
            rows.push({
              id: generateId(),
              lastName: row.lastName ?? '',
              leaderId: row.leaderId?.trim() ? row.leaderId : undefined,
              businessUnit: row.businessUnit ?? '',
              department: row.department ?? '',
              goal: row.goal ?? '',
              metricGoals: row.metricGoals ?? '',
              weightQ: row.weightQ ?? '',
              weightYear: row.weightYear ?? '',
              q1: row.q1 ?? '',
              q2: row.q2 ?? '',
              q3: row.q3 ?? '',
              q4: row.q4 ?? '',
              reportYear: row.reportYear ?? '',
              year: row.year ?? '',
            })
          }
        }
        resolve(rows)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Ошибка разбора xlsx'))
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
}

/** Заголовки xlsx для таблицы «Руководители» (сопоставление по названию колонки) */
const LEADER_HEADER_TO_FIELD: Record<string, keyof Omit<LeaderGoalRow, 'id'>> = {
  ФИО: 'lastName',
  '№ цели': 'goalNum',
  'Наименование КПЭ': 'name',
  'Тип цели': 'goalType',
  'Вид цели': 'goalKind',
  'Ед. изм.': 'unit',
  'ед.изм.': 'unit',
  'Единица измерения': 'unit',
  'I кв. Вес %': 'q1Weight',
  'I квартал Вес %': 'q1Weight',
  'I кв. План. / веха': 'q1Value',
  'I квартал Плановое значение': 'q1Value',
  'II кв. Вес %': 'q2Weight',
  'II квартал Вес %': 'q2Weight',
  'II кв. План. / веха': 'q2Value',
  'III кв. Вес %': 'q3Weight',
  'III кв. План. / веха': 'q3Value',
  'IV кв. Вес %': 'q4Weight',
  'IV кв. План. / веха': 'q4Value',
  'Год Вес %': 'yearWeight',
  'Год План. / веха': 'yearValue',
  Комментарии: 'comments',
  'Методика расчёта': 'methodDesc',
  'Методика расчета': 'methodDesc',
  'Источник информации': 'sourceInfo',
  'Отчётный год': 'reportYear',
  'Отчетный год': 'reportYear',
}

const resolveLeaderField = buildHeaderFieldLookup(LEADER_HEADER_TO_FIELD)

/**
 * Парсит xlsx и возвращает строки для таблицы «Руководители».
 * Первая строка листа — заголовки (ФИО, № цели, Наименование КПЭ, …).
 */
export function parseLeaderGoalsXlsxToRows(file: File): Promise<LeaderGoalRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Не удалось прочитать файл'))
          return
        }
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          reject(new Error('В файле нет листов'))
          return
        }
        const sheet = workbook.Sheets[firstSheetName]
        const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as unknown[][]

        if (!Array.isArray(rawRows) || rawRows.length < 2) {
          resolve([])
          return
        }

        const headerCells = rawRows[0] as unknown[]
        const colIndexToField = new Map<number, keyof Omit<LeaderGoalRow, 'id'>>()
        headerCells.forEach((cell, index) => {
          const field = resolveLeaderField(cell)
          if (field) colIndexToField.set(index, field)
        })

        const rows: LeaderGoalRow[] = []
        const emptyRow: Omit<LeaderGoalRow, 'id'> = {
          lastName: '',
          goalNum: '',
          name: '',
          goalType: '',
          goalKind: '',
          unit: '',
          q1Weight: '',
          q1Value: '',
          q2Weight: '',
          q2Value: '',
          q3Weight: '',
          q3Value: '',
          q4Weight: '',
          q4Value: '',
          yearWeight: '',
          yearValue: '',
          comments: '',
          methodDesc: '',
          sourceInfo: '',
          reportYear: '',
        }
        for (let i = 1; i < rawRows.length; i++) {
          const cells = rawRows[i] as unknown[]
          const row: Omit<LeaderGoalRow, 'id'> = { ...emptyRow }
          colIndexToField.forEach((field, colIndex) => {
            row[field] = normalizeCell(cells[colIndex])
          })
          const hasAny = Object.keys(row).some((k) => row[k as keyof typeof row] !== '')
          if (hasAny) {
            rows.push({
              id: generateId(),
              ...row,
            })
          }
        }
        resolve(rows)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Ошибка разбора xlsx'))
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
}

const STRATEGY_HEADER_TO_FIELD: Record<string, keyof Omit<StrategyGoalRow, 'id'>> = {
  'Бизнес/блок': 'businessUnit',
  Сегмент: 'segment',
  'Стратегический приоритет': 'strategicPriority',
  Цель: 'goalObjective',
  Инициатива: 'initiative',
  'Тип инициативы': 'initiativeType',
  'Ответственный исполнитель': 'responsiblePersonOwner',
  'Участие других блоков': 'otherUnitsInvolved',
  Бюджет: 'budget',
  Начало: 'startDate',
  Конец: 'endDate',
  КПЭ: 'kpi',
  'ед. изм.': 'unitOfMeasure',
  'ед.изм.': 'unitOfMeasure',
  'Ед. изм.': 'unitOfMeasure',
  '2025: Целевое значение': 'targetValue2025',
  '2026: Целевое значение': 'targetValue2026',
  '2027: Целевое значение': 'targetValue2027',
  'Целевое значение 2025': 'targetValue2025',
  'Целевое значение 2026': 'targetValue2026',
  'Целевое значение 2027': 'targetValue2027',
}

const resolveStrategyField = buildHeaderFieldLookup(STRATEGY_HEADER_TO_FIELD)

export function parseStrategyGoalsXlsxToRows(file: File): Promise<StrategyGoalRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Не удалось прочитать файл'))
          return
        }
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          reject(new Error('В файле нет листов'))
          return
        }
        const sheet = workbook.Sheets[firstSheetName]
        const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as unknown[][]
        if (!Array.isArray(rawRows) || rawRows.length < 2) {
          resolve([])
          return
        }
        const headerCells = rawRows[0] as unknown[]
        const colIndexToField = new Map<number, keyof Omit<StrategyGoalRow, 'id'>>()
        headerCells.forEach((cell, index) => {
          const field = resolveStrategyField(cell)
          if (field) colIndexToField.set(index, field)
        })

        const emptyRow: Omit<StrategyGoalRow, 'id'> = {
          businessUnit: '',
          segment: '',
          strategicPriority: '',
          goalObjective: '',
          initiative: '',
          initiativeType: '',
          responsiblePersonOwner: '',
          otherUnitsInvolved: '',
          budget: '',
          startDate: '',
          endDate: '',
          kpi: '',
          unitOfMeasure: '',
          targetValue2025: '',
          targetValue2026: '',
          targetValue2027: '',
        }
        const rows: StrategyGoalRow[] = []
        for (let i = 1; i < rawRows.length; i++) {
          const cells = rawRows[i] as unknown[]
          const row: Omit<StrategyGoalRow, 'id'> = { ...emptyRow }
          colIndexToField.forEach((field, colIndex) => {
            row[field] = normalizeCell(cells[colIndex])
          })
          const hasAny = Object.values(row).some((value) => value !== '')
          if (hasAny) {
            rows.push({ id: generateId(), ...row })
          }
        }
        resolve(rows)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Ошибка разбора xlsx'))
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
}
