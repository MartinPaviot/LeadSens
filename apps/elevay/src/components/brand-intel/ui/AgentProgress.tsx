"use client";

import { COLORS, GRADIENTS } from '../tokens';

interface AgentProgressProps {
  modules: string[];
  completedCount: number;
  agentName: string;
}

export function AgentProgress({ modules, completedCount, agentName }: AgentProgressProps) {
  const progress = (completedCount / modules.length) * 100;

  return (
    <div className="flex flex-col items-center py-12">
      <p className="text-sm font-semibold mb-1" style={{ color: COLORS.textPrimary }}>{agentName}</p>
      <p className="text-[12px] mb-4" style={{ color: COLORS.textSecondary }}>Analyse en cours...</p>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-2 rounded-full mb-5" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: GRADIENTS.cta }} />
      </div>

      {/* Module list */}
      <div className="space-y-1.5 w-full max-w-xs">
        {modules.map((mod, i) => {
          const isDone = i < completedCount;
          const isRunning = i === completedCount;
          return (
            <div key={mod} className="flex items-center gap-2 text-[12px]">
              {isDone ? (
                <span style={{ color: COLORS.teal }}>&#10003;</span>
              ) : isRunning ? (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: COLORS.teal }} />
              ) : (
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'rgba(0,0,0,0.1)' }} />
              )}
              <span style={{ color: isDone ? COLORS.textPrimary : isRunning ? COLORS.teal : COLORS.textSecondary }}>
                {mod}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px]" style={{ color: COLORS.textSecondary }}>
        {completedCount < modules.length
          ? `~${Math.max(1, Math.ceil((modules.length - completedCount) * 0.5))}s restantes`
          : 'Finalisation...'}
      </p>
    </div>
  );
}
