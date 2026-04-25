import { useEffect, useMemo, useState } from 'react'
import { getBoardGoalRows, getStrategyGoalRows } from '@/api/goals'
import type { GoalRow, StrategyGoalRow } from '@/lib/storage'
import styles from './DashboardsPage.module.css'

const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()
const normalizePerson = (s: string | null | undefined) =>
  norm(s).replace(/\s+/g, ' ').replace(/ё/g, 'е').replace(/[.]/g, '').trim()

type ParsedMonthYear = {
  month: number
  year: number
}

const MONTH_ALIASES: Record<string, number> = {
  january: 1,
  jan: 1,
  январь: 1,
  января: 1,
  february: 2,
  feb: 2,
  февраль: 2,
  февраля: 2,
  march: 3,
  mar: 3,
  март: 3,
  марта: 3,
  april: 4,
  apr: 4,
  апрель: 4,
  апреля: 4,
  may: 5,
  май: 5,
  мая: 5,
  june: 6,
  jun: 6,
  июнь: 6,
  июня: 6,
  july: 7,
  jul: 7,
  июль: 7,
  июля: 7,
  august: 8,
  aug: 8,
  август: 8,
  августа: 8,
  september: 9,
  sep: 9,
  sept: 9,
  сентябрь: 9,
  сентября: 9,
  october: 10,
  oct: 10,
  октябрь: 10,
  октября: 10,
  november: 11,
  nov: 11,
  ноябрь: 11,
  ноября: 11,
  december: 12,
  dec: 12,
  декабрь: 12,
  декабря: 12,
  декарь: 12,
}

function parseMonthYear(value: string | null | undefined): ParsedMonthYear | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/)
  if (!yearMatch) return null
  const year = Number(yearMatch[0])
  const monthToken = cleaned.replace(yearMatch[0], '').trim()
  const month = MONTH_ALIASES[monthToken]
  if (!month) return null
  return { month, year }
}

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

  const strategyByYears = useMemo(() => {
    const yearCounts = new Map<number, number>()
    strategyRows.forEach((row) => {
      const start = parseMonthYear(row.startDate)
      const end = parseMonthYear(row.endDate)
      if (!start || !end) return
      const startKey = start.year * 100 + start.month
      const endKey = end.year * 100 + end.month
      const from = startKey <= endKey ? start : end
      const to = startKey <= endKey ? end : start
      const fromYear = from.year
      const toYear = to.year
      for (let year = fromYear; year <= toYear; year += 1) {
        yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
      }
    })
    return Array.from(yearCounts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year)
  }, [strategyRows])
  const maxStrategyByYears = useMemo(
    () => Math.max(1, ...strategyByYears.map((item) => item.count)),
    [strategyByYears]
  )
  const strategyByResponsible = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    strategyRows.forEach((row) => {
      const raw = String(row.responsiblePersonOwner ?? '').trim()
      const name = raw || 'Не указан'
      const key = normalizePerson(name)
      const prev = map.get(key)
      if (prev) {
        map.set(key, { ...prev, count: prev.count + 1 })
      } else {
        map.set(key, { name, count: 1 })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [strategyRows])
  const maxStrategyByResponsible = useMemo(
    () => Math.max(1, ...strategyByResponsible.map((item) => item.count)),
    [strategyByResponsible]
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
              <div className={`${styles.chartCard} ${styles.strategyYearsHalf}`}>
                <h3 className={styles.chartCardTitle}>Стратегия по годам (по периодам Начало-Конец)</h3>
                {strategyByYears.length === 0 ? (
                  <p className={styles.barValue}>Нет валидных дат в колонках Начало/Конец</p>
                ) : (
                  <div className={styles.strategyYearsChart}>
                    {strategyByYears.map((item) => (
                      <div key={item.year} className={styles.strategyYearsGroup}>
                        <div className={styles.strategyYearsBarWrap}>
                          <div
                            className={styles.strategyYearsBar}
                            style={{ height: `${(item.count / maxStrategyByYears) * 100}%` }}
                          />
                        </div>
                        <span className={styles.strategyYearsLabel}>{item.year}</span>
                        <span className={styles.strategyYearsValue}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.chartCard}>
                <h3 className={styles.chartCardTitle}>Стратегия по ответственному исполнителю</h3>
                {strategyByResponsible.length === 0 ? (
                  <p className={styles.barValue}>Нет данных по ответственным исполнителям</p>
                ) : (
                  <div className={styles.employeeBars}>
                    {strategyByResponsible.map((item) => (
                      <div key={item.name} className={styles.employeeRow}>
                        <span className={styles.employeeName} title={item.name}>
                          {item.name}
                        </span>
                        <div className={styles.employeeBarWrap}>
                          <div
                            className={styles.employeeBar}
                            style={{ width: `${(item.count / maxStrategyByResponsible) * 100}%` }}
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
