import { useEffect, useState, useRef, useCallback } from 'react'
import {
  GearIcon, MagnifyingGlassIcon, FolderSimpleIcon, CaretLeftIcon,
  ClockCounterClockwiseIcon, BookmarkSimpleIcon,
} from '@phosphor-icons/react'

type BM = chrome.bookmarks.BookmarkTreeNode

// Riso ink rotation for the chip dots — flat spot colors, no gradients.
const ACCENTS = ['#6B7BF7', '#00C49A', '#F5B800', '#FF5A5A', '#FFB27E']

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Same theme contract as the options page: localStorage 'theme' = light|dark|system. */
function useTheme() {
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'system'
    const applyMode = (dark: boolean) => {
      if (dark) document.documentElement.setAttribute('data-mode', 'dark')
      else document.documentElement.removeAttribute('data-mode')
    }
    if (theme === 'dark') { applyMode(true); return }
    if (theme === 'light') { applyMode(false); return }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    applyMode(mq.matches)
    const handler = (e: MediaQueryListEvent) => applyMode(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
}

function openUrl(url: string, inNewTab: boolean) {
  if (inNewTab) window.open(url, '_blank')
  else window.location.assign(url)
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export function NewTabApp() {
  useTheme()
  const now = useClock()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BM[]>([])
  const [sel, setSel] = useState(0)
  const [barItems, setBarItems] = useState<BM[]>([])
  const [openFolder, setOpenFolder] = useState<BM | null>(null)
  const [folderChildren, setFolderChildren] = useState<BM[]>([])
  const [recent, setRecent] = useState<BM[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    chrome.bookmarks.getChildren('1').then(setBarItems).catch(() => {})
    chrome.bookmarks.getRecent(8).then(setRecent).catch(() => {})
    inputRef.current?.focus()
  }, [])

  // Live search — debounced so fast typing doesn't spam the bookmarks API
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSel(0); return }
    const id = setTimeout(() => {
      chrome.bookmarks.search(q).then(all => {
        setResults(all.filter(b => b.url).slice(0, 8))
        setSel(0)
      }).catch(() => {})
    }, 120)
    return () => clearTimeout(id)
  }, [query])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Escape') { setQuery('') }
    else if (e.key === 'Enter') {
      const hit = results[sel]
      if (hit?.url) openUrl(hit.url, e.metaKey || e.ctrlKey)
    }
  }, [results, sel])

  async function toggleFolder(f: BM) {
    if (openFolder?.id === f.id) { setOpenFolder(null); return }
    try {
      setFolderChildren(await chrome.bookmarks.getChildren(f.id))
      setOpenFolder(f)
    } catch {}
  }

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="riso-app min-h-screen bg-app-bg font-sans flex flex-col">
      {/* Header — brand lockup + settings, mirroring the options page */}
      <header className="flex items-center justify-between px-6 py-5 relative z-10">
        <div>
          <div className="riso-brand">
            <img src="icon128.png" alt="" aria-hidden="true" />
            <span className="riso-wordmark">Folio</span>
          </div>
          <div className="riso-brand-bar" />
        </div>
        <button
          className="riso-nav-item p-2.5 text-kumo-subtle hover:text-kumo-default"
          aria-label="Open Settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <GearIcon size={20} />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pb-10 relative z-10 w-full">
        {/* Clock — the page's one loud moment */}
        <div className="mt-[9vh] text-center select-none">
          <div className="newtab-clock">{time}</div>
          <div className="newtab-date">{date}</div>
        </div>

        {/* Search sticker */}
        <div className="w-full max-w-xl mt-10">
          <div className="newtab-search">
            <MagnifyingGlassIcon size={20} className="shrink-0 text-kumo-subtle" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search your bookmarks…"
              aria-label="Search bookmarks"
              spellCheck={false}
            />
          </div>

          {results.length > 0 && (
            <div className="riso-card mt-3 overflow-hidden" role="listbox" aria-label="Search results">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  role="option"
                  aria-selected={i === sel}
                  className={`newtab-result ${i === sel ? 'newtab-result-active' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={e => openUrl(r.url!, e.metaKey || e.ctrlKey)}
                >
                  <BookmarkSimpleIcon size={15} className="shrink-0" style={{ color: ACCENTS[i % ACCENTS.length] }} />
                  <span className="truncate flex-1 text-left">{r.title || r.url}</span>
                  <span className="text-xs text-kumo-subtle shrink-0">{hostOf(r.url!)}</span>
                </button>
              ))}
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <div className="mt-3 text-center text-sm text-kumo-subtle">No bookmarks match “{query.trim()}”</div>
          )}
        </div>

        {/* Bookmarks bar as sticker chips */}
        {!query.trim() && barItems.length > 0 && (
          <div className="w-full max-w-3xl mt-12">
            <h2 className="riso-card-title text-xs uppercase mb-4">Bookmarks bar</h2>
            <div className="flex flex-wrap gap-2.5">
              {barItems.slice(0, 24).map((b, i) => b.url ? (
                <button key={b.id} className="riso-chip" onClick={e => openUrl(b.url!, e.metaKey || e.ctrlKey)} title={b.url}>
                  <span className="riso-chip-dot" style={{ background: ACCENTS[i % ACCENTS.length] }} />
                  <span className="truncate min-w-0">{b.title || hostOf(b.url)}</span>
                </button>
              ) : (
                <button
                  key={b.id}
                  className="riso-chip riso-chip-folder"
                  data-open={openFolder?.id === b.id}
                  onClick={() => toggleFolder(b)}
                >
                  <FolderSimpleIcon size={14} weight="fill" style={{ color: '#F5B800' }} />
                  <span className="truncate min-w-0">{b.title || 'Folder'}</span>
                </button>
              ))}
            </div>

            {openFolder && (
              <div className="riso-card mt-4 p-2">
                <button className="newtab-result text-kumo-subtle" onClick={() => setOpenFolder(null)}>
                  <CaretLeftIcon size={14} />
                  <span className="text-xs uppercase tracking-wide font-semibold">{openFolder.title}</span>
                </button>
                {folderChildren.filter(c => c.url).slice(0, 20).map((c, i) => (
                  <button key={c.id} className="newtab-result" onClick={e => openUrl(c.url!, e.metaKey || e.ctrlKey)}>
                    <BookmarkSimpleIcon size={15} className="shrink-0" style={{ color: ACCENTS[i % ACCENTS.length] }} />
                    <span className="truncate flex-1 text-left">{c.title || c.url}</span>
                    <span className="text-xs text-kumo-subtle shrink-0">{hostOf(c.url!)}</span>
                  </button>
                ))}
                {folderChildren.some(c => !c.url) && (
                  <div className="px-3 py-1.5 text-xs text-kumo-subtle">
                    Subfolders live in the bookmark manager — use search to reach anything inside them.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recently added */}
        {!query.trim() && recent.length > 0 && (
          <div className="w-full max-w-xl mt-10">
            <h2 className="riso-card-title text-xs uppercase mb-4 flex items-center gap-1.5">
              <ClockCounterClockwiseIcon size={13} /> Recently added
            </h2>
            <div className="riso-card overflow-hidden">
              {recent.map((r, i) => (
                <button key={r.id} className="newtab-result" onClick={e => openUrl(r.url!, e.metaKey || e.ctrlKey)}>
                  <BookmarkSimpleIcon size={15} className="shrink-0" style={{ color: ACCENTS[i % ACCENTS.length] }} />
                  <span className="truncate flex-1 text-left">{r.title || r.url}</span>
                  <span className="text-xs text-kumo-subtle shrink-0">{hostOf(r.url!)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center pb-5 relative z-10">
        <span className="text-xs text-kumo-subtle">
          Tip: type <kbd className="font-mono bg-kumo-tint px-1.5 py-0.5 rounded border border-kumo-line">f</kbd> +
          Space in the address bar to search bookmarks from anywhere · ⌘/Ctrl-click opens in a new tab
        </span>
      </footer>
    </div>
  )
}
