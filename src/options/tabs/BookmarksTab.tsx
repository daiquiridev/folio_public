import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Input } from '@cloudflare/kumo/components/input'
import { Text } from '@cloudflare/kumo/components/text'
import {
  FolderIcon, FolderOpenIcon, LinkIcon, TrashIcon, PencilIcon,
  MagnifyingGlassIcon, CaretRightIcon, FolderPlusIcon, XIcon,
  BookmarksIcon, DotsSixVerticalIcon, ArrowSquareOutIcon, SparkleIcon,
  WarningCircleIcon, CopySimpleIcon, FolderSimpleMinusIcon, CheckCircleIcon,
} from '@phosphor-icons/react'
import type { ToastState } from '../OptionsApp'

type BNode = chrome.bookmarks.BookmarkTreeNode
type DropInfo = { id: string; before: boolean } | null
type ModalMode = 'add-bookmark' | 'add-folder' | 'edit'
interface ModalState { mode: ModalMode; node?: BNode; parentId: string }

interface Suggestion {
  type: 'duplicate' | 'empty-folder' | 'untitled' | 'ok'
  title: string
  description: string
}

interface BookmarksTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

function buildSuggestions(contents: BNode[]): Suggestion[] {
  const suggestions: Suggestion[] = []

  const urlMap = new Map<string, BNode[]>()
  contents.forEach(n => {
    if (n.url) {
      const existing = urlMap.get(n.url) || []
      existing.push(n)
      urlMap.set(n.url, existing)
    }
  })
  const dupes = [...urlMap.entries()].filter(([, nodes]) => nodes.length > 1)
  if (dupes.length > 0) {
    suggestions.push({
      type: 'duplicate',
      title: `${dupes.length} duplicate URL${dupes.length > 1 ? 's' : ''} found`,
      description: dupes.map(([, nodes]) => `"${nodes[0].title || nodes[0].url}"`)
        .slice(0, 3).join(', ') + (dupes.length > 3 ? ` +${dupes.length - 3} more` : ''),
    })
  }

  const untitled = contents.filter(n => n.url && (!n.title || n.title.trim() === ''))
  if (untitled.length > 0) {
    suggestions.push({
      type: 'untitled',
      title: `${untitled.length} untitled bookmark${untitled.length > 1 ? 's' : ''}`,
      description: 'Bookmarks without titles are hard to recognize.',
    })
  }

  const emptyFolders = contents.filter(n => !n.url && (!n.children || n.children.length === 0))
  if (emptyFolders.length > 0) {
    suggestions.push({
      type: 'empty-folder',
      title: `${emptyFolders.length} empty folder${emptyFolders.length > 1 ? 's' : ''}`,
      description: emptyFolders.map(n => `"${n.title || 'Untitled'}"`)
        .slice(0, 3).join(', ') + (emptyFolders.length > 3 ? ` +${emptyFolders.length - 3} more` : ''),
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({ type: 'ok', title: 'Looks good!', description: 'No issues found in this folder.' })
  }

  return suggestions
}

export function BookmarksTab({ showToast }: BookmarksTabProps) {
  const [roots, setRoots] = useState<BNode[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState('1')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['1', '2', '3']))
  const [modal, setModal] = useState<ModalState | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BNode[]>([])
  const [folderDropId, setFolderDropId] = useState<string | null>(null)
  const [listDrop, setListDrop] = useState<DropInfo>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)
  const lastClickedIndex = useRef<number>(-1)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadTree() }, [])

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return }
    chrome.bookmarks.search(query).then(r => setSearchResults(r))
  }, [query])

  async function loadTree() {
    const t = await chrome.bookmarks.getTree()
    setRoots(t[0]?.children || [])
  }

  function findNode(nodes: BNode[], id: string): BNode | undefined {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) { const f = findNode(n.children, id); if (f) return f }
    }
  }

  const selectedFolder = findNode(roots, selectedFolderId)
  const contents: BNode[] = query.trim() ? searchResults : (selectedFolder?.children || [])

  const suggestions = useMemo(() => buildSuggestions(contents), [contents])

  async function save(title: string, url: string) {
    if (!modal) return
    try {
      if (modal.mode === 'edit' && modal.node) {
        await chrome.bookmarks.update(modal.node.id, modal.node.url ? { title, url } : { title })
      } else {
        await chrome.bookmarks.create({
          parentId: modal.parentId,
          title,
          ...(modal.mode === 'add-bookmark' ? { url } : {}),
        })
      }
      await loadTree()
      setModal(null)
      showToast(modal.mode === 'edit' ? 'Saved' : 'Created', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error')
    }
  }

  function deleteItems(ids: Set<string>) {
    if (ids.size === 0) return
    setPendingDeleteIds(new Set(ids))
  }

  async function executeDelete(ids: Set<string>) {
    setPendingDeleteIds(null)
    try {
      for (const id of ids) {
        const n = findNode(roots, id)
        if (n?.url) await chrome.bookmarks.remove(id)
        else await chrome.bookmarks.removeTree(id)
      }
      setSelectedIds(new Set())
      await loadTree()
      showToast(`Deleted ${ids.size} item(s)`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', 'error')
    }
  }

  async function renameInline(id: string, title: string) {
    setEditingId(null)
    const node = findNode(roots, id)
    const original = node?.title || ''
    if (title === original) return
    try {
      await chrome.bookmarks.update(id, { title })
      await loadTree()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Rename failed', 'error')
    }
  }

  async function moveTo(id: string, parentId: string) {
    try {
      await chrome.bookmarks.move(id, { parentId })
      await loadTree()
      showToast('Moved', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Move failed', 'error')
    }
  }

  async function reorder(id: string, targetId: string, before: boolean) {
    const list = selectedFolder?.children || []
    const targetIndex = list.findIndex(n => n.id === targetId)
    if (targetIndex === -1) return
    try {
      await chrome.bookmarks.move(id, { parentId: selectedFolderId, index: before ? targetIndex : targetIndex + 1 })
      await loadTree()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Reorder failed', 'error')
    }
  }

  // F2 (or Enter) renames the focused single selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId || editingFolderId) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (selectedIds.size !== 1) return
      const id = [...selectedIds][0]
      if (e.key === 'F2' || e.key === 'Enter') {
        e.preventDefault()
        setEditingId(id)
        return
      }
      // Arrow navigation inside current folder
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const idx = contents.findIndex(n => n.id === id)
        if (idx < 0) return
        const next = e.key === 'ArrowDown' ? Math.min(idx + 1, contents.length - 1) : Math.max(idx - 1, 0)
        const target = contents[next]
        if (target && target.id !== id) {
          e.preventDefault()
          setSelectedIds(new Set([target.id]))
          lastClickedIndex.current = next
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, contents, editingId, editingFolderId])

  function toggleSelect(id: string, index: number, e: React.MouseEvent) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (e.shiftKey && lastClickedIndex.current >= 0) {
        const start = Math.min(lastClickedIndex.current, index)
        const end = Math.max(lastClickedIndex.current, index)
        for (let i = start; i <= end; i++) {
          if (contents[i]) next.add(contents[i].id)
        }
      } else if (e.ctrlKey || e.metaKey) {
        next.has(id) ? next.delete(id) : next.add(id)
      } else if (next.size === 1 && next.has(id)) {
        next.clear()
      } else {
        next.clear()
        next.add(id)
      }
      return next
    })
    if (!e.shiftKey) {
      lastClickedIndex.current = index
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle pointer-events-none z-10" />
          <Input
            aria-label="Search all bookmarks"
            placeholder="Search all bookmarks…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-kumo-subtle hover:text-kumo-default"
              aria-label="Clear search"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>
        <Button variant="primary" size="sm" icon={LinkIcon}
          onClick={() => setModal({ mode: 'add-bookmark', parentId: selectedFolderId })}>
          Add Bookmark
        </Button>
        <Button variant="secondary" size="sm" icon={FolderPlusIcon}
          onClick={() => setModal({ mode: 'add-folder', parentId: selectedFolderId })}>
          Add Folder
        </Button>
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" icon={TrashIcon} onClick={() => deleteItems(selectedIds)}>
            Delete ({selectedIds.size})
          </Button>
        )}
        <Button
          variant={aiPanelOpen ? 'primary' : 'secondary'}
          size="sm"
          icon={SparkleIcon}
          className="ml-auto"
          onClick={() => setAiPanelOpen(v => !v)}
        >
          AI
        </Button>
      </div>

      {/* Split panel + AI sidebar */}
      <div className="flex-1 min-h-0 flex gap-3">
      <div className="flex-1 min-h-0 rounded-lg border border-kumo-line bg-kumo-base overflow-hidden flex">
        {/* Folder tree */}
        <div className="w-52 border-r border-kumo-line overflow-y-auto flex-shrink-0 py-1.5">
          {roots.map(node => (
            <FolderNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedFolderId}
              expandedIds={expandedIds}
              dropTargetId={folderDropId}
              editingFolderId={editingFolderId}
              onSelect={id => { setSelectedFolderId(id); setSelectedIds(new Set()); setQuery('') }}
              onToggle={id => setExpandedIds(prev => {
                const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
              })}
              onRequestRename={id => {
                if (id === '1' || id === '2' || id === '3') return
                setEditingFolderId(id)
              }}
              onRenameCommit={(id, title) => renameInline(id, title).finally(() => setEditingFolderId(null))}
              onRenameCancel={() => setEditingFolderId(null)}
              onDragOver={(id, e) => { e.preventDefault(); setFolderDropId(id) }}
              onDrop={id => {
                const did = draggedId.current
                setFolderDropId(null)
                draggedId.current = null
                if (did && did !== id) moveTo(did, id)
              }}
              onDragLeave={() => setFolderDropId(null)}
            />
          ))}
        </div>

        {/* Bookmark list */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-kumo-line bg-kumo-recessed flex-shrink-0">
            <span className="w-4 flex-shrink-0" />
            <input
              type="checkbox"
              className="accent-kumo-brand flex-shrink-0"
              checked={contents.length > 0 && selectedIds.size === contents.length}
              onChange={e => setSelectedIds(e.target.checked ? new Set(contents.map(c => c.id)) : new Set())}
            />
            <span className="w-[13px] flex-shrink-0" />
            <span className="text-xs font-normal text-kumo-subtle flex-1">Name</span>
            <span className="text-xs font-normal text-kumo-subtle w-52 hidden lg:block">URL</span>
            <span className="w-[84px] flex-shrink-0" />
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto" onDragLeave={() => setListDrop(null)}>
            {contents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-kumo-subtle">
                <BookmarksIcon size={32} className="mb-3 opacity-40" />
                <Text size="sm" variant="secondary">
                  {query ? 'No results for this query' : 'This folder is empty'}
                </Text>
              </div>
            ) : (
              contents.map((node, idx) => (
                <BookmarkRow
                  key={node.id}
                  node={node}
                  isSelected={selectedIds.has(node.id)}
                  isEditing={editingId === node.id}
                  dropInfo={listDrop?.id === node.id ? listDrop : null}
                  onClick={e => toggleSelect(node.id, idx, e)}
                  onDoubleClick={() => setEditingId(node.id)}
                  onEdit={() => setModal({ mode: 'edit', node, parentId: node.parentId || selectedFolderId })}
                  onRenameCommit={title => renameInline(node.id, title)}
                  onRenameCancel={() => setEditingId(null)}
                  onDelete={() => deleteItems(new Set([node.id]))}
                  onDragStart={() => { draggedId.current = node.id }}
                  onDragOver={e => {
                    e.preventDefault()
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setListDrop({ id: node.id, before: e.clientY < rect.top + rect.height / 2 })
                  }}
                  onDrop={() => {
                    const did = draggedId.current
                    const drop = listDrop
                    setListDrop(null)
                    draggedId.current = null
                    if (did && drop && did !== node.id) reorder(did, node.id, drop.before)
                  }}
                />
              ))
            )}
          </div>
        </div>

      </div>

        {aiPanelOpen && (
          <AISidebar
            suggestions={suggestions}
            folderName={selectedFolder?.title || 'Bookmarks'}
            itemCount={contents.length}
            onClose={() => setAiPanelOpen(false)}
          />
        )}
      </div>

      {/* Edit / Add modal */}
      {modal && <EditModal modal={modal} onSave={save} onClose={() => setModal(null)} />}

      {/* Delete confirmation */}
      {pendingDeleteIds && (
        <Dialog.Root
          role="alertdialog"
          open={true}
          onOpenChange={open => { if (!open) setPendingDeleteIds(null) }}
        >
          <Dialog className="p-6 flex flex-col gap-4" size="sm">
            <Dialog.Title>
              Delete {pendingDeleteIds.size} item{pendingDeleteIds.size > 1 ? 's' : ''}?
            </Dialog.Title>
            <Dialog.Description>This cannot be undone.</Dialog.Description>
            <div className="flex gap-2 justify-end">
              <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
              <Dialog.Close render={
                <Button
                  variant="destructive"
                  size="sm"
                  icon={TrashIcon}
                  onClick={() => executeDelete(pendingDeleteIds)}
                >
                  Delete
                </Button>
              } />
            </div>
          </Dialog>
        </Dialog.Root>
      )}
    </div>
  )
}

// ── Folder tree node ──────────────────────────────────────────────────────────

function FolderNode({ node, depth, selectedId, expandedIds, dropTargetId, editingFolderId, onSelect, onToggle, onRequestRename, onRenameCommit, onRenameCancel, onDragOver, onDrop, onDragLeave }: {
  node: BNode; depth: number; selectedId: string; expandedIds: Set<string>; dropTargetId: string | null
  editingFolderId: string | null
  onSelect: (id: string) => void; onToggle: (id: string) => void
  onRequestRename: (id: string) => void
  onRenameCommit: (id: string, title: string) => void
  onRenameCancel: () => void
  onDragOver: (id: string, e: React.DragEvent) => void
  onDrop: (id: string) => void; onDragLeave: () => void
}) {
  if (node.url) return null
  const childFolders = (node.children || []).filter(c => !c.url)
  const isExpanded = expandedIds.has(node.id)
  const isSelected = node.id === selectedId
  const isDropTarget = node.id === dropTargetId
  const isEditing = node.id === editingFolderId
  const isRoot = node.id === '1' || node.id === '2' || node.id === '3'

  const [draft, setDraft] = useState(node.title || '')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (isEditing) {
      setDraft(node.title || '')
      requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
    }
  }, [isEditing, node.title])

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: '8px' }}
        className={`flex items-center gap-1 py-1.5 mx-1 rounded select-none text-sm font-normal transition-colors
          ${isEditing ? '' : 'cursor-pointer'}
          ${isSelected ? 'bg-kumo-tint text-kumo-brand' : 'text-kumo-default hover:bg-kumo-tint'}
          ${isDropTarget ? 'ring-1 ring-inset ring-kumo-brand bg-kumo-info-tint' : ''}
        `}
        onClick={isEditing ? undefined : () => onSelect(node.id)}
        onDoubleClick={isEditing || isRoot ? undefined : e => { e.stopPropagation(); onRequestRename(node.id) }}
        onDragOver={e => onDragOver(node.id, e)}
        onDrop={() => onDrop(node.id)}
        onDragLeave={onDragLeave}
      >
        <button
          className={`w-4 flex-shrink-0 flex items-center justify-center text-kumo-subtle hover:text-kumo-default ${!childFolders.length ? 'opacity-0 pointer-events-none' : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(node.id) }}
        >
          <CaretRightIcon size={10} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
        {isExpanded
          ? <FolderOpenIcon size={13} className="flex-shrink-0 text-kumo-subtle" />
          : <FolderIcon size={13} className="flex-shrink-0 text-kumo-subtle" />
        }
        {isEditing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onRenameCommit(node.id, draft.trim() || node.title || '') }
              else if (e.key === 'Escape') { e.preventDefault(); onRenameCancel() }
              e.stopPropagation()
            }}
            onBlur={() => onRenameCommit(node.id, draft.trim() || node.title || '')}
            className="ml-1.5 flex-1 text-sm font-normal text-kumo-default bg-app-bg border border-kumo-brand rounded px-1.5 py-0 leading-tight outline-none focus:ring-1 focus:ring-kumo-brand min-w-0"
          />
        ) : (
          <span className="truncate ml-1.5 text-sm leading-none">{node.title || 'Bookmarks'}</span>
        )}
      </div>
      {isExpanded && childFolders.map(child => (
        <FolderNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          dropTargetId={dropTargetId}
          editingFolderId={editingFolderId}
          onSelect={onSelect}
          onToggle={onToggle}
          onRequestRename={onRequestRename}
          onRenameCommit={onRenameCommit}
          onRenameCancel={onRenameCancel}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragLeave={onDragLeave}
        />
      ))}
    </div>
  )
}

// ── Bookmark row ──────────────────────────────────────────────────────────────

function BookmarkRow({ node, isSelected, isEditing, dropInfo, onClick, onDoubleClick, onEdit, onRenameCommit, onRenameCancel, onDelete, onDragStart, onDragOver, onDrop }: {
  node: BNode; isSelected: boolean; isEditing: boolean; dropInfo: DropInfo
  onClick: (e: React.MouseEvent) => void; onDoubleClick: () => void; onEdit: () => void
  onRenameCommit: (title: string) => void; onRenameCancel: () => void; onDelete: () => void
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void
}) {
  const [draft, setDraft] = useState(node.title || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setDraft(node.title || '')
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isEditing, node.title])

  return (
    <div
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={isEditing ? undefined : onClick}
      onDoubleClick={isEditing ? undefined : onDoubleClick}
      className={[
        'flex items-center gap-3 px-4 py-2 border-b border-kumo-line last:border-b-0 select-none group transition-colors',
        isEditing ? '' : 'cursor-pointer',
        isSelected ? 'bg-kumo-tint' : 'hover:bg-kumo-recessed',
        dropInfo?.before ? 'border-t-2 border-t-kumo-brand' : '',
        dropInfo && !dropInfo.before ? 'border-b-2 border-b-kumo-brand' : '',
      ].join(' ')}
    >
      <DotsSixVerticalIcon size={12} className="text-kumo-subtle opacity-0 group-hover:opacity-60 flex-shrink-0 cursor-grab" />
      <input
        type="checkbox"
        className="accent-kumo-brand flex-shrink-0"
        checked={isSelected}
        readOnly
        onClick={e => e.stopPropagation()}
      />
      {node.url
        ? <LinkIcon size={13} className="flex-shrink-0 text-kumo-subtle" />
        : <FolderIcon size={13} className="flex-shrink-0 text-kumo-subtle" />
      }
      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onRenameCommit(draft.trim() || node.title || '') }
            else if (e.key === 'Escape') { e.preventDefault(); onRenameCancel() }
            e.stopPropagation()
          }}
          onBlur={() => onRenameCommit(draft.trim() || node.title || '')}
          className="flex-1 text-sm font-normal text-kumo-default bg-app-bg border border-kumo-brand rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-kumo-brand min-w-0"
        />
      ) : (
        <span className="flex-1 truncate text-sm font-normal text-kumo-default">{node.title || '(untitled)'}</span>
      )}
      {node.url && (
        <span className="w-52 truncate text-xs font-normal text-kumo-subtle hidden lg:block">{node.url}</span>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-[84px] justify-end">
        {node.url && (
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded text-kumo-subtle hover:text-kumo-brand hover:bg-kumo-tint"
            title="Open in new tab"
          >
            <ArrowSquareOutIcon size={12} />
          </a>
        )}
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1.5 rounded text-kumo-subtle hover:text-kumo-default hover:bg-kumo-recessed"
          title="Edit"
        >
          <PencilIcon size={12} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded text-kumo-subtle hover:text-kumo-danger hover:bg-kumo-danger-tint"
          title="Delete"
        >
          <TrashIcon size={12} />
        </button>
      </div>
    </div>
  )
}

// ── AI Suggestions sidebar ────────────────────────────────────────────────────

const SUGGESTION_ICONS: Record<Suggestion['type'], React.ElementType> = {
  duplicate: CopySimpleIcon,
  untitled: WarningCircleIcon,
  'empty-folder': FolderSimpleMinusIcon,
  ok: CheckCircleIcon,
}

const SUGGESTION_COLORS: Record<Suggestion['type'], string> = {
  duplicate: 'text-kumo-warning',
  untitled: 'text-kumo-warning',
  'empty-folder': 'text-kumo-subtle',
  ok: 'text-kumo-success',
}

function AISidebar({ suggestions, folderName, itemCount, onClose }: {
  suggestions: Suggestion[]
  folderName: string
  itemCount: number
  onClose: () => void
}) {
  return (
    <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <SparkleIcon size={13} weight="fill" className="text-kumo-brand" />
          <Text size="sm" className="font-medium">AI Suggestions</Text>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint"
          aria-label="Close"
        >
          <XIcon size={13} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4">
        <Text size="xs" variant="secondary">
          Analyzing <span className="text-kumo-default font-medium">"{folderName}"</span>
          {' '}— {itemCount} item{itemCount !== 1 ? 's' : ''}
        </Text>

        <div className="flex flex-col gap-3">
          {suggestions.map((s, i) => {
            const Icon = SUGGESTION_ICONS[s.type]
            const color = SUGGESTION_COLORS[s.type]
            return (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <Icon size={12} className={`flex-shrink-0 ${color}`} />
                  <Text size="xs" className="font-medium">{s.title}</Text>
                </div>
                <Text size="xs" variant="secondary" className="leading-relaxed pl-[18px]">
                  {s.description}
                </Text>
              </div>
            )
          })}
        </div>

        <Text size="xs" variant="secondary" className="leading-relaxed">
          AI-powered suggestions — cloud analysis coming soon.
        </Text>
      </div>
    </div>
  )
}

// ── Edit / Add modal ──────────────────────────────────────────────────────────

function EditModal({ modal, onSave, onClose }: {
  modal: ModalState; onSave: (title: string, url: string) => void; onClose: () => void
}) {
  const [title, setTitle] = useState(modal.node?.title || '')
  const [url, setUrl] = useState(modal.node?.url || '')
  const isFolder = modal.mode === 'add-folder' || (modal.mode === 'edit' && !modal.node?.url)

  const heading =
    modal.mode === 'add-bookmark' ? 'Add Bookmark'
    : modal.mode === 'add-folder' ? 'New Folder'
    : `Edit ${isFolder ? 'Folder' : 'Bookmark'}`

  return (
    <Dialog.Root open={true} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog className="p-6 flex flex-col gap-5" size="sm">
        <Dialog.Title>{heading}</Dialog.Title>
        <Input
          label="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Enter title"
          autoFocus
        />
        {!isFolder && (
          <Input
            label="URL"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
          />
        )}
        <div className="flex gap-2 justify-end">
          <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
          <Button variant="primary" onClick={() => onSave(title, url)}>Save</Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
