'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { Plus, Trash } from '@phosphor-icons/react'
import { useSettingsContext } from './settings-context'

type ChannelAllocation = { channel: string; annualBudget: number; monthlyBudget: number }

const CHANNEL_SUGGESTIONS = [
  'Google Ads', 'Meta Ads', 'LinkedIn Ads', 'TikTok Ads', 'X Ads',
  'SEO', 'Content', 'Email', 'Events', 'PR', 'Influencer', 'Affiliate',
]

export function BudgetObjectivesTab() {
  const { data, loading, reload } = useSettingsContext()
  const [saving, setSaving] = useState(false)

  const [annualBudget, setAnnualBudget] = useState<number>(0)
  const [monthlyAdsBudget, setMonthlyAdsBudget] = useState<number>(0)
  const [smsBudget, setSmsBudget] = useState<number>(0)
  const [fiscalYearStart, setFiscalYearStart] = useState('01-01')
  const [channels, setChannels] = useState<ChannelAllocation[]>([])

  const [cplTarget, setCplTarget] = useState<number | ''>('')
  const [cacTarget, setCacTarget] = useState<number | ''>('')
  const [roiMinimum, setRoiMinimum] = useState<number | ''>('')
  const [cpaTarget, setCpaTarget] = useState<number | ''>('')
  const [roasTarget, setRoasTarget] = useState<number | ''>('')

  const [annualRevenue, setAnnualRevenue] = useState<number | ''>('')
  const [quarterlyRevenue, setQuarterlyRevenue] = useState<number[]>([0, 0, 0, 0])
  const [monthlyLeads, setMonthlyLeads] = useState<number | ''>('')

  const [overSpendPercent, setOverSpendPercent] = useState<number>(15)
  const [cacDeviationWeeks, setCacDeviationWeeks] = useState<number>(2)

  useEffect(() => {
    if (!data) return
    const s = (data.workspace.settings as Record<string, unknown>) ?? {}
    setAnnualBudget((s.annualBudget as number) ?? 0)
    setMonthlyAdsBudget((s.monthlyAdsBudget as number) ?? 0)
    setSmsBudget((s.smsBudget as number) ?? 0)
    setFiscalYearStart((s.fiscalYearStart as string) ?? '01-01')
    setChannels((s.channelsAllocation as ChannelAllocation[]) ?? [])

    const kpi = (s.kpiTargets as Record<string, number>) ?? {}
    setCplTarget(kpi.cplTarget ?? '')
    setCacTarget(kpi.cacTarget ?? '')
    setRoiMinimum(kpi.roiMinimum ?? '')
    setCpaTarget(kpi.cpaTarget ?? '')
    setRoasTarget(kpi.roasTarget ?? '')

    const rev = (s.revenueObjectives as Record<string, unknown>) ?? {}
    setAnnualRevenue((rev.annualRevenue as number) ?? '')
    setQuarterlyRevenue((rev.quarterlyRevenue as number[]) ?? [0, 0, 0, 0])
    setMonthlyLeads((rev.monthlyLeads as number) ?? '')

    const al = (s.alertThresholds as Record<string, number>) ?? {}
    setOverSpendPercent(al.overSpendPercent ?? 15)
    setCacDeviationWeeks(al.cacDeviationWeeks ?? 2)
  }, [data])

  const addChannel = () => setChannels((prev) => [...prev, { channel: '', annualBudget: 0, monthlyBudget: 0 }])
  const removeChannel = (i: number) => setChannels((prev) => prev.filter((_, idx) => idx !== i))
  const updateChannel = <K extends keyof ChannelAllocation>(i: number, field: K, value: ChannelAllocation[K]) => {
    setChannels((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)))
  }

  const totalAllocated = channels.reduce((sum, c) => sum + (Number(c.annualBudget) || 0), 0)
  const remaining = Math.max(0, annualBudget - totalAllocated)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'budget',
          annualBudget,
          monthlyAdsBudget,
          smsBudget,
          fiscalYearStart,
          channelsAllocation: channels.filter((c) => c.channel.trim()),
          kpiTargets: {
            cplTarget: cplTarget === '' ? undefined : cplTarget,
            cacTarget: cacTarget === '' ? undefined : cacTarget,
            roiMinimum: roiMinimum === '' ? undefined : roiMinimum,
            cpaTarget: cpaTarget === '' ? undefined : cpaTarget,
            roasTarget: roasTarget === '' ? undefined : roasTarget,
          },
          revenueObjectives: {
            annualRevenue: annualRevenue === '' ? undefined : annualRevenue,
            quarterlyRevenue,
            monthlyLeads: monthlyLeads === '' ? undefined : monthlyLeads,
          },
          alertThresholds: { overSpendPercent, cacDeviationWeeks },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Budget & objectives saved')
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
        <CardHeader><CardTitle>Global Budget</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="annualBudget">Annual budget (EUR)</Label>
              <Input id="annualBudget" className="scroll-mt-16" type="number" min="0" value={annualBudget} onChange={(e) => setAnnualBudget(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStart">Fiscal year start <span className="text-muted-foreground font-normal">(MM-DD)</span></Label>
              <Input id="fiscalYearStart" className="scroll-mt-16" value={fiscalYearStart} onChange={(e) => setFiscalYearStart(e.target.value)} placeholder="01-01" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monthlyAdsBudget">Monthly ads budget</Label>
              <Input id="monthlyAdsBudget" className="scroll-mt-16" type="number" min="0" value={monthlyAdsBudget} onChange={(e) => setMonthlyAdsBudget(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smsBudget">Monthly SMS budget</Label>
              <Input id="smsBudget" className="scroll-mt-16" type="number" min="0" value={smsBudget} onChange={(e) => setSmsBudget(Number(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="channelsAllocation" className="scroll-mt-16">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Channel Allocation</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addChannel}>
              <Plus className="size-4 mr-1" /> Add channel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {channels.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No channels yet. Add how you want your annual budget allocated.</p>
          )}
          {channels.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <Input list="channel-suggestions" placeholder="Channel" value={c.channel}
                onChange={(e) => updateChannel(i, 'channel', e.target.value)} />
              <Input type="number" min="0" placeholder="Annual" value={c.annualBudget} className="w-28"
                onChange={(e) => updateChannel(i, 'annualBudget', Number(e.target.value) || 0)} />
              <Input type="number" min="0" placeholder="Monthly" value={c.monthlyBudget} className="w-28"
                onChange={(e) => updateChannel(i, 'monthlyBudget', Number(e.target.value) || 0)} />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeChannel(i)} className="text-destructive">
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
          <datalist id="channel-suggestions">
            {CHANNEL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
          {channels.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <span className="text-muted-foreground">Allocated: €{totalAllocated.toLocaleString()} / €{annualBudget.toLocaleString()}</span>
              <span className={remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                {remaining === 0 ? 'Fully allocated' : `€${remaining.toLocaleString()} unallocated`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>KPI Targets</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cplTarget">CPL target (EUR)</Label>
              <Input id="cplTarget" className="scroll-mt-16" type="number" min="0" value={cplTarget} onChange={(e) => setCplTarget(e.target.value === '' ? '' : Number(e.target.value))} placeholder="20" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cacTarget">CAC target (EUR)</Label>
              <Input id="cacTarget" className="scroll-mt-16" type="number" min="0" value={cacTarget} onChange={(e) => setCacTarget(e.target.value === '' ? '' : Number(e.target.value))} placeholder="150" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpaTarget">CPA target (EUR)</Label>
              <Input id="cpaTarget" className="scroll-mt-16" type="number" min="0" value={cpaTarget} onChange={(e) => setCpaTarget(e.target.value === '' ? '' : Number(e.target.value))} placeholder="20" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roiMinimum">Minimum ROI <span className="text-muted-foreground font-normal">(e.g. 2 = 2x)</span></Label>
              <Input id="roiMinimum" className="scroll-mt-16" type="number" min="0" step="0.1" value={roiMinimum} onChange={(e) => setRoiMinimum(e.target.value === '' ? '' : Number(e.target.value))} placeholder="2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roasTarget">ROAS target</Label>
              <Input id="roasTarget" className="scroll-mt-16" type="number" min="0" step="0.1" value={roasTarget} onChange={(e) => setRoasTarget(e.target.value === '' ? '' : Number(e.target.value))} placeholder="3" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Revenue Objectives</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="annualRevenue">Annual revenue target (EUR)</Label>
              <Input id="annualRevenue" className="scroll-mt-16" type="number" min="0" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value === '' ? '' : Number(e.target.value))} placeholder="1000000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyLeads">Monthly leads target</Label>
              <Input id="monthlyLeads" className="scroll-mt-16" type="number" min="0" value={monthlyLeads} onChange={(e) => setMonthlyLeads(e.target.value === '' ? '' : Number(e.target.value))} placeholder="50" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Quarterly revenue breakdown</Label>
            <div className="grid grid-cols-4 gap-2">
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                <div key={q}>
                  <div className="text-xs text-muted-foreground mb-1">{q}</div>
                  <Input type="number" min="0" value={quarterlyRevenue[i] ?? 0}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0
                      setQuarterlyRevenue((prev) => prev.map((x, idx) => idx === i ? v : x))
                    }} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alert Thresholds</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="overSpendPercent">Over-spend alert (%)</Label>
              <Input id="overSpendPercent" className="scroll-mt-16" type="number" min="0" max="100" value={overSpendPercent} onChange={(e) => setOverSpendPercent(Number(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground">Alert when a channel exceeds its monthly budget by this %.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cacDeviationWeeks">CAC deviation window (weeks)</Label>
              <Input id="cacDeviationWeeks" className="scroll-mt-16" type="number" min="1" max="52" value={cacDeviationWeeks} onChange={(e) => setCacDeviationWeeks(Number(e.target.value) || 1)} />
              <p className="text-xs text-muted-foreground">Alert if CAC deviates from target for N consecutive weeks.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void handleSave()} disabled={saving} className="w-full text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
        {saving ? 'Saving...' : 'Save budget & objectives'}
      </Button>
    </div>
  )
}
