/**
 * Выгрузка таблицы целей из ответа LLM (бэкенд извлекает РАЗДЕЛ 8 и отдаёт xlsx).
 * URL бэкенда: VITE_API_URL или относительный /api (через proxy в dev и reverse proxy в prod).
 */

const getBaseUrl = (): string => {
  const env = (import.meta.env?.VITE_API_URL as string)?.trim() || ''
  if (env) return env.replace(/\/$/, '')
  return ''
}

/**
 * Запросить xlsx с целями, извлечёнными из текста ответа LLM.
 * При успехе возвращает blob и имя файла из Content-Disposition (или по умолчанию).
 */
export async function exportGoalsXlsx(content: string): Promise<{ blob: Blob; filename: string }> {
  const base = getBaseUrl()
  const url = base ? `${base}/api/chat/export-goals` : '/api/chat/export-goals'
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(msg || 'Failed to fetch. Проверьте, что бэкенд запущен (порт 8000) и доступен.')
  }
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try {
      const j = JSON.parse(text) as { detail?: string | unknown }
      if (j.detail != null) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      // leave detail as text
    }
    if (res.status === 500) {
      console.error('[export-goals] 500:', detail)
    }
    throw new Error(detail || `Ошибка ${res.status}`)
  }
  const blob = await res.blob()
  let filename = 'цели.xlsx'
  const disp = res.headers.get('Content-Disposition')
  if (disp) {
    const m = /filename="?([^";\n]+)"?/.exec(disp)
    if (m) filename = m[1].trim()
  }
  return { blob, filename }
}

/** Проверить, похож ли текст на ответ с таблицей целей (Раздел 8 / CSV / Markdown). */
export function contentHasGoalsTable(content: string): boolean {
  if (!content || typeof content !== 'string') return false
  const lower = content.toLowerCase()
  if (lower.includes('раздел 8') || lower.includes('таблица целей')) return true
  if (content.includes(';') && (lower.includes('кпэ') || lower.includes('цел') || lower.includes('цели'))) return true
  // Markdown-таблица: строка с | и признаками колонок целей
  if (content.includes('|') && (lower.includes('кпэ') || lower.includes('наименование') || lower.includes('фио'))) return true
  return false
}
