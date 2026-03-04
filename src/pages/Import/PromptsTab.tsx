import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateId, getPrompts, savePrompts, type StoredPrompt } from '@/lib/storage'
import styles from '../ImportPage.module.css'

type DefaultPrompt = {
  id: string
  title: string
  content: string
}

const DEFAULT_PROMPTS: DefaultPrompt[] = [
  {
    id: 'cascade-director',
    title: 'Каскадирование целей директора',
    content: `Ты аналитик KPI банка. Используй контекст из прикреплённых коллекций (цели председателя, стратегия, регламент, чеклист департамента).
Сформируй KPI директора департамента:
- 5–7 KPI и 3–5 PPR;
- для каждого укажи формулировку, единицу измерения, вес (%), квартальные значения и итог за год;
- суммарный вес = 100%.
В конце выдай таблицу: № | Цель | Тип (KPI/PPR) | Ед. изм. | Вес | Q1 | Q2 | Q3 | Q4 | Год.`,
  },
  {
    id: 'compliance-check',
    title: 'Проверка соответствия стратегии и регламенту',
    content: `Проверь предложенные KPI/ППР на соответствие стратегии банка и регламенту постановки целей.
Сопоставь с целями председателя и чеклистами.
Ответ: список несоответствий, рисков, а также что нужно исправить или уточнить.`,
  },
  {
    id: 'summary-insights',
    title: 'Сводка по департаменту',
    content: `На основе коллекций кратко опиши ключевые цели департамента, основные KPI, риски и зависимости.
Дай 5–7 тезисов и список вопросов для уточнения с владельцами процессов.`,
  },
]

const buildCopyTitle = (title: string) => (title ? `${title} (копия)` : 'Без названия (копия)')

export function PromptsTab() {
  const [customPrompts, setCustomPrompts] = useState<StoredPrompt[]>(() => getPrompts())
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    savePrompts(customPrompts)
  }, [customPrompts])

  const sortedCustomPrompts = useMemo(
    () => [...customPrompts].sort((a, b) => b.updatedAt - a.updatedAt),
    [customPrompts]
  )

  const resetEditing = useCallback(() => {
    setEditingPromptId(null)
    setEditingTitle('')
    setEditingContent('')
    setEditError(null)
  }, [])

  const handleCreatePrompt = useCallback(() => {
    const content = newContent.trim()
    if (!content) {
      setCreateError('Введите текст промпта.')
      return
    }
    const title = newTitle.trim() || 'Без названия'
    const now = Date.now()
    const next: StoredPrompt = {
      id: generateId(),
      title,
      content,
      createdAt: now,
      updatedAt: now,
    }
    setCustomPrompts((prev) => [next, ...prev])
    setNewTitle('')
    setNewContent('')
    setCreateError(null)
  }, [newContent, newTitle])

  const handleStartEdit = useCallback((prompt: StoredPrompt) => {
    setEditingPromptId(prompt.id)
    setEditingTitle(prompt.title)
    setEditingContent(prompt.content)
    setEditError(null)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingPromptId) return
    const content = editingContent.trim()
    if (!content) {
      setEditError('Введите текст промпта.')
      return
    }
    const title = editingTitle.trim() || 'Без названия'
    const now = Date.now()
    setCustomPrompts((prev) =>
      prev.map((prompt) =>
        prompt.id === editingPromptId ? { ...prompt, title, content, updatedAt: now } : prompt
      )
    )
    resetEditing()
  }, [editingContent, editingPromptId, editingTitle, resetEditing])

  const handleCopyPrompt = useCallback((prompt: { title: string; content: string }) => {
    const now = Date.now()
    const next: StoredPrompt = {
      id: generateId(),
      title: buildCopyTitle(prompt.title),
      content: prompt.content,
      createdAt: now,
      updatedAt: now,
    }
    setCustomPrompts((prev) => [next, ...prev])
  }, [])

  return (
    <section className={styles.promptsSection}>
      <div className={styles.promptsIntro}>
        <h2 className={styles.promptsTitle}>Промпты</h2>
        <p className={styles.promptsSubtitle}>
          Встроенные промпты защищены от редактирования. Создавайте свои или копируйте встроенные
          для адаптации — позже они будут подставляться в чат с LLM.
        </p>
      </div>

      <div className={styles.promptCreateCard}>
        <h3 className={styles.promptsGroupTitle}>Новый промпт</h3>
        {createError && <div className={styles.promptError}>{createError}</div>}
        <div className={styles.promptFormGrid}>
          <label className={styles.promptField}>
            Название
            <input
              type="text"
              className={styles.promptInput}
              placeholder="Название промпта"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value)
                if (createError) setCreateError(null)
              }}
            />
          </label>
          <label className={styles.promptField}>
            Текст промпта
            <textarea
              className={styles.promptTextarea}
              placeholder="Опишите инструкции для модели"
              rows={6}
              value={newContent}
              onChange={(e) => {
                setNewContent(e.target.value)
                if (createError) setCreateError(null)
              }}
            />
          </label>
        </div>
        <div className={styles.promptCreateActions}>
          <button type="button" className={styles.promptCreateBtn} onClick={handleCreatePrompt}>
            Создать промпт
          </button>
        </div>
      </div>

      <div className={styles.promptsGroup}>
        <h3 className={styles.promptsGroupTitle}>Встроенные</h3>
        <div className={styles.promptsGrid}>
          {DEFAULT_PROMPTS.map((prompt) => (
            <article key={`default-${prompt.id}`} className={`${styles.promptCard} ${styles.promptCardLocked}`}>
              <div className={styles.promptCardHead}>
                <div className={styles.promptCardTitleWrap}>
                  <h4 className={styles.promptCardTitle}>{prompt.title}</h4>
                  <span className={styles.promptBadge}>Встроенный</span>
                </div>
                <div className={styles.promptCardActions}>
                  <button
                    type="button"
                    className={styles.promptActionBtn}
                    onClick={() => handleCopyPrompt(prompt)}
                    title="Создать копию для редактирования"
                  >
                    Копировать
                  </button>
                </div>
              </div>
              <p className={styles.promptCardText}>{prompt.content}</p>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.promptsGroup}>
        <h3 className={styles.promptsGroupTitle}>Пользовательские</h3>
        {sortedCustomPrompts.length === 0 ? (
          <div className={styles.empty}>
            <p>Пока нет пользовательских промптов. Создайте первый выше.</p>
          </div>
        ) : (
          <div className={styles.promptsGrid}>
            {sortedCustomPrompts.map((prompt) => {
              const isEditing = editingPromptId === prompt.id
              return (
                <article key={prompt.id} className={styles.promptCard}>
                  <div className={styles.promptCardHead}>
                    <div className={styles.promptCardTitleWrap}>
                      <h4 className={styles.promptCardTitle}>
                        {isEditing ? 'Редактирование' : prompt.title || 'Без названия'}
                      </h4>
                    </div>
                    <div className={styles.promptCardActions}>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className={`${styles.promptActionBtn} ${styles.promptActionBtnGhost}`}
                            onClick={resetEditing}
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            className={`${styles.promptActionBtn} ${styles.promptActionBtnPrimary}`}
                            onClick={handleSaveEdit}
                          >
                            Сохранить
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.promptActionBtn}
                            onClick={() => handleStartEdit(prompt)}
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            className={styles.promptActionBtn}
                            onClick={() => handleCopyPrompt(prompt)}
                            title="Создать копию промпта"
                          >
                            Копировать
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <>
                      {editError && <div className={styles.promptError}>{editError}</div>}
                      <div className={styles.promptFormGrid}>
                        <label className={styles.promptField}>
                          Название
                          <input
                            type="text"
                            className={styles.promptInput}
                            value={editingTitle}
                            onChange={(e) => {
                              setEditingTitle(e.target.value)
                              if (editError) setEditError(null)
                            }}
                          />
                        </label>
                        <label className={styles.promptField}>
                          Текст промпта
                          <textarea
                            className={styles.promptTextarea}
                            rows={6}
                            value={editingContent}
                            onChange={(e) => {
                              setEditingContent(e.target.value)
                              if (editError) setEditError(null)
                            }}
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <p className={styles.promptCardText}>{prompt.content}</p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
