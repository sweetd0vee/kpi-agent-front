import { useEffect, useMemo, useState } from 'react'
import { getBoardGoalRows, getStrategyGoalRows } from '@/api/goals'
import { getProcessRegistryRows, getStaffRows } from '@/api/registry'
import type { GoalRow, StrategyGoalRow } from '@/lib/storage'
import styles from './DashboardsPage.module.css'

const collatorRu = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })
const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()
const normalizePerson = (s: string | null | undefined) =>
  norm(s).replace(/\s+/g, ' ').replace(/ё/g, 'е').replace(/[.]/g, '').trim()

export function DashboardsPage() {
  const [boardRowsAll, setBoardRowsAll] = useState<GoalRow[]>([])
  const [strategyRowsAll, setStrategyRowsAll] = useState<StrategyGoalRow[]>([])
  const [staffRowsAll, setStaffRowsAll] = useState<Array<{ head: string; businessUnit: string }>>([])
  const [processRowsAll, setProcessRowsAll] = useState<Array<{ leader: string; businessUnit: string }>>([])
  const [reportYearFilter, setReportYearFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reportYearOptions = useMemo(() => {
    const set = new Set<string>()
    boardRowsAll.forEach((r) => {
      const y = String(r.reportYear ?? '').trim()
      if (y) set.add(y)
    })
    return Array.from(set).sort((a, b) => collatorRu.compare(a, b))
  }, [boardRowsAll])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      getBoardGoalRows(),
      getStrategyGoalRows(),
      getStaffRows(),
      getProcessRegistryRows(),
    ])
      .then(([board, strategy, staff, process]) => {
        if (!active) return
        setBoardRowsAll(board)
        setStrategyRowsAll(strategy)
        setStaffRowsAll(staff.map((s) => ({ head: s.head, businessUnit: s.businessUnit })))
        setProcessRowsAll(process.map((p) => ({ leader: p.leader, businessUnit: p.businessUnit })))
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Не удалось загрузить данные.')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const boardRows = useMemo(() => {
    return boardRowsAll.filter((r) => {
      const yearOk = !reportYearFilter || String(r.reportYear ?? '').trim() === reportYearFilter
      return yearOk
    })
  }, [boardRowsAll, reportYearFilter])

  const strategyRows = useMemo(
    () => strategyRowsAll,
    [strategyRowsAll]
  )

  const staffRows = useMemo(
    () => staffRowsAll,
    [staffRowsAll]
  )

  const processRows = useMemo(
    () => processRowsAll,
    [processRowsAll]
  )

  const leaderGoalsByLeader = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    boardRows.forEach((r) => {
      const rawName = String(r.lastName ?? '').trim()
      const key = normalizePerson(rawName)
      if (!key) return
      const prev = map.get(key)
      if (prev) {
        map.set(key, { ...prev, count: prev.count + 1 })
      } else {
        map.set(key, { name: rawName || '—', count: 1 })
      }
    })
    return map
  }, [boardRows])

  const unitCoverage = useMemo(() => {
    const units = new Set<string>()
    const add = (v: string) => {
      const t = v.trim()
      if (t) units.add(t)
    }
    boardRows.forEach((r) => add(String(r.businessUnit ?? '')))
    strategyRows.forEach((r) => add(String(r.businessUnit ?? '')))
    staffRows.forEach((r) => add(String(r.businessUnit ?? '')))
    processRows.forEach((r) => add(String(r.businessUnit ?? '')))

    return {
      total: units.size,
      withBoard: Array.from(units).filter((u) => boardRows.some((r) => String(r.businessUnit ?? '').trim() === u)).length,
      withStrategy: Array.from(units).filter((u) => strategyRows.some((r) => String(r.businessUnit ?? '').trim() === u)).length,
      withStaff: Array.from(units).filter((u) => staffRows.some((r) => String(r.businessUnit ?? '').trim() === u)).length,
      withProcess: Array.from(units).filter((u) => processRows.some((r) => String(r.businessUnit ?? '').trim() === u)).length,
    }
  }, [boardRows, processRows, staffRows, strategyRows])

  const topLeaders = useMemo(() => {
    return Array.from(leaderGoalsByLeader.values())
      .map((v) => ({ name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [leaderGoalsByLeader])

  const maxTopLeaders = useMemo(() => Math.max(1, ...topLeaders.map((i) => i.count)), [topLeaders])

  const hasAnyData =
    boardRows.length > 0 || strategyRows.length > 0 || staffRows.length > 0 || processRows.length > 0

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Дашборды</h1>

      <div className={styles.tabPanel}>
        {error ? (
          <div className={styles.emptyState} role="alert">
            {error}
          </div>
        ) : loading ? (
          <div className={styles.emptyState} role="status">
            Загрузка данных...
          </div>
        ) : !hasAnyData ? (
          <div className={styles.emptyState}>
            Нет данных для дашбордов. Заполните таблицы и загрузите данные.
          </div>
        ) : (
        <>
          <section className={styles.yearFilterSection} aria-labelledby="dashboard-report-year-label">
            <h2 id="dashboard-report-year-label" className={styles.sectionTitle}>Фильтры</h2>
            <p className={styles.yearFilterDesc}>
              Дашборды строятся по связанным таблицам: цели правления, стратегия, штат и реестр процессов.
            </p>
            <div className={styles.eulerSelects}>
              <label className={styles.eulerSelectLabel}>
                Отчётный год
                <select
                  className={styles.eulerSelect}
                  value={reportYearFilter}
                  onChange={(e) => setReportYearFilter(e.target.value)}
                  aria-label="Выберите отчётный год"
                >
                  <option value="">Все годы</option>
                  {reportYearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={styles.eulerSection} aria-labelledby="rel-title">
            <h2 id="rel-title" className={styles.eulerSectionTitle}>Связность таблиц</h2>
            <p className={styles.eulerSectionDesc}>
              Метрики показывают, насколько строки из разных таблиц согласованы между собой по ФИО и бизнес-блоку.
            </p>
            <div className={styles.connectivityCards}>
              <div className={styles.card}>
                <div className={styles.cardValue}>{boardRows.length}</div>
                <div className={styles.cardLabel}>строк в целях правления</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardValue}>{strategyRows.length}</div>
                <div className={styles.cardLabel}>строк в целях стратегии</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardValue}>{staffRows.length}</div>
                <div className={styles.cardLabel}>строк в штатном расписании</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardValue}>{processRows.length}</div>
                <div className={styles.cardLabel}>строк в реестре процессов</div>
              </div>
            </div>
          </section>

          <h2 className={styles.sectionTitle}>Кросс-табличные дашборды</h2>
          <div className={styles.dashboardsGrid}>
            <div className={`${styles.chartCard} ${styles.chartCardTopLeaders}`}>
              <h3 className={styles.chartCardTitle}>Топ ФИО по количеству целей правления</h3>
              {topLeaders.length === 0 ? (
                <p className={styles.barValue}>Нет данных</p>
              ) : (
                <div className={styles.employeeBars}>
                  {topLeaders.map((e, i) => (
                    <div key={i} className={styles.employeeRow}>
                      <span className={styles.employeeName} title={e.name}>
                        {e.name}
                      </span>
                      <div className={styles.employeeBarWrap}>
                        <div
                          className={styles.employeeBar}
                          style={{ width: `${(e.count / maxTopLeaders) * 100}%` }}
                        />
                      </div>
                      <span className={styles.employeeCount}>{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`${styles.chartCard} ${styles.chartCardWide}`}>
              <h3 className={styles.chartCardTitle}>Матрица по бизнес-блокам</h3>
              <div className={styles.cardsGrid}>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{unitCoverage.total}</div>
                  <div className={styles.cardLabel}>уникальных бизнес-блоков</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{unitCoverage.withBoard}</div>
                  <div className={styles.cardLabel}>блоков с целями правления</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{unitCoverage.withStrategy}</div>
                  <div className={styles.cardLabel}>блоков со стратегией</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{unitCoverage.withStaff}</div>
                  <div className={styles.cardLabel}>блоков в штатном расписании</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{unitCoverage.withProcess}</div>
                  <div className={styles.cardLabel}>блоков в реестре процессов</div>
                </div>
              </div>
            </div>
          </div>

        </>
      )}
      </div>
    </div>
  )
}
