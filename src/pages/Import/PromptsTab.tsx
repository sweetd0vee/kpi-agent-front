import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateId, getPrompts, savePrompts, type StoredPrompt } from '@/lib/storage'
import { DEFAULT_PROMPTS } from '@/lib/prompts'
import { PencilIcon, TrashIcon } from '@/components/Icons'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import styles from '../ImportPage.module.css'

const COPY_SUFFIX_PATTERN = /\s*\(копия(?:\s*-\s*(\d+))?\)\s*$/i

const buildCopyTitle = (title: string, existingTitles: string[]) => {
  const rawTitle = title.trim()
  const baseTitle = rawTitle.replace(COPY_SUFFIX_PATTERN, '').trim() || 'Без названия'
  const copyTitle = `${baseTitle} (копия)`
  const hasCopyTitle = existingTitles.some((existing) => existing.trim() === copyTitle)
  if (!hasCopyTitle) return copyTitle
  let maxIndex = 0
  existingTitles.forEach((existing) => {
    const trimmed = existing.trim()
    if (trimmed === copyTitle) {
      maxIndex = Math.max(maxIndex, 0)
      return
    }
    const match = trimmed.match(new RegExp(`^${baseTitle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} \\(копия - (\\d+)\\)$`, 'i'))
    if (!match) return
    const index = Number(match[1])
    if (Number.isFinite(index) && index > maxIndex) maxIndex = index
  })
  return `${baseTitle} (копия - ${maxIndex + 1})`
}

export function PromptsTab() {
  const [customPrompts, setCustomPrompts] = useState<StoredPrompt[]>(() => getPrompts())
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<StoredPrompt | null>(null)

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
    setCustomPrompts((prev) => {
      const next: StoredPrompt = {
        id: generateId(),
        title: buildCopyTitle(prompt.title, prev.map((item) => item.title)),
        content: prompt.content,
        createdAt: now,
        updatedAt: now,
      }
      return [next, ...prev]
    })
  }, [])

  const handleDeletePrompt = useCallback(
    (promptId: string) => {
      setCustomPrompts((prev) => prev.filter((prompt) => prompt.id !== promptId))
      if (editingPromptId === promptId) resetEditing()
    },
    [editingPromptId, resetEditing]
  )

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
                            className={`${styles.promptIconBtn} ${styles.promptIconBtnEdit}`}
                            onClick={() => handleStartEdit(prompt)}
                            aria-label="Редактировать промпт"
                            title="Редактировать"
                          >
                            <PencilIcon className={styles.promptIcon} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.promptIconBtn} ${styles.promptIconBtnDanger}`}
                            onClick={() => setPendingDeletePrompt(prompt)}
                            aria-label="Удалить промпт"
                            title="Удалить"
                          >
                            <TrashIcon className={styles.promptIcon} />
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

      <ConfirmModal
        open={pendingDeletePrompt !== null}
        title="Удаление промпта"
        message={`Удалить промпт «${pendingDeletePrompt?.title || 'Без названия'}»?`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={() => {
          if (pendingDeletePrompt) handleDeletePrompt(pendingDeletePrompt.id)
          setPendingDeletePrompt(null)
        }}
        onCancel={() => setPendingDeletePrompt(null)}
        danger
      />
    </section>
  )
}
