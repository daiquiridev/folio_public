import { useEffect, useState, useCallback } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Text } from '@cloudflare/kumo/components/text'
import { GearIcon, ArrowsClockwiseIcon, SignInIcon, SignOutIcon, LinkIcon, BookmarkSimpleIcon, SparkleIcon } from '@phosphor-icons/react'
import { getStorage, setStorage, getTimeAgo, readExtensionUrl, sendMessage } from '../lib/chrome'

function bgSend<T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...extra }, (res) => {
      const err = chrome.runtime.lastError
      if (err) return reject(new Error(err.message))
      if (!res?.success) return reject(new Error(res?.error || 'Unknown error'))
      resolve(res.data as T)
    })
  })
}

interface PopupState {
  isConnected: boolean
  statusText: string
  statusDetails: string
  nextSync: string
  isSyncing: boolean
  isAuthenticating: boolean
  message: { text: string; type: 'success' | 'error' | 'info' } | null
  siteLink: string
  bmcLink: string
  authError: boolean
}

export function PopupApp() {
  const [state, setState] = useState<PopupState>({
    isConnected: false,
    statusText: 'Checking status...',
    statusDetails: '',
    nextSync: '',
    isSyncing: false,
    isAuthenticating: false,
    message: null,
    siteLink: 'https://spacechild.dev',
    bmcLink: 'https://buymeacoffee.com/daiquiri',
    authError: false,
  })

  // Quick save + AI folder suggestion
  const [saveBusy, setSaveBusy] = useState(false)
  const [saved, setSaved] = useState<{ id: string; title: string; duplicate: boolean } | null>(null)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [suggestion, setSuggestion] = useState<{ folder: string; isNew: boolean } | null>(null)
  const [suggestBusy, setSuggestBusy] = useState(false)
  const [moved, setMoved] = useState<string | null>(null)

  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info') => {
    setState(s => ({ ...s, message: { text, type } }))
    if (type !== 'error') {
      setTimeout(() => setState(s => ({ ...s, message: null })), 3000)
    }
  }, [])

  const updateStatus = useCallback(async () => {
    const { accessToken, lastSyncTime, syncIntervalMinutes, syncEnabled } =
      await getStorage(['accessToken', 'lastSyncTime', 'syncIntervalMinutes', 'syncEnabled'])
    const isConnected = !!accessToken

    let statusText = isConnected ? '✓ Connected' : '✗ Not Connected'
    let statusDetails = ''
    let nextSync = ''

    if (isConnected) {
      statusDetails = lastSyncTime ? `Last sync: ${getTimeAgo(lastSyncTime)}` : 'Ready to sync'
      if (syncEnabled && lastSyncTime && syncIntervalMinutes) {
        const nextSyncTime = lastSyncTime + syncIntervalMinutes * 60 * 1000
        const now = Date.now()
        if (nextSyncTime > now) {
          nextSync = `Next sync in ${Math.ceil((nextSyncTime - now) / 60000)} min`
        } else {
          nextSync = 'Sync scheduled...'
        }
      } else if (syncEnabled) {
        nextSync = `Auto-sync: Every ${syncIntervalMinutes || 15} min`
      } else {
        nextSync = 'Auto-sync disabled'
      }
    } else {
      statusDetails = 'Connect to Raindrop.io to start syncing'
    }

    const local = await new Promise<{ raindropAuthError?: boolean }>(resolve => {
      chrome.storage.local.get(['raindropAuthError'], (r) => resolve(r || {}))
    })
    const authError = !!local.raindropAuthError

    setState(s => ({ ...s, isConnected, statusText, statusDetails, nextSync, authError }))
  }, [])

  useEffect(() => {
    updateStatus()
    readExtensionUrl('website.txt').then(url => {
      if (url) setState(s => ({ ...s, siteLink: url }))
    })
    readExtensionUrl('buymeacoffee.txt').then(url => {
      if (url) setState(s => ({ ...s, bmcLink: url }))
    })
    bgSend<{ effectiveProvider: string | null }>('ai.status')
      .then(s => setAiAvailable(!!s.effectiveProvider))
      .catch(() => {})
    const interval = setInterval(updateStatus, 30000)
    return () => clearInterval(interval)
  }, [updateStatus])

  async function quickSave() {
    setSaveBusy(true)
    setSuggestion(null)
    setMoved(null)
    try {
      const r = await bgSend<{ id: string; title: string; duplicate: boolean }>('tools.quickSave')
      setSaved(r)
      if (r.duplicate) {
        showMessage('Already bookmarked', 'info')
      } else if (aiAvailable) {
        // Kayıt anında AI'dan klasör önerisi iste — kabul edilmezse Inbox'ta kalır
        setSuggestBusy(true)
        bgSend<{ folder: string; isNew: boolean }>('ai.suggestFolder', { id: r.id })
          .then(setSuggestion)
          .catch(() => {})
          .finally(() => setSuggestBusy(false))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      showMessage(msg === 'not_a_page' ? 'This tab is not a web page' : 'Save failed: ' + msg, 'error')
    } finally {
      setSaveBusy(false)
    }
  }

  async function acceptSuggestion() {
    if (!saved || !suggestion) return
    try {
      await bgSend('tools.moveToFolder', { id: saved.id, folderName: suggestion.folder })
      setMoved(suggestion.folder)
      setSuggestion(null)
    } catch (e: unknown) {
      showMessage('Move failed: ' + (e instanceof Error ? e.message : ''), 'error')
    }
  }

  async function syncNow() {
    setState(s => ({ ...s, isSyncing: true }))
    showMessage('Syncing bookmarks...', 'info')
    try {
      const res = await sendMessage({ action: 'syncNow' })
      if (res?.success) {
        showMessage('Sync completed successfully!', 'success')
        await updateStatus()
      } else {
        showMessage('Sync failed: ' + (res?.error || 'Unknown error'), 'error')
      }
    } catch (e: unknown) {
      showMessage('Sync failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    } finally {
      setState(s => ({ ...s, isSyncing: false }))
    }
  }

  async function authenticate() {
    setState(s => ({ ...s, isAuthenticating: true }))
    showMessage('Opening authentication...', 'info')
    try {
      // RaindropOAuth is loaded from oauth.js in the extension context
      const oauth = new (window as unknown as { RaindropOAuth: new () => { startAuthFlow: () => Promise<void> } }).RaindropOAuth()
      await oauth.startAuthFlow()
      showMessage('Successfully connected!', 'success')
      await updateStatus()
    } catch (e: unknown) {
      showMessage('Connection failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    } finally {
      setState(s => ({ ...s, isAuthenticating: false }))
    }
  }

  async function logout() {
    if (!confirm('Are you sure you want to disconnect from Raindrop.io?')) return
    try {
      showMessage('Disconnecting...', 'info')
      await setStorage({ accessToken: undefined, refreshToken: undefined, tokenExpiresAt: undefined })
      await updateStatus()
      showMessage('Disconnected successfully', 'success')
    } catch (e: unknown) {
      showMessage('Logout failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    }
  }

  const messageVariant = state.message?.type === 'error' ? 'destructive'
    : state.message?.type === 'success' ? 'primary'
    : 'secondary'

  return (
    <div className="riso-app w-[340px] bg-app-bg font-sans">
      {/* Header — brand lockup, matching the options page */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-kumo-line bg-app-surface relative z-10">
        <div className="riso-brand">
          <img src="icon128.png" alt="" aria-hidden="true" style={{ width: 24, height: 24 }} />
          <span className="riso-wordmark" style={{ fontSize: 17 }}>Folio</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          icon={GearIcon}
          aria-label="Open Settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        />
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Quick save + AI folder suggestion */}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            className="w-full h-11 text-base"
            icon={BookmarkSimpleIcon}
            loading={saveBusy}
            onClick={quickSave}
          >
            Save this page
          </Button>
          {saved && !saved.duplicate && !moved && (
            <Text size="xs" variant="secondary" className="px-1">
              Saved to <strong>Folio Inbox</strong>{suggestBusy ? ' — asking AI for a folder…' : ''}
            </Text>
          )}
          {suggestion && saved && (
            <div className="rounded-lg border-2 border-app-border bg-app-bg px-3 py-2 flex items-center gap-2">
              <SparkleIcon size={14} className="text-kumo-brand shrink-0" />
              <Text size="xs" className="flex-1 min-w-0 truncate">
                Move to <strong>{suggestion.folder}</strong>{suggestion.isNew ? ' (new)' : ''}?
              </Text>
              <Button variant="secondary" size="sm" onClick={acceptSuggestion}>Move</Button>
              <Button variant="ghost" size="sm" onClick={() => setSuggestion(null)}>Keep</Button>
            </div>
          )}
          {moved && (
            <Text size="xs" variant="secondary" className="px-1">
              Moved to <strong>{moved}</strong>
            </Text>
          )}
        </div>

        {/* Status Card */}
        <div className={`rounded-lg p-4 ${state.isConnected ? 'bg-kumo-accent' : 'bg-kumo-subtle-contrast'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-white' : 'bg-kumo-subtle'}`} />
            <Text bold size="sm" className={state.isConnected ? 'text-white' : 'text-kumo-default'}>{state.statusText}</Text>
          </div>
          {state.statusDetails && (
            <Text size="xs" className={state.isConnected ? 'text-white/80' : 'text-kumo-subtle'}>{state.statusDetails}</Text>
          )}
          {state.nextSync && (
            <Text size="xs" className="text-white/60 mt-1">{state.nextSync}</Text>
          )}
        </div>

        {/* Auth error banner */}
        {state.authError && (
          <Badge variant="destructive" className="w-full justify-center py-2 text-sm">
            Raindrop auth expired — reconnect in Settings
          </Badge>
        )}

        {/* Message */}
        {state.message && (
          <Badge variant={messageVariant} className="w-full justify-center py-2 text-sm">
            {state.message.text}
          </Badge>
        )}

        {/* Sync Button */}
        <Button
          variant="primary"
          className="w-full h-11 text-base"
          icon={ArrowsClockwiseIcon}
          loading={state.isSyncing}
          onClick={syncNow}
        >
          Sync Now
        </Button>

        {/* Auth Buttons */}
        <div className="flex gap-2">
          {!state.isConnected && (
            <Button
              variant="secondary"
              className="flex-1"
              icon={SignInIcon}
              loading={state.isAuthenticating}
              onClick={authenticate}
            >
              Connect
            </Button>
          )}
          {state.isConnected && (
            <Button
              variant="secondary"
              className="flex-1"
              icon={SignOutIcon}
              onClick={logout}
            >
              Logout
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-kumo-line">
          <div className="flex items-center gap-2">
            <a href={state.siteLink} target="_blank" rel="noreferrer"
              className="text-xs text-kumo-subtle hover:text-kumo-default flex items-center gap-1">
              <LinkIcon size={12} />
              Website
            </a>
            <span className="text-kumo-line">•</span>
            <a href={state.bmcLink} target="_blank" rel="noreferrer"
              className="text-xs text-kumo-subtle hover:text-kumo-default">
              Support
            </a>
          </div>
          <Text size="xs" variant="secondary">v{chrome.runtime.getManifest().version}</Text>
        </div>
      </div>
    </div>
  )
}
