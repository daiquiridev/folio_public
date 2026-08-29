import { useState, useEffect } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { Checkbox } from '@cloudflare/kumo/components/checkbox'
import { Input } from '@cloudflare/kumo/components/input'
import { Select } from '@cloudflare/kumo/components/select'
import { Switch } from '@cloudflare/kumo/components/switch'
import { Text } from '@cloudflare/kumo/components/text'
import { ArrowsClockwiseIcon, FolderIcon, ListIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { getStorage, setStorage } from '../../lib/chrome'
import { fetchCollections, type RaindropCollection } from '../../lib/raindrop'
import { SettingsCard } from '../components/SettingsCard'
import type { ToastState } from '../OptionsApp'

interface SyncTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

interface BookmarkFolder {
  id: string
  title: string
  depth: number
}

function buildCollectionTree(
  collections: RaindropCollection[],
): RaindropCollection[] {
  const map = new Map<number, RaindropCollection & { children?: RaindropCollection[] }>()
  const roots: (RaindropCollection & { children?: RaindropCollection[] })[] = []

  collections.forEach(c => map.set(c._id, { ...c, children: [] }))
  collections.forEach(c => {
    const parentId = c.parent?.$id
    if (parentId && parentId !== -1 && map.has(parentId)) {
      map.get(parentId)!.children!.push(map.get(c._id)!)
    } else {
      roots.push(map.get(c._id)!)
    }
  })

  const flat: RaindropCollection[] = []
  const walk = (items: typeof roots, depth = 0) => {
    items.forEach(item => {
      flat.push({ ...item, title: '  '.repeat(depth) + item.title })
      if (item.children?.length) walk(item.children, depth + 1)
    })
  }
  walk(roots)
  return flat
}

export function SyncTab({ showToast }: SyncTabProps) {
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [syncInterval, setSyncInterval] = useState('15')
  const [syncMode, setSyncMode] = useState('additions_only')
  const [collectionMode, setCollectionMode] = useState('topLevel')
  const [targetFolderId, setTargetFolderId] = useState('1')
  const [collectionsSort, setCollectionsSort] = useState('alpha_asc')
  const [bookmarksSort, setBookmarksSort] = useState('created_desc')
  const [rateLimitRpm, setRateLimitRpm] = useState('60')
  const [collections, setCollections] = useState<RaindropCollection[]>([])
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set())
  const [collectionsFilter, setCollectionsFilter] = useState('')
  const [browserFolders, setBrowserFolders] = useState<BookmarkFolder[]>([])
  const [isLoadingCollections, setIsLoadingCollections] = useState(false)

  useEffect(() => {
    getStorage([
      'syncEnabled', 'syncIntervalMinutes', 'twoWayMode', 'collectionImportMode',
      'targetFolderId', 'collectionsSort', 'bookmarksSort', 'rateLimitRpm',
      'selectedCollectionIds',
    ]).then(cfg => {
      setSyncEnabled(cfg.syncEnabled ?? true)
      setSyncInterval(String(cfg.syncIntervalMinutes || 15))
      setSyncMode(cfg.twoWayMode || 'additions_only')
      setCollectionMode(cfg.collectionImportMode || 'topLevel')
      setTargetFolderId(String(cfg.targetFolderId || '1'))
      setCollectionsSort(cfg.collectionsSort || 'alpha_asc')
      setBookmarksSort(cfg.bookmarksSort || 'created_desc')
      setRateLimitRpm(String(cfg.rateLimitRpm || 60))
      if (cfg.selectedCollectionIds?.length) {
        setSelectedCollections(new Set(cfg.selectedCollectionIds.map(String)))
      }
    })
    loadBrowserFolders()
  }, [])

  async function loadBrowserFolders() {
    try {
      const tree = await chrome.bookmarks.getTree()
      const folders: BookmarkFolder[] = []
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
    } catch {
      // bookmarks API may not be available in some contexts
    }
  }

  async function loadRaindropCollections() {
    setIsLoadingCollections(true)
    try {
      const { accessToken } = await getStorage(['accessToken'])
      if (!accessToken) {
        showToast('Connect to Raindrop.io first', 'error')
        return
      }
      const items = await fetchCollections(accessToken)
      setCollections(buildCollectionTree(items))
    } catch {
      showToast('Failed to load collections', 'error')
    } finally {
      setIsLoadingCollections(false)
    }
  }

  async function save() {
    await setStorage({
      syncEnabled,
      syncIntervalMinutes: Math.max(1, Number(syncInterval)),
      twoWayMode: syncMode,
      collectionImportMode: collectionMode,
      targetFolderId,
      collectionsSort,
      bookmarksSort,
      rateLimitRpm: Number(rateLimitRpm),
      selectedCollectionIds: Array.from(selectedCollections),
    })
    showToast('Sync settings saved', 'success')
  }

  function toggleCollection(id: string) {
    setSelectedCollections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredCollections = collections.filter(c =>
    c.title.toLowerCase().includes(collectionsFilter.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-8">
      {/* Auto-sync */}
      <SettingsCard
        title="Auto-Sync"
        info="Folio periodically pulls your Raindrop.io bookmarks and merges them into your browser. Enable this to keep bookmarks up to date automatically."
        action={<Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} aria-label="Enable auto-sync" />}
        bodyClassName={`px-6 py-6 flex flex-col gap-5 ${!syncEnabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <Input
          label="Sync Interval (minutes)"
          type="number"
          value={syncInterval}
          onChange={e => setSyncInterval(e.target.value)}
          description={`Bookmarks sync every ${syncInterval} minute${syncInterval !== '1' ? 's' : ''}`}
        />
        <Select
          label="Sync Mode"
          value={syncMode}
          onValueChange={v => setSyncMode(v ?? 'additions_only')}
          items={{
            additions_only: 'Import Only (add from Raindrop)',
            two_way: 'Two-Way Sync',
          }}
        >
          <Select.Option value="additions_only">Import Only (add from Raindrop)</Select.Option>
          <Select.Option value="two_way">Two-Way Sync</Select.Option>
        </Select>
      </SettingsCard>

      {/* Target Folder */}
      <SettingsCard title="Target Folder" icon={FolderIcon}>
        <Select
          label="Sync to this browser folder"
          value={targetFolderId}
          onValueChange={v => setTargetFolderId(v ?? '1')}
          items={Object.fromEntries(browserFolders.map(f => [f.id, '  '.repeat(f.depth) + f.title]))}
        >
          {browserFolders.map(f => (
            <Select.Option key={f.id} value={f.id}>
              {'  '.repeat(f.depth)}{f.title}
            </Select.Option>
          ))}
        </Select>
      </SettingsCard>

      {/* Collections */}
      <SettingsCard
        title="Collections"
        icon={ListIcon}
        info="Choose which Raindrop.io collections sync to your browser. 'Top-level only' imports root collections as folders. 'Custom selection' lets you pick exactly which ones to include."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowsClockwiseIcon}
            loading={isLoadingCollections}
            onClick={loadRaindropCollections}
          >
            Load Collections
          </Button>
        }
        bodyClassName="px-6 py-6 flex flex-col gap-4"
      >
        <Select
          label="Collection Mode"
          value={collectionMode}
          onValueChange={v => setCollectionMode(v ?? 'topLevel')}
          items={{
            topLevel: 'Top-level only',
            all: 'All collections',
            custom: 'Custom selection',
          }}
        >
          <Select.Option value="topLevel">Top-level only</Select.Option>
          <Select.Option value="all">All collections</Select.Option>
          <Select.Option value="custom">Custom selection</Select.Option>
        </Select>

        {collectionMode === 'custom' && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <MagnifyingGlassIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle pointer-events-none z-10" />
              <Input
                aria-label="Search collections"
                placeholder="Search collections…"
                className="pl-9"
                value={collectionsFilter}
                onChange={e => setCollectionsFilter(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCollections(new Set(collections.map(c => String(c._id))))}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCollections(new Set())}>
                Clear
              </Button>
            </div>
            <div className="border border-kumo-line rounded-md max-h-48 overflow-y-auto">
              {filteredCollections.length === 0 ? (
                <Text size="sm" variant="secondary" className="px-4 py-3 block">
                  {collections.length === 0 ? 'Click "Load Collections" to fetch from Raindrop.io' : 'No collections match filter'}
                </Text>
              ) : (
                filteredCollections.map(c => (
                  <div key={c._id} className="flex items-center gap-2 px-4 py-2 hover:bg-kumo-tint">
                    <Checkbox
                      label={c.title}
                      checked={selectedCollections.has(String(c._id))}
                      onCheckedChange={() => toggleCollection(String(c._id))}
                      controlFirst
                    />
                    <span className="ml-auto text-kumo-subtle text-xs flex-shrink-0">{c.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </SettingsCard>

      {/* Sorting */}
      <SettingsCard title="Sorting" bodyClassName="px-6 py-6 grid grid-cols-2 gap-6">
        <Select label="Collections Sort" value={collectionsSort} onValueChange={v => setCollectionsSort(v ?? 'alpha_asc')}
          items={{ alpha_asc: 'A → Z', alpha_desc: 'Z → A', created_desc: 'Newest first' }}>
          <Select.Option value="alpha_asc">A → Z</Select.Option>
          <Select.Option value="alpha_desc">Z → A</Select.Option>
          <Select.Option value="created_desc">Newest first</Select.Option>
        </Select>
        <Select label="Bookmarks Sort" value={bookmarksSort} onValueChange={v => setBookmarksSort(v ?? 'created_desc')}
          items={{ created_desc: 'Newest first', created_asc: 'Oldest first', alpha_asc: 'A → Z' }}>
          <Select.Option value="created_desc">Newest first</Select.Option>
          <Select.Option value="created_asc">Oldest first</Select.Option>
          <Select.Option value="alpha_asc">A → Z</Select.Option>
        </Select>
      </SettingsCard>

      {/* Advanced */}
      <SettingsCard title="Advanced">
        <Input
          label="API Rate Limit (requests/min)"
          type="number"
          value={rateLimitRpm}
          onChange={e => setRateLimitRpm(e.target.value)}
          description="Raindrop.io allows ~120 requests/min on free plans. Lower this if you experience rate limiting."
        />
      </SettingsCard>

      <Button variant="primary" onClick={save}>Save Settings</Button>
    </div>
  )
}
