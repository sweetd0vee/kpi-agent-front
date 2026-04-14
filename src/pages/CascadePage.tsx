import { useEffect, useState } from 'react'
import { runCascade, type CascadeRunResponse } from '@/api/cascade'
import { getStaffRows, type StaffRow } from '@/api/registry'
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
  const [selectedManager, setSelectedManager] = useState('')
  const [staffRows, setStaffRows] = useState<StaffRow[]>([])
  const [managerOptions, setManagerOptions] = useState<string[]>([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [maxItemsPerDeputyInput, setMaxItemsPerDeputyInput] = useState('25')
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

  useEffect(() => {
    let active = true
    const loadManagers = async () => {
      setLoadingManagers(true)
      try {
        const rows = await getStaffRows()
        if (!active) return
        setStaffRows(rows)
        const options = Array.from(
          new Set(
            rows
              .map((row) => String(row.functionalBlockCurator ?? '').trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, 'ru'))
        setManagerOptions(options)
      } finally {
        if (active) setLoadingManagers(false)
      }
    }
    void loadManagers()
    return () => {
      active = false
    }
  }, [])

  const onRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setProcessingSteps([])
    const startedAt = performance.now()
    try {
      if (!selectedManager.trim()) {
        throw new Error('Выберите руководителя из списка перед запуском каскадирования.')
      }
      setProcessingSteps((prev) => [...prev, 'Инициализация каскадирования...'])
      const parsedMax = Number.parseInt(maxItemsPerDeputyInput, 10)
      const maxItemsPerDeputy = Number.isFinite(parsedMax) ? Math.min(200, Math.max(1, parsedMax)) : 25
      const reportYearValue = reportYear.trim() || ''

      let localStaffRows = staffRows
      if (localStaffRows.length === 0) {
        setProcessingSteps((prev) => [
          ...prev,
          'Запрашиваю штатное расписание для расчёта заместителей по руководителям...',
        ])
        localStaffRows = await getStaffRows()
        setStaffRows(localStaffRows)
        const options = Array.from(
          new Set(
            localStaffRows
              .map((row) => String(row.functionalBlockCurator ?? '').trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, 'ru'))
        setManagerOptions(options)
      }
      setProcessingSteps((prev) => [...prev, `Загружено строк штатного расписания: ${localStaffRows.length}`])
      const managerToDeputies = new Map<string, Set<string>>()
      localStaffRows.forEach((row) => {
        const managerRaw = String(row.functionalBlockCurator ?? '').trim()
        const deputyRaw = String(row.head ?? '').trim()
        const managerKey = normalizeName(managerRaw)
        const deputyKey = normalizeName(deputyRaw)
        if (!managerKey || !deputyKey || managerKey === deputyKey) return
        const set = managerToDeputies.get(managerKey) ?? new Set<string>()
        set.add(deputyKey)
        managerToDeputies.set(managerKey, set)
      })

      const managerList = [selectedManager]

      if (managerList.length === 0) {
        throw new Error('Не найдено руководителей для запуска каскадирования.')
      }
      setProcessingSteps((prev) => [...prev, `К обработке выбрано руководителей: ${managerList.length}`])

      const batchRunId = `batch-${Date.now()}`
      const createdAt = new Date().toISOString()
      const mergedItems: CascadeRunResponse['items'] = []
      const mergedUnmatched: CascadeRunResponse['unmatched'] = []
      const mergedFallbackGoals: CascadeRunResponse['fallbackGoals'] = []
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
            persist: false,
            useLlm,
            maxItemsPerDeputy,
          })
          mergedItems.push(...response.items)
          mergedUnmatched.push(...response.unmatched)
          mergedFallbackGoals.push(...(response.fallbackGoals ?? []))
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
          fallbackGoals: [...mergedFallbackGoals],
        })
      }

      setProgress({ total: managerList.length, done: managerList.length, current: '', currentDeputies: 0 })
      setProcessingSteps((prev) => [
        ...prev,
        `Каскадирование завершено за ${((performance.now() - startedAt) / 1000).toFixed(1)}с. Итого назначений: ${mergedItems.length}, несопоставленных: ${mergedUnmatched.length}.`,
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
        fallbackGoals: mergedFallbackGoals,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить каскадирование')
      setProcessingSteps((prev) => [
        ...prev,
        `Завершено с ошибкой через ${((performance.now() - startedAt) / 1000).toFixed(1)}с: ${
          err instanceof Error ? err.message : 'Не удалось выполнить каскадирование'
        }`,
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
          <span>Руководитель</span>
          <select
            className={styles.input}
            value={selectedManager}
            onChange={(e) => setSelectedManager(e.target.value)}
            disabled={loadingManagers || loading}
          >
            <option value="">Выберите руководителя</option>
            {managerOptions.map((manager) => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
          </select>
          <span className={styles.muted}>
            {loadingManagers ? 'Загружаю список руководителей...' : 'Список из поля "Куратор ф. блока" штатного расписания.'}
          </span>
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
            <div>Каскадированных целей: {result.run.totalItems}</div>
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
            <h2>Резервные цели для несопоставленных</h2>
            {result.fallbackGoals.length === 0 ? (
              <div className={styles.muted}>
                Резервные цели не сформированы: у руководителя не найдены исходные цели для случайного каскадирования.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Руководитель</th>
                      <th>Несопоставленный заместитель</th>
                      <th>Причина несопоставления</th>
                      <th>Источник</th>
                      <th>Цель руководителя</th>
                      <th>Метрика</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.fallbackGoals.map((goal) => (
                      <tr key={goal.id}>
                        <td>{goal.managerName}</td>
                        <td>{goal.deputyName || '—'}</td>
                        <td>{goal.reason}</td>
                        <td>{goal.sourceType}</td>
                        <td>{goal.sourceGoalTitle}</td>
                        <td>{goal.sourceMetric}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Каскадированные цели</h2>
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
