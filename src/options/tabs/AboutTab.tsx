import { useState, useEffect } from 'react'
import { LinkButton } from '@cloudflare/kumo/components/button'
import { Text } from '@cloudflare/kumo/components/text'
import { GithubLogoIcon, BugIcon, GlobeIcon, ArrowsClockwiseIcon, ListBulletsIcon } from '@phosphor-icons/react'
import { SettingsCard } from '../components/SettingsCard'
import type { ToastState } from '../OptionsApp'

interface AboutTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

interface SyncHistoryEntry {
  timestamp: number
  status: 'success' | 'error'
  message: string
  count?: number
}

interface ActivityEntry {
  timestamp: number
  action: string
  detail?: string
}

export function AboutTab(_props: AboutTabProps) {
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([])
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])

  useEffect(() => {
    chrome.storage.local.get(['syncHistory', 'activityLog']).then(data => {
      if (data.syncHistory) setSyncHistory((data.syncHistory as SyncHistoryEntry[]).slice(-20).reverse())
      if (data.activityLog) setActivityLog((data.activityLog as ActivityEntry[]).slice(-50).reverse())
    })
  }, [])

  return (
    <div className="flex flex-col gap-8">
      {/* Sync History */}
      <SettingsCard title="Sync History" icon={ArrowsClockwiseIcon}>
        <div className="border border-kumo-line rounded-md h-48 overflow-y-auto px-4 py-3 bg-kumo-recessed font-mono text-xs leading-relaxed">
          {syncHistory.length === 0 ? (
            <span className="text-kumo-subtle">No sync history available.</span>
          ) : (
            syncHistory.map((entry, i) => (
              <div key={i} className="mb-1">
                <span className="text-kumo-subtle mr-2">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className={entry.status === 'error' ? 'text-red-500' : 'text-green-600'}>[{entry.status.toUpperCase()}]</span>
                {' '}{entry.message}
                {entry.count != null && ` (${entry.count} items)`}
              </div>
            ))
          )}
        </div>
      </SettingsCard>

      {/* Activity Log */}
      <SettingsCard title="Activity Log" icon={ListBulletsIcon}>
        <div className="border border-kumo-line rounded-md h-48 overflow-y-auto px-4 py-3 bg-kumo-recessed font-mono text-xs leading-relaxed">
          {activityLog.length === 0 ? (
            <span className="text-kumo-subtle">No activity recorded.</span>
          ) : (
            activityLog.map((entry, i) => (
              <div key={i} className="mb-1 text-kumo-default">
                <span className="text-kumo-subtle mr-2">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                {entry.action}
                {entry.detail && <span className="text-kumo-subtle"> — {entry.detail}</span>}
              </div>
            ))
          )}
        </div>
      </SettingsCard>

      {/* About */}
      <SettingsCard title="About & Support">
        <Text size="sm">Folio v1.4.0</Text>
        <div className="flex flex-wrap gap-3">
          <LinkButton variant="secondary" icon={GlobeIcon} href="https://spacechild.dev" external>
            Website
          </LinkButton>
          <LinkButton variant="secondary" icon={GithubLogoIcon} href="https://github.com/spacechild-dev/folio-bookmark-manager" external>
            GitHub
          </LinkButton>
          <LinkButton variant="secondary" icon={BugIcon} href="https://github.com/spacechild-dev/folio-bookmark-manager/issues" external>
            Report Issue
          </LinkButton>
        </div>
      </SettingsCard>
    </div>
  )
}
