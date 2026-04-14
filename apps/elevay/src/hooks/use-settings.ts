'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SettingsData {
  workspace: {
    id: string
    name: string
    slug: string
    companyUrl: string | null
    industry: string | null
    size: string | null
    country: string | null
    description: string | null
    valueProp: string | null
    logo: string | null
    targetMarkets: string[]
    timezone: string | null
    dryRunMode: boolean
    autonomyLevel: string
    settings: Record<string, unknown> | null
  }
  icps: IcpData[]
  members: MemberData[]
  integrations: IntegrationData[]
  usage: UsageData
}

export interface IcpData {
  id: string
  personaName: string
  jobTitles: string[]
  targetIndustries: string[]
  companySizeMin: number | null
  companySizeMax: number | null
  targetGeos: string[]
  intentKeywords: string[]
  disqualificationCriteria: string[]
}

export interface MemberData {
  id: string
  role: string
  invitedAt: string
  acceptedAt: string | null
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
  }
}

export interface IntegrationData {
  id: string
  type: string
  status: string
  accountEmail: string | null
  accountName: string | null
  updatedAt: string
}

export interface UsageData {
  aiCost: number
  aiCalls: number
  tokensIn: number
  tokensOut: number
  chatSessions: number
  agentRuns: number
}

export function useSettings() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to load settings')
      const json = (await res.json()) as SettingsData
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return { data, loading, error, reload: load }
}
