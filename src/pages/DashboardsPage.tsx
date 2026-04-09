import { useEffect, useMemo, useState } from 'react'
import { getBoardGoalRows, getLeaderGoalRows, getStrategyGoalRows } from '@/api/goals'
import { getProcessRegistryRows, getStaffRows } from '@/api/registry'
import type { GoalRow, LeaderGoalRow, StrategyGoalRow } from '@/lib/storage'
import styles from './DashboardsPage.module.css'

const collatorRu = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })
const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()

export function DashboardsPage() {
  const [boardRowsAll, setBoardRowsAll] = useState<GoalRow[]>([])
  const [leaderRowsAll, setLeaderRowsAll] = useState<LeaderGoalRow[]>([])
  const [strategyRowsAll, setStrategyRowsAll] = useState<StrategyGoalRow[]>([])
  const [staffRowsAll, setStaffRowsAll] = useState<Array<{ head: string; businessUnit: string }>>([])
  const [processRowsAll, setProcessRowsAll] = useState<Array<{ leader: string; businessUnit: string }>>([])
  const [reportYearFilter, setReportYearFilter] = useState<string>('')
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reportYearOptions = useMemo(() => {
    const set = new Set<string>()
    boardRowsAll.forEach((r) => {
      const y = String(r.reportYear ?? '').trim()
      if (y) set.add(y)
    })
    leaderRowsAll.forEach((r) => {
      const y = String(r.reportYear ?? '').trim()
      if (y) set.add(y)
    })
    return Array.from(set).sort((a, b) => collatorRu.compare(a, b))
  }, [boardRowsAll, leaderRowsAll])

  const businessUnitOptions = useMemo(() => {
    const set = new Set<string>()
    boardRowsAll.forEach((r) => {
      const bu = String(r.businessUnit ?? '').trim()
      if (bu) set.add(bu)
    })
    strategyRowsAll.forEach((r) => {
      const bu = String(r.businessUnit ?? '').trim()
      if (bu) set.add(bu)
    })
    staffRowsAll.forEach((r) => {
      const bu = String(r.businessUnit ?? '').trim()
      if (bu) set.add(bu)
    })
    processRowsAll.forEach((r) => {
      const bu = String(r.businessUnit ?? '').trim()
      if (bu) set.add(bu)
    })
    return Array.from(set).sort((a, b) => collatorRu.compare(a, b))
  }, [boardRowsAll, processRowsAll, staffRowsAll, strategyRowsAll])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      getBoardGoalRows(),
      getLeaderGoalRows(),
      getStrategyGoalRows(),
      getStaffRows(),
      getProcessRegistryRows(),
    ])
      .then(([board, leader, strategy, staff, process]) => {
        if (!active) return
        setBoardRowsAll(board)
        setLeaderRowsAll(leader)
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
      const buOk = !businessUnitFilter || String(r.businessUnit ?? '').trim() === businessUnitFilter
      return yearOk && buOk
    })
  }, [boardRowsAll, businessUnitFilter, reportYearFilter])

  const boardLeaders = useMemo(() => {
    const set = new Set<string>()
    boardRows.forEach((r) => {
      const v = String(r.lastName ?? '').trim()
      if (v) set.add(v)
    })
    return set
  }, [boardRows])

  const leaderRows = useMemo(() => {
    return leaderRowsAll.filter((r) => {
      const yearOk = !reportYearFilter || String(r.reportYear ?? '').trim() === reportYearFilter
      if (!yearOk) return false
      if (!businessUnitFilter) return true
      return boardLeaders.has(String(r.lastName ?? '').trim())
    })
  }, [boardLeaders, businessUnitFilter, leaderRowsAll, reportYearFilter])

  const strategyRows = useMemo(
    () =>
      strategyRowsAll.filter((r) => {
        return !businessUnitFilter || String(r.businessUnit ?? '').trim() === businessUnitFilter
      }),
    [businessUnitFilter, strategyRowsAll]
  )

  const staffRows = useMemo(
    () =>
      staffRowsAll.filter((r) => {
        return !businessUnitFilter || String(r.businessUnit ?? '').trim() === businessUnitFilter
      }),
    [businessUnitFilter, staffRowsAll]
  )

  const processRows = useMemo(
    () =>
      processRowsAll.filter((r) => {
        return !businessUnitFilter || String(r.businessUnit ?? '').trim() === businessUnitFilter
      }),
    [businessUnitFilter, processRowsAll]
  )

  const leaderGoalsByLeader = useMemo(() => {
    const map = new Map<string, number>()
    leaderRows.forEach((r) => {
      const key = String(r.lastName ?? '').trim()
      if (!key) return
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return map
  }, [leaderRows])

  const staffHeadsSet = useMemo(() => {
    const set = new Set<string>()
    staffRows.forEach((r) => {
      const v = String(r.head ?? '').trim()
      if (v) set.add(v)
    })
    return set
  }, [staffRows])

  const boardCoverage = useMemo(() => {
    const leaders = Array.from(boardLeaders)
    let withLeaderGoals = 0
    let withStaff = 0
    leaders.forEach((leader) => {
      if ((leaderGoalsByLeader.get(leader) ?? 0) > 0) withLeaderGoals += 1
      if (staffHeadsSet.has(leader)) withStaff += 1
    })
    return {
      totalLeaders: leaders.length,
      withLeaderGoals,
      withStaff,
      withoutLeaderGoals: Math.max(0, leaders.length - withLeaderGoals),
      withoutStaff: Math.max(0, leaders.length - withStaff),
    }
  }, [boardLeaders, leaderGoalsByLeader, staffHeadsSet])

  const unitMatrix = useMemo(() => {
    const units = new Set<string>()
    const add = (v: string) => {
      const t = v.trim()
      if (t) units.add(t)
    }
    boardRows.forEach((r) => add(String(r.businessUnit ?? '')))
    strategyRows.forEach((r) => add(String(r.businessUnit ?? '')))
    staffRows.forEach((r) => add(String(r.businessUnit ?? '')))
    processRows.forEach((r) => add(String(r.businessUnit ?? '')))

    const list = Array.from(units).sort((a, b) => collatorRu.compare(a, b))
    return list.map((u) => ({
      unit: u,
      board: boardRows.filter((r) => String(r.businessUnit ?? '').trim() === u).length,
      strategy: strategyRows.filter((r) => String(r.businessUnit ?? '').trim() === u).length,
      staff: staffRows.filter((r) => String(r.businessUnit ?? '').trim() === u).length,
      process: processRows.filter((r) => String(r.businessUnit ?? '').trim() === u).length,
    }))
  }, [boardRows, processRows, staffRows, strategyRows])

  const topLeaders = useMemo(() => {
    return Array.from(leaderGoalsByLeader.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [leaderGoalsByLeader])

  const maxTopLeaders = useMemo(() => Math.max(1, ...topLeaders.map((i) => i.count)), [topLeaders])

  const strategyOwnerCoverage = useMemo(() => {
    let linked = 0
    const total = strategyRows.length
    strategyRows.forEach((r) => {
      const owner = norm(r.responsiblePersonOwner)
      if (!owner) return
      if (boardLeaders.has(String(r.responsiblePersonOwner ?? '').trim()) || staffHeadsSet.has(String(r.responsiblePersonOwner ?? '').trim())) {
        linked += 1
      }
    })
    return { linked, total, pct: total > 0 ? Math.round((linked / total) * 100) : 0 }
  }, [boardLeaders, staffHeadsSet, strategyRows])

  const processLeaderCoverage = useMemo(() => {
    let linked = 0
    const total = processRows.length
    processRows.forEach((r) => {
      const leader = String(r.leader ?? '').trim()
      if (!leader) return
      if (boardLeaders.has(leader) || staffHeadsSet.has(leader)) linked += 1
    })
    return { linked, total, pct: total > 0 ? Math.round((linked / total) * 100) : 0 }
  }, [boardLeaders, processRows, staffHeadsSet])

  const hasAnyData =
    boardRows.length > 0 || leaderRows.length > 0 || strategyRows.length > 0 || staffRows.length > 0 || processRows.length > 0

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
              Дашборды строятся по связанным таблицам: цели правления, цели руководителей, стратегия, штат и реестр процессов.
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
              <label className={styles.eulerSelectLabel}>
                Бизнес/блок
                <select
                  className={styles.eulerSelect}
                  value={businessUnitFilter}
                  onChange={(e) => setBusinessUnitFilter(e.target.value)}
                  aria-label="Выберите бизнес-блок"
                >
                  <option value="">Все блоки</option>
                  {businessUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
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
            <div className={styles.cardsGrid}>
              <div className={styles.card}>
                <div className={styles.cardValue}>{boardRows.length}</div>
                <div className={styles.cardLabel}>строк в целях правления</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardValue}>{leaderRows.length}</div>
                <div className={styles.cardLabel}>строк в целях руководителей</div>
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

          <h2 className={styles.sectionTitle}>Связи ФИО между таблицами</h2>
          <div className={styles.cardsGrid}>
            <div className={styles.card}>
              <div className={styles.cardValue}>{boardCoverage.totalLeaders}</div>
              <div className={styles.cardLabel}>уникальных ФИО в целях правления</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardValue}>{boardCoverage.withLeaderGoals}</div>
              <div className={styles.cardLabel}>есть в целях руководителей</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardValue}>{boardCoverage.withStaff}</div>
              <div className={styles.cardLabel}>есть в штатном расписании</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardValue}>{boardCoverage.withoutLeaderGoals}</div>
              <div className={styles.cardLabel}>без связи с leader_goals</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardValue}>{boardCoverage.withoutStaff}</div>
              <div className={styles.cardLabel}>без связи со staff</div>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Кросс-табличные дашборды</h2>
          <div className={styles.dashboardsGrid}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Топ ФИО по количеству целей руководителей</h3>
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

            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Покрытие стратегии ответственными</h3>
              <div className={styles.cardsGrid}>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{strategyOwnerCoverage.linked}</div>
                  <div className={styles.cardLabel}>инициатив связаны с ФИО из board/staff</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{strategyOwnerCoverage.total}</div>
                  <div className={styles.cardLabel}>инициатив всего</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{strategyOwnerCoverage.pct}%</div>
                  <div className={styles.cardLabel}>доля связности</div>
                </div>
              </div>
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Покрытие реестра процессов ФИО</h3>
              <div className={styles.cardsGrid}>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{processLeaderCoverage.linked}</div>
                  <div className={styles.cardLabel}>процессов с ФИО из board/staff</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{processLeaderCoverage.total}</div>
                  <div className={styles.cardLabel}>процессов всего</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardValue}>{processLeaderCoverage.pct}%</div>
                  <div className={styles.cardLabel}>доля связности</div>
                </div>
              </div>
            </div>

            <div className={`${styles.chartCard} ${styles.chartCardWide}`}>
              <h3 className={styles.chartCardTitle}>Матрица по бизнес-блокам</h3>
              {unitMatrix.length === 0 ? (
                <p className={styles.barValue}>Нет данных</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.summaryTable}>
                    <thead>
                      <tr>
                        <th>Бизнес/блок</th>
                        <th>board_goals</th>
                        <th>strategy_goals</th>
                        <th>staff</th>
                        <th>process_registry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitMatrix.map((r) => (
                        <tr key={r.unit}>
                          <td>{r.unit}</td>
                          <td>{r.board}</td>
                          <td>{r.strategy}</td>
                          <td>{r.staff}</td>
                          <td>{r.process}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </>
      )}
      </div>
    </div>
  )
}
