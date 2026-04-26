import { useCallback, useEffect, useState } from 'react'
import {
  deleteCascadeRun,
  getCascadeRun,
  listCascadeRuns,
  runCascade,
  type CascadeRunResponse,
  type CascadeRunSummary,
} from '@/api/cascade'
import { getBoardGoalRows, getLeaderGoalRows } from '@/api/goals'
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

const managerSurnameForFilename = (value: string): string => {
  const raw = String(value ?? '').trim()
  if (!raw) return 'руководитель'
  const firstToken = raw.split(/\s+/)[0] || 'руководитель'
  return firstToken.replace(/[\\/:*?"<>|]/g, '')
}

export function CascadePage() {
  const [reportYear, setReportYear] = useState('')
  const [reportYearOptions, setReportYearOptions] = useState<string[]>([])
  const [selectedManager, setSelectedManager] = useState('')
  const [staffRows, setStaffRows] = useState<StaffRow[]>([])
  const [managerOptions, setManagerOptions] = useState<string[]>([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [loadingYears, setLoadingYears] = useState(false)
  const [useLlm, setUseLlm] = useState(true)
  const [persistHistory, setPersistHistory] = useState(true)
  const [useHistoryCache, setUseHistoryCache] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CascadeRunResponse | null>(null)
  const [historyRuns, setHistoryRuns] = useState<CascadeRunSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [loadingHistoryRunId, setLoadingHistoryRunId] = useState<string | null>(null)
  const [deletingHistoryRunId, setDeletingHistoryRunId] = useState<string | null>(null)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const [progress, setProgress] = useState<{ total: number; done: number; current: string; currentDeputies: number }>({
    total: 0,
    done: 0,
    current: '',
    currentDeputies: 0,
  })

  useEffect(() => {
    let active = true
    const loadInitialFilters = async () => {
      setLoadingManagers(true)
      setLoadingYears(true)
      try {
        const [rows, boardRows, leaderRows] = await Promise.all([
          getStaffRows(),
          getBoardGoalRows(),
          getLeaderGoalRows(),
        ])
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

        const yearSet = new Set<string>()
        boardRows.forEach((row) => {
          const value = String(row.reportYear ?? row.year ?? '').trim()
          if (value) yearSet.add(value)
        })
        leaderRows.forEach((row) => {
          const value = String(row.reportYear ?? '').trim()
          if (value) yearSet.add(value)
        })
        setReportYearOptions(
          Array.from(yearSet).sort((a, b) =>
            a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' })
          )
        )
      } finally {
        if (active) {
          setLoadingManagers(false)
          setLoadingYears(false)
        }
      }
    }
    void loadInitialFilters()
    return () => {
      active = false
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const runs = await listCascadeRuns(30)
      setHistoryRuns(runs)
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Не удалось загрузить историю запусков')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const runContainsManager = (run: CascadeRunResponse, managerName: string): boolean => {
    const managerKey = normalizeName(managerName)
    return (
      run.items.some((item) => normalizeName(item.managerName) === managerKey) ||
      run.unmatched.some((item) => normalizeName(item.managerName) === managerKey)
    )
  }

  const findCachedRun = useCallback(
    async ({
      managerName,
      reportYearValue,
      useLlmValue,
    }: {
      managerName: string
      reportYearValue: string
      useLlmValue: boolean
    }): Promise<CascadeRunResponse | null> => {
      const managerKey = normalizeName(managerName)
      const candidates = historyRuns.filter((run) => {
        if ((run.reportYear || '') !== reportYearValue) return false
        if (Boolean(run.useLlm) !== useLlmValue) return false
        if (!Array.isArray(run.managers) || run.managers.length === 0) return false
        return run.managers.some((name) => normalizeName(name) === managerKey)
      })
      for (const run of candidates) {
        const details = await getCascadeRun(run.runId)
        if (runContainsManager(details, managerName)) {
          return details
        }
      }
      return null
    },
    [historyRuns]
  )

  const handleLoadHistoryRun = useCallback(async (runId: string) => {
    setLoadingHistoryRunId(runId)
    setError(null)
    try {
      const details = await getCascadeRun(runId)
      setResult(details)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить запуск из истории')
    } finally {
      setLoadingHistoryRunId(null)
    }
  }, [])

  const handleDeleteHistoryRun = useCallback(
    async (runId: string) => {
      setDeletingHistoryRunId(runId)
      setHistoryError(null)
      try {
        await deleteCascadeRun(runId)
        setHistoryRuns((prev) => prev.filter((run) => run.runId !== runId))
      } catch (err) {
        setHistoryError(err instanceof Error ? err.message : 'Не удалось удалить запуск из истории')
      } finally {
        setDeletingHistoryRunId(null)
      }
    },
    []
  )

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
          if (useHistoryCache) {
            const cached = await findCachedRun({
              managerName,
              reportYearValue,
              useLlmValue: useLlm,
            })
            if (cached) {
              mergedItems.push(...cached.items)
              mergedUnmatched.push(...cached.unmatched)
              mergedFallbackGoals.push(...(cached.fallbackGoals ?? []))
              cached.items.forEach((item) => deputySet.add(item.deputyName))
              cached.run.warnings.forEach((w) => warningsSet.add(w))
              setProcessingSteps((prev) => [
                ...prev,
                `[${i + 1}/${managerList.length}] ${managerName}: найдено в истории, пересчёт пропущен (runId=${cached.run.runId}).`,
              ])
              continue
            }
          }
          const response = await runCascade({
            reportYear: reportYearValue,
            managers: [managerName],
            persist: persistHistory,
            useLlm,
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
      if (persistHistory) {
        void loadHistory()
      }
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
    const managerName = result.run.managers?.[0] || result.items[0]?.managerName || selectedManager
    const managerSurname = managerSurnameForFilename(managerName)
    const prefix = `цели-заместителей-${managerSurname}${yearSuffix}`
    exportCascadeGoalsExcel(result.items, prefix)
  }

  const handleExportFallback = () => {
    if (!result || result.fallbackGoals.length === 0) return
    const yearSuffix = result.run.reportYear ? `-${result.run.reportYear}` : ''
    const managerName = result.run.managers?.[0] || result.fallbackGoals[0]?.managerName || selectedManager
    const managerSurname = managerSurnameForFilename(managerName)
    const prefix = `резервные-цели-${managerSurname}${yearSuffix}`
    exportCascadeGoalsExcel(
      result.fallbackGoals.map((goal) => ({
        managerName: goal.managerName,
        deputyName: goal.deputyName || '',
        sourceType: goal.sourceType,
        sourceRowId: goal.sourceRowId,
        sourceGoalTitle: goal.sourceGoalTitle,
        sourceMetric: goal.sourceMetric,
        businessUnit: goal.businessUnit,
        department: goal.department,
        reportYear: goal.reportYear,
        traceRule: `fallback_reason: ${goal.reason}`,
      })),
      prefix
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Каскадирование целей</h1>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <h2>История запросов</h2>
          <div className={styles.exportActions}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => setHistoryCollapsed((prev) => !prev)}
            >
              {historyCollapsed ? 'Развернуть' : 'Свернуть'}
            </button>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => void loadHistory()}
              disabled={historyLoading}
            >
              {historyLoading ? 'Обновление...' : 'Обновить'}
            </button>
          </div>
        </div>
        {!historyCollapsed && (
          <>
            {historyError && <div className={styles.error}>{historyError}</div>}
            {historyRuns.length === 0 ? (
              <div className={styles.muted}>
                {historyLoading ? 'Загрузка истории...' : 'История пока пустая'}
              </div>
            ) : (
              <div className={styles.runList}>
                {historyRuns.map((run) => (
                  <div key={run.runId} className={styles.runRow}>
                    <button
                      type="button"
                      className={styles.runBtn}
                      onClick={() => void handleLoadHistoryRun(run.runId)}
                      disabled={loadingHistoryRunId === run.runId || deletingHistoryRunId === run.runId}
                    >
                      <strong>{run.reportYear || 'Без года'}</strong> |{' '}
                      {run.managers?.join(', ') || 'Без фильтра руководителей'} |{' '}
                      {run.useLlm ? 'LLM: вкл' : 'LLM: выкл'} | Целей: {run.totalItems} |{' '}
                      {new Date(run.createdAt).toLocaleString('ru-RU')}
                      {loadingHistoryRunId === run.runId ? ' (загрузка...)' : ''}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      title="Удалить из истории"
                      aria-label="Удалить из истории"
                      onClick={() => void handleDeleteHistoryRun(run.runId)}
                      disabled={deletingHistoryRunId === run.runId || loadingHistoryRunId === run.runId}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Параметры запуска</h2>
        <div className={`${styles.formGrid} ${styles.primaryFiltersRow}`}>
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

          <label className={styles.field}>
            <span>Отчётный год</span>
            <select
              className={styles.input}
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              disabled={loadingYears || loading}
            >
              <option value="">Выберите отчётный год</option>
              {reportYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
          />
          <span>Использовать LLM-фильтрацию целей по реестру процессов и стратегии</span>
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={persistHistory}
            onChange={(e) => setPersistHistory(e.target.checked)}
            disabled={loading}
          />
          <span>Сохранять результаты каскадирования в историю</span>
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={useHistoryCache}
            onChange={(e) => setUseHistoryCache(e.target.checked)}
            disabled={loading}
          />
          <span>Использовать историю (если запрос уже выполнялся)</span>
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
            <div className={styles.sectionHead}>
              <h2>Резервные цели для несопоставленных</h2>
              <div className={styles.exportActions}>
                <button
                  type="button"
                  className={styles.exportBtn}
                  onClick={handleExportFallback}
                  disabled={result.fallbackGoals.length === 0}
                >
                  Экспорт Excel
                </button>
              </div>
            </div>
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
