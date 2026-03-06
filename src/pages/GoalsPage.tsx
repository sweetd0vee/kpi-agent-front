import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPprRows, savePprRows } from '@/api/goals'
import { generateId, type GoalRow } from '@/lib/storage'
import { exportGoalsCSV, exportGoalsDOCX, exportGoalsExcel, exportGoalsHTML, exportGoalsPDF } from '@/lib/exportGoals'
import { parseKpiXlsxToRows } from '@/lib/importGoals'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import { EditRowModal, type EditRowField } from '@/components/EditRowModal/EditRowModal'
import { PlusIcon, TrashIcon, PencilIcon } from '@/components/Icons'
import styles from './GoalsPage.module.css'

type GoalField = keyof Omit<GoalRow, 'id'>

const PAGE_SIZE = 15

type Column = {
  key: GoalField
  label: string
  placeholder: string
  cellClassName?: string
  inputClassName?: string
  valueClassName?: string
  multiline?: boolean
}

const createRow = (): GoalRow => ({
  id: generateId(),
  lastName: '',
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
})

const createFiltersState = (): Record<GoalField, string> => ({
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
  reportYear: '',
})

const FILTER_DISABLED_FIELDS: GoalField[] = ['goal', 'q1', 'q2', 'q3', 'q4', 'year']
const FILTER_SELECT_FIELDS: GoalField[] = ['lastName', 'weightQ', 'weightYear', 'reportYear']

const buildSelectedLabel = (
  values: string[],
  emptyLabel: string,
  formatValue: (value: string) => string = (value) => value
): string => {
  if (values.length === 0) return emptyLabel
  if (values.length <= 2) return values.map(formatValue).join(', ')
  return `${values.slice(0, 2).map(formatValue).join(', ')} +${values.length - 2}`
}

const formatFilterValue = (value: string): string => (value ? value : 'Пусто')

const buildOptions = (rows: GoalRow[], key: GoalField, collator: Intl.Collator): string[] => {
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

export function GoalsPage() {
  const [goalsState, setGoalsState] = useState<{ rows: GoalRow[] }>({ rows: [] })
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<GoalRow | null>(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<GoalField, string>>(createFiltersState)
  const [lastNameFilter, setLastNameFilter] = useState<string[]>([])
  const [weightQFilter, setWeightQFilter] = useState<string[]>([])
  const [weightYearFilter, setWeightYearFilter] = useState<string[]>([])
  const [reportYearFilter, setReportYearFilter] = useState<string[]>([])
  const [lastNameOpen, setLastNameOpen] = useState(false)
  const [weightQOpen, setWeightQOpen] = useState(false)
  const [weightYearOpen, setWeightYearOpen] = useState(false)
  const [reportYearOpen, setReportYearOpen] = useState(false)
  const [sortKey, setSortKey] = useState<GoalField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingClearTable, setPendingClearTable] = useState(false)
  const [isAddingNewRow, setIsAddingNewRow] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const skipSyncRef = useRef(true)
  const exportDropdownRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const lastNameRef = useRef<HTMLDivElement>(null)
  const weightQRef = useRef<HTMLDivElement>(null)
  const weightYearRef = useRef<HTMLDivElement>(null)
  const reportYearRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getPprRows()
      .then((rows) => {
        if (!active) return
        setGoalsState({ rows })
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
    void savePprRows(goalsState.rows)
      .then(() => setDataError(null))
      .catch((err) => {
        setDataError(err instanceof Error ? err.message : 'Не удалось сохранить данные.')
      })
  }, [goalsState, isLoaded])

  const normalizedFilters = useMemo(
    () =>
      (Object.entries(filters) as Array<[GoalField, string]>)
        .map(([key, value]) => [key, value.trim().toLowerCase()] as const)
        .filter(
          ([key, value]) =>
            value.length > 0 && !FILTER_DISABLED_FIELDS.includes(key) && !FILTER_SELECT_FIELDS.includes(key)
        ),
    [filters]
  )

  const filteredRows = goalsState.rows.filter((row) => {
    const matchesText = normalizedFilters.every(([key, value]) =>
      String(row[key] ?? '').toLowerCase().includes(value)
    )
    if (!matchesText) return false
    if (lastNameFilter.length > 0) {
      const name = String(row.lastName ?? '').trim()
      if (!lastNameFilter.includes(name)) return false
    }
    if (weightQFilter.length > 0) {
      const weight = String(row.weightQ ?? '').trim()
      if (!weightQFilter.includes(weight)) return false
    }
    if (weightYearFilter.length > 0) {
      const weight = String(row.weightYear ?? '').trim()
      if (!weightYearFilter.includes(weight)) return false
    }
    if (reportYearFilter.length === 0) return true
    const year = String(row.reportYear ?? '').trim()
    return reportYearFilter.includes(year)
  })

  const hasActiveFilters =
    normalizedFilters.length > 0 ||
    lastNameFilter.length > 0 ||
    weightQFilter.length > 0 ||
    weightYearFilter.length > 0 ||
    reportYearFilter.length > 0
  const resetFilters = useCallback(() => {
    setFilters(createFiltersState())
    setLastNameFilter([])
    setWeightQFilter([])
    setWeightYearFilter([])
    setReportYearFilter([])
    setReportYearOpen(false)
    setLastNameOpen(false)
    setWeightQOpen(false)
    setWeightYearOpen(false)
  }, [])

  const updateFilter = useCallback((key: GoalField, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const collator = useMemo(() => new Intl.Collator('ru', { numeric: true, sensitivity: 'base' }), [])
  const lastNameOptions = useMemo(() => buildOptions(goalsState.rows, 'lastName', collator), [collator, goalsState.rows])
  const weightQOptions = useMemo(() => buildOptions(goalsState.rows, 'weightQ', collator), [collator, goalsState.rows])
  const weightYearOptions = useMemo(() => buildOptions(goalsState.rows, 'weightYear', collator), [collator, goalsState.rows])
  const reportYearOptions = useMemo(() => buildOptions(goalsState.rows, 'reportYear', collator), [collator, goalsState.rows])

  useEffect(() => {
    setLastNameFilter((prev) => prev.filter((value) => lastNameOptions.includes(value)))
  }, [lastNameOptions])

  useEffect(() => {
    setWeightQFilter((prev) => prev.filter((value) => weightQOptions.includes(value)))
  }, [weightQOptions])

  useEffect(() => {
    setWeightYearFilter((prev) => prev.filter((value) => weightYearOptions.includes(value)))
  }, [weightYearOptions])

  useEffect(() => {
    setReportYearFilter((prev) => prev.filter((year) => reportYearOptions.includes(year)))
  }, [reportYearOptions])

  const toggleLastName = useCallback(
    (value: string) => {
      setLastNameFilter((prev) => {
        if (prev.includes(value)) return prev.filter((item) => item !== value)
        return [...prev, value].sort((a, b) => collator.compare(a, b))
      })
    },
    [collator]
  )

  const toggleAllLastNames = useCallback(() => {
    setLastNameFilter((prev) => (prev.length === lastNameOptions.length ? [] : [...lastNameOptions]))
  }, [lastNameOptions])

  const toggleAllWeightQ = useCallback(() => {
    setWeightQFilter((prev) => (prev.length === weightQOptions.length ? [] : [...weightQOptions]))
  }, [weightQOptions])

  const toggleAllWeightYear = useCallback(() => {
    setWeightYearFilter((prev) => (prev.length === weightYearOptions.length ? [] : [...weightYearOptions]))
  }, [weightYearOptions])

  const toggleAllReportYear = useCallback(() => {
    setReportYearFilter((prev) => (prev.length === reportYearOptions.length ? [] : [...reportYearOptions]))
  }, [reportYearOptions])

  const toggleWeightQ = useCallback(
    (value: string) => {
      setWeightQFilter((prev) => {
        if (prev.includes(value)) return prev.filter((item) => item !== value)
        return [...prev, value].sort((a, b) => collator.compare(a, b))
      })
    },
    [collator]
  )

  const toggleWeightYear = useCallback(
    (value: string) => {
      setWeightYearFilter((prev) => {
        if (prev.includes(value)) return prev.filter((item) => item !== value)
        return [...prev, value].sort((a, b) => collator.compare(a, b))
      })
    },
    [collator]
  )

  const toggleReportYear = useCallback(
    (value: string) => {
      setReportYearFilter((prev) => {
        if (prev.includes(value)) return prev.filter((item) => item !== value)
        return [...prev, value].sort((a, b) => collator.compare(a, b))
      })
    },
    [collator]
  )

  const lastNameLabel = useMemo(() => buildSelectedLabel(lastNameFilter, 'Все ФИО'), [lastNameFilter])
  const weightQLabel = useMemo(
    () => buildSelectedLabel(weightQFilter, 'Все значения', formatFilterValue),
    [weightQFilter]
  )
  const weightYearLabel = useMemo(
    () => buildSelectedLabel(weightYearFilter, 'Все значения', formatFilterValue),
    [weightYearFilter]
  )
  const reportYearLabel = useMemo(
    () => buildSelectedLabel(reportYearFilter, 'Все годы', formatFilterValue),
    [reportYearFilter]
  )
  const allLastNamesSelected =
    lastNameOptions.length > 0 && lastNameFilter.length === lastNameOptions.length
  const allWeightQSelected =
    weightQOptions.length > 0 && weightQFilter.length === weightQOptions.length
  const allWeightYearSelected =
    weightYearOptions.length > 0 && weightYearFilter.length === weightYearOptions.length
  const allReportYearSelected =
    reportYearOptions.length > 0 && reportYearFilter.length === reportYearOptions.length

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

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE
  const pageRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE)

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, [filters, lastNameFilter, weightQFilter, weightYearFilter, reportYearFilter, sortKey, sortDirection])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false)
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [exportDropdownOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const insideLastName = lastNameRef.current?.contains(target)
      const insideReportYear = reportYearRef.current?.contains(target)
      const insideWeightQ = weightQRef.current?.contains(target)
      const insideWeightYear = weightYearRef.current?.contains(target)
      if (!insideLastName && !insideReportYear && !insideWeightQ && !insideWeightYear) {
        setReportYearOpen(false)
        setWeightQOpen(false)
        setWeightYearOpen(false)
        setLastNameOpen(false)
      }
    }
    if (reportYearOpen || weightQOpen || weightYearOpen || lastNameOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [reportYearOpen, weightQOpen, weightYearOpen, lastNameOpen])

  const handleExport = useCallback(
    (format: 'csv' | 'xlsx' | 'pdf' | 'docx' | 'html') => {
      setExportDropdownOpen(false)
      const rows = sortedRows
      if (format === 'csv') exportGoalsCSV(rows, 'ппр')
      else if (format === 'xlsx') exportGoalsExcel(rows, 'ппр')
      else if (format === 'html') exportGoalsHTML(rows, 'ппр')
      else if (format === 'pdf') {
        exportGoalsPDF(rows, 'ппр').catch((err) => {
          console.error('Ошибка экспорта PDF:', err)
          alert('Не удалось создать PDF. Проверьте консоль браузера (F12).')
        })
      } else if (format === 'docx') {
        exportGoalsDOCX(rows, 'ппр').catch((err) => {
          console.error('Ошибка экспорта DOCX:', err)
          alert('Не удалось создать DOCX. Проверьте консоль браузера (F12).')
        })
      }
    },
    [sortedRows]
  )

  const editFields: EditRowField[] = [
    { key: 'lastName', label: 'ФИО', placeholder: 'Иванов Иван Иванович' },
    { key: 'goal', label: 'SCAI Цель', placeholder: 'Например: рост эффективности операционных затрат', multiline: true },
    { key: 'metricGoals', label: 'Метрические цели', placeholder: 'Например: снижение CIR на 2 п.п.', multiline: true },
    { key: 'weightQ', label: 'Вес квартал', placeholder: '' },
    { key: 'weightYear', label: 'Вес год', placeholder: '' },
    { key: 'q1', label: '1 квартал', placeholder: 'KPI' },
    { key: 'q2', label: '2 квартал', placeholder: 'KPI' },
    { key: 'q3', label: '3 квартал', placeholder: 'KPI' },
    { key: 'q4', label: '4 квартал', placeholder: 'KPI' },
    { key: 'year', label: 'Год', placeholder: 'итог за год' },
    { key: 'reportYear', label: 'Отчётный год', placeholder: '2026' },
  ]

  const columns: Column[] = [
    {
      key: 'lastName',
      label: 'ФИО',
      placeholder: 'Иванов Иван Иванович',
      cellClassName: styles.colSurname,
      inputClassName: styles.input,
    },
    {
      key: 'goal',
      label: 'SCAI Цель',
      placeholder: 'Например: рост эффективности операционных затрат',
      cellClassName: styles.colGoal,
      inputClassName: `${styles.input} ${styles.goalInput}`,
      valueClassName: styles.valueMultiline,
      multiline: true,
    },
    {
      key: 'metricGoals',
      label: 'Метрические цели',
      placeholder: 'Например: снижение CIR на 2 п.п.',
      cellClassName: `${styles.colMetricGoals} ${styles.headerNowrap}`,
      inputClassName: `${styles.input} ${styles.goalInput}`,
      valueClassName: styles.valueMultiline,
      multiline: true,
    },
    {
      key: 'weightQ',
      label: 'Вес квартал',
      placeholder: '',
      cellClassName: `${styles.colWeight} ${styles.headerNowrap}`,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'weightYear',
      label: 'Вес год',
      placeholder: '',
      cellClassName: styles.colWeight,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'q1',
      label: '1 квартал',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'q2',
      label: '2 квартал',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'q3',
      label: '3 квартал',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'q4',
      label: '4 квартал',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'year',
      label: 'Год',
      placeholder: 'итог',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'reportYear',
      label: 'Отчётный год',
      placeholder: '2026',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
  ]
  const filterableColumns = columns.filter((col) => !FILTER_DISABLED_FIELDS.includes(col.key))

  const addRow = useCallback(() => {
    const newRow = createRow()
    setGoalsState((prev) => ({
      ...prev,
      rows: [...prev.rows, newRow],
    }))
    setEditingRowId(newRow.id)
    setEditingDraft(newRow)
    setIsAddingNewRow(true)
    setPage(Math.ceil((goalsState.rows.length + 1) / PAGE_SIZE))
  }, [goalsState.rows.length])

  const handleSort = useCallback((key: GoalField) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDirection('asc')
      return key
    })
  }, [])

  const startEdit = useCallback((row: GoalRow) => {
    setEditingRowId(row.id)
    setEditingDraft({ ...row })
  }, [])

  const cancelEdit = useCallback(() => {
    if (isAddingNewRow && editingRowId) {
      setGoalsState((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== editingRowId) }))
    }
    setIsAddingNewRow(false)
    setEditingRowId(null)
    setEditingDraft(null)
  }, [isAddingNewRow, editingRowId])

  const saveEdit = useCallback(
    (draft: GoalRow) => {
      if (!editingRowId) return
      setGoalsState((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => (row.id === editingRowId ? draft : row)),
      }))
      setIsAddingNewRow(false)
      setEditingRowId(null)
      setEditingDraft(null)
    },
    [editingRowId]
  )

  const deleteRow = useCallback((id: string) => {
    setGoalsState((prev) => ({
      ...prev,
      rows: prev.rows.filter((row) => row.id !== id),
    }))
    if (editingRowId === id) {
      setEditingRowId(null)
      setEditingDraft(null)
    }
  }, [editingRowId])

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) deleteRow(pendingDeleteId)
    setPendingDeleteId(null)
  }, [pendingDeleteId, deleteRow])

  const confirmClearTable = useCallback(() => {
    setGoalsState({ rows: [] })
    setPage(1)
    setPendingClearTable(false)
  }, [])

  const handleImportClick = useCallback(() => {
    setImportError(null)
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const isXlsx = /\.xlsx$/i.test(file.name)
      if (!isXlsx) {
        setImportError('Выберите файл .xlsx')
        return
      }
      parseKpiXlsxToRows(file)
        .then((rows) => {
          if (rows.length === 0) {
            setImportError('В файле нет данных или заголовки не совпадают. Ожидаются: ФИО, SCAI Цель, Метрические цели, Вес квартал, Вес год, 1–4 квартал, Год.')
            return
          }
          setGoalsState((prev) => ({ ...prev, rows: [...prev.rows, ...rows] }))
          setImportError(null)
        })
        .catch((err) => {
          setImportError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
        })
    },
    []
  )

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>ППР</h1>
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
            <button type="button" className={styles.importBtn} onClick={handleImportClick} disabled={!!editingRowId} title="Импорт из xlsx">
              Импортировать
            </button>
            <button
              type="button"
              className={styles.clearTableBtn}
              onClick={() => setPendingClearTable(true)}
              disabled={goalsState.rows.length === 0 || !!editingRowId}
              title="Удалить все записи в таблице"
            >
              Очистить таблицу
            </button>
            <button
              type="button"
              className={styles.addBtn}
              onClick={addRow}
              aria-label="Добавить строку"
              title="Добавить строку"
            >
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
              col.key === 'lastName' ? (
                <div key={col.key} className={`${styles.filterField} ${styles.filterSelect}`} ref={lastNameRef}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <button
                    type="button"
                    className={styles.filterSelectButton}
                    onClick={() => {
                      setLastNameOpen((prev) => !prev)
                      setWeightQOpen(false)
                      setWeightYearOpen(false)
                      setReportYearOpen(false)
                    }}
                    disabled={!!editingRowId}
                    aria-expanded={lastNameOpen}
                    aria-haspopup="listbox"
                  >
                    <span className={styles.filterSelectText}>{lastNameLabel}</span>
                    <span className={styles.filterSelectCaret} aria-hidden />
                  </button>
                  {lastNameOpen && (
                    <div className={styles.filterSelectMenu} role="listbox" aria-label="ФИО">
                      {lastNameOptions.length === 0 ? (
                        <div className={styles.filterSelectEmpty}>Нет данных</div>
                      ) : (
                        <>
                          <label className={styles.filterSelectOption}>
                            <input
                              type="checkbox"
                              checked={allLastNamesSelected}
                              onChange={toggleAllLastNames}
                            />
                            <span>Выбрать все</span>
                          </label>
                          {lastNameOptions.map((value) => (
                            <label key={value} className={styles.filterSelectOption}>
                              <input
                                type="checkbox"
                                checked={lastNameFilter.includes(value)}
                                onChange={() => toggleLastName(value)}
                              />
                              <span>{formatFilterValue(value)}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : col.key === 'weightQ' ? (
                <div key={col.key} className={`${styles.filterField} ${styles.filterSelect}`} ref={weightQRef}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <button
                    type="button"
                    className={styles.filterSelectButton}
                    onClick={() => {
                      setWeightQOpen((prev) => !prev)
                      setLastNameOpen(false)
                      setWeightYearOpen(false)
                      setReportYearOpen(false)
                    }}
                    disabled={!!editingRowId}
                    aria-expanded={weightQOpen}
                    aria-haspopup="listbox"
                  >
                    <span className={styles.filterSelectText}>{weightQLabel}</span>
                    <span className={styles.filterSelectCaret} aria-hidden />
                  </button>
                  {weightQOpen && (
                    <div className={styles.filterSelectMenu} role="listbox" aria-label="Вес квартал">
                      {weightQOptions.length === 0 ? (
                        <div className={styles.filterSelectEmpty}>Нет данных</div>
                      ) : (
                        <>
                          <label className={styles.filterSelectOption}>
                            <input
                              type="checkbox"
                              checked={allWeightQSelected}
                              onChange={toggleAllWeightQ}
                            />
                            <span>Выбрать все</span>
                          </label>
                          {weightQOptions.map((value) => (
                            <label key={value} className={styles.filterSelectOption}>
                              <input
                                type="checkbox"
                                checked={weightQFilter.includes(value)}
                                onChange={() => toggleWeightQ(value)}
                              />
                              <span>{formatFilterValue(value)}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : col.key === 'weightYear' ? (
                <div key={col.key} className={`${styles.filterField} ${styles.filterSelect}`} ref={weightYearRef}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <button
                    type="button"
                    className={styles.filterSelectButton}
                    onClick={() => {
                      setWeightYearOpen((prev) => !prev)
                      setLastNameOpen(false)
                      setWeightQOpen(false)
                      setReportYearOpen(false)
                    }}
                    disabled={!!editingRowId}
                    aria-expanded={weightYearOpen}
                    aria-haspopup="listbox"
                  >
                    <span className={styles.filterSelectText}>{weightYearLabel}</span>
                    <span className={styles.filterSelectCaret} aria-hidden />
                  </button>
                  {weightYearOpen && (
                    <div className={styles.filterSelectMenu} role="listbox" aria-label="Вес год">
                      {weightYearOptions.length === 0 ? (
                        <div className={styles.filterSelectEmpty}>Нет данных</div>
                      ) : (
                        <>
                          <label className={styles.filterSelectOption}>
                            <input
                              type="checkbox"
                              checked={allWeightYearSelected}
                              onChange={toggleAllWeightYear}
                            />
                            <span>Выбрать все</span>
                          </label>
                          {weightYearOptions.map((value) => (
                            <label key={value} className={styles.filterSelectOption}>
                              <input
                                type="checkbox"
                                checked={weightYearFilter.includes(value)}
                                onChange={() => toggleWeightYear(value)}
                              />
                              <span>{formatFilterValue(value)}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : col.key === 'reportYear' ? (
                <div key={col.key} className={`${styles.filterField} ${styles.filterSelect}`} ref={reportYearRef}>
                  <span className={styles.filterLabel}>{col.label}</span>
                  <button
                    type="button"
                    className={styles.filterSelectButton}
                    onClick={() => {
                      setReportYearOpen((prev) => !prev)
                      setLastNameOpen(false)
                      setWeightQOpen(false)
                      setWeightYearOpen(false)
                    }}
                    disabled={!!editingRowId}
                    aria-expanded={reportYearOpen}
                    aria-haspopup="listbox"
                  >
                    <span className={styles.filterSelectText}>{reportYearLabel}</span>
                    <span className={styles.filterSelectCaret} aria-hidden />
                  </button>
                  {reportYearOpen && (
                    <div className={styles.filterSelectMenu} role="listbox" aria-label="Отчётный год">
                      {reportYearOptions.length === 0 ? (
                        <div className={styles.filterSelectEmpty}>Нет данных</div>
                      ) : (
                        <>
                          <label className={styles.filterSelectOption}>
                            <input
                              type="checkbox"
                              checked={allReportYearSelected}
                              onChange={toggleAllReportYear}
                            />
                            <span>Выбрать все</span>
                          </label>
                          {reportYearOptions.map((year) => (
                            <label key={year} className={styles.filterSelectOption}>
                              <input
                                type="checkbox"
                                checked={reportYearFilter.includes(year)}
                                onChange={() => toggleReportYear(year)}
                              />
                              <span>{formatFilterValue(year)}</span>
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
                {columns.map((col) => (
                  <th key={col.key} className={col.cellClassName}>
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => handleSort(col.key)}
                      disabled={!!editingRowId}
                      aria-label={`Сортировать по: ${col.label}`}
                    >
                      <span className={styles.headerLabel}>{col.label}</span>
                      <span
                        className={[
                          styles.sortIndicator,
                          sortKey === col.key
                            ? sortDirection === 'asc'
                              ? styles.sortIndicatorAsc
                              : styles.sortIndicatorDesc
                            : styles.sortIndicatorInactive,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-hidden
                      />
                    </button>
                  </th>
                ))}
                <th className={styles.actionsCol}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {goalsState.rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={columns.length + 1}>
                    Пока нет целей. Добавьте первую строку.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={columns.length + 1}>
                    Нет совпадений по фильтрам.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                    <tr key={row.id}>
                      {columns.map((col) => {
                        const value = row[col.key] ?? ''
                        const isEmpty = !value.trim()
                        return (
                          <td key={col.key} className={col.cellClassName}>
                            <span
                              className={[
                                styles.valueText,
                                col.valueClassName ?? '',
                                isEmpty ? styles.valueMuted : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {isEmpty ? '' : value}
                            </span>
                          </td>
                        )
                      })}
                      <td className={styles.actionsCell}>
                        <div className={styles.actionGroup}>
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconBtnEdit}`}
                            onClick={() => startEdit(row)}
                            disabled={!!editingRowId}
                            aria-label="Редактировать строку"
                            title="Редактировать"
                          >
                            <PencilIcon className={styles.pencilIcon} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            onClick={() => setPendingDeleteId(row.id)}
                            aria-label="Удалить строку"
                          >
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
          <div className={styles.exportWrap} ref={exportDropdownRef}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => setExportDropdownOpen((v) => !v)}
              disabled={!!editingRowId}
              aria-expanded={exportDropdownOpen}
              aria-haspopup="true"
            >
              Экспорт
            </button>
            {exportDropdownOpen && (
              <div className={styles.exportDropdown}>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('pdf')}>
                  PDF
                </button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('xlsx')}>
                  EXCEL
                </button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('docx')}>
                  DOCX
                </button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('csv')}>
                  CSV
                </button>
                <button type="button" className={styles.exportOption} onClick={() => handleExport('html')}>
                  HTML
                </button>
              </div>
            )}
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
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={
                    pageNumber === page
                      ? `${styles.paginationBtn} ${styles.paginationBtnActive}`
                      : styles.paginationBtn
                  }
                  onClick={() => setPage(pageNumber)}
                  disabled={!!editingRowId}
                >
                  {pageNumber}
                </button>
              ))}
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
        message="Удалить все записи в таблице ППР? Это действие нельзя отменить."
        confirmLabel="Очистить"
        cancelLabel="Отмена"
        onConfirm={confirmClearTable}
        onCancel={() => setPendingClearTable(false)}
        danger
      />

      <EditRowModal
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
