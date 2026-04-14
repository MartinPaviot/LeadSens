'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { useSettingsContext } from './settings-context'

const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo',
  'Asia/Shanghai', 'Australia/Sydney',
]

const REPORT_SCHEDULES = [
  { value: 'on_demand', label: 'On demand', desc: 'Run reports manually' },
  { value: 'weekly', label: 'Weekly', desc: 'Every Monday morning' },
  { value: 'monthly', label: 'Monthly', desc: 'First of each month' },
]

export function AgentsAutomationTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [dryRunMode, setDryRunMode] = useState(true)
  const [timezone, setTimezone] = useState('Europe/Paris')
  const [reportSchedule, setReportSchedule] = useState('on_demand')
  const [contentApprovalRequired, setContentApprovalRequired] = useState(true)

  useEffect(() => {
    if (!data) return
    const ws = data.workspace
    const s = (ws.settings as Record<string, unknown>) ?? {}
    setDryRunMode(ws.dryRunMode)
    setTimezone(ws.timezone ?? 'Europe/Paris')
    setReportSchedule((s.reportSchedule as string) ?? 'on_demand')
    setContentApprovalRequired((s.contentApprovalRequired as boolean) ?? true)
  }, [data])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'agents',
          dryRunMode,
          timezone,
          reportSchedule,
          contentApprovalRequired,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Automation settings saved')
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
      {/* Dry Run Mode */}
      <Card className={dryRunMode ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-300 bg-emerald-50/50'}>
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-semibold">{dryRunMode ? 'Dry Run Mode — ON' : 'Live Mode — ON'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dryRunMode
                ? 'Agents simulate without writing or publishing. Safe to test.'
                : 'Agents will execute actions for real (publish content, send reports).'}
            </p>
          </div>
          <button type="button" onClick={() => setDryRunMode(!dryRunMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dryRunMode ? 'bg-amber-400' : 'bg-emerald-500'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dryRunMode ? 'translate-x-1' : 'translate-x-6'}`} />
          </button>
        </CardContent>
      </Card>

      {/* Content Approval */}
      <Card>
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-semibold">Content Approval Required</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contentApprovalRequired
                ? 'Agents will draft content and wait for your review before publishing.'
                : 'Agents can auto-publish content without review.'}
            </p>
          </div>
          <button type="button" onClick={() => setContentApprovalRequired(!contentApprovalRequired)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${contentApprovalRequired ? 'bg-[#17c3b2]' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${contentApprovalRequired ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </CardContent>
      </Card>

      {/* Report Schedule */}
      <Card>
        <CardHeader><CardTitle>Report Schedule</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {REPORT_SCHEDULES.map((s) => (
              <button key={s.value} type="button" onClick={() => setReportSchedule(s.value)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors text-left ${
                  reportSchedule === s.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                }`}>
                <div>{s.label}</div>
                <div className="text-xs font-normal opacity-70">{s.desc}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader><CardTitle>Timezone</CardTitle></CardHeader>
        <CardContent>
          <Label htmlFor="tz" className="sr-only">Timezone</Label>
          <select id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save automation settings'}
      </Button>
    </div>
  )
}
