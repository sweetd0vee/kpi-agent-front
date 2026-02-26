export type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Прикреплённые файлы и/или коллекции (только у сообщений пользователя) */
  attachments?: { name: string; type?: 'file' | 'collection' }[]
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
