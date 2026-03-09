import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getLeaderGoalRows, saveLeaderGoalRows } from '@/api/goals'
import { generateId, type LeaderGoalRow } from '@/lib/storage'
import {
  exportLeaderGoalsCSV,
  exportLeaderGoalsDOCX,
  exportLeaderGoalsExcel,
  exportLeaderGoalsHTML,
  exportLeaderGoalsPDF,
} from '@/lib/exportGoals'
import { parseLeaderGoalsXlsxToRows } from '@/lib/importGoals'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import { EditLeaderGoalModal, type EditLeaderGoalField } from '@/components/EditLeaderGoalModal'
import { PlusIcon, TrashIcon, PencilIcon } from '@/components/Icons'
import styles from './GoalsPage.module.css'

type LeaderGoalField = keyof Omit<LeaderGoalRow, 'id'>

const PAGE_SIZE = 15

type Column = {
  key: LeaderGoalField
  label: string
  cellClassName?: string
  valueClassName?: string
}

const createRow = (): LeaderGoalRow => ({
  id: generateId(),
  lastName: '',
  goalNum: '',
  name: '',
  goalType: '',
  goalKind: '',
  unit: '',
  q1Weight: '',
  q1Value: '',
  q2Weight: '',
  q2Value: '',
  q3Weight: '',
  q3Value: '',
  q4Weight: '',
  q4Value: '',
  yearWeight: '',
  yearValue: '',
  comments: '',
  methodDesc: '',
  sourceInfo: '',
  reportYear: '',
})

/** Шапка таблицы по шаблону (форма целей). В label переносы строк — через \n для компактного отображения. */
const COLUMNS: Column[] = [
  { key: 'lastName', label: 'ФИО', cellClassName: styles.colLeaderSurname },
  { key: 'goalNum', label: '№ цели', cellClassName: styles.colLeaderGoalNum },
  { key: 'name', label: 'Наименование КПЭ', cellClassName: styles.colLeaderName },
  { key: 'goalType', label: 'Тип цели', cellClassName: styles.colGoal },
  { key: 'goalKind', label: 'Вид цели', cellClassName: styles.colLeaderNarrow },
  { key: 'unit', label: 'Ед. изм.', cellClassName: styles.colLeaderNarrow },
  { key: 'q1Weight', label: 'I кв.\nВес %', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'q1Value', label: 'I кв.\nПлан. / веха', cellClassName: styles.colLeaderPlan, valueClassName: styles.valueCenter },
  { key: 'q2Weight', label: 'II кв.\nВес %', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'q2Value', label: 'II кв.\nПлан. / веха', cellClassName: styles.colLeaderPlan, valueClassName: styles.valueCenter },
  { key: 'q3Weight', label: 'III кв.\nВес %', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'q3Value', label: 'III кв.\nПлан. / веха', cellClassName: styles.colLeaderPlan, valueClassName: styles.valueCenter },
  { key: 'q4Weight', label: 'IV кв.\nВес %', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'q4Value', label: 'IV кв.\nПлан. / веха', cellClassName: styles.colLeaderPlan, valueClassName: styles.valueCenter },
  { key: 'yearWeight', label: 'Год\nВес %', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
  { key: 'yearValue', label: 'Год\nПлан. / веха', cellClassName: styles.colLeaderPlan, valueClassName: styles.valueCenter },
  { key: 'comments', label: 'Комментарии', cellClassName: styles.colLeaderMedium },
  { key: 'methodDesc', label: 'Методика\nрасчёта', cellClassName: styles.colLeaderMedium },
  { key: 'sourceInfo', label: 'Источник\nинформации', cellClassName: styles.colLeaderMedium },
  { key: 'reportYear', label: 'Отчётный год', cellClassName: styles.colQuarter, valueClassName: styles.valueCenter },
]

const EDIT_FIELDS: EditLeaderGoalField[] = [
  { key: 'lastName', label: 'ФИО', placeholder: 'Иванов И.И.', multiline: false },
  { key: 'goalNum', label: '№ цели', placeholder: '1', multiline: false },
  { key: 'name', label: 'Наименование КПЭ', placeholder: '', multiline: true },
  { key: 'goalType', label: 'Тип цели', placeholder: 'типовая / групповая / индивидуальная', multiline: false },
  { key: 'goalKind', label: 'Вид цели', placeholder: '', multiline: false },
  { key: 'unit', label: 'Единица измерения', placeholder: '', multiline: false },
  { key: 'q1Weight', label: 'I квартал — Вес %', placeholder: '', multiline: false },
  { key: 'q1Value', label: 'I квартал — Плановое значение / веха ППР', placeholder: '', multiline: false },
  { key: 'q2Weight', label: 'II квартал — Вес %', placeholder: '', multiline: false },
  { key: 'q2Value', label: 'II квартал — Плановое значение / веха ППР', placeholder: '', multiline: false },
  { key: 'q3Weight', label: 'III квартал — Вес %', placeholder: '', multiline: false },
  { key: 'q3Value', label: 'III квартал — Плановое значение / веха ППР', placeholder: '', multiline: false },
  { key: 'q4Weight', label: 'IV квартал — Вес %', placeholder: '', multiline: false },
  { key: 'q4Value', label: 'IV квартал — Плановое значение / веха ППР', placeholder: '', multiline: false },
  { key: 'yearWeight', label: 'Год — Вес %', placeholder: '', multiline: false },
  { key: 'yearValue', label: 'Год — Плановое значение', placeholder: '', multiline: false },
  { key: 'comments', label: 'Комментарии', placeholder: '', multiline: true },
  { key: 'methodDesc', label: 'Краткая методика расчета или описание КПЭ', placeholder: '', multiline: true },
  { key: 'sourceInfo', label: 'Источник информации о фактическом выполнении КПЭ', placeholder: '', multiline: true },
  { key: 'reportYear', label: 'Отчётный год', placeholder: '2026', multiline: false },
]

export function LeaderGoalsPage() {
  const [goalsState, setGoalsState] = useState<{ rows: LeaderGoalRow[] }>({ rows: [] })
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<LeaderGoalRow | null>(null)
  const [page, setPage] = useState(1)
  const [filterText, setFilterText] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingClearTable, setPendingClearTable] = useState(false)
  const [isAddingNewRow, setIsAddingNewRow] = useState(false)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<LeaderGoalField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const skipSyncRef = useRef(true)
  const exportDropdownRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getLeaderGoalRows()
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
    void saveLeaderGoalRows(goalsState.rows)
      .then(() => setDataError(null))
      .catch((err) => {
        setDataError(err instanceof Error ? err.message : 'Не удалось сохранить данные.')
      })
  }, [goalsState, isLoaded])

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

  const collator = useMemo(() => new Intl.Collator('ru', { numeric: true, sensitivity: 'base' }), [])

  const normalizedFilter = filterText.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    if (!normalizedFilter) return goalsState.rows
    return goalsState.rows.filter((row) => {
      const searchable = COLUMNS.map((col) => String(row[col.key] ?? '')).join(' ').toLowerCase()
      return searchable.includes(normalizedFilter)
    })
  }, [goalsState.rows, normalizedFilter])

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
  const pageRows = useMemo(
    () => sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sortedRows, page]
  )

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, [normalizedFilter, sortKey, sortDirection])

  const addRow = useCallback(() => {
    const newRow = createRow()
    setGoalsState((prev) => ({ ...prev, rows: [...prev.rows, newRow] }))
    setEditingRowId(newRow.id)
    setEditingDraft(newRow)
    setIsAddingNewRow(true)
    setPage(Math.ceil((goalsState.rows.length + 1) / PAGE_SIZE))
  }, [goalsState.rows.length])

  const startEdit = useCallback((row: LeaderGoalRow) => {
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
    (draft: LeaderGoalRow) => {
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

  const hasFilter = normalizedFilter.length > 0

  const handleSort = useCallback((key: LeaderGoalField) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDirection('asc')
      return key
    })
  }, [])

  const handleImportClick = useCallback(() => {
    setImportError(null)
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const isXlsx = /\.xlsx$/i.test(file.name)
    if (!isXlsx) {
      setImportError('Выберите файл .xlsx')
      return
    }
    parseLeaderGoalsXlsxToRows(file)
      .then((rows) => {
        if (rows.length === 0) {
          setImportError(
            'В файле нет данных или заголовки не совпадают. Ожидаются: ФИО, № цели, Наименование КПЭ, Тип цели, Вид цели, Ед. изм., кварталы и год, Комментарии, Методика расчёта, Источник информации, Отчётный год.'
          )
          return
        }
        setGoalsState((prev) => ({ ...prev, rows: [...prev.rows, ...rows] }))
        setImportError(null)
      })
      .catch((err) => {
        setImportError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
      })
  }, [])

  const handleExport = useCallback(
    (format: 'csv' | 'xlsx' | 'pdf' | 'docx' | 'html') => {
      setExportDropdownOpen(false)
      const rows = goalsState.rows
      const prefix = 'руководители'
      if (format === 'csv') exportLeaderGoalsCSV(rows, prefix)
      else if (format === 'xlsx') exportLeaderGoalsExcel(rows, prefix)
      else if (format === 'html') exportLeaderGoalsHTML(rows, prefix)
      else if (format === 'pdf') {
        exportLeaderGoalsPDF(rows, prefix).catch((err) => {
          console.error('Ошибка экспорта PDF:', err)
          alert('Не удалось создать PDF. Проверьте консоль браузера (F12).')
        })
      } else if (format === 'docx') {
        exportLeaderGoalsDOCX(rows, prefix).catch((err) => {
          console.error('Ошибка экспорта DOCX:', err)
          alert('Не удалось создать DOCX. Проверьте консоль браузера (F12).')
        })
      }
    },
    [goalsState.rows]
  )

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>Линейный менеджмент</h1>
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
              disabled={!!editingRowId}
              title="Импорт из xlsx"
            >
              Импортировать
            </button>
            <button
              type="button"
              className={styles.clearTableBtn}
              onClick={() => setPendingClearTable(true)}
              disabled={goalsState.rows.length === 0 || !!editingRowId}
              title="Удалить все записи"
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

        <div className={styles.filtersPanel}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Поиск</span>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="По всем полям..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              disabled={!!editingRowId}
              aria-label="Поиск по таблице"
            />
          </label>
          {hasFilter && (
            <button
              type="button"
              className={styles.resetFiltersBtn}
              onClick={() => setFilterText('')}
              disabled={!!editingRowId}
            >
              Сбросить фильтр
            </button>
          )}
        </div>

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

        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.leaderGoalsTable}`}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={col.cellClassName} scope="col">
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => handleSort(col.key)}
                      disabled={!!editingRowId}
                      aria-label={`Сортировать по: ${col.label.replace(/\n/g, ' ')}`}
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
                <th className={styles.actionsCol} scope="col">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {goalsState.rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={COLUMNS.length + 1}>
                    Пока нет целей. Добавьте первую строку.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={COLUMNS.length + 1}>
                    Нет совпадений по фильтру.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id}>
                    {COLUMNS.map((col) => {
                      const value = row[col.key] ?? ''
                      const isEmpty = !String(value).trim()
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
                            title={isEmpty ? undefined : String(value)}
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

        <div className={`${styles.tableFooter} ${styles.tableFooterRight}`}>
          <div className={styles.exportWrap} ref={exportDropdownRef}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => setExportDropdownOpen((v) => !v)}
              disabled={!!editingRowId || goalsState.rows.length === 0}
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
          <span className={styles.paginationSummary}>
            {sortedRows.length} записей
            {sortedRows.length > 0 && `, стр. ${page} из ${totalPages}`}
          </span>
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
                  className={pageNumber === page ? `${styles.paginationBtn} ${styles.paginationBtnActive}` : styles.paginationBtn}
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
        message="Удалить эту запись?"
        confirmLabel="Удалить"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
        danger
      />

      <ConfirmModal
        open={pendingClearTable}
        title="Очистить таблицу"
        message="Удалить все записи в таблице «Линейный менеджмент»? Это действие нельзя отменить."
        confirmLabel="Очистить"
        onConfirm={confirmClearTable}
        onCancel={() => setPendingClearTable(false)}
        danger
      />

      <EditLeaderGoalModal
        open={editingRowId !== null}
        title={isAddingNewRow ? 'Новая запись' : 'Редактирование записи'}
        row={editingDraft}
        fields={EDIT_FIELDS}
        onSave={saveEdit}
        onCancel={cancelEdit}
      />
    </div>
  )
}
