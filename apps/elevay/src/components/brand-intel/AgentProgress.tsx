'use client'

import { AGENT_TOKENS } from './tokens'
import { Spinner } from '@/components/shared/Spinner'

type AgentKey = 'bpi' | 'mts' | 'cia'
type AgentState = 'idle' | 'running' | 'done' | 'error'

interface AgentProgressProps {
  states: Record<AgentKey, AgentState>
  progress: Record<AgentKey, string>
  onLaunchAgent: (key: AgentKey) => void
  disabled: boolean
}

const AGENT_INFO: Array<{ key: AgentKey; code: 'BPI-01' | 'MTS-02' | 'CIA-03' }> = [
  { key: 'bpi', code: 'BPI-01' },
  { key: 'mts', code: 'MTS-02' },
  { key: 'cia', code: 'CIA-03' },
]

function StateIcon({ state }: { state: AgentState }) {
  switch (state) {
    case 'idle':
      return <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 inline-block" />
    case 'running':
      return <Spinner size="sm" />
    case 'done':
      return <span className="w-4 h-4 rounded-full bg-teal inline-flex items-center justify-center text-white text-[10px] font-bold">&#10003;</span>
    case 'error':
      return <span className="w-4 h-4 rounded-full bg-destructive inline-flex items-center justify-center text-white text-[10px] font-bold">&#10007;</span>
  }
}

export function AgentProgress({ states, progress, onLaunchAgent, disabled }: AgentProgressProps) {
  const anyRunning = Object.values(states).some((s) => s === 'running')
  if (!anyRunning && Object.values(states).every((s) => s === 'idle')) return null

  return (
    <div className="border-b px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row gap-2 sm:gap-4">
      {AGENT_INFO.map(({ key, code }) => {
        const token = AGENT_TOKENS[code]
        const state = states[key]
        const msg = progress[key]

        return (
          <div key={key} className="flex items-center gap-2 min-w-0">
            <StateIcon state={state} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: token.dot }}
                />
                <span className="text-xs font-medium text-foreground truncate">
                  {token.label}
                </span>
              </div>
              {state === 'running' && msg && (
                <p className="text-[11px] text-teal mt-0.5 truncate">{msg}</p>
              )}
              {state === 'error' && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[11px] text-destructive">Error</p>
                  <button
                    onClick={() => onLaunchAgent(key)}
                    disabled={disabled}
                    className="text-[11px] text-teal hover:underline disabled:opacity-50"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
