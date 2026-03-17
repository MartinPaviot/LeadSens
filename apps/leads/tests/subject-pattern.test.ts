import { describe, it, expect } from "vitest";
import { detectSubjectPattern, getReplyRateBySubjectPatternSQL, toCorrelationRows } from "@/server/lib/analytics/correlator";

describe("detectSubjectPattern", () => {
  describe("Question pattern", () => {
    it("detects trailing question mark", () => {
      expect(detectSubjectPattern("Scaling your team?")).toBe("Question");
    });

    it("detects leading question words", () => {
      expect(detectSubjectPattern("How are you handling X")).toBe("Question");
      expect(detectSubjectPattern("What if you could save 20%")).toBe("Question");
      expect(detectSubjectPattern("Why most teams fail at this")).toBe("Question");
      expect(detectSubjectPattern("Quick question about your team")).toBe("Question");
    });

    it("is case-insensitive", () => {
      expect(detectSubjectPattern("HOW do you handle it?")).toBe("Question");
    });
  });

  describe("Personalized pattern", () => {
    it("detects re: prefix", () => {
      expect(detectSubjectPattern("Re: your hiring push")).toBe("Personalized");
    });

    it("detects congrats prefix", () => {
      expect(detectSubjectPattern("Congrats on the funding")).toBe("Personalized");
    });

    it("detects saw your prefix", () => {
      expect(detectSubjectPattern("Saw your recent post")).toBe("Personalized");
    });

    it("detects noticed your prefix", () => {
      expect(detectSubjectPattern("Noticed your expansion")).toBe("Personalized");
    });

    it("detects about your prefix", () => {
      expect(detectSubjectPattern("About your pipeline")).toBe("Personalized");
    });
  });

  describe("Observation pattern", () => {
    it("detects noticed keyword mid-sentence", () => {
      expect(detectSubjectPattern("We noticed a trend")).toBe("Observation");
    });

    it("detects saw keyword mid-sentence", () => {
      expect(detectSubjectPattern("Just saw the results")).toBe("Observation");
    });

    it("detects spotted keyword", () => {
      expect(detectSubjectPattern("Spotted an opportunity")).toBe("Observation");
    });
  });

  describe("Curiosity pattern", () => {
    it("detects idea keyword", () => {
      expect(detectSubjectPattern("An idea for Acme")).toBe("Curiosity");
    });

    it("detects percentage numbers", () => {
      expect(detectSubjectPattern("47% of SaaS leaders agree")).toBe("Curiosity");
    });

    it("detects shift keyword", () => {
      expect(detectSubjectPattern("The shift in B2B sales")).toBe("Curiosity");
    });

    it("detects surprising keyword", () => {
      expect(detectSubjectPattern("Surprising data on outbound")).toBe("Curiosity");
    });
  });

  describe("Direct pattern (fallback)", () => {
    it("classifies plain subjects as Direct", () => {
      expect(detectSubjectPattern("Acme + LeadSens")).toBe("Direct");
    });

    it("classifies short intro subjects as Direct", () => {
      expect(detectSubjectPattern("Quick intro")).toBe("Direct");
    });

    it("classifies resource subjects as Direct", () => {
      expect(detectSubjectPattern("Sales playbook inside")).toBe("Direct");
    });
  });

  describe("priority ordering", () => {
    it("Question takes priority over Observation (question mark wins)", () => {
      // "noticed" would match Observation, but "?" makes it Question
      expect(detectSubjectPattern("Noticed your team growing?")).toBe("Question");
    });

    it("Personalized takes priority over Observation (prefix wins)", () => {
      // "Saw your" prefix = Personalized, not Observation
      expect(detectSubjectPattern("Saw your latest launch")).toBe("Personalized");
    });
  });

  describe("all 5 patterns are reachable", () => {
    it("covers all 5 pattern values", () => {
      const patterns = new Set([
        detectSubjectPattern("How does it work?"),       // Question
        detectSubjectPattern("We noticed a gap"),         // Observation
        detectSubjectPattern("An idea for your team"),    // Curiosity
        detectSubjectPattern("Acme + LeadSens"),          // Direct
        detectSubjectPattern("Re: your recent post"),     // Personalized
      ]);
      expect(patterns.size).toBe(5);
      expect(patterns).toContain("Question");
      expect(patterns).toContain("Observation");
      expect(patterns).toContain("Curiosity");
      expect(patterns).toContain("Direct");
      expect(patterns).toContain("Personalized");
    });
  });

  describe("pattern is deterministic", () => {
    it("same subject always returns same pattern", () => {
      const subject = "47% of teams struggle with this";
      const results = Array.from({ length: 10 }, () => detectSubjectPattern(subject));
      expect(new Set(results).size).toBe(1);
    });
  });
});

describe("subjectPattern metadata integration", () => {
  it("detectSubjectPattern returns valid pattern for typical subjects", () => {
    const validPatterns = ["Question", "Observation", "Curiosity", "Direct", "Personalized"];
    const subjects = [
      "quick question about hiring",
      "we spotted an opportunity",
      "an idea for growth",
      "intro + demo",
      "re: your funding round",
      "scaling SaaS teams",
      "47% of leaders agree",
      "congrats on the launch",
      "just saw the results",
      "surprising data on outreach",
    ];
    for (const s of subjects) {
      expect(validPatterns).toContain(detectSubjectPattern(s));
    }
  });

  it("handles empty and edge-case subjects gracefully", () => {
    expect(detectSubjectPattern("")).toBe("Direct"); // fallback
    expect(detectSubjectPattern("   ")).toBe("Direct"); // whitespace
    expect(detectSubjectPattern("?")).toBe("Question"); // just a question mark
    expect(detectSubjectPattern("re: ")).toBe("Direct"); // "re: " trims to "re:" — no content after prefix, falls to Direct
    expect(detectSubjectPattern("re: something")).toBe("Personalized"); // re: with content
  });
});

describe("getReplyRateBySubjectPatternSQL is exported", () => {
  it("is a function", () => {
    expect(typeof getReplyRateBySubjectPatternSQL).toBe("function");
  });
});

describe("toCorrelationRows filters and computes rates", () => {
  it("filters rows with less than 5 sent", () => {
    const rows = [
      { dimension: "Question", sent: BigInt(4), opened: BigInt(2), replied: BigInt(1) },
      { dimension: "Direct", sent: BigInt(10), opened: BigInt(5), replied: BigInt(2) },
    ];
    const result = toCorrelationRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe("Direct");
  });

  it("computes correct open and reply rates", () => {
    const rows = [
      { dimension: "Curiosity", sent: BigInt(100), opened: BigInt(40), replied: BigInt(10) },
    ];
    const result = toCorrelationRows(rows);
    expect(result[0].openRate).toBe(40);
    expect(result[0].replyRate).toBe(10);
  });

  it("returns empty for empty input", () => {
    expect(toCorrelationRows([])).toEqual([]);
  });
});
