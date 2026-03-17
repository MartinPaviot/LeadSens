import type { InstantlySearchFilters } from "@/server/lib/connectors/instantly";

export interface TestCase {
  id: number;
  description: string;
  language: "en" | "fr";
  sectorHint: string;
}

export interface JudgeVerdict {
  jobTitleScore: number;
  industryScore: number;
  employeeCountScore: number;
  locationScore: number;
  completenessScore: number;
  overBroadeningScore: number;
  totalScore: number;
  reasoning: string;
  criticalFailures: string[];
}

export interface StructuralCheck {
  noLevelField: boolean;
  skipOwnedLeads: boolean;
  validEnums: boolean;
  flatStructure: boolean;
  hasJobTitles: boolean;
  noLocationHallucination: boolean;
}

export interface TestResult {
  testCase: TestCase;
  filters: InstantlySearchFilters;
  judgeVerdict: JudgeVerdict;
  structuralCheck: StructuralCheck;
  passed: boolean;
  durationMs: number;
  parseWarnings: string[];
}

export interface FailurePattern {
  pattern: string;
  count: number;
  tests: number[];
}

export interface TestReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  medianScore: number;
  results: TestResult[];
  failurePatterns: FailurePattern[];
}
