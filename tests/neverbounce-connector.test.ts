import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testNeverBounceConnection,
  getNeverBounceCredits,
  validateEmail,
  validateEmailBatch,
  createNeverBounceVerifier,
} from "@/server/lib/connectors/neverbounce";

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

// ─── testNeverBounceConnection ──────────────────────────

describe("testNeverBounceConnection", () => {
  it("returns true when account info succeeds", async () => {
    mockFetch.mockReturnValue(okResponse({
      status: "success",
      credits_info: { free_credits_remaining: 100, paid_credits_remaining: 0 },
    }));

    expect(await testNeverBounceConnection("valid-key")).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain("/v4/account/info?key=valid-key");
  });

  it("returns false when status is not success", async () => {
    mockFetch.mockReturnValue(okResponse({ status: "auth_failure" }));
    expect(await testNeverBounceConnection("bad-key")).toBe(false);
  });

  it("returns false on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(401));
    expect(await testNeverBounceConnection("bad-key")).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    expect(await testNeverBounceConnection("any-key")).toBe(false);
  });
});

// ─── getNeverBounceCredits ──────────────────────────────

describe("getNeverBounceCredits", () => {
  it("sums free and paid credits", async () => {
    mockFetch.mockReturnValue(okResponse({
      status: "success",
      credits_info: { free_credits_remaining: 50, paid_credits_remaining: 200 },
    }));

    expect(await getNeverBounceCredits("key")).toBe(250);
  });

  it("returns 0 when no credits info", async () => {
    mockFetch.mockReturnValue(okResponse({ status: "success" }));
    expect(await getNeverBounceCredits("key")).toBe(0);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValue(errorResponse(500));
    await expect(getNeverBounceCredits("key")).rejects.toThrow("returned 500");
  });
});

// ─── validateEmail ──────────────────────────────────────

describe("validateEmail", () => {
  it("maps 'valid' status correctly", async () => {
    mockFetch.mockReturnValue(okResponse({
      status: "success",
      result: "valid",
      flags: ["has_dns"],
    }));

    const result = await validateEmail("key", "test@good.com");
    expect(result.email).toBe("test@good.com");
    expect(result.status).toBe("valid");
    expect(result.subStatus).toBe("has_dns");
  });

  it("maps 'invalid' status correctly", async () => {
    mockFetch.mockReturnValue(okResponse({ status: "success", result: "invalid" }));
    const result = await validateEmail("key", "test@bad.com");
    expect(result.status).toBe("invalid");
  });

  it("maps 'disposable' status correctly", async () => {
    mockFetch.mockReturnValue(okResponse({ status: "success", result: "disposable" }));
    const result = await validateEmail("key", "test@temp.com");
    expect(result.status).toBe("disposable");
  });

  it("maps 'catchall' to catch_all", async () => {
    mockFetch.mockReturnValue(okResponse({ status: "success", result: "catchall" }));
    const result = await validateEmail("key", "test@catch.com");
    expect(result.status).toBe("catch_all");
  });

  it("maps 'unknown' status correctly", async () => {
    mockFetch.mockReturnValue(okResponse({ status: "success", result: "unknown" }));
    const result = await validateEmail("key", "test@unknown.com");
    expect(result.status).toBe("unknown");
  });

  it("sends POST with key and email in body", async () => {
    mockFetch.mockReturnValue(okResponse({ status: "success", result: "valid" }));
    await validateEmail("my-key", "test@example.com");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/v4/single/check");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.key).toBe("my-key");
    expect(body.email).toBe("test@example.com");
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
      .mockReturnValueOnce(okResponse({ status: "success", result: "valid" }))
      .mockReturnValueOnce(okResponse({ status: "success", result: "invalid" }))
      .mockReturnValueOnce(okResponse({ status: "success", result: "catchall" }));

    const result = await validateEmailBatch("key", ["a@a.com", "b@b.com", "c@c.com"]);

    expect(result.results).toHaveLength(3);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.unknownCount).toBe(1); // catch_all counted as unknown
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ─── Retry on 429 ───────────────────────────────────────

describe("validateEmail retry", () => {
  it("retries on 429 then succeeds", async () => {
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 429 }))
      .mockReturnValueOnce(okResponse({ status: "success", result: "valid" }));

    const result = await validateEmail("key", "test@test.com");
    expect(result.status).toBe("valid");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 then succeeds", async () => {
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 500 }))
      .mockReturnValueOnce(okResponse({ status: "success", result: "invalid" }));

    const result = await validateEmail("key", "test@test.com");
    expect(result.status).toBe("invalid");
  });

  it("throws after max retries on persistent 429", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 429 }));
    await expect(validateEmail("key", "test@test.com")).rejects.toThrow();
  });
});

// ─── createNeverBounceVerifier ──────────────────────────

describe("createNeverBounceVerifier", () => {
  it("returns EmailVerifier interface", () => {
    const verifier = createNeverBounceVerifier("key");
    expect(verifier.name).toBe("neverbounce");
    expect(typeof verifier.verifySingle).toBe("function");
    expect(typeof verifier.verifyBatch).toBe("function");
    expect(typeof verifier.getCredits).toBe("function");
  });
});
