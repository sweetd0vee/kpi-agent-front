import { useCallback, useEffect, useMemo, useState } from 'react'
import { getKpiRows, getPprRows } from '@/api/goals'
import type { GoalRow } from '@/lib/storage'
import styles from './DashboardsPage.module.css'

type DashboardSubTab = 'kpi' | 'ppr'

/** Парсит число из строки (24,1 / 54,4% / 20%) */
function parseNum(s: string): number | null {
  if (!s || typeof s !== 'string') return null
  const cleaned = s.replace(/\s/g, '').replace(',', '.').replace('%', '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Извлекает числовой вес года (только %), "М" и пусто = null */
function parseWeightYear(s: string): number | null {
  const n = parseNum(s)
  return n != null && n >= 0 && n <= 100 ? n : null
}

export function DashboardsPage() {
  const [activeTab, setActiveTab] = useState<DashboardSubTab>('kpi')
  const [kpiRows, setKpiRows] = useState<GoalRow[]>([])
  const [pprRows, setPprRows] = useState<GoalRow[]>([])
  const [kpiLoading, setKpiLoading] = useState(true)
  const [pprLoading, setPprLoading] = useState(true)
  const [kpiError, setKpiError] = useState<string | null>(null)
  const [pprError, setPprError] = useState<string | null>(null)
  const rows = useMemo(() => (activeTab === 'kpi' ? kpiRows : pprRows), [activeTab, kpiRows, pprRows])
  const activeLoading = activeTab === 'kpi' ? kpiLoading : pprLoading
  const activeError = activeTab === 'kpi' ? kpiError : pprError
  const tabLabel = activeTab === 'kpi' ? 'КПЭ' : 'ППР'

  useEffect(() => {
    let active = true
    setKpiLoading(true)
    getKpiRows()
      .then((rows) => {
        if (!active) return
        setKpiRows(rows)
        setKpiError(null)
      })
      .catch((err) => {
        if (!active) return
        setKpiError(err instanceof Error ? err.message : 'Не удалось загрузить KPI данные.')
      })
      .finally(() => {
        if (!active) return
        setKpiLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setPprLoading(true)
    getPprRows()
      .then((rows) => {
        if (!active) return
        setPprRows(rows)
        setPprError(null)
      })
      .catch((err) => {
        if (!active) return
        setPprError(err instanceof Error ? err.message : 'Не удалось загрузить PPR данные.')
      })
      .finally(() => {
        if (!active) return
        setPprLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const uniqueNames = new Set(rows.map((r) => r.lastName?.trim()).filter(Boolean))
    const withYear = rows.filter((r) => r.year?.trim() !== '').length
    const withWeight = rows.filter((r) => parseWeightYear(r.weightYear ?? '') != null).length
    return {
      total: rows.length,
      employees: uniqueNames.size,
      withYear,
      withWeight,
    }
  }, [rows])

  const weightData = useMemo(() => {
    return rows
      .map((r) => ({
        label: r.metricGoals?.trim() || r.goal?.trim() || '—',
        pct: parseWeightYear(r.weightYear ?? ''),
      }))
      .filter((d) => d.pct != null && d.pct > 0) as { label: string; pct: number }[]
  }, [rows])

  const goalsByEmployee = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r) => {
      const name = r.lastName?.trim() || '—'
      map.set(name, (map.get(name) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [rows])

  const maxEmployeeCount = useMemo(() => Math.max(1, ...goalsByEmployee.map((e) => e.count)), [goalsByEmployee])

  /** Топ самых часто встречающихся целей (метрическая цель или SCAI-цель) */
  const topGoalsByFrequency = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r) => {
      const goalKey = (r.metricGoals || r.goal || '—').trim()
      if (!goalKey) return
      map.set(goalKey, (map.get(goalKey) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [rows])
  const maxGoalCount = useMemo(
    () => Math.max(1, ...topGoalsByFrequency.map((d) => d.count)),
    [topGoalsByFrequency]
  )

  /** Топ метрик по весу года (для отдельного дашборда) */
  const topMetricsByWeight = useMemo(
    () => [...weightData].sort((a, b) => b.pct - a.pct).slice(0, 10),
    [weightData]
  )
  const maxTopWeight = useMemo(
    () => Math.max(0, ...topMetricsByWeight.map((d) => d.pct)),
    [topMetricsByWeight]
  )

  const key = useCallback((r: (typeof rows)[0]) => (r.metricGoals || r.goal || '—').trim(), [])

  /** Уникальные цели для выпадающего списка (метрическая цель или SCAI-цель) */
  const uniqueGoalsList = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => {
      const g = key(r)
      if (g && g !== '—') set.add(g)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [rows, key])

  const [selectedGoal, setSelectedGoal] = useState('')

  /** Строки данных по выбранной цели: все руководители с этой целью, веса и показатели */
  const goalRowsForSelected = useMemo(() => {
    if (!selectedGoal) return []
    return rows
      .filter((r) => key(r) === selectedGoal)
      .map((r) => ({
        lastName: (r.lastName ?? '').trim() || '—',
        weightYear: (r.weightYear ?? '').trim() || '—',
        weightQ: (r.weightQ ?? '').trim() || '—',
        q1: (r.q1 ?? '').trim() || '—',
        q2: (r.q2 ?? '').trim() || '—',
        q3: (r.q3 ?? '').trim() || '—',
        q4: (r.q4 ?? '').trim() || '—',
        year: (r.year ?? '').trim() || '—',
      }))
  }, [rows, selectedGoal, key])

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Дашборды</h1>

      <div className={styles.tabs} role="tablist" aria-label="Выбор раздела дашбордов">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'kpi'}
          aria-controls="dashboard-kpi-panel"
          id="dashboard-tab-kpi"
          className={activeTab === 'kpi' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setActiveTab('kpi')}
        >
          КПЭ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ppr'}
          aria-controls="dashboard-ppr-panel"
          id="dashboard-tab-ppr"
          className={activeTab === 'ppr' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setActiveTab('ppr')}
        >
          ППР
        </button>
      </div>

      <div
        id={activeTab === 'kpi' ? 'dashboard-kpi-panel' : 'dashboard-ppr-panel'}
        role="tabpanel"
        aria-labelledby={activeTab === 'kpi' ? 'dashboard-tab-kpi' : 'dashboard-tab-ppr'}
        className={styles.tabPanel}
      >
        {activeError ? (
          <div className={styles.emptyState} role="alert">
            {activeError}
          </div>
        ) : activeLoading ? (
          <div className={styles.emptyState} role="status">
            Загрузка данных...
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.emptyState}>
            Нет данных для дашбордов. Заполните таблицу «{tabLabel}» на соответствующей вкладке или загрузите данные.
          </div>
        ) : (
        <>
          <section className={styles.eulerSection} aria-labelledby="goal-managers-title">
            <h2 id="goal-managers-title" className={styles.eulerSectionTitle}>Цель: руководители и данные</h2>
            <p className={styles.eulerSectionDesc}>
              Выберите цель из списка — отобразятся все руководители, у которых есть эта цель, с весами и показателями.
            </p>
            {uniqueGoalsList.length === 0 ? (
              <div className={styles.eulerEmpty}>Нет целей в таблице</div>
            ) : (
              <>
                <div className={styles.eulerSelects}>
                  <label className={styles.eulerSelectLabel}>
                    Цель
                    <select
                      className={styles.eulerSelect}
                      value={selectedGoal}
                      onChange={(e) => setSelectedGoal(e.target.value)}
                      aria-label="Выберите цель"
                    >
                      <option value="">— выберите цель —</option>
                      {uniqueGoalsList.map((goal) => (
                        <option key={goal} value={goal}>{goal.length > 80 ? goal.slice(0, 80) + '…' : goal}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {!selectedGoal ? (
                  <div className={styles.eulerEmpty}>Выберите цель из списка</div>
                ) : goalRowsForSelected.length === 0 ? (
                  <div className={styles.eulerEmpty}>Нет данных по выбранной цели</div>
                ) : (
                  <div className={styles.goalManagersWrap}>
                    <p className={styles.goalManagersSummary}>
                      Цель «{selectedGoal.length > 60 ? selectedGoal.slice(0, 60) + '…' : selectedGoal}»: {goalRowsForSelected.length} записей
                    </p>
                    <div className={styles.tableWrap}>
                      <table className={styles.summaryTable}>
                        <thead>
                          <tr>
                            <th>Руководитель</th>
                            <th>Вес год</th>
                            <th>Вес кв.</th>
                            <th>Q1</th>
                            <th>Q2</th>
                            <th>Q3</th>
                            <th>Q4</th>
                            <th>Год</th>
                          </tr>
                        </thead>
                        <tbody>
                          {goalRowsForSelected.map((row, idx) => (
                            <tr key={idx}>
                              <td className={styles.goalManagerName}>{row.lastName}</td>
                              <td>{row.weightYear}</td>
                              <td>{row.weightQ}</td>
                              <td>{row.q1}</td>
                              <td>{row.q2}</td>
                              <td>{row.q3}</td>
                              <td>{row.q4}</td>
                              <td>{row.year}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <h2 className={styles.sectionTitle}>Сводка</h2>
          <div className={styles.cardsGrid}>
            <div className={styles.card}>
              <div className={styles.cardValue}>{stats.total}</div>
              <div className={styles.cardLabel}>целей (строк)</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardValue}>{stats.employees}</div>
              <div className={styles.cardLabel}>сотрудников (ФИО)</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardValue}>{stats.withYear}</div>
              <div className={styles.cardLabel}>с заполненным годом</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardValue}>{stats.withWeight}</div>
              <div className={styles.cardLabel}>с весом года (%)</div>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Другие дашборды</h2>
          <div className={styles.dashboardsGrid}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Цели по сотрудникам (ФИО)</h3>
              {goalsByEmployee.length === 0 ? (
                <p className={styles.barValue}>Нет данных</p>
              ) : (
                <div className={styles.employeeBars}>
                  {goalsByEmployee.map((e, i) => (
                    <div key={i} className={styles.employeeRow}>
                      <span className={styles.employeeName} title={e.name}>
                        {e.name}
                      </span>
                      <div className={styles.employeeBarWrap}>
                        <div
                          className={styles.employeeBar}
                          style={{ width: `${(e.count / maxEmployeeCount) * 100}%` }}
                        />
                      </div>
                      <span className={styles.employeeCount}>{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Топ целей по весу года</h3>
              {topMetricsByWeight.length === 0 ? (
                <p className={styles.barValue}>Нет числовых весов</p>
              ) : (
                <div className={styles.weightBars}>
                  {topMetricsByWeight.map((d, i) => (
                    <div key={i} className={styles.weightRow}>
                      <span className={styles.weightLabel} title={d.label}>
                        {d.label}
                      </span>
                      <div className={styles.weightBarWrap}>
                        <div
                          className={styles.weightBar}
                          style={{ width: `${maxTopWeight > 0 ? (d.pct / maxTopWeight) * 100 : 0}%` }}
                        />
                      </div>
                      <span className={styles.weightPct}>{d.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Топ самых часто встречающихся целей</h3>
              {topGoalsByFrequency.length === 0 ? (
                <p className={styles.barValue}>Нет данных</p>
              ) : (
                <div className={styles.weightBars}>
                  {topGoalsByFrequency.map((d, i) => (
                    <div key={i} className={styles.weightRow}>
                      <span className={styles.weightLabel} title={d.label}>
                        {d.label.length > 45 ? d.label.slice(0, 45) + '…' : d.label}
                      </span>
                      <div className={styles.weightBarWrap}>
                        <div
                          className={styles.weightBar}
                          style={{ width: `${(d.count / maxGoalCount) * 100}%` }}
                        />
                      </div>
                      <span className={styles.weightPct}>{d.count}</span>
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
