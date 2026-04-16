'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { Plus, Trash, X } from '@phosphor-icons/react'
import { useSettingsContext } from './settings-context'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
]

const TONES = [
  { value: 'professional', label: 'Professional', desc: 'Formal and business-appropriate' },
  { value: 'casual', label: 'Casual', desc: 'Friendly and conversational' },
  { value: 'technical', label: 'Technical', desc: 'Precise and data-driven' },
]

const POSITIONINGS = [
  { value: 'thought-leader', label: 'Thought leader', desc: 'Opinions, trends, industry takes' },
  { value: 'brand-expert', label: 'Brand expert', desc: 'Product authority' },
  { value: 'personal-brand', label: 'Personal brand', desc: 'Founder-led storytelling' },
  { value: 'corporate', label: 'Corporate', desc: 'Institutional voice' },
]

const VERTICALS = [
  { value: 'b2b', label: 'B2B' },
  { value: 'saas', label: 'SaaS' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'personal-branding', label: 'Personal branding' },
]

const PLATFORMS = ['LinkedIn', 'X / Twitter', 'Instagram', 'TikTok', 'Facebook', 'YouTube', 'Threads', 'Pinterest', 'Reddit']

const PRIORITY_CHANNELS = ['SEO', 'LinkedIn', 'YouTube', 'TikTok', 'Instagram', 'Facebook', 'X', 'Press', 'Email', 'Podcast']

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

type PlatformOverride = { length?: string; tone?: string; hashtags?: boolean; ctaType?: string }

export function BrandVoiceTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [language, setLanguage] = useState('en')
  const [tone, setTone] = useState('professional')
  const [emailSignature, setEmailSignature] = useState('')
  const [neverMention, setNeverMention] = useState('')
  const [approvedExamples, setApprovedExamples] = useState('')

  const [style, setStyle] = useState('')
  const [register, setRegister] = useState('')
  const [positioning, setPositioning] = useState('')
  const [keyPhrases, setKeyPhrases] = useState<string[]>([])
  const [examplePosts, setExamplePosts] = useState<string[]>(['', '', ''])
  const [vertical, setVertical] = useState('')
  const [audienceDescription, setAudienceDescription] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [priorityChannels, setPriorityChannels] = useState<string[]>([])
  const [platformOverrides, setPlatformOverrides] = useState<Record<string, PlatformOverride>>({})

  useEffect(() => {
    if (!data) return
    const s = (data.workspace.settings as Record<string, unknown>) ?? {}
    setLanguage((s.language as string) ?? 'en')
    setTone((s.tone as string) ?? 'professional')
    setEmailSignature((s.emailSignature as string) ?? '')
    setNeverMention((s.neverMention as string) ?? '')
    setApprovedExamples((s.approvedExamples as string) ?? '')
    setStyle((s.style as string) ?? '')
    setRegister((s.register as string) ?? '')
    setPositioning((s.positioning as string) ?? '')
    setKeyPhrases((s.keyPhrases as string[]) ?? [])
    const eps = (s.examplePosts as string[]) ?? []
    setExamplePosts([eps[0] ?? '', eps[1] ?? '', eps[2] ?? ''])
    setVertical((s.vertical as string) ?? '')
    setAudienceDescription((s.audienceDescription as string) ?? '')
    setProductDescription((s.productDescription as string) ?? '')
    setPriorityChannels((s.priorityChannels as string[]) ?? [])
    setPlatformOverrides((s.platformOverrides as Record<string, PlatformOverride>) ?? {})
  }, [data])

  const updateExample = (i: number, val: string) =>
    setExamplePosts((prev) => prev.map((e, idx) => (idx === i ? val : e)))
  const addExample = () => setExamplePosts((prev) => [...prev, ''])
  const removeExample = (i: number) => setExamplePosts((prev) => prev.filter((_, idx) => idx !== i))

  const togglePlatformOverride = (p: string) => {
    setPlatformOverrides((prev) => {
      const next = { ...prev }
      if (next[p]) delete next[p]
      else next[p] = { length: '', tone: '', hashtags: true, ctaType: '' }
      return next
    })
  }
  const updateOverride = <K extends keyof PlatformOverride>(p: string, field: K, value: PlatformOverride[K]) => {
    setPlatformOverrides((prev) => ({ ...prev, [p]: { ...prev[p], [field]: value } }))
  }

  const toggleChannel = (c: string) =>
    setPriorityChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'brand',
          language, tone, emailSignature, neverMention, approvedExamples,
          style: style.trim() || undefined,
          register: register.trim() || undefined,
          positioning: positioning || undefined,
          keyPhrases,
          examplePosts: examplePosts.filter((e) => e.trim()),
          vertical: vertical || undefined,
          audienceDescription: audienceDescription.trim() || undefined,
          productDescription: productDescription.trim() || undefined,
          priorityChannels,
          platformOverrides,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Brand voice saved')
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
        <CardHeader><CardTitle>Language & Tone</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="language">Primary language</Label>
              <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}
                className="scroll-mt-16 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button key={t.value} type="button" onClick={() => setTone(t.value)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors text-left ${
                    tone === t.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  <div>{t.label}</div>
                  <div className="text-xs font-normal opacity-70">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="style">Style <span className="text-muted-foreground font-normal">(free text)</span></Label>
              <Input id="style" className="scroll-mt-16" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="data-driven, short storytelling" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register">Register</Label>
              <Input id="register" className="scroll-mt-16" value={register} onChange={(e) => setRegister(e.target.value)} placeholder="professional but human" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Positioning & Vertical</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Positioning</Label>
            <div id="positioning" className="scroll-mt-16 flex flex-wrap gap-2">
              {POSITIONINGS.map((p) => (
                <button key={p.value} type="button" onClick={() => setPositioning(p.value)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors text-left ${
                    positioning === p.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  <div>{p.label}</div>
                  <div className="text-xs font-normal opacity-70">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vertical</Label>
            <div id="vertical" className="scroll-mt-16 flex flex-wrap gap-2">
              {VERTICALS.map((v) => (
                <button key={v.value} type="button" onClick={() => setVertical(v.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    vertical === v.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Determines default KPIs and benchmarks for paid/social agents.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audience & Product</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audienceDescription">Audience description</Label>
            <textarea id="audienceDescription" value={audienceDescription} onChange={(e) => setAudienceDescription(e.target.value)}
              placeholder="e.g. Busy CMOs at B2B SaaS companies, 50-500 employees, scaling from seed to Series B..."
              rows={3} className="scroll-mt-16 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productDescription">Product description</Label>
            <textarea id="productDescription" value={productDescription} onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Detailed description of what you sell, key features, and differentiators (more detailed than company tagline)..."
              rows={4} className="scroll-mt-16 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Persona Brief</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Describe your brand&apos;s voice so agents generate content that sounds like you.</p>
          <textarea value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)}
            placeholder={"e.g. Expert thought leader, conversational but authoritative.\nWe focus on ROI and data-driven results.\nWe avoid jargon and speak to busy CMOs."}
            rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Content Guidelines</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Key phrases <span className="text-muted-foreground font-normal">(must-use expressions, differentiators)</span></Label>
            <div id="keyPhrases" className="scroll-mt-16"><TagInput tags={keyPhrases} onChange={setKeyPhrases} placeholder="e.g. 'operator-led', 'AI-native'..." /></div>
          </div>
          <div className="space-y-2">
            <Label>Never mention <span className="text-muted-foreground font-normal">(topics, competitors, phrases to avoid)</span></Label>
            <textarea value={neverMention} onChange={(e) => setNeverMention(e.target.value)}
              placeholder="e.g. Don't mention competitor X, avoid pricing discussions..."
              rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
          </div>
          <div className="space-y-2">
            <Label>Voice examples <span className="text-muted-foreground font-normal">(headlines, intros, copy you like)</span></Label>
            <textarea value={approvedExamples} onChange={(e) => setApprovedExamples(e.target.value)}
              placeholder={"e.g.\nHeadline: How We Cut Marketing Costs by 40%\nIntro: Most marketers waste hours on reports nobody reads. Here's a better way."}
              rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Example Posts <span className="text-sm font-normal text-muted-foreground">(paste real posts that represent your voice)</span></CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addExample}>
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {examplePosts.map((ex, i) => (
            <div key={i} className="flex gap-2">
              <textarea value={ex} onChange={(e) => updateExample(i, e.target.value)}
                placeholder={`Example post #${i + 1}`}
                rows={3} className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeExample(i)} className="text-destructive shrink-0">
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Priority Channels</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Which channels should agents prioritize when generating roadmaps and content plans?</p>
          <div id="priorityChannels" className="scroll-mt-16 flex flex-wrap gap-2">
            {PRIORITY_CHANNELS.map((c) => (
              <button key={c} type="button" onClick={() => toggleChannel(c)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  priorityChannels.includes(c) ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                }`}>
                {c}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Platform Overrides <span className="text-sm font-normal text-muted-foreground">(optional)</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Override defaults per platform (length, tone, hashtags, CTA).</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" onClick={() => togglePlatformOverride(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  platformOverrides[p] ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                }`}>
                {p}
              </button>
            ))}
          </div>
          {Object.entries(platformOverrides).map(([p, ov]) => (
            <div key={p} className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">{p}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Length (e.g. 80 words)" value={ov.length ?? ''} onChange={(e) => updateOverride(p, 'length', e.target.value)} />
                <Input placeholder="Tone override" value={ov.tone ?? ''} onChange={(e) => updateOverride(p, 'tone', e.target.value)} />
                <Input placeholder="CTA type (link | comment | dm)" value={ov.ctaType ?? ''} onChange={(e) => updateOverride(p, 'ctaType', e.target.value)} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!ov.hashtags} onChange={(e) => updateOverride(p, 'hashtags', e.target.checked)} />
                  Use hashtags
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save brand voice'}
      </Button>
    </div>
  )
}
