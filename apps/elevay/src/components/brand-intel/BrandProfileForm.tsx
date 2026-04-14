'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'

export interface BrandProfileFormData {
  brand_name: string
  brand_url: string
  country: string
  language: string
  primary_keyword: string
  secondary_keyword: string
  sector: string
  priority_channels: string[]
  objective: string
  competitors: Array<{ name: string; url: string }>
}

export type SocialConnectionStatus = Record<string, boolean>

type PlatformKey = 'linkedin' | 'ga' | 'gsc' | 'facebook' | 'instagram'

interface SocialPlatformConfig {
  key: PlatformKey
  label: string
  description: string
  icon: React.ReactNode
}

const SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    description: 'Company page analytics',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <rect width="36" height="36" rx="8" fill="#0A66C2"/>
        <path d="M12.5 15.5H15V25H12.5V15.5ZM13.75 11C14.58 11 15.25 11.67 15.25 12.5C15.25 13.33 14.58 14 13.75 14C12.92 14 12.25 13.33 12.25 12.5C12.25 11.67 12.92 11 13.75 11ZM17.5 15.5H19.9V16.6H19.93C20.27 15.97 21.09 15.3 22.33 15.3C24.96 15.3 25.5 17.03 25.5 19.27V25H23V19.77C23 18.55 22.98 16.97 21.3 16.97C19.6 16.97 19.5 18.31 19.5 19.69V25H17V15.5H17.5Z" fill="white"/>
      </svg>
    ),
  },
  {
    key: 'ga',
    label: 'Google Analytics',
    description: 'Traffic & conversion data',
    icon: <img src="/logos/google-analytics.svg" alt="Google Analytics" width={36} height={36} className="shrink-0 rounded-lg" />,
  },
  {
    key: 'gsc',
    label: 'Google Search Console',
    description: 'Search performance data',
    icon: <img src="/logos/google-search-console.png" alt="Google Search Console" width={36} height={36} className="shrink-0 rounded-lg" />,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    description: 'Page insights & engagement',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <rect width="36" height="36" rx="8" fill="#1877F2"/>
        <path d="M25 18C25 14.134 21.866 11 18 11C14.134 11 11 14.134 11 18C11 21.494 13.552 24.393 16.906 24.916V20.031H15.004V18H16.906V16.338C16.906 14.461 18.01 13.438 19.725 13.438C20.547 13.438 21.406 13.586 21.406 13.586V15.43H20.46C19.527 15.43 19.234 16.01 19.234 16.605V18H21.32L20.986 20.031H19.234V24.916C22.588 24.393 25 21.494 25 18Z" fill="white"/>
      </svg>
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    description: 'Profile & engagement data',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <defs>
          <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497"/>
            <stop offset="5%" stopColor="#fdf497"/>
            <stop offset="45%" stopColor="#fd5949"/>
            <stop offset="60%" stopColor="#d6249f"/>
            <stop offset="90%" stopColor="#285AEB"/>
          </radialGradient>
        </defs>
        <rect width="36" height="36" rx="8" fill="url(#ig-grad)"/>
        <rect x="10" y="10" width="16" height="16" rx="5" stroke="white" strokeWidth="1.5" fill="none"/>
        <circle cx="18" cy="18" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
        <circle cx="22.5" cy="13.5" r="1" fill="white"/>
      </svg>
    ),
  },
]

interface BrandProfileFormProps {
  initialData?: Partial<BrandProfileFormData>
  socialStatus?: SocialConnectionStatus
  onSave: (data: BrandProfileFormData) => Promise<void>
  onSocialConnected?: (platform: string) => void
}

const COUNTRIES = [
  { value: 'FR', label: 'France' },
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'ES', label: 'Spain' },
]

const LANGUAGES = [
  { value: 'fr', label: 'French' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
]

const CHANNELS = ['SEO', 'LinkedIn', 'Facebook', 'YouTube', 'TikTok', 'Instagram', 'X', 'Press'] as const

const OBJECTIVES = [
  { value: 'lead_gen', label: 'Lead Generation' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'retention', label: 'Retention' },
  { value: 'branding', label: 'Branding' },
]

async function handleConnect(platform: PlatformKey) {
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

async function handleDisconnect(platform: PlatformKey) {
  const res = await fetch(`/api/auth/social/disconnect?platform=${platform}`, { method: 'DELETE' })
  if (res.ok) {
    toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} disconnected`)
    window.location.reload()
  } else {
    toast.error('Disconnect failed')
  }
}

export function BrandProfileForm({ initialData, socialStatus, onSave, onSocialConnected }: BrandProfileFormProps) {
  const [brandName, setBrandName] = useState(initialData?.brand_name ?? '')
  const [brandUrl, setBrandUrl] = useState(initialData?.brand_url ?? '')
  const [country, setCountry] = useState(initialData?.country ?? 'FR')
  const [language, setLanguage] = useState(initialData?.language ?? 'fr')
  const [primaryKeyword, setPrimaryKeyword] = useState(initialData?.primary_keyword ?? '')
  const [secondaryKeyword, setSecondaryKeyword] = useState(initialData?.secondary_keyword ?? '')
  const [sector, setSector] = useState(initialData?.sector ?? '')
  const [priorityChannels, setPriorityChannels] = useState<string[]>(initialData?.priority_channels ?? [])
  const [objective, setObjective] = useState(initialData?.objective ?? 'lead_gen')
  const [competitors, setCompetitors] = useState<Array<{ name: string; url: string }>>(
    initialData?.competitors ?? [{ name: '', url: '' }],
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.data?.type === 'SOCIAL_CONNECTED' && ev.data.platform) {
        onSocialConnected?.(ev.data.platform as string)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onSocialConnected])

  const toggleChannel = (ch: string) => {
    setPriorityChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    )
  }

  const addCompetitor = () => {
    setCompetitors((prev) => [...prev, { name: '', url: '' }])
  }

  const removeCompetitor = (index: number) => {
    setCompetitors((prev) => prev.filter((_, i) => i !== index))
  }

  const updateCompetitor = (index: number, field: 'name' | 'url', value: string) => {
    setCompetitors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!brandName.trim()) {
      toast.error('Brand name is required')
      return
    }

    try {
      new URL(brandUrl)
    } catch {
      toast.error('Brand URL is invalid')
      return
    }

    setSaving(true)
    try {
      await onSave({
        brand_name: brandName.trim(),
        brand_url: brandUrl.trim(),
        country,
        language,
        primary_keyword: primaryKeyword.trim(),
        secondary_keyword: secondaryKeyword.trim(),
        sector: sector.trim(),
        priority_channels: priorityChannels,
        objective,
        competitors: competitors.filter((c) => c.name.trim() && c.url.trim()),
      })
    } catch (err) {
      toast.error(`Error: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand_name">Brand name *</Label>
              <Input
                id="brand_name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="GrowthPilot"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_url">Website URL *</Label>
              <Input
                id="brand_url"
                type="url"
                value={brandUrl}
                onChange={(e) => setBrandUrl(e.target.value)}
                placeholder="https://growthpilot.io"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sector">Industry / Sector</Label>
            <Input
              id="sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Marketing SaaS"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keywords</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary_keyword">Primary keyword *</Label>
              <Input
                id="primary_keyword"
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                placeholder="marketing automation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_keyword">Secondary keyword *</Label>
              <Input
                id="secondary_keyword"
                value={secondaryKeyword}
                onChange={(e) => setSecondaryKeyword(e.target.value)}
                placeholder="lead generation SaaS"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priority Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={`
                  rounded-full px-3 py-2 text-sm font-medium border transition-colors
                  ${priorityChannels.includes(ch)
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }
                `}
              >
                {ch}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objective</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Competitors</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addCompetitor}>
              + Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {competitors.map((comp, i) => (
            <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                placeholder="Name"
                value={comp.name}
                onChange={(e) => updateCompetitor(i, 'name', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="https://..."
                value={comp.url}
                onChange={(e) => updateCompetitor(i, 'url', e.target.value)}
                className="flex-1"
              />
              {competitors.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeCompetitor(i)}
                  className="shrink-0"
                >
                  &times;
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Connect your accounts to enrich agent analysis with real data.
          </p>

          {SOCIAL_PLATFORMS.map((platform) => {
            const connected = socialStatus?.[platform.key] === true
            return (
              <div key={platform.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2.5">
                  {platform.icon}
                  <div>
                    <p className="text-sm font-medium">{platform.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {connected ? 'Connected' : platform.description}
                    </p>
                  </div>
                </div>
                {connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDisconnect(platform.key)}
                    className="text-xs text-destructive"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleConnect(platform.key)}
                    className="text-xs"
                  >
                    Connect
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving...' : 'Save profile'}
      </Button>
    </form>
  )
}
