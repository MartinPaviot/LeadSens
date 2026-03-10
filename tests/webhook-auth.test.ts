import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "@/app/api/webhooks/instantly/route";

// ─── Helper ─────────────────────────────────────────────

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// ─── verifyWebhookSignature (pure logic) ─────────────────

describe("verifyWebhookSignature", () => {
  const secret = "test-webhook-secret-abc123";
  const body = JSON.stringify({ event_type: "reply_received", campaign_id: "c1", email: "a@b.com" });

  it("accepts a valid HMAC-SHA256 signature", () => {
    const signature = sign(body, secret);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(verifyWebhookSignature(body, "deadbeef0000", secret)).toBe(false);
  });

  it("rejects when signature is empty string", () => {
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
  });

  it("rejects when secret is empty string", () => {
    const signature = sign(body, secret);
    expect(verifyWebhookSignature(body, signature, "")).toBe(false);
  });

  it("rejects when body has been tampered with", () => {
    const signature = sign(body, secret);
    const tampered = body.replace("reply_received", "email_bounced");
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it("rejects signature from a different secret", () => {
    const wrongSecret = "wrong-secret-xyz789";
    const signature = sign(body, wrongSecret);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(false);
  });

  it("handles unicode body content", () => {
    const unicodeBody = JSON.stringify({ event_type: "reply_received", body_preview: "Bonjour, je suis intéressé" });
    const signature = sign(unicodeBody, secret);
    expect(verifyWebhookSignature(unicodeBody, signature, secret)).toBe(true);
  });

  it("handles empty body", () => {
    const emptyBody = "";
    const signature = sign(emptyBody, secret);
    expect(verifyWebhookSignature(emptyBody, signature, secret)).toBe(true);
  });

  it("handles large body payload", () => {
    const largeBody = JSON.stringify({
      event_type: "reply_received",
      body_preview: "x".repeat(10000),
      campaign_id: "campaign-123",
      email: "test@example.com",
    });
    const signature = sign(largeBody, secret);
    expect(verifyWebhookSignature(largeBody, signature, secret)).toBe(true);
  });

  it("rejects signature with different casing (hex is case-sensitive in comparison)", () => {
    const signature = sign(body, secret);
    // If the signature is all lowercase hex, uppercasing it should fail
    const upperSig = signature.toUpperCase();
    // This should fail because HMAC produces lowercase hex
    if (signature !== upperSig) {
      expect(verifyWebhookSignature(body, upperSig, secret)).toBe(false);
    }
  });

  it("rejects signature with extra whitespace", () => {
    const signature = sign(body, secret);
    expect(verifyWebhookSignature(body, ` ${signature}`, secret)).toBe(false);
    expect(verifyWebhookSignature(body, `${signature} `, secret)).toBe(false);
  });
});

// ─── Real-world scenarios ───────────────────────────────

describe("webhook signature real-world scenarios", () => {
  it("validates a bounce event correctly", () => {
    const secret = "prod-secret-32chars-hex-string00";
    const bounceEvent = JSON.stringify({
      event_type: "email_bounced",
      campaign_id: "camp_abc123",
      email: "bounced@example.com",
      bounce_type: "hard",
      timestamp: "2026-03-09T12:00:00Z",
    });
    const signature = sign(bounceEvent, secret);
    expect(verifyWebhookSignature(bounceEvent, signature, secret)).toBe(true);
  });

  it("prevents DoS via fake bounce events", () => {
    const realSecret = "real-production-secret-abc123def";
    const fakeBounce = JSON.stringify({
      event_type: "email_bounced",
      campaign_id: "camp_victim",
      email: "victim@example.com",
    });
    // Attacker doesn't know the secret, so they forge a random signature
    const fakeSignature = "a".repeat(64);
    expect(verifyWebhookSignature(fakeBounce, fakeSignature, realSecret)).toBe(false);
  });

  it("prevents replay with modified payload", () => {
    const secret = "secret123";
    const original = JSON.stringify({ event_type: "reply_received", email: "good@example.com" });
    const validSig = sign(original, secret);

    // Attacker intercepts and changes the email
    const modified = JSON.stringify({ event_type: "reply_received", email: "attacker@example.com" });
    expect(verifyWebhookSignature(modified, validSig, secret)).toBe(false);
  });
});
