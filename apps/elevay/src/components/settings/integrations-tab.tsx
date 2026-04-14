'use client'

import { Button } from '@/components/ui-brand-intel/button'
import { Card, CardContent } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { useSettingsContext } from './settings-context'

interface ProviderConfig {
  key: string
  label: string
  description: string
  icon: React.ReactNode
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: 'linkedin', label: 'LinkedIn', description: 'Company page analytics',
    icon: <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0"><rect width="36" height="36" rx="8" fill="#0A66C2"/><path d="M12.5 15.5H15V25H12.5V15.5ZM13.75 11C14.58 11 15.25 11.67 15.25 12.5C15.25 13.33 14.58 14 13.75 14C12.92 14 12.25 13.33 12.25 12.5C12.25 11.67 12.92 11 13.75 11ZM17.5 15.5H19.9V16.6H19.93C20.27 15.97 21.09 15.3 22.33 15.3C24.96 15.3 25.5 17.03 25.5 19.27V25H23V19.77C23 18.55 22.98 16.97 21.3 16.97C19.6 16.97 19.5 18.31 19.5 19.69V25H17V15.5H17.5Z" fill="white"/></svg>,
  },
  {
    key: 'ga', label: 'Google Analytics', description: 'Traffic & conversion data',
    icon: <img src="/logos/google-analytics.svg" alt="GA" width={32} height={32} className="shrink-0 rounded-lg" />,
  },
  {
    key: 'gsc', label: 'Google Search Console', description: 'Search performance data',
    icon: <img src="/logos/google-search-console.png" alt="GSC" width={32} height={32} className="shrink-0 rounded-lg" />,
  },
  {
    key: 'facebook', label: 'Facebook', description: 'Page insights & engagement',
    icon: <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0"><rect width="36" height="36" rx="8" fill="#1877F2"/><path d="M25 18C25 14.134 21.866 11 18 11C14.134 11 11 14.134 11 18C11 21.494 13.552 24.393 16.906 24.916V20.031H15.004V18H16.906V16.338C16.906 14.461 18.01 13.438 19.725 13.438C20.547 13.438 21.406 13.586 21.406 13.586V15.43H20.46C19.527 15.43 19.234 16.01 19.234 16.605V18H21.32L20.986 20.031H19.234V24.916C22.588 24.393 25 21.494 25 18Z" fill="white"/></svg>,
  },
  {
    key: 'instagram', label: 'Instagram', description: 'Profile & engagement data',
    icon: <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0"><defs><radialGradient id="ig-set" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs><rect width="36" height="36" rx="8" fill="url(#ig-set)"/><rect x="10" y="10" width="16" height="16" rx="5" stroke="white" strokeWidth="1.5" fill="none"/><circle cx="18" cy="18" r="4" stroke="white" strokeWidth="1.5" fill="none"/><circle cx="22.5" cy="13.5" r="1" fill="white"/></svg>,
  },
  {
    key: 'slack', label: 'Slack', description: 'Notifications & alerts',
    icon: <img src="/logos/slack.png" alt="Slack" width={32} height={32} className="shrink-0 rounded-lg" />,
  },
  {
    key: 'ahrefs', label: 'Ahrefs', description: 'Competitive SEO analysis',
    icon: <img src="/logos/ahrefs.ico" alt="Ahrefs" width={32} height={32} className="shrink-0 rounded-lg" />,
  },
  {
    key: 'semrush', label: 'SEMrush', description: 'Keyword intelligence',
    icon: <img src="/logos/semrush.ico" alt="SEMrush" width={32} height={32} className="shrink-0 rounded-lg" />,
  },
]

async function handleConnect(platform: string) {
  try {
    const res = await fetch(`/api/auth/social/${platform}/connect`, { method: 'POST' })
    const data = (await res.json()) as { redirectUrl?: string; message?: string }
    if (data.redirectUrl) {
      window.open(data.redirectUrl, `${platform}_oauth`, 'width=600,height=700')
    } else {
      toast.error(data.message ?? 'Connection unavailable')
    }
  } catch {
    toast.error('Connection failed')
  }
}

export function IntegrationsTab() {
  const { data, loading } = useSettingsContext()

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>

  // Check social_connections from brand profile or integrations
  const integrations = data?.integrations ?? []
  const ws = data?.workspace
  const sc = ((ws?.settings as Record<string, unknown>)?.socialConnections as Record<string, boolean>) ?? {}

  const isConnected = (key: string): boolean => {
    if (sc[key] === true) return true
    return integrations.some((i) => i.type.toLowerCase() === key && i.status === 'ACTIVE')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect your tools to enrich agent analysis with real data.</p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const connected = isConnected(provider.key)
          return (
            <Card key={provider.key}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {provider.icon}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{provider.label}</p>
                      {connected && (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-medium">Connected</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {connected ? 'Connected' : provider.description}
                    </p>
                  </div>
                </div>
                {connected ? (
                  <Button variant="outline" size="sm" className="text-xs text-destructive">Disconnect</Button>
                ) : (
                  <Button size="sm" className="text-xs" onClick={() => void handleConnect(provider.key)}>Connect</Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
