import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateId, getKpiState, saveKpiState, type GoalRow } from '@/lib/storage'
import { exportGoalsCSV, exportGoalsDOCX, exportGoalsExcel, exportGoalsHTML, exportGoalsPDF } from '@/lib/exportGoals'
import { parseKpiXlsxToRows } from '@/lib/importGoals'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import { EditRowModal, type EditRowField } from '@/components/EditRowModal/EditRowModal'
import { PlusIcon, TrashIcon, PencilIcon, SearchIcon } from '@/components/Icons'
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

export function KpiPage() {
  const [goalsState, setGoalsState] = useState(() => {
    const stored = getKpiState()
    if (stored.rows.length === 0) {
      const empty = { rows: [] as GoalRow[] }
      saveKpiState(empty)
      return empty
    }
    const rows: GoalRow[] = stored.rows.map((row) => ({
      ...row,
      reportYear: 'reportYear' in row && String((row as GoalRow).reportYear).trim() !== '' ? (row as GoalRow).reportYear : '',
    }))
    const hadMissing = stored.rows.some((r) => !('reportYear' in r))
    if (hadMissing) {
      saveKpiState({ rows })
      return { rows }
    }
    return stored
  })
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<GoalRow | null>(null)
  const [page, setPage] = useState(1)
  const [searchLastName, setSearchLastName] = useState('')
  const [searchMetricGoals, setSearchMetricGoals] = useState('')
  const [sortKey, setSortKey] = useState<GoalField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingClearTable, setPendingClearTable] = useState(false)
  const [isAddingNewRow, setIsAddingNewRow] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const exportDropdownRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveKpiState(goalsState)
  }, [goalsState])

  const normalizedLastName = searchLastName.trim().toLowerCase()
  const normalizedMetricGoals = searchMetricGoals.trim().toLowerCase()
  const filteredRows = goalsState.rows.filter((row) => {
    const matchesLastName = !normalizedLastName || row.lastName.toLowerCase().includes(normalizedLastName)
    const matchesMetricGoals = !normalizedMetricGoals || (row.metricGoals ?? '').toLowerCase().includes(normalizedMetricGoals)
    return matchesLastName && matchesMetricGoals
  })

  const hasActiveFilters = !!(searchLastName.trim() || searchMetricGoals.trim())
  const resetFilters = useCallback(() => {
    setSearchLastName('')
    setSearchMetricGoals('')
  }, [])

  const collator = useMemo(() => new Intl.Collator('ru', { numeric: true, sensitivity: 'base' }), [])

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
  }, [searchLastName, searchMetricGoals, sortKey, sortDirection])

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

  const handleExport = useCallback(
    (format: 'csv' | 'xlsx' | 'pdf' | 'docx' | 'html') => {
      setExportDropdownOpen(false)
      const rows = sortedRows
      if (format === 'csv') exportGoalsCSV(rows, 'кпэ')
      else if (format === 'xlsx') exportGoalsExcel(rows, 'кпэ')
      else if (format === 'html') exportGoalsHTML(rows, 'кпэ')
      else if (format === 'pdf') {
        exportGoalsPDF(rows, 'кпэ').catch((err) => {
          console.error('Ошибка экспорта PDF:', err)
          alert('Не удалось создать PDF. Проверьте консоль браузера (F12).')
        })
      } else if (format === 'docx') {
        exportGoalsDOCX(rows, 'кпэ').catch((err) => {
          console.error('Ошибка экспорта DOCX:', err)
          alert('Не удалось создать DOCX. Проверьте консоль браузера (F12).')
        })
      }
    },
    [sortedRows]
  )

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
    { key: 'lastName', label: 'ФИО', placeholder: 'Иванов Иван Иванович', cellClassName: styles.colSurname, inputClassName: styles.input },
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
    { key: 'weightQ', label: 'Вес квартал', placeholder: '', cellClassName: `${styles.colWeight} ${styles.headerNowrap}`, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'weightYear', label: 'Вес год', placeholder: '', cellClassName: styles.colWeight, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q1', label: '1 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q2', label: '2 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q3', label: '3 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q4', label: '4 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'year', label: 'Год', placeholder: 'итог', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'reportYear', label: 'Отчётный год', placeholder: '2026', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
  ]

  const addRow = useCallback(() => {
    const newRow = createRow()
    setGoalsState((prev) => ({ ...prev, rows: [...prev.rows, newRow] }))
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
    setGoalsState((prev) => ({ ...prev, rows: prev.rows.filter((row) => row.id !== id) }))
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

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>КПЭ</h1>
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
            {hasActiveFilters && (
              <button type="button" className={styles.resetFiltersBtn} onClick={resetFilters} disabled={!!editingRowId} title="Сбросить все фильтры по колонкам">
                Сбросить фильтры
              </button>
            )}
            <button type="button" className={styles.addBtn} onClick={addRow} aria-label="Добавить строку" title="Добавить строку">
              <PlusIcon className={styles.addBtnIcon} />
            </button>
          </div>
        </header>
        {importError && (
          <div className={styles.importError} role="alert">
            {importError}
          </div>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className={col.cellClassName}>
                    {col.key === 'lastName' ? (
                      <div className={styles.headerWithSearch}>
                        <button type="button" className={styles.sortBtn} onClick={() => handleSort(col.key)} disabled={!!editingRowId} aria-label={`Сортировать по: ${col.label}`}>
                          <span className={styles.headerLabel}>{col.label}</span>
                          <span className={[styles.sortIndicator, sortKey === col.key ? (sortDirection === 'asc' ? styles.sortIndicatorAsc : styles.sortIndicatorDesc) : styles.sortIndicatorInactive].filter(Boolean).join(' ')} aria-hidden />
                        </button>
                        <label className={`${styles.searchField} ${styles.searchFieldCompact}`}>
                          <SearchIcon className={styles.searchIcon} />
                          <input type="search" className={`${styles.searchInput} ${styles.searchInputCompact}`} value={searchLastName} onChange={(e) => setSearchLastName(e.target.value)} placeholder="Поиск" aria-label="Поиск по ФИО" disabled={!!editingRowId} />
                        </label>
                      </div>
                    ) : col.key === 'metricGoals' ? (
                      <div className={styles.headerWithSearch}>
                        <button type="button" className={styles.sortBtn} onClick={() => handleSort(col.key)} disabled={!!editingRowId} aria-label={`Сортировать по: ${col.label}`}>
                          <span className={styles.headerLabel}>{col.label}</span>
                          <span className={[styles.sortIndicator, sortKey === col.key ? (sortDirection === 'asc' ? styles.sortIndicatorAsc : styles.sortIndicatorDesc) : styles.sortIndicatorInactive].filter(Boolean).join(' ')} aria-hidden />
                        </button>
                        <label className={`${styles.searchField} ${styles.searchFieldWide}`}>
                          <SearchIcon className={styles.searchIcon} />
                          <input type="search" className={`${styles.searchInput} ${styles.searchInputWide}`} value={searchMetricGoals} onChange={(e) => setSearchMetricGoals(e.target.value)} placeholder="Поиск" aria-label="Поиск по метрическим целям" disabled={!!editingRowId} />
                        </label>
                      </div>
                    ) : (
                      <button type="button" className={styles.sortBtn} onClick={() => handleSort(col.key)} disabled={!!editingRowId} aria-label={`Сортировать по: ${col.label}`}>
                        <span className={styles.headerLabel}>{col.label}</span>
                        <span className={[styles.sortIndicator, sortKey === col.key ? (sortDirection === 'asc' ? styles.sortIndicatorAsc : styles.sortIndicatorDesc) : styles.sortIndicatorInactive].filter(Boolean).join(' ')} aria-hidden />
                      </button>
                    )}
                  </th>
                ))}
                <th className={styles.actionsCol}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {goalsState.rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={columns.length + 1}>
                    Пока нет показателей. Добавьте первую строку.
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
                          <span className={[styles.valueText, col.valueClassName ?? '', isEmpty ? styles.valueMuted : ''].filter(Boolean).join(' ')}>{isEmpty ? '' : value}</span>
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
          {totalPages > 1 && (
            <div className={styles.pagination} aria-label="Пагинация таблицы">
              <button type="button" className={styles.paginationBtn} onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1 || !!editingRowId} aria-label="Предыдущая страница">‹</button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNumber) => (
                <button key={pageNumber} type="button" className={pageNumber === page ? `${styles.paginationBtn} ${styles.paginationBtnActive}` : styles.paginationBtn} onClick={() => setPage(pageNumber)} disabled={!!editingRowId}>
                  {pageNumber}
                </button>
              ))}
              <button type="button" className={styles.paginationBtn} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages || !!editingRowId} aria-label="Следующая страница">›</button>
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
        message="Удалить все записи в таблице КПЭ? Это действие нельзя отменить."
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
