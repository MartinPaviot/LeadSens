'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { X } from '@phosphor-icons/react'
import { useSettingsContext } from './settings-context'

const CMS_OPTIONS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'hubspot', label: 'HubSpot CMS' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'webflow', label: 'Webflow' },
  { value: 'other', label: 'Other' },
]

const GEO_LEVELS = [
  { value: 'national', label: 'National' },
  { value: 'regional', label: 'Regional' },
  { value: 'city', label: 'City' },
  { value: 'multi-geo', label: 'Multi-geo' },
]

const MATURITY_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'Few pages indexed, no SEO history' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Some rankings, structured content' },
  { value: 'advanced', label: 'Advanced', desc: 'Strong authority, mature ops' },
]

const BUSINESS_OBJECTIVES = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'lead-gen', label: 'Lead gen' },
  { value: 'sales', label: 'Sales' },
  { value: 'local-awareness', label: 'Local awareness' },
]

const PRIORITIZATION = [
  { value: 'volume', label: 'Volume first', desc: 'Maximize search volume' },
  { value: 'conversion', label: 'Conversion first', desc: 'Maximize commercial intent' },
]

const ALERT_CHANNELS = [
  { value: 'slack', label: 'Slack' },
  { value: 'email', label: 'Email' },
  { value: 'report', label: 'Report only' },
]

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')
  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) { onChange([...tags, val]); setInput('') }
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
    </div>
  )
}

export function SeoSiteTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [cmsType, setCmsType] = useState('')
  const [geoLevel, setGeoLevel] = useState('')
  const [targetGeos, setTargetGeos] = useState<string[]>([])
  const [priorityPages, setPriorityPages] = useState<string[]>([])
  const [googleBusinessProfileId, setGoogleBusinessProfileId] = useState('')
  const [seoMaturity, setSeoMaturity] = useState('')
  const [monthlyContentCapacity, setMonthlyContentCapacity] = useState<number>(4)
  const [prioritization, setPrioritization] = useState('')
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [secondaryKeyword, setSecondaryKeyword] = useState('')
  const [businessObjective, setBusinessObjective] = useState('')
  const [alertChannel, setAlertChannel] = useState('')

  useEffect(() => {
    if (!data) return
    const s = (data.workspace.settings as Record<string, unknown>) ?? {}
    setCmsType((s.cmsType as string) ?? '')
    setGeoLevel((s.geoLevel as string) ?? '')
    setTargetGeos((s.targetGeos as string[]) ?? [])
    setPriorityPages((s.priorityPages as string[]) ?? [])
    setGoogleBusinessProfileId((s.googleBusinessProfileId as string) ?? '')
    setSeoMaturity((s.seoMaturity as string) ?? '')
    setMonthlyContentCapacity((s.monthlyContentCapacity as number) ?? 4)
    setPrioritization((s.prioritization as string) ?? '')
    setPrimaryKeyword((s.primaryKeyword as string) ?? '')
    setSecondaryKeyword((s.secondaryKeyword as string) ?? '')
    setBusinessObjective((s.businessObjective as string) ?? '')
    setAlertChannel((s.alertChannel as string) ?? '')
  }, [data])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'seo',
          cmsType: cmsType || undefined,
          geoLevel: geoLevel || undefined,
          targetGeos,
          priorityPages,
          googleBusinessProfileId: googleBusinessProfileId.trim() || undefined,
          seoMaturity: seoMaturity || undefined,
          monthlyContentCapacity,
          prioritization: prioritization || undefined,
          primaryKeyword: primaryKeyword.trim() || undefined,
          secondaryKeyword: secondaryKeyword.trim() || undefined,
          businessObjective: businessObjective || undefined,
          alertChannel: alertChannel || undefined,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('SEO & Site settings saved')
      await reload()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const toggleGeo = (g: string) =>
    setTargetGeos((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>CMS & Publishing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cmsType">CMS</Label>
            <select id="cmsType" value={cmsType} onChange={(e) => setCmsType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Select CMS...</option>
              {CMS_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Required for semi-auto / full-auto publishing by SEO agents. Connect the matching integration in the Integrations tab.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gbp">Google Business Profile ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="googleBusinessProfileId" value={googleBusinessProfileId} onChange={(e) => setGoogleBusinessProfileId(e.target.value)} placeholder="accounts/123/locations/456" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Geographic Targeting</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Geo level</Label>
            <div id="geoLevel" className="flex flex-wrap gap-2 scroll-mt-16">
              {GEO_LEVELS.map((g) => (
                <button key={g.value} type="button" onClick={() => setGeoLevel(g.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    geoLevel === g.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target geos <span className="text-muted-foreground font-normal">(cities, regions, or countries to target)</span></Label>
            <TagInput tags={targetGeos} onChange={setTargetGeos} placeholder="e.g. Paris, Lyon, France..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Priority Pages</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">URLs agents should monitor / optimize first (homepage, key services, pillar pages).</p>
          <TagInput tags={priorityPages} onChange={setPriorityPages} placeholder="https://site.com/page" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Strategy & Keywords</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryKeyword">Primary keyword</Label>
              <Input id="primaryKeyword" value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} placeholder="e.g. marketing automation" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryKeyword">Secondary keyword</Label>
              <Input id="secondaryKeyword" value={secondaryKeyword} onChange={(e) => setSecondaryKeyword(e.target.value)} placeholder="e.g. email marketing ai" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Business objective</Label>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_OBJECTIVES.map((o) => (
                <button key={o.value} type="button" onClick={() => setBusinessObjective(o.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    businessObjective === o.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>SEO maturity</Label>
            <div className="flex flex-wrap gap-2">
              {MATURITY_LEVELS.map((m) => (
                <button key={m.value} type="button" onClick={() => setSeoMaturity(m.value)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors text-left ${
                    seoMaturity === m.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  <div>{m.label}</div>
                  <div className="text-xs font-normal opacity-70">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cap">Monthly content capacity <span className="text-muted-foreground font-normal">(articles/month)</span></Label>
              <Input id="cap" type="number" min="0" max="500" value={monthlyContentCapacity}
                onChange={(e) => setMonthlyContentCapacity(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Prioritization</Label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIZATION.map((p) => (
                  <button key={p.value} type="button" onClick={() => setPrioritization(p.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium border transition-colors text-left ${
                      prioritization === p.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                    }`}>
                    <div>{p.label}</div>
                    <div className="text-[10px] font-normal opacity-70">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
        <CardContent>
          <Label>Where should agents send SEO alerts?</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {ALERT_CHANNELS.map((a) => (
              <button key={a.value} type="button" onClick={() => setAlertChannel(a.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  alertChannel === a.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                }`}>
                {a.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save SEO & Site settings'}
      </Button>
    </div>
  )
}
