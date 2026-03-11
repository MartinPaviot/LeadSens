import { describe, it, expect } from "vitest";
import { getEnrichmentLimits, type ApolloRateLimitInfo } from "@/server/lib/connectors/apollo";

function makeLimits(endpoint: string, day: { limit: number; consumed: number; leftOver: number }): ApolloRateLimitInfo {
  return {
    endpoint,
    day,
    hour: { limit: day.limit / 10, consumed: 0, leftOver: day.limit / 10 },
    minute: { limit: day.limit / 100, consumed: 0, leftOver: day.limit / 100 },
  };
}

describe("getEnrichmentLimits", () => {
  it("finds people/match key", () => {
    const stats: Record<string, ApolloRateLimitInfo> = {
      '["api/v1/contacts", "search"]': makeLimits('["api/v1/contacts", "search"]', { limit: 6000, consumed: 500, leftOver: 5500 }),
      '["api/v1/people", "match"]': makeLimits('["api/v1/people", "match"]', { limit: 1000, consumed: 200, leftOver: 800 }),
    };
    const result = getEnrichmentLimits(stats);
    expect(result).not.toBeNull();
    expect(result!.day.leftOver).toBe(800);
    expect(result!.day.consumed).toBe(200);
  });

  it("returns null when no people/match key", () => {
    const stats: Record<string, ApolloRateLimitInfo> = {
      '["api/v1/contacts", "search"]': makeLimits('["api/v1/contacts", "search"]', { limit: 6000, consumed: 0, leftOver: 6000 }),
    };
    expect(getEnrichmentLimits(stats)).toBeNull();
  });

  it("handles empty stats", () => {
    expect(getEnrichmentLimits({})).toBeNull();
  });

  it("matches partial key containing people and match", () => {
    const stats: Record<string, ApolloRateLimitInfo> = {
      'people/match/endpoint': makeLimits('people/match/endpoint', { limit: 500, consumed: 100, leftOver: 400 }),
    };
    const result = getEnrichmentLimits(stats);
    expect(result).not.toBeNull();
    expect(result!.day.limit).toBe(500);
  });
});
