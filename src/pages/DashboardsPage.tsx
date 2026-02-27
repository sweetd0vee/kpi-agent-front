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

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Дашборды КПЭ</h1>
      <p className={styles.description}>
        Визуализация данных из таблицы КПЭ: сводка, распределение весов (полосы и круговая диаграмма).
      </p>

      <div className={styles.ideasList}>
        <strong>Идеи дашбордов для целей КПЭ банка</strong>
        <ul>
          <li>Сводные карточки: количество целей, сотрудников, заполненность года и весов</li>
          <li>Распределение весов по метрическим целям (горизонтальные полосы)</li>
          <li>Динамика по кварталам: столбчатая диаграмма по выбранным показателям (прибыль, CIR, ROE и т.д.)</li>
          <li>Сводная таблица: метрика, вес года, годовой результат</li>
          <li>Фильтр по ФИО / по цели (SCAI) с последующей визуализацией</li>
          <li>Дерево целей: каскад руководитель → подразделения с весами</li>
          <li>Сравнение плана и факта при появлении фактических данных</li>
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
