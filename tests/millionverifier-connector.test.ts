import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testMillionVerifierConnection,
  getMillionVerifierCredits,
  validateEmail,
  validateEmailBatch,
  createMillionVerifierVerifier,
} from "@/server/lib/connectors/millionverifier";

// Mock sleep to avoid real delays in tests
vi.mock("@/server/lib/connectors/fetch-retry", () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  BATCH_VERIFY_DELAY_MS: 0,
}));

// ─── Mock fetch ─────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function okResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function errorResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("error"),
  });
}

// ─── testMillionVerifierConnection ──────────────────────

describe("testMillionVerifierConnection", () => {
  it("returns true when credits endpoint succeeds", async () => {
    mockFetch.mockReturnValue(okResponse({ credits: 1000 }));
    expect(await testMillionVerifierConnection("valid-key")).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v3/credits?api=valid-key");
  });

  it("returns false on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(401));
    expect(await testMillionVerifierConnection("bad-key")).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    expect(await testMillionVerifierConnection("any-key")).toBe(false);
  });
});

// ─── getMillionVerifierCredits ──────────────────────────

describe("getMillionVerifierCredits", () => {
  it("parses numeric credits", async () => {
    mockFetch.mockReturnValue(okResponse({ credits: 5000 }));
    expect(await getMillionVerifierCredits("key")).toBe(5000);
  });

  it("parses string credits", async () => {
    mockFetch.mockReturnValue(okResponse({ credits: "12345" }));
    expect(await getMillionVerifierCredits("key")).toBe(12345);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(getMillionVerifierCredits("key")).rejects.toThrow("returned 500");
  });
});

// ─── validateEmail ──────────────────────────────────────

describe("validateEmail", () => {
  it("maps 'ok' to valid", async () => {
    mockFetch.mockReturnValue(okResponse({
      email: "test@good.com",
      result: "ok",
      quality: "good",
      free: false,
    }));

    const result = await validateEmail("key", "test@good.com");
    expect(result.email).toBe("test@good.com");
    expect(result.status).toBe("valid");
    expect(result.freeEmail).toBe(false);
  });

  it("maps 'invalid' to invalid", async () => {
    mockFetch.mockReturnValue(okResponse({
      email: "test@bad.com",
      result: "invalid",
    }));
    const result = await validateEmail("key", "test@bad.com");
    expect(result.status).toBe("invalid");
  });

  it("maps 'disposable' to disposable", async () => {
    mockFetch.mockReturnValue(okResponse({
      email: "test@temp.com",
      result: "disposable",
    }));
    const result = await validateEmail("key", "test@temp.com");
    expect(result.status).toBe("disposable");
  });

  it("maps 'catch_all' to catch_all", async () => {
    mockFetch.mockReturnValue(okResponse({
      email: "test@catch.com",
      result: "catch_all",
    }));
    const result = await validateEmail("key", "test@catch.com");
    expect(result.status).toBe("catch_all");
  });

  it("maps 'unknown' to unknown", async () => {
    mockFetch.mockReturnValue(okResponse({
      email: "test@unknown.com",
      result: "unknown",
    }));
    const result = await validateEmail("key", "test@unknown.com");
    expect(result.status).toBe("unknown");
  });

  it("includes freeEmail when present", async () => {
    mockFetch.mockReturnValue(okResponse({
      email: "test@gmail.com",
      result: "ok",
      free: true,
    }));
    const result = await validateEmail("key", "test@gmail.com");
    expect(result.freeEmail).toBe(true);
  });

  it("calls correct URL with api key and email", async () => {
    mockFetch.mockReturnValue(okResponse({
      email: "test@test.com",
      result: "ok",
    }));
    await validateEmail("my-key", "test@test.com");

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/v3/?api=my-key&email=test%40test.com");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(429));
    await expect(validateEmail("key", "test@test.com")).rejects.toThrow("returned 429");
  });
});

// ─── validateEmailBatch ─────────────────────────────────

describe("validateEmailBatch", () => {
  it("loops single checks and aggregates counts", async () => {
    mockFetch
      .mockReturnValueOnce(okResponse({ email: "a@a.com", result: "ok" }))
      .mockReturnValueOnce(okResponse({ email: "b@b.com", result: "invalid" }))
      .mockReturnValueOnce(okResponse({ email: "c@c.com", result: "catch_all" }));

    const result = await validateEmailBatch("key", ["a@a.com", "b@b.com", "c@c.com"]);

    expect(result.results).toHaveLength(3);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.unknownCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ─── Retry on 429 ───────────────────────────────────────

describe("validateEmail retry", () => {
  it("retries on 429 then succeeds", async () => {
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 429 }))
      .mockReturnValueOnce(okResponse({ email: "test@test.com", result: "ok" }));

    const result = await validateEmail("key", "test@test.com");
    expect(result.status).toBe("valid");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries on persistent 500", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 500 }));
    await expect(validateEmail("key", "test@test.com")).rejects.toThrow();
  });
});

// ─── createMillionVerifierVerifier ──────────────────────

describe("createMillionVerifierVerifier", () => {
  it("returns EmailVerifier interface", () => {
    const verifier = createMillionVerifierVerifier("key");
    expect(verifier.name).toBe("millionverifier");
    expect(typeof verifier.verifySingle).toBe("function");
    expect(typeof verifier.verifyBatch).toBe("function");
    expect(typeof verifier.getCredits).toBe("function");
  });
});
