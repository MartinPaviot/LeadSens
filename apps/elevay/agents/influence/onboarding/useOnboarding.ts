import { useState, useCallback, useEffect } from 'react';
import type { OnboardingConfig, ConnectedTool, InfluencerToolId } from '../types';

const TOOLS_KEY = 'elevay-influence-tools';
const COMPLETE_KEY = 'elevay-influence-onboarding-complete';

const DEFAULT_CONFIG: OnboardingConfig = {
  connectedTools: [],
  priority: ['builtin'],
  builtinEnabled: true,
};

function loadConfig(): OnboardingConfig {
  try {
    const raw = localStorage.getItem(TOOLS_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return JSON.parse(raw) as OnboardingConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: OnboardingConfig): void {
  try { localStorage.setItem(TOOLS_KEY, JSON.stringify(config)); } catch { /* full */ }
}

export function useOnboarding() {
  const [config, setConfig] = useState<OnboardingConfig>(DEFAULT_CONFIG);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true); // default true to prevent flash
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConfig(loadConfig());
    setIsOnboardingComplete(localStorage.getItem(COMPLETE_KEY) === 'true');
  }, []);

  const connectTool = useCallback(async (toolId: InfluencerToolId, apiKey: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/agents/influence/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolId, apiKey }),
      });
      const data = await res.json() as { valid: boolean; error?: string };
      if (!data.valid) return { success: false, error: data.error ?? 'Invalid key' };

      setConfig((prev) => {
        const tool: ConnectedTool = { id: toolId, apiKey, connectedAt: new Date().toISOString() };
        const tools = prev.connectedTools.filter((t) => t.id !== toolId);
        tools.push(tool);
        const priority = [...prev.priority.filter((p) => p !== toolId), toolId];
        // Ensure builtin is always last
        const reordered = [...priority.filter((p) => p !== 'builtin'), ...(prev.builtinEnabled ? ['builtin' as const] : [])];
        const next = { ...prev, connectedTools: tools, priority: reordered };
        saveConfig(next);
        return next;
      });
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const disconnectTool = useCallback((toolId: InfluencerToolId) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        connectedTools: prev.connectedTools.filter((t) => t.id !== toolId),
        priority: prev.priority.filter((p) => p !== toolId),
      };
      saveConfig(next);
      return next;
    });
  }, []);

  const reorderPriority = useCallback((newOrder: InfluencerToolId[]) => {
    setConfig((prev) => {
      const next = { ...prev, priority: newOrder };
      saveConfig(next);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(COMPLETE_KEY, 'true');
    setIsOnboardingComplete(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(COMPLETE_KEY);
    localStorage.removeItem(TOOLS_KEY);
    setConfig(DEFAULT_CONFIG);
    setIsOnboardingComplete(false);
  }, []);

  const primaryTool = config.priority.find((id) =>
    id === 'builtin' || config.connectedTools.some((t) => t.id === id),
  ) ?? null;

  return {
    config,
    mounted,
    isOnboardingComplete,
    primaryTool,
    connectTool,
    disconnectTool,
    reorderPriority,
    completeOnboarding,
    resetOnboarding,
  };
}
