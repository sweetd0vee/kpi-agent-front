import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getProcessRegistryRows,
  saveProcessRegistryRows,
  uploadProcessRegistryXlsx,
  type ProcessRegistryRow,
} from '@/api/registry'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import { EditRegistryRowModal, type RegistryRowField } from '@/components/EditRegistryRowModal/EditRegistryRowModal'
import { PlusIcon, TrashIcon, PencilIcon } from '@/components/Icons'
import { useColumnResize } from '@/hooks/useColumnResize'
import { createRuNumericCollator } from '@/lib/goalsTableUtils'
import { generateId } from '@/lib/storage'
import styles from './GoalsPage.module.css'

type ProcessRegistryField = keyof Omit<ProcessRegistryRow, 'id'>

const emptyRow = (): ProcessRegistryRow => ({
  id: generateId(),
  processArea: '',
  processCode: '',
  process: '',
  processOwner: '',
  leader: '',
  businessUnit: '',
  top20: '',
})

const COLUMNS: { key: ProcessRegistryField; label: string; cellClassName: string }[] = [
  { key: 'processArea', label: 'Процессная область', cellClassName: styles.colGoal },
  { key: 'processCode', label: 'Код процесса', cellClassName: styles.colWeight },
  { key: 'process', label: 'Процесс', cellClassName: styles.colMetricGoals },
  { key: 'processOwner', label: 'Владелец процесса', cellClassName: styles.colGoal },
  { key: 'leader', label: 'Руководитель', cellClassName: styles.colSurname },
  { key: 'businessUnit', label: 'Бизнес юнит', cellClassName: styles.colWeight },
  { key: 'top20', label: 'ТОП 20', cellClassName: styles.colQuarter },
]

const EDIT_FIELDS: RegistryRowField<ProcessRegistryRow>[] = COLUMNS.map((col) => ({
  key: col.key,
  label: col.label,
  placeholder: '',
  multiline: col.key === 'processArea' || col.key === 'process' || col.key === 'processOwner',
}))

const DEFAULT_PAGE_SIZE = 15

export function ProcessRegistryPage() {
  const [state, setState] = useState<{ rows: ProcessRegistryRow[] }>({ rows: [] })
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingClearTable, setPendingClearTable] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<ProcessRegistryRow | null>(null)
  const [isAddingNewRow, setIsAddingNewRow] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [sortKey, setSortKey] = useState<ProcessRegistryField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number | 'all'>(DEFAULT_PAGE_SIZE)
  const skipSyncRef = useRef(true)
  const importInputRef = useRef<HTMLInputElement>(null)
  const { colWidths, startColumnResize } = useColumnResize(editingRowId)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getProcessRegistryRows()
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
    void saveProcessRegistryRows(state.rows)
      .then((rows) => {
        setDataError(null)
        skipSyncRef.current = true
        setState({ rows })
      })
      .catch((err) => {
        setDataError(err instanceof Error ? err.message : 'Не удалось сохранить данные.')
      })
  }, [state, isLoaded])

  const collator = useMemo(() => createRuNumericCollator(), [])

  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return state.rows
    return state.rows.filter((row) =>
      COLUMNS.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q))
    )
  }, [state.rows, filterText])

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

  const pageSizeNumber = pageSize === 'all' ? sortedRows.length || 1 : pageSize
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(sortedRows.length / pageSizeNumber))
  const pageStart = (page - 1) * pageSizeNumber
  const pageRows = pageSize === 'all' ? sortedRows : sortedRows.slice(pageStart, pageStart + pageSizeNumber)

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, [filterText, sortDirection, sortKey, pageSize])

  const handleSort = useCallback((key: ProcessRegistryField) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDirection('asc')
      return key
    })
  }, [])

  const startEdit = useCallback((row: ProcessRegistryRow) => {
    setEditingRowId(row.id)
    setEditingDraft({ ...row })
    setIsAddingNewRow(false)
  }, [])

  const cancelEdit = useCallback(() => {
    if (isAddingNewRow && editingRowId) {
      setState((prev) => ({ rows: prev.rows.filter((r) => r.id !== editingRowId) }))
    }
    setIsAddingNewRow(false)
    setEditingRowId(null)
    setEditingDraft(null)
  }, [editingRowId, isAddingNewRow])

  const saveEdit = useCallback(
    (draft: ProcessRegistryRow) => {
      if (!editingRowId) return
      setState((prev) => ({ rows: prev.rows.map((row) => (row.id === editingRowId ? draft : row)) }))
      setIsAddingNewRow(false)
      setEditingRowId(null)
      setEditingDraft(null)
    },
    [editingRowId]
  )

  const addRow = useCallback(() => {
    const newRow = emptyRow()
    setState((prev) => ({ rows: [...prev.rows, newRow] }))
    setEditingRowId(newRow.id)
    setEditingDraft(newRow)
    setIsAddingNewRow(true)
  }, [])

  const deleteRow = useCallback((id: string) => {
    setState((prev) => ({ rows: prev.rows.filter((r) => r.id !== id) }))
    if (editingRowId === id) {
      setEditingRowId(null)
      setEditingDraft(null)
      setIsAddingNewRow(false)
    }
  }, [editingRowId])

  const confirmClearTable = useCallback(() => {
    setState({ rows: [] })
    setPendingClearTable(false)
    setEditingRowId(null)
    setEditingDraft(null)
    setIsAddingNewRow(false)
  }, [])

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
        setImportError('Дождитесь окончания загрузки таблицы.')
        return
      }
      if (!/\.xlsx$/i.test(file.name)) {
        setImportError('Выберите файл .xlsx')
        return
      }
      uploadProcessRegistryXlsx(file)
        .then((rows) => {
          skipSyncRef.current = true
          setState({ rows })
          setDataError(null)
          setImportError(null)
          setEditingRowId(null)
          setEditingDraft(null)
          setIsAddingNewRow(false)
        })
        .catch((err) => {
          setImportError(err instanceof Error ? err.message : 'Не удалось импортировать файл.')
        })
    },
    [isLoaded, isLoading]
  )

  const hasActiveFilters = filterText.trim().length > 0

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Реестр процессов</h1>
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
              disabled={!isLoaded || isLoading || !!editingRowId}
              title="Загрузить .xlsx (полная замена таблицы в базе)"
            >
              Импортировать
            </button>
            <button
              type="button"
              className={styles.clearTableBtn}
              onClick={() => setPendingClearTable(true)}
              disabled={state.rows.length === 0 || !!editingRowId}
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
              disabled={!!editingRowId}
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
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Поиск</span>
              <input
                type="search"
                className={styles.filterInput}
                placeholder="По всем колонкам..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                aria-label="Поиск по таблице"
                disabled={!!editingRowId}
              />
            </label>
          </div>
          <div className={styles.filtersActions}>
            <button
              type="button"
              className={styles.resetFiltersBtn}
              onClick={() => setFilterText('')}
              disabled={!hasActiveFilters || !!editingRowId}
              title="Сбросить поиск"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.leaderGoalsTable}`}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={col.cellClassName} scope="col" style={colWidths[col.key] ? { width: colWidths[col.key] } : undefined}>
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
                    <div
                      className={styles.colResizeHandle}
                      role="separator"
                      aria-label={`Изменить ширину колонки: ${col.label}`}
                      onMouseDown={(e) => startColumnResize(col.key, e)}
                    />
                  </th>
                ))}
                <th className={styles.actionsCol} scope="col">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {state.rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={COLUMNS.length + 1}>
                    Нет записей. Импортируйте xlsx или добавьте строку вручную.
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
                      const multiline =
                        col.key === 'processArea' || col.key === 'process' || col.key === 'processOwner'
                      return (
                        <td key={col.key} className={col.cellClassName} style={colWidths[col.key] ? { width: colWidths[col.key] } : undefined}>
                          <span
                            className={[styles.valueText, multiline ? styles.valueMultiline : '', isEmpty ? styles.valueMuted : '']
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

        <div className={`${styles.tableFooter} ${styles.tableFooterRight}`}>
          <span className={styles.paginationSummary}>
            {sortedRows.length === 0
              ? '0 записей'
              : (() => {
                  const from = pageSize === 'all' ? 1 : pageStart + 1
                  const to =
                    pageSize === 'all' ? sortedRows.length : Math.min(sortedRows.length, pageStart + pageSizeNumber)
                  const pageInfo = totalPages > 1 && pageSize !== 'all' ? `, стр. ${page} из ${totalPages}` : ''
                  return `Записи ${from}–${to} из ${sortedRows.length}${pageInfo}`
                })()}
          </span>

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

      <EditRegistryRowModal<ProcessRegistryRow>
        open={editingRowId !== null}
        title={isAddingNewRow ? 'Новая запись' : 'Редактирование записи'}
        row={editingDraft}
        fields={EDIT_FIELDS}
        formId="edit-process-registry-row-form"
        ariaTitleId="edit-process-registry-row-modal-title"
        fieldIdPrefix="edit-process-registry"
        onSave={saveEdit}
        onCancel={cancelEdit}
      />

      <ConfirmModal
        open={pendingDeleteId !== null}
        title="Удалить строку?"
        message="Запись будет удалена из таблицы и из базы после сохранения."
        confirmLabel="Удалить"
        onConfirm={() => {
          if (pendingDeleteId) deleteRow(pendingDeleteId)
          setPendingDeleteId(null)
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
      <ConfirmModal
        open={pendingClearTable}
        title="Очистить таблицу?"
        message="Все записи реестра будут удалены из базы. Это действие нельзя отменить."
        confirmLabel="Очистить"
        onConfirm={confirmClearTable}
        onCancel={() => setPendingClearTable(false)}
      />
    </div>
  )
}
