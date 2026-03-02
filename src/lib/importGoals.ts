import type { GoalRow } from '@/lib/storage'
import { generateId } from '@/lib/storage'
import * as XLSX from 'xlsx'

/** Ожидаемые заголовки в xlsx (порядок не важен, сопоставление по названию) */
const HEADER_TO_FIELD: Record<string, keyof Omit<GoalRow, 'id'>> = {
  'ФИО': 'lastName',
  'SCAI Цель': 'goal',
  'Метрические цели': 'metricGoals',
  'вес квартал': 'weightQ',
  'вес год': 'weightYear',
  '1 квартал': 'q1',
  '2 квартал': 'q2',
  '3 квартал': 'q3',
  '4 квартал': 'q4',
  'Год': 'year',
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeCell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value)
  return String(value).trim()
}

/**
 * Парсит xlsx файл и возвращает массив строк целей.
 * Первая строка листа — заголовки (ФИО, SCAI Цель, Метрические цели, вес квартал, вес год, 1 квартал, 2 квартал, 3 квартал, 4 квартал, Год).
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

        const headerRow = rawRows[0].map(normalizeHeader)
        const colIndexToField = new Map<number, keyof Omit<GoalRow, 'id'>>()
        headerRow.forEach((header, index) => {
          const field = HEADER_TO_FIELD[header]
          if (field) colIndexToField.set(index, field)
        })

        const rows: GoalRow[] = []
        for (let i = 1; i < rawRows.length; i++) {
          const cells = rawRows[i] as unknown[]
          const row: Record<string, string> = {
            lastName: '',
            goal: '',
            metricGoals: '',
            weightQ: '',
            weightYear: '',
            q1: '',
            q2: '',
            q3: '',
            q4: '',
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
              goal: row.goal ?? '',
              metricGoals: row.metricGoals ?? '',
              weightQ: row.weightQ ?? '',
              weightYear: row.weightYear ?? '',
              q1: row.q1 ?? '',
              q2: row.q2 ?? '',
              q3: row.q3 ?? '',
              q4: row.q4 ?? '',
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
