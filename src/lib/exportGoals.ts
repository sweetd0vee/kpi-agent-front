import type { ProcessRegistryRow, StaffRow } from '@/api/registry'
import type { GoalRow, LeaderGoalRow, StrategyGoalRow } from '@/lib/storage'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import * as XLSX from 'xlsx-js-style'

export const EXPORT_HEADERS = [
  'ФИО',
  'SCAI Цель',
  'Бизнес юнит',
  'Департамент',
  'Метрические цели',
  'Вес квартал',
  'Вес год',
  '1 квартал',
  '2 квартал',
  '3 квартал',
  '4 квартал',
  'Год',
  'Отчётный год',
]

const EMPTY_GOALS_TEMPLATE_ROW = () => Array(EXPORT_HEADERS.length).fill('')

/** Шаблон заполняемой таблицы целей (ППР): заголовки + пустые строки для заполнения */
const GOALS_TEMPLATE_ROWS: string[][] = [
  EXPORT_HEADERS,
  EMPTY_GOALS_TEMPLATE_ROW(),
  EMPTY_GOALS_TEMPLATE_ROW(),
  EMPTY_GOALS_TEMPLATE_ROW(),
  EMPTY_GOALS_TEMPLATE_ROW(),
  EMPTY_GOALS_TEMPLATE_ROW(),
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const EXCEL_HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '1E3A8A' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  },
}

const EXCEL_CELL_STYLE = {
  alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
    right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  },
}

function maxLineLength(value: string): number {
  return String(value ?? '')
    .split('\n')
    .reduce((max, part) => Math.max(max, part.length), 0)
}

function buildStyledSheet(headers: string[], rows: string[][]): XLSX.WorkSheet {
  const data = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)

  ws['!cols'] = headers.map((header, colIndex) => {
    const contentMax = rows.reduce((max, row) => Math.max(max, maxLineLength(row[colIndex] ?? '')), maxLineLength(header))
    return { wch: Math.min(Math.max(contentMax + 3, 12), 70) }
  })

  const rowCount = data.length
  const colCount = headers.length
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell) continue
      cell.s = r === 0 ? EXCEL_HEADER_STYLE : EXCEL_CELL_STYLE
    }
  }

  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref'])
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }),
    }
  }

  return ws
}

/** Скачать шаблон таблицы целей (Excel) для заполнения */
export function downloadGoalsTemplate(): void {
  const ws = buildStyledSheet(EXPORT_HEADERS, GOALS_TEMPLATE_ROWS.slice(1))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Цели')
  XLSX.writeFile(wb, 'шаблон_целей.xlsx')
}

function rowToCells(row: GoalRow): string[] {
  return [
    row.lastName ?? '',
    row.goal ?? '',
    row.businessUnit ?? '',
    row.department ?? '',
    row.metricGoals ?? '',
    row.weightQ ?? '',
    row.weightYear ?? '',
    row.q1 ?? '',
    row.q2 ?? '',
    row.q3 ?? '',
    row.q4 ?? '',
    row.year ?? '',
    row.reportYear ?? '',
  ]
}

const FONT_NAME = 'Roboto'
const FONT_URLS = [
  '/fonts/Roboto-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Static/Roboto-Regular.ttf',
]

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

async function loadCyrillicFont(doc: jsPDF): Promise<boolean> {
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buffer = await res.arrayBuffer()
      const base64 = arrayBufferToBase64(buffer)
      doc.addFileToVFS(`${FONT_NAME}-Regular.ttf`, base64)
      doc.addFont(`${FONT_NAME}-Regular.ttf`, FONT_NAME, 'normal')
      return true
    } catch {
      continue
    }
  }
  return false
}

export function exportGoalsCSV(rows: GoalRow[], filenamePrefix = 'ппр'): void {
  const escape = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t
  }
  const headerLine = EXPORT_HEADERS.map(escape).join(',')
  const dataLines = rows.map((row) => rowToCells(row).map(escape).join(','))
  const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.csv`)
}

export function exportGoalsExcel(rows: GoalRow[], filenamePrefix = 'ппр'): void {
  const ws = buildStyledSheet(EXPORT_HEADERS, rows.map((row) => rowToCells(row)))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, filenamePrefix)
  XLSX.writeFile(wb, `${filenamePrefix}.xlsx`)
}

export async function exportGoalsPDF(rows: GoalRow[], filenamePrefix = 'ппр'): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fontLoaded = await loadCyrillicFont(doc)
  if (fontLoaded) {
    doc.setFont(FONT_NAME)
  }
  const body = rows.map((row) => rowToCells(row))
  const tableStyles: Record<string, unknown> = { fontSize: 8 }
  if (fontLoaded) {
    tableStyles.font = FONT_NAME
  }
  autoTable(doc, {
    head: [EXPORT_HEADERS],
    body,
    styles: tableStyles,
    margin: { left: 10, right: 10 },
  })
  doc.save(`${filenamePrefix}.pdf`)
}

export async function exportGoalsDOCX(rows: GoalRow[], filenamePrefix = 'ппр'): Promise<void> {
  const tableRows = [
    new TableRow({
      children: EXPORT_HEADERS.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            width: { size: 15, type: WidthType.PERCENTAGE },
          })
      ),
      tableHeader: true,
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: rowToCells(row).map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cell || '—' })] })],
                width: { size: 15, type: WidthType.PERCENTAGE },
              })
          ),
        })
    ),
  ]
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  })
  const doc = new Document({
    sections: [
      {
        children: [table],
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${filenamePrefix}.docx`)
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Заголовки экспорта таблицы «Руководители» */
export const LEADER_EXPORT_HEADERS = [
  'ФИО',
  '№ цели',
  'Наименование КПЭ',
  'Тип цели',
  'Вид цели',
  'Ед. изм.',
  'I кв. Вес %',
  'I кв. План. / веха',
  'II кв. Вес %',
  'II кв. План. / веха',
  'III кв. Вес %',
  'III кв. План. / веха',
  'IV кв. Вес %',
  'IV кв. План. / веха',
  'Год Вес %',
  'Год План. / веха',
  'Комментарии',
  'Методика расчёта',
  'Источник информации',
  'Отчётный год',
]

function leaderRowToCells(row: LeaderGoalRow): string[] {
  return [
    row.lastName ?? '',
    row.goalNum ?? '',
    row.name ?? '',
    row.goalType ?? '',
    row.goalKind ?? '',
    row.unit ?? '',
    row.q1Weight ?? '',
    row.q1Value ?? '',
    row.q2Weight ?? '',
    row.q2Value ?? '',
    row.q3Weight ?? '',
    row.q3Value ?? '',
    row.q4Weight ?? '',
    row.q4Value ?? '',
    row.yearWeight ?? '',
    row.yearValue ?? '',
    row.comments ?? '',
    row.methodDesc ?? '',
    row.sourceInfo ?? '',
    row.reportYear ?? '',
  ]
}

export function exportLeaderGoalsCSV(rows: LeaderGoalRow[], filenamePrefix = 'руководители'): void {
  const escape = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t
  }
  const headerLine = LEADER_EXPORT_HEADERS.map(escape).join(',')
  const dataLines = rows.map((row) => leaderRowToCells(row).map(escape).join(','))
  const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.csv`)
}

export function exportLeaderGoalsExcel(rows: LeaderGoalRow[], filenamePrefix = 'руководители'): void {
  const ws = buildStyledSheet(LEADER_EXPORT_HEADERS, rows.map((row) => leaderRowToCells(row)))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, filenamePrefix)
  XLSX.writeFile(wb, `${filenamePrefix}.xlsx`)
}

export async function exportLeaderGoalsPDF(rows: LeaderGoalRow[], filenamePrefix = 'руководители'): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fontLoaded = await loadCyrillicFont(doc)
  if (fontLoaded) {
    doc.setFont(FONT_NAME)
  }
  const body = rows.map((row) => leaderRowToCells(row))
  const tableStyles: Record<string, unknown> = { fontSize: 7 }
  if (fontLoaded) {
    tableStyles.font = FONT_NAME
  }
  autoTable(doc, {
    head: [LEADER_EXPORT_HEADERS],
    body,
    styles: tableStyles,
    margin: { left: 8, right: 8 },
  })
  doc.save(`${filenamePrefix}.pdf`)
}

export async function exportLeaderGoalsDOCX(rows: LeaderGoalRow[], filenamePrefix = 'руководители'): Promise<void> {
  const tableRows = [
    new TableRow({
      children: LEADER_EXPORT_HEADERS.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            width: { size: 5, type: WidthType.PERCENTAGE },
          })
      ),
      tableHeader: true,
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: leaderRowToCells(row).map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cell || '—' })] })],
                width: { size: 5, type: WidthType.PERCENTAGE },
              })
          ),
        })
    ),
  ]
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  })
  const doc = new Document({
    sections: [{ children: [table] }],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${filenamePrefix}.docx`)
}

export function exportLeaderGoalsHTML(rows: LeaderGoalRow[], filenamePrefix = 'руководители'): void {
  const headersHtml = LEADER_EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${leaderRowToCells(row)
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('')
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(filenamePrefix)}</title>
  <style>
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #1e3a8a; color: #fff; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.html`)
}

export function exportGoalsHTML(rows: GoalRow[], filenamePrefix = 'ппр'): void {
  const headersHtml = EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${rowToCells(row)
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('')
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filenamePrefix)}</title>
  <style>
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #1e3a8a; color: #fff; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.html`)
}

/** Сериализация таблиц в текст для прикрепления к промпту в чате */
function escapeCsv(s: string, sep: string): string {
  const t = String(s ?? '').replace(/"/g, '""')
  return t.includes(sep) || t.includes('"') || t.includes('\n') ? `"${t}"` : t
}

export function serializeKpiRowsToText(rows: GoalRow[]): string {
  const headerLine = EXPORT_HEADERS.map((h) => escapeCsv(h, ',')).join(',')
  const dataLines = rows.map((row) => rowToCells(row).map((c) => escapeCsv(c, ',')).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export function serializePprRowsToText(rows: GoalRow[]): string {
  return serializeKpiRowsToText(rows)
}

export function serializeLeaderGoalsRowsToText(rows: LeaderGoalRow[]): string {
  const headerLine = LEADER_EXPORT_HEADERS.map((h) => escapeCsv(h, ';')).join(';')
  const dataLines = rows.map((row) => leaderRowToCells(row).map((c) => escapeCsv(c, ';')).join(';'))
  return [headerLine, ...dataLines].join('\n')
}

export const STRATEGY_EXPORT_HEADERS = [
  'Бизнес/блок',
  'Сегмент',
  'Стратегический приоритет',
  'Цель',
  'Инициатива',
  'Тип инициативы',
  'Ответственный исполнитель',
  'Участие других блоков',
  'Бюджет',
  'Начало',
  'Конец',
  'КПЭ',
  'ед. изм.',
  '2025: Целевое значение',
  '2026: Целевое значение',
  '2027: Целевое значение',
]

function strategyRowToCells(row: StrategyGoalRow): string[] {
  return [
    row.businessUnit ?? '',
    row.segment ?? '',
    row.strategicPriority ?? '',
    row.goalObjective ?? '',
    row.initiative ?? '',
    row.initiativeType ?? '',
    row.responsiblePersonOwner ?? '',
    row.otherUnitsInvolved ?? '',
    row.budget ?? '',
    row.startDate ?? '',
    row.endDate ?? '',
    row.kpi ?? '',
    row.unitOfMeasure ?? '',
    row.targetValue2025 ?? '',
    row.targetValue2026 ?? '',
    row.targetValue2027 ?? '',
  ]
}

export function exportStrategyGoalsCSV(rows: StrategyGoalRow[], filenamePrefix = 'цели-стратегии'): void {
  const escape = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t
  }
  const headerLine = STRATEGY_EXPORT_HEADERS.map(escape).join(',')
  const dataLines = rows.map((row) => strategyRowToCells(row).map(escape).join(','))
  const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.csv`)
}

export function exportStrategyGoalsExcel(rows: StrategyGoalRow[], filenamePrefix = 'цели-стратегии'): void {
  const ws = buildStyledSheet(STRATEGY_EXPORT_HEADERS, rows.map((row) => strategyRowToCells(row)))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, filenamePrefix)
  XLSX.writeFile(wb, `${filenamePrefix}.xlsx`)
}

export async function exportStrategyGoalsPDF(rows: StrategyGoalRow[], filenamePrefix = 'цели-стратегии'): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fontLoaded = await loadCyrillicFont(doc)
  if (fontLoaded) doc.setFont(FONT_NAME)
  const body = rows.map((row) => strategyRowToCells(row))
  const tableStyles: Record<string, unknown> = { fontSize: 7 }
  if (fontLoaded) tableStyles.font = FONT_NAME
  autoTable(doc, {
    head: [STRATEGY_EXPORT_HEADERS],
    body,
    styles: tableStyles,
    margin: { left: 8, right: 8 },
  })
  doc.save(`${filenamePrefix}.pdf`)
}

export async function exportStrategyGoalsDOCX(rows: StrategyGoalRow[], filenamePrefix = 'цели-стратегии'): Promise<void> {
  const tableRows = [
    new TableRow({
      children: STRATEGY_EXPORT_HEADERS.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            width: { size: 6, type: WidthType.PERCENTAGE },
          })
      ),
      tableHeader: true,
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: strategyRowToCells(row).map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cell || '—' })] })],
                width: { size: 6, type: WidthType.PERCENTAGE },
              })
          ),
        })
    ),
  ]
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  })
  const doc = new Document({ sections: [{ children: [table] }] })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${filenamePrefix}.docx`)
}

export function exportStrategyGoalsHTML(rows: StrategyGoalRow[], filenamePrefix = 'цели-стратегии'): void {
  const headersHtml = STRATEGY_EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${strategyRowToCells(row)
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('')
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(filenamePrefix)}</title>
  <style>
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #1e3a8a; color: #fff; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.html`)
}

export function serializeStrategyGoalsRowsToText(rows: StrategyGoalRow[]): string {
  const headerLine = STRATEGY_EXPORT_HEADERS.map((h) => escapeCsv(h, ';')).join(';')
  const dataLines = rows.map((row) => strategyRowToCells(row).map((c) => escapeCsv(c, ';')).join(';'))
  return [headerLine, ...dataLines].join('\n')
}

export const STAFF_EXPORT_HEADERS = [
  'Код оргструктуры',
  'Наименование',
  'Руководитель',
  'Бизнес юнит',
  'Куратор ф. блока',
]

function staffRowToCells(row: StaffRow): string[] {
  return [
    row.orgStructureCode ?? '',
    row.unitName ?? '',
    row.head ?? '',
    row.businessUnit ?? '',
    row.functionalBlockCurator ?? '',
  ]
}

export function exportStaffCSV(rows: StaffRow[], filenamePrefix = 'штатное-расписание'): void {
  const escape = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t
  }
  const headerLine = STAFF_EXPORT_HEADERS.map(escape).join(',')
  const dataLines = rows.map((row) => staffRowToCells(row).map(escape).join(','))
  const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.csv`)
}

export function exportStaffExcel(rows: StaffRow[], filenamePrefix = 'штатное-расписание'): void {
  const ws = buildStyledSheet(STAFF_EXPORT_HEADERS, rows.map((row) => staffRowToCells(row)))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, filenamePrefix)
  XLSX.writeFile(wb, `${filenamePrefix}.xlsx`)
}

export async function exportStaffPDF(rows: StaffRow[], filenamePrefix = 'штатное-расписание'): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fontLoaded = await loadCyrillicFont(doc)
  if (fontLoaded) doc.setFont(FONT_NAME)
  const body = rows.map((row) => staffRowToCells(row))
  const tableStyles: Record<string, unknown> = { fontSize: 8 }
  if (fontLoaded) tableStyles.font = FONT_NAME
  autoTable(doc, {
    head: [STAFF_EXPORT_HEADERS],
    body,
    styles: tableStyles,
    margin: { left: 10, right: 10 },
  })
  doc.save(`${filenamePrefix}.pdf`)
}

export async function exportStaffDOCX(rows: StaffRow[], filenamePrefix = 'штатное-расписание'): Promise<void> {
  const tableRows = [
    new TableRow({
      children: STAFF_EXPORT_HEADERS.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE },
          })
      ),
      tableHeader: true,
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: staffRowToCells(row).map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cell || '—' })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
              })
          ),
        })
    ),
  ]
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  })
  const doc = new Document({ sections: [{ children: [table] }] })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${filenamePrefix}.docx`)
}

export function exportStaffHTML(rows: StaffRow[], filenamePrefix = 'штатное-расписание'): void {
  const headersHtml = STAFF_EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${staffRowToCells(row)
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('')
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(filenamePrefix)}</title>
  <style>
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #1e3a8a; color: #fff; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.html`)
}

export const PROCESS_REGISTRY_EXPORT_HEADERS = [
  'Процессная область',
  'Код процесса',
  'Процесс',
  'Владелец процесса',
  'Руководитель',
  'Бизнес юнит',
  'ТОП 20',
]

function processRegistryRowToCells(row: ProcessRegistryRow): string[] {
  return [
    row.processArea ?? '',
    row.processCode ?? '',
    row.process ?? '',
    row.processOwner ?? '',
    row.leader ?? '',
    row.businessUnit ?? '',
    row.top20 ?? '',
  ]
}

export function exportProcessRegistryCSV(rows: ProcessRegistryRow[], filenamePrefix = 'реестр-процессов'): void {
  const escape = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t
  }
  const headerLine = PROCESS_REGISTRY_EXPORT_HEADERS.map(escape).join(',')
  const dataLines = rows.map((row) => processRegistryRowToCells(row).map(escape).join(','))
  const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.csv`)
}

export function exportProcessRegistryExcel(rows: ProcessRegistryRow[], filenamePrefix = 'реестр-процессов'): void {
  const ws = buildStyledSheet(PROCESS_REGISTRY_EXPORT_HEADERS, rows.map((row) => processRegistryRowToCells(row)))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, filenamePrefix)
  XLSX.writeFile(wb, `${filenamePrefix}.xlsx`)
}

export async function exportProcessRegistryPDF(rows: ProcessRegistryRow[], filenamePrefix = 'реестр-процессов'): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fontLoaded = await loadCyrillicFont(doc)
  if (fontLoaded) doc.setFont(FONT_NAME)
  const body = rows.map((row) => processRegistryRowToCells(row))
  const tableStyles: Record<string, unknown> = { fontSize: 8 }
  if (fontLoaded) tableStyles.font = FONT_NAME
  autoTable(doc, {
    head: [PROCESS_REGISTRY_EXPORT_HEADERS],
    body,
    styles: tableStyles,
    margin: { left: 10, right: 10 },
  })
  doc.save(`${filenamePrefix}.pdf`)
}

export async function exportProcessRegistryDOCX(rows: ProcessRegistryRow[], filenamePrefix = 'реестр-процессов'): Promise<void> {
  const tableRows = [
    new TableRow({
      children: PROCESS_REGISTRY_EXPORT_HEADERS.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            width: { size: 14, type: WidthType.PERCENTAGE },
          })
      ),
      tableHeader: true,
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: processRegistryRowToCells(row).map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cell || '—' })] })],
                width: { size: 14, type: WidthType.PERCENTAGE },
              })
          ),
        })
    ),
  ]
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  })
  const doc = new Document({ sections: [{ children: [table] }] })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${filenamePrefix}.docx`)
}

export function exportProcessRegistryHTML(rows: ProcessRegistryRow[], filenamePrefix = 'реестр-процессов'): void {
  const headersHtml = PROCESS_REGISTRY_EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${processRegistryRowToCells(row)
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('')
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(filenamePrefix)}</title>
  <style>
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #1e3a8a; color: #fff; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `${filenamePrefix}.html`)
}
