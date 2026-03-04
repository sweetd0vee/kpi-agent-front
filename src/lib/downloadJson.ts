const DEFAULT_NAME = 'checklist'

const sanitizeBaseName = (name: string): string => {
  const trimmed = name.trim()
  if (!trimmed) return DEFAULT_NAME
  const withoutExt = trimmed.replace(/\.[^/.]+$/, '')
  const safe = withoutExt.replace(/[\\\/]+/g, '-').trim()
  return safe || DEFAULT_NAME
}

export function downloadJsonFile(data: unknown, filenameBase: string): void {
  const base = sanitizeBaseName(filenameBase)
  const filename = `${base}.json`
  const payload = JSON.stringify(data, null, 2)
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
