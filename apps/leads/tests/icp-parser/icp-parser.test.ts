import { describe, it, expect, vi, afterAll } from "vitest";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { TEST_CASES } from "./descriptions";
import { judgeResult } from "./judge";
import { runStructuralChecks } from "./structural-checks";
import { aggregateResults, printSummary } from "./scoring";
import { parseICP } from "@/server/lib/tools/icp-parser";
import type { TestResult } from "./types";

// Mock only the DB logger — we don't want AI event logs during tests
// logAIEvent returns a Promise (called with .catch() in mistral-client.ts)
vi.mock("@/lib/ai-events", () => ({
  logAIEvent: vi.fn().mockResolvedValue(undefined),
  calculateCost: vi.fn().mockReturnValue(0),
}));

const PASS_THRESHOLD = 100; // out of 100 — zero tolerance

// Intentionally vague descriptions get a lower threshold — they ARE supposed to produce
// lower-quality output. We still want to run them to track behavior, but they shouldn't
// block the suite. These test that the parser doesn't crash, not that it's perfect.
const VAGUE_TEST_IDS = new Set([76, 77, 78, 87, 88]);
const VAGUE_THRESHOLD = 40;

const results: TestResult[] = [];

describe("ICP Parser — 100 real-world descriptions", () => {
  for (const tc of TEST_CASES) {
    it(`#${tc.id} [${tc.language}] ${tc.sectorHint}`, async () => {
      const start = Date.now();

      // 1. Real call to parseICP (Mistral Large)
      const { filters, parseWarnings } = await parseICP(tc.description, "test-workspace");

      // 2. Structural checks (hard fails)
      const structural = runStructuralChecks(tc.description, filters);

      // 3. LLM-as-Judge (Mistral Small)
      const verdict = await judgeResult(tc.description, filters, tc.sectorHint);

      const isVague = VAGUE_TEST_IDS.has(tc.id);
      const threshold = isVague ? VAGUE_THRESHOLD : PASS_THRESHOLD;

      const result: TestResult = {
        testCase: tc,
        filters,
        judgeVerdict: verdict,
        structuralCheck: structural,
        passed:
          verdict.totalScore >= threshold &&
          Object.values(structural).every(Boolean) &&
          (isVague || verdict.criticalFailures.length === 0),
        durationMs: Date.now() - start,
        parseWarnings: parseWarnings ?? [],
      };

      results.push(result);

      // Fail the vitest test if it doesn't pass
      const structuralPassed = Object.values(structural).every(Boolean);
      if (!structuralPassed) {
        const failedChecks = Object.entries(structural)
          .filter(([, v]) => !v)
          .map(([k]) => k);
        console.log(`  Structural fails: ${failedChecks.join(", ")}`);
        console.log(`  Filters: ${JSON.stringify(filters)}`);
      }
      if (verdict.criticalFailures.length > 0) {
        console.log(`  Critical failures: ${verdict.criticalFailures.join(", ")}`);
      }
      if (verdict.totalScore < PASS_THRESHOLD) {
        console.log(`  Score: ${verdict.totalScore}/100 — ${verdict.reasoning}`);
      }

      expect(structuralPassed, `Structural checks failed: ${Object.entries(structural).filter(([, v]) => !v).map(([k]) => k).join(", ")}`).toBe(true);
      if (!isVague) {
        expect(verdict.criticalFailures, `Critical failures: ${verdict.criticalFailures.join(", ")}`).toHaveLength(0);
      }
      expect(verdict.totalScore, `Score ${verdict.totalScore}/100 below threshold ${threshold}`).toBeGreaterThanOrEqual(threshold);
    }, 60_000); // 60s timeout per test (2 LLM calls)
  }

  afterAll(() => {
    if (results.length === 0) return;

    const report = aggregateResults(results);

    // Write JSON report
    const reportPath = resolve(__dirname, "reports", `report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\nReport saved to: ${reportPath}`);

    // Print console summary
    printSummary(report);
  });
});
