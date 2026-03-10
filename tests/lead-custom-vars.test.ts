import { describe, it, expect } from "vitest";
import { buildLeadCustomVars } from "@/server/lib/tools/instantly-tools";

describe("buildLeadCustomVars", () => {
  // ─── Subject variant fallback (SUBJ-FIX-01) ──────────

  it("sets v2/v3 to primary subject when subjectVariants is null", () => {
    const vars = buildLeadCustomVars([
      { step: 0, subject: "quick question", body: "Hello", subjectVariants: null },
    ]);
    expect(vars["email_step_0_subject"]).toBe("quick question");
    expect(vars["email_step_0_subject_v2"]).toBe("quick question");
    expect(vars["email_step_0_subject_v3"]).toBe("quick question");
  });

  it("sets v2/v3 to primary subject when subjectVariants is undefined", () => {
    const vars = buildLeadCustomVars([
      { step: 0, subject: "quick question", body: "Hello" },
    ]);
    expect(vars["email_step_0_subject_v2"]).toBe("quick question");
    expect(vars["email_step_0_subject_v3"]).toBe("quick question");
  });

  it("sets v2/v3 to primary subject when subjectVariants is empty array", () => {
    const vars = buildLeadCustomVars([
      { step: 0, subject: "quick question", body: "Hello", subjectVariants: [] },
    ]);
    expect(vars["email_step_0_subject_v2"]).toBe("quick question");
    expect(vars["email_step_0_subject_v3"]).toBe("quick question");
  });

  it("uses actual variants when subjectVariants has 2 entries", () => {
    const vars = buildLeadCustomVars([
      {
        step: 0,
        subject: "primary subject",
        body: "Hello",
        subjectVariants: ["variant two", "variant three"],
      },
    ]);
    expect(vars["email_step_0_subject"]).toBe("primary subject");
    expect(vars["email_step_0_subject_v2"]).toBe("variant two");
    expect(vars["email_step_0_subject_v3"]).toBe("variant three");
  });

  it("falls back v3 to primary when subjectVariants has only 1 entry", () => {
    const vars = buildLeadCustomVars([
      {
        step: 0,
        subject: "primary subject",
        body: "Hello",
        subjectVariants: ["only one variant"],
      },
    ]);
    expect(vars["email_step_0_subject_v2"]).toBe("only one variant");
    expect(vars["email_step_0_subject_v3"]).toBe("primary subject");
  });

  it("never produces raw placeholder text for any step", () => {
    const vars = buildLeadCustomVars([
      { step: 0, subject: "step 0 subj", body: "body 0", subjectVariants: null },
      { step: 1, subject: "step 1 subj", body: "body 1", subjectVariants: null },
      { step: 2, subject: "step 2 subj", body: "body 2", subjectVariants: ["v2 only"] },
      { step: 3, subject: "step 3 subj", body: "body 3", subjectVariants: ["v2", "v3"] },
      { step: 4, subject: "step 4 subj", body: "body 4" },
      { step: 5, subject: "step 5 subj", body: "body 5", subjectVariants: [] },
    ]);

    // No value should contain double curly braces (raw template var)
    for (const [key, value] of Object.entries(vars)) {
      if (key.includes("subject")) {
        expect(value).not.toMatch(/\{\{/);
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  // ─── Body handling ────────────────────────────────────

  it("converts newlines to <br> in body", () => {
    const vars = buildLeadCustomVars([
      { step: 0, subject: "test", body: "line1\nline2\nline3" },
    ]);
    expect(vars["email_step_0_body"]).toBe("line1<br>line2<br>line3");
  });

  it("uses userEdit over body when present", () => {
    const vars = buildLeadCustomVars([
      { step: 0, subject: "test", body: "original", userEdit: "edited version" },
    ]);
    expect(vars["email_step_0_body"]).toBe("edited version");
  });

  it("uses body when userEdit is null", () => {
    const vars = buildLeadCustomVars([
      { step: 0, subject: "test", body: "original", userEdit: null },
    ]);
    expect(vars["email_step_0_body"]).toBe("original");
  });

  // ─── Multi-step ───────────────────────────────────────

  it("handles all 6 steps with correct key naming", () => {
    const emails = [0, 1, 2, 3, 4, 5].map((step) => ({
      step,
      subject: `subj ${step}`,
      body: `body ${step}`,
      subjectVariants: [`v2 for ${step}`, `v3 for ${step}`],
    }));
    const vars = buildLeadCustomVars(emails);

    expect(Object.keys(vars)).toHaveLength(6 * 4); // subject + body + v2 + v3 per step
    for (let i = 0; i < 6; i++) {
      expect(vars[`email_step_${i}_subject`]).toBe(`subj ${i}`);
      expect(vars[`email_step_${i}_body`]).toBe(`body ${i}`);
      expect(vars[`email_step_${i}_subject_v2`]).toBe(`v2 for ${i}`);
      expect(vars[`email_step_${i}_subject_v3`]).toBe(`v3 for ${i}`);
    }
  });
});
