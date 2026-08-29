// Chrome extension API helpers

export interface StorageData {
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: number
  managedOAuth?: boolean
  managedOAuthBaseUrl?: string
  clientId?: string
  clientSecret?: string
  redirectUri?: string
  lastSyncTime?: number
  syncIntervalMinutes?: number
  syncEnabled?: boolean
  targetFolderId?: string
  collectionsSort?: string
  bookmarksSort?: string
  rateLimitRpm?: number
  twoWayMode?: string
  selectedCollectionIds?: string[]
  topLevelOnly?: boolean
  collectionImportMode?: string
  lastBackupTime?: number
}

export function getStorage(keys: (keyof StorageData)[]): Promise<StorageData> {
  return chrome.storage.sync.get(keys) as Promise<StorageData>
}

export function setStorage(data: Partial<StorageData>): Promise<void> {
  return chrome.storage.sync.set(data)
}

export function removeStorage(keys: (keyof StorageData)[]): Promise<void> {
  return chrome.storage.sync.remove(keys as string[])
}

export function sendMessage(msg: object): Promise<{ success: boolean; error?: string }> {
  return chrome.runtime.sendMessage(msg)
}

export function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export async function readExtensionUrl(filename: string): Promise<string> {
  try {
    const res = await fetch(chrome.runtime.getURL(filename))
    if (!res.ok) return ''
    const raw = await res.text()
    const line = raw.split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith('#'))
    if (!line) return ''
    return /^https?:\/\//i.test(line) ? line : 'https://' + line
  } catch {
    return ''
  }
}
