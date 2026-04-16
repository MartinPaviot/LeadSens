"use client";

import { useState } from 'react';
import { useInfluencerAgent } from '../hooks/useInfluencerAgent';
import { useOnboarding } from '../onboarding/useOnboarding';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { AgentSidebar } from './AgentSidebar';
import { InfluencerList } from './InfluencerList';

export function InfluencerAgent() {
  const onboarding = useOnboarding();
  const agent = useInfluencerAgent(onboarding.config);
  const [showSettings, setShowSettings] = useState(false);

  const showModal = onboarding.mounted && (!onboarding.isOnboardingComplete || showSettings);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background md:flex-row">
      {/* Left: results */}
      <div
        className="order-2 flex min-h-[50vh] flex-1 flex-col overflow-hidden md:order-1 md:min-h-0"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(44,107,237,0.05) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(23,195,178,0.05) 0%, transparent 50%), #FFF7ED',
        }}
      >
        <InfluencerList
          influencers={agent.influencers}
          allInfluencers={agent.allInfluencers}
          isSearching={agent.isSearching}
          searchError={agent.searchError}
          selected={agent.selected}
          selectedId={agent.selectedId}
          filter={agent.filter}
          brief={agent.brief}
          isGeneratingBrief={agent.isGeneratingBrief}
          onSelect={agent.setSelectedId}
          onFilterChange={agent.setFilter}
          onGenerateBrief={agent.generateBrief}
        />
      </div>

      {/* Right: chat sidebar */}
      <div className="order-1 h-[50vh] shrink-0 md:order-2 md:h-full md:w-[320px] lg:w-[380px]">
        <AgentSidebar
          messages={agent.messages}
          brief={agent.brief}
          onSend={agent.handleSend}
          isSearching={agent.isSearching}
          isLoading={agent.isLoading}
          lang={agent.lang}
          onReset={agent.resetSession}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Onboarding / Settings modal */}
      {showModal && (
        <OnboardingModal
          config={onboarding.config}
          onConnect={onboarding.connectTool}
          onComplete={() => {
            onboarding.completeOnboarding();
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}
