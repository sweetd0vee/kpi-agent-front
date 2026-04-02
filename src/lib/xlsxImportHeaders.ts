/**
 * Сопоставление заголовков колонок xlsx с полями строк: Excel часто даёт
 * неразрывные пробелы, «е» вместо «ё», другой регистр — без нормализации колонки «не находятся» и остаются пустыми.
 */

/** Приводит заголовок к каноническому виду для поиска в мапе */
export function normalizeHeaderForMatch(value: unknown): string {
  let s = String(value ?? '')
  s = s.replace(/^\uFEFF/, '')
  s = s.replace(/[\u00A0\u202F\u2007\u2009\u200B\uFEFF\t\r\n]+/g, ' ')
  s = s.replace(/\s*\/\s*/g, '/')
  s = s.replace(/\s*:\s*/g, ':')
  s = s.replace(/\s+/g, ' ')
  s = s.trim().toLowerCase()
  s = s.replace(/ё/g, 'е')
  return s
}

/** Строит функцию «заголовок ячейки → поле» по словарю канонических подписей (как в экспорте). */
export function buildHeaderFieldLookup<T extends string>(raw: Record<string, T>): (header: unknown) => T | undefined {
  const map = new Map<string, T>()
  for (const [k, v] of Object.entries(raw)) {
    map.set(normalizeHeaderForMatch(k), v as T)
  }
  return (header: unknown) => map.get(normalizeHeaderForMatch(header))
}
