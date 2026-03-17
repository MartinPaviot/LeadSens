import { describe, it, expect } from "vitest";
import { VALID_TRANSITIONS } from "@/server/lib/lead-status";
import {
  parseCSV,
  CSV_FIELD_MAP,
  buildInsightSuggestions,
  classifyResultSchema,
} from "@/server/lib/tools/pipeline-tools";

// ─── VALID_TRANSITIONS (state machine) ──────────────────

describe("VALID_TRANSITIONS", () => {
  // Pre-launch pipeline
  it("SOURCED can transition to SCORED or SKIPPED", () => {
    expect(VALID_TRANSITIONS["SOURCED"]).toEqual(
      expect.arrayContaining(["SCORED", "SKIPPED"]),
    );
    expect(VALID_TRANSITIONS["SOURCED"]).toHaveLength(2);
  });

  it("SCORED can transition to ENRICHED or SKIPPED", () => {
    expect(VALID_TRANSITIONS["SCORED"]).toEqual(
      expect.arrayContaining(["ENRICHED", "SKIPPED"]),
    );
    expect(VALID_TRANSITIONS["SCORED"]).toHaveLength(2);
  });

  it("ENRICHED can only transition to DRAFTED", () => {
    expect(VALID_TRANSITIONS["ENRICHED"]).toEqual(["DRAFTED"]);
  });

  it("DRAFTED can only transition to PUSHED", () => {
    expect(VALID_TRANSITIONS["DRAFTED"]).toEqual(["PUSHED"]);
  });

  // Post-launch lifecycle
  it("PUSHED can transition to SENT, BOUNCED, or UNSUBSCRIBED", () => {
    expect(VALID_TRANSITIONS["PUSHED"]).toEqual(
      expect.arrayContaining(["SENT", "BOUNCED", "UNSUBSCRIBED"]),
    );
    expect(VALID_TRANSITIONS["PUSHED"]).toHaveLength(3);
  });

  it("SENT can transition to REPLIED, BOUNCED, or UNSUBSCRIBED", () => {
    expect(VALID_TRANSITIONS["SENT"]).toEqual(
      expect.arrayContaining(["REPLIED", "BOUNCED", "UNSUBSCRIBED"]),
    );
    expect(VALID_TRANSITIONS["SENT"]).toHaveLength(3);
  });

  it("REPLIED can transition to INTERESTED, NOT_INTERESTED, or MEETING_BOOKED", () => {
    expect(VALID_TRANSITIONS["REPLIED"]).toEqual(
      expect.arrayContaining(["INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED"]),
    );
    expect(VALID_TRANSITIONS["REPLIED"]).toHaveLength(3);
  });

  it("INTERESTED can only transition to MEETING_BOOKED", () => {
    expect(VALID_TRANSITIONS["INTERESTED"]).toEqual(["MEETING_BOOKED"]);
  });

  // Terminal states
  it("MEETING_BOOKED is a terminal state (no transitions)", () => {
    expect(VALID_TRANSITIONS["MEETING_BOOKED"]).toBeUndefined();
  });

  it("NOT_INTERESTED is a terminal state", () => {
    expect(VALID_TRANSITIONS["NOT_INTERESTED"]).toBeUndefined();
  });

  it("BOUNCED is a terminal state", () => {
    expect(VALID_TRANSITIONS["BOUNCED"]).toBeUndefined();
  });

  it("UNSUBSCRIBED is a terminal state", () => {
    expect(VALID_TRANSITIONS["UNSUBSCRIBED"]).toBeUndefined();
  });

  it("SKIPPED is a terminal state", () => {
    expect(VALID_TRANSITIONS["SKIPPED"]).toBeUndefined();
  });

  // Invalid transitions (regression guards)
  it("rejects SOURCED → PUSHED (must go through pipeline)", () => {
    expect(VALID_TRANSITIONS["SOURCED"]).not.toContain("PUSHED");
  });

  it("rejects DRAFTED → REPLIED (must be PUSHED first)", () => {
    expect(VALID_TRANSITIONS["DRAFTED"]).not.toContain("REPLIED");
  });

  it("rejects PUSHED → INTERESTED (must be REPLIED first)", () => {
    expect(VALID_TRANSITIONS["PUSHED"]).not.toContain("INTERESTED");
  });

  it("rejects SOURCED → ENRICHED (must be SCORED first)", () => {
    expect(VALID_TRANSITIONS["SOURCED"]).not.toContain("ENRICHED");
  });

  it("rejects backward transitions (ENRICHED → SOURCED)", () => {
    expect(VALID_TRANSITIONS["ENRICHED"]).not.toContain("SOURCED");
  });

  // Snapshot for regression detection
  it("matches the full transition map snapshot", () => {
    expect(VALID_TRANSITIONS).toMatchInlineSnapshot(`
      {
        "DRAFTED": [
          "PUSHED",
        ],
        "ENRICHED": [
          "DRAFTED",
        ],
        "INTERESTED": [
          "MEETING_BOOKED",
        ],
        "PUSHED": [
          "SENT",
          "BOUNCED",
          "UNSUBSCRIBED",
        ],
        "REPLIED": [
          "INTERESTED",
          "NOT_INTERESTED",
          "MEETING_BOOKED",
        ],
        "SCORED": [
          "ENRICHED",
          "SKIPPED",
        ],
        "SENT": [
          "REPLIED",
          "BOUNCED",
          "UNSUBSCRIBED",
        ],
        "SOURCED": [
          "SCORED",
          "SKIPPED",
        ],
      }
    `);
  });
});

// ─── CSV_FIELD_MAP ──────────────────────────────────────

describe("CSV_FIELD_MAP", () => {
  it("maps all email variants to 'email'", () => {
    expect(CSV_FIELD_MAP["email"]).toBe("email");
    expect(CSV_FIELD_MAP["email address"]).toBe("email");
    expect(CSV_FIELD_MAP["e-mail"]).toBe("email");
  });

  it("maps French first name variants", () => {
    expect(CSV_FIELD_MAP["prenom"]).toBe("firstName");
    expect(CSV_FIELD_MAP["prénom"]).toBe("firstName");
  });

  it("maps French company variants", () => {
    expect(CSV_FIELD_MAP["entreprise"]).toBe("company");
    expect(CSV_FIELD_MAP["société"]).toBe("company");
    expect(CSV_FIELD_MAP["societe"]).toBe("company");
  });

  it("maps job title variants", () => {
    expect(CSV_FIELD_MAP["job_title"]).toBe("jobTitle");
    expect(CSV_FIELD_MAP["title"]).toBe("jobTitle");
    expect(CSV_FIELD_MAP["poste"]).toBe("jobTitle");
  });

  it("maps all 10 canonical fields", () => {
    const canonicalFields = new Set(Object.values(CSV_FIELD_MAP));
    expect(canonicalFields).toEqual(
      new Set([
        "email", "firstName", "lastName", "company", "jobTitle",
        "linkedinUrl", "phone", "website", "country", "industry", "companySize",
      ]),
    );
  });
});

// ─── parseCSV ───────────────────────────────────────────

describe("parseCSV", () => {
  it("parses comma-delimited CSV", () => {
    const csv = "email,first_name,company\njohn@acme.com,John,Acme Inc";
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      { email: "john@acme.com", firstName: "John", company: "Acme Inc" },
    ]);
  });

  it("parses semicolon-delimited CSV", () => {
    const csv = "email;first_name;company\njohn@acme.com;John;Acme Inc";
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      { email: "john@acme.com", firstName: "John", company: "Acme Inc" },
    ]);
  });

  it("parses tab-delimited CSV", () => {
    const csv = "email\tfirst_name\tcompany\njohn@acme.com\tJohn\tAcme Inc";
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      { email: "john@acme.com", firstName: "John", company: "Acme Inc" },
    ]);
  });

  it("strips quotes from headers and values", () => {
    const csv = '"email","first_name","company"\n"john@acme.com","John","Acme Inc"';
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      { email: "john@acme.com", firstName: "John", company: "Acme Inc" },
    ]);
  });

  it("handles single quotes", () => {
    const csv = "'email','first_name'\n'john@acme.com','John'";
    const rows = parseCSV(csv);
    expect(rows).toEqual([{ email: "john@acme.com", firstName: "John" }]);
  });

  it("handles \\r\\n line endings (Windows)", () => {
    const csv = "email,first_name\r\njohn@acme.com,John\r\njane@acme.com,Jane";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].email).toBe("john@acme.com");
    expect(rows[1].email).toBe("jane@acme.com");
  });

  it("skips rows without email", () => {
    const csv = "email,first_name\n,John\njane@acme.com,Jane";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("jane@acme.com");
  });

  it("skips empty lines", () => {
    const csv = "email,first_name\n\njohn@acme.com,John\n\n";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
  });

  it("returns empty array for header-only CSV", () => {
    const csv = "email,first_name";
    const rows = parseCSV(csv);
    expect(rows).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("\n")).toEqual([]);
  });

  it("returns empty array for single empty line", () => {
    expect(parseCSV("   ")).toEqual([]);
  });

  it("ignores unmapped columns", () => {
    const csv = "email,custom_field,unknown_col\njohn@acme.com,custom_val,other";
    const rows = parseCSV(csv);
    expect(rows).toEqual([{ email: "john@acme.com" }]);
  });

  it("maps French headers correctly", () => {
    const csv = "email,prénom,nom,entreprise,poste,pays\njohn@acme.com,Jean,Dupont,Acme,CEO,France";
    const rows = parseCSV(csv);
    expect(rows).toEqual([{
      email: "john@acme.com",
      firstName: "Jean",
      lastName: "Dupont",
      company: "Acme",
      jobTitle: "CEO",
      country: "France",
    }]);
  });

  it("handles all canonical fields in one row", () => {
    const csv = [
      "email,first_name,last_name,company,job_title,linkedin,phone,website,country,industry,company_size",
      "john@acme.com,John,Doe,Acme,CEO,https://linkedin.com/in/jd,+1234567890,https://acme.com,US,SaaS,51-200",
    ].join("\n");
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      email: "john@acme.com",
      firstName: "John",
      lastName: "Doe",
      company: "Acme",
      jobTitle: "CEO",
      linkedinUrl: "https://linkedin.com/in/jd",
      phone: "+1234567890",
      website: "https://acme.com",
      country: "US",
      industry: "SaaS",
      companySize: "51-200",
    });
  });

  it("trims whitespace from headers and values", () => {
    const csv = "  email  ,  first_name  \n  john@acme.com  ,  John  ";
    const rows = parseCSV(csv);
    expect(rows).toEqual([{ email: "john@acme.com", firstName: "John" }]);
  });

  it("handles case-insensitive headers via lowercase", () => {
    const csv = "Email,First_Name,Company\njohn@acme.com,John,Acme";
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      { email: "john@acme.com", firstName: "John", company: "Acme" },
    ]);
  });

  it("parses multiple rows correctly", () => {
    const csv = [
      "email,first_name,company",
      "alice@acme.com,Alice,Acme",
      "bob@beta.com,Bob,Beta",
      "carol@gamma.com,Carol,Gamma",
    ].join("\n");
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.email)).toEqual([
      "alice@acme.com", "bob@beta.com", "carol@gamma.com",
    ]);
  });

  it("prefers tab delimiter when present in headers", () => {
    // Tab takes priority over comma per the detection logic
    const csv = "email\tfirst_name,extra\njohn@acme.com\tJohn,extra";
    const rows = parseCSV(csv);
    // With tab delimiter, first column is "email" and second is "first_name,extra" (unmapped)
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("john@acme.com");
  });
});

// ─── classifyResultSchema ───────────────────────────────

describe("classifyResultSchema", () => {
  const validResult = {
    interest_level: "interested",
    interest_score: 8,
    reasoning: "Prospect asked about pricing",
    suggested_action: "draft_reply",
    meeting_intent: true,
  };

  it("accepts a valid classification result", () => {
    expect(() => classifyResultSchema.parse(validResult)).not.toThrow();
  });

  it("accepts all valid interest_level values", () => {
    const levels = ["interested", "not_interested", "question", "auto_reply", "out_of_office", "unsubscribe"];
    for (const level of levels) {
      expect(() =>
        classifyResultSchema.parse({ ...validResult, interest_level: level }),
      ).not.toThrow();
    }
  });

  it("rejects invalid interest_level", () => {
    expect(() =>
      classifyResultSchema.parse({ ...validResult, interest_level: "maybe" }),
    ).toThrow();
  });

  it("accepts all valid suggested_action values", () => {
    const actions = ["draft_reply", "remove_from_sequence", "ignore", "flag_for_review"];
    for (const action of actions) {
      expect(() =>
        classifyResultSchema.parse({ ...validResult, suggested_action: action }),
      ).not.toThrow();
    }
  });

  it("rejects interest_score outside 0-10 range", () => {
    expect(() =>
      classifyResultSchema.parse({ ...validResult, interest_score: -1 }),
    ).toThrow();
    expect(() =>
      classifyResultSchema.parse({ ...validResult, interest_score: 11 }),
    ).toThrow();
  });

  it("accepts boundary interest_score values (0 and 10)", () => {
    expect(() =>
      classifyResultSchema.parse({ ...validResult, interest_score: 0 }),
    ).not.toThrow();
    expect(() =>
      classifyResultSchema.parse({ ...validResult, interest_score: 10 }),
    ).not.toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => classifyResultSchema.parse({})).toThrow();
    expect(() =>
      classifyResultSchema.parse({ interest_level: "interested" }),
    ).toThrow();
  });

  it("requires meeting_intent to be boolean", () => {
    expect(() =>
      classifyResultSchema.parse({ ...validResult, meeting_intent: "yes" }),
    ).toThrow();
  });
});

// ─── buildInsightSuggestions ────────────────────────────

describe("buildInsightSuggestions", () => {
  it("returns empty array when no conditions met", () => {
    const suggestions = buildInsightSuggestions(
      [{ industry: "SaaS", replyRate: 10, count: 10 }],
      10, // 10 replied
      100, // 100 sent = 10% rate
      2, // 2% bounce
    );
    expect(suggestions).toEqual([]);
  });

  it("suggests focusing on top industry when 1.5x above average", () => {
    const suggestions = buildInsightSuggestions(
      [{ industry: "Fintech", replyRate: 25, count: 20 }],
      10, // replied
      100, // sent = 10% rate
      1, // bounce
    );
    // 25% > 10% * 1.5 = 15%, so should suggest
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain("Fintech");
    expect(suggestions[0]).toContain("25%");
    expect(suggestions[0]).toContain("10%");
  });

  it("does NOT suggest industry when not 1.5x above average", () => {
    const suggestions = buildInsightSuggestions(
      [{ industry: "SaaS", replyRate: 12, count: 10 }],
      10, 100, 1, // 10% average, 12% < 15% threshold
    );
    expect(suggestions.filter((s) => s.includes("SaaS"))).toHaveLength(0);
  });

  it("suggests bounce check when bounce rate > 5%", () => {
    const suggestions = buildInsightSuggestions(
      [], 5, 100, 6, // 6% bounce
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain("Bounce rate");
    expect(suggestions[0]).toContain("6%");
    expect(suggestions[0]).toContain("ZeroBounce");
  });

  it("does NOT suggest bounce check at exactly 5%", () => {
    const suggestions = buildInsightSuggestions([], 5, 100, 5);
    expect(suggestions.filter((s) => s.includes("Bounce"))).toHaveLength(0);
  });

  it("suggests review when reply rate < 5% with 50+ sent", () => {
    const suggestions = buildInsightSuggestions(
      [], 2, 100, 1, // 2% reply rate, 100 sent
    );
    expect(suggestions.some((s) => s.includes("Reply rate below 5%"))).toBe(true);
  });

  it("does NOT suggest review when reply rate < 5% but < 50 sent", () => {
    const suggestions = buildInsightSuggestions(
      [], 1, 30, 0, // 3.3% rate but only 30 sent
    );
    expect(suggestions.filter((s) => s.includes("Reply rate below 5%"))).toHaveLength(0);
  });

  it("suggests scaling when reply rate >= 15%", () => {
    const suggestions = buildInsightSuggestions(
      [], 15, 100, 1, // 15% reply rate
    );
    expect(suggestions.some((s) => s.includes("Strong 15%"))).toBe(true);
    expect(suggestions.some((s) => s.includes("scaling"))).toBe(true);
  });

  it("suggests scaling at exactly 15%", () => {
    const suggestions = buildInsightSuggestions([], 15, 100, 0);
    expect(suggestions.some((s) => s.includes("Strong"))).toBe(true);
  });

  it("can return multiple suggestions simultaneously", () => {
    // 25% top industry + 7% bounce + 3% overall = 3 suggestions (industry, bounce, low performance)
    const suggestions = buildInsightSuggestions(
      [{ industry: "HR", replyRate: 25, count: 10 }],
      3, // replied
      100, // sent = 3%
      8, // bounce 8%
    );
    // Industry (25% > 3%*1.5=4.5%), bounce (8% > 5%), low rate (3% < 5% with 100 sent)
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it("handles zero sent without crashing", () => {
    const suggestions = buildInsightSuggestions([], 0, 0, 0);
    expect(suggestions).toEqual([]);
  });

  it("handles empty topIndustries array", () => {
    const suggestions = buildInsightSuggestions([], 5, 50, 1);
    // No industry suggestion, no bounce (2%), rate is 10% — no conditions met
    expect(suggestions).toEqual([]);
  });
});

// ─── Transition validation logic (pure) ──────────────────

describe("transition validation logic (pure)", () => {
  function isValidTransition(from: string, to: string): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed?.includes(to as never) ?? false;
  }

  // Happy path: full pre-launch pipeline
  it("allows full pre-launch pipeline: SOURCED → SCORED → ENRICHED → DRAFTED → PUSHED", () => {
    expect(isValidTransition("SOURCED", "SCORED")).toBe(true);
    expect(isValidTransition("SCORED", "ENRICHED")).toBe(true);
    expect(isValidTransition("ENRICHED", "DRAFTED")).toBe(true);
    expect(isValidTransition("DRAFTED", "PUSHED")).toBe(true);
  });

  // Happy path: full post-launch lifecycle
  it("allows full post-launch lifecycle: PUSHED → SENT → REPLIED → INTERESTED → MEETING_BOOKED", () => {
    expect(isValidTransition("PUSHED", "SENT")).toBe(true);
    expect(isValidTransition("SENT", "REPLIED")).toBe(true);
    expect(isValidTransition("REPLIED", "INTERESTED")).toBe(true);
    expect(isValidTransition("INTERESTED", "MEETING_BOOKED")).toBe(true);
  });

  // Alternative paths
  it("allows REPLIED → MEETING_BOOKED (direct booking)", () => {
    expect(isValidTransition("REPLIED", "MEETING_BOOKED")).toBe(true);
  });

  it("allows REPLIED → NOT_INTERESTED", () => {
    expect(isValidTransition("REPLIED", "NOT_INTERESTED")).toBe(true);
  });

  it("allows SOURCED → SKIPPED (skip at scoring)", () => {
    expect(isValidTransition("SOURCED", "SKIPPED")).toBe(true);
  });

  it("allows SCORED → SKIPPED (skip at enrichment)", () => {
    expect(isValidTransition("SCORED", "SKIPPED")).toBe(true);
  });

  // Bounce/unsub from any sending state
  it("allows PUSHED → BOUNCED", () => {
    expect(isValidTransition("PUSHED", "BOUNCED")).toBe(true);
  });

  it("allows SENT → BOUNCED", () => {
    expect(isValidTransition("SENT", "BOUNCED")).toBe(true);
  });

  it("allows PUSHED → UNSUBSCRIBED", () => {
    expect(isValidTransition("PUSHED", "UNSUBSCRIBED")).toBe(true);
  });

  it("allows SENT → UNSUBSCRIBED", () => {
    expect(isValidTransition("SENT", "UNSUBSCRIBED")).toBe(true);
  });

  // Invalid: skip pipeline stages
  it("rejects SOURCED → DRAFTED (skips SCORED + ENRICHED)", () => {
    expect(isValidTransition("SOURCED", "DRAFTED")).toBe(false);
  });

  it("rejects SCORED → PUSHED (skips ENRICHED + DRAFTED)", () => {
    expect(isValidTransition("SCORED", "PUSHED")).toBe(false);
  });

  // Invalid: backward transitions
  it("rejects PUSHED → DRAFTED (backward)", () => {
    expect(isValidTransition("PUSHED", "DRAFTED")).toBe(false);
  });

  it("rejects REPLIED → SENT (backward)", () => {
    expect(isValidTransition("REPLIED", "SENT")).toBe(false);
  });

  // Invalid: from terminal states
  it("rejects MEETING_BOOKED → anything", () => {
    for (const target of ["SOURCED", "SCORED", "ENRICHED", "DRAFTED", "PUSHED", "SENT", "REPLIED", "INTERESTED"]) {
      expect(isValidTransition("MEETING_BOOKED", target)).toBe(false);
    }
  });

  it("rejects BOUNCED → anything", () => {
    expect(isValidTransition("BOUNCED", "SENT")).toBe(false);
    expect(isValidTransition("BOUNCED", "REPLIED")).toBe(false);
  });

  it("rejects UNSUBSCRIBED → anything", () => {
    expect(isValidTransition("UNSUBSCRIBED", "SENT")).toBe(false);
  });

  // Unknown states
  it("rejects transitions from unknown states", () => {
    expect(isValidTransition("UNKNOWN_STATE", "SCORED")).toBe(false);
  });
});
