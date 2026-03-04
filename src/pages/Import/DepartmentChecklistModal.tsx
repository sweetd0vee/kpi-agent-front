import type { DepartmentChecklistItem } from '@/api/documents'
import styles from '../ImportPage.module.css'

export interface DepartmentChecklistState {
  documentId: string
  collectionId: string
  documentName: string
  department: string
  goals: DepartmentChecklistItem[]
  tasks: DepartmentChecklistItem[]
  loading?: boolean
  loadingProgress?: number
  error?: string
  submitting?: boolean
}

export interface DepartmentChecklistModalActions {
  onClose: () => void
  cancelProcessing: () => void
  updateDepartment: (value: string) => void
  toggleGoalChecked: (index: number) => void
  toggleTaskChecked: (index: number) => void
  updateGoal: (index: number, field: keyof DepartmentChecklistItem, value: string | boolean) => void
  updateTask: (index: number, field: keyof DepartmentChecklistItem, value: string | boolean) => void
  addGoal: () => void
  addTask: () => void
  removeGoal: (index: number) => void
  removeTask: (index: number) => void
  submit: () => void
}

interface DepartmentChecklistModalProps {
  state: DepartmentChecklistState
  actions: DepartmentChecklistModalActions
}

export function DepartmentChecklistModal({ state, actions }: DepartmentChecklistModalProps) {
  const {
    onClose,
    cancelProcessing,
    updateDepartment,
    toggleGoalChecked,
    toggleTaskChecked,
    updateGoal,
    updateTask,
    addGoal,
    addTask,
    removeGoal,
    removeTask,
    submit,
  } = actions
  const busy = state.loading || state.submitting

  return (
    <div
      className={styles.modalOverlay}
      onClick={() => !busy && onClose()}
      aria-modal="true"
      role="dialog"
      aria-labelledby="department-checklist-title"
    >
      <div className={styles.checklistModalBox} onClick={(e) => e.stopPropagation()}>
        <h2 id="department-checklist-title" className={styles.checklistModalTitle}>
          Чеклист по положению о департаменте
        </h2>

        {state.loading && (
          <div className={styles.checklistModalLoading} role="status" aria-live="polite">
            <div className={styles.checklistModalSpinner} aria-hidden />
            <p className={styles.checklistModalLoadingText}>Обработка документа LLM…</p>
            <p className={styles.checklistModalLoadingPercent}>{state.loadingProgress ?? 0}%</p>
            <button type="button" className={styles.modalBtnConfirm} onClick={cancelProcessing}>
              Отменить
            </button>
          </div>
        )}

        {state.error && !state.loading && (
          <div className={styles.error} style={{ marginBottom: '1rem' }}>
            <p style={{ margin: 0 }}>{state.error}</p>
            <button type="button" className={styles.errorRetry} onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}

        {!state.loading && !state.error && (
          <>
            <label className={styles.checklistField}>
              Название департамента
              <input
                type="text"
                className={styles.checklistInput}
                value={state.department}
                onChange={(e) => updateDepartment(e.target.value)}
                placeholder="Например: Департамент розничных продуктов"
              />
            </label>

            <div className={styles.checklistSection}>
              <div className={styles.checklistSectionHead}>
                <h3 className={styles.checklistSectionTitle}>Цели</h3>
                <button type="button" className={styles.checklistAddBtn} onClick={addGoal}>
                  + Добавить цель
                </button>
              </div>
              <div className={styles.checklistTableWrap}>
                <table className={styles.checklistTable}>
                  <thead>
                    <tr>
                      <th className={styles.checklistTh} style={{ width: '2.5rem' }}>✓</th>
                      <th className={styles.checklistTh} style={{ width: '4rem' }}>ID</th>
                      <th className={styles.checklistTh}>Текст</th>
                      <th className={styles.checklistTh} style={{ width: '10rem' }}>Раздел</th>
                      <th className={styles.checklistTh} style={{ width: '2rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.goals.map((g, i) => (
                      <tr key={i}>
                        <td className={styles.checklistTd}>
                          <input
                            type="checkbox"
                            checked={g.checked}
                            onChange={() => toggleGoalChecked(i)}
                            aria-label="Отметить"
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={g.id}
                            onChange={(e) => updateGoal(i, 'id', e.target.value)}
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={g.text}
                            onChange={(e) => updateGoal(i, 'text', e.target.value)}
                            placeholder="Текст цели"
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={g.section}
                            onChange={(e) => updateGoal(i, 'section', e.target.value)}
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <button
                            type="button"
                            className={styles.cardSlotDel}
                            onClick={() => removeGoal(i)}
                            title="Удалить"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.checklistSection}>
              <div className={styles.checklistSectionHead}>
                <h3 className={styles.checklistSectionTitle}>Задачи</h3>
                <button type="button" className={styles.checklistAddBtn} onClick={addTask}>
                  + Добавить задачу
                </button>
              </div>
              <div className={styles.checklistTableWrap}>
                <table className={styles.checklistTable}>
                  <thead>
                    <tr>
                      <th className={styles.checklistTh} style={{ width: '2.5rem' }}>✓</th>
                      <th className={styles.checklistTh} style={{ width: '4rem' }}>ID</th>
                      <th className={styles.checklistTh}>Текст</th>
                      <th className={styles.checklistTh} style={{ width: '10rem' }}>Раздел</th>
                      <th className={styles.checklistTh} style={{ width: '2rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.tasks.map((t, i) => (
                      <tr key={i}>
                        <td className={styles.checklistTd}>
                          <input
                            type="checkbox"
                            checked={t.checked}
                            onChange={() => toggleTaskChecked(i)}
                            aria-label="Отметить"
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={t.id}
                            onChange={(e) => updateTask(i, 'id', e.target.value)}
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={t.text}
                            onChange={(e) => updateTask(i, 'text', e.target.value)}
                            placeholder="Текст задачи"
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={t.section}
                            onChange={(e) => updateTask(i, 'section', e.target.value)}
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <button
                            type="button"
                            className={styles.cardSlotDel}
                            onClick={() => removeTask(i)}
                            title="Удалить"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {state.error && (
              <div className={styles.error} style={{ marginBottom: '1rem' }}>
                <p style={{ margin: 0 }}>{state.error}</p>
              </div>
            )}

            <div className={styles.checklistModalActions}>
              <button
                type="button"
                className={styles.modalBtnCancel}
                onClick={onClose}
                disabled={state.submitting}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.modalBtnConfirm}
                onClick={submit}
                disabled={state.submitting}
              >
                {state.submitting ? 'Сохранение…' : 'Сохранить в коллекцию'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
