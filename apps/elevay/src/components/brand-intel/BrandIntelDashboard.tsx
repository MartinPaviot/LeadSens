"use client";

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { TabNav, type TabId } from './ui/TabNav';
import { AgentProgress } from './ui/AgentProgress';
import { OverviewTab } from './tabs/OverviewTab';
import { AuditTab } from './tabs/AuditTab';
import { TrendsTab } from './tabs/TrendsTab';
import { CompetitiveTab } from './tabs/CompetitiveTab';
import { GRADIENTS, COLORS, AGENT_NAMES } from './tokens';
import { MOCK_BPI, MOCK_MTS, MOCK_CIA, BPI_MODULES, MTS_MODULES, CIA_MODULES } from './mockDashboardData';
import type { BpiOutput } from '@/agents/bpi-01/types';
import type { MtsOutput } from '@/agents/mts-02/types';
import type { CiaOutput } from '@/agents/cia-03/types';

export interface DashboardData {
  bpi: BpiOutput | null;
  mts: MtsOutput | null;
  cia: CiaOutput | null;
  timestamps: { bpi: string | null; mts: string | null; cia: string | null };
}

type AgentRunState = 'idle' | 'running' | 'done';

export function BrandIntelDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const [bpiState, setBpiState] = useState<AgentRunState>('idle');
  const [mtsState, setMtsState] = useState<AgentRunState>('idle');
  const [ciaState, setCiaState] = useState<AgentRunState>('idle');

  const [bpiProgress, setBpiProgress] = useState(0);
  const [mtsProgress, setMtsProgress] = useState(0);
  const [ciaProgress, setCiaProgress] = useState(0);

  const [localBpi, setLocalBpi] = useState<BpiOutput | null>(null);
  const [localMts, setLocalMts] = useState<MtsOutput | null>(null);
  const [localCia, setLocalCia] = useState<CiaOutput | null>(null);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['brand-intel-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/agents/bmi/dashboard');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 60_000,
  });

  const serverBpi = data?.bpi ?? null;
  const serverMts = data?.mts ?? null;
  const serverCia = data?.cia ?? null;

  const dashData: DashboardData = {
    bpi: localBpi ?? serverBpi,
    mts: localMts ?? serverMts,
    cia: localCia ?? serverCia,
    timestamps: data?.timestamps ?? { bpi: null, mts: null, cia: null },
  };

  useEffect(() => {
    if (serverBpi && bpiState === 'idle') setBpiState('done');
    if (serverMts && mtsState === 'idle') setMtsState('done');
    if (serverCia && ciaState === 'idle') setCiaState('done');
  }, [serverBpi, serverMts, serverCia, bpiState, mtsState, ciaState]);

  const hasAnyData = dashData.bpi || dashData.mts || dashData.cia;
  const isAnyRunning = bpiState === 'running' || mtsState === 'running' || ciaState === 'running';

  const simulateRun = useCallback(<T,>(
    modules: string[],
    setProgress: (n: number) => void,
    setState: (s: AgentRunState) => void,
    setData: (d: T) => void,
    mockData: T,
  ) => {
    setState('running');
    setProgress(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setProgress(step);
      if (step >= modules.length) {
        clearInterval(interval);
        setTimeout(() => {
          setData(mockData);
          setState('done');
        }, 400);
      }
    }, 500);
  }, []);

  const handleLaunchAll = useCallback(() => {
    simulateRun(BPI_MODULES, setBpiProgress, setBpiState, setLocalBpi, MOCK_BPI);
    simulateRun(MTS_MODULES, setMtsProgress, setMtsState, setLocalMts, MOCK_MTS);
    simulateRun(CIA_MODULES, setCiaProgress, setCiaState, setLocalCia, MOCK_CIA);
  }, [simulateRun]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={24} className="animate-spin" style={{ color: COLORS.teal }} />
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>Chargement...</p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      if (!hasAnyData && !isAnyRunning) return <EmptyState onLaunch={handleLaunchAll} isRunning={false} />;
      if (isAnyRunning && !hasAnyData) {
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AgentProgress modules={BPI_MODULES} completedCount={bpiProgress} agentName={AGENT_NAMES.bpi01} />
            <AgentProgress modules={MTS_MODULES} completedCount={mtsProgress} agentName={AGENT_NAMES.mts02} />
            <AgentProgress modules={CIA_MODULES} completedCount={ciaProgress} agentName={AGENT_NAMES.cia03} />
          </div>
        );
      }
      return <OverviewTab data={dashData} onTabChange={setActiveTab} />;
    }
    if (activeTab === 'audit') {
      if (bpiState === 'running') return <AgentProgress modules={BPI_MODULES} completedCount={bpiProgress} agentName={AGENT_NAMES.bpi01} />;
      if (bpiState === 'done' && dashData.bpi) return <AuditTab data={dashData} />;
      return <EmptyState onLaunch={handleLaunchAll} isRunning={isAnyRunning} />;
    }
    if (activeTab === 'trends') {
      if (mtsState === 'running') return <AgentProgress modules={MTS_MODULES} completedCount={mtsProgress} agentName={AGENT_NAMES.mts02} />;
      if (mtsState === 'done' && dashData.mts) return <TrendsTab data={dashData} />;
      return <EmptyState onLaunch={handleLaunchAll} isRunning={isAnyRunning} />;
    }
    if (activeTab === 'competitive') {
      if (ciaState === 'running') return <AgentProgress modules={CIA_MODULES} completedCount={ciaProgress} agentName={AGENT_NAMES.cia03} />;
      if (ciaState === 'done' && dashData.cia) return <CompetitiveTab data={dashData} />;
      return <EmptyState onLaunch={handleLaunchAll} isRunning={isAnyRunning} />;
    }
    return null;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: COLORS.bg }}>
      <div className="flex items-center justify-between px-3 py-3 md:px-5 border-b" style={{ borderColor: COLORS.border }}>
        <h1 className="text-sm md:text-base font-semibold" style={{ color: COLORS.textPrimary }}>Brand & Market Intelligence</h1>
        <button
          onClick={handleLaunchAll}
          disabled={isAnyRunning}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: GRADIENTS.cta, minHeight: 36 }}
        >
          <RefreshCw size={12} className={isAnyRunning ? 'animate-spin' : ''} />
          {isAnyRunning ? 'En cours...' : 'Tout relancer'}
        </button>
      </div>

      <div className="px-3 md:px-5">
        <TabNav active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
        {renderTabContent()}
      </div>
    </div>
  );
}

function EmptyState({ onLaunch, isRunning }: { onLaunch: () => void; isRunning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(23,195,178,0.08)' }}>
        <RefreshCw size={24} style={{ color: COLORS.teal }} />
      </div>
      <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>Lancez votre premier audit</p>
      <p className="mt-1 text-[12px]" style={{ color: COLORS.textSecondary }}>
        Les 3 agents analyseront votre marque, les tendances et vos concurrents
      </p>
      <button
        onClick={onLaunch}
        disabled={isRunning}
        className="mt-4 w-full md:w-auto rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: GRADIENTS.cta, minHeight: 44 }}
      >
        {isRunning ? 'Analyse en cours...' : 'Lancer les 3 audits ↗'}
      </button>
    </div>
  );
}
