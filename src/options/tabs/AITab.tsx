import { useState, useEffect, useCallback } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { Input } from '@cloudflare/kumo/components/input'
import { Text } from '@cloudflare/kumo/components/text'
import { Badge } from '@cloudflare/kumo/components/badge'
import {
  BrainIcon, SparkleIcon, KeyIcon, PlayIcon, CheckIcon,
  ArrowCounterClockwiseIcon, FolderPlusIcon,
} from '@phosphor-icons/react'
import { SettingsCard } from '../components/SettingsCard'
import type { ToastState } from '../OptionsApp'

interface AITabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

function send<T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: `ai.${action}`, ...extra }, (res) => {
      const err = chrome.runtime.lastError
      if (err) return reject(new Error(err.message))
      if (!res?.success) return reject(new Error(res?.error || 'Unknown error'))
      resolve(res.data as T)
    })
  })
}

interface AIStatus {
  configuredProvider: string | null
  effectiveProvider: string | null
  model: string | null
  plan: string
  includedAI: boolean
  aiUsage: { used: number; limit: number; month: string } | null
}

interface TopicGroup {
  topic: string
  description?: string
  bookmarkIds: string[]
  suggestedFolder?: string
}

interface ReviewItem { id: string; title: string; url: string; checked: boolean }
interface RenameSuggestion { id: string; oldTitle: string; url: string; newTitle: string; checked: boolean }
interface ReviewGroup {
  folder: string
  description?: string
  enabled: boolean
  expanded: boolean
  items: ReviewItem[]
}

const BYOK_PROVIDERS = [
  { value: 'claude', label: 'Anthropic (Claude)', model: 'claude-haiku-4-5-20251001' },
  { value: 'openai', label: 'OpenAI', model: 'gpt-4o-mini' },
  { value: 'gemini', label: 'Google Gemini', model: 'gemini-2.0-flash' },
]

export function AITab({ showToast }: AITabProps) {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [busy, setBusy] = useState(false)

  // BYOK form
  const [provider, setProvider] = useState('claude')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(BYOK_PROVIDERS[0].model)

  // custom prompt
  const [prompt, setPrompt] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  // analysis — editable review state
  const [groups, setGroups] = useState<ReviewGroup[] | null>(null)
  const [analyzedInfo, setAnalyzedInfo] = useState<{ analyzed: number; total: number } | null>(null)

  // smart rename — review state
  const [renames, setRenames] = useState<RenameSuggestion[] | null>(null)
  const [renameBusy, setRenameBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const s = await send<AIStatus>('status')
      setStatus(s)
      const p = await send<{ prompt: string; isCustom: boolean; defaultPrompt: string }>('getPrompt')
      setPrompt(p.prompt)
      setDefaultPrompt(p.defaultPrompt)
      setIsCustom(p.isCustom)
    } catch (e) {
      showToast('AI status failed: ' + (e instanceof Error ? e.message : ''), 'error')
    }
  }, [showToast])

  useEffect(() => { refresh() }, [refresh])

  async function saveByok() {
    if (!apiKey.trim()) { showToast('Enter an API key', 'error'); return }
    setBusy(true)
    try {
      await send('saveConfig', { provider, apiKey: apiKey.trim(), model })
      const t = await send<{ ok: boolean }>('test')
      showToast(t.ok ? 'Provider connected' : 'Saved, but the test call failed — check the key', t.ok ? 'success' : 'error')
      setApiKey('')
      await refresh()
    } catch (e) {
      showToast('Save failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally { setBusy(false) }
  }

  async function savePrompt() {
    setBusy(true)
    try {
      const r = await send<{ isCustom: boolean }>('setPrompt', { prompt })
      setIsCustom(r.isCustom)
      showToast(r.isCustom ? 'Custom prompt saved' : 'Reverted to the default prompt', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast(msg === 'prompt_missing_placeholder'
        ? 'Prompt must contain the {{BOOKMARKS}} placeholder'
        : 'Save failed: ' + msg, 'error')
    } finally { setBusy(false) }
  }

  async function runAnalysis() {
    setBusy(true)
    setGroups(null)
    try {
      const r = await send<{ topics: TopicGroup[]; lookup: Record<string, { title: string; url: string }>; analyzed: number; total: number }>('analyze')
      const review: ReviewGroup[] = (r.topics || []).map(t => ({
        folder: (t.suggestedFolder || t.topic || '').split('/')[0],
        description: t.description,
        enabled: true,
        expanded: false,
        items: (t.bookmarkIds || []).map(id => ({
          id: String(id),
          title: r.lookup?.[id]?.title || String(id),
          url: r.lookup?.[id]?.url || '',
          checked: true,
        })).filter(i => i.url),
      })).filter(g => g.items.length)
      setGroups(review)
      setAnalyzedInfo({ analyzed: r.analyzed, total: r.total })
      await refresh() // kota sayacı güncellensin
      showToast(`Analyzed ${r.analyzed} bookmarks into ${r.topics?.length || 0} groups`, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'quota_exhausted') {
        showToast('Monthly included-AI quota is used up — it renews next month, or add your own API key below to continue now.', 'info')
      } else if (msg === 'folio_ai_requires_ai_pro' || msg === 'folio_ai_requires_license') {
        showToast('Included AI needs an active AI Pro license (see the Plan tab), or add your own API key below.', 'info')
      } else {
        showToast('Analysis failed: ' + msg, 'error')
      }
    } finally { setBusy(false) }
  }

  async function applyGroups() {
    if (!groups?.length) return
    const payload = groups
      .filter(g => g.enabled)
      .map(g => ({ folder: g.folder, bookmarkIds: g.items.filter(i => i.checked).map(i => i.id) }))
      .filter(g => g.folder.trim() && g.bookmarkIds.length)
    if (!payload.length) { showToast('Nothing selected to apply', 'info'); return }
    setBusy(true)
    try {
      const r = await send<{ moved: number; folders: number }>('apply', { groups: payload })
      showToast(`Done — ${r.moved} bookmarks moved into ${r.folders} folders (under "Other bookmarks")`, 'success')
      setGroups(null)
    } catch (e) {
      showToast('Apply failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally { setBusy(false) }
  }

  async function runRename() {
    setRenameBusy(true)
    setRenames(null)
    try {
      const r = await send<{ suggestions: Omit<RenameSuggestion, 'checked'>[]; scanned?: number }>('rename')
      if (!r.suggestions.length) {
        showToast('No poorly-titled bookmarks found — nothing to rename', 'success')
      } else {
        setRenames(r.suggestions.map(s => ({ ...s, checked: true })))
        await refresh()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'quota_exhausted') {
        showToast('Monthly included-AI quota is used up — it renews next month, or add your own API key below.', 'info')
      } else if (msg === 'folio_ai_requires_ai_pro' || msg === 'folio_ai_requires_license') {
        showToast('Smart rename needs an active AI Pro license or your own API key (below).', 'info')
      } else {
        showToast('Rename scan failed: ' + msg, 'error')
      }
    } finally { setRenameBusy(false) }
  }

  async function applyRenames() {
    if (!renames) return
    const items = renames.filter(r => r.checked).map(r => ({ id: r.id, title: r.newTitle }))
    if (!items.length) { showToast('Nothing selected', 'info'); return }
    setRenameBusy(true)
    try {
      const r = await send<{ renamed: number }>('renameApply', { items })
      showToast(`Renamed ${r.renamed} bookmarks`, 'success')
      setRenames(null)
    } catch (e) {
      showToast('Apply failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally { setRenameBusy(false) }
  }

  function patchGroup(i: number, patch: Partial<ReviewGroup>) {
    setGroups(gs => gs ? gs.map((g, idx) => idx === i ? { ...g, ...patch } : g) : gs)
  }
  function toggleItem(gi: number, id: string) {
    setGroups(gs => gs ? gs.map((g, idx) => idx !== gi ? g : {
      ...g, items: g.items.map(it => it.id === id ? { ...it, checked: !it.checked } : it),
    }) : gs)
  }

  const usage = status?.aiUsage
  const currentMonth = new Date().toISOString().slice(0, 7)
  const usageCurrent = usage && usage.month === currentMonth ? usage : null

  return (
    <div className="flex flex-col gap-6">
      {/* Included AI (AI Pro) */}
      <SettingsCard
        title="Included AI"
        icon={SparkleIcon}
        action={status?.includedAI
          ? <Badge variant="primary">Active — AI Pro</Badge>
          : <Badge variant="secondary">Requires AI Pro</Badge>}
      >
        <Text className="text-sm text-kumo-subtle">
          On the AI Pro plan, organization runs on Folio's own AI — no API key, no setup, enabled
          automatically. The plan includes <strong>300 organize operations per month</strong>; the
          counter below always shows where you stand, and when it runs out the feature keeps working
          through your own API key if you add one.
        </Text>
        {status?.includedAI && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-kumo-tint overflow-hidden">
              <div
                className="h-full rounded-full bg-kumo-brand"
                style={{ width: `${usageCurrent ? Math.min(100, (usageCurrent.used / usageCurrent.limit) * 100) : 0}%` }}
              />
            </div>
            <Text size="sm" className="text-kumo-subtle whitespace-nowrap">
              {usageCurrent ? `${usageCurrent.used} / ${usageCurrent.limit}` : `0 / 300`} this month
            </Text>
          </div>
        )}
      </SettingsCard>

      {/* Run analysis */}
      <SettingsCard
        title="Organize with AI"
        icon={BrainIcon}
        action={
          <Button variant="primary" size="sm" icon={PlayIcon} loading={busy && !groups} disabled={busy} onClick={runAnalysis}>
            Analyze bookmarks
          </Button>
        }
      >
        <Text className="text-sm text-kumo-subtle">
          Reads your bookmarks (titles + URLs only), groups them into topics and suggests folders.
          Nothing is changed until you apply. Uses {status?.effectiveProvider === 'folio'
            ? "Folio's included AI"
            : status?.effectiveProvider
              ? `your ${status.effectiveProvider} key`
              : 'the included AI (AI Pro) or your own API key — configure one below'}.
        </Text>

        {analyzedInfo && groups && (
          <div className="flex flex-col gap-3">
            <Text size="sm" className="text-kumo-subtle">
              {analyzedInfo.analyzed} of {analyzedInfo.total} bookmarks analyzed → review, edit, then apply.
              Unchecked items stay where they are.
            </Text>
            <div className="flex flex-col gap-2">
              {groups.map((g, gi) => {
                const checkedCount = g.items.filter(i => i.checked).length
                return (
                  <div key={gi} className={`rounded-lg border-2 ${g.enabled ? 'border-app-border bg-app-bg' : 'border-app-border/50 bg-app-bg opacity-55'}`}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={g.enabled}
                        onChange={() => patchGroup(gi, { enabled: !g.enabled })}
                        aria-label="Include this group"
                      />
                      <input
                        value={g.folder}
                        onChange={e => patchGroup(gi, { folder: e.target.value })}
                        disabled={!g.enabled}
                        aria-label="Folder name"
                        className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-kumo-brand focus:outline-none text-sm font-semibold text-kumo-default px-1 py-0.5"
                      />
                      <Badge variant="secondary">{checkedCount}/{g.items.length}</Badge>
                      <button
                        className="text-kumo-subtle text-sm px-1"
                        onClick={() => patchGroup(gi, { expanded: !g.expanded })}
                        aria-label={g.expanded ? 'Collapse' : 'Expand'}
                      >{g.expanded ? '▾' : '▸'}</button>
                    </div>
                    {g.expanded && (
                      <div className="border-t border-app-border px-3 py-2 flex flex-col gap-1 max-h-56 overflow-y-auto">
                        {g.items.map(it => (
                          <label key={it.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                            <input type="checkbox" checked={it.checked} disabled={!g.enabled} onChange={() => toggleItem(gi, it.id)} />
                            <span className="truncate text-kumo-default" title={it.url}>{it.title}</span>
                            <span className="truncate text-kumo-subtle text-xs hidden sm:inline">{it.url.replace(/^https?:\/\//, '')}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" icon={FolderPlusIcon} loading={busy} onClick={applyGroups}>
                Apply selected
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setGroups(null); setAnalyzedInfo(null) }}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* Smart rename */}
      <SettingsCard
        title="Smart rename"
        icon={SparkleIcon}
        info="Finds bookmarks with missing titles, raw URLs as titles, or overly long titles, and suggests concise ones. Nothing changes until you apply."
        action={
          <Button variant="secondary" size="sm" icon={PlayIcon} loading={renameBusy && !renames} disabled={renameBusy} onClick={runRename}>
            Find bad titles
          </Button>
        }
      >
        <Text className="text-sm text-kumo-subtle">
          AI writes clean, descriptive titles for your worst-named bookmarks (up to 60 per run).
          Uses the same AI as the organizer — included AI on AI Pro, or your own key.
        </Text>
        {renames && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
              {renames.map(r => (
                <label key={r.id} className="flex items-start gap-2 text-sm py-1 cursor-pointer border-b border-app-border/60 last:border-0">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={r.checked}
                    onChange={() => setRenames(rs => rs ? rs.map(x => x.id === r.id ? { ...x, checked: !x.checked } : x) : rs)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-kumo-subtle line-through text-xs">{r.oldTitle || r.url}</span>
                    <span className="block truncate text-kumo-default font-medium">{r.newTitle}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" icon={CheckIcon} loading={renameBusy} onClick={applyRenames}>
                Apply selected ({renames.filter(r => r.checked).length})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRenames(null)}>Discard</Button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* Custom prompt */}
      <SettingsCard
        title="Organizer prompt"
        icon={SparkleIcon}
        info="The instruction sent to the AI. {{BOOKMARKS}} is replaced with your bookmark list and must stay in the prompt."
        action={isCustom ? <Badge variant="secondary">Customized</Badge> : <Badge variant="secondary">Default</Badge>}
      >
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full rounded-lg border-2 border-app-border bg-app-bg px-3 py-2 text-sm font-mono text-kumo-default resize-y focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={CheckIcon} loading={busy} onClick={savePrompt}>
            Save prompt
          </Button>
          <Button variant="ghost" size="sm" icon={ArrowCounterClockwiseIcon}
            onClick={() => { setPrompt(defaultPrompt) }}>
            Reset to default
          </Button>
        </div>
      </SettingsCard>

      {/* BYOK */}
      <SettingsCard
        title="Your own API key"
        icon={KeyIcon}
        info="Optional on every plan. Used when included AI isn't available (Free/Pro plans, or after the monthly quota)."
        action={status?.configuredProvider ? <Badge variant="primary">{status.configuredProvider}</Badge> : undefined}
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {BYOK_PROVIDERS.map(p => (
              <button
                key={p.value}
                data-active={provider === p.value}
                className="riso-nav-item px-3 py-1.5 text-sm"
                onClick={() => { setProvider(p.value); setModel(p.model) }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Input
            label="API key"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={provider === 'claude' ? 'sk-ant-…' : provider === 'openai' ? 'sk-…' : 'AIza…'}
          />
          <Input
            label="Model"
            value={model}
            onChange={e => setModel(e.target.value)}
          />
          <Button variant="secondary" icon={CheckIcon} loading={busy} onClick={saveByok} className="self-start">
            Save &amp; test
          </Button>
        </div>
      </SettingsCard>
    </div>
  )
}
