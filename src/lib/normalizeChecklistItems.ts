import type { DepartmentChecklistItem } from '@/api/documents'

/** Нормализация элементов чеклиста из произвольного JSON (шаблоны, импорт). */
export function normalizeChecklistItems(raw: unknown): DepartmentChecklistItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>
    return {
      id: String(obj.id ?? '').trim(),
      text: String(obj.text ?? '').trim(),
      section: String(obj.section ?? '').trim(),
      checked: Boolean(obj.checked),
    }
  })
}
