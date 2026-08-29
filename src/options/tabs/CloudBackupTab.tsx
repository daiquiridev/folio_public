import { useState, useEffect, useCallback } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Input } from '@cloudflare/kumo/components/input'
import { Tabs } from '@cloudflare/kumo/components/tabs'
import { Text } from '@cloudflare/kumo/components/text'
import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import { Badge } from '@cloudflare/kumo/components/badge'
import {
  CloudArrowUpIcon,
  ShieldCheckIcon,
  KeyIcon,
  CopyIcon,
  CheckIcon,
  LockKeyIcon,
  LockKeyOpenIcon,
  ClockCounterClockwiseIcon,
  ArrowsClockwiseIcon,
  DownloadSimpleIcon,
  UserCircleIcon,
  PlusIcon,
  PencilSimpleIcon,
  TrashIcon,
  ArrowRightIcon,
  BookmarksIcon,
  SlidersHorizontalIcon,
  ClockIcon,
  PuzzlePieceIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { getTimeAgo } from '../../lib/chrome'
import { SettingsCard, RowList, CardRow } from '../components/SettingsCard'
import type { ToastState } from '../OptionsApp'

interface CloudBackupTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

interface BackupStatus {
  configured: boolean
  enabled: boolean
  unlocked: boolean
  accountId: string | null
  activeProfileId: string
  needsProfilePick?: boolean
  baseVersion: number
  lastSyncAt: number | null
}

interface HistoryEntry {
  version: number
  size?: number
  uploaded?: string   // ISO — R2 nesnesinin yüklenme anı (worker alan adı bu)
  updatedAt?: number  // legacy
}

interface ExtBackupItem {
  id: string
  name: string
  version: string
  installType: string
  homepageUrl: string | null
  updateUrl: string | null
  restorable: boolean
  reason: string | null
  cwsUrl: string | null
}

interface DeviceExtBlock {
  capturedAt: number
  sourceBrowser: string
  extensions: ExtBackupItem[]
}

interface ProfileEntry {
  id: string
  name: string
}

function send<T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: `cloudBackup.${action}`, ...extra }, (res) => {
      const err = chrome.runtime.lastError
      if (err) return reject(new Error(err.message))
      if (!res?.success) return reject(new Error(res?.error || 'Unknown error'))
      resolve(res.data as T)
    })
  })
}


function syncKeyFileText(syncKey: string) {
  return [
    'Folio — Sync Key',
    `Saved: ${new Date().toISOString()}`,
    '',
    'KEEP THIS SAFE. This single key identifies your backup AND decrypts it.',
    'Folio servers store only ciphertext and CANNOT recover your data without it.',
    'Use this key to link Folio on any other browser.',
    '',
    syncKey,
    '',
  ].join('\n')
}

function downloadSyncKey(syncKey: string) {
  const blob = new Blob([syncKeyFileText(syncKey)], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'folio-sync-key.txt'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function CloudBackupTab({ showToast }: CloudBackupTabProps) {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // setup / join form state — v2: ONE sync key is the whole identity
  const [setupJoinTab, setSetupJoinTab] = useState<'setup' | 'join'>('setup')
  const [joinKey, setJoinKey] = useState('')
  const [pickProfileId, setPickProfileId] = useState<string | null>(null)
  const [pickBusy, setPickBusy] = useState<string | null>(null)

  // unlock form state
  const [unlockKey, setUnlockKey] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  // sync key shown once after setup
  const [newSyncKey, setNewSyncKey] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // history
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null)

  // extensions
  const [extBlocks, setExtBlocks] = useState<Record<string, DeviceExtBlock> | null>(null)
  const [extDeviceId, setExtDeviceId] = useState<string | null>(null)

  // inline sync result
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [syncOp, setSyncOp] = useState<'sync' | 'upload' | 'download' | null>(null)

  // profiles
  const [profiles, setProfiles] = useState<ProfileEntry[]>([])
  const [profileBusy, setProfileBusy] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [editingProfileName, setEditingProfileName] = useState('')

  const refresh = useCallback(async () => {
    try {
      const s = await send<BackupStatus>('status')
      setStatus(s)
    } catch (e) {
      showToast('Failed to read backup status: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { refresh() }, [refresh])

  const loadProfiles = useCallback(async () => {
    try {
      const res = await send<{ profiles: ProfileEntry[]; activeProfileId: string }>('profiles')
      setProfiles(res.profiles)
    } catch {}
  }, [])

  useEffect(() => {
    if (status?.configured && status?.unlocked) loadProfiles()
  }, [status, loadProfiles])

  async function doSelectProfile(mode: 'download' | 'sync' | 'upload') {
    if (!pickProfileId) { showToast('Choose a profile first', 'error'); return }
    setPickBusy(mode)
    try {
      await send('selectProfile', { profileId: pickProfileId, mode })
      showToast(mode === 'download'
        ? 'Profile downloaded to this browser'
        : mode === 'sync' ? 'Profile attached & merged' : 'Profile replaced with this browser', 'success')
      await refresh(); await loadProfiles()
    } catch (e) {
      showToast('Failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally { setPickBusy(null) }
  }

  async function doCreateAndAttach() {
    if (!newProfileName.trim()) { showToast('Enter a profile name', 'error'); return }
    setPickBusy('create')
    try {
      const r = await send<{ profileId: string }>('createProfile', { name: newProfileName.trim() })
      await send('selectProfile', { profileId: r.profileId, mode: 'sync' })
      setNewProfileName('')
      showToast('New profile created — this browser now syncs into it', 'success')
      await refresh(); await loadProfiles()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast(msg === 'requires_pro'
        ? 'Creating additional profiles is a Pro feature — you can attach to an existing profile for free.'
        : 'Failed: ' + msg, msg === 'requires_pro' ? 'info' : 'error')
    } finally { setPickBusy(null) }
  }

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  async function doSetup() {
    setBusy(true)
    try {
      const res = await send<{ syncKey: string }>('setup')
      setNewSyncKey(res.syncKey)
      showToast('Encrypted backup enabled', 'success')
      await refresh()
    } catch (e) {
      showToast('Setup failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doJoin() {
    if (!joinKey.trim()) { showToast('Enter your sync key', 'error'); return }
    setBusy(true)
    try {
      await send('join', { key: joinKey.trim() })
      setJoinKey('')
      showToast('Device linked — now choose a profile below.', 'success')
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast('Link failed: ' + (msg === 'no_account' ? 'no backup found for this key' : msg === 'invalid_key' ? 'that does not look like a Folio sync key' : msg), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doUnlock() {
    if (!unlockKey.trim()) { showToast('Enter your sync key', 'error'); return }
    setBusy(true)
    try {
      await send('unlock', { key: unlockKey.trim() })
      setUnlockKey('')
      showToast('Unlocked', 'success')
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast('Unlock failed: ' + (msg === 'wrong_secret' ? 'wrong sync key' : msg), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doStartOver() {
    setBusy(true)
    try {
      await send('startOver')
      setConfirmReset(false)
      setUnlockKey('')
      showToast('Old backup discarded. Set up a fresh encrypted backup below.', 'info')
      await refresh()
    } catch (e) {
      showToast('Reset failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doSync() {
    setBusy(true)
    setSyncOp('sync')
    setSyncResult(null)
    try {
      const res = await send<{ ok?: boolean; skipped?: string; error?: string; version?: number; partial?: boolean; errors?: { op: string; message: string }[] }>('sync')
      if (res.ok && res.partial) {
        const n = res.errors?.length || 0
        const first = res.errors?.[0]
        setSyncResult({ ok: false, message: `Synced with ${n} error(s)${first ? ` — ${first.op}: ${first.message}` : ''}` })
      } else if (res.ok) {
        setSyncResult({ ok: true, message: `Synced — v${res.version}` })
        setTimeout(() => setSyncResult(null), 5000)
      } else if (res.skipped) {
        setSyncResult({ ok: true, message: `Up to date` })
        setTimeout(() => setSyncResult(null), 5000)
      } else {
        setSyncResult({ ok: false, message: `Sync error: ${res.error || 'unknown'}` })
      }
      await refresh()
    } catch (e) {
      setSyncResult({ ok: false, message: 'Sync failed: ' + (e instanceof Error ? e.message : '') })
    } finally {
      setBusy(false)
      setSyncOp(null)
    }
  }

  async function doUpload() {
    setBusy(true)
    setSyncOp('upload')
    setSyncResult(null)
    try {
      const res = await send<{ ok?: boolean; skipped?: string; error?: string; version?: number }>('upload')
      if (res.ok) {
        setSyncResult({ ok: true, message: `Uploaded — v${res.version}` })
        setTimeout(() => setSyncResult(null), 5000)
      } else if (res.skipped) {
        setSyncResult({ ok: true, message: 'Nothing to upload' })
        setTimeout(() => setSyncResult(null), 5000)
      } else {
        setSyncResult({ ok: false, message: `Upload error: ${res.error || 'unknown'}` })
      }
      await refresh()
    } catch (e) {
      setSyncResult({ ok: false, message: 'Upload failed: ' + (e instanceof Error ? e.message : '') })
    } finally {
      setBusy(false)
      setSyncOp(null)
    }
  }

  async function doDownload() {
    setBusy(true)
    setSyncOp('download')
    setSyncResult(null)
    try {
      const res = await send<{ ok?: boolean; skipped?: string; error?: string; version?: number }>('download')
      if (res.ok) {
        setSyncResult({ ok: true, message: `Downloaded — v${res.version}` })
        setTimeout(() => setSyncResult(null), 5000)
      } else if (res.skipped === 'remote_empty') {
        setSyncResult({ ok: false, message: 'No remote backup found' })
      } else if (res.skipped) {
        setSyncResult({ ok: true, message: 'Up to date' })
        setTimeout(() => setSyncResult(null), 5000)
      } else {
        setSyncResult({ ok: false, message: `Download error: ${res.error || 'unknown'}` })
      }
      await refresh()
    } catch (e) {
      setSyncResult({ ok: false, message: 'Download failed: ' + (e instanceof Error ? e.message : '') })
    } finally {
      setBusy(false)
      setSyncOp(null)
    }
  }

  async function loadExtensions() {
    setBusy(true)
    try {
      const res = await send<{ deviceId: string | null; extensions: Record<string, DeviceExtBlock> }>('extensions')
      setExtBlocks(res.extensions || {})
      setExtDeviceId(res.deviceId)
    } catch (e) {
      showToast('Failed to load extensions: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doRestoreVersion(version: number) {
    setRestoringVersion(version)
    try {
      await send('restoreVersion', { version })
      showToast(`Restored from version ${version}`, 'success')
      await refresh()
    } catch (e) {
      showToast('Restore failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setRestoringVersion(null)
    }
  }

  async function loadHistory() {
    setBusy(true)
    try {
      const res = await send<{ versions: HistoryEntry[] }>('history')
      setHistory(res.versions || [])
    } catch (e) {
      showToast('Failed to load history: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doDisable() {
    setBusy(true)
    try {
      await send('disable')
      setHistory(null)
      showToast('Backup disabled on this device (key cleared locally)', 'info')
      await refresh()
    } catch (e) {
      showToast('Failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setBusy(false)
    }
  }

  // --- Profile actions ---
  async function doCreateProfile() {
    if (!newProfileName.trim()) { showToast('Enter a profile name', 'error'); return }
    setProfileBusy(true)
    try {
      await send('createProfile', { name: newProfileName.trim() })
      setNewProfileName('')
      showToast('Profile created', 'success')
      await loadProfiles()
    } catch (e) {
      showToast('Failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setProfileBusy(false)
    }
  }

  async function doSwitchProfile(profileId: string, mode: 'replace' | 'merge' = 'replace') {
    setProfileBusy(true)
    try {
      await send('switchProfile', { profileId, mode })
      showToast(mode === 'merge' ? 'Bookmarks merged into that profile' : 'Profile downloaded — browser now shows it', 'success')
      await refresh()
      await loadProfiles()
    } catch (e) {
      showToast('Switch failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setProfileBusy(false)
    }
  }

  async function doRenameProfile() {
    if (!editingProfileId || !editingProfileName.trim()) return
    setProfileBusy(true)
    try {
      await send('renameProfile', { profileId: editingProfileId, name: editingProfileName.trim() })
      setEditingProfileId(null)
      setEditingProfileName('')
      showToast('Profile renamed', 'success')
      await loadProfiles()
    } catch (e) {
      showToast('Rename failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setProfileBusy(false)
    }
  }

  async function doDeleteProfile(profileId: string) {
    setProfileBusy(true)
    try {
      await send('deleteProfile', { profileId })
      showToast('Profile deleted', 'success')
      await loadProfiles()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast('Delete failed: ' + (msg === 'cannot_delete_active' ? 'cannot delete the active profile' : msg), 'error')
    } finally {
      setProfileBusy(false)
    }
  }

  if (loading) return <Text className="text-kumo-subtle">Loading…</Text>

  const configured = status?.configured
  const unlocked = status?.unlocked
  const activeProfileId = status?.activeProfileId

  return (
    <div className="flex flex-col gap-8">
      {/* Intro */}
      <div className="rounded-lg border border-kumo-line bg-kumo-base p-6 flex gap-4">
        <ShieldCheckIcon size={28} className="text-kumo-brand flex-shrink-0" weight="fill" />
        <div>
          <p className="text-sm font-medium text-kumo-default mb-1">End-to-end encrypted backup</p>
          <Text className="text-sm text-kumo-subtle">
            Your bookmarks are encrypted on this device before upload. The server only stores
            ciphertext it cannot read. Keep your sync key safe — it is the
            only way to decrypt your data.
          </Text>
        </div>
      </div>

      {/* Sync key — shown once after setup */}
      {newSyncKey && (
        <div className="riso-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <KeyIcon size={18} className="text-kumo-brand" weight="fill" />
            <p className="text-sm font-semibold text-kumo-default">Save your sync key now — shown only once</p>
          </div>
          <Text className="text-sm text-kumo-subtle">
            This ONE key is everything: it identifies your backup and decrypts it. Store it in a
            password manager. Enter it in Folio on any other browser to link that device — there is
            no separate account ID or passphrase.
          </Text>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-md bg-app-bg border border-kumo-line text-sm font-mono text-kumo-default break-all">{newSyncKey}</code>
            <Button variant="secondary" size="sm" icon={copied === 'key' ? CheckIcon : CopyIcon} onClick={() => copy('key', newSyncKey)}>
              {copied === 'key' ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={DownloadSimpleIcon} onClick={() => downloadSyncKey(newSyncKey)}>
              Download .txt
            </Button>
          </div>
          <Button variant="primary" onClick={() => setNewSyncKey(null)}>I've saved it</Button>
        </div>
      )}

      {/* Not configured: setup or join */}
      {!configured && !newSyncKey && (
        <div className="rounded-lg border border-kumo-line bg-kumo-base">
          <div className="px-6 py-4 border-b border-kumo-line">
            <Tabs
              tabs={[
                { value: 'setup', label: 'Set up new backup' },
                { value: 'join', label: 'Link existing device' },
              ]}
              value={setupJoinTab}
              onValueChange={v => setSetupJoinTab(v as 'setup' | 'join')}
            />
          </div>

          {setupJoinTab === 'setup' ? (
            <div className="px-6 py-6 flex flex-col gap-5">
              <Text className="text-sm text-kumo-subtle">
                Folio will generate a single <strong>sync key</strong> for you — one string that both
                identifies your encrypted backup and decrypts it. No account, no password to invent.
                You save the key once and use it to link your other browsers.
              </Text>
              <Button variant="primary" icon={CloudArrowUpIcon} loading={busy} onClick={doSetup}>
                Generate sync key &amp; enable backup
              </Button>
            </div>
          ) : (
            <div className="px-6 py-6 flex flex-col gap-5">
              <Input
                label="Sync key"
                value={joinKey}
                onChange={e => setJoinKey(e.target.value)}
                placeholder="FOLIO-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                description="The key you saved when you set up backup on your first device."
              />
              <Button variant="primary" icon={KeyIcon} loading={busy} onClick={doJoin}>
                Link this device
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Linked, but this browser hasn't picked a profile yet */}
      {configured && unlocked && !newSyncKey && status?.needsProfilePick && (
        <SettingsCard title="Choose a profile for this browser" icon={UserCircleIcon}>
          <Text className="text-sm text-kumo-subtle">
            Your account can hold several bookmark profiles (e.g. one per browser, or Work /
            Personal). Pick which one THIS browser should use, then decide how to start.
          </Text>
          <div className="flex flex-col gap-2">
            {profiles.map(p => (
              <label key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer text-sm ${pickProfileId === p.id ? 'border-kumo-brand bg-kumo-tint' : 'border-app-border bg-app-bg'}`}>
                <input type="radio" name="pickProfile" checked={pickProfileId === p.id} onChange={() => setPickProfileId(p.id)} />
                <span className="font-semibold text-kumo-default">{p.name}</span>
              </label>
            ))}
            {profiles.length === 0 && (
              <Text size="sm" className="text-kumo-subtle">No profiles in this account yet — create the first one below.</Text>
            )}
          </div>
          {pickProfileId && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" loading={pickBusy === 'sync'} disabled={!!pickBusy} onClick={() => doSelectProfile('sync')}>
                Merge &amp; sync
              </Button>
              <Button variant="secondary" size="sm" loading={pickBusy === 'download'} disabled={!!pickBusy} onClick={() => doSelectProfile('download')}>
                Download (replace this browser)
              </Button>
              <Button variant="ghost" size="sm" loading={pickBusy === 'upload'} disabled={!!pickBusy} onClick={() => doSelectProfile('upload')}>
                Upload (replace cloud profile)
              </Button>
            </div>
          )}
          <div className="border-t border-kumo-line pt-4 flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="…or create a new profile for this browser"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                placeholder="e.g. Work Laptop, Brave, Personal"
              />
            </div>
            <Button variant="secondary" loading={pickBusy === 'create'} disabled={!!pickBusy} onClick={doCreateAndAttach}>
              Create &amp; attach
            </Button>
          </div>
        </SettingsCard>
      )}

      {/* Configured but locked: unlock */}
      {configured && !unlocked && !newSyncKey && (
        <SettingsCard title="Locked" icon={LockKeyIcon}>
          <Text className="text-sm text-kumo-subtle">Unlock to decrypt and sync on this device.</Text>
          <Input
            label="Sync key"
            value={unlockKey}
            onChange={e => setUnlockKey(e.target.value)}
            placeholder="FOLIO-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
          />
          <Button variant="primary" icon={LockKeyOpenIcon} loading={busy} onClick={doUnlock}>Unlock</Button>

          <div className="border-t border-kumo-line pt-5 mt-1">
            {!confirmReset ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
                Lost your sync key?
              </Button>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-kumo-danger/40 bg-kumo-base p-4">
                <Text className="text-sm text-kumo-subtle">
                  The server copy is encrypted and can never be decrypted without your sync
                  key — there is no way to recover it. Starting over discards that backup
                  and lets you set up a new one. Your bookmarks in this browser are not affected.
                </Text>
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="sm" loading={busy} onClick={doStartOver}>
                    Discard backup &amp; start over
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </SettingsCard>
      )}

      {/* Configured + unlocked: status + profiles + actions */}
      {configured && unlocked && !newSyncKey && !status?.needsProfilePick && !status?.enabled && (
        <div className="riso-card p-4 flex items-center justify-between gap-3">
          <Text className="text-sm text-kumo-default">
            Auto-sync is <strong>paused</strong> (e.g. after a restore). Manual Upload/Download still work —
            clean up first, then resume.
          </Text>
          <Button variant="primary" size="sm" onClick={async () => {
            await send('setEnabled', { enabled: true })
            showToast('Auto-sync resumed', 'success')
            await refresh()
          }}>Resume auto-sync</Button>
        </div>
      )}

      {configured && unlocked && !newSyncKey && !status?.needsProfilePick && (
        <>
          <SettingsCard
            title="Active & unlocked"
            icon={LockKeyOpenIcon}
            action={
              <div className="flex items-center gap-2">
                <Dialog.Root>
                  <Dialog.Trigger render={
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={CloudArrowUpIcon}
                      loading={syncOp === 'upload'}
                      disabled={busy}
                    >
                      Upload
                    </Button>
                  } />
                  <Dialog className="p-6 flex flex-col gap-4" size="sm">
                    <Dialog.Title>Upload to cloud?</Dialog.Title>
                    <Dialog.Description>
                      This replaces the cloud copy of this profile with the bookmarks in <strong>this browser</strong> — without
                      merging. Bookmarks that only exist in the cloud (e.g. uploaded from another device) will be removed from
                      the cloud copy. Nothing is deleted on your other devices; running <strong>Sync</strong> there later will
                      merge them back. If you want to combine both sides, use <strong>Sync</strong> instead.
                    </Dialog.Description>
                    <div className="flex gap-2 justify-end">
                      <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
                      <Dialog.Close render={
                        <Button variant="destructive" size="sm" icon={CloudArrowUpIcon} onClick={doUpload}>
                          Upload &amp; replace cloud
                        </Button>
                      } />
                    </div>
                  </Dialog>
                </Dialog.Root>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowsClockwiseIcon}
                  loading={syncOp === 'sync'}
                  disabled={busy}
                  onClick={doSync}
                >
                  Sync
                </Button>
                <Dialog.Root>
                  <Dialog.Trigger render={
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={DownloadSimpleIcon}
                      loading={syncOp === 'download'}
                      disabled={busy}
                    >
                      Download
                    </Button>
                  } />
                  <Dialog className="p-6 flex flex-col gap-4" size="sm">
                    <Dialog.Title>Download from cloud?</Dialog.Title>
                    <Dialog.Description>
                      This will replace your current browser bookmarks with the latest version from the cloud backup.
                      Local changes will be lost. A snapshot is taken first and rolled back automatically if anything goes wrong.
                    </Dialog.Description>
                    <div className="flex gap-2 justify-end">
                      <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
                      <Dialog.Close render={
                        <Button variant="destructive" size="sm" icon={DownloadSimpleIcon} onClick={doDownload}>
                          Download &amp; replace
                        </Button>
                      } />
                    </div>
                  </Dialog>
                </Dialog.Root>
              </div>
            }
            bodyClassName="px-6 py-6 flex flex-col gap-4"
          >
            <div className="flex justify-between text-sm">
              <span className="text-kumo-subtle">Last sync</span>
              <span className="text-kumo-default">{status?.lastSyncAt ? getTimeAgo(status.lastSyncAt) : 'never'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-kumo-subtle">Version</span>
              <span className="text-kumo-default">{status?.baseVersion ?? 0}</span>
            </div>
            {syncResult && (
              <div className={`text-xs ${syncResult.ok ? 'text-kumo-success' : 'text-kumo-danger'}`}>
                {syncResult.ok ? '✓' : '✗'} {syncResult.message}
              </div>
            )}
            <div className="text-xs text-kumo-subtle rounded-md bg-app-bg border border-kumo-line px-3 py-2 flex flex-col gap-1">
              <span><strong className="text-kumo-default">Sync</strong> — merges this browser and the cloud both ways, then updates both. Use this on every device. Recommended.</span>
              <span><strong className="text-kumo-default">Upload</strong> — one-way: cloud ← this browser. Replaces the cloud copy, no merging.</span>
              <span><strong className="text-kumo-default">Download</strong> — one-way: this browser ← cloud. Replaces local bookmarks, no merging.</span>
            </div>
            <Text className="text-xs text-kumo-subtle">
              Link another browser by entering your <strong>sync key</strong> there (Options → Cloud
              Sync → Link existing device). The key is not stored here — it lives wherever you saved it.
            </Text>
          </SettingsCard>

          {/* What's Synced */}
          <SettingsCard
            title="What's Synced"
            info="Shows which data types are included in your encrypted cloud backup, and whether they've been uploaded to R2 storage. All data is end-to-end encrypted before leaving your device."
          >
            <RowList>
              <CardRow>
                <div className="flex items-center gap-2 min-w-0">
                  <BookmarksIcon size={15} className="text-kumo-subtle flex-shrink-0" />
                  <Text size="sm">Bookmarks</Text>
                  <Badge variant="primary">Active</Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(status?.baseVersion ?? 0) > 0
                    ? <><CheckCircleIcon size={14} className="text-kumo-success" weight="fill" /><Text size="xs" className="text-kumo-success">Uploaded</Text></>
                    : <><WarningCircleIcon size={14} className="text-kumo-warning" weight="fill" /><Text size="xs" className="text-kumo-warning">Not yet uploaded</Text></>
                  }
                </div>
              </CardRow>
              <CardRow>
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontalIcon size={15} className="text-kumo-subtle flex-shrink-0" />
                  <Text size="sm">Raindrop Settings</Text>
                  <Badge variant="primary">Active</Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(status?.baseVersion ?? 0) > 0
                    ? <><CheckCircleIcon size={14} className="text-kumo-success" weight="fill" /><Text size="xs" className="text-kumo-success">Uploaded</Text></>
                    : <><WarningCircleIcon size={14} className="text-kumo-warning" weight="fill" /><Text size="xs" className="text-kumo-warning">Not yet uploaded</Text></>
                  }
                </div>
              </CardRow>
              <CardRow>
                <div className="flex items-center gap-2 min-w-0">
                  <ClockIcon size={15} className="text-kumo-subtle flex-shrink-0" />
                  <Text size="sm" className="text-kumo-subtle">Browser History</Text>
                  <Badge variant="secondary">Coming soon</Badge>
                </div>
                <Text size="xs" variant="secondary">—</Text>
              </CardRow>
              <CardRow>
                <div className="flex items-center gap-2 min-w-0">
                  <PuzzlePieceIcon size={15} className="text-kumo-subtle flex-shrink-0" />
                  <Text size="sm">Extensions</Text>
                  <Badge variant="primary">Active</Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(status?.baseVersion ?? 0) > 0
                    ? <><CheckCircleIcon size={14} className="text-kumo-success" weight="fill" /><Text size="xs" className="text-kumo-success">Uploaded</Text></>
                    : <><WarningCircleIcon size={14} className="text-kumo-warning" weight="fill" /><Text size="xs" className="text-kumo-warning">Not yet uploaded</Text></>
                  }
                </div>
              </CardRow>
            </RowList>
          </SettingsCard>

          {/* Profiles */}
          <SettingsCard
            title="Profiles"
            icon={UserCircleIcon}
            info="Profiles let you maintain completely separate bookmark sets — each syncs independently to the cloud. Switch between them to load a different set of bookmarks into your browser. Useful for separating work, personal, and research contexts."
            action={
              <Dialog.Root>
                <Dialog.Trigger render={<Button variant="secondary" size="sm" icon={PlusIcon}>New Profile</Button>} />
                <Dialog className="p-6 flex flex-col gap-4">
                  <Dialog.Title>Create New Profile</Dialog.Title>
                  <Dialog.Description>Profiles let you maintain separate bookmark sets that sync independently.</Dialog.Description>
                  <Input
                    label="Profile name"
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="e.g. Work, Personal, Research…"
                  />
                  <div className="flex gap-2 justify-end">
                    <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
                    <Dialog.Close
                      render={
                        <Button variant="primary" icon={PlusIcon} loading={profileBusy} onClick={doCreateProfile}>
                          Create
                        </Button>
                      }
                    />
                  </div>
                </Dialog>
              </Dialog.Root>
            }
          >
            <RowList empty={profiles.length === 0
              ? <Text className="text-sm text-kumo-subtle px-1 py-2">No profiles found. Create one above.</Text>
              : undefined
            }>
              {profiles.map(p => (
                <CardRow key={p.id}>
                  <div className="flex items-center gap-2 min-w-0">
                    {p.id === activeProfileId
                      ? <Badge variant="primary">Active</Badge>
                      : <Badge variant="secondary">Inactive</Badge>
                    }
                    {editingProfileId === p.id ? (
                      <Input
                        value={editingProfileName}
                        onChange={e => setEditingProfileName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') doRenameProfile(); if (e.key === 'Escape') { setEditingProfileId(null) } }}
                        className="h-7 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="text-kumo-default truncate">{p.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editingProfileId === p.id ? (
                      <>
                        <Button variant="primary" size="sm" loading={profileBusy} onClick={doRenameProfile}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingProfileId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        {p.id !== activeProfileId && (
                          <Tooltip content={`Switch to "${p.name}" — replaces current browser bookmarks`} side="top">
                            <>
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={profileBusy}
                              onClick={() => doSwitchProfile(p.id, 'replace')}
                            >
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={profileBusy}
                              onClick={() => {
                                if (window.confirm(`Merge this browser's current bookmarks INTO "${p.name}"?\n\nThe two sets will be combined (nothing deleted), and this browser will switch to that profile. An automatic backup is taken first.`)) {
                                  doSwitchProfile(p.id, 'merge')
                                }
                              }}
                            >
                              Merge into
                            </Button>
                            </>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={PencilSimpleIcon}
                          aria-label="Rename"
                          onClick={() => { setEditingProfileId(p.id); setEditingProfileName(p.name) }}
                        />
                        {profiles.length > 1 && p.id !== activeProfileId && (
                          <Dialog.Root role="alertdialog">
                            <Dialog.Trigger render={<Button variant="ghost" size="sm" icon={TrashIcon} aria-label="Delete" />} />
                            <Dialog className="p-6 flex flex-col gap-4" size="sm">
                              <Dialog.Title>Delete "{p.name}"?</Dialog.Title>
                              <Dialog.Description>
                                This will permanently delete this profile and all its bookmarks from the server. This cannot be undone.
                              </Dialog.Description>
                              <div className="flex gap-2 justify-end">
                                <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
                                <Dialog.Close
                                  render={
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      icon={TrashIcon}
                                      loading={profileBusy}
                                      onClick={() => doDeleteProfile(p.id)}
                                    >
                                      Delete
                                    </Button>
                                  }
                                />
                              </div>
                            </Dialog>
                          </Dialog.Root>
                        )}
                      </>
                    )}
                  </div>
                </CardRow>
              ))}
            </RowList>
          </SettingsCard>

          {/* Extensions */}
          <SettingsCard
            title="Extensions"
            icon={PuzzlePieceIcon}
            info="Your installed Chrome extensions are listed here per device. Chrome Web Store extensions can be restored with one click; sideloaded or developer extensions are listed for reference only."
            action={<Button variant="secondary" size="sm" icon={ArrowsClockwiseIcon} loading={busy} onClick={loadExtensions}>{extBlocks ? 'Refresh' : 'Load extensions'}</Button>}
          >
            <div className="rounded-md border border-kumo-line bg-app-bg p-3 flex gap-2 items-start">
              <WarningCircleIcon size={14} className="text-kumo-warning flex-shrink-0 mt-0.5" weight="fill" />
              <Text size="xs" className="text-kumo-subtle leading-relaxed">
                Folio backs up the <em>list</em> of your extensions, not their files. Chrome blocks
                extensions from reading other extensions' files or installing them silently — even
                with a self-hosted backend. To restore, open the Chrome Web Store link next to each
                item and click "Add to Chrome". Sideloaded or developer-mode extensions cannot be
                restored from a backup.
              </Text>
            </div>
            {extBlocks === null ? (
              <Text className="text-sm text-kumo-subtle">Click "Load extensions" to view extension backups across your devices.</Text>
            ) : Object.keys(extBlocks).length === 0 ? (
              <Text className="text-sm text-kumo-subtle">No extension backups yet. Run a sync to capture this device's extensions.</Text>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(extBlocks).map(([devId, block]) => (
                  <div key={devId} className="rounded-lg border border-kumo-line bg-app-bg p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={devId === extDeviceId ? 'primary' : 'secondary'}>
                          {devId === extDeviceId ? 'This device' : block.sourceBrowser || 'device'}
                        </Badge>
                        <Text size="sm" className="text-kumo-subtle">{block.extensions.length} extensions · captured {getTimeAgo(block.capturedAt)}</Text>
                      </div>
                    </div>
                    <RowList>
                      {block.extensions.map(ext => (
                        <CardRow key={`${devId}-${ext.id}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {ext.restorable
                              ? <CheckCircleIcon size={14} className="text-kumo-success flex-shrink-0" weight="fill" />
                              : <WarningCircleIcon size={14} className="text-kumo-warning flex-shrink-0" weight="fill" />}
                            <span className="text-kumo-default truncate">{ext.name}</span>
                            <Text size="xs" variant="secondary" className="flex-shrink-0">v{ext.version}</Text>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ext.restorable && ext.cwsUrl ? (
                              <a href={ext.cwsUrl} target="_blank" rel="noreferrer" className="text-xs text-kumo-brand hover:underline">
                                Install from Web Store
                              </a>
                            ) : (
                              <Tooltip content={ext.reason || 'Cannot restore'} side="left">
                                <Text size="xs" variant="secondary" className="cursor-help">Not restorable</Text>
                              </Tooltip>
                            )}
                          </div>
                        </CardRow>
                      ))}
                    </RowList>
                  </div>
                ))}
              </div>
            )}
          </SettingsCard>

          {/* History */}
          <SettingsCard
            title="Version history"
            icon={ClockCounterClockwiseIcon}
            action={<Button variant="secondary" size="sm" loading={busy} onClick={loadHistory}>Load history</Button>}
          >
            {history === null ? (
              <Text className="text-sm text-kumo-subtle">Click "Load history" to see stored versions on the server.</Text>
            ) : (
              <RowList empty={history.length === 0
                ? <Text className="text-sm text-kumo-subtle">No versions stored yet.</Text>
                : undefined}>
                {history.map(h => (
                  <CardRow key={h.version}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-kumo-default">v{h.version}</span>
                      {h.version === status?.baseVersion && <Badge variant="primary">This browser</Badge>}
                      <span className="text-kumo-subtle text-sm">
                        {(() => {
                          const ts = h.uploaded ? Date.parse(h.uploaded) : h.updatedAt
                          return ts ? `${new Date(ts).toLocaleString()} (${getTimeAgo(ts)})` : ''
                        })()}{h.size ? ` · ${(h.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                    </div>
                    {h.version !== status?.baseVersion && (
                      <Dialog.Root role="alertdialog">
                        <Dialog.Trigger
                          render={
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={DownloadSimpleIcon}
                              loading={restoringVersion === h.version}
                              disabled={restoringVersion !== null && restoringVersion !== h.version}
                            >
                              Restore
                            </Button>
                          }
                        />
                        <Dialog className="p-6 flex flex-col gap-4" size="sm">
                          <Dialog.Title>Restore version {h.version}?</Dialog.Title>
                          <Dialog.Description>
                            This will replace your current bookmarks for the active profile with this older version.
                            Your bookmarks are snapshotted first and rolled back if anything goes wrong.
                            This action cannot be undone after success.
                          </Dialog.Description>
                          <div className="flex gap-2 justify-end">
                            <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
                            <Dialog.Close
                              render={
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  icon={DownloadSimpleIcon}
                                  onClick={() => doRestoreVersion(h.version)}
                                >
                                  Restore
                                </Button>
                              }
                            />
                          </div>
                        </Dialog>
                      </Dialog.Root>
                    )}
                  </CardRow>
                ))}
              </RowList>
            )}
          </SettingsCard>

          {/* Danger zone */}
          <SettingsCard title="This device" bodyClassName="px-6 py-6 flex items-center justify-between gap-4">
            <Text className="text-sm text-kumo-subtle">
              Disable clears the encryption key from this device only. Your data stays on the
              server and on other devices. Re-link any time with your sync key.
            </Text>
            <Button variant="destructive" loading={busy} onClick={doDisable}>Disable here</Button>
          </SettingsCard>
        </>
      )}

    </div>
  )
}
