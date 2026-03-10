import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMinQualityScore, type QualityScore } from "@/server/lib/email/quality-gate";

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

describe("draftWithQualityGate — word count enforcement", () => {
  const baseContext = {
    leadName: "John Doe",
    leadJobTitle: "CTO",
    leadCompany: "Acme Corp",
  };

  const makeScore = (overall: number): QualityScore => ({
    relevance: overall,
    specificity: overall,
    formatting: overall,
    coherence: overall,
    overall,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("step 4: 150-word body triggers word count violation (maxWords=50, limit=65)", async () => {
    const longBody = Array(150).fill("word").join(" ");
    const draftFn = vi
      .fn()
      .mockResolvedValueOnce({ subject: "test", body: longBody })
      .mockResolvedValueOnce({ subject: "test", body: longBody })
      .mockResolvedValueOnce({ subject: "test", body: longBody });

    vi.mocked(mistralClient.json)
      .mockResolvedValueOnce(makeScore(9))
      .mockResolvedValueOnce(makeScore(9))
      .mockResolvedValueOnce(makeScore(9));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 4 },
      workspaceId: "ws-1",
    });

    // All 3 attempts made because word count always exceeds limit
    expect(draftFn).toHaveBeenCalledTimes(3);
    // Score penalized by 1
    expect(result.qualityScore.overall).toBe(8);
    expect(result.qualityScore.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Word count violation")])
    );
  });

  it("step 5: 40-word body passes (maxWords=45, limit=58)", async () => {
    const shortBody = Array(40).fill("word").join(" ");
    const draftFn = vi.fn().mockResolvedValueOnce({ subject: "test", body: shortBody });

    vi.mocked(mistralClient.json).mockResolvedValueOnce(makeScore(8));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 5 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(result.qualityScore.overall).toBe(8);
    expect(result.qualityScore.issues).toBeUndefined();
  });

  it("step 0: body at exactly 130% of maxWords (110 words for maxWords=85) triggers violation", async () => {
    // 85 * 1.3 = 110.5, so 111 words should trigger
    const body = Array(111).fill("word").join(" ");
    const draftFn = vi
      .fn()
      .mockResolvedValueOnce({ subject: "sub", body })
      .mockResolvedValueOnce({ subject: "sub", body })
      .mockResolvedValueOnce({ subject: "sub", body });

    vi.mocked(mistralClient.json)
      .mockResolvedValueOnce(makeScore(9))
      .mockResolvedValueOnce(makeScore(9))
      .mockResolvedValueOnce(makeScore(9));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 0 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(3);
    expect(result.qualityScore.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Word count violation")])
    );
  });

  it("step 0: body at 110 words (just under 130% of 85) passes", async () => {
    // 85 * 1.3 = 110.5, so 110 words should pass
    const body = Array(110).fill("word").join(" ");
    const draftFn = vi.fn().mockResolvedValueOnce({ subject: "sub", body });

    vi.mocked(mistralClient.json).mockResolvedValueOnce(makeScore(8));

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 0 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(result.qualityScore.overall).toBe(8);
  });

  it("word count violation retries then returns best result", async () => {
    const longBody = Array(100).fill("word").join(" "); // 100 > 50*1.3=65 for step 4
    const shortBody = Array(45).fill("word").join(" "); // 45 < 65 for step 4

    const draftFn = vi
      .fn()
      .mockResolvedValueOnce({ subject: "long", body: longBody })
      .mockResolvedValueOnce({ subject: "short", body: shortBody });

    vi.mocked(mistralClient.json)
      .mockResolvedValueOnce(makeScore(8)) // long body — penalized to 7
      .mockResolvedValueOnce(makeScore(7)); // short body — passes at 7

    const result = await draftWithQualityGate({
      draftFn,
      context: { ...baseContext, step: 4 },
      workspaceId: "ws-1",
    });

    expect(draftFn).toHaveBeenCalledTimes(2);
    expect(result.subject).toBe("short");
    expect(result.qualityScore.overall).toBe(7);
  });
});
