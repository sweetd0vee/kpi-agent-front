import { useMemo, useState } from 'react'
import { runCascade, type CascadeRunResponse } from '@/api/cascade'
import { getStaffRows } from '@/api/registry'
import { exportCascadeGoalsExcel } from '@/lib/exportGoals'
import styles from './CascadePage.module.css'

const normalizeName = (value: string): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')

export function CascadePage() {
  const [reportYear, setReportYear] = useState('')
  const [managersInput, setManagersInput] = useState('')
  const [maxItemsPerDeputyInput, setMaxItemsPerDeputyInput] = useState('25')
  const [persist, setPersist] = useState(true)
  const [useLlm, setUseLlm] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CascadeRunResponse | null>(null)
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const [progress, setProgress] = useState<{ total: number; done: number; current: string; currentDeputies: number }>({
    total: 0,
    done: 0,
    current: '',
    currentDeputies: 0,
  })

  const managers = useMemo(
    () =>
      managersInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [managersInput]
  )

  const onRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setProcessingSteps([])
    try {
      setProcessingSteps((prev) => [...prev, 'Инициализация каскадирования...'])
      const parsedMax = Number.parseInt(maxItemsPerDeputyInput, 10)
      const maxItemsPerDeputy = Number.isFinite(parsedMax) ? Math.min(200, Math.max(1, parsedMax)) : 25
      const reportYearValue = reportYear.trim() || ''

      const staffRows = await getStaffRows()
      setProcessingSteps((prev) => [...prev, `Загружено строк штатного расписания: ${staffRows.length}`])
      const managerToDeputies = new Map<string, Set<string>>()
      staffRows.forEach((row) => {
        const managerRaw = String(row.functionalBlockCurator ?? '').trim()
        const deputyRaw = String(row.head ?? '').trim()
        const managerKey = normalizeName(managerRaw)
        const deputyKey = normalizeName(deputyRaw)
        if (!managerKey || !deputyKey || managerKey === deputyKey) return
        const set = managerToDeputies.get(managerKey) ?? new Set<string>()
        set.add(deputyKey)
        managerToDeputies.set(managerKey, set)
      })

      const managerList =
        managers.length > 0
          ? managers
          : Array.from(
              new Set(
                staffRows
                  .map((row) => String(row.functionalBlockCurator ?? '').trim())
                  .filter(Boolean)
              )
            )

      if (managerList.length === 0) {
        throw new Error('Не найдено руководителей для запуска каскадирования.')
      }
      setProcessingSteps((prev) => [...prev, `К обработке выбрано руководителей: ${managerList.length}`])

      const batchRunId = `batch-${Date.now()}`
      const createdAt = new Date().toISOString()
      const mergedItems: CascadeRunResponse['items'] = []
      const mergedUnmatched: CascadeRunResponse['unmatched'] = []
      const warningsSet = new Set<string>()
      const deputySet = new Set<string>()

      setProgress({ total: managerList.length, done: 0, current: '', currentDeputies: 0 })
      for (let i = 0; i < managerList.length; i += 1) {
        const managerName = managerList[i]
        const deputiesCount = managerToDeputies.get(normalizeName(managerName))?.size ?? 0
        setProcessingSteps((prev) => [
          ...prev,
          `[${i + 1}/${managerList.length}] Руководитель: ${managerName}. Заместителей: ${deputiesCount}. Запуск...`,
        ])
        setProgress({
          total: managerList.length,
          done: i,
          current: managerName,
          currentDeputies: deputiesCount,
        })
        try {
          const response = await runCascade({
            reportYear: reportYearValue,
            managers: [managerName],
            persist,
            useLlm,
            maxItemsPerDeputy,
          })
          mergedItems.push(...response.items)
          mergedUnmatched.push(...response.unmatched)
          response.items.forEach((item) => deputySet.add(item.deputyName))
          response.run.warnings.forEach((w) => warningsSet.add(w))
          setProcessingSteps((prev) => [
            ...prev,
            `[${i + 1}/${managerList.length}] ${managerName}: добавлено назначений ${response.items.length}, несопоставленных ${response.unmatched.length}.`,
          ])
        } catch (err) {
          const reason =
            err instanceof Error ? err.message : 'Ошибка запуска каскадирования по руководителю'
          mergedUnmatched.push({
            managerName,
            reason,
            reportYear: reportYearValue,
          })
          warningsSet.add(`Руководитель "${managerName}": ${reason}`)
          setProcessingSteps((prev) => [
            ...prev,
            `[${i + 1}/${managerList.length}] ${managerName}: ошибка — ${reason}`,
          ])
        }

        setResult({
          run: {
            runId: batchRunId,
            createdAt,
            status: 'running',
            reportYear: reportYearValue,
            totalManagers: managerList.length,
            totalDeputies: deputySet.size,
            totalItems: mergedItems.length,
            unmatchedManagers: mergedUnmatched.length,
            warnings: Array.from(warningsSet),
          },
          items: [...mergedItems],
          unmatched: [...mergedUnmatched],
        })
      }

      setProgress({ total: managerList.length, done: managerList.length, current: '', currentDeputies: 0 })
      setProcessingSteps((prev) => [
        ...prev,
        `Каскадирование завершено. Итого назначений: ${mergedItems.length}, несопоставленных: ${mergedUnmatched.length}.`,
      ])
      setResult({
        run: {
          runId: batchRunId,
          createdAt,
          status: 'success',
          reportYear: reportYearValue,
          totalManagers: managerList.length,
          totalDeputies: deputySet.size,
          totalItems: mergedItems.length,
          unmatchedManagers: mergedUnmatched.length,
          warnings: Array.from(warningsSet),
        },
        items: mergedItems,
        unmatched: mergedUnmatched,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить каскадирование')
      setProcessingSteps((prev) => [
        ...prev,
        `Завершено с ошибкой: ${err instanceof Error ? err.message : 'Не удалось выполнить каскадирование'}`,
      ])
    } finally {
      setProgress((prev) => ({ ...prev, current: '', currentDeputies: 0 }))
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!result || result.items.length === 0) return
    const yearSuffix = result.run.reportYear ? `-${result.run.reportYear}` : ''
    const prefix = `цели-заместителей${yearSuffix}`
    exportCascadeGoalsExcel(result.items, prefix)
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
              value={maxItemsPerDeputyInput}
              onChange={(e) => setMaxItemsPerDeputyInput(e.target.value)}
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

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
          />
          <span>Использовать LLM-фильтрацию целей по реестру процессов</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onRun} disabled={loading}>
            {loading ? 'Выполняется...' : 'Запустить каскадирование'}
          </button>
        </div>
        {loading && progress.total > 0 && (
          <div className={styles.progressText}>
            Обработано {progress.done} из {progress.total}
            {progress.current ? ` — ${progress.current}` : ''}
            {progress.current ? ` (заместителей: ${progress.currentDeputies})` : ''}
          </div>
        )}
        {processingSteps.length > 0 && (
          <div className={styles.stepsBox} aria-live="polite">
            {processingSteps.map((step, idx) => (
              <div key={`${idx}-${step}`} className={styles.stepLine}>
                {step}
              </div>
            ))}
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
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
                  className={styles.exportBtn}
                  onClick={handleExport}
                  disabled={result.items.length === 0}
                >
                  Экспорт Excel
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
