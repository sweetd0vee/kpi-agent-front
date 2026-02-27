import { useMemo, useState } from 'react'
import { getKpiState } from '@/lib/storage'
import styles from './DashboardsPage.module.css'

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
  const kpiState = getKpiState()
  const rows = kpiState.rows

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

  const maxWeight = useMemo(() => Math.max(0, ...weightData.map((d) => d.pct)), [weightData])

  const donutSegments = useMemo(() => {
    const total = weightData.reduce((s, d) => s + d.pct, 0)
    if (total <= 0) return []
    const palette = ['#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
    let acc = 0
    return weightData.map((d, i) => {
      const deg = (d.pct / total) * 360
      const from = acc
      acc += deg
      return {
        label: d.label,
        pct: d.pct,
        color: palette[i % palette.length],
        fromDeg: from,
        toDeg: acc,
      }
    })
  }, [weightData])

  const donutTotal = useMemo(() => weightData.reduce((s, d) => s + d.pct, 0), [weightData])

  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)

  const CIRCUMFERENCE = 2 * Math.PI * 90

  const donutSvgSegments = useMemo(() => {
    if (donutTotal <= 0 || donutSegments.length === 0) return []
    let offset = 0
    return donutSegments.map((s) => {
      const length = (s.pct / donutTotal) * CIRCUMFERENCE
      const seg = { ...s, dashLength: length, dashOffset: -offset, circumference: CIRCUMFERENCE }
      offset += length
      return seg
    })
  }, [donutSegments, donutTotal])

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

  const completeness = useMemo(() => {
    const fields: { key: string; label: string; count: number }[] = [
      { key: 'lastName', label: 'ФИО', count: 0 },
      { key: 'goal', label: 'SCAI Цель', count: 0 },
      { key: 'metricGoals', label: 'Метрические цели', count: 0 },
      { key: 'weightQ', label: 'вес квартал', count: 0 },
      { key: 'weightYear', label: 'вес год', count: 0 },
      { key: 'q1', label: '1 квартал', count: 0 },
      { key: 'q2', label: '2 квартал', count: 0 },
      { key: 'q3', label: '3 квартал', count: 0 },
      { key: 'q4', label: '4 квартал', count: 0 },
      { key: 'year', label: 'Год', count: 0 },
    ]
    const n = rows.length || 1
    fields.forEach((f) => {
      const key = f.key as keyof typeof rows[0]
      f.count = rows.filter((r) => String(r[key] ?? '').trim() !== '').length
    })
    return fields.map((f) => ({ ...f, pct: Math.round((f.count / n) * 100) }))
  }, [rows])

  const heatmapRows = useMemo(() => rows.slice(0, 12), [rows])

  const quarterlyMetric = useMemo(() => {
    const withNums = rows.find((r) =>
      [r.q1, r.q2, r.q3, r.q4].some((q) => parseNum(q ?? '') != null)
    )
    if (!withNums) return null
    const vals = [withNums.q1, withNums.q2, withNums.q3, withNums.q4].map((q) => parseNum(q ?? ''))
    const max = Math.max(1, ...vals.filter((v): v is number => v != null))
    return {
      label: (withNums.metricGoals || withNums.goal || '').slice(0, 35),
      values: vals as (number | null)[],
      raw: [withNums.q1, withNums.q2, withNums.q3, withNums.q4],
      max,
    }
  }, [rows])

  const byGoal = useMemo(() => {
    const map = new Map<string, { count: number; totalWeight: number }>()
    rows.forEach((r) => {
      const g = r.goal?.trim() || '—'
      const cur = map.get(g) ?? { count: 0, totalWeight: 0 }
      cur.count += 1
      const w = parseWeightYear(r.weightYear ?? '')
      if (w != null) cur.totalWeight += w
      map.set(g, cur)
    })
    return Array.from(map.entries())
      .map(([goal, data]) => ({ goal, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [rows])

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Дашборды КПЭ</h1>
      <p className={styles.description}>
        Визуализация данных из таблицы КПЭ: сводка, распределение весов (полосы и круговая диаграмма).
      </p>

      <div className={styles.ideasList}>
        <strong>Дашборды КПЭ: что уже есть и идеи</strong>
        <ul>
          <li>Сводка: карточки (цели, сотрудники, заполненность года и весов)</li>
          <li>Распределение весов: горизонтальные полосы и круговая диаграмма</li>
          <li>Тепловая карта: наличие данных по кварталам по каждой метрике</li>
          <li>Цели по сотрудникам: число целей на каждого ФИО (топ-10)</li>
          <li>Заполненность данных: % заполнения по каждому полю (качество ввода)</li>
          <li>Квартальная динамика: столбчатая диаграмма для примера одной метрики</li>
          <li>Группировка по SCAI-цели: число метрик и сумма весов по каждой цели</li>
          <li>Идеи: фильтр по ФИО/цели, дерево целей, план vs факт при появлении факта</li>
        </ul>
      </div>

      {rows.length === 0 ? (
        <div className={styles.emptyState}>
          Нет данных для дашбордов. Заполните таблицу КПЭ на вкладке «КПЭ» или загрузите демо-данные.
        </div>
      ) : (
        <>
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

          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Распределение весов по целям (%)</h3>
              <div className={styles.weightBars}>
                {weightData.length === 0 ? (
                  <p className={styles.barValue}>Нет числовых весов для отображения</p>
                ) : (
                  weightData.map((d, i) => (
                    <div key={i} className={styles.weightRow}>
                      <span className={styles.weightLabel} title={d.label}>
                        {d.label}
                      </span>
                      <div className={styles.weightBarWrap}>
                        <div
                          className={styles.weightBar}
                          style={{ width: `${maxWeight > 0 ? (d.pct / maxWeight) * 100 : 0}%` }}
                        />
                      </div>
                      <span className={styles.weightPct}>{d.pct}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Распределение весов (круговая диаграмма)</h3>
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
                            aria-label={`${seg.label}: ${seg.pct}%`}
                          />
                        ))}
                      </g>
                    </svg>
                    {hoveredSegment != null && donutSegments[hoveredSegment] && (
                      <div className={styles.donutTooltip}>
                        <strong>{donutSegments[hoveredSegment].label}</strong>
                        <span>{donutSegments[hoveredSegment].pct}%</span>
                      </div>
                    )}
                    <div className={styles.donutHole}>
                      <span className={styles.donutTotal}>
                        {hoveredSegment != null && donutSegments[hoveredSegment]
                          ? donutSegments[hoveredSegment].pct + '%'
                          : Math.round(donutTotal) + '%'}
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
                        <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Аналитика</h2>
          <div className={styles.dashboardsGrid}>
            <div className={`${styles.chartCard} ${styles.chartCardWide}`}>
              <h3 className={styles.chartCardTitle}>Тепловая карта: наличие данных по кварталам</h3>
              <div className={styles.heatmapWrap}>
                <table className={styles.heatmap}>
                  <thead>
                    <tr>
                      <th>Метрика</th>
                      <th className={styles.heatmapCell}>Q1</th>
                      <th className={styles.heatmapCell}>Q2</th>
                      <th className={styles.heatmapCell}>Q3</th>
                      <th className={styles.heatmapCell}>Q4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapRows.map((r, i) => (
                      <tr key={r.id ?? i}>
                        <td className={styles.metricLabel} title={r.metricGoals || r.goal || ''}>
                          {(r.metricGoals || r.goal || '—').slice(0, 30)}
                          {(r.metricGoals?.length || r.goal?.length || 0) > 30 ? '…' : ''}
                        </td>
                        {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => {
                          const v = (r[q] ?? '').trim()
                          return (
                            <td
                              key={q}
                              className={v ? styles.heatmapCellFilled : styles.heatmapCellEmpty}
                              title={v || 'нет данных'}
                            >
                              {v ? (v.length > 8 ? v.slice(0, 8) + '…' : v) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
              <h3 className={styles.chartCardTitle}>Заполненность данных (%)</h3>
              <div className={styles.completenessList}>
                {completeness.map((f, i) => (
                  <div key={i} className={styles.completenessRow}>
                    <span className={styles.completenessLabel}>{f.label}</span>
                    <div className={styles.completenessBarWrap}>
                      <div
                        className={`${styles.completenessBar} ${f.pct >= 80 ? styles.completenessBarHigh : f.pct >= 40 ? styles.completenessBarMid : styles.completenessBarLow}`}
                        style={{ width: `${f.pct}%` }}
                      />
                    </div>
                    <span className={styles.completenessPct}>{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Динамика по кварталам (пример)</h3>
              {quarterlyMetric ? (
                <>
                  <div className={styles.quarterChart}>
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q, qi) => {
                      const val = quarterlyMetric.values[qi]
                      const pct = val != null ? (val / quarterlyMetric.max) * 100 : 0
                      return (
                        <div key={q} className={styles.quarterBarCol}>
                          <div
                            className={styles.quarterBar}
                            style={{ height: `${Math.max(4, pct)}%` }}
                            title={quarterlyMetric.raw[qi] ?? ''}
                          />
                          <span className={styles.quarterBarLabel}>{q}</span>
                          <span className={styles.quarterBarVal}>{quarterlyMetric.raw[qi] || '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className={styles.barValue} style={{ marginTop: '0.5rem' }}>
                    {quarterlyMetric.label}
                  </p>
                </>
              ) : (
                <p className={styles.barValue}>Нет числовых данных по кварталам</p>
              )}
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartCardTitle}>Группировка по SCAI-цели</h3>
              {byGoal.length === 0 ? (
                <p className={styles.barValue}>Нет данных</p>
              ) : (
                byGoal.map((g, i) => (
                  <div key={i} className={styles.goalGroupCard}>
                    <div className={styles.goalGroupTitle}>
                      {g.goal.length > 40 ? g.goal.slice(0, 40) + '…' : g.goal}
                    </div>
                    <div className={styles.goalGroupMeta}>
                      метрик: {g.count}
                      {g.totalWeight > 0 ? ` · сумма весов: ${g.totalWeight}%` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Сводная таблица (метрика, вес года, год)</h2>
          <div className={styles.tableWrap}>
            <table className={styles.summaryTable}>
              <thead>
                <tr>
                  <th>Метрическая цель</th>
                  <th>Вес года</th>
                  <th>Год</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id ?? i}>
                    <td>{r.metricGoals?.trim() || r.goal?.trim() || ''}</td>
                    <td>{r.weightYear?.trim() || ''}</td>
                    <td>{r.year?.trim() || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
