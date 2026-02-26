import type { StoredChat } from '@/types/chat'

const CHATS_KEY = 'kpi-cascading-chats'
const SETTINGS_KEY = 'kpi-cascading-settings'
const UPLOADED_FILES_KEY = 'kpi-cascading-uploaded-files'
const COLLECTIONS_KEY = 'kpi-cascading-collections'

export type StoredUploadedFile = {
  fileId: string
  name: string
  uploadedAt: number
}

export type StoredCollection = {
  id: string
  name: string
  fileIds: string[]
  createdAt: number
  updatedAt: number
}

export type ChatSettings = {
  apiUrl: string
  apiKey: string
}

export function getChats(): StoredChat[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredChat[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveChats(chats: StoredChat[]): void {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
}

export function getSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { apiUrl: '', apiKey: '' }
    return JSON.parse(raw) as ChatSettings
  } catch {
    return { apiUrl: '', apiKey: '' }
  }
}

export function saveSettings(settings: ChatSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function getUploadedFiles(): StoredUploadedFile[] {
  try {
    const raw = localStorage.getItem(UPLOADED_FILES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredUploadedFile[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveUploadedFiles(files: StoredUploadedFile[]): void {
  localStorage.setItem(UPLOADED_FILES_KEY, JSON.stringify(files))
}

export function getCollections(): StoredCollection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as StoredCollection[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveCollections(collections: StoredCollection[]): void {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
}
