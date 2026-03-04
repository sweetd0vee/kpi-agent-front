import type { DepartmentChecklistItem } from '@/api/documents'
import styles from './ImportPage.module.css'

export interface TemplateChecklistState {
  documentId: string
  documentName: string
  documentType: string
  title: string
  mode: 'items' | 'rules'
  items: DepartmentChecklistItem[]
  loading?: boolean
  loadingProgress?: number
  error?: string
  submitting?: boolean
}

export interface TemplateChecklistModalActions {
  onClose: () => void
  cancelProcessing: () => void
  toggleItem: (index: number) => void
  updateItem: (index: number, field: keyof DepartmentChecklistItem, value: string | boolean) => void
  addItem: () => void
  removeItem: (index: number) => void
  submit: () => void
}

interface TemplateChecklistModalProps {
  state: TemplateChecklistState
  actions: TemplateChecklistModalActions
}

export function TemplateChecklistModal({ state, actions }: TemplateChecklistModalProps) {
  const { onClose, cancelProcessing, toggleItem, updateItem, addItem, removeItem, submit } = actions
  const busy = state.loading || state.submitting
  const showSection = state.mode === 'items'
  const heading = state.mode === 'rules' ? 'Правила' : 'Пункты'

  return (
    <div
      className={styles.modalOverlay}
      onClick={() => !busy && onClose()}
      aria-modal="true"
      role="dialog"
      aria-labelledby="template-checklist-title"
    >
      <div className={styles.checklistModalBox} onClick={(e) => e.stopPropagation()}>
        <h2 id="template-checklist-title" className={styles.checklistModalTitle}>
          {state.title}
        </h2>

        {state.loading && (
          <div className={styles.checklistModalLoading} role="status" aria-live="polite">
            <div className={styles.checklistModalSpinner} aria-hidden />
            <p className={styles.checklistModalLoadingText}>Обработка документа…</p>
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
            <div className={styles.checklistSection}>
              <div className={styles.checklistSectionHead}>
                <h3 className={styles.checklistSectionTitle}>{heading}</h3>
                <button type="button" className={styles.checklistAddBtn} onClick={addItem}>
                  + Добавить пункт
                </button>
              </div>
              <div className={styles.checklistTableWrap}>
                <table className={styles.checklistTable}>
                  <thead>
                    <tr>
                      <th className={styles.checklistTh} style={{ width: '2.5rem' }}>✓</th>
                      <th className={styles.checklistTh} style={{ width: '4rem' }}>ID</th>
                      <th className={styles.checklistTh}>Текст</th>
                      {showSection && (
                        <th className={styles.checklistTh} style={{ width: '12rem' }}>
                          Раздел
                        </th>
                      )}
                      <th className={styles.checklistTh} style={{ width: '2rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.items.map((item, i) => (
                      <tr key={i}>
                        <td className={styles.checklistTd}>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleItem(i)}
                            aria-label="Отметить"
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={item.id}
                            onChange={(e) => updateItem(i, 'id', e.target.value)}
                          />
                        </td>
                        <td className={styles.checklistTd}>
                          <input
                            type="text"
                            className={styles.checklistCellInput}
                            value={item.text}
                            onChange={(e) => updateItem(i, 'text', e.target.value)}
                            placeholder="Текст пункта"
                          />
                        </td>
                        {showSection && (
                          <td className={styles.checklistTd}>
                            <input
                              type="text"
                              className={styles.checklistCellInput}
                              value={item.section}
                              onChange={(e) => updateItem(i, 'section', e.target.value)}
                            />
                          </td>
                        )}
                        <td className={styles.checklistTd}>
                          <button
                            type="button"
                            className={styles.cardSlotDel}
                            onClick={() => removeItem(i)}
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
                {state.submitting ? 'Сохранение…' : 'Сохранить JSON'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
