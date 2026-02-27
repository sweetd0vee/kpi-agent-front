import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateId, getKpiState, saveKpiState, type GoalRow } from '@/lib/storage'
import { exportGoalsCSV, exportGoalsDOCX, exportGoalsExcel, exportGoalsHTML, exportGoalsPDF } from '@/lib/exportGoals'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
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
  year: '',
})

const KPI_DEMO_ROWS: Array<Omit<GoalRow, 'id'>> = [
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'Чистая прибыль (Холдинг), млн BYN', weightQ: '20%', weightYear: '20%', q1: '24,1', q2: '58,3', q3: '112,1', q4: '205,3', year: '205,3' },
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'ЧОД до резервов (Холдинг), млн BYN', weightQ: '20%', weightYear: '20%', q1: '146,2', q2: '299,9', q3: '471,7', q4: '702,7', year: '702,7' },
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'CIR (Холдинг)', weightQ: '15%', weightYear: '15%', q1: '54,4%', q2: '55,1%', q3: '53,1%', q4: '48,4%', year: '48,4%' },
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'COR с учетом корпооблигаций (Холдинг)', weightQ: '10%', weightYear: '10%', q1: '2,8%', q2: '2,3%', q3: '1,9%', q4: '1,7%', year: '1,7%' },
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'NPL default (Банк), млн BYN', weightQ: '5%', weightYear: '5%', q1: '310,69', q2: '317,19', q3: '359,50', q4: '378,91', year: '378,91' },
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'Отсутствуют нарушения лимитов операционного риска, тыс. BYN', weightQ: 'М', weightYear: '', q1: '3584,5', q2: '', q3: '', q4: '', year: '' },
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'ROE (Холдинг)', weightQ: 'М', weightYear: 'М', q1: '7,6%', q2: '9,0%', q3: '11,3%', q4: '15,1%', year: '15,1%' },
  { lastName: 'Иванов И.И.', goal: 'Финансовые показатели', metricGoals: 'ROA (Холдинг)', weightQ: 'М', weightYear: 'М', q1: '1,3%', q2: '1,6%', q3: '2,0%', q4: '2,7%', year: '' },
]

const buildKpiDemoRows = (): GoalRow[] => KPI_DEMO_ROWS.map((row) => ({ id: generateId(), ...row }))

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function KpiPage() {
  const [goalsState, setGoalsState] = useState(() => {
    const stored = getKpiState()
    if (stored.rows.length === 0) {
      const seeded = { rows: buildKpiDemoRows() }
      saveKpiState(seeded)
      return seeded
    }
    return stored
  })
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<GoalRow | null>(null)
  const [page, setPage] = useState(1)
  const [searchLastName, setSearchLastName] = useState('')
  const [searchGoal, setSearchGoal] = useState('')
  const [sortKey, setSortKey] = useState<GoalField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveKpiState(goalsState)
  }, [goalsState])

  const normalizedLastName = searchLastName.trim().toLowerCase()
  const normalizedGoal = searchGoal.trim().toLowerCase()
  const filteredRows = goalsState.rows.filter((row) => {
    const matchesLastName = !normalizedLastName || row.lastName.toLowerCase().includes(normalizedLastName)
    const matchesGoal = !normalizedGoal || row.goal.toLowerCase().includes(normalizedGoal)
    return matchesLastName && matchesGoal
  })

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
  }, [searchLastName, searchGoal, sortKey, sortDirection])

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
      cellClassName: `${styles.colGoal} ${styles.headerNowrap}`,
      inputClassName: `${styles.input} ${styles.goalInput}`,
      valueClassName: styles.valueMultiline,
      multiline: true,
    },
    { key: 'weightQ', label: 'вес квартал', placeholder: '', cellClassName: `${styles.colWeight} ${styles.headerNowrap}`, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'weightYear', label: 'вес год', placeholder: '', cellClassName: styles.colWeight, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q1', label: '1 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q2', label: '2 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q3', label: '3 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'q4', label: '4 квартал', placeholder: 'KPI', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
    { key: 'year', label: 'Год', placeholder: '2026', cellClassName: styles.colQuarter, inputClassName: `${styles.input} ${styles.quarterInput}`, valueClassName: styles.valueCenter },
  ]

  const addRow = useCallback(() => {
    const newRow = createRow()
    setGoalsState((prev) => ({ ...prev, rows: [...prev.rows, newRow] }))
    setEditingRowId(newRow.id)
    setEditingDraft(newRow)
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

  const updateDraft = useCallback((field: GoalField, value: string) => {
    setEditingDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingRowId(null)
    setEditingDraft(null)
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingRowId || !editingDraft) return
    setGoalsState((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === editingRowId ? editingDraft : row)),
    }))
    setEditingRowId(null)
    setEditingDraft(null)
  }, [editingDraft, editingRowId])

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
            <button type="button" className={styles.addBtn} onClick={addRow} aria-label="Добавить строку" title="Добавить строку">
              <PlusIcon className={styles.addBtnIcon} />
            </button>
          </div>
        </header>

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
                    ) : col.key === 'goal' ? (
                      <div className={styles.headerWithSearch}>
                        <button type="button" className={styles.sortBtn} onClick={() => handleSort(col.key)} disabled={!!editingRowId} aria-label={`Сортировать по: ${col.label}`}>
                          <span className={styles.headerLabel}>{col.label}</span>
                          <span className={[styles.sortIndicator, sortKey === col.key ? (sortDirection === 'asc' ? styles.sortIndicatorAsc : styles.sortIndicatorDesc) : styles.sortIndicatorInactive].filter(Boolean).join(' ')} aria-hidden />
                        </button>
                        <label className={`${styles.searchField} ${styles.searchFieldWide}`}>
                          <SearchIcon className={styles.searchIcon} />
                          <input type="search" className={`${styles.searchInput} ${styles.searchInputWide}`} value={searchGoal} onChange={(e) => setSearchGoal(e.target.value)} placeholder="Поиск" aria-label="Поиск по цели" disabled={!!editingRowId} />
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
                pageRows.map((row, index) => {
                  const isEditing = row.id === editingRowId
                  const activeRow = isEditing && editingDraft ? editingDraft : row
                  const rowNumber = pageStart + index + 1
                  return (
                    <tr key={row.id}>
                      {columns.map((col) => {
                        const value = activeRow[col.key] ?? ''
                        const isEmpty = !value.trim()
                        return (
                          <td key={col.key} className={col.cellClassName}>
                            {isEditing ? (
                              col.multiline ? (
                                <textarea className={col.inputClassName} value={value} rows={2} placeholder={col.placeholder} onChange={(e) => updateDraft(col.key, e.target.value)} aria-label={`${col.label}, строка ${rowNumber}`} />
                              ) : (
                                <input type="text" className={col.inputClassName} value={value} placeholder={col.placeholder} onChange={(e) => updateDraft(col.key, e.target.value)} aria-label={`${col.label}, строка ${rowNumber}`} />
                              )
                            ) : (
                              <span className={[styles.valueText, col.valueClassName ?? '', isEmpty ? styles.valueMuted : ''].filter(Boolean).join(' ')}>{isEmpty ? '' : value}</span>
                            )}
                          </td>
                        )
                      })}
                      <td className={styles.actionsCell}>
                        <div className={styles.actionGroup}>
                          {isEditing ? (
                            <>
                              <button type="button" className={styles.saveBtn} onClick={saveEdit} disabled={!editingDraft}>Сохранить</button>
                              <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>Отмена</button>
                            </>
                          ) : (
                            <button type="button" className={`${styles.iconBtn} ${styles.iconBtnEdit}`} onClick={() => startEdit(row)} disabled={!!editingRowId && editingRowId !== row.id} aria-label="Редактировать строку" title="Редактировать">
                              <PencilIcon className={styles.pencilIcon} />
                            </button>
                          )}
                          <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setPendingDeleteId(row.id)} aria-label="Удалить строку">
                            <TrashIcon className={styles.trashIcon} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
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
    </div>
  )
}
