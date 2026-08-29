import { useState, useEffect } from 'react'
import { Banner } from '@cloudflare/kumo/components/banner'
import { Button } from '@cloudflare/kumo/components/button'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Select } from '@cloudflare/kumo/components/select'
import { Text } from '@cloudflare/kumo/components/text'
import {
  ArrowCounterClockwiseIcon, DownloadIcon, UploadIcon, ArrowsClockwiseIcon,
  TrashIcon, MagnifyingGlassIcon, FolderMinusIcon, BrowsersIcon,
  BroomIcon, FunnelIcon, PlusIcon, XIcon,
} from '@phosphor-icons/react'
import { getStorage, setStorage } from '../../lib/chrome'
import { SettingsCard, RowList, CardRow } from '../components/SettingsCard'
import type { ToastState } from '../OptionsApp'

function toolsSend<T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: `tools.${action}`, ...extra }, (res) => {
      const err = chrome.runtime.lastError
      if (err) return reject(new Error(err.message))
      if (!res?.success) return reject(new Error(res?.error || 'Unknown error'))
      resolve(res.data as T)
    })
  })
}

interface DupItem { id: string; title: string; url: string; dateAdded: number; path: string }
interface DupGroup { url: string; items: DupItem[] }
interface BrokenItem { id: string; title: string; url: string; path: string }
interface TrashItem { key: string; title: string; url: string; path: string; deletedAt: number }
interface Rule { pattern: string; folder: string }

interface ToolsTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

interface BackupEntry {
  key: string
  timestamp: number
  size: number
}

interface BFolder { id: string; title: string; depth: number }
interface ImportItem { title: string; url?: string; children?: ImportItem[] }

export function ToolsTab({ showToast }: ToolsTabProps) {
  const [autoBackups, setAutoBackups] = useState<BackupEntry[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [dupStatus, setDupStatus] = useState('')
  const [isDuplicateScanDone, setIsDuplicateScanDone] = useState(false)
  const [dupGroups, setDupGroups] = useState<DupGroup[] | null>(null)
  const [dupSelected, setDupSelected] = useState<Set<string>>(new Set())
  const [brokenList, setBrokenList] = useState<BrokenItem[] | null>(null)
  const [brokenSelected, setBrokenSelected] = useState<Set<string>>(new Set())
  const [isLinkScanning, setIsLinkScanning] = useState(false)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [backupInterval, setBackupInterval] = useState<string>('12')
  const [scanInterval, setScanInterval] = useState<string>('0')
  const [scheduledReport, setScheduledReport] = useState<{ at: number; count: number } | null>(null)
  const [trash, setTrash] = useState<TrashItem[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [rulePattern, setRulePattern] = useState('')
  const [ruleFolder, setRuleFolder] = useState('')
  const [cleanBusy, setCleanBusy] = useState(false)

  // Import state
  const [browserFolders, setBrowserFolders] = useState<BFolder[]>([])
  const [importTargetId, setImportTargetId] = useState('1')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ count: number; name: string } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Confirm dialog state
  const [pendingRestoreData, setPendingRestoreData] = useState<chrome.bookmarks.BookmarkTreeNode[] | null>(null)
  const [confirmLastBackupOpen, setConfirmLastBackupOpen] = useState(false)
  const [confirmCleanFoldersOpen, setConfirmCleanFoldersOpen] = useState(false)

  useEffect(() => {
    loadAutoBackups()
    loadBrowserFolders()
    loadTrash()
    loadRules()
    // Zamanlanmış tarama raporu — açılınca rozet de temizlenir
    toolsSend<{ report: { at: number; broken: BrokenItem[] } | null; intervalHours: number }>('getDeadLinkReport')
      .then(r => {
        setScanInterval(String(r.intervalHours || 0))
        if (r.report) setScheduledReport({ at: r.report.at, count: r.report.broken.length })
      })
      .catch(() => {})
  }, [])

  async function loadTrash() {
    try {
      const r = await toolsSend<{ items: TrashItem[] }>('listTrash')
      setTrash(r.items)
    } catch {}
  }

  async function loadRules() {
    try {
      const r = await toolsSend<{ rules: Rule[] }>('getRules')
      setRules(r.rules)
    } catch {}
  }

  async function loadAutoBackups() {
    try {
      const all = await chrome.storage.local.get(null)
      const backups: BackupEntry[] = Object.entries(all)
        .filter(([k]) => k.startsWith('autoBackup_'))
        .map(([k, v]) => ({
          key: k,
          timestamp: (v as { timestamp?: number }).timestamp || 0,
          size: JSON.stringify(v).length,
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
      setAutoBackups(backups)
    } catch {
      showToast('Failed to load backups', 'error')
    }
  }

  async function loadBrowserFolders() {
    try {
      const tree = await chrome.bookmarks.getTree()
      const folders: BFolder[] = []
      const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], depth = 0) => {
        nodes.forEach(n => {
          if (!n.url) {
            folders.push({ id: n.id, title: n.title || 'Bookmarks', depth })
            if (n.children) walk(n.children, depth + 1)
          }
        })
      }
      walk(tree)
      setBrowserFolders(folders)
    } catch {}
  }

  // ── Restore helpers ──────────────────────────────────────────────────────

  async function createFromBackup(
    items: chrome.bookmarks.BookmarkTreeNode[],
    parentId: string,
  ): Promise<void> {
    for (const item of items) {
      if (item.url) {
        await chrome.bookmarks.create({ parentId, title: item.title, url: item.url })
      } else {
        const folder = await chrome.bookmarks.create({ parentId, title: item.title })
        if (item.children?.length) await createFromBackup(item.children, folder.id)
      }
    }
  }

  async function performRestore(data: chrome.bookmarks.BookmarkTreeNode[]): Promise<void> {
    // Toplu silme/oluşturma fırtınası: auto-rules ve çöp kaydedici sussun.
    await toolsSend('setBulk', { on: true }).catch(() => {})
    try {
      await performRestoreInner(data)
    } finally {
      await toolsSend('setBulk', { on: false }).catch(() => {})
    }
  }

  async function performRestoreInner(data: chrome.bookmarks.BookmarkTreeNode[]): Promise<void> {
    const backupRoots = data.length === 1 && data[0].id === '0'
      ? (data[0].children || [])
      : data

    const currentTree = await chrome.bookmarks.getTree()
    const currentRoots = currentTree[0]?.children || []

    for (const backupRoot of backupRoots) {
      const currentRoot = currentRoots.find(
        r => r.id === backupRoot.id || r.title === backupRoot.title,
      )
      if (!currentRoot) continue

      for (const child of currentRoot.children || []) {
        try {
          if (child.url) await chrome.bookmarks.remove(child.id)
          else await chrome.bookmarks.removeTree(child.id)
        } catch {}
      }

      await createFromBackup(backupRoot.children || [], currentRoot.id)
    }
  }

  // ── Backup / Restore ─────────────────────────────────────────────────────

  async function createBackup() {
    try {
      const tree = await chrome.bookmarks.getTree()
      const key = `autoBackup_${Date.now()}`
      await chrome.storage.local.set({ [key]: { timestamp: Date.now(), data: tree } })
      await setStorage({ lastBackupTime: Date.now() })
      showToast('Backup created successfully', 'success')
      loadAutoBackups()
    } catch (e: unknown) {
      showToast('Backup failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    }
  }

  async function downloadBackup() {
    try {
      const tree = await chrome.bookmarks.getTree()
      const blob = new Blob(
        [JSON.stringify({ timestamp: Date.now(), data: tree }, null, 2)],
        { type: 'application/json' },
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `folio-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      showToast('Download failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    }
  }

  /** Chrome'un kendi Bookmarks/Bookmarks.bak formatını Folio'nun beklediği
      BookmarkTreeNode köklerine çevirir ({roots:{bookmark_bar,other,synced}}). */
  function convertChromeNativeFormat(raw: unknown): chrome.bookmarks.BookmarkTreeNode[] | null {
    const roots = (raw as { roots?: Record<string, unknown> })?.roots
    if (!roots || typeof roots !== 'object') return null
    interface NativeNode { type?: string; name?: string; url?: string; children?: NativeNode[] }
    const mapNode = (n: NativeNode): chrome.bookmarks.BookmarkTreeNode => ({
      id: '', title: n.name || '',
      ...(n.type === 'url' ? { url: n.url } : { children: (n.children || []).map(mapNode) }),
    } as chrome.bookmarks.BookmarkTreeNode)
    const ROOT_IDS: Record<string, string> = { bookmark_bar: '1', other: '2', synced: '3' }
    const out: chrome.bookmarks.BookmarkTreeNode[] = []
    for (const [key, val] of Object.entries(roots)) {
      const id = ROOT_IDS[key]
      if (!id || !val || typeof val !== 'object') continue
      const mapped = mapNode(val as NativeNode)
      out.push({ ...mapped, id } as chrome.bookmarks.BookmarkTreeNode)
    }
    return out.length ? out : null
  }

  function triggerRestoreFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const backup = JSON.parse(text)
        // Kabul edilen formatlar: Folio yedeği ({data:[tree]}), çıplak tree
        // dizisi, ya da Chrome'un kendi Bookmarks(.bak) dosyası ({roots:{…}}).
        const native = convertChromeNativeFormat(backup)
        const data: chrome.bookmarks.BookmarkTreeNode[] = native
          || (Array.isArray(backup.data) ? backup.data : Array.isArray(backup) ? backup : [])
        if (!data.length) throw new Error('Unrecognized backup format')
        setPendingRestoreData(data)
      } catch (err: unknown) {
        showToast('Failed to read file: ' + (err instanceof Error ? err.message : 'Invalid file'), 'error')
      }
    }
    input.click()
  }

  async function executeRestoreFile() {
    if (!pendingRestoreData) return
    const data = pendingRestoreData
    setPendingRestoreData(null)
    showToast('Restoring bookmarks…', 'info')
    try {
      // Restore, bookmark event fırtınası yaratır — cloud sync o sırada
      // buluttaki (muhtemelen bozuk) hali geri merge etmesin diye duraklat.
      await new Promise(res => chrome.runtime.sendMessage({ action: 'cloudBackup.setEnabled', enabled: false }, res))
      await performRestore(data)
      showToast('Bookmarks restored. Cloud auto-sync is PAUSED — go to Cloud Sync and Upload to overwrite the cloud with this clean state, then re-enable sync.', 'success')
    } catch (err: unknown) {
      showToast('Restore failed: ' + (err instanceof Error ? err.message : 'Invalid file'), 'error')
    }
  }

  async function restoreLastBackup() {
    if (autoBackups.length === 0) {
      showToast('No auto-backups found', 'error')
      return
    }
    setConfirmLastBackupOpen(true)
  }

  async function executeRestoreLastBackup() {
    setConfirmLastBackupOpen(false)
    const latest = autoBackups[0]
    const stored = await chrome.storage.local.get(latest.key)
    const data: chrome.bookmarks.BookmarkTreeNode[] = stored[latest.key]?.data
    if (!data) {
      showToast('Backup data not found', 'error')
      return
    }
    try {
      showToast('Restoring bookmarks…', 'info')
      await performRestore(data)
      showToast('Bookmarks restored', 'success')
    } catch (e: unknown) {
      showToast('Restore failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    }
  }

  async function clearOldBackups() {
    const toDelete = autoBackups.slice(5)
    if (toDelete.length === 0) {
      showToast('No old backups to clear', 'info')
      return
    }
    await chrome.storage.local.remove(toDelete.map(b => b.key))
    showToast(`Cleared ${toDelete.length} old backup(s)`, 'success')
    loadAutoBackups()
  }

  // ── Import from browser ───────────────────────────────────────────────────

  function parseNetscapeHTML(html: string): ImportItem[] {
    const doc = new DOMParser().parseFromString(html, 'text/html')

    // Netscape bookmark files never close <DT>. The browser's HTML parser only
    // auto-closes a <dt> when it hits another <dt>/<dd> — not for the <h3> or
    // <dl> that follow it — so a folder's <h3> and its nested <dl> both end up
    // as *children* of that <dt> (not as its siblings). Look for both shapes:
    // nested under the <dt> (what every real export produces) and, as a
    // fallback, as its next sibling (in case the input was properly closed).
    function parseDL(dl: Element): ImportItem[] {
      const items: ImportItem[] = []
      for (const el of Array.from(dl.children)) {
        if (el.tagName !== 'DT') continue
        const a = el.querySelector(':scope > a')
        const h3 = el.querySelector(':scope > h3')
        if (a) {
          const url = a.getAttribute('href') || ''
          if (url && !url.startsWith('place:') && !url.startsWith('about:')) {
            items.push({ title: a.textContent?.trim() || url, url })
          }
        } else if (h3) {
          const nestedDl = el.querySelector(':scope > dl')
            || (el.nextElementSibling?.tagName === 'DL' ? el.nextElementSibling : null)
          const nested = nestedDl ? parseDL(nestedDl) : []
          items.push({ title: h3.textContent?.trim() || 'Folder', children: nested })
        }
      }
      return items
    }

    const rootDL = doc.querySelector('dl')
    return rootDL ? parseDL(rootDL) : []
  }

  async function createFromImport(items: ImportItem[], parentId: string): Promise<number> {
    let count = 0
    for (const item of items) {
      if (item.url) {
        await chrome.bookmarks.create({ parentId, title: item.title, url: item.url })
        count++
      } else {
        const folder = await chrome.bookmarks.create({ parentId, title: item.title })
        if (item.children?.length) count += await createFromImport(item.children, folder.id)
      }
    }
    return count
  }

  function importFromBrowser() {
    setImportResult(null)
    setImportError(null)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setIsImporting(true)
      try {
        const text = await file.text()
        let items: ImportItem[]

        if (file.name.toLowerCase().endsWith('.json')) {
          const backup = JSON.parse(text)
          const data: chrome.bookmarks.BookmarkTreeNode[] = backup.data || backup
          const roots = data.length === 1 && data[0].id === '0'
            ? (data[0].children || [])
            : data
          function convertNode(n: chrome.bookmarks.BookmarkTreeNode): ImportItem {
            return n.url
              ? { title: n.title, url: n.url }
              : { title: n.title, children: (n.children || []).map(convertNode) }
          }
          items = roots.flatMap(r => (r.children || []).map(convertNode))
        } else {
          items = parseNetscapeHTML(text)
        }

        const folderName = `Imported — ${file.name.replace(/\.[^.]+$/, '')} — ${new Date().toLocaleDateString()}`
        // Toplu import sırasında auto-rules devreye girip öğeleri klasörden
        // kaçırmasın, çöp kaydedici de dolup taşmasın.
        await toolsSend('setBulk', { on: true }).catch(() => {})
        let count = 0
        try {
          const folder = await chrome.bookmarks.create({ parentId: importTargetId, title: folderName })
          count = await createFromImport(items, folder.id)
        } finally {
          await toolsSend('setBulk', { on: false }).catch(() => {})
        }
        setImportResult({ count, name: folderName })
        showToast(`Imported ${count} bookmarks`, 'success')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setImportError(msg)
        showToast('Import failed: ' + msg, 'error')
      } finally {
        setIsImporting(false)
      }
    }
    input.click()
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  async function scanDuplicates() {
    setIsScanning(true)
    setDupStatus('Scanning...')
    setIsDuplicateScanDone(false)
    setDupGroups(null)
    try {
      const r = await toolsSend<{ groups: DupGroup[]; total: number }>('findDuplicates')
      setDupGroups(r.groups)
      // Default selection: everything EXCEPT the oldest copy in each group —
      // the safe "keep the original" choice, user can adjust before deleting.
      const sel = new Set<string>()
      for (const g of r.groups) g.items.slice(1).forEach(i => sel.add(i.id))
      setDupSelected(sel)
      setDupStatus(r.groups.length > 0
        ? `Found ${r.groups.length} duplicated URL(s) across ${r.total} bookmarks`
        : 'No duplicates found')
      setIsDuplicateScanDone(true)
    } catch (e: unknown) {
      setDupStatus('Scan failed: ' + (e instanceof Error ? e.message : 'Unknown'))
    } finally {
      setIsScanning(false)
    }
  }

  async function deleteDupSelected() {
    if (!dupSelected.size) { showToast('Nothing selected', 'info'); return }
    try {
      const r = await toolsSend<{ removed: number }>('removeBookmarks', { ids: [...dupSelected] })
      showToast(`Removed ${r.removed} duplicate bookmarks`, 'success')
      await scanDuplicates()
    } catch (e) {
      showToast('Delete failed: ' + (e instanceof Error ? e.message : ''), 'error')
    }
  }

  async function scanDeadLinks() {
    setIsLinkScanning(true)
    setBrokenList(null)
    try {
      const r = await toolsSend<{ broken: BrokenItem[]; scanned: number }>('checkLinks')
      setBrokenList(r.broken)
      setBrokenSelected(new Set(r.broken.map(b => b.id)))
      showToast(r.broken.length
        ? `${r.broken.length} unreachable bookmarks (of ${r.scanned} scanned)`
        : `All ${r.scanned} scanned bookmarks are reachable`, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast(msg === 'requires_pro'
        ? 'Dead-link checking is a Pro feature — see the Plan & License tab.'
        : 'Scan failed: ' + msg, msg === 'requires_pro' ? 'info' : 'error')
    } finally {
      setIsLinkScanning(false)
    }
  }

  async function deleteBrokenSelected() {
    if (!brokenSelected.size) { showToast('Nothing selected', 'info'); return }
    try {
      const r = await toolsSend<{ removed: number }>('removeBookmarks', { ids: [...brokenSelected] })
      showToast(`Removed ${r.removed} dead bookmarks`, 'success')
      setBrokenList(null)
    } catch (e) {
      showToast('Delete failed: ' + (e instanceof Error ? e.message : ''), 'error')
    }
  }

  useEffect(() => {
    toolsSend<{ hours: number }>('getAutoBackupInterval')
      .then(r => setBackupInterval(String(r.hours)))
      .catch(() => showToast('Could not load the auto-backup setting', 'error'))
  }, [])

  async function changeBackupInterval(hours: string) {
    const previous = backupInterval
    setBackupInterval(hours)
    try {
      await toolsSend('setAutoBackupInterval', { hours: Number(hours) })
      showToast(Number(hours) > 0
        ? `Automatic backups every ${hours} hours (last 5 kept). One was just taken.`
        : 'Automatic backups turned off', 'success')
      loadAutoBackups()
    } catch (e) {
      setBackupInterval(previous)
      showToast('Saving the backup frequency failed: ' + (e instanceof Error ? e.message : ''), 'error')
    }
  }

  async function saveSession() {
    setSessionBusy(true)
    try {
      const r = await toolsSend<{ saved: number; folder: string }>('saveSession')
      showToast(`Saved ${r.saved} tabs into Sessions / ${r.folder}`, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast(msg === 'requires_pro'
        ? 'Session saving is a Pro feature — see the Plan & License tab.'
        : msg === 'no_tabs' ? 'No web pages open in this window' : 'Save failed: ' + msg,
        msg === 'requires_pro' ? 'info' : 'error')
    } finally {
      setSessionBusy(false)
    }
  }

  async function exportHtml() {
    const tree = await chrome.bookmarks.getTree()
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    let out = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n'
    const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], depth: number) => {
      const pad = '    '.repeat(depth)
      for (const n of nodes) {
        if (n.url) out += `${pad}<DT><A HREF="${esc(n.url)}" ADD_DATE="${Math.floor((n.dateAdded || 0) / 1000)}">${esc(n.title || n.url)}</A>\n`
        else if (n.children) {
          if (n.title) out += `${pad}<DT><H3>${esc(n.title)}</H3>\n${pad}<DL><p>\n`
          walk(n.children, n.title ? depth + 1 : depth)
          if (n.title) out += `${pad}</DL><p>\n`
        }
      }
    }
    walk(tree, 1)
    out += '</DL><p>\n'
    const blob = new Blob([out], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `folio-bookmarks-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('Bookmarks exported as HTML', 'success')
  }

  function cleanEmptyFolders() {
    setConfirmCleanFoldersOpen(true)
  }

  async function executeCleanEmptyFolders() {
    setConfirmCleanFoldersOpen(false)
    try {
      const tree = await chrome.bookmarks.getTree()
      let removed = 0
      const walk = async (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
        for (const n of nodes) {
          if (n.children) await walk(n.children)
          if (!n.url && n.children?.length === 0 && n.parentId) {
            try { await chrome.bookmarks.remove(n.id); removed++ } catch {}
          }
        }
      }
      await walk(tree)
      showToast(`Removed ${removed} empty folder(s)`, 'success')
    } catch (e: unknown) {
      showToast('Failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    }
  }

  // ── Trash / rules / tracking-clean / scheduled scan ──────────────────────

  async function restoreFromTrash(key: string) {
    try {
      await toolsSend('restoreTrash', { key })
      showToast('Restored into the "Restored" folder', 'success')
      loadTrash()
    } catch (e) {
      showToast('Restore failed: ' + (e instanceof Error ? e.message : ''), 'error')
    }
  }

  async function clearTrash() {
    try {
      await toolsSend('clearTrash')
      setTrash([])
      showToast('Trash emptied', 'success')
    } catch {}
  }

  async function addRule() {
    const pattern = rulePattern.trim()
    const folder = ruleFolder.trim()
    if (!pattern || !folder) { showToast('Both a pattern and a folder name are needed', 'info'); return }
    try {
      const next = [...rules, { pattern, folder }]
      const r = await toolsSend<{ rules: Rule[] }>('setRules', { rules: next })
      setRules(r.rules)
      setRulePattern(''); setRuleFolder('')
      showToast('Rule added — it applies to newly saved bookmarks', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast(msg === 'requires_pro'
        ? 'Auto-rules are a Pro feature — see the Plan & License tab.'
        : 'Failed: ' + msg, msg === 'requires_pro' ? 'info' : 'error')
    }
  }

  async function removeRule(idx: number) {
    try {
      const next = rules.filter((_, i) => i !== idx)
      const r = await toolsSend<{ rules: Rule[] }>('setRules', { rules: next })
      setRules(r.rules)
    } catch {}
  }

  async function cleanTracking() {
    setCleanBusy(true)
    try {
      const r = await toolsSend<{ cleaned: number; scanned: number }>('cleanTrackingParams')
      showToast(r.cleaned
        ? `Removed tracking parameters (utm, fbclid, gclid…) from ${r.cleaned} bookmarks`
        : `No tracking parameters found in ${r.scanned} candidate URLs`, 'success')
    } catch (e) {
      showToast('Failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally {
      setCleanBusy(false)
    }
  }

  async function changeScanInterval(hours: string) {
    setScanInterval(hours)
    try {
      await toolsSend('setDeadLinkScanInterval', { hours: Number(hours) })
      showToast(Number(hours) > 0
        ? `Scheduled scan every ${Number(hours) >= 24 ? Number(hours) / 24 + ' day(s)' : hours + 'h'} — broken count appears as a badge on the Folio icon`
        : 'Scheduled scanning turned off', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'requires_pro') {
        setScanInterval('0')
        showToast('Scheduled scanning is a Pro feature — see the Plan & License tab.', 'info')
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">

      {/* Import from Another Browser */}
      <SettingsCard title="Import from Another Browser" icon={BrowsersIcon}>
        <Text size="sm" variant="secondary">
          Export bookmarks from Chrome, Firefox, Edge, or Safari as a <code className="font-mono text-xs bg-kumo-recessed px-1 py-0.5 rounded">.html</code> file
          (Settings → Bookmarks → Export), then import here. They'll be placed in a new folder so your existing bookmarks are untouched.
        </Text>
        <Select
          label="Import into folder"
          value={importTargetId}
          onValueChange={v => setImportTargetId(v ?? '1')}
          items={Object.fromEntries(browserFolders.map(f => [f.id, '  '.repeat(f.depth) + f.title]))}
        >
          {browserFolders.map(f => (
            <Select.Option key={f.id} value={f.id}>
              {'  '.repeat(f.depth)}{f.title}
            </Select.Option>
          ))}
        </Select>
        <div>
          <Button variant="primary" icon={UploadIcon} loading={isImporting} onClick={importFromBrowser}>
            Choose File & Import
          </Button>
        </div>
        {importResult && (
          <Banner className="border-kumo-success/50 bg-kumo-success-tint/30 text-kumo-success">
            Imported {importResult.count} bookmarks into &ldquo;{importResult.name}&rdquo;
          </Banner>
        )}
        {importError && (
          <Banner variant="error">{importError}</Banner>
        )}
      </SettingsCard>

      {/* Backup & Restore */}
      <SettingsCard title="Backup & Restore" bodyClassName="px-6 py-6 flex flex-col gap-6">
        <div>
          <Text size="sm" className="font-medium mb-3">Manual Backup</Text>
          <div className="flex gap-2">
            <Button variant="primary" icon={DownloadIcon} onClick={createBackup}>Create Backup Now</Button>
            <Button variant="secondary" icon={DownloadIcon} onClick={downloadBackup}>Download JSON</Button>
          </div>
          <Text size="xs" variant="secondary" className="mt-2">Create a full backup of your current bookmarks.</Text>
        </div>

        <div>
          <Text size="sm" className="font-medium mb-3">Restore</Text>
          <div className="flex gap-2">
            <Button variant="secondary" icon={UploadIcon} onClick={triggerRestoreFile}>Restore from File</Button>
            <Button variant="secondary" icon={ArrowCounterClockwiseIcon} onClick={restoreLastBackup}>Restore Last Auto-Backup</Button>
          </div>
          <Text size="xs" variant="secondary" className="mt-2">Replaces bookmarks from a backup. Existing bookmarks will be overwritten.</Text>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Text size="sm" className="font-medium">Auto-Backups</Text>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={ArrowsClockwiseIcon} onClick={loadAutoBackups}>Refresh</Button>
              <Button variant="ghost" size="sm" icon={TrashIcon} onClick={clearOldBackups}>Clear Old</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Text size="sm" variant="secondary">Frequency:</Text>
            {['0', '6', '12', '24'].map(h => (
              <button
                key={h}
                data-active={backupInterval === h}
                className="riso-nav-item px-2.5 py-1 text-xs"
                onClick={() => changeBackupInterval(h)}
              >
                {h === '0' ? 'Off' : `${h}h`}
              </button>
            ))}
          </div>
          <RowList empty={autoBackups.length === 0
            ? <Text size="sm" variant="secondary" className="px-1 py-2">No automatic backups yet — one is taken within 5 minutes of enabling, then on schedule and before profile operations.</Text>
            : undefined}>
            {autoBackups.map(b => (
              <CardRow key={b.key}>
                <span className="text-kumo-default">{new Date(b.timestamp).toLocaleString()}</span>
                <span className="text-kumo-subtle">{(b.size / 1024).toFixed(1)} KB</span>
              </CardRow>
            ))}
          </RowList>
        </div>
      </SettingsCard>

      {/* Cleanup Tools */}
      <SettingsCard title="Cleanup Tools">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Button variant="primary" icon={MagnifyingGlassIcon} className="w-full" loading={isScanning} onClick={scanDuplicates}>
              Scan for Duplicates
            </Button>
            <Text size="xs" variant="secondary" className="mt-2">Find duplicate bookmarks by URL.</Text>
          </div>
          <div>
            <Button variant="secondary" icon={FolderMinusIcon} className="w-full" onClick={cleanEmptyFolders}>
              Clean Empty Folders
            </Button>
            <Text size="xs" variant="secondary" className="mt-2">Remove folders that contain no bookmarks.</Text>
          </div>
          <div>
            <Button variant="secondary" icon={BroomIcon} className="w-full" loading={cleanBusy} onClick={cleanTracking}>
              Strip Tracking Params
            </Button>
            <Text size="xs" variant="secondary" className="mt-2">Remove utm_*, fbclid, gclid and similar junk from bookmark URLs.</Text>
          </div>
        </div>
        {dupStatus && (
          <Banner variant={
            dupStatus.startsWith('Scan failed') ? 'error' :
            dupStatus.startsWith('Found') ? 'alert' :
            'default'
          }>
            {dupStatus}
          </Banner>
        )}
        {dupGroups && dupGroups.length > 0 && (
          <div className="flex flex-col gap-2">
            <Text size="sm" variant="secondary">
              The oldest copy of each URL is kept unchecked (the "original"). Adjust, then delete.
            </Text>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {dupGroups.map((g, gi) => (
                <div key={gi} className="rounded-lg border border-app-border bg-app-bg px-3 py-2">
                  <Text size="xs" className="text-kumo-subtle truncate block">{g.url}</Text>
                  {g.items.map(it => (
                    <label key={it.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dupSelected.has(it.id)}
                        onChange={() => setDupSelected(sel => {
                          const next = new Set(sel)
                          if (next.has(it.id)) next.delete(it.id); else next.add(it.id)
                          return next
                        })}
                      />
                      <span className="truncate text-kumo-default">{it.title}</span>
                      <span className="text-kumo-subtle text-xs truncate">{it.path}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <Button variant="destructive" size="sm" className="self-start" onClick={deleteDupSelected}>
              Delete selected ({dupSelected.size})
            </Button>
          </div>
        )}
      </SettingsCard>

      {/* Dead links (Pro) */}
      <SettingsCard
        title="Dead Link Checker"
        info="Connection-level check: flags bookmarks whose host no longer resolves or accepts connections. Individual 404 pages can't be detected without broad site permissions."
        action={
          <Button variant="secondary" size="sm" loading={isLinkScanning} onClick={scanDeadLinks}>
            Scan links
          </Button>
        }
      >
        <Text size="sm" variant="secondary">
          Finds bookmarks pointing at dead sites (up to 800 checked per run). Pro feature.
        </Text>
        <div className="flex items-center gap-2">
          <Text size="sm" variant="secondary">Scheduled scan:</Text>
          {[['0', 'Off'], ['24', 'Daily'], ['168', 'Weekly']].map(([h, label]) => (
            <button
              key={h}
              data-active={scanInterval === h}
              className="riso-nav-item px-2.5 py-1 text-xs"
              onClick={() => changeScanInterval(h)}
            >
              {label}
            </button>
          ))}
        </div>
        {scheduledReport && (
          <Banner variant={scheduledReport.count ? 'alert' : 'default'}>
            Last scheduled scan ({new Date(scheduledReport.at).toLocaleString()}) found {scheduledReport.count} unreachable bookmark(s).
            {scheduledReport.count > 0 && ' Run "Scan links" to review and clean them.'}
          </Banner>
        )}
        {brokenList && brokenList.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
              {brokenList.map(b => (
                <label key={b.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brokenSelected.has(b.id)}
                    onChange={() => setBrokenSelected(sel => {
                      const next = new Set(sel)
                      if (next.has(b.id)) next.delete(b.id); else next.add(b.id)
                      return next
                    })}
                  />
                  <span className="truncate text-kumo-default">{b.title}</span>
                  {/^https?:\/\//i.test(b.url) ? (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={e => e.stopPropagation()}
                      className="text-kumo-link text-xs truncate underline decoration-dotted hover:decoration-solid"
                      title="Open in a new tab to verify — some sites block automated checks but load fine for humans"
                    >{b.url}</a>
                  ) : (
                    <span className="text-kumo-subtle text-xs truncate">{b.url}</span>
                  )}
                </label>
              ))}
            </div>
            <Button variant="destructive" size="sm" className="self-start" onClick={deleteBrokenSelected}>
              Delete selected ({brokenSelected.size})
            </Button>
          </div>
        )}
        {brokenList && brokenList.length === 0 && (
          <Banner variant="default">No unreachable bookmarks found.</Banner>
        )}
      </SettingsCard>

      {/* Trash — deleted bookmarks, 30-day local retention */}
      <SettingsCard
        title="Trash"
        icon={TrashIcon}
        info="Bookmarks deleted from this browser are kept here for 30 days (locally, max 500). Deletions applied by cloud sync or bulk restores are not recorded."
        action={trash.length > 0 ? (
          <Button variant="ghost" size="sm" icon={TrashIcon} onClick={clearTrash}>Empty trash</Button>
        ) : undefined}
      >
        <RowList empty={trash.length === 0
          ? <Text size="sm" variant="secondary" className="px-1 py-2">Nothing here — deleted bookmarks will appear for 30 days so you can undo mistakes.</Text>
          : undefined}>
          {trash.slice(0, 50).map(t => (
            <CardRow key={t.key}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-kumo-default">{t.title}</div>
                <div className="truncate text-xs text-kumo-subtle">{t.url}</div>
              </div>
              <span className="text-xs text-kumo-subtle shrink-0">{new Date(t.deletedAt).toLocaleDateString()}</span>
              <Button variant="secondary" size="sm" icon={ArrowCounterClockwiseIcon} onClick={() => restoreFromTrash(t.key)}>
                Restore
              </Button>
            </CardRow>
          ))}
        </RowList>
        {trash.length > 50 && (
          <Text size="xs" variant="secondary">Showing the 50 most recent of {trash.length} items.</Text>
        )}
      </SettingsCard>

      {/* Auto-rules (Pro) */}
      <SettingsCard
        title="Auto-Rules"
        icon={FunnelIcon}
        info='Newly saved bookmarks whose URL matches a pattern are moved into the target folder automatically. Plain text matches as "contains"; wrap in /slashes/ for a regular expression.'
      >
        <Text size="sm" variant="secondary">
          Route new bookmarks into folders automatically — e.g. pattern <code className="font-mono text-xs bg-kumo-recessed px-1 py-0.5 rounded">github.com</code> →
          folder <code className="font-mono text-xs bg-kumo-recessed px-1 py-0.5 rounded">Dev</code>. Pro feature.
        </Text>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-kumo-subtle block mb-1">URL pattern</label>
            <input
              type="text"
              value={rulePattern}
              onChange={e => setRulePattern(e.target.value)}
              placeholder="github.com or /docs?\./"
              className="w-full text-sm px-3 py-2 rounded-lg border-2 border-kumo-hairline bg-kumo-base"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-kumo-subtle block mb-1">Move into folder</label>
            <input
              type="text"
              value={ruleFolder}
              onChange={e => setRuleFolder(e.target.value)}
              placeholder="Dev"
              className="w-full text-sm px-3 py-2 rounded-lg border-2 border-kumo-hairline bg-kumo-base"
            />
          </div>
          <Button variant="primary" icon={PlusIcon} onClick={addRule}>Add rule</Button>
        </div>
        <RowList empty={rules.length === 0
          ? <Text size="sm" variant="secondary" className="px-1 py-2">No rules yet.</Text>
          : undefined}>
          {rules.map((r, i) => (
            <CardRow key={i}>
              <span className="font-mono text-xs truncate">{r.pattern}</span>
              <span className="text-kumo-subtle shrink-0">→</span>
              <span className="truncate flex-1">{r.folder}</span>
              <Button variant="ghost" size="sm" shape="square" icon={XIcon} aria-label="Remove rule" onClick={() => removeRule(i)} />
            </CardRow>
          ))}
        </RowList>
      </SettingsCard>

      {/* Sessions (Pro) + Export (free) */}
      <SettingsCard title="Sessions & Export">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Button variant="primary" className="w-full" loading={sessionBusy} onClick={saveSession}>
              Save current session
            </Button>
            <Text size="xs" variant="secondary" className="mt-2">
              Bookmarks every open tab in this window under Sessions / date. Pro feature.
            </Text>
          </div>
          <div>
            <Button variant="secondary" className="w-full" onClick={exportHtml}>
              Export bookmarks (.html)
            </Button>
            <Text size="xs" variant="secondary" className="mt-2">
              Standard Netscape format — importable by every browser. Free, always.
            </Text>
          </div>
        </div>
      </SettingsCard>

      {/* Confirmation dialogs */}

      {/* Restore from file */}
      <Dialog.Root
        role="alertdialog"
        open={!!pendingRestoreData}
        onOpenChange={open => { if (!open) setPendingRestoreData(null) }}
      >
        <Dialog className="p-6 flex flex-col gap-4" size="sm">
          <Dialog.Title>Restore from file?</Dialog.Title>
          <Dialog.Description>
            This will replace your current bookmarks with the contents of the selected file. This cannot be undone.
          </Dialog.Description>
          <div className="flex gap-2 justify-end">
            <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
            <Dialog.Close render={
              <Button variant="destructive" size="sm" icon={UploadIcon} onClick={executeRestoreFile}>
                Restore
              </Button>
            } />
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Restore last auto-backup */}
      <Dialog.Root
        role="alertdialog"
        open={confirmLastBackupOpen}
        onOpenChange={setConfirmLastBackupOpen}
      >
        <Dialog className="p-6 flex flex-col gap-4" size="sm">
          <Dialog.Title>Restore last auto-backup?</Dialog.Title>
          <Dialog.Description>
            This will replace your current bookmarks with the last auto-backup
            {autoBackups[0] ? ` from ${new Date(autoBackups[0].timestamp).toLocaleString()}` : ''}. This cannot be undone.
          </Dialog.Description>
          <div className="flex gap-2 justify-end">
            <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
            <Dialog.Close render={
              <Button variant="destructive" size="sm" icon={ArrowCounterClockwiseIcon} onClick={executeRestoreLastBackup}>
                Restore
              </Button>
            } />
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Clean empty folders */}
      <Dialog.Root
        role="alertdialog"
        open={confirmCleanFoldersOpen}
        onOpenChange={setConfirmCleanFoldersOpen}
      >
        <Dialog className="p-6 flex flex-col gap-4" size="sm">
          <Dialog.Title>Remove all empty folders?</Dialog.Title>
          <Dialog.Description>
            This will permanently delete all bookmark folders that contain no bookmarks. This cannot be undone.
          </Dialog.Description>
          <div className="flex gap-2 justify-end">
            <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
            <Dialog.Close render={
              <Button variant="destructive" size="sm" icon={FolderMinusIcon} onClick={executeCleanEmptyFolders}>
                Remove
              </Button>
            } />
          </div>
        </Dialog>
      </Dialog.Root>

    </div>
  )
}
