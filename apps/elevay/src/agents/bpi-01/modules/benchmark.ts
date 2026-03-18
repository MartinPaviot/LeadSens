import type { BenchmarkData } from "../types";

/** Fetch competitive benchmark data */
export async function fetchBenchmark(
  _brand: string,
  _competitors?: string[],
): Promise<BenchmarkData> {
  // TODO: aggregate competitor data from SERP + SEO APIs
  return {
    competitors: [],
    category: "unknown",
  };
}
