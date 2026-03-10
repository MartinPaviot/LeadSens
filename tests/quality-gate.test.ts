import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMinQualityScore } from "@/server/lib/email/quality-gate";

// Mock mistralClient BEFORE importing draftWithQualityGate
vi.mock("@/server/lib/llm/mistral-client", () => ({
  mistralClient: {
    json: vi.fn(),
  },
}));

// Must import after mock setup
const { draftWithQualityGate } = await import(
  "@/server/lib/email/quality-gate"
);
const { mistralClient } = await import("@/server/lib/llm/mistral-client");

describe("getMinQualityScore", () => {
  it("returns 8 for step 0", () => {
    expect(getMinQualityScore(0)).toBe(8);
  });

  it("returns 7 for step 1", () => {
    expect(getMinQualityScore(1)).toBe(7);
  });

  it("returns 7 for step 2", () => {
    expect(getMinQualityScore(2)).toBe(7);
  });

  it("returns 7 for step 3", () => {
    expect(getMinQualityScore(3)).toBe(7);
  });

  it("returns 7 for step 4", () => {
    expect(getMinQualityScore(4)).toBe(7);
  });

  it("returns 7 for step 5", () => {
    expect(getMinQualityScore(5)).toBe(7);
  });
});

describe("draftWithQualityGate — step-aware threshold", () => {
  const baseContext = {
    leadName: "John Doe",
    leadJobTitle: "CTO",
    leadCompany: "Acme Corp",
  };

  const makeDraft = (subject = "test subject", body = "test body") => ({
    subject,
    body,
  });

  const makeScore = (overall: number) => ({
    relevance: overall,
    specificity: overall,
    formatting: overall,
    coherence: overall,
    overall,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("step 0: score 7 triggers retry (threshold is 8)", async () => {
    const draftFn = vi
      .fn()
      .mockResolvedValueOnce(makeDraft("sub1", "body1"))
      .mockResolvedValueOnce(makeDraft("sub2", "body2"))
      .mockResolvedValueOnce(makeDraft("sub3", "body3"));

    const jsonMock = vi.mocked(mistralClient.json);
    jsonMock
      .mockResolvedValueOnce(makeScore(7)) // attempt 1: below 8
      .mockResolvedValueOnce(makeScore(7)) // attempt 2: below 8
      .mockResolvedValueOnce(makeScore(7)); // attempt 3: below 8

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 0 },
      workspaceId: "ws-1",
    });

    // All 3 attempts made (score 7 < threshold 8)
    expect(draftFn).toHaveBeenCalledTimes(3);
    expect(result.qualityScore.overall).toBe(7);
  });

  it("step 0: score 8 passes on first attempt", async () => {
    const draftFn = vi.fn().mockResolvedValueOnce(makeDraft());

    vi.mocked(mistralClient.json).mockResolvedValueOnce(makeScore(8));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 0 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(result.qualityScore.overall).toBe(8);
  });

  it("step 1: score 7 passes on first attempt (threshold is 7)", async () => {
    const draftFn = vi.fn().mockResolvedValueOnce(makeDraft());

    vi.mocked(mistralClient.json).mockResolvedValueOnce(makeScore(7));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 1 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(result.qualityScore.overall).toBe(7);
  });

  it("step 3: score 6 triggers retry, score 7 passes", async () => {
    const draftFn = vi
      .fn()
      .mockResolvedValueOnce(makeDraft("sub1", "body1"))
      .mockResolvedValueOnce(makeDraft("sub2", "body2"));

    vi.mocked(mistralClient.json)
      .mockResolvedValueOnce(makeScore(6)) // attempt 1: below 7
      .mockResolvedValueOnce(makeScore(7)); // attempt 2: passes

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 3 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(2);
    expect(result.qualityScore.overall).toBe(7);
  });

  it("step 5: score 7 passes (breakup step, default threshold)", async () => {
    const draftFn = vi.fn().mockResolvedValueOnce(makeDraft());

    vi.mocked(mistralClient.json).mockResolvedValueOnce(makeScore(7));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 5 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(result.qualityScore.overall).toBe(7);
  });

  it("returns best result after all retries exhausted", async () => {
    const draftFn = vi
      .fn()
      .mockResolvedValueOnce(makeDraft("sub1", "body1"))
      .mockResolvedValueOnce(makeDraft("sub2", "body2"))
      .mockResolvedValueOnce(makeDraft("sub3", "body3"));

    vi.mocked(mistralClient.json)
      .mockResolvedValueOnce(makeScore(5))
      .mockResolvedValueOnce(makeScore(6)) // best
      .mockResolvedValueOnce(makeScore(4));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 0 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(3);
    expect(result.qualityScore.overall).toBe(6);
    expect(result.subject).toBe("sub2");
  });

  it("step 0: score 9 passes immediately (above threshold)", async () => {
    const draftFn = vi.fn().mockResolvedValueOnce(makeDraft());

    vi.mocked(mistralClient.json).mockResolvedValueOnce(makeScore(9));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 0 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(result.qualityScore.overall).toBe(9);
  });
});
