'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui-brand-intel/button'
import { WarningCircle, ArrowRight } from '@phosphor-icons/react'

const FIELD_LABELS: Record<string, string> = {
  cmsType: 'Type de CMS',
  geoLevel: 'Niveau géographique',
  targetGeos: 'Zones géographiques cibles',
  priorityPages: 'Pages prioritaires',
  googleBusinessProfileId: 'Google Business Profile ID',
  primaryKeyword: 'Mot-clé principal',
  secondaryKeyword: 'Mot-clé secondaire',
  businessObjective: 'Objectif business',
  seoMaturity: 'Maturité SEO',
  monthlyContentCapacity: 'Capacité contenu mensuelle',
  prioritization: 'Priorisation',
  alertChannel: "Canal d'alertes",
  automationLevel: "Niveau d'automatisation",
  annualBudget: 'Budget annuel',
  fiscalYearStart: 'Début année fiscale',
  channelsAllocation: 'Répartition par canal',
  'kpiTargets.cplTarget': 'Objectif CPL',
  'kpiTargets.cacTarget': 'Objectif CAC',
  'kpiTargets.roiMinimum': 'ROI minimum',
  'kpiTargets.cpaTarget': 'Objectif CPA',
  'kpiTargets.roasTarget': 'Objectif ROAS',
  'revenueObjectives.annualRevenue': 'Revenu annuel cible',
  'revenueObjectives.monthlyLeads': 'Leads mensuels cibles',
  cplTarget: 'Objectif CPL',
  cacTarget: 'Objectif CAC',
  roiMinimum: 'ROI minimum',
  cpaTarget: 'Objectif CPA',
  roasTarget: 'Objectif ROAS',
  annualRevenue: 'Revenu annuel cible',
  monthlyLeads: 'Leads mensuels cibles',
  style: 'Style rédactionnel',
  register: 'Registre de langue',
  positioning: 'Positionnement',
  keyPhrases: 'Phrases clés',
  vertical: 'Vertical',
  audienceDescription: 'Description audience',
  productDescription: 'Description produit',
  priorityChannels: 'Canaux prioritaires',
  competitors: 'Concurrents',
  monitorKeywords: 'Mots-clés de veille',
  companyUrl: 'URL du site',
  name: "Nom de l'entreprise",
  industry: "Secteur d'activité",
  country: 'Pays',
  automationSeo: 'Automatisation SEO',
  automationSocial: 'Automatisation Social',
  automationCrm: 'Automatisation CRM',
  automationInteraction: 'Automatisation Interactions',
  escalationChannel: "Canal d'escalade",
  monthlyAdsBudget: 'Budget pub mensuel',
  'platform (connect a CRM integration)': 'Plateforme CRM (connecter une intégration)',
}

const TAB_LABELS: Record<string, string> = {
  company: 'Entreprise',
  brand: 'Brand Voice',
  seo: 'SEO & Site',
  budget: 'Budget & Objectifs',
  icp: 'Veille Concurrentielle',
  integrations: 'Intégrations',
  agents: 'Automatisation',
  team: 'Équipe',
  billing: 'Utilisation',
  // Composite tab names from agent adapters
  'SEO & Site': 'SEO & Site',
  'Budget & Objectives': 'Budget & Objectifs',
  'Company + Brand Voice + Competitive Intelligence': 'Entreprise + Brand Voice + Veille',
  'Automation & Escalation': 'Automatisation & Escalade',
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
  const agentSuffix = agentName ? ` pour lancer ${agentName}` : ''

  if (isMobile && missing.length > 3) {
    return (
      <span>
        <strong>{missing.length} champs</strong> de configuration manquent dans l&apos;onglet <strong>{tabLabel}</strong>{agentSuffix}.
      </span>
    )
  }

  if (missing.length === 1) {
    return (
      <span>
        Le champ <strong>{labelFor(missing[0]!)}</strong> doit être renseigné dans l&apos;onglet <strong>{tabLabel}</strong>{agentSuffix}.
      </span>
    )
  }

  if (missing.length <= 3) {
    const labels = missing.map(labelFor)
    const last = labels.pop()!
    return (
      <span>
        Les champs <strong>{labels.join(', ')}</strong> et <strong>{last}</strong> doivent être renseignés dans l&apos;onglet <strong>{tabLabel}</strong>{agentSuffix}.
      </span>
    )
  }

  return (
    <span>
      <strong>{missing.length} champs</strong> de configuration manquent dans l&apos;onglet <strong>{tabLabel}</strong>{agentSuffix}.
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
        <div className="font-semibold mb-0.5">Configuration requise</div>
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
        Ouvrir les réglages
        <ArrowRight className="size-4 ml-1" />
      </Button>
    </div>
  )
}
