import type { GoalRow } from '@/lib/storage'
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
import * as XLSX from 'xlsx'

const EXPORT_HEADERS = ['ФИО', 'SCAI Цель', 'Метрические цели', 'вес квартал', 'вес год', '1 квартал', '2 квартал', '3 квартал', '4 квартал', 'Год']

function rowToCells(row: GoalRow): string[] {
  return [
    row.lastName ?? '',
    row.goal ?? '',
    row.metricGoals ?? '',
    row.weightQ ?? '',
    row.weightYear ?? '',
    row.q1 ?? '',
    row.q2 ?? '',
    row.q3 ?? '',
    row.q4 ?? '',
    row.year ?? '',
  ]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
  const data = [EXPORT_HEADERS, ...rows.map((row) => rowToCells(row))]
  const ws = XLSX.utils.aoa_to_sheet(data)
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
