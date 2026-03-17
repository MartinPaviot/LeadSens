import type { TestResult, TestReport, FailurePattern } from "./types";

/**
 * Aggregate all test results into a summary report.
 */
export function aggregateResults(results: TestResult[]): TestReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const scores = results.map((r) => r.judgeVerdict.totalScore);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const sorted = [...scores].sort((a, b) => a - b);
  const medianScore = sorted.length > 0
    ? sorted[Math.floor(sorted.length / 2)]
    : 0;

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed,
    failed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    avgScore,
    medianScore,
    results,
    failurePatterns: detectFailurePatterns(results),
  };
}

/**
 * Detect recurring failure patterns across test results.
 */
export function detectFailurePatterns(results: TestResult[]): FailurePattern[] {
  const patterns: FailurePattern[] = [];
  const failedResults = results.filter((r) => !r.passed);

  // 1. Group criticalFailures by text
  const criticalCounts = new Map<string, number[]>();
  for (const r of failedResults) {
    for (const cf of r.judgeVerdict.criticalFailures) {
      const normalized = cf.toLowerCase().trim();
      if (!criticalCounts.has(normalized)) criticalCounts.set(normalized, []);
      criticalCounts.get(normalized)!.push(r.testCase.id);
    }
  }
  for (const [pattern, tests] of criticalCounts) {
    if (tests.length >= 2) {
      patterns.push({ pattern: `Critical: ${pattern}`, count: tests.length, tests });
    }
  }

  // 2. Group by low-scoring dimension (< 5)
  const dimensions = [
    { key: "jobTitleScore", label: "Low job title score" },
    { key: "industryScore", label: "Low industry score" },
    { key: "employeeCountScore", label: "Low employee count score" },
    { key: "locationScore", label: "Low location score" },
    { key: "completenessScore", label: "Low completeness score" },
    { key: "overBroadeningScore", label: "Low over-broadening score" },
  ] as const;

  for (const dim of dimensions) {
    const tests = failedResults
      .filter((r) => r.judgeVerdict[dim.key] < 5)
      .map((r) => r.testCase.id);
    if (tests.length >= 2) {
      patterns.push({ pattern: dim.label, count: tests.length, tests });
    }
  }

  // 3. Group by structural check failure
  const structKeys = [
    { key: "noLevelField", label: "Structural: level field present" },
    { key: "skipOwnedLeads", label: "Structural: skip_owned_leads missing" },
    { key: "validEnums", label: "Structural: invalid enum values" },
    { key: "flatStructure", label: "Structural: nested structure" },
    { key: "hasJobTitles", label: "Structural: missing job_titles" },
    { key: "noLocationHallucination", label: "Structural: location hallucination" },
  ] as const;

  for (const sk of structKeys) {
    const tests = failedResults
      .filter((r) => !r.structuralCheck[sk.key])
      .map((r) => r.testCase.id);
    if (tests.length >= 1) {
      patterns.push({ pattern: sk.label, count: tests.length, tests });
    }
  }

  // 4. Group by language
  for (const lang of ["fr", "en"] as const) {
    const langFailed = failedResults.filter((r) => r.testCase.language === lang);
    const langTotal = results.filter((r) => r.testCase.language === lang);
    if (langTotal.length > 0 && langFailed.length >= 3) {
      const rate = Math.round((langFailed.length / langTotal.length) * 100);
      patterns.push({
        pattern: `Language ${lang.toUpperCase()} fail rate: ${rate}%`,
        count: langFailed.length,
        tests: langFailed.map((r) => r.testCase.id),
      });
    }
  }

  // 5. Group by sector hint
  const sectorCounts = new Map<string, number[]>();
  for (const r of failedResults) {
    const sector = r.testCase.sectorHint.toLowerCase();
    if (!sectorCounts.has(sector)) sectorCounts.set(sector, []);
    sectorCounts.get(sector)!.push(r.testCase.id);
  }
  for (const [sector, tests] of sectorCounts) {
    if (tests.length >= 2) {
      patterns.push({ pattern: `Sector: ${sector}`, count: tests.length, tests });
    }
  }

  // Sort by count descending
  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Print a console summary of the test report.
 */
export function printSummary(report: TestReport): void {
  console.log("\n" + "=".repeat(60));
  console.log("ICP PARSER TEST REPORT");
  console.log("=".repeat(60));
  console.log(`Timestamp:    ${report.timestamp}`);
  console.log(`Total tests:  ${report.totalTests}`);
  console.log(`Passed:       ${report.passed} (${report.passRate}%)`);
  console.log(`Failed:       ${report.failed}`);
  console.log(`Avg score:    ${report.avgScore}/100`);
  console.log(`Median score: ${report.medianScore}/100`);

  if (report.failurePatterns.length > 0) {
    console.log("\n--- FAILURE PATTERNS ---");
    for (const fp of report.failurePatterns.slice(0, 15)) {
      console.log(`  [${fp.count}x] ${fp.pattern} (tests: ${fp.tests.join(", ")})`);
    }
  }

  // Show worst 5 tests
  const worst = [...report.results]
    .filter((r) => !r.passed)
    .sort((a, b) => a.judgeVerdict.totalScore - b.judgeVerdict.totalScore)
    .slice(0, 5);

  if (worst.length > 0) {
    console.log("\n--- WORST FAILURES ---");
    for (const r of worst) {
      console.log(`  #${r.testCase.id} [${r.testCase.language}] ${r.testCase.sectorHint}`);
      console.log(`    Score: ${r.judgeVerdict.totalScore}/100`);
      console.log(`    Desc: ${r.testCase.description.slice(0, 80)}...`);
      console.log(`    Reasoning: ${r.judgeVerdict.reasoning.slice(0, 120)}`);
      if (r.judgeVerdict.criticalFailures.length > 0) {
        console.log(`    Critical: ${r.judgeVerdict.criticalFailures.join(", ")}`);
      }
      const failedChecks = Object.entries(r.structuralCheck)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (failedChecks.length > 0) {
        console.log(`    Structural fails: ${failedChecks.join(", ")}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
}
