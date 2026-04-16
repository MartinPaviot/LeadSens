'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { useSettingsContext } from './settings-context'

const INDUSTRIES = [
  'Technology', 'SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Education',
  'Real Estate', 'Manufacturing', 'Consulting', 'Marketing', 'Media', 'Other',
]

const SIZES = ['1-10', '11-50', '51-200', '200+']

const COUNTRIES = [
  'France', 'United States', 'United Kingdom', 'Germany', 'Spain',
  'Netherlands', 'Belgium', 'Switzerland', 'Canada', 'Australia',
]

const GEOS = [
  'North America', 'Europe', 'UK & Ireland', 'DACH', 'Nordics',
  'Southern Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa',
]

export function CompanyProfileTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState('')
  const [country, setCountry] = useState('')
  const [description, setDescription] = useState('')
  const [valueProp, setValueProp] = useState('')
  const [targetMarkets, setTargetMarkets] = useState<string[]>([])

  useEffect(() => {
    if (!data) return
    const ws = data.workspace
    setName(ws.name ?? '')
    setCompanyUrl(ws.companyUrl ?? '')
    setIndustry(ws.industry ?? '')
    setSize(ws.size ?? '')
    setCountry(ws.country ?? '')
    setDescription(ws.description ?? '')
    setValueProp(ws.valueProp ?? '')
    setTargetMarkets(ws.targetMarkets ?? [])
  }, [data])

  const toggleMarket = (geo: string) => {
    setTargetMarkets((prev) =>
      prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo],
    )
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'company',
          name: name.trim(),
          companyUrl: companyUrl.trim() || undefined,
          industry: industry || undefined,
          size: size || undefined,
          country: country || undefined,
          description: description.trim() || undefined,
          valueProp: valueProp.trim() || undefined,
          targetMarkets,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Company profile saved')
      await reload()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Company Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Company name *</Label>
              <Input id="name" className="scroll-mt-16" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyUrl">Website</Label>
              <Input id="companyUrl" className="scroll-mt-16" type="url" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://acme.com" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}
                className="scroll-mt-16 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Select...</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Company size</Label>
              <select id="size" value={size} onChange={(e) => setSize(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Select...</option>
                {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}
                className="scroll-mt-16 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Select...</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valueProp">Value proposition</Label>
              <Input id="valueProp" className="scroll-mt-16" value={valueProp} onChange={(e) => setValueProp(e.target.value)} placeholder="One-liner about your product" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description <span className="text-muted-foreground font-normal">(max 200 chars)</span></Label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))} placeholder="Brief company description..."
              rows={3} maxLength={200}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            <p className="text-xs text-muted-foreground text-right">{description.length}/200</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Target Markets</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {GEOS.map((geo) => (
              <button key={geo} type="button" onClick={() => toggleMarket(geo)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  targetMarkets.includes(geo) ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                }`}>
                {geo}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save company profile'}
      </Button>
    </div>
  )
}
