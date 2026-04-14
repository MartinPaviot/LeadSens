'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CompanyProfileTab } from '@/components/settings/company-profile-tab'
import { IcpTargetingTab } from '@/components/settings/icp-targeting-tab'
import { BrandVoiceTab } from '@/components/settings/brand-voice-tab'
import { IntegrationsTab } from '@/components/settings/integrations-tab'
import { AgentsAutomationTab } from '@/components/settings/agents-automation-tab'
import { TeamTab } from '@/components/settings/team-tab'
import { BillingUsageTab } from '@/components/settings/billing-usage-tab'
import { SettingsProvider } from '@/components/settings/settings-context'

const TABS = [
  { id: 'company', label: 'Company' },
  { id: 'icp', label: 'Competitive Intelligence' },
  { id: 'brand', label: 'Content & Voice' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'agents', label: 'Agents & Automation' },
  { id: 'team', label: 'Team' },
  { id: 'billing', label: 'Usage' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('company')

  return (
    <SettingsProvider>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 flex items-center gap-3 shrink-0" style={{ height: '48px', minHeight: '48px' }}>
        <button
          onClick={() => router.back()}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256">
            <path fill="currentColor" d="M224 128a8 8 0 0 1-8 8H59.31l58.35 58.34a8 8 0 0 1-11.32 11.32l-72-72a8 8 0 0 1 0-11.32l72-72a8 8 0 0 1 11.32 11.32L59.31 120H216a8 8 0 0 1 8 8Z"/>
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="border-b px-4 sm:px-6 overflow-x-auto shrink-0">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2
                ${activeTab === tab.id
                  ? 'border-[#17c3b2] text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          {activeTab === 'company' && <CompanyProfileTab />}
          {activeTab === 'icp' && <IcpTargetingTab />}
          {activeTab === 'brand' && <BrandVoiceTab />}
          {activeTab === 'integrations' && <IntegrationsTab />}
          {activeTab === 'agents' && <AgentsAutomationTab />}
          {activeTab === 'team' && <TeamTab />}
          {activeTab === 'billing' && <BillingUsageTab />}
        </div>
      </div>
    </div>
    </SettingsProvider>
  )
}
