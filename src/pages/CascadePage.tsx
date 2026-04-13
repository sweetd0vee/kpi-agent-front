import { useEffect, useMemo, useState } from 'react'
import { getCascadeRun, listCascadeRuns, runCascade, type CascadeRunResponse, type CascadeRunSummary } from '@/api/cascade'
import { exportCascadeGoalsCSV, exportCascadeGoalsExcel } from '@/lib/exportGoals'
import styles from './CascadePage.module.css'

export function CascadePage() {
  const [reportYear, setReportYear] = useState('')
  const [managersInput, setManagersInput] = useState('')
  const [maxItemsPerDeputy, setMaxItemsPerDeputy] = useState(25)
  const [persist, setPersist] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<CascadeRunSummary[]>([])
  const [result, setResult] = useState<CascadeRunResponse | null>(null)

  const managers = useMemo(
    () =>
      managersInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [managersInput]
  )

  const refreshRuns = async () => {
    setLoadingRuns(true)
    try {
      const history = await listCascadeRuns(20)
      setRuns(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить историю запусков')
    } finally {
      setLoadingRuns(false)
    }
  }

  useEffect(() => {
    void refreshRuns()
  }, [])

  const onRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await runCascade({
        reportYear: reportYear.trim() || '',
        managers,
        persist,
        useLlm: false,
        maxItemsPerDeputy,
      })
      setResult(response)
      await refreshRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить каскадирование')
    } finally {
      setLoading(false)
    }
  }

  const onOpenRun = async (runId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await getCascadeRun(runId)
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить запуск')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (!result || result.items.length === 0) return
    const yearSuffix = result.run.reportYear ? `-${result.run.reportYear}` : ''
    const prefix = `цели-заместителей${yearSuffix}`
    if (format === 'csv') {
      exportCascadeGoalsCSV(result.items, prefix)
    } else {
      exportCascadeGoalsExcel(result.items, prefix)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Каскадирование целей</h1>

      <section className={styles.panel}>
        <h2>Параметры запуска</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Отчётный год</span>
            <input
              className={styles.input}
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              placeholder="Например, 2026"
            />
          </label>

          <label className={styles.field}>
            <span>Максимум целей на заместителя</span>
            <input
              type="number"
              min={1}
              max={200}
              className={styles.input}
              value={maxItemsPerDeputy}
              onChange={(e) => setMaxItemsPerDeputy(Number(e.target.value) || 25)}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>Руководители (через запятую, пусто = все)</span>
          <textarea
            className={styles.textarea}
            value={managersInput}
            onChange={(e) => setManagersInput(e.target.value)}
            placeholder="Иванов И.И., Петров П.П."
          />
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
          />
          <span>Сохранять запуск в историю</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onRun} disabled={loading}>
            {loading ? 'Выполняется...' : 'Запустить каскадирование'}
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </section>

      <section className={styles.panel}>
        <h2>История запусков</h2>
        {loadingRuns ? (
          <div className={styles.muted}>Загрузка...</div>
        ) : runs.length === 0 ? (
          <div className={styles.muted}>Запусков пока нет</div>
        ) : (
          <div className={styles.runList}>
            {runs.map((run) => (
              <button key={run.runId} className={styles.runBtn} type="button" onClick={() => onOpenRun(run.runId)}>
                {new Date(run.createdAt).toLocaleString()} — {run.totalItems} назначений, {run.unmatchedManagers} несопоставленных
              </button>
            ))}
          </div>
        )}
      </section>

      {result && (
        <>
          <section className={styles.panel}>
            <h2>Сводка запуска</h2>
            <div>Run ID: {result.run.runId}</div>
            <div>Статус: {result.run.status}</div>
            <div>Руководителей: {result.run.totalManagers}</div>
            <div>Заместителей: {result.run.totalDeputies}</div>
            <div>Назначений: {result.run.totalItems}</div>
            <div>Несопоставленных: {result.run.unmatchedManagers}</div>
            {result.run.warnings.length > 0 && (
              <ul>
                {result.run.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            <h2>Несопоставленные руководители</h2>
            {result.unmatched.length === 0 ? (
              <div className={styles.muted}>Нет</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Руководитель</th>
                      <th>Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.unmatched.map((u) => (
                      <tr key={`${u.managerName}-${u.reason}`}>
                        <td>{u.managerName}</td>
                        <td>{u.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Каскадированные назначения</h2>
              <div className={styles.exportActions}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => handleExport('xlsx')}
                  disabled={result.items.length === 0}
                >
                  Экспорт Excel
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => handleExport('csv')}
                  disabled={result.items.length === 0}
                >
                  Экспорт CSV
                </button>
              </div>
            </div>
            {result.items.length === 0 ? (
              <div className={styles.muted}>Нет данных</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Руководитель</th>
                      <th>Заместитель</th>
                      <th>Источник</th>
                      <th>Цель</th>
                      <th>Метрика</th>
                      <th>Trace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.managerName}</td>
                        <td>{item.deputyName}</td>
                        <td>{item.sourceType}</td>
                        <td>{item.sourceGoalTitle}</td>
                        <td>{item.sourceMetric}</td>
                        <td>{item.traceRule}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
