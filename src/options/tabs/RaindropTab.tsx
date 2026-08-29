import { useState } from 'react'
import { Tabs } from '@cloudflare/kumo/components/tabs'
import { ConnectTab } from './ConnectTab'
import { SyncTab } from './SyncTab'
import type { ToastState } from '../OptionsApp'

interface RaindropTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

type SubTab = 'connection' | 'sync'

export function RaindropTab({ showToast }: RaindropTabProps) {
  const [sub, setSub] = useState<SubTab>('connection')
  return (
    <div className="flex flex-col gap-8">
      <Tabs
        tabs={[
          { value: 'connection', label: 'Connection' },
          { value: 'sync', label: 'Sync' },
        ]}
        value={sub}
        onValueChange={v => setSub(v as SubTab)}
      />
      {sub === 'connection'
        ? <ConnectTab showToast={showToast} />
        : <SyncTab showToast={showToast} />}
    </div>
  )
}
