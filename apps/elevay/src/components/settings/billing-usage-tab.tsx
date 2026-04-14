'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { useSettingsContext } from './settings-context'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function BillingUsageTab() {
  const { data, loading } = useSettingsContext()

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>

  const usage = data?.usage
  if (!usage) return <div className="text-sm text-muted-foreground py-8 text-center">No usage data available.</div>

  const monthName = new Date().toLocaleString('en', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Usage — {monthName}</h2>
        <p className="text-sm text-muted-foreground mt-1">Current month activity across your workspace.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Chat Sessions" value={usage.chatSessions.toLocaleString()} />
        <StatCard label="Agent Runs" value={usage.agentRuns.toLocaleString()} />
        <StatCard label="AI Calls" value={usage.aiCalls.toLocaleString()} sub={`$${usage.aiCost.toFixed(2)} total cost`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Token Usage</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Input tokens</p>
              <p className="text-lg font-semibold mt-1">{usage.tokensIn.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Output tokens</p>
              <p className="text-lg font-semibold mt-1">{usage.tokensOut.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Early Access</p>
              <p className="text-xs text-muted-foreground">You are on the early access plan. Billing details will be available soon.</p>
            </div>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-medium">Active</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
