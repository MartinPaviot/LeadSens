export interface ElevayAgentProfile {
  id: string;
  name: string;
  description: string;
  version: string;
}

export interface ModuleResult<T> {
  module: string;
  data: T;
  score: number;
  fetchedAt: Date;
}

export interface AgentOutput<T> {
  agent: ElevayAgentProfile;
  /** Each module can return a different data shape */
  results: ModuleResult<unknown>[];
  globalScore: number;
  summary: string;
  /** Typed aggregate output of all modules */
  output: T;
  generatedAt: Date;
}
