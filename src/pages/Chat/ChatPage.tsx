import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getModels,
  chatCompletions,
  uploadFile,
  waitForFileReady,
  type OpenWebUIModel,
} from '@/api/openwebui'
import {
  getChats,
  saveChats,
  getSettings,
  saveSettings,
  getCollections,
  generateId,
} from '@/lib/storage'
import type { ChatSettings } from '@/lib/storage'
import type { StoredChat, StoredMessage } from '@/types/chat'
import type { AttachedFile, AttachedCollection } from '@/types/chat'
import styles from './ChatPage.module.css'

const FileIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

const CollectionIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
)

function getChatTitle(messages: StoredMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first?.content) return 'Новый чат'
  const text = first.content.trim().slice(0, 50)
  return text + (first.content.length > 50 ? '…' : '')
}

export function ChatPage() {
  const [chats, setChats] = useState<StoredChat[]>(() => getChats())
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [models, setModels] = useState<OpenWebUIModel[]>([])
  const [settings, setSettingsState] = useState<ChatSettings>(() => getSettings())
  const [showSettings, setShowSettings] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<ChatSettings>(() => getSettings())
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [attachments, setAttachments] = useState<(AttachedFile | AttachedCollection)[]>([])
  const [showAttachDropdown, setShowAttachDropdown] = useState(false)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false)
  const [collectionList, setCollectionList] = useState<ReturnType<typeof getCollections>>([])
  const settingsDropdownRef = useRef<HTMLDivElement>(null)
  const attachDropdownRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [defaultModelId, setDefaultModelId] = useState('')
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const setSettings = useCallback((next: ChatSettings) => {
    setSettingsState(next)
    saveSettings(next)
  }, [])

  useEffect(() => {
    if (showSettings) setSettingsDraft(settings)
  }, [showSettings, settings.apiUrl, settings.apiKey])

  const handleSaveSettings = useCallback(() => {
    setSettings(settingsDraft)
    setSettingsSaved(true)
    setShowSettings(false)
    setTimeout(() => setSettingsSaved(false), 1500)
  }, [settingsDraft, setSettings])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        showSettings &&
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(target)
      ) {
        setShowSettings(false)
      }
      if (
        (showAttachDropdown || showCollectionPicker) &&
        attachDropdownRef.current &&
        !attachDropdownRef.current.contains(target)
      ) {
        setShowAttachDropdown(false)
        setShowCollectionPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings, showAttachDropdown, showCollectionPicker])

  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId)
    : null

  useEffect(() => {
    saveChats(chats)
  }, [chats])

  useEffect(() => {
    if (!settings.apiKey.trim()) {
      setModels([])
      return
    }
    setModelsLoading(true)
    setError(null)
    getModels(settings.apiKey, settings.apiUrl || undefined)
      .then(setModels)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить модели')
        setModels([])
      })
      .finally(() => setModelsLoading(false))
  }, [settings.apiKey, settings.apiUrl])

  const handleNewChat = useCallback(() => {
    const id = generateId()
    const newChat: StoredChat = {
      id,
      title: 'Новый чат',
      modelId: currentChat?.modelId || defaultModelId || models[0]?.id || '',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setChats((prev) => [newChat, ...prev])
    setCurrentChatId(id)
    setAttachments([])
    setInput('')
    setError(null)
  }, [currentChat?.modelId, defaultModelId, models])

  const handleSelectChat = useCallback((id: string) => {
    setCurrentChatId(id)
    setAttachments([])
    setError(null)
    setEditingChatId(null)
  }, [])

  const handleDeleteChat = useCallback((e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    if (currentChatId === chatId) {
      setCurrentChatId(null)
      setAttachments([])
    }
    setEditingChatId((id) => (id === chatId ? null : id))
  }, [currentChatId])

  const handleStartRename = useCallback((e: React.MouseEvent, chat: StoredChat) => {
    e.stopPropagation()
    setEditingChatId(chat.id)
    setEditingDraft(chat.title || '')
  }, [])

  const handleRenameSubmit = useCallback((chatId: string, newTitle: string) => {
    const title = newTitle.trim() || 'Без названия'
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title, updatedAt: Date.now() } : c))
    )
    setEditingChatId(null)
  }, [])

  useEffect(() => {
    if (editingChatId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [editingChatId])

  const handleAttachFile = useCallback(() => {
    setShowAttachDropdown(false)
    fileInputRef.current?.click()
  }, [])

  const handleAttachCollectionClick = useCallback(() => {
    setShowAttachDropdown(false)
    setShowCollectionPicker(true)
    setCollectionList(getCollections())
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length || !settings.apiKey) return
      setError(null)
      const baseUrl = settings.apiUrl || undefined
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const res = await uploadFile(settings.apiKey, file, baseUrl)
          await waitForFileReady(settings.apiKey, res.id, { baseUrl })
          setAttachments((prev) => [
            ...prev,
            { id: generateId(), name: file.name, fileId: res.id },
          ])
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
        }
      }
      e.target.value = ''
    },
    [settings.apiKey, settings.apiUrl]
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleSelectCollection = useCallback((col: { id: string; name: string }) => {
    setAttachments((prev) => [
      ...prev,
      {
        id: generateId(),
        name: col.name,
        collectionId: col.id,
      } as AttachedCollection,
    ])
    setShowCollectionPicker(false)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || !settings.apiKey) return
    if (!currentChat && !models.length) {
      setError('Сначала укажите API ключ и выберите модель')
      return
    }

    const modelId = currentChat?.modelId || defaultModelId || models[0]?.id
    if (!modelId) {
      setError('Выберите модель')
      return
    }

    setLoading(true)
    setError(null)
    setInput('')

    let chat = currentChat
    if (!chat) {
      const id = generateId()
      chat = {
        id,
        title: getChatTitle([{ role: 'user', content: text }]),
        modelId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setChats((prev) => [chat!, ...prev])
      setCurrentChatId(id)
    }

    const userMessage: StoredMessage = {
      role: 'user',
      content: text,
      attachments:
        attachments.length > 0
          ? attachments.map((a) => ({
              name: a.name,
              type: 'fileId' in a ? ('file' as const) : ('collection' as const),
            }))
          : undefined,
    }
    const nextMessages: StoredMessage[] = [...chat.messages, userMessage]
    setChats((prev) =>
      prev.map((c) =>
        c.id === chat!.id
          ? {
              ...c,
              title: c.messages.length === 0 ? getChatTitle([userMessage]) : c.title,
              messages: nextMessages,
              updatedAt: Date.now(),
            }
          : c
      )
    )

    const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }))
    const allCollections = getCollections()
    const files =
      attachments.length > 0
        ? attachments.flatMap((a) => {
            if ('fileId' in a) return [{ type: 'file' as const, id: a.fileId }]
            const col = allCollections.find((c) => c.id === a.collectionId)
            if (!col?.fileIds?.length) return []
            return col.fileIds.map((id) => ({ type: 'file' as const, id }))
          })
        : undefined

    try {
      const res = await chatCompletions(
        settings.apiKey,
        {
          model: modelId,
          messages: apiMessages,
          files,
        },
        settings.apiUrl || undefined
      )
      const assistantContent =
        res?.choices?.[0]?.message?.content ?? res?.error?.message ?? 'Нет ответа'
      const assistantMessage: StoredMessage = { role: 'assistant', content: assistantContent }
      setChats((prev) =>
        prev.map((c) =>
          c.id === chat!.id
            ? {
                ...c,
                messages: [...nextMessages, assistantMessage],
                updatedAt: Date.now(),
              }
            : c
        )
      )
      setAttachments([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса')
      setChats((prev) =>
        prev.map((c) =>
          c.id === chat!.id ? { ...c, messages: chat!.messages, updatedAt: Date.now() } : c
        )
      )
    } finally {
      setLoading(false)
    }
  }, [
    input,
    settings.apiKey,
    settings.apiUrl,
    currentChat,
    currentChatId,
    defaultModelId,
    models,
    attachments,
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className={styles.wrap}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button type="button" className={styles.newChatBtn} onClick={handleNewChat}>
            <span>+</span> Новый чат
          </button>
          <div className={styles.settingsWrap} ref={settingsDropdownRef}>
            <button
              type="button"
              className={styles.settingsBtn}
              onClick={() => setShowSettings((s) => !s)}
              title="Настройки"
              aria-expanded={showSettings}
            >
              ⚙
            </button>
            {showSettings && (
              <div className={styles.settingsDropdown}>
                <h3 className={styles.settingsTitle}>Open Web UI</h3>
                <div className={styles.settingsRow}>
                  <label className={styles.settingsLabel}>URL (если не через proxy)</label>
                  <input
                    type="url"
                    className={styles.settingsInput}
                    placeholder="http://localhost:3000"
                    value={settingsDraft.apiUrl}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, apiUrl: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.settingsRow}>
                  <label className={styles.settingsLabel}>API ключ</label>
                  <input
                    type="password"
                    className={styles.settingsInput}
                    placeholder="API key из Open Web UI"
                    value={settingsDraft.apiKey}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, apiKey: e.target.value }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className={styles.settingsSaveBtn}
                  onClick={handleSaveSettings}
                  disabled={settingsSaved}
                >
                  {settingsSaved ? 'Сохранено' : 'Сохранить'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={styles.chatList}>
          {sortedChats.map((chat) => (
            <div
              key={chat.id}
              role="button"
              tabIndex={0}
              className={`${styles.chatItemRow} ${currentChatId === chat.id ? styles.chatItemActive : ''}`}
              onClick={() => handleSelectChat(chat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelectChat(chat.id)
                }
              }}
            >
              {editingChatId === chat.id ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  className={styles.chatItemInput}
                  value={editingDraft}
                  onChange={(e) => setEditingDraft(e.target.value)}
                  onBlur={() => handleRenameSubmit(chat.id, editingDraft)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleRenameSubmit(chat.id, editingDraft)
                    }
                    if (e.key === 'Escape') {
                      setEditingChatId(null)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className={styles.chatItemTitle}>{chat.title || 'Без названия'}</span>
                  <div className={styles.chatItemActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={styles.chatItemBtn}
                      onClick={(e) => handleStartRename(e, chat)}
                      title="Переименовать"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={styles.chatItemBtn}
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      title="Удалить"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className={styles.main}>
        <div className={styles.topBar}>
          <span className={styles.modelLabel}>Модель:</span>
          <select
            className={styles.modelSelect}
            value={(currentChat?.modelId ?? defaultModelId) || models[0]?.id || ''}
            onChange={(e) => {
              const id = e.target.value
              if (currentChatId)
                setChats((prev) =>
                  prev.map((c) => (c.id === currentChatId ? { ...c, modelId: id } : c))
                )
              else setDefaultModelId(id)
            }}
            disabled={modelsLoading}
          >
            {models.length === 0 && <option value="">— Выберите модель —</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.messages}>
          {currentChat?.messages.length ? (
            currentChat.messages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.message} ${
                  msg.role === 'user' ? styles.messageUser : styles.messageAssistant
                }`}
              >
                {msg.content}
                {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                  <div className={styles.messageAttachments}>
                    {msg.attachments.map((att, j) => (
                      <span key={j} className={styles.messageFileChip}>
                        {att.type === 'collection' ? (
                          <CollectionIcon />
                        ) : (
                          <FileIcon />
                        )}{' '}
                        {att.type === 'collection' ? `Коллекция: ${att.name}` : att.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              Напишите сообщение или прикрепите файлы (бизнес-план, цели, чеклисты) и нажмите
              Enter для отправки.
            </div>
          )}
          {loading && (
            <div className={`${styles.message} ${styles.messageAssistant}`}>
              <span className={styles.loadingDots}>
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
        </div>

        <div className={styles.inputWrap}>
          {error && <div className={styles.errorBar}>{error}</div>}
          {attachments.length > 0 && (
            <div className={styles.attachments}>
              {attachments.map((a) => (
                <span key={a.id} className={styles.fileChip}>
                  {'fileId' in a ? (
                    <FileIcon className={styles.fileChipIcon} />
                  ) : (
                    <CollectionIcon className={styles.fileChipIcon} />
                  )}{' '}
                  {'fileId' in a ? a.name : `Коллекция: ${a.name}`}
                  <button
                    type="button"
                    className={styles.fileChipRemove}
                    onClick={() => removeAttachment(a.id)}
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className={styles.inputRow} ref={attachDropdownRef}>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.inputHidden}
              multiple
              onChange={handleFileChange}
            />
            <div className={styles.attachDropdownWrap}>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={() => setShowAttachDropdown((v) => !v)}
                disabled={!settings.apiKey}
                title="Прикрепить файл или коллекцию"
                aria-expanded={showAttachDropdown || showCollectionPicker}
              >
                <FileIcon />
              </button>
              {showAttachDropdown && !showCollectionPicker && (
                <div className={styles.attachDropdown}>
                  <button
                    type="button"
                    className={styles.attachDropdownItem}
                    onClick={handleAttachFile}
                  >
                    <FileIcon className={styles.attachDropdownIcon} /> Прикрепить файл
                  </button>
                  <button
                    type="button"
                    className={styles.attachDropdownItem}
                    onClick={handleAttachCollectionClick}
                  >
                    <CollectionIcon className={styles.attachDropdownIcon} /> Прикрепить коллекцию
                  </button>
                </div>
              )}
              {showCollectionPicker && (
                <div className={styles.collectionPicker}>
                  <div className={styles.collectionPickerTitle}>Выберите коллекцию</div>
                  {collectionList.length === 0 ? (
                    <div className={styles.collectionPickerEmpty}>
                      Нет коллекций. Создайте их на вкладке «База знаний».
                    </div>
                  ) : (
                    <ul className={styles.collectionPickerList}>
                      {collectionList.map((col) => (
                        <li key={col.id}>
                          <button
                            type="button"
                            className={styles.collectionPickerItem}
                            onClick={() => handleSelectCollection(col)}
                          >
                            <CollectionIcon className={styles.fileChipIcon} /> {col.name}{' '}
                            <span className={styles.collectionPickerMeta}>
                              ({col.fileIds.length} файлов)
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className={styles.textareaWrap}>
              <textarea
                className={styles.textarea}
                placeholder="Сообщение… (Enter — отправить, Shift+Enter — новая строка)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={1}
              />
            </div>
            <button
              type="button"
              className={styles.sendBtn}
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              title="Отправить"
            >
              →
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
