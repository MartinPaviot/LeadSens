import { describe, it, expect, vi, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { STRESS_TEST_CASES } from "./descriptions-1000";
import { judgeResult } from "./judge";
import { runStructuralChecks } from "./structural-checks";
import { aggregateResults, printSummary } from "./scoring";
import { parseICP } from "@/server/lib/tools/icp-parser";
import type { TestResult, TestCase } from "./types";

// Mock only the DB logger
vi.mock("@/lib/ai-events", () => ({
  logAIEvent: vi.fn().mockResolvedValue(undefined),
  calculateCost: vi.fn().mockReturnValue(0),
}));

const PASS_THRESHOLD = 98; // 98% = at most 1 dim at 9 instead of 10 (accounts for LLM judge variance)
const VAGUE_THRESHOLD = 65;
const CONCURRENCY = 5; // parallel LLM calls per batch (lower to avoid Mistral 502s)
const BATCH_SIZE = 50; // tests per vitest `it()` block

// IDs for intentionally vague descriptions (set after reviewing descriptions-1000)
// We'll auto-detect them: descriptions < 20 chars or containing "vague"/"anyone"/"quelqu'un"
function isVague(tc: TestCase): boolean {
  const d = tc.description.toLowerCase();
  return (
    d.length < 20 ||
    d.includes("vague") ||
    d.includes("anyone") ||
    d.includes("quelqu'un") ||
    d.includes("n'importe") ||
    d.includes("tech people") ||
    d.includes("decision maker") ||
    d.includes("décideur") ||
    // "profil senior dans le X" — no specific role, just "someone senior"
    /profil senior|senior profile|someone senior|quelqu'un de senior/.test(d) ||
    // "whoever handles X" — no specific role
    d.includes("whoever handles") ||
    // "the person in charge of X" — vague role
    d.includes("the person in charge") ||
    d.includes("le responsable it") ||
    d.includes("head honcho") ||
    // Abbreviated descriptions (e.g., "CS dir mid-mkt SaaS NA")
    tc.sectorHint.toLowerCase().includes("abbreviated") ||
    tc.sectorHint.toLowerCase().includes("vague")
  );
}

const allResults: TestResult[] = [];

async function runSingleTest(tc: TestCase): Promise<TestResult> {
  const start = Date.now();
  const vague = isVague(tc);

  // 1. Real call to parseICP (Mistral Large)
  const { filters, parseWarnings, clarificationNeeded } = await parseICP(tc.description, "test-workspace");

  // If the parser asked for clarification (description too vague),
  // vague tests auto-pass (that's the expected behavior), non-vague tests fail.
  if (clarificationNeeded) {
    const perfectVerdict = {
      jobTitleScore: 10, industryScore: 10, employeeCountScore: 10,
      locationScore: 10, completenessScore: 10, overBroadeningScore: 10,
      totalScore: 100, reasoning: `Clarification requested: ${clarificationNeeded}`,
      criticalFailures: [] as string[],
    };
    const perfectStructural = {
      noLevelField: true, skipOwnedLeads: true, validEnums: true,
      flatStructure: true, hasJobTitles: true, noLocationHallucination: true,
    };
    return {
      testCase: tc,
      filters,
      judgeVerdict: vague ? perfectVerdict : { ...perfectVerdict, totalScore: 0, reasoning: `Parser blocked non-vague description: ${clarificationNeeded}` },
      structuralCheck: perfectStructural,
      passed: vague, // vague → pass (expected), non-vague → fail (unexpected block)
      durationMs: Date.now() - start,
      parseWarnings: parseWarnings ?? [],
    };
  }

  // 2. Structural checks (hard fails)
  const structural = runStructuralChecks(tc.description, filters);

  // 3. LLM-as-Judge (Mistral Small)
  const verdict = await judgeResult(tc.description, filters, tc.sectorHint);

  const threshold = vague ? VAGUE_THRESHOLD : PASS_THRESHOLD;

  return {
    testCase: tc,
    filters,
    judgeVerdict: verdict,
    structuralCheck: structural,
    passed:
      verdict.totalScore >= threshold &&
      Object.values(structural).every(Boolean) &&
      (vague || verdict.criticalFailures.length === 0),
    durationMs: Date.now() - start,
    parseWarnings: parseWarnings ?? [],
  };
}

async function runBatch(cases: TestCase[]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  // Process in chunks of CONCURRENCY
  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const chunk = cases.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(runSingleTest));
    results.push(...chunkResults);
  }
  return results;
}

// Split into batches for progress reporting
const totalBatches = Math.ceil(STRESS_TEST_CASES.length / BATCH_SIZE);

describe(`ICP Parser — ${STRESS_TEST_CASES.length} stress tests`, () => {
  for (let b = 0; b < totalBatches; b++) {
    const batchStart = b * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, STRESS_TEST_CASES.length);
    const batchCases = STRESS_TEST_CASES.slice(batchStart, batchEnd);

    it(
      `Batch ${b + 1}/${totalBatches} (tests #${batchStart + 1}-#${batchEnd})`,
      async () => {
        const batchResults = await runBatch(batchCases);
        allResults.push(...batchResults);

        // Log failures for this batch
        const failures = batchResults.filter((r) => !r.passed);
        if (failures.length > 0) {
          console.log(`\n  Batch ${b + 1}: ${failures.length}/${batchCases.length} failures`);
          for (const r of failures) {
            const structuralPassed = Object.values(r.structuralCheck).every(Boolean);
            console.log(
              `    #${r.testCase.id} [${r.testCase.language}] ${r.testCase.sectorHint} — score: ${r.judgeVerdict.totalScore}/100`,
            );
            if (!structuralPassed) {
              const failedChecks = Object.entries(r.structuralCheck)
                .filter(([, v]) => !v)
                .map(([k]) => k);
              console.log(`      Structural: ${failedChecks.join(", ")}`);
            }
            if (r.judgeVerdict.criticalFailures.length > 0) {
              console.log(`      Critical: ${r.judgeVerdict.criticalFailures.join(", ")}`);
            }
            console.log(`      Desc: ${r.testCase.description.slice(0, 100)}`);
            console.log(`      Reasoning: ${r.judgeVerdict.reasoning.slice(0, 150)}`);
          }
        } else {
          console.log(`  Batch ${b + 1}: ${batchCases.length}/${batchCases.length} passed`);
        }

        // Running totals
        const totalSoFar = allResults.length;
        const passedSoFar = allResults.filter((r) => r.passed).length;
        console.log(
          `  Running total: ${passedSoFar}/${totalSoFar} passed (${Math.round((passedSoFar / totalSoFar) * 100)}%)`,
        );

        // Assert batch pass rate >= 80% (allow some failures in stress test)
        const batchPassRate = (batchCases.length - failures.length) / batchCases.length;
        expect(
          batchPassRate,
          `Batch ${b + 1} pass rate ${Math.round(batchPassRate * 100)}% below 80%`,
        ).toBeGreaterThanOrEqual(0.8);
      },
      600_000, // 10 min timeout per batch
    );
  }

  afterAll(() => {
    if (allResults.length === 0) return;

    const report = aggregateResults(allResults);

    // Ensure reports directory exists
    const reportsDir = resolve(__dirname, "reports");
    mkdirSync(reportsDir, { recursive: true });

    // Write JSON report
    const reportPath = resolve(reportsDir, `stress-report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\nStress report saved to: ${reportPath}`);

    // Print console summary
    printSummary(report);

    // Extra: score distribution
    const buckets = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    for (const r of allResults) {
      const s = r.judgeVerdict.totalScore;
      if (s <= 20) buckets["0-20"]++;
      else if (s <= 40) buckets["21-40"]++;
      else if (s <= 60) buckets["41-60"]++;
      else if (s <= 80) buckets["61-80"]++;
      else buckets["81-100"]++;
    }
    console.log("\n--- SCORE DISTRIBUTION ---");
    for (const [range, count] of Object.entries(buckets)) {
      const bar = "█".repeat(Math.round((count / allResults.length) * 50));
      console.log(`  ${range}: ${count} (${Math.round((count / allResults.length) * 100)}%) ${bar}`);
    }
  });
});
