import { describe, it, expect } from "vitest";
import {
  webhookEventSchema,
  webhookVariantToIndex,
} from "@/app/api/webhooks/instantly/route";

// ─── Schema validation for new webhook events ───────────

describe("webhookEventSchema — email_sent", () => {
  it("parses a valid email_sent event", () => {
    const event = {
      event_type: "email_sent",
      campaign_id: "camp-1",
      email: "lead@example.com",
      timestamp: "2026-03-10T10:00:00Z",
      variant: 1,
      step: 0,
      is_first: true,
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("email_sent");
    }
  });

  it("parses email_sent with minimal fields", () => {
    const event = {
      event_type: "email_sent",
      campaign_id: "camp-1",
      email: "lead@example.com",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("extracts step and variant for A/B attribution", () => {
    const event = {
      event_type: "email_sent",
      campaign_id: "camp-1",
      email: "lead@example.com",
      variant: 2,
      step: 3,
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success && result.data.event_type === "email_sent") {
      expect(webhookVariantToIndex(result.data.variant)).toBe(1);
      expect(result.data.step).toBe(3);
    }
  });
});

describe("webhookEventSchema — email_opened", () => {
  it("parses a valid email_opened event", () => {
    const event = {
      event_type: "email_opened",
      campaign_id: "camp-1",
      email: "lead@example.com",
      timestamp: "2026-03-10T10:05:00Z",
      variant: 1,
      step: 0,
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("email_opened");
    }
  });

  it("parses email_opened without optional fields", () => {
    const event = {
      event_type: "email_opened",
      campaign_id: "camp-1",
      email: "lead@example.com",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("webhookEventSchema — link_clicked", () => {
  it("parses a valid link_clicked event with URL", () => {
    const event = {
      event_type: "link_clicked",
      campaign_id: "camp-1",
      email: "lead@example.com",
      url: "https://example.com/demo",
      timestamp: "2026-03-10T10:10:00Z",
      variant: 1,
      step: 0,
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success && result.data.event_type === "link_clicked") {
      expect(result.data.url).toBe("https://example.com/demo");
    }
  });

  it("parses link_clicked without URL", () => {
    const event = {
      event_type: "link_clicked",
      campaign_id: "camp-1",
      email: "lead@example.com",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("webhookEventSchema — lead_meeting_booked", () => {
  it("parses a valid lead_meeting_booked event", () => {
    const event = {
      event_type: "lead_meeting_booked",
      campaign_id: "camp-1",
      email: "lead@example.com",
      timestamp: "2026-03-10T14:00:00Z",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("lead_meeting_booked");
    }
  });
});

describe("webhookEventSchema — lead_interested", () => {
  it("parses a valid lead_interested event", () => {
    const event = {
      event_type: "lead_interested",
      campaign_id: "camp-1",
      email: "lead@example.com",
      timestamp: "2026-03-10T12:00:00Z",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("lead_interested");
    }
  });

  it("parses lead_interested with minimal fields", () => {
    const event = {
      event_type: "lead_interested",
      campaign_id: "camp-1",
      email: "lead@example.com",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("webhookEventSchema — lead_not_interested", () => {
  it("parses a valid lead_not_interested event", () => {
    const event = {
      event_type: "lead_not_interested",
      campaign_id: "camp-1",
      email: "lead@example.com",
      timestamp: "2026-03-10T12:00:00Z",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("lead_not_interested");
    }
  });
});

describe("webhookEventSchema — account_error", () => {
  it("parses account_error with all fields", () => {
    const event = {
      event_type: "account_error",
      campaign_id: "camp-1",
      account_email: "sender@company.com",
      error_message: "SMTP authentication failed",
      timestamp: "2026-03-10T09:00:00Z",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success && result.data.event_type === "account_error") {
      expect(result.data.error_message).toBe("SMTP authentication failed");
      expect(result.data.account_email).toBe("sender@company.com");
    }
  });

  it("parses account_error with minimal fields (all optional)", () => {
    const event = {
      event_type: "account_error",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("webhookEventSchema — campaign_completed (existing)", () => {
  it("still parses campaign_completed", () => {
    const event = {
      event_type: "campaign_completed",
      campaign_id: "camp-1",
      timestamp: "2026-03-10T18:00:00Z",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("webhookEventSchema — existing events still work", () => {
  it("parses reply_received", () => {
    const event = {
      event_type: "reply_received",
      campaign_id: "camp-1",
      email: "lead@example.com",
      from_email: "lead@example.com",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("parses email_bounced", () => {
    const event = {
      event_type: "email_bounced",
      campaign_id: "camp-1",
      email: "lead@example.com",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("parses lead_unsubscribed", () => {
    const event = {
      event_type: "lead_unsubscribed",
      campaign_id: "camp-1",
      email: "lead@example.com",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("webhookEventSchema — unknown events", () => {
  it("rejects unknown event types", () => {
    const event = {
      event_type: "some_future_event",
      campaign_id: "camp-1",
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects events missing required fields", () => {
    const event = {
      event_type: "email_sent",
      // missing campaign_id and email
    };
    const result = webhookEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

// ─── Variant index conversion for new events ────────────

describe("webhookVariantToIndex with new event types", () => {
  it("converts variant from email_sent payload", () => {
    // email_sent typically has variant for the subject used
    expect(webhookVariantToIndex(1)).toBe(0); // primary
    expect(webhookVariantToIndex(2)).toBe(1); // variant A
    expect(webhookVariantToIndex(3)).toBe(2); // variant B
  });

  it("returns null when no variant in event", () => {
    expect(webhookVariantToIndex(undefined)).toBeNull();
    expect(webhookVariantToIndex(null)).toBeNull();
  });
});
