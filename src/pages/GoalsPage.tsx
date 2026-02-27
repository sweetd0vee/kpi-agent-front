import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateId, getGoalsState, saveGoalsState, type GoalRow } from '@/lib/storage'
import styles from './GoalsPage.module.css'

type GoalField = keyof Omit<GoalRow, 'id'>

const PAGE_SIZE = 20

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
  q1: '',
  q2: '',
  q3: '',
  q4: '',
  year: '',
})

const DEMO_ROWS: Array<Omit<GoalRow, 'id'>> = [
  { lastName: 'Иванов Иван Иванович', goal: 'Рост чистой прибыли', q1: '+5%', q2: '+7%', q3: '+9%', q4: '+12%', year: '2026' },
  { lastName: 'Петров Петр Петрович', goal: 'Снижение просроченной задолженности', q1: '-0.3%', q2: '-0.5%', q3: '-0.7%', q4: '-1%', year: '2026' },
  { lastName: 'Сидоров Сергей Сергеевич', goal: 'Увеличение доли цифровых продаж', q1: '35%', q2: '40%', q3: '45%', q4: '50%', year: '2026' },
  { lastName: 'Кузнецов Максим Андреевич', goal: 'Рост операционной эффективности', q1: '+2%', q2: '+4%', q3: '+6%', q4: '+8%', year: '2026' },
  { lastName: 'Смирнов Алексей Павлович', goal: 'Оптимизация затрат на персонал', q1: '-1%', q2: '-2%', q3: '-3%', q4: '-4%', year: '2026' },
  { lastName: 'Попов Николай Викторович', goal: 'Развитие корпоративного портфеля', q1: '+4%', q2: '+6%', q3: '+8%', q4: '+10%', year: '2026' },
  { lastName: 'Васильев Артем Николаевич', goal: 'Рост клиентской удовлетворенности', q1: 'NPS 48', q2: 'NPS 52', q3: 'NPS 55', q4: 'NPS 58', year: '2026' },
  { lastName: 'Новиков Дмитрий Олегович', goal: 'Сокращение сроков кредитного решения', q1: '5 дн.', q2: '4 дн.', q3: '3 дн.', q4: '2 дн.', year: '2026' },
  { lastName: 'Федоров Илья Сергеевич', goal: 'Увеличение комиссионного дохода', q1: '+6%', q2: '+8%', q3: '+10%', q4: '+12%', year: '2026' },
  { lastName: 'Морозов Константин Евгеньевич', goal: 'Рост доли ESG-проектов', q1: '8%', q2: '10%', q3: '12%', q4: '15%', year: '2026' },
  { lastName: 'Волков Антон Игоревич', goal: 'Повышение точности скоринга', q1: '85%', q2: '88%', q3: '90%', q4: '92%', year: '2026' },
  { lastName: 'Алексеев Павел Дмитриевич', goal: 'Оптимизация процессов KYC', q1: '90%', q2: '92%', q3: '94%', q4: '96%', year: '2026' },
  { lastName: 'Лебедев Кирилл Валерьевич', goal: 'Развитие продуктовой линейки МСБ', q1: '+2 продукта', q2: '+3 продукта', q3: '+4 продукта', q4: '+5 продукта', year: '2026' },
  { lastName: 'Семенов Роман Николаевич', goal: 'Снижение операционных рисков', q1: '-5%', q2: '-8%', q3: '-10%', q4: '-12%', year: '2026' },
  { lastName: 'Егоров Виталий Михайлович', goal: 'Рост портфеля ипотеки', q1: '+3%', q2: '+5%', q3: '+7%', q4: '+9%', year: '2026' },
  { lastName: 'Павлов Денис Владимирович', goal: 'Развитие партнерских каналов', q1: '4 партнера', q2: '6 партнеров', q3: '8 партнеров', q4: '10 партнеров', year: '2026' },
  { lastName: 'Козлов Аркадий Ильич', goal: 'Снижение time-to-market', q1: '8 нед.', q2: '7 нед.', q3: '6 нед.', q4: '5 нед.', year: '2026' },
  { lastName: 'Степанов Игорь Семенович', goal: 'Рост конверсии лидов', q1: '18%', q2: '20%', q3: '22%', q4: '25%', year: '2026' },
  { lastName: 'Николаев Владислав Петрович', goal: 'Повышение киберустойчивости', q1: '95%', q2: '96%', q3: '97%', q4: '98%', year: '2026' },
  { lastName: 'Орлов Тимофей Алексеевич', goal: 'Увеличение доли безналичных операций', q1: '62%', q2: '65%', q3: '68%', q4: '70%', year: '2026' },
]

const buildDemoRows = (): GoalRow[] => DEMO_ROWS.map((row) => ({ id: generateId(), ...row }))

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

export function GoalsPage() {
  const [goalsState, setGoalsState] = useState(() => {
    const stored = getGoalsState()
    if (stored.rows.length === 0) {
      const seeded = { rows: buildDemoRows() }
      saveGoalsState(seeded)
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

  useEffect(() => {
    saveGoalsState(goalsState)
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
      label: 'Цель',
      placeholder: 'Например: рост эффективности операционных затрат',
      cellClassName: styles.colGoal,
      inputClassName: `${styles.input} ${styles.goalInput}`,
      valueClassName: styles.valueMultiline,
      multiline: true,
    },
    {
      key: 'q1',
      label: 'Квартал 1',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'q2',
      label: 'Квартал 2',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'q3',
      label: 'Квартал 3',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'q4',
      label: 'Квартал 4',
      placeholder: 'KPI',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
    {
      key: 'year',
      label: 'Год',
      placeholder: '2026',
      cellClassName: styles.colQuarter,
      inputClassName: `${styles.input} ${styles.quarterInput}`,
      valueClassName: styles.valueCenter,
    },
  ]

  const addRow = useCallback(() => {
    const newRow = createRow()
    setGoalsState((prev) => ({
      ...prev,
      rows: [...prev.rows, newRow],
    }))
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

  const deleteRow = useCallback(
    (id: string) => {
      setGoalsState((prev) => ({
        ...prev,
        rows: prev.rows.filter((row) => row.id !== id),
      }))
      if (editingRowId === id) {
        setEditingRowId(null)
        setEditingDraft(null)
      }
    },
    [editingRowId]
  )

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>Цели</h1>
        </div>
      </header>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div className={styles.sectionSpacer} aria-hidden />
          <div className={styles.sectionActions}>
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

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className={col.cellClassName}>
                    {col.key === 'lastName' ? (
                      <div className={styles.headerWithSearch}>
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
                        <label className={`${styles.searchField} ${styles.searchFieldCompact}`}>
                          <SearchIcon className={styles.searchIcon} />
                          <input
                            type="search"
                            className={`${styles.searchInput} ${styles.searchInputCompact}`}
                            value={searchLastName}
                            onChange={(e) => setSearchLastName(e.target.value)}
                            placeholder="Поиск"
                          aria-label="Поиск по ФИО"
                            disabled={!!editingRowId}
                          />
                        </label>
                      </div>
                    ) : col.key === 'goal' ? (
                      <div className={styles.headerWithSearch}>
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
                        <label className={`${styles.searchField} ${styles.searchFieldWide}`}>
                          <SearchIcon className={styles.searchIcon} />
                          <input
                            type="search"
                            className={`${styles.searchInput} ${styles.searchInputWide}`}
                            value={searchGoal}
                            onChange={(e) => setSearchGoal(e.target.value)}
                            placeholder="Поиск"
                            aria-label="Поиск по цели"
                            disabled={!!editingRowId}
                          />
                        </label>
                      </div>
                    ) : (
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
                                <textarea
                                  className={col.inputClassName}
                                  value={value}
                                  rows={2}
                                  placeholder={col.placeholder}
                                  onChange={(e) => updateDraft(col.key, e.target.value)}
                                  aria-label={`${col.label}, строка ${rowNumber}`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  className={col.inputClassName}
                                  value={value}
                                  placeholder={col.placeholder}
                                  onChange={(e) => updateDraft(col.key, e.target.value)}
                                  aria-label={`${col.label}, строка ${rowNumber}`}
                                />
                              )
                            ) : (
                              <span
                                className={[
                                  styles.valueText,
                                  col.valueClassName ?? '',
                                  isEmpty ? styles.valueMuted : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {isEmpty ? '—' : value}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      <td className={styles.actionsCell}>
                        <div className={styles.actionGroup}>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className={styles.saveBtn}
                                onClick={saveEdit}
                                disabled={!editingDraft}
                              >
                                Сохранить
                              </button>
                              <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>
                                Отмена
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnEdit}`}
                              onClick={() => startEdit(row)}
                              disabled={!!editingRowId && editingRowId !== row.id}
                              aria-label="Редактировать строку"
                              title="Редактировать"
                            >
                              <PencilIcon className={styles.pencilIcon} />
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            onClick={() => deleteRow(row.id)}
                            aria-label="Удалить строку"
                          >
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

        {totalPages > 1 && (
          <div className={styles.tableFooter}>
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
          </div>
        )}
      </section>
    </div>
  )
}
