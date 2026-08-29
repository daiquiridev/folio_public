import { useState, useEffect, useCallback } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { DropdownMenu } from '@cloudflare/kumo/components/dropdown'
import {
  DropIcon,
  BrainIcon,
  WrenchIcon,
  BookOpenIcon,
  BookmarksIcon,
  CrownIcon,
  ShieldCheckIcon,
  GithubLogoIcon,
  ArrowsClockwiseIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
} from '@phosphor-icons/react'

type Theme = 'light' | 'dark' | 'system'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const THEME_ICONS: Record<Theme, React.ElementType> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
}
import { sendMessage } from '../lib/chrome'
import { RaindropTab } from './tabs/RaindropTab'
import { AITab } from './tabs/AITab'
import { ToolsTab } from './tabs/ToolsTab'
import { AboutTab } from './tabs/AboutTab'
import { BookmarksTab } from './tabs/BookmarksTab'
import { CloudBackupTab } from './tabs/CloudBackupTab'
import { PlanTab } from './tabs/PlanTab'

type TabKey = 'raindrop' | 'backup' | 'ai' | 'plan' | 'tools' | 'about' | 'bookmarks'

const TAB_LABELS: Record<TabKey, string> = {
  raindrop: 'Raindrop.io',
  backup: 'Cloud Sync',
  ai: 'AI Organizer',
  tools: 'Tools',
  about: 'Guide & Support',
  bookmarks: 'Bookmarks',
  plan: 'Plan & License',
}

const NAV_ITEMS: { key: TabKey; icon: React.ElementType; label: string }[] = [
  { key: 'bookmarks', icon: BookmarksIcon, label: 'Bookmarks' },
  { key: 'raindrop', icon: DropIcon, label: 'Raindrop.io' },
  { key: 'backup', icon: ShieldCheckIcon, label: 'Cloud Sync' },
  { key: 'ai', icon: BrainIcon, label: 'AI Organizer' },
  { key: 'plan', icon: CrownIcon, label: 'Plan & License' },
  { key: 'tools', icon: WrenchIcon, label: 'Tools' },
  { key: 'about', icon: BookOpenIcon, label: 'Guide & Support' },
]

// Old tab keys (split Connect/Sync) collapse into the merged Raindrop tab.
function normalizeTab(stored: string | null): TabKey {
  if (stored === 'api' || stored === 'sync') return 'raindrop'
  const valid: TabKey[] = ['raindrop', 'backup', 'ai', 'plan', 'tools', 'about', 'bookmarks']
  return valid.includes(stored as TabKey) ? (stored as TabKey) : 'raindrop'
}

export interface ToastState {
  message: string
  type: 'success' | 'error' | 'info'
}

export function OptionsApp() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => normalizeTab(localStorage.getItem('lastActiveTab')))
  const [isSyncing, setIsSyncing] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system')

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    localStorage.setItem('lastActiveTab', activeTab)
  }, [activeTab])

  useEffect(() => {
    localStorage.setItem('theme', theme)
    const applyMode = (dark: boolean) => {
      if (dark) {
        document.documentElement.setAttribute('data-mode', 'dark')
      } else {
        document.documentElement.removeAttribute('data-mode')
      }
    }
    if (theme === 'dark') {
      applyMode(true)
    } else if (theme === 'light') {
      applyMode(false)
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyMode(mq.matches)
      const handler = (e: MediaQueryListEvent) => applyMode(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  async function syncNow() {
    setIsSyncing(true)
    showToast('Syncing bookmarks...', 'info')
    try {
      const res = await sendMessage({ action: 'syncNow' })
      if (res?.success) {
        showToast('Sync completed successfully!', 'success')
      } else {
        showToast('Sync failed: ' + (res?.error || 'Unknown error'), 'error')
      }
    } catch (e: unknown) {
      showToast('Sync failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const tabProps = { showToast }

  return (
    <div className="riso-app flex h-screen bg-app-bg overflow-hidden font-sans font-normal">
      {/* Sidebar */}
      <aside className="w-[240px] bg-app-surface border-r border-app-border flex flex-col flex-shrink-0 relative z-10">
        {/* Brand lockup: logo mark + wordmark on its golden base bar */}
        <div className="h-[76px] flex flex-col justify-center flex-shrink-0 px-5 border-b border-app-border">
          <div className="riso-brand">
            <img src="icon128.png" alt="" aria-hidden="true" />
            <span className="riso-wordmark">Folio</span>
          </div>
          <div className="riso-brand-bar" aria-hidden="true" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              data-active={activeTab === key}
              className={`
                riso-nav-item flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left
                ${activeTab === key ? '' : 'text-kumo-subtle hover:text-kumo-default'}
              `}
            >
              <Icon size={16} weight={activeTab === key ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-app-border">
          <a
            href="https://github.com/spacechild-dev/folio-bookmark-manager"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-normal text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default transition-colors"
          >
            <GithubLogoIcon size={16} />
            GitHub
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Content header — same height as sidebar header */}
        <header className="h-[76px] px-8 bg-app-surface border-b border-app-border flex items-center justify-between flex-shrink-0 relative z-10">
          <span className="riso-page-title">{TAB_LABELS[activeTab]}</span>
          <div className="flex items-center gap-2">
            {/* Appearance dropdown */}
            <DropdownMenu>
              <DropdownMenu.Trigger render={
                <button
                  className="flex items-center justify-center w-8 h-8 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
                  aria-label="Appearance"
                >
                  {(() => { const Icon = THEME_ICONS[theme]; return <Icon size={16} /> })()}
                </button>
              } />
              <DropdownMenu.Content>
                <DropdownMenu.RadioGroup value={theme} onValueChange={v => setTheme(v as Theme)}>
                  {(['light', 'dark', 'system'] as const).map(t => {
                    const Icon = THEME_ICONS[t]
                    return (
                      <DropdownMenu.RadioItem key={t} value={t}>
                        <Icon size={14} className="mr-2 shrink-0" />
                        {THEME_LABELS[t]}
                        <DropdownMenu.RadioItemIndicator />
                      </DropdownMenu.RadioItem>
                    )
                  })}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu>
            <Button
              variant="primary"
              size="sm"
              icon={ArrowsClockwiseIcon}
              loading={isSyncing}
              onClick={syncNow}
            >
              Sync Now
            </Button>
          </div>
        </header>

        {/* Toast — fixed overlay, no layout shift */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 w-80 max-w-[calc(100vw-2.5rem)]">
            <div
              role="status"
              className={`flex items-start gap-3 rounded-lg border bg-app-surface px-4 py-3 shadow-lg ${
                toast.type === 'error'
                  ? 'border-kumo-danger/40 text-kumo-danger'
                  : toast.type === 'success'
                    ? 'border-kumo-success/40 text-kumo-success'
                    : 'border-app-border text-kumo-default'
              }`}
            >
              <span className="flex-1 text-sm">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                aria-label="Dismiss"
                className="text-kumo-subtle hover:text-kumo-default transition-colors text-sm leading-none mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className={`flex-1 min-h-0 ${activeTab === 'bookmarks' ? 'overflow-hidden flex flex-col p-6' : 'overflow-y-auto px-8 py-8'}`}>
          {activeTab === 'raindrop' && <RaindropTab {...tabProps} />}
          {activeTab === 'backup' && <CloudBackupTab {...tabProps} />}
          {activeTab === 'ai' && <AITab {...tabProps} />}
          {activeTab === 'tools' && <ToolsTab {...tabProps} />}
          {activeTab === 'about' && <AboutTab {...tabProps} />}
          {activeTab === 'plan' && <PlanTab {...tabProps} />}
          {activeTab === 'bookmarks' && <BookmarksTab {...tabProps} />}
        </div>
      </main>
    </div>
  )
}
