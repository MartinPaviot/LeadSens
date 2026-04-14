'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
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

export function BrandVoiceTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [language, setLanguage] = useState('en')
  const [tone, setTone] = useState('professional')
  const [emailSignature, setEmailSignature] = useState('')
  const [neverMention, setNeverMention] = useState('')
  const [approvedExamples, setApprovedExamples] = useState('')

  useEffect(() => {
    if (!data) return
    const s = (data.workspace.settings as Record<string, unknown>) ?? {}
    setLanguage((s.language as string) ?? 'en')
    setTone((s.tone as string) ?? 'professional')
    setEmailSignature((s.emailSignature as string) ?? '')
    setNeverMention((s.neverMention as string) ?? '')
    setApprovedExamples((s.approvedExamples as string) ?? '')
  }, [data])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: 'brand', language, tone, emailSignature, neverMention, approvedExamples }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Brand & voice settings saved')
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
              <Label htmlFor="lang">Primary language</Label>
              <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Brand Voice Persona</CardTitle></CardHeader>
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
            <Label>Never mention <span className="text-muted-foreground font-normal">(topics, competitors, phrases to avoid)</span></Label>
            <textarea value={neverMention} onChange={(e) => setNeverMention(e.target.value)}
              placeholder="e.g. Don't mention competitor X, avoid pricing discussions..."
              rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
          </div>
          <div className="space-y-2">
            <Label>Voice examples <span className="text-muted-foreground font-normal">(headlines, intros, copy you like)</span></Label>
            <textarea value={approvedExamples} onChange={(e) => setApprovedExamples(e.target.value)}
              placeholder={"e.g.\nHeadline: How We Cut Marketing Costs by 40%\nIntro: Most marketers waste hours on reports nobody reads. Here's a better way.\nCTA: See how it works in 2 minutes."}
              rows={5} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save content & voice'}
      </Button>
    </div>
  )
}
