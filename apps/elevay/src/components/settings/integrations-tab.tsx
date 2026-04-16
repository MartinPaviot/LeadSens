'use client'

import { Button } from '@/components/ui-brand-intel/button'
import { Card, CardContent } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { useSettingsContext } from './settings-context'

interface ProviderConfig {
  key: string
  label: string
  description: string
  category: 'Social' | 'CMS' | 'Analytics' | 'Ads' | 'CRM & Support' | 'Email / SMS' | 'SEO Intelligence' | 'Productivity'
}

const PROVIDERS: ProviderConfig[] = [
  // Social organic
  { key: 'linkedin', label: 'LinkedIn', description: 'Company page + posts', category: 'Social' },
  { key: 'facebook', label: 'Facebook', description: 'Page insights & engagement', category: 'Social' },
  { key: 'instagram', label: 'Instagram', description: 'Profile & engagement data', category: 'Social' },
  { key: 'tiktok', label: 'TikTok', description: 'Account analytics + posting', category: 'Social' },
  { key: 'youtube', label: 'YouTube', description: 'Channel analytics + uploads', category: 'Social' },
  { key: 'x', label: 'X / Twitter', description: 'Posts + analytics', category: 'Social' },
  { key: 'pinterest', label: 'Pinterest', description: 'Pins + board analytics', category: 'Social' },
  { key: 'reddit', label: 'Reddit', description: 'Subreddit activity', category: 'Social' },
  { key: 'threads', label: 'Threads', description: 'Posts + engagement', category: 'Social' },

  // CMS — required for SEO agents publishing
  { key: 'wordpress', label: 'WordPress', description: 'Publish SEO content & meta', category: 'CMS' },
  { key: 'hubspot_cms', label: 'HubSpot CMS', description: 'Blog + landing pages', category: 'CMS' },
  { key: 'shopify', label: 'Shopify', description: 'Products + meta descriptions', category: 'CMS' },
  { key: 'webflow', label: 'Webflow', description: 'CMS items + SEO fields', category: 'CMS' },

  // Analytics
  { key: 'ga', label: 'Google Analytics', description: 'Traffic & conversion data', category: 'Analytics' },
  { key: 'gsc', label: 'Google Search Console', description: 'Search performance data', category: 'Analytics' },
  { key: 'gdrive', label: 'Google Drive', description: 'Store exports & reports', category: 'Productivity' },

  // Ads
  { key: 'google_ads', label: 'Google Ads', description: 'Campaigns + spend', category: 'Ads' },
  { key: 'meta_ads', label: 'Meta Ads', description: 'Facebook + Instagram Ads', category: 'Ads' },
  { key: 'linkedin_ads', label: 'LinkedIn Ads', description: 'B2B campaigns', category: 'Ads' },
  { key: 'tiktok_ads', label: 'TikTok Ads', description: 'Spark Ads + performance', category: 'Ads' },
  { key: 'x_ads', label: 'X Ads', description: 'Promoted posts', category: 'Ads' },

  // CRM & Support
  { key: 'hubspot', label: 'HubSpot CRM', description: 'Contacts, deals, lifecycle', category: 'CRM & Support' },
  { key: 'salesforce', label: 'Salesforce', description: 'Leads + opportunities', category: 'CRM & Support' },
  { key: 'pipedrive', label: 'Pipedrive', description: 'Pipeline + deals', category: 'CRM & Support' },
  { key: 'zendesk', label: 'Zendesk', description: 'Tickets + customer support', category: 'CRM & Support' },
  { key: 'freshdesk', label: 'Freshdesk', description: 'Tickets + helpdesk', category: 'CRM & Support' },

  // Email / SMS
  { key: 'klaviyo', label: 'Klaviyo', description: 'E-commerce email + SMS', category: 'Email / SMS' },
  { key: 'brevo', label: 'Brevo', description: 'Email + SMS campaigns', category: 'Email / SMS' },

  // SEO Intelligence
  { key: 'ahrefs', label: 'Ahrefs', description: 'Competitive SEO analysis', category: 'SEO Intelligence' },
  { key: 'semrush', label: 'SEMrush', description: 'Keyword intelligence', category: 'SEO Intelligence' },

  // Productivity
  { key: 'slack', label: 'Slack', description: 'Notifications & escalation', category: 'Productivity' },
]

const CATEGORIES: Array<ProviderConfig['category']> = [
  'Social', 'CMS', 'Analytics', 'Ads', 'CRM & Support', 'Email / SMS', 'SEO Intelligence', 'Productivity',
]

async function handleConnect(platform: string) {
  try {
    const res = await fetch(`/api/auth/social/${platform}/connect`, { method: 'POST' })
    const data = (await res.json()) as { redirectUrl?: string; message?: string }
    if (data.redirectUrl) {
      window.open(data.redirectUrl, `${platform}_oauth`, 'width=600,height=700')
    } else {
      toast.error(data.message ?? 'Connection unavailable — contact support to enable this provider')
    }
  } catch {
    toast.error('Connection failed')
  }
}

export function IntegrationsTab() {
  const { data, loading } = useSettingsContext()

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>

  const integrations = data?.integrations ?? []
  const ws = data?.workspace
  const sc = ((ws?.settings as Record<string, unknown>)?.socialConnections as Record<string, boolean>) ?? {}

  const isConnected = (key: string): boolean => {
    if (sc[key] === true) return true
    return integrations.some((i) => i.type.toLowerCase() === key && i.status === 'ACTIVE')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect your tools to unlock the full power of each agent. Agents gracefully degrade if a tool isn&apos;t connected.</p>
      </div>

      {CATEGORIES.map((cat) => {
        const providers = PROVIDERS.filter((p) => p.category === cat)
        if (providers.length === 0) return null
        return (
          <div key={cat} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h3>
            <div className="space-y-2">
              {providers.map((provider) => {
                const connected = isConnected(provider.key)
                return (
                  <Card key={provider.key}>
                    <CardContent className="flex items-center justify-between py-3">
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
      })}
    </div>
  )
}
