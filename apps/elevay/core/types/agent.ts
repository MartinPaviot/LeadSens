export type AutomationLevel = 'audit' | 'semi-auto' | 'full-auto';
export type CmsType = 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
export type GeoLevel = 'national' | 'regional' | 'city' | 'multi-geo';
export type AlertChannel = 'slack' | 'email' | 'report';

export interface ClientProfile {
  id: string;
  siteUrl: string;
  cmsType: CmsType;
  automationLevel: AutomationLevel;
  geoLevel: GeoLevel;
  targetGeos: string[];
  priorityPages: string[];
  alertChannels: AlertChannel[];
  connectedTools: {
    gsc: boolean;
    ga: boolean;
    ahrefs: boolean;
    semrush: boolean;
  };
}

export interface AgentContext {
  clientProfile: ClientProfile;
  sessionId: string;
  triggeredBy: string;
  inheritedData?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  fallback?: () => Promise<WorkflowStep>;
}

export interface GracefulFallback {
  missingTool: string;
  fallbackBehavior: string;
  degradedOutput: string;
}

export interface AgentSession {
  sessionId: string;
  agentCode: string;
  startedAt: Date;
  steps: WorkflowStep[];
  output: unknown;
}
