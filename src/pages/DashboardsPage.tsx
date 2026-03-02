import { useCallback, useMemo, useState } from 'react'
import { getGoalsState, getKpiState } from '@/lib/storage'
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
  const rows = useMemo(
    () => (activeTab === 'kpi' ? getKpiState().rows : getGoalsState().rows),
    [activeTab]
  )
  const tabLabel = activeTab === 'kpi' ? 'КПЭ' : 'ППР'

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

  /** Сумма всех весов по строкам (может быть > 100%, если несколько сотрудников). Для круговой диаграммы нормализуем к 100%. */
  const donutRawTotal = useMemo(() => weightData.reduce((s, d) => s + d.pct, 0), [weightData])

  const donutSegments = useMemo(() => {
    if (donutRawTotal <= 0) return []
    const palette = ['#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
    let acc = 0
    return weightData.map((d, i) => {
      const share = d.pct / donutRawTotal
      const deg = share * 360
      const from = acc
      acc += deg
      return {
        label: d.label,
        pct: d.pct,
        /** Доля в общем пуле весов, нормализованная к 100% для отображения */
        pctNorm: Math.round(share * 1000) / 10,
        color: palette[i % palette.length],
        fromDeg: from,
        toDeg: acc,
      }
    })
  }, [weightData, donutRawTotal])

  /** В центре диаграммы всегда показываем 100% (нормализованная сумма) */
  const donutTotal = 100

  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)

  const CIRCUMFERENCE = 2 * Math.PI * 90

  const donutSvgSegments = useMemo(() => {
    if (donutRawTotal <= 0 || donutSegments.length === 0) return []
    let offset = 0
    return donutSegments.map((s) => {
      const length = (s.pct / donutRawTotal) * CIRCUMFERENCE
      const seg = { ...s, dashLength: length, dashOffset: -offset, circumference: CIRCUMFERENCE }
      offset += length
      return seg
    })
  }, [donutSegments, donutRawTotal])

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

  /** Список руководителей для выпадающих списков кругов Эйлера */
  const eulerManagersList = useMemo(() => goalsByEmployee.map((e) => e.name), [goalsByEmployee])

  const [eulerSelected1, setEulerSelected1] = useState('')
  const [eulerSelected2, setEulerSelected2] = useState('')
  const [eulerHoverZone, setEulerHoverZone] = useState<'left' | 'right' | 'center' | null>(null)

  const key = useCallback((r: (typeof rows)[0]) => (r.metricGoals || r.goal || '—').trim(), [])

  /** Данные для двух выбранных руководителей: множества целей и общие цели */
  const eulerTwoData = useMemo(() => {
    if (!eulerSelected1 || !eulerSelected2 || eulerSelected1 === eulerSelected2) return null
    const set1 = new Set<string>(rows.filter((r) => (r.lastName ?? '').trim() === eulerSelected1).map(key))
    const set2 = new Set<string>(rows.filter((r) => (r.lastName ?? '').trim() === eulerSelected2).map(key))
    const commonGoals: string[] = [...set1].filter((g) => set2.has(g))
    const only1: string[] = [...set1].filter((g) => !set2.has(g))
    const only2: string[] = [...set2].filter((g) => !set1.has(g))
    return {
      name1: eulerSelected1,
      name2: eulerSelected2,
      total1: set1.size,
      total2: set2.size,
      only1,
      only2,
      commonGoals,
      commonCount: commonGoals.length,
    }
  }, [rows, eulerSelected1, eulerSelected2, key])

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Дашборды</h1>
      <p className={styles.description}>
        Ключевые дашборды аналитика и отчёты по данным таблиц КПЭ и ППР.
      </p>

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
        {rows.length === 0 ? (
          <div className={styles.emptyState}>
            Нет данных для дашбордов. Заполните таблицу «{tabLabel}» на соответствующей вкладке или загрузите данные.
          </div>
      ) : (
        <>
          <section className={styles.eulerSection} aria-labelledby="euler-title">
            <h2 id="euler-title" className={styles.eulerSectionTitle}>Круги Эйлера: пересечение целей по руководителям</h2>
            <p className={styles.eulerSectionDesc}>
              Выберите двух руководителей из списка — отобразятся их цели и общие цели в пересечении.
            </p>
            {eulerManagersList.length === 0 ? (
              <div className={styles.eulerEmpty}>Нет данных о руководителях в таблице</div>
            ) : (
              <>
                <div className={styles.eulerSelects}>
                  <label className={styles.eulerSelectLabel}>
                    Руководитель 1
                    <select
                      className={styles.eulerSelect}
                      value={eulerSelected1}
                      onChange={(e) => setEulerSelected1(e.target.value)}
                      aria-label="Выберите первого руководителя"
                    >
                      <option value="">— выберите —</option>
                      {eulerManagersList.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.eulerSelectLabel}>
                    Руководитель 2
                    <select
                      className={styles.eulerSelect}
                      value={eulerSelected2}
                      onChange={(e) => setEulerSelected2(e.target.value)}
                      aria-label="Выберите второго руководителя"
                    >
                      <option value="">— выберите —</option>
                      {eulerManagersList.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {!eulerTwoData ? (
                  <div className={styles.eulerEmpty}>
                    {!eulerSelected1 || !eulerSelected2
                      ? 'Выберите двух разных руководителей'
                      : 'Выберите разных руководителей (сейчас выбран один и тот же)'}
                  </div>
                ) : (
                  <div
                    className={styles.eulerWrapLarge}
                    onMouseLeave={() => setEulerHoverZone(null)}
                  >
                    <div className={styles.eulerDiagramWrap}>
                    <svg
                      className={styles.eulerSvgTwo}
                      viewBox="-20 -20 540 340"
                      aria-label="Круги Эйлера для двух руководителей"
                    >
                      <defs>
                        <filter id="euler-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <g
                        onMouseEnter={() => setEulerHoverZone('left')}
                        onMouseLeave={() => setEulerHoverZone((z) => (z === 'left' ? null : z))}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={130}
                          cy={160}
                          r={130}
                          fill="#2563eb"
                          fillOpacity={eulerHoverZone === 'left' ? 0.4 : 0.25}
                          stroke="#2563eb"
                          strokeWidth={eulerHoverZone === 'left' ? 3 : 2}
                          className={styles.eulerCircleInteractive}
                        />
                        <text x={50} y={155} className={styles.eulerZoneCount} textAnchor="middle">{eulerTwoData.only1.length}</text>
                      </g>
                      <g
                        onMouseEnter={() => setEulerHoverZone('right')}
                        onMouseLeave={() => setEulerHoverZone((z) => (z === 'right' ? null : z))}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={370}
                          cy={160}
                          r={130}
                          fill="#059669"
                          fillOpacity={eulerHoverZone === 'right' ? 0.4 : 0.25}
                          stroke="#059669"
                          strokeWidth={eulerHoverZone === 'right' ? 3 : 2}
                          className={styles.eulerCircleInteractive}
                        />
                        <text x={450} y={155} className={styles.eulerZoneCount} textAnchor="middle">{eulerTwoData.only2.length}</text>
                      </g>
                    </svg>
                    <div className={styles.eulerTwoOverlay}>
                      <div
                        className={styles.eulerCommonBox}
                        onMouseEnter={() => setEulerHoverZone('center')}
                        onMouseLeave={() => setEulerHoverZone(null)}
                      >
                        <div className={styles.eulerCommonTitle}>Общие цели ({eulerTwoData.commonCount})</div>
                        <div className={styles.eulerCommonList}>
                          {eulerTwoData.commonGoals.length === 0 ? (
                            <span className={styles.eulerCommonEmpty}>Нет общих целей</span>
                          ) : (
                            eulerTwoData.commonGoals.map((goal, idx) => (
                              <div key={idx} className={styles.eulerCommonItem} title={goal}>
                                {goal.length > 50 ? goal.slice(0, 50) + '…' : goal}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                    {(eulerHoverZone === 'left' && eulerTwoData.only1.length > 0) && (
                      <div className={styles.eulerTooltip} role="tooltip">
                        <strong>Только {eulerTwoData.name1}</strong>
                        <div className={styles.eulerTooltipList}>
                          {eulerTwoData.only1.slice(0, 8).map((g, i) => (
                            <span key={i}>{g.length > 40 ? g.slice(0, 40) + '…' : g}</span>
                          ))}
                          {eulerTwoData.only1.length > 8 && (
                            <span>… и ещё {eulerTwoData.only1.length - 8}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {(eulerHoverZone === 'right' && eulerTwoData.only2.length > 0) && (
                      <div className={styles.eulerTooltip} role="tooltip">
                        <strong>Только {eulerTwoData.name2}</strong>
                        <div className={styles.eulerTooltipList}>
                          {eulerTwoData.only2.slice(0, 8).map((g, i) => (
                            <span key={i}>{g.length > 40 ? g.slice(0, 40) + '…' : g}</span>
                          ))}
                          {eulerTwoData.only2.length > 8 && (
                            <span>… и ещё {eulerTwoData.only2.length - 8}</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className={styles.eulerLegendLarge}>
                      <span className={styles.eulerLegendItemLarge}>
                        <span className={styles.eulerLegendDot} style={{ background: '#2563eb' }} />
                        {eulerTwoData.name1.length > 30 ? eulerTwoData.name1.slice(0, 30) + '…' : eulerTwoData.name1} — {eulerTwoData.total1} целей
                      </span>
                      <span className={styles.eulerLegendItemLarge}>
                        <span className={styles.eulerLegendDot} style={{ background: '#059669' }} />
                        {eulerTwoData.name2.length > 30 ? eulerTwoData.name2.slice(0, 30) + '…' : eulerTwoData.name2} — {eulerTwoData.total2} целей
                      </span>
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

          <div className={styles.chartCard} style={{ maxWidth: 420, margin: '0 auto 2rem' }}>
              <h3 className={styles.chartCardTitle}>Распределение весов по целям (круговая диаграмма)</h3>
              {weightData.length === 0 ? (
                <p className={styles.barValue}>Нет числовых весов для отображения</p>
              ) : (
                <>
                  <div
                    className={styles.donutWrap}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <svg
                      className={styles.donutSvg}
                      viewBox="0 0 200 200"
                      aria-label="Распределение весов по целям"
                    >
                      <g transform="rotate(-90 100 100)">
                        {donutSvgSegments.map((seg, i) => (
                          <circle
                            key={i}
                            cx={100}
                            cy={100}
                            r={90}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={40}
                            strokeDasharray={`${seg.dashLength} ${seg.circumference}`}
                            strokeDashoffset={seg.dashOffset}
                            className={styles.donutSegment}
                            data-active={hoveredSegment === i || hoveredSegment === null}
                            onMouseEnter={() => setHoveredSegment(i)}
                            onFocus={() => setHoveredSegment(i)}
                            onBlur={() => setHoveredSegment(null)}
                            tabIndex={0}
                            aria-label={`${seg.label}: ${seg.pctNorm}%`}
                          />
                        ))}
                      </g>
                    </svg>
                    {hoveredSegment != null && donutSegments[hoveredSegment] && (
                      <div className={styles.donutTooltip}>
                        <strong>{donutSegments[hoveredSegment].label}</strong>
                        <span>{donutSegments[hoveredSegment].pctNorm}%</span>
                      </div>
                    )}
                    <div className={styles.donutHole}>
                      <span className={styles.donutTotal}>
                        {hoveredSegment != null && donutSegments[hoveredSegment]
                          ? donutSegments[hoveredSegment].pctNorm + '%'
                          : donutTotal + '%'}
                      </span>
                      <span className={styles.donutTotalLabel}>
                        {hoveredSegment != null && donutSegments[hoveredSegment]
                          ? 'выбрано'
                          : 'вес всего'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.donutLegend}>
                    {donutSegments.map((s, i) => (
                      <div
                        key={i}
                        className={`${styles.donutLegendItem} ${hoveredSegment === i ? styles.donutLegendItemActive : ''} ${hoveredSegment != null && hoveredSegment !== i ? styles.donutLegendItemDimmed : ''}`}
                        onMouseEnter={() => setHoveredSegment(i)}
                        onMouseLeave={() => setHoveredSegment(null)}
                        title={s.label}
                        role="button"
                        tabIndex={0}
                        onClick={() => setHoveredSegment(hoveredSegment === i ? null : i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setHoveredSegment(hoveredSegment === i ? null : i)
                          }
                        }}
                      >
                        <span className={styles.donutLegendDot} style={{ background: s.color }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                          {s.label.length > 18 ? s.label.slice(0, 18) + '…' : s.label}
                        </span>
                        <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{s.pctNorm}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
