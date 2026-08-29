import { useState, useEffect, useCallback } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { Input } from '@cloudflare/kumo/components/input'
import { Text } from '@cloudflare/kumo/components/text'
import { Badge } from '@cloudflare/kumo/components/badge'
import { CrownIcon, KeyIcon, CheckIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'
import { SettingsCard } from '../components/SettingsCard'
import type { ToastState } from '../OptionsApp'

interface PlanTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

function send<T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: `license.${action}`, ...extra }, (res) => {
      const err = chrome.runtime.lastError
      if (err) return reject(new Error(err.message))
      if (!res?.success) return reject(new Error(res?.error || 'Unknown error'))
      resolve(res.data as T)
    })
  })
}

interface LicenseStatus {
  plan: 'free' | 'pro' | 'ai_pro'
  features: Record<string, boolean>
  hasKey: boolean
  keyMasked: string | null
  aiUsage: { used: number; limit: number; month: string } | null
}

const CHECKOUT = {
  pro:    { monthly: 'https://buy.polar.sh/polar_cl_Rplju0vM2Kb17FrVcfWwA0ck1gqBYIhGuwbFB2VfHtd', yearly: 'https://buy.polar.sh/polar_cl_nEkVfJFaG12LPxHZdD2H107ahGJuKqjlztui410JoZR' },
  ai_pro: { monthly: 'https://buy.polar.sh/polar_cl_VS8w17jntLT2qh1Az96K8hwbl6mMi5ETXT5nE4IiLQb', yearly: 'https://buy.polar.sh/polar_cl_SGpNRwDbwxHcNzAa8Hr5YLu91adIGPdzIkmEq2sdSql' },
}

const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', ai_pro: 'AI Pro' }

const FEATURES: { label: string; free: boolean; pro: boolean; ai: boolean }[] = [
  { label: 'Bookmark manager, Raindrop.io sync, tools', free: true, pro: true, ai: true },
  { label: 'E2E encrypted cloud sync (single profile)', free: true, pro: true, ai: true },
  { label: 'AI Organizer with your own API key + review before apply', free: true, pro: true, ai: true },
  { label: 'Omnibox quick search ("f" in the address bar)', free: true, pro: true, ai: true },
  { label: 'Duplicate finder & cleanup, HTML export & import', free: true, pro: true, ai: true },
  { label: 'One-click save + trash with 30-day undo', free: true, pro: true, ai: true },
  { label: 'New tab dashboard (clock, search, bookmark chips)', free: true, pro: true, ai: true },
  { label: 'Tracking-parameter cleaner (utm, fbclid…)', free: true, pro: true, ai: true },
  { label: 'Multiple sync profiles', free: false, pro: true, ai: true },
  { label: 'Version history & restore', free: false, pro: true, ai: true },
  { label: 'Extension list backup', free: false, pro: true, ai: true },
  { label: 'Dead link checker + scheduled scans with badge', free: false, pro: true, ai: true },
  { label: 'Auto-rules (URL pattern → folder)', free: false, pro: true, ai: true },
  { label: 'Session saver (tabs → dated folder)', free: false, pro: true, ai: true },
  { label: 'Included AI — organize, folder suggestions, smart rename (300 ops/mo)', free: false, pro: false, ai: true },
]

export function PlanTab({ showToast }: PlanTabProps) {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState('')

  const refresh = useCallback(async () => {
    try { setStatus(await send<LicenseStatus>('status')) }
    catch (e) { showToast('License status failed: ' + (e instanceof Error ? e.message : ''), 'error') }
  }, [showToast])

  useEffect(() => { refresh() }, [refresh])

  async function doActivate() {
    if (!key.trim()) { showToast('Enter your license key', 'error'); return }
    setBusy(true)
    try {
      const r = await send<{ plan: string }>('activate', { key: key.trim() })
      setKey('')
      showToast(`License activated — plan: ${PLAN_LABELS[r.plan] || r.plan}`, 'success')
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showToast(msg === 'not_a_folio_key'
        ? 'That key belongs to another product (Folio keys start with FPRO- or FAI-).'
        : 'Activation failed: ' + msg, 'error')
    } finally { setBusy(false) }
  }

  async function doDeactivate() {
    setBusy(true)
    try {
      await send('deactivate')
      showToast('License deactivated on this browser', 'success')
      await refresh()
    } catch (e) {
      showToast('Deactivation failed: ' + (e instanceof Error ? e.message : ''), 'error')
    } finally { setBusy(false) }
  }

  const plan = status?.plan || 'free'

  return (
    <div className="flex flex-col gap-6">
      {/* Current plan */}
      <SettingsCard
        title="Your plan"
        icon={CrownIcon}
        action={<Badge variant={plan === 'free' ? 'secondary' : 'primary'}>{PLAN_LABELS[plan]}</Badge>}
      >
        {plan === 'free' ? (
          <Text className="text-sm text-kumo-subtle">
            You're on the free plan — the bookmark manager, Raindrop sync and encrypted cloud sync
            for one profile are all included, forever. Upgrade for multiple profiles, version
            history, and hands-free AI organization.
          </Text>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <Text className="text-sm text-kumo-subtle">
              License <code className="font-mono">{status?.keyMasked}</code> is active on this browser.
            </Text>
            <Button variant="ghost" size="sm" loading={busy} onClick={doDeactivate}>Deactivate here</Button>
          </div>
        )}
        <div className="flex flex-col gap-1.5 mt-1">
          {FEATURES.map((f, i) => {
            const has = plan === 'ai_pro' ? f.ai : plan === 'pro' ? f.pro : f.free
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={has ? 'text-kumo-success' : 'text-kumo-subtle'}>{has ? '✓' : '—'}</span>
                <span className={has ? 'text-kumo-default' : 'text-kumo-subtle'}>{f.label}</span>
              </div>
            )
          })}
        </div>
      </SettingsCard>

      {/* Upgrade */}
      {plan !== 'ai_pro' && (
        <SettingsCard title="Upgrade" icon={ArrowSquareOutIcon}>
          <div className="grid grid-cols-2 gap-3">
            {plan === 'free' && (
              <div className="riso-card p-5 flex flex-col gap-2">
                <Text bold>Pro</Text>
                <Text size="sm" className="text-kumo-subtle">$2/month · profiles, history, dead-link checker, sessions</Text>
                <div className="flex gap-2 mt-2">
                  <Button variant="secondary" size="sm" onClick={() => window.open(CHECKOUT.pro.monthly)}>Monthly</Button>
                  <Button variant="ghost" size="sm" onClick={() => window.open(CHECKOUT.pro.yearly)}>Yearly $20</Button>
                </div>
              </div>
            )}
            <div className="riso-card p-5 flex flex-col gap-2">
              <Text bold>AI Pro</Text>
              <Text size="sm" className="text-kumo-subtle">$5/month · everything in Pro + included AI (300 ops/month)</Text>
              <div className="flex gap-2 mt-2">
                <Button variant="primary" size="sm" onClick={() => window.open(CHECKOUT.ai_pro.monthly)}>Monthly</Button>
                <Button variant="ghost" size="sm" onClick={() => window.open(CHECKOUT.ai_pro.yearly)}>Yearly $50</Button>
              </div>
            </div>
          </div>
          <Text size="sm" className="text-kumo-subtle">
            After checkout your license key (FPRO-… or FAI-…) arrives by email — paste it below.
          </Text>
        </SettingsCard>
      )}

      {/* Activate */}
      <SettingsCard title="License key" icon={KeyIcon}>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Key"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="FAI-XXXX-XXXX-XXXX or FPRO-XXXX-XXXX-XXXX"
            />
          </div>
          <Button variant="primary" icon={CheckIcon} loading={busy} onClick={doActivate}>Activate</Button>
        </div>
        <Text size="sm" className="text-kumo-subtle">
          One license covers up to 10 browsers. Manage or free activation slots any time from the
          purchase email's Polar link.
        </Text>
      </SettingsCard>
    </div>
  )
}
