'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { AgentOutput } from '@/agents/_shared/types'
import type { BpiOutput } from '@/agents/bpi-01/types'
import type { MtsOutput } from '@/agents/mts-02/types'
import type { CiaOutput } from '@/agents/cia-03/types'
import { mockDashboardData, type DashboardData } from './mockDashboardData'
import { AgentProgress } from './AgentProgress'
import { OverviewTab } from './tabs/OverviewTab'
import { AuditTab } from './tabs/AuditTab'
import { TrendsTab } from './tabs/TrendsTab'
import { CompetitiveTab } from './tabs/CompetitiveTab'
import { TabNav } from './TabNav'
import { BrandProfileForm, type BrandProfileFormData, type SocialConnectionStatus } from './BrandProfileForm'
import { ThemeToggle } from '@/components/chat/theme-toggle'
import { GearSix } from '@phosphor-icons/react'
import { Button } from '@/components/ui-brand-intel/button'
import { NoConfigBanner } from '@/components/ui-brand-intel/no-config-banner'
import { checkNoConfig, type NoConfigInfo } from '@/lib/no-config-check'
import { toast } from 'sonner'

type AgentKey = 'bpi' | 'mts' | 'cia'
type AgentState = 'idle' | 'running' | 'done' | 'error'
type TabId = 'overview' | 'audit' | 'trends' | 'competitive'

interface Runs {
  bpi: AgentOutput<BpiOutput> | null
  mts: AgentOutput<MtsOutput> | null
  cia: AgentOutput<CiaOutput> | null
}

const AGENT_ROUTES: Record<AgentKey, string> = {
  bpi: '/api/agents/bmi/bpi-01',
  mts: '/api/agents/bmi/mts-02',
  cia: '/api/agents/bmi/cia-03',
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'audit', label: 'Online Presence' },
  { id: 'trends', label: 'Trends' },
  { id: 'competitive', label: 'Competitive Analysis' },
]

export function BrandIntelDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [runs, setRuns] = useState<Runs>({ bpi: null, mts: null, cia: null })
  const [profile, setProfile] = useState<DashboardData['profile']>(null)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [socialStatus, setSocialStatus] = useState<SocialConnectionStatus>({})
  const [agentStates, setAgentStates] = useState<Record<AgentKey, AgentState>>({
    bpi: 'idle',
    mts: 'idle',
    cia: 'idle',
  })
  const [progress, setProgress] = useState<Record<AgentKey, string>>({
    bpi: '',
    mts: '',
    cia: '',
  })
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [loaded, setLoaded] = useState(false)
  const [noConfig, setNoConfig] = useState<NoConfigInfo | null>(null)

  // Load dashboard data on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/agents/bmi/dashboard')
        if (!res.ok) throw new Error('fetch failed')
        const data = (await res.json()) as DashboardData
        if (data.bpi || data.mts || data.cia) {
          setRuns({
            bpi: data.bpi as AgentOutput<BpiOutput> | null,
            mts: data.mts as AgentOutput<MtsOutput> | null,
            cia: data.cia as AgentOutput<CiaOutput> | null,
          })
          if (data.profile) {
            setProfile(data.profile)
            const p = data.profile as unknown as Record<string, unknown>
            const sc = (p.social_connections as Record<string, boolean> | null) ?? {}
            setSocialStatus({
              facebook: p.facebookConnected === true || sc.facebook === true,
              instagram: p.instagramConnected === true || sc.instagram === true,
              linkedin: sc.linkedin === true,
              ga: sc.ga === true,
              gsc: sc.gsc === true,
            })
          }
        } else {
          // No runs — use mock data
          setRuns({
            bpi: mockDashboardData.bpi,
            mts: mockDashboardData.mts,
            cia: mockDashboardData.cia,
          })
          setProfile(mockDashboardData.profile)
        }
      } catch {
        // Fallback to mock data
        setRuns({
          bpi: mockDashboardData.bpi,
          mts: mockDashboardData.mts,
          cia: mockDashboardData.cia,
        })
        setProfile(mockDashboardData.profile)
      } finally {
        setLoaded(true)
      }
    }
    void load()
  }, [])

  // Handle OAuth popup postMessage callback
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.data?.type === 'SOCIAL_CONNECTED' && ev.data.platform) {
        const platform = ev.data.platform as string
        setSocialStatus((prev) => ({ ...prev, [platform]: true }))
        toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected`)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Handle OAuth callback query param (fallback)
  useEffect(() => {
    const connected = searchParams.get('connected')
    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully`)
      setSocialStatus((prev) => ({ ...prev, [connected]: true }))
      router.replace('/brand-intel')
    }
    const error = searchParams.get('error')
    if (error) {
      toast.error(`Connection failed: ${error}`)
      router.replace('/brand-intel')
    }
  }, [searchParams, router])

  const setAgentState = useCallback((key: AgentKey, state: AgentState) => {
    setAgentStates((prev) => ({ ...prev, [key]: state }))
  }, [])

  const setAgentProgress = useCallback((key: AgentKey, message: string) => {
    setProgress((prev) => ({ ...prev, [key]: message }))
  }, [])

  const updateRun = useCallback((key: AgentKey, output: unknown) => {
    if (!profile) return
    setRuns((prev) => {
      const agentCodeMap: Record<AgentKey, 'BPI-01' | 'MTS-02' | 'CIA-03'> = {
        bpi: 'BPI-01',
        mts: 'MTS-02',
        cia: 'CIA-03',
      }
      const wrapped: AgentOutput<unknown> = {
        agent_code: agentCodeMap[key],
        analysis_date: new Date().toISOString(),
        brand_profile: profile,
        payload: output,
        degraded_sources: [],
        version: '1.0',
      }
      return { ...prev, [key]: wrapped }
    })
  }, [profile])

  // C11: SSE client with correct buffering
  const launchAgent = useCallback(async (agentKey: AgentKey) => {
    setAgentState(agentKey, 'running')
    setAgentProgress(agentKey, '')
    setNoConfig(null)

    try {
      const response = await fetch(AGENT_ROUTES[agentKey], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority_channels: profile?.priority_channels,
        }),
      })

      const nc = await checkNoConfig(response)
      if (nc) { setNoConfig(nc); setAgentState(agentKey, 'error'); return }

      if (response.status === 400) {
        const body = (await response.json()) as { error?: string }
        if (body.error === 'NO_PROFILE') {
          setShowProfileForm(true)
          setAgentState(agentKey, 'error')
          return
        }
      }

      if (!response.ok || !response.body) {
        setAgentState(agentKey, 'error')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              event: string
              message?: string
              output?: unknown
            }
            if (event.event === 'status' && event.message) setAgentProgress(agentKey, event.message)
            if (event.event === 'result') updateRun(agentKey, event.output)
            if (event.event === 'finish') setAgentState(agentKey, 'done')
            if (event.event === 'error') setAgentState(agentKey, 'error')
          } catch {
            // malformed chunk — ignore
          }
        }
      }

      // Ensure state is set to done if stream ended without finish event
      setAgentStates((prev) => {
        if (prev[agentKey] === 'running') return { ...prev, [agentKey]: 'done' }
        return prev
      })
    } catch {
      setAgentState(agentKey, 'error')
    }
  }, [profile, setAgentState, setAgentProgress, updateRun])

  // Sequential launch: BPI → MTS → CIA (CIA can use BPI social_score)
  const launchAll = useCallback(async () => {
    await launchAgent('bpi')
    await launchAgent('mts')
    await launchAgent('cia')
  }, [launchAgent])

  const handleSocialConnected = useCallback((platform: string) => {
    setSocialStatus((prev) => ({ ...prev, [platform]: true }))
    toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected`)
  }, [])

  const handleSaveProfile = useCallback(async (data: BrandProfileFormData) => {
    const res = await fetch('/api/brand-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const text = await res.text()
    if (!text) {
      throw new Error(res.ok ? 'Empty response from server' : `Save failed (${res.status})`)
    }
    const body: unknown = JSON.parse(text)
    if (!res.ok) {
      throw new Error(((body as Record<string, unknown>).error as string) ?? 'Save failed')
    }
    setProfile(body as DashboardData['profile'])
    setShowProfileForm(false)
    toast.success('Profile saved')
  }, [])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (showProfileForm || !profile) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 sm:px-6 flex items-center gap-3 shrink-0" style={{ height: '48px', minHeight: '48px' }}>
          {profile && (
            <button
              onClick={() => setShowProfileForm(false)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Back to dashboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><path fill="currentColor" d="M224 128a8 8 0 0 1-8 8H59.31l58.35 58.34a8 8 0 0 1-11.32 11.32l-72-72a8 8 0 0 1 0-11.32l72-72a8 8 0 0 1 11.32 11.32L59.31 120H216a8 8 0 0 1 8 8Z"/></svg>
            </button>
          )}
          <h1 className="text-lg font-semibold">Agent Settings</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
        <BrandProfileForm
          initialData={profile ? {
            brand_name: profile.brand_name,
            brand_url: profile.brand_url,
            country: profile.country,
            language: profile.language,
            primary_keyword: profile.primary_keyword,
            secondary_keyword: profile.secondary_keyword,
            sector: profile.sector ?? '',
            priority_channels: profile.priority_channels ?? [],
            objective: profile.objective ?? '',
            competitors: profile.competitors as Array<{ name: string; url: string }>,
          } : undefined}
          onSave={handleSaveProfile}
          socialStatus={socialStatus}
          onSocialConnected={handleSocialConnected}
        />
          </div>
        </div>
      </div>
    )
  }

  const isAnyRunning = Object.values(agentStates).some((s) => s === 'running')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0" style={{ height: '48px', minHeight: '48px' }}>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            onClick={() => void launchAll()}
            disabled={isAnyRunning}
            size="sm"
            className="text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(90deg, #17c3b2, #FF7A3D)' }}
          >
            {isAnyRunning ? 'Running...' : 'Run all agents'}
          </Button>
          <ThemeToggle />
          <button
            onClick={() => setShowProfileForm(true)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Agent settings"
          >
            <GearSix size={18} />
          </button>
        </div>
      </div>

      {/* NoConfig Banner */}
      {noConfig && (
        <div className="px-4 pt-4 sm:px-6">
          <NoConfigBanner missing={noConfig.missing} tab={noConfig.tab} agentName="Brand Intelligence" />
        </div>
      )}

      {/* Agent Progress */}
      <AgentProgress
        states={agentStates}
        progress={progress}
        onLaunchAgent={(key) => void launchAgent(key)}
        disabled={isAnyRunning}
      />

      {/* Tabs */}
      <TabNav tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && <OverviewTab runs={runs} />}
        {activeTab === 'audit' && runs.bpi && <AuditTab output={runs.bpi.payload} />}
        {activeTab === 'audit' && !runs.bpi && (
          <div className="p-6 text-center text-muted-foreground">No audit data yet. Run the analysis.</div>
        )}
        {activeTab === 'trends' && runs.mts && <TrendsTab output={runs.mts.payload} />}
        {activeTab === 'trends' && !runs.mts && (
          <div className="p-6 text-center text-muted-foreground">No trend data yet. Run the analysis.</div>
        )}
        {activeTab === 'competitive' && runs.cia && <CompetitiveTab output={runs.cia.payload} />}
        {activeTab === 'competitive' && !runs.cia && (
          <div className="p-6 text-center text-muted-foreground">No competitive data yet. Run the analysis.</div>
        )}
      </div>
    </div>
  )
}
