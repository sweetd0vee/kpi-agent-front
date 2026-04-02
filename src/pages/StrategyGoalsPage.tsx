import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStrategyGoalRows, saveStrategyGoalRows } from '@/api/goals'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import { EditStrategyGoalModal, type EditStrategyGoalField } from '@/components/EditStrategyGoalModal/EditStrategyGoalModal'
import { PlusIcon, TrashIcon, PencilIcon } from '@/components/Icons'
import { useColumnResize } from '@/hooks/useColumnResize'
import {
  exportStrategyGoalsCSV,
  exportStrategyGoalsDOCX,
  exportStrategyGoalsExcel,
  exportStrategyGoalsHTML,
  exportStrategyGoalsPDF,
  serializeStrategyGoalsRowsToText,
} from '@/lib/exportGoals'
import {
  buildDistinctColumnOptions,
  buildSelectedLabel,
  createRuNumericCollator,
  formatFilterValue,
} from '@/lib/goalsTableUtils'
import { parseStrategyGoalsXlsxToRows } from '@/lib/importGoals'
import { addAttachable, generateId, getDefaultAttachableLabel, type StrategyGoalRow } from '@/lib/storage'
import styles from './GoalsPage.module.css'

type StrategyGoalField = keyof Omit<StrategyGoalRow, 'id'>

type Column = {
  key: StrategyGoalField
  label: string
  placeholder: string
  cellClassName?: string
  inputClassName?: string
  valueClassName?: string
  multiline?: boolean
}

const COLUMNS: Column[] = [
  { key: 'businessUnit', label: 'Бизнес/блок', placeholder: '', cellClassName: styles.colGoal },
  { key: 'segment', label: 'Сегмент', placeholder: '', cellClassName: styles.colWeight },
  { key: 'strategicPriority', label: 'Стратегический приоритет', placeholder: '', cellClassName: styles.colGoal, multiline: true, valueClassName: styles.valueMultiline },
  { key: 'goalObjective', label: 'Цель', placeholder: '', cellClassName: styles.colMetricGoals, multiline: true, valueClassName: styles.valueMultiline },
  { key: 'initiative', label: 'Инициатива', placeholder: '', cellClassName: styles.colMetricGoals, multiline: true, valueClassName: styles.valueMultiline },
  { key: 'initiativeType', label: 'Тип инициативы', placeholder: '', cellClassName: styles.colWeight },
  { key: 'responsiblePersonOwner', label: 'Ответственный исполнитель', placeholder: '', cellClassName: styles.colSurname },
  { key: 'otherUnitsInvolved', label: 'Участие других блоков', placeholder: '', cellClassName: styles.colGoal, multiline: true, valueClassName: styles.valueMultiline },
  { key: 'budget', label: 'Бюджет', placeholder: '', cellClassName: styles.colWeight, valueClassName: styles.valueCenter },
  { key: 'startDate', label: 'Начало', placeholder: 'ДД.ММ.ГГГГ', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'endDate', label: 'Конец', placeholder: 'ДД.ММ.ГГГГ', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'kpi', label: 'КПЭ', placeholder: '', cellClassName: styles.colGoal, multiline: true, valueClassName: styles.valueMultiline },
  { key: 'unitOfMeasure', label: 'ед. изм.', placeholder: '', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'targetValue2025', label: '2025: Целевое значение', placeholder: '', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'targetValue2026', label: '2026: Целевое значение', placeholder: '', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'targetValue2027', label: '2027: Целевое значение', placeholder: '', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
]

const createRow = (): StrategyGoalRow => ({
  id: generateId(),
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
})

const DEFAULT_PAGE_SIZE = 15
const FILTER_SELECT_FIELDS: StrategyGoalField[] = ['businessUnit', 'segment', 'initiativeType']
const FILTER_DISABLED_FIELDS: StrategyGoalField[] = ['goalObjective', 'initiative', 'strategicPriority', 'kpi']
/** Колонки без строки фильтра (данные в таблице и в модалке сохраняются). */
const FILTER_HIDDEN_FIELDS: StrategyGoalField[] = [
  'otherUnitsInvolved',
  'budget',
  'startDate',
  'endDate',
  'unitOfMeasure',
]

const createFiltersState = (): Record<StrategyGoalField, string> => ({
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
})

export function StrategyGoalsPage() {
  const [state, setState] = useState<{ rows: StrategyGoalRow[] }>({ rows: [] })
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<StrategyGoalRow | null>(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<StrategyGoalField, string>>(createFiltersState)
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string[]>([])
  const [segmentFilter, setSegmentFilter] = useState<string[]>([])
  const [initiativeTypeFilter, setInitiativeTypeFilter] = useState<string[]>([])
  const [businessUnitOpen, setBusinessUnitOpen] = useState(false)
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [initiativeTypeOpen, setInitiativeTypeOpen] = useState(false)
  const [sortKey, setSortKey] = useState<StrategyGoalField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [savedToChatToast, setSavedToChatToast] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingClearTable, setPendingClearTable] = useState(false)
  const [isAddingNewRow, setIsAddingNewRow] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState<number | 'all'>(DEFAULT_PAGE_SIZE)
  const { colWidths, startColumnResize } = useColumnResize(editingRowId)
  const skipSyncRef = useRef(true)
  const exportDropdownRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const businessUnitRef = useRef<HTMLDivElement>(null)
  const segmentRef = useRef<HTMLDivElement>(null)
  const initiativeTypeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getStrategyGoalRows()
      .then((rows) => {
        if (!active) return
        setState({ rows })
        setDataError(null)
        setIsLoaded(true)
        skipSyncRef.current = true
      })
      .catch((err) => {
        if (!active) return
        setDataError(err instanceof Error ? err.message : 'Не удалось загрузить данные.')
        setIsLoaded(true)
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    void saveStrategyGoalRows(state.rows)
      .then(() => setDataError(null))
      .catch((err) => {
        setDataError(err instanceof Error ? err.message : 'Не удалось сохранить данные.')
      })
  }, [isLoaded, state])

  const normalizedFilters = useMemo(
    () =>
      (Object.entries(filters) as Array<[StrategyGoalField, string]>)
        .map(([key, value]) => [key, value.trim().toLowerCase()] as const)
        .filter(
          ([key, value]) =>
            value.length > 0 &&
            !FILTER_DISABLED_FIELDS.includes(key) &&
            !FILTER_SELECT_FIELDS.includes(key) &&
            !FILTER_HIDDEN_FIELDS.includes(key)
        ),
    [filters]
  )

  const filteredRows = state.rows.filter((row) => {
    const matchesText = normalizedFilters.every(([key, value]) => String(row[key] ?? '').toLowerCase().includes(value))
    if (!matchesText) return false
    if (businessUnitFilter.length > 0 && !businessUnitFilter.includes(String(row.businessUnit ?? '').trim())) return false
    if (segmentFilter.length > 0 && !segmentFilter.includes(String(row.segment ?? '').trim())) return false
    if (initiativeTypeFilter.length > 0 && !initiativeTypeFilter.includes(String(row.initiativeType ?? '').trim())) return false
    return true
  })

  const hasActiveFilters =
    normalizedFilters.length > 0 ||
    businessUnitFilter.length > 0 ||
    segmentFilter.length > 0 ||
    initiativeTypeFilter.length > 0

  const resetFilters = useCallback(() => {
    setFilters(createFiltersState())
    setBusinessUnitFilter([])
    setSegmentFilter([])
    setInitiativeTypeFilter([])
    setBusinessUnitOpen(false)
    setSegmentOpen(false)
    setInitiativeTypeOpen(false)
  }, [])

  const updateFilter = useCallback((key: StrategyGoalField, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const collator = useMemo(() => createRuNumericCollator(), [])
  const businessUnitOptions = useMemo(
    () => buildDistinctColumnOptions(state.rows, 'businessUnit', collator),
    [state.rows, collator]
  )
  const segmentOptions = useMemo(
    () => buildDistinctColumnOptions(state.rows, 'segment', collator),
    [state.rows, collator]
  )
  const initiativeTypeOptions = useMemo(
    () => buildDistinctColumnOptions(state.rows, 'initiativeType', collator),
    [state.rows, collator]
  )
  useEffect(() => setBusinessUnitFilter((prev) => prev.filter((value) => businessUnitOptions.includes(value))), [businessUnitOptions])
  useEffect(() => setSegmentFilter((prev) => prev.filter((value) => segmentOptions.includes(value))), [segmentOptions])
  useEffect(() => setInitiativeTypeFilter((prev) => prev.filter((value) => initiativeTypeOptions.includes(value))), [initiativeTypeOptions])

  const toggleBusinessUnit = useCallback((value: string) => {
    setBusinessUnitFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort((a, b) => collator.compare(a, b))))
  }, [collator])
  const toggleSegment = useCallback((value: string) => {
    setSegmentFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort((a, b) => collator.compare(a, b))))
  }, [collator])
  const toggleInitiativeType = useCallback((value: string) => {
    setInitiativeTypeFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort((a, b) => collator.compare(a, b))))
  }, [collator])

  const businessUnitLabel = useMemo(() => buildSelectedLabel(businessUnitFilter, 'Все блоки'), [businessUnitFilter])
  const segmentLabel = useMemo(() => buildSelectedLabel(segmentFilter, 'Все сегменты', formatFilterValue), [segmentFilter])
  const initiativeTypeLabel = useMemo(() => buildSelectedLabel(initiativeTypeFilter, 'Все типы', formatFilterValue), [initiativeTypeFilter])
  const allBusinessUnitsSelected = businessUnitOptions.length > 0 && businessUnitFilter.length === businessUnitOptions.length
  const allSegmentsSelected = segmentOptions.length > 0 && segmentFilter.length === segmentOptions.length
  const allInitiativeTypesSelected = initiativeTypeOptions.length > 0 && initiativeTypeFilter.length === initiativeTypeOptions.length

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows
    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const valueA = String(a.row[sortKey] ?? '').trim()
        const valueB = String(b.row[sortKey] ?? '').trim()
        const emptyA = valueA.length === 0
        const emptyB = valueB.length === 0
        if (emptyA && emptyB) return a.index - b.index
        if (emptyA) return 1
        if (emptyB) return -1
        const result = collator.compare(valueA, valueB)
        if (result === 0) return a.index - b.index
        return sortDirection === 'asc' ? result : -result
      })
      .map((item) => item.row)
  }, [collator, filteredRows, sortDirection, sortKey])

  const pageSizeNumber = pageSize === 'all' ? (sortedRows.length || 1) : pageSize
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(sortedRows.length / pageSizeNumber))
  const pageStart = (page - 1) * pageSizeNumber
  const pageRows = pageSize === 'all' ? sortedRows : sortedRows.slice(pageStart, pageStart + pageSizeNumber)

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])
  useEffect(() => {
    setPage(1)
  }, [filters, businessUnitFilter, segmentFilter, initiativeTypeFilter, sortDirection, sortKey, pageSize])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) setExportDropdownOpen(false)
    }
    if (exportDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [exportDropdownOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const insideBusiness = businessUnitRef.current?.contains(target)
      const insideSegment = segmentRef.current?.contains(target)
      const insideInitiativeType = initiativeTypeRef.current?.contains(target)
      if (!insideBusiness && !insideSegment && !insideInitiativeType) {
        setBusinessUnitOpen(false)
        setSegmentOpen(false)
        setInitiativeTypeOpen(false)
      }
    }
    if (businessUnitOpen || segmentOpen || initiativeTypeOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [businessUnitOpen, segmentOpen, initiativeTypeOpen])

  const handleExport = useCallback((format: 'csv' | 'xlsx' | 'pdf' | 'docx' | 'html') => {
    setExportDropdownOpen(false)
    const rows = sortedRows
    if (format === 'csv') exportStrategyGoalsCSV(rows)
    else if (format === 'xlsx') exportStrategyGoalsExcel(rows)
    else if (format === 'html') exportStrategyGoalsHTML(rows)
    else if (format === 'pdf') {
      exportStrategyGoalsPDF(rows).catch((err) => {
        console.error('Ошибка экспорта PDF:', err)
        alert('Не удалось создать PDF. Проверьте консоль браузера (F12).')
      })
    } else if (format === 'docx') {
      exportStrategyGoalsDOCX(rows).catch((err) => {
        console.error('Ошибка экспорта DOCX:', err)
        alert('Не удалось создать DOCX. Проверьте консоль браузера (F12).')
      })
    }
  }, [sortedRows])

  const handleImportClick = useCallback(() => {
    if (!isLoaded || isLoading) return
    setImportError(null)
    importInputRef.current?.click()
  }, [isLoaded, isLoading])

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (!isLoaded || isLoading) {
        setImportError('Дождитесь окончания загрузки таблицы с сервера.')
        return
      }
      if (!/\.xlsx$/i.test(file.name)) {
        setImportError('Выберите файл .xlsx')
        return
      }
      parseStrategyGoalsXlsxToRows(file)
        .then((rows) => {
          if (rows.length === 0) {
            setImportError('В файле нет данных или заголовки не совпадают.')
            return
          }
          setState((prev) => {
            const merged = [...prev.rows, ...rows]
            queueMicrotask(() => {
              skipSyncRef.current = true
              void saveStrategyGoalRows(merged)
                .then(() => setDataError(null))
                .catch((err) => {
                  setDataError(
                    err instanceof Error
                      ? err.message
                      : 'Не удалось сохранить данные в базу. Запущен ли backend и доступна ли PostgreSQL?'
                  )
                  skipSyncRef.current = false
                })
            })
            return { rows: merged }
          })
          setImportError(null)
        })
        .catch((err) => setImportError(err instanceof Error ? err.message : 'Ошибка загрузки файла'))
    },
    [isLoaded, isLoading]
  )

  const editFields: EditStrategyGoalField[] = COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
    placeholder: column.placeholder || '',
    multiline: Boolean(column.multiline),
  }))

  const filterableColumns = COLUMNS.filter(
    (col) => !FILTER_DISABLED_FIELDS.includes(col.key) && !FILTER_HIDDEN_FIELDS.includes(col.key)
  )

  const addRow = useCallback(() => {
    const newRow = createRow()
    setState((prev) => ({ ...prev, rows: [...prev.rows, newRow] }))
    setEditingRowId(newRow.id)
    setEditingDraft(newRow)
    setIsAddingNewRow(true)
  }, [])

  const handleSort = useCallback((key: StrategyGoalField) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDirection('asc')
      return key
    })
  }, [])

  const startEdit = useCallback((row: StrategyGoalRow) => {
    setEditingRowId(row.id)
    setEditingDraft({ ...row })
  }, [])

  const cancelEdit = useCallback(() => {
    if (isAddingNewRow && editingRowId) {
      setState((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== editingRowId) }))
    }
    setIsAddingNewRow(false)
    setEditingRowId(null)
    setEditingDraft(null)
  }, [editingRowId, isAddingNewRow])

  const saveEdit = useCallback((draft: StrategyGoalRow) => {
    if (!editingRowId) return
    setState((prev) => ({ ...prev, rows: prev.rows.map((row) => (row.id === editingRowId ? draft : row)) }))
    setIsAddingNewRow(false)
    setEditingRowId(null)
    setEditingDraft(null)
  }, [editingRowId])

  const deleteRow = useCallback((id: string) => {
    setState((prev) => ({ ...prev, rows: prev.rows.filter((row) => row.id !== id) }))
    if (editingRowId === id) {
      setEditingRowId(null)
      setEditingDraft(null)
    }
  }, [editingRowId])

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) deleteRow(pendingDeleteId)
    setPendingDeleteId(null)
  }, [deleteRow, pendingDeleteId])

  const confirmClearTable = useCallback(() => {
    setState({ rows: [] })
    setPage(1)
    setPendingClearTable(false)
  }, [])

  const buildFilterDescription = useCallback((): string | undefined => {
    const parts: string[] = []
    if (businessUnitFilter.length > 0) parts.push(`Бизнес/блок: ${businessUnitFilter.join(', ')}`)
    if (segmentFilter.length > 0) parts.push(`Сегмент: ${segmentFilter.map(formatFilterValue).join(', ')}`)
    if (initiativeTypeFilter.length > 0) parts.push(`Тип инициативы: ${initiativeTypeFilter.map(formatFilterValue).join(', ')}`)
    const textFilterKeys = COLUMNS.map((c) => c.key).filter(
      (key) => !FILTER_SELECT_FIELDS.includes(key) && !FILTER_HIDDEN_FIELDS.includes(key)
    )
    const columnByKey = Object.fromEntries(COLUMNS.map((c) => [c.key, c]))
    for (const key of textFilterKeys) {
      const v = (filters[key] ?? '').trim()
      if (v) parts.push(`${columnByKey[key]?.label ?? key}: ${v}`)
    }
    return parts.length > 0 ? parts.join('; ') : undefined
  }, [businessUnitFilter, filters, initiativeTypeFilter, segmentFilter])

  const saveToChatContext = useCallback(() => {
    const content = serializeStrategyGoalsRowsToText(sortedRows)
    if (!content.trim()) return
    const label = getDefaultAttachableLabel('strategy_goals')
    const filterDescription = buildFilterDescription()
    addAttachable({ type: 'strategy_goals', label, content, filterDescription })
    setSavedToChatToast(true)
    setTimeout(() => setSavedToChatToast(false), 2500)
  }, [buildFilterDescription, sortedRows])

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>Цели стратегии</h1>
        </div>
      </header>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div className={styles.sectionSpacer} aria-hidden />
          <div className={styles.sectionActions}>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              className={styles.hiddenInput}
              aria-hidden
              onChange={handleImportFile}
            />
            <button
              type="button"
              className={styles.importBtn}
              onClick={handleImportClick}
              disabled={!!editingRowId || !isLoaded || isLoading}
              title={!isLoaded || isLoading ? 'Дождитесь загрузки таблицы' : 'Импорт из xlsx'}
            >
              Импортировать
            </button>
            <button
              type="button"
              className={styles.clearTableBtn}
              onClick={() => setPendingClearTable(true)}
              disabled={state.rows.length === 0 || !!editingRowId}
              title="Удалить все записи в таблице"
            >
              Очистить таблицу
            </button>
            <button type="button" className={styles.addBtn} onClick={addRow} aria-label="Добавить строку" title="Добавить строку">
              <PlusIcon className={styles.addBtnIcon} />
            </button>
          </div>
        </header>

        {dataError && (
          <div className={styles.importError} role="alert">
            {dataError}
          </div>
        )}
        {isLoading && !dataError && (
          <div className={styles.importError} role="status">
            Загрузка данных...
          </div>
        )}
        {importError && (
          <div className={styles.importError} role="alert">
            {importError}
          </div>
        )}

        <div className={styles.filtersPanel}>
          <div className={styles.filtersGrid}>
            {filterableColumns.map((col) =>
              col.key === 'businessUnit' ? (
                <div key={col.key} className={`${styles.filterField} ${styles.filterSelect}`} ref={businessUnitRef}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <button type="button" className={styles.filterSelectButton} onClick={() => { setBusinessUnitOpen((v) => !v); setSegmentOpen(false); setInitiativeTypeOpen(false) }} disabled={!!editingRowId} aria-expanded={businessUnitOpen} aria-haspopup="listbox">
                    <span className={styles.filterSelectText}>{businessUnitLabel}</span>
                    <span className={styles.filterSelectCaret} aria-hidden />
                  </button>
                  {businessUnitOpen && (
                    <div className={styles.filterSelectMenu} role="listbox" aria-label="Бизнес/блок">
                      {businessUnitOptions.length === 0 ? <div className={styles.filterSelectEmpty}>Нет данных</div> : (
                        <>
                          <label className={styles.filterSelectOption}>
                            <input type="checkbox" checked={allBusinessUnitsSelected} onChange={() => setBusinessUnitFilter((prev) => prev.length === businessUnitOptions.length ? [] : [...businessUnitOptions])} />
                            <span>Выбрать все</span>
                          </label>
                          {businessUnitOptions.map((value) => (
                            <label key={value} className={styles.filterSelectOption}>
                              <input type="checkbox" checked={businessUnitFilter.includes(value)} onChange={() => toggleBusinessUnit(value)} />
                              <span>{formatFilterValue(value)}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : col.key === 'segment' ? (
                <div key={col.key} className={`${styles.filterField} ${styles.filterSelect}`} ref={segmentRef}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <button type="button" className={styles.filterSelectButton} onClick={() => { setSegmentOpen((v) => !v); setBusinessUnitOpen(false); setInitiativeTypeOpen(false) }} disabled={!!editingRowId} aria-expanded={segmentOpen} aria-haspopup="listbox">
                    <span className={styles.filterSelectText}>{segmentLabel}</span>
                    <span className={styles.filterSelectCaret} aria-hidden />
                  </button>
                  {segmentOpen && (
                    <div className={styles.filterSelectMenu} role="listbox" aria-label="Сегмент">
                      {segmentOptions.length === 0 ? <div className={styles.filterSelectEmpty}>Нет данных</div> : (
                        <>
                          <label className={styles.filterSelectOption}>
                            <input type="checkbox" checked={allSegmentsSelected} onChange={() => setSegmentFilter((prev) => prev.length === segmentOptions.length ? [] : [...segmentOptions])} />
                            <span>Выбрать все</span>
                          </label>
                          {segmentOptions.map((value) => (
                            <label key={value} className={styles.filterSelectOption}>
                              <input type="checkbox" checked={segmentFilter.includes(value)} onChange={() => toggleSegment(value)} />
                              <span>{formatFilterValue(value)}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : col.key === 'initiativeType' ? (
                <div key={col.key} className={`${styles.filterField} ${styles.filterSelect}`} ref={initiativeTypeRef}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <button type="button" className={styles.filterSelectButton} onClick={() => { setInitiativeTypeOpen((v) => !v); setBusinessUnitOpen(false); setSegmentOpen(false) }} disabled={!!editingRowId} aria-expanded={initiativeTypeOpen} aria-haspopup="listbox">
                    <span className={styles.filterSelectText}>{initiativeTypeLabel}</span>
                    <span className={styles.filterSelectCaret} aria-hidden />
                  </button>
                  {initiativeTypeOpen && (
                    <div className={styles.filterSelectMenu} role="listbox" aria-label="Тип инициативы">
                      {initiativeTypeOptions.length === 0 ? <div className={styles.filterSelectEmpty}>Нет данных</div> : (
                        <>
                          <label className={styles.filterSelectOption}>
                            <input type="checkbox" checked={allInitiativeTypesSelected} onChange={() => setInitiativeTypeFilter((prev) => prev.length === initiativeTypeOptions.length ? [] : [...initiativeTypeOptions])} />
                            <span>Выбрать все</span>
                          </label>
                          {initiativeTypeOptions.map((value) => (
                            <label key={value} className={styles.filterSelectOption}>
                              <input type="checkbox" checked={initiativeTypeFilter.includes(value)} onChange={() => toggleInitiativeType(value)} />
                              <span>{formatFilterValue(value)}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label key={col.key} className={styles.filterField}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <input
                    type="search"
                    className={styles.filterInput}
                    value={filters[col.key]}
                    onChange={(e) => updateFilter(col.key, e.target.value)}
                    placeholder={col.placeholder || 'Фильтр'}
                    disabled={!!editingRowId}
                  />
                </label>
              )
            )}
          </div>
          <div className={styles.filtersActions}>
            <button
              type="button"
              className={styles.resetFiltersBtn}
              onClick={resetFilters}
              disabled={!!editingRowId || !hasActiveFilters}
              title="Сбросить все фильтры по колонкам"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.key} className={column.cellClassName} style={colWidths[column.key] ? { width: colWidths[column.key] } : undefined}>
                    <button type="button" className={styles.sortBtn} onClick={() => handleSort(column.key)} disabled={!!editingRowId} aria-label={`Сортировать по: ${column.label}`}>
                      <span className={styles.headerLabel}>{column.label}</span>
                      <span
                        className={[
                          styles.sortIndicator,
                          sortKey === column.key ? (sortDirection === 'asc' ? styles.sortIndicatorAsc : styles.sortIndicatorDesc) : styles.sortIndicatorInactive,
                        ].filter(Boolean).join(' ')}
                        aria-hidden
                      />
                    </button>
                    <div
                      className={styles.colResizeHandle}
                      role="separator"
                      aria-label={`Изменить ширину колонки: ${column.label}`}
                      onMouseDown={(e) => startColumnResize(column.key, e)}
                    />
                  </th>
                ))}
                <th className={styles.actionsCol}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={COLUMNS.length + 1}>
                    Пока нет показателей. Добавьте первую строку.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={COLUMNS.length + 1}>
                    Нет совпадений по фильтрам.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id}>
                    {COLUMNS.map((column) => {
                      const value = row[column.key] ?? ''
                      const isEmpty = !value.trim()
                      return (
                        <td key={column.key} className={column.cellClassName} style={colWidths[column.key] ? { width: colWidths[column.key] } : undefined}>
                          <span className={[styles.valueText, column.valueClassName ?? '', isEmpty ? styles.valueMuted : ''].filter(Boolean).join(' ')}>
                            {isEmpty ? '' : value}
                          </span>
                        </td>
                      )
                    })}
                    <td className={styles.actionsCell}>
                      <div className={styles.actionGroup}>
                        <button type="button" className={`${styles.iconBtn} ${styles.iconBtnEdit}`} onClick={() => startEdit(row)} disabled={!!editingRowId} aria-label="Редактировать строку" title="Редактировать">
                          <PencilIcon className={styles.pencilIcon} />
                        </button>
                        <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setPendingDeleteId(row.id)} aria-label="Удалить строку">
                          <TrashIcon className={styles.trashIcon} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.tableFooter}>
          <div className={styles.saveTableWrap}>
            <button type="button" className={styles.saveToChatBtn} onClick={saveToChatContext} disabled={sortedRows.length === 0 || !!editingRowId} title="Сохранить отфильтрованную таблицу для прикрепления в Чате">
              Сохранить таблицу
            </button>
            {savedToChatToast && <span className={styles.saveToChatToast}>Таблица сохранена в Базу знаний</span>}
          </div>

          <div className={styles.paginationSummary}>
            {sortedRows.length === 0 ? '0 записей' : (() => {
              const from = pageSize === 'all' ? 1 : pageStart + 1
              const to = pageSize === 'all' ? sortedRows.length : Math.min(sortedRows.length, pageStart + pageSizeNumber)
              const pageInfo = totalPages > 1 && pageSize !== 'all' ? `, стр. ${page} из ${totalPages}` : ''
              return `Записи ${from}–${to} из ${sortedRows.length}${pageInfo}`
            })()}
          </div>

          <div className={styles.exportWrap} ref={exportDropdownRef}>
            <button type="button" className={styles.exportBtn} onClick={() => setExportDropdownOpen((v) => !v)} disabled={!!editingRowId} aria-expanded={exportDropdownOpen} aria-haspopup="true">
              Экспорт
            </button>
            {exportDropdownOpen && (
              <div className={styles.exportDropdown}>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('pdf')}>PDF</button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('xlsx')}>EXCEL</button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('docx')}>DOCX</button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('csv')}>CSV</button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('html')}>HTML</button>
              </div>
            )}
          </div>

          <div className={styles.pageSizeWrap}>
            <label className={styles.pageSizeLabel}>
              Показывать по
              <select
                className={styles.pageSizeSelect}
                value={pageSize === 'all' ? 'all' : String(pageSize)}
                onChange={(e) => {
                  const value = e.target.value
                  setPage(1)
                  setPageSize(value === 'all' ? 'all' : Number(value))
                }}
                disabled={!!editingRowId}
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="all">Все</option>
              </select>
            </label>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination} aria-label="Пагинация таблицы">
              <button
                type="button"
                className={styles.paginationBtn}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1 || !!editingRowId}
                aria-label="Предыдущая страница"
              >
                ‹
              </button>
              {(() => {
                const pages: (number | 'ellipsis')[] = []
                if (totalPages <= 7) {
                  for (let p = 1; p <= totalPages; p += 1) pages.push(p)
                } else {
                  pages.push(1)
                  const left = Math.max(2, page - 1)
                  const right = Math.min(totalPages - 1, page + 1)
                  if (left > 2) pages.push('ellipsis')
                  for (let p = left; p <= right; p += 1) pages.push(p)
                  if (right < totalPages - 1) pages.push('ellipsis')
                  pages.push(totalPages)
                }
                return pages.map((p, index) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${index}`} className={styles.paginationEllipsis}>
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={p === page ? `${styles.paginationBtn} ${styles.paginationBtnActive}` : styles.paginationBtn}
                      onClick={() => setPage(p)}
                      disabled={!!editingRowId}
                    >
                      {p}
                    </button>
                  )
                )
              })()}
              <button
                type="button"
                className={styles.paginationBtn}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages || !!editingRowId}
                aria-label="Следующая страница"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={pendingDeleteId !== null}
        title="Удаление записи"
        message="Действительно удалить эту запись?"
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
        danger
      />

      <ConfirmModal
        open={pendingClearTable}
        title="Очистить таблицу"
        message="Удалить все записи в таблице «Цели стратегии»? Это действие нельзя отменить."
        confirmLabel="Очистить"
        cancelLabel="Отмена"
        onConfirm={confirmClearTable}
        onCancel={() => setPendingClearTable(false)}
        danger
      />

      <EditStrategyGoalModal
        open={editingRowId !== null}
        title={isAddingNewRow ? 'Новая запись' : 'Редактирование записи'}
        row={editingDraft}
        fields={editFields}
        onSave={saveEdit}
        onCancel={cancelEdit}
      />
    </div>
  )
}
