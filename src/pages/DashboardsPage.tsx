import { useEffect, useMemo, useState } from 'react'
import { getBoardGoalRows, getStrategyGoalRows } from '@/api/goals'
import type { GoalRow, StrategyGoalRow } from '@/lib/storage'
import styles from './DashboardsPage.module.css'

const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()
const normalizePerson = (s: string | null | undefined) =>
  norm(s).replace(/\s+/g, ' ').replace(/ё/g, 'е').replace(/[.]/g, '').trim()

function buildTopLeaders(rows: GoalRow[]): Array<{ name: string; count: number }> {
  const map = new Map<string, { name: string; count: number }>()
  rows.forEach((r) => {
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
  return Array.from(map.values())
    .map((v) => ({ name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function DashboardsPage() {
  const [boardRowsAll, setBoardRowsAll] = useState<GoalRow[]>([])
  const [strategyRowsAll, setStrategyRowsAll] = useState<StrategyGoalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([getBoardGoalRows(), getStrategyGoalRows()])
      .then(([board, strategy]) => {
        if (!active) return
        setBoardRowsAll(board)
        setStrategyRowsAll(strategy)
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

  const boardRows2025 = useMemo(
    () => boardRowsAll.filter((r) => String(r.reportYear ?? '').trim() === '2025'),
    [boardRowsAll]
  )
  const boardRows2026 = useMemo(
    () => boardRowsAll.filter((r) => String(r.reportYear ?? '').trim() === '2026'),
    [boardRowsAll]
  )
  const strategyRows = useMemo(() => strategyRowsAll, [strategyRowsAll])

  const topLeaders2025 = useMemo(() => buildTopLeaders(boardRows2025), [boardRows2025])
  const topLeaders2026 = useMemo(() => buildTopLeaders(boardRows2026), [boardRows2026])
  const maxTopLeaders2025 = useMemo(() => Math.max(1, ...topLeaders2025.map((i) => i.count)), [topLeaders2025])
  const maxTopLeaders2026 = useMemo(() => Math.max(1, ...topLeaders2026.map((i) => i.count)), [topLeaders2026])

  const initiativesBySegment = useMemo(() => {
    const map = new Map<string, Set<string>>()
    strategyRows.forEach((row) => {
      const segment = String(row.segment ?? '').trim() || 'Без сегмента'
      const initiative = String(row.initiative ?? '').trim()
      if (!initiative) return
      if (!map.has(segment)) map.set(segment, new Set<string>())
      map.get(segment)?.add(initiative)
    })
    return Array.from(map.entries())
      .map(([segment, initiatives]) => ({ segment, count: initiatives.size }))
      .sort((a, b) => b.count - a.count)
  }, [strategyRows])
  const maxInitiativesBySegment = useMemo(
    () => Math.max(1, ...initiativesBySegment.map((i) => i.count)),
    [initiativesBySegment]
  )

  const hasAnyData = boardRows2025.length > 0 || boardRows2026.length > 0 || strategyRows.length > 0

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
            Нет данных для дашбордов за 2025/2026. Заполните цели правления.
          </div>
        ) : (
          <>
            <h2 className={styles.sectionTitle}>Цели правления</h2>
            <div className={`${styles.dashboardsGrid} ${styles.boardDashboardsGrid}`}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartCardTitle}>Цели правления — 2025</h3>
                {topLeaders2025.length === 0 ? (
                  <p className={styles.barValue}>Нет данных за 2025</p>
                ) : (
                  <div className={styles.employeeBars}>
                    {topLeaders2025.map((e, i) => (
                      <div key={i} className={styles.employeeRow}>
                        <span className={styles.employeeName} title={e.name}>
                          {e.name}
                        </span>
                        <div className={styles.employeeBarWrap}>
                          <div
                            className={styles.employeeBar}
                            style={{ width: `${(e.count / maxTopLeaders2025) * 100}%` }}
                          />
                        </div>
                        <span className={styles.employeeCount}>{e.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.chartCard}>
                <h3 className={styles.chartCardTitle}>Цели правления — 2026</h3>
                {topLeaders2026.length === 0 ? (
                  <p className={styles.barValue}>Нет данных за 2026</p>
                ) : (
                  <div className={styles.employeeBars}>
                    {topLeaders2026.map((e, i) => (
                      <div key={i} className={styles.employeeRow}>
                        <span className={styles.employeeName} title={e.name}>
                          {e.name}
                        </span>
                        <div className={styles.employeeBarWrap}>
                          <div
                            className={styles.employeeBar}
                            style={{ width: `${(e.count / maxTopLeaders2026) * 100}%` }}
                          />
                        </div>
                        <span className={styles.employeeCount}>{e.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <h2 className={styles.sectionTitle}>Стратегия</h2>
            <div className={styles.dashboardsGrid}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartCardTitle}>Количество инициатив по сегментам</h3>
                {initiativesBySegment.length === 0 ? (
                  <p className={styles.barValue}>Нет данных по инициативам</p>
                ) : (
                  <div className={styles.employeeBars}>
                    {initiativesBySegment.map((item, i) => (
                      <div key={i} className={styles.employeeRow}>
                        <span className={styles.employeeName} title={item.segment}>
                          {item.segment}
                        </span>
                        <div className={styles.employeeBarWrap}>
                          <div
                            className={styles.employeeBar}
                            style={{ width: `${(item.count / maxInitiativesBySegment) * 100}%` }}
                          />
                        </div>
                        <span className={styles.employeeCount}>{item.count}</span>
                      </div>
                    ))}
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
