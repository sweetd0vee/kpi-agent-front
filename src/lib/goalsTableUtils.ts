/** Общие функции для фильтров и опций в таблицах целей (КПЭ-стиль). */

export function formatFilterValue(value: string): string {
  return value ? value : 'Пусто'
}

export function buildSelectedLabel(
  values: string[],
  emptyLabel: string,
  formatValue: (value: string) => string = (v) => v
): string {
  if (values.length === 0) return emptyLabel
  if (values.length <= 2) return values.map(formatValue).join(', ')
  return `${values.slice(0, 2).map(formatValue).join(', ')} +${values.length - 2}`
}

/** Уникальные значения колонки для мультиселекта, с пустым значением первым при необходимости. */
export function buildDistinctColumnOptions<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  collator: Intl.Collator
): string[] {
  const unique = new Set<string>()
  let hasEmpty = false
  rows.forEach((row) => {
    const value = String(row[key] ?? '').trim()
    if (value) unique.add(value)
    else hasEmpty = true
  })
  const sorted = Array.from(unique).sort((a, b) => collator.compare(a, b))
  return hasEmpty ? [''].concat(sorted) : sorted
}

export function createRuNumericCollator(): Intl.Collator {
  return new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })
}
