'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
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

const SEO_LEVELS = [
  { value: 'audit', label: 'Audit only', desc: 'Report issues, do nothing' },
  { value: 'semi-auto', label: 'Semi-auto', desc: 'Propose fixes, wait for approval' },
  { value: 'full-auto', label: 'Full auto', desc: 'Fix & publish automatically' },
]

const GENERIC_LEVELS = [
  { value: 'manual', label: 'Manual', desc: 'Agent drafts only' },
  { value: 'supervised', label: 'Supervised', desc: 'Approve before action' },
  { value: 'full-auto', label: 'Full auto', desc: 'Execute without approval' },
]

const INTERACTION_LEVELS = [
  { value: 'full-auto', label: 'Full auto', desc: 'Reply 24/7 autonomously' },
  { value: 'validation', label: 'Validation', desc: 'Draft and wait for approval' },
  { value: 'off-hours', label: 'Off-hours only', desc: 'Auto only outside work hours' },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ESCALATION_CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'sms', label: 'SMS' },
]

const ALERT_CHANNEL_OPTIONS: Array<'email' | 'slack' | 'report'> = ['email', 'slack', 'report']

type Level3 = 'audit' | 'semi-auto' | 'full-auto'
type Level3b = 'manual' | 'supervised' | 'full-auto'
type Level3c = 'full-auto' | 'validation' | 'off-hours'

export function AgentsAutomationTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [dryRunMode, setDryRunMode] = useState(true)
  const [timezone, setTimezone] = useState('Europe/Paris')
  const [reportSchedule, setReportSchedule] = useState('on_demand')
  const [contentApprovalRequired, setContentApprovalRequired] = useState(true)

  const [automationSeo, setAutomationSeo] = useState<Level3>('semi-auto')
  const [automationSocial, setAutomationSocial] = useState<Level3b>('supervised')
  const [automationCrm, setAutomationCrm] = useState<Level3b>('supervised')
  const [automationInteraction, setAutomationInteraction] = useState<Level3c>('validation')

  const [offHoursEnabled, setOffHoursEnabled] = useState(false)
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [spamDeletion, setSpamDeletion] = useState(true)

  const [escalationChannel, setEscalationChannel] = useState<'email' | 'slack' | 'sms'>('email')
  const [alertChannels, setAlertChannels] = useState<Array<'email' | 'slack' | 'report'>>(['email'])
  const [sentimentMin, setSentimentMin] = useState<number>(-0.5)
  const [influencerAudienceMin, setInfluencerAudienceMin] = useState<number>(10000)
  const [leadScoreMin, setLeadScoreMin] = useState<number>(70)

  useEffect(() => {
    if (!data) return
    const ws = data.workspace
    const s = (ws.settings as Record<string, unknown>) ?? {}
    setDryRunMode(ws.dryRunMode)
    setTimezone(ws.timezone ?? 'Europe/Paris')
    setReportSchedule((s.reportSchedule as string) ?? 'on_demand')
    setContentApprovalRequired((s.contentApprovalRequired as boolean) ?? true)

    setAutomationSeo((s.automationSeo as Level3) ?? 'semi-auto')
    setAutomationSocial((s.automationSocial as Level3b) ?? 'supervised')
    setAutomationCrm((s.automationCrm as Level3b) ?? 'supervised')
    setAutomationInteraction((s.automationInteraction as Level3c) ?? 'validation')

    setOffHoursEnabled((s.offHoursEnabled as boolean) ?? false)
    setWorkStart((s.workStart as string) ?? '09:00')
    setWorkEnd((s.workEnd as string) ?? '18:00')
    setWorkDays((s.workDays as number[]) ?? [1, 2, 3, 4, 5])
    setSpamDeletion((s.spamDeletion as boolean) ?? true)

    setEscalationChannel((s.escalationChannel as 'email' | 'slack' | 'sms') ?? 'email')
    setAlertChannels((s.alertChannels as Array<'email' | 'slack' | 'report'>) ?? ['email'])

    const th = (s.escalationThresholds as Record<string, number>) ?? {}
    setSentimentMin(th.sentimentMin ?? -0.5)
    setInfluencerAudienceMin(th.influencerAudienceMin ?? 10000)
    setLeadScoreMin(th.leadScoreMin ?? 70)
  }, [data])

  const toggleDay = (d: number) =>
    setWorkDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort())
  const toggleAlert = (a: 'email' | 'slack' | 'report') =>
    setAlertChannels((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'agents',
          dryRunMode, timezone, reportSchedule, contentApprovalRequired,
          automationSeo, automationSocial, automationCrm, automationInteraction,
          offHoursEnabled, workStart, workEnd, workDays, spamDeletion,
          escalationChannel, alertChannels,
          escalationThresholds: { sentimentMin, influencerAudienceMin, leadScoreMin },
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
      <Card className={dryRunMode ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-300 bg-emerald-50/50'}>
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-semibold">{dryRunMode ? 'Dry Run Mode — ON (all agents)' : 'Live Mode — ON'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dryRunMode
                ? 'Global kill switch: agents simulate without writing or publishing.'
                : 'Agents will execute per-family autonomy levels below.'}
            </p>
          </div>
          <button type="button" onClick={() => setDryRunMode(!dryRunMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dryRunMode ? 'bg-amber-400' : 'bg-emerald-500'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dryRunMode ? 'translate-x-1' : 'translate-x-6'}`} />
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Per-family Autonomy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div id="automationSeo" className="scroll-mt-16"><LevelSelector label="SEO agents" options={SEO_LEVELS} value={automationSeo} onChange={(v) => setAutomationSeo(v as Level3)} /></div>
          <div id="automationSocial" className="scroll-mt-16"><LevelSelector label="Social (ads + content)" options={GENERIC_LEVELS} value={automationSocial} onChange={(v) => setAutomationSocial(v as Level3b)} /></div>
          <div id="automationCrm" className="scroll-mt-16"><LevelSelector label="CRM campaigns" options={GENERIC_LEVELS} value={automationCrm} onChange={(v) => setAutomationCrm(v as Level3b)} /></div>
          <div id="automationInteraction" className="scroll-mt-16"><LevelSelector label="Social interaction (replies)" options={INTERACTION_LEVELS} value={automationInteraction} onChange={(v) => setAutomationInteraction(v as Level3c)} /></div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader><CardTitle>Work Schedule (Social Interaction)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm">Enable off-hours schedule</p>
            <button type="button" onClick={() => setOffHoursEnabled(!offHoursEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${offHoursEnabled ? 'bg-[#17c3b2]' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${offHoursEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {offHoursEnabled && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="offHoursStart">Work start</Label>
                  <Input id="offHoursStart" className="scroll-mt-16" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offHoursEnd">Work end</Label>
                  <Input id="offHoursEnd" className="scroll-mt-16" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Work days</Label>
                <div className="flex gap-2">
                  {WEEKDAYS.map((d, i) => (
                    <button key={d} type="button" onClick={() => toggleDay(i)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                        workDays.includes(i) ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm">Auto-delete detected spam</p>
            <button type="button" onClick={() => setSpamDeletion(!spamDeletion)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${spamDeletion ? 'bg-[#17c3b2]' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${spamDeletion ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Escalation & Alerts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Escalation channel <span className="text-muted-foreground font-normal">(for urgent human handoff)</span></Label>
            <div id="escalationChannel" className="scroll-mt-16 flex flex-wrap gap-2">
              {ESCALATION_CHANNELS.map((c) => (
                <button key={c.value} type="button" onClick={() => setEscalationChannel(c.value as 'email' | 'slack' | 'sms')}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    escalationChannel === c.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alert channels <span className="text-muted-foreground font-normal">(non-urgent: performance reports, suggestions)</span></Label>
            <div className="flex flex-wrap gap-2">
              {ALERT_CHANNEL_OPTIONS.map((a) => (
                <button key={a} type="button" onClick={() => toggleAlert(a)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    alertChannels.includes(a) ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                  }`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sent">Negative sentiment trigger <span className="text-muted-foreground font-normal">(-1 to 1)</span></Label>
              <Input id="sent" type="number" min="-1" max="1" step="0.1" value={sentimentMin} onChange={(e) => setSentimentMin(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inf">Influencer audience min</Label>
              <Input id="inf" type="number" min="0" value={influencerAudienceMin} onChange={(e) => setInfluencerAudienceMin(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead">Hot lead score min <span className="text-muted-foreground font-normal">(0-100)</span></Label>
              <Input id="lead" type="number" min="0" max="100" value={leadScoreMin} onChange={(e) => setLeadScoreMin(Number(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Schedule & Timezone</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Report schedule</Label>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="tz">Timezone</Label>
            <select id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save automation settings'}
      </Button>
    </div>
  )
}

function LevelSelector({
  label, options, value, onChange,
}: {
  label: string
  options: Array<{ value: string; label: string; desc: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-2 text-xs font-medium border transition-colors text-left flex-1 min-w-[140px] ${
              value === o.value ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
            }`}>
            <div>{o.label}</div>
            <div className="text-[10px] font-normal opacity-70">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
