'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { useSettingsContext } from './settings-context'
import { Plus, Trash, X } from '@phosphor-icons/react'

const VERTICALS = [
  'Technology', 'SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Education',
  'Real Estate', 'Manufacturing', 'Consulting', 'Marketing', 'Media', 'Retail',
  'Logistics', 'Energy', 'Automotive', 'Travel & Hospitality',
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

export function IcpTargetingTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [competitors, setCompetitors] = useState<Array<{ name: string; url: string }>>([])
  const [industryVerticals, setIndustryVerticals] = useState<string[]>([])
  const [monitorKeywords, setMonitorKeywords] = useState<string[]>([])
  const [excludedSectors, setExcludedSectors] = useState<string[]>([])

  useEffect(() => {
    if (!data) return
    const s = (data.workspace.settings as Record<string, unknown>) ?? {}
    setCompetitors((s.competitors as Array<{ name: string; url: string }>) ?? [])
    setIndustryVerticals((s.industryVerticals as string[]) ?? [])
    setMonitorKeywords((s.monitorKeywords as string[]) ?? [])
    setExcludedSectors((s.excludedSectors as string[]) ?? [])
  }, [data])

  const addCompetitor = () => setCompetitors((prev) => [...prev, { name: '', url: '' }])

  const removeCompetitor = (index: number) => setCompetitors((prev) => prev.filter((_, i) => i !== index))

  const updateCompetitor = (index: number, field: 'name' | 'url', value: string) => {
    setCompetitors((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }

  const toggleVertical = (v: string) => {
    setIndustryVerticals((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'competitive',
          competitors: competitors.filter((c) => c.name.trim() || c.url.trim()),
          industryVerticals,
          monitorKeywords,
          excludedSectors,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Competitive intelligence settings saved')
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
      {/* Competitors */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Competitors to Monitor</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addCompetitor}>
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {competitors.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No competitors added yet. Add competitors to track their strategy.</p>
          )}
          {competitors.map((comp, i) => (
            <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input placeholder="Competitor name" value={comp.name} onChange={(e) => updateCompetitor(i, 'name', e.target.value)} className="flex-1" />
              <Input placeholder="https://competitor.com" value={comp.url} onChange={(e) => updateCompetitor(i, 'url', e.target.value)} className="flex-1" />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeCompetitor(i)} className="text-destructive shrink-0">
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Industry Verticals */}
      <Card>
        <CardHeader><CardTitle>Industry Verticals</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Select the market verticals you want agents to monitor for trends and opportunities.</p>
          <div className="flex flex-wrap gap-2">
            {VERTICALS.map((v) => (
              <button key={v} type="button" onClick={() => toggleVertical(v)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  industryVerticals.includes(v) ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keywords to Monitor */}
      <Card>
        <CardHeader><CardTitle>Keywords to Monitor</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Keywords for trend tracking, content opportunities, and competitive alerts.</p>
          <TagInput tags={monitorKeywords} onChange={setMonitorKeywords} placeholder="e.g. AI marketing, content automation..." />
        </CardContent>
      </Card>

      {/* Excluded Sectors */}
      <Card>
        <CardHeader><CardTitle>Excluded Sectors</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Sectors you don&apos;t serve — agents will exclude these from recommendations.</p>
          <TagInput tags={excludedSectors} onChange={setExcludedSectors} placeholder="e.g. gambling, tobacco..." />
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save competitive intelligence'}
      </Button>
    </div>
  )
}
