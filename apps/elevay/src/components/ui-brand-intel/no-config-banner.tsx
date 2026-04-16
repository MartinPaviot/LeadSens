'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui-brand-intel/button'
import { WarningCircle, ArrowRight } from '@phosphor-icons/react'

const FIELD_LABELS: Record<string, string> = {
  cmsType: 'CMS type',
  geoLevel: 'Geographic level',
  targetGeos: 'Target geographies',
  priorityPages: 'Priority pages',
  googleBusinessProfileId: 'Google Business Profile ID',
  primaryKeyword: 'Primary keyword',
  secondaryKeyword: 'Secondary keyword',
  businessObjective: 'Business objective',
  seoMaturity: 'SEO maturity',
  monthlyContentCapacity: 'Monthly content capacity',
  prioritization: 'Prioritization',
  alertChannel: 'Alert channel',
  automationLevel: 'Automation level',
  annualBudget: 'Annual budget',
  fiscalYearStart: 'Fiscal year start',
  channelsAllocation: 'Channel allocation',
  'kpiTargets.cplTarget': 'CPL target',
  'kpiTargets.cacTarget': 'CAC target',
  'kpiTargets.roiMinimum': 'Minimum ROI',
  'kpiTargets.cpaTarget': 'CPA target',
  'kpiTargets.roasTarget': 'ROAS target',
  'revenueObjectives.annualRevenue': 'Annual revenue target',
  'revenueObjectives.monthlyLeads': 'Monthly leads target',
  cplTarget: 'CPL target',
  cacTarget: 'CAC target',
  roiMinimum: 'Minimum ROI',
  cpaTarget: 'CPA target',
  roasTarget: 'ROAS target',
  annualRevenue: 'Annual revenue target',
  monthlyLeads: 'Monthly leads target',
  style: 'Writing style',
  register: 'Language register',
  positioning: 'Positioning',
  keyPhrases: 'Key phrases',
  vertical: 'Vertical',
  audienceDescription: 'Audience description',
  productDescription: 'Product description',
  priorityChannels: 'Priority channels',
  competitors: 'Competitors',
  monitorKeywords: 'Monitor keywords',
  companyUrl: 'Website URL',
  name: 'Company name',
  industry: 'Industry',
  country: 'Country',
  automationSeo: 'SEO automation',
  automationSocial: 'Social automation',
  automationCrm: 'CRM automation',
  automationInteraction: 'Interaction automation',
  escalationChannel: 'Escalation channel',
  monthlyAdsBudget: 'Monthly ads budget',
  'platform (connect a CRM integration)': 'CRM platform (connect an integration)',
}

const TAB_LABELS: Record<string, string> = {
  company: 'Company',
  brand: 'Brand Voice',
  seo: 'SEO & Site',
  budget: 'Budget & Objectives',
  icp: 'Competitive Intelligence',
  integrations: 'Integrations',
  agents: 'Automation',
  team: 'Team',
  billing: 'Usage',
  'SEO & Site': 'SEO & Site',
  'Budget & Objectives': 'Budget & Objectives',
  'Company + Brand Voice + Competitive Intelligence': 'Company + Brand Voice + Competitive Intelligence',
  'Automation & Escalation': 'Automation & Escalation',
  'Brand Voice': 'Brand Voice',
}

function resolveTabId(tab: string): string {
  const map: Record<string, string> = {
    'SEO & Site': 'seo',
    'Budget & Objectives': 'budget',
    'Company + Brand Voice + Competitive Intelligence': 'company',
    'Automation & Escalation': 'agents',
    'Brand Voice': 'brand',
  }
  return map[tab] ?? tab
}

function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
}

function tabLabelFor(tab: string): string {
  return TAB_LABELS[tab] ?? tab
}

function buildMessage(missing: string[], tab: string, agentName: string | undefined, isMobile: boolean): React.JSX.Element {
  const tabLabel = tabLabelFor(tab)
  const agentSuffix = agentName ? ` to run ${agentName}` : ''

  if (isMobile && missing.length > 3) {
    return (
      <span>
        <strong>{missing.length} fields</strong> are missing in <strong>{tabLabel}</strong>{agentSuffix}.
      </span>
    )
  }

  if (missing.length === 1) {
    return (
      <span>
        <strong>{labelFor(missing[0]!)}</strong> must be configured in <strong>{tabLabel}</strong>{agentSuffix}.
      </span>
    )
  }

  if (missing.length <= 3) {
    const labels = missing.map(labelFor)
    const last = labels.pop()!
    return (
      <span>
        <strong>{labels.join(', ')}</strong> and <strong>{last}</strong> must be configured in <strong>{tabLabel}</strong>{agentSuffix}.
      </span>
    )
  }

  return (
    <span>
      <strong>{missing.length} fields</strong> are missing in <strong>{tabLabel}</strong>{agentSuffix}.
    </span>
  )
}

export interface NoConfigBannerProps {
  missing: string[]
  tab: string
  agentName?: string
}

export function NoConfigBanner({ missing, tab, agentName }: NoConfigBannerProps) {
  const router = useRouter()
  const tabId = resolveTabId(tab)
  const highlightIds = missing.map((f) => f.replace(/\./g, '-')).join(',')

  const handleClick = () => {
    router.push(`/settings?tab=${tabId}&highlight=${encodeURIComponent(highlightIds)}`)
  }

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-[var(--radius)] border bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40"
      role="alert"
    >
      <WarningCircle className="size-5 sm:size-6 text-amber-600 dark:text-amber-400 shrink-0" weight="fill" />
      <div className="flex-1 text-sm text-amber-900 dark:text-amber-200">
        <div className="font-semibold mb-0.5">Configuration required</div>
        {/* Desktop message */}
        <div className="hidden sm:block">
          {buildMessage(missing, tab, agentName, false)}
        </div>
        {/* Mobile message (shorter) */}
        <div className="block sm:hidden">
          {buildMessage(missing, tab, agentName, true)}
        </div>
      </div>
      <Button
        onClick={handleClick}
        className="w-full sm:w-auto whitespace-nowrap text-white font-semibold text-sm"
        style={{ background: 'var(--elevay-gradient-btn)' }}
        size="sm"
      >
        Open settings
        <ArrowRight className="size-4 ml-1" />
      </Button>
    </div>
  )
}
