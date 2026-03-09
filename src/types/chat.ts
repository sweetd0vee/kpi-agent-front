export type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Прикреплённые файлы, коллекции, таблицы (только у сообщений пользователя) */
  attachments?: { name: string; type?: 'file' | 'collection' | 'prompt' | 'table' }[]
}

export type StoredChat = {
  id: string
  title: string
  modelId: string
  messages: StoredMessage[]
  createdAt: number
  updatedAt: number
}

export type AttachedFile = {
  id: string
  name: string
  /** Open Web UI file id for API */
  fileId: string
}

export type AttachedCollection = {
  id: string
  name: string
  /** Open Web UI knowledge/collection id for API */
  collectionId: string
}

export type AttachedPrompt = {
  id: string
  name: string
  promptId: string
  content: string
}
