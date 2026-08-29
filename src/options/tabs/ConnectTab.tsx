import { useState, useEffect, useCallback } from 'react'
import { Banner } from '@cloudflare/kumo/components/banner'
import { Button } from '@cloudflare/kumo/components/button'
import { Dialog } from '@cloudflare/kumo/components/dialog'
import { Input } from '@cloudflare/kumo/components/input'
import { SensitiveInput } from '@cloudflare/kumo/components/sensitive-input'
import { Select } from '@cloudflare/kumo/components/select'
import { Text } from '@cloudflare/kumo/components/text'
import { Badge } from '@cloudflare/kumo/components/badge'
import { PlugsConnectedIcon, PlugIcon, TrashIcon, FlaskIcon, CheckCircleIcon, XCircleIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { getStorage, setStorage, removeStorage } from '../../lib/chrome'
import { SettingsCard } from '../components/SettingsCard'
import type { ToastState } from '../OptionsApp'

interface ConnectTabProps {
  showToast: (msg: string, type: ToastState['type']) => void
}

type AuthMethod = 'managed' | 'manual'
type AuthStatusType = 'connected' | 'disconnected' | 'checking'

export function ConnectTab({ showToast }: ConnectTabProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('managed')
  const [managedBaseUrl, setManagedBaseUrl] = useState('https://oauth.folio.daiquiri.dev')
  const [tokenError, setTokenError] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [authStatus, setAuthStatus] = useState<AuthStatusType>('checking')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(true)
  const [authStateText, setAuthStateText] = useState('')
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)

  const checkPrivacyClosed = useCallback(async () => {
    const data = await getStorage(['accessToken'])
    if (data.accessToken) setShowPrivacy(false)
  }, [])

  const updateAuthStatus = useCallback(async () => {
    setAuthStatus('checking')
    const { accessToken } = await getStorage(['accessToken'])
    if (!accessToken) {
      setAuthStatus('disconnected')
      setUserName('')
      setUserEmail('')
      return
    }
    try {
      const res = await fetch('https://api.raindrop.io/rest/v1/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUserName(data.user?.name || '')
        setUserEmail(data.user?.email || '')
        setAuthStatus('connected')
      } else {
        setAuthStatus('disconnected')
      }
    } catch {
      setAuthStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    checkPrivacyClosed()
    updateAuthStatus()
    chrome.storage.local.get(['raindropAuthError']).then(d => setTokenError(!!d.raindropAuthError))
    getStorage(['clientId', 'clientSecret', 'managedOAuth', 'managedOAuthBaseUrl', 'redirectUri']).then(cfg => {
      if (cfg.clientId) setClientId(cfg.clientId)
      if (cfg.clientSecret) setClientSecret(cfg.clientSecret)
      if (cfg.managedOAuthBaseUrl) setManagedBaseUrl(cfg.managedOAuthBaseUrl)
      else setManagedBaseUrl('https://oauth.folio.daiquiri.dev')
      if (cfg.redirectUri) setRedirectUri(cfg.redirectUri)
      else if (chrome.identity?.getRedirectURL) setRedirectUri(chrome.identity.getRedirectURL())
      setAuthMethod(cfg.managedOAuth !== false ? 'managed' : 'manual')
    })
  }, [checkPrivacyClosed, updateAuthStatus])

  async function authenticate() {
    setIsAuthenticating(true)
    showToast('Opening authentication...', 'info')
    try {
      const oauth = new (window as unknown as { RaindropOAuth: new () => { startAuthFlow: () => Promise<void> } }).RaindropOAuth()
      await oauth.startAuthFlow()
      await chrome.storage.local.remove(['raindropAuthError'])
      setTokenError(false)
      showToast('Successfully connected!', 'success')
      await updateAuthStatus()
    } catch (e: unknown) {
      showToast('Connection failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error')
    } finally {
      setIsAuthenticating(false)
    }
  }

  async function testConnection() {
    setIsTesting(true)
    showToast('Testing connection...', 'info')
    try {
      await updateAuthStatus()
      if (authStatus === 'connected') {
        showToast('Connection successful!', 'success')
      } else {
        showToast('Connection failed — not authenticated', 'error')
      }
    } finally {
      setIsTesting(false)
    }
  }

  function logout() {
    setConfirmLogoutOpen(true)
  }

  async function executeLogout() {
    setConfirmLogoutOpen(false)
    await removeStorage(['accessToken', 'refreshToken', 'tokenExpiresAt'])
    setAuthStatus('disconnected')
    setUserName('')
    setUserEmail('')
    showToast('Disconnected successfully', 'success')
  }

  async function saveConfig() {
    await setStorage({
      clientId,
      clientSecret,
      managedOAuth: authMethod === 'managed',
      managedOAuthBaseUrl: managedBaseUrl,
      redirectUri,
    })
    showToast('Configuration saved', 'success')
  }

  async function viewAuthState() {
    const keys: (keyof Parameters<typeof getStorage>[0][number])[] = ['managedOAuth', 'managedOAuthBaseUrl', 'redirectUri', 'clientId']
    const data = await getStorage(keys as never)
    const { accessToken, refreshToken, tokenExpiresAt } = await chrome.storage.sync.get(['accessToken', 'refreshToken', 'tokenExpiresAt'])
    const out = {
      ...data,
      accessToken: accessToken ? `(present:${String(accessToken).slice(0, 6)}…)` : '(missing)',
      refreshToken: refreshToken ? '(present)' : '(missing)',
      tokenExpiresAt,
    }
    setAuthStateText(JSON.stringify(out, null, 2))
  }

  const statusBadge = authStatus === 'connected'
    ? <Badge variant="primary" className="flex items-center gap-1"><CheckCircleIcon size={14} />Connected</Badge>
    : authStatus === 'disconnected'
    ? <Badge variant="destructive" className="flex items-center gap-1"><XCircleIcon size={14} />Not Connected</Badge>
    : <Badge variant="secondary">Checking…</Badge>

  return (
    <div className="flex flex-col gap-8">
      {/* Token refresh error */}
      {tokenError && (
        <Banner
          variant="error"
          icon={<XCircleIcon size={18} />}
          title="Authentication expired"
          description="Raindrop sync stopped because the token could not be refreshed. Re-authenticate to resume."
          action={
            <Button variant="ghost" size="sm" onClick={authenticate}>
              Reconnect
            </Button>
          }
        />
      )}

      {/* Privacy Notice */}
      {showPrivacy && (
        <Banner
          variant="default"
          icon={<ShieldCheckIcon size={18} />}
          title="Privacy & Security"
          description="No telemetry or tracking. This extension does not collect any usage data, analytics, or personal information. All data stays on your device and your chosen sync service (Raindrop.io). Authentication tokens are stored locally in Chrome's secure storage."
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowPrivacy(false)} aria-label="Dismiss">
              Dismiss
            </Button>
          }
        />
      )}

      {/* Authentication */}
      <SettingsCard title="Authentication" bodyClassName="px-6 py-6 flex flex-col gap-6">
        <Select
          label="Authentication Method"
          description="Choose how to authenticate with Raindrop.io. Managed OAuth is safer and easier."
          value={authMethod}
          onValueChange={(v) => setAuthMethod((v ?? 'managed') as AuthMethod)}
          items={{ managed: 'Managed OAuth (Recommended)', manual: 'Manual Configuration' }}
        >
          <Select.Option value="managed">Managed OAuth (Recommended)</Select.Option>
          <Select.Option value="manual">Manual Configuration</Select.Option>
        </Select>

        {/* Auth Status — inline, no box */}
        <div className="flex items-center gap-3">
          {statusBadge}
          {userName && (
            <Text size="sm" variant="secondary">
              {userName}{userEmail ? ` · ${userEmail}` : ''}
            </Text>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={PlugsConnectedIcon}
            loading={isAuthenticating}
            onClick={authenticate}
          >
            Authenticate with Raindrop
          </Button>
          <Button
            variant="secondary"
            icon={FlaskIcon}
            loading={isTesting}
            onClick={testConnection}
          >
            Test Connection
          </Button>
          {authStatus === 'connected' && (
            <Button variant="destructive" icon={TrashIcon} onClick={logout}>
              Logout
            </Button>
          )}
        </div>
      </SettingsCard>

      {/* Manual Configuration */}
      {authMethod === 'manual' && (
        <SettingsCard title="Manual Configuration">
          <SensitiveInput
            label="Client ID"
            value={clientId}
            onValueChange={setClientId}
            description="Stored locally via Chrome storage. Hidden by default for privacy."
          />
          <SensitiveInput
            label="Client Secret"
            value={clientSecret}
            onValueChange={setClientSecret}
            description="Do not share your client secret."
          />
          <div>
            <Input
              label="Redirect URI"
              value={redirectUri}
              onChange={e => setRedirectUri(e.target.value)}
              placeholder="Extension identity redirect (auto)"
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              icon={PlugIcon}
              onClick={() => {
                if (chrome.identity?.getRedirectURL) {
                  setRedirectUri(chrome.identity.getRedirectURL())
                }
              }}
            >
              Reset to default
            </Button>
          </div>
          <div>
            <Button variant="primary" onClick={saveConfig}>Save Configuration</Button>
          </div>
        </SettingsCard>
      )}

      {/* Logout confirmation */}
      <Dialog.Root role="alertdialog" open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
        <Dialog className="p-6 flex flex-col gap-4" size="sm">
          <Dialog.Title>Disconnect from Raindrop.io?</Dialog.Title>
          <Dialog.Description>
            Your tokens will be cleared from this device. You'll need to re-authenticate to sync again.
          </Dialog.Description>
          <div className="flex gap-2 justify-end">
            <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
            <Dialog.Close render={
              <Button variant="destructive" size="sm" icon={TrashIcon} onClick={executeLogout}>
                Disconnect
              </Button>
            } />
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Debug Panel */}
      <SettingsCard title="Debug">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={viewAuthState}>View Auth State</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              await removeStorage(['accessToken', 'refreshToken', 'tokenExpiresAt'])
              setAuthStateText('Tokens cleared.')
              await updateAuthStatus()
            }}
          >
            Clear Tokens
          </Button>
        </div>
        {authStateText && (
          <pre className="text-xs bg-kumo-recessed border border-kumo-line rounded-md px-4 py-3 overflow-auto max-h-48 text-kumo-default font-mono leading-relaxed">
            {authStateText}
          </pre>
        )}
      </SettingsCard>
    </div>
  )
}
