import { describe, it, expect } from "vitest";
import { detectCategory } from "@/server/lib/email/style-learner";
import type { StyleCategory } from "@/server/lib/email/style-learner";

describe("detectCategory", () => {
  // ─── Subject (≤8 words both sides) ────────────────────
  describe("subject", () => {
    it("detects short text as subject edit", () => {
      expect(detectCategory("Quick question", "Quick thought")).toBe("subject");
    });

    it("detects 8-word subject lines", () => {
      expect(
        detectCategory(
          "One two three four five six seven eight",
          "One two three four five six seven nine",
        ),
      ).toBe("subject");
    });

    it("does NOT classify 9-word text as subject", () => {
      expect(
        detectCategory(
          "One two three four five six seven eight nine",
          "One two three four five six seven eight ten",
        ),
      ).not.toBe("subject");
    });

    it("detects single-word subject change", () => {
      expect(detectCategory("Hello", "Hey")).toBe("subject");
    });
  });

  // ─── Length (>30% word count change) ──────────────────
  describe("length", () => {
    it("detects significant shortening as length", () => {
      const original =
        "This is a long email body that has many words. It talks about several topics in detail. The message is quite verbose and could be shorter.";
      const edit = "This is shorter. Much more concise.";
      expect(detectCategory(original, edit)).toBe("length");
    });

    it("detects significant lengthening as length", () => {
      const original = "Short message here. Just two sentences.";
      const edit =
        "Short message here. Just two sentences. Adding more context about the topic. Here is another point. And yet another sentence to make it longer. Plus one more for good measure.";
      expect(detectCategory(original, edit)).toBe("length");
    });

    it("does NOT detect <30% change as length", () => {
      const original =
        "This is a message with ten words total here yes. Second sentence here.";
      const edit =
        "This is a message with nine words total here. Second sentence here.";
      expect(detectCategory(original, edit)).not.toBe("length");
    });
  });

  // ─── Opener (first sentence changed, rest same) ──────
  describe("opener", () => {
    it("detects changed first sentence as opener", () => {
      const original =
        "I came across your profile on LinkedIn. Your team at Acme seems to be growing fast. Would love to connect.";
      const edit =
        "Noticed Acme just raised a Series B. Your team at Acme seems to be growing fast. Would love to connect.";
      expect(detectCategory(original, edit)).toBe("opener");
    });

    it("does NOT classify as opener if rest also changes", () => {
      const original =
        "I came across your profile. Your team seems to be growing. Would love to connect.";
      const edit =
        "Noticed Acme raised a Series B. Your team is hiring rapidly. Would love to chat.";
      // Different first AND rest → not opener
      expect(detectCategory(original, edit)).not.toBe("opener");
    });

    it("does NOT classify single-sentence text as opener", () => {
      const original = "Hello this is one sentence";
      const edit = "Hey this is one sentence different";
      // Only 1 sentence each → can't be opener
      expect(detectCategory(original, edit)).not.toBe("opener");
    });
  });

  // ─── CTA (only last sentence changed) ────────────────
  describe("cta", () => {
    it("detects changed last sentence as CTA", () => {
      const original =
        "Your team at Acme seems to be growing fast. We help companies scale their outbound. Want to book a call?";
      const edit =
        "Your team at Acme seems to be growing fast. We help companies scale their outbound. Open to a quick chat next week?";
      expect(detectCategory(original, edit)).toBe("cta");
    });

    it("does NOT classify as CTA if earlier content also changes", () => {
      const original =
        "Noticed your team is growing. We help scale outbound. Want a call?";
      const edit =
        "Saw Acme is hiring. We help scale outbound. Open to a quick chat?";
      expect(detectCategory(original, edit)).not.toBe("cta");
    });
  });

  // ─── Tone (same structure/length, different wording) ──
  describe("tone", () => {
    it("detects word-level changes with same structure as tone", () => {
      const original =
        "We would be thrilled to assist your team. Our product is exceptional.";
      const edit =
        "We can help your team move faster. Our product is battle-tested.";
      expect(detectCategory(original, edit)).toBe("tone");
    });

    it("detects formality change as tone", () => {
      const original =
        "I would like to schedule a meeting. Please let me know your availability.";
      const edit =
        "Want to jump on a quick call? Let me know when works for you.";
      expect(detectCategory(original, edit)).toBe("tone");
    });

    it("identical text does NOT match tone", () => {
      const text = "We are thrilled to assist your team with this. Our product excels at solving problems.";
      // identical text → general (not a real correction)
      expect(detectCategory(text, text)).toBe("general");
    });
  });

  // ─── General (fallback) ──────────────────────────────
  describe("general", () => {
    it("identical text returns general", () => {
      const text =
        "This is a longer body with multiple sentences. It has several parts. And it is exactly the same.";
      expect(detectCategory(text, text)).toBe("general");
    });

    it("mixed changes with different sentence count returns general", () => {
      const original =
        "First sentence here. Second sentence here. Third sentence here.";
      const edit =
        "Different first. Different second. Different third. And a fourth.";
      expect(detectCategory(original, edit)).toBe("general");
    });
  });

  // ─── Edge Cases ──────────────────────────────────────
  describe("edge cases", () => {
    it("empty strings return general (identical)", () => {
      expect(detectCategory("", "")).toBe("general");
    });

    it("one empty, one short returns subject", () => {
      expect(detectCategory("", "New subject")).toBe("subject");
    });

    it("one empty, one long returns length", () => {
      const longText =
        "This is a very long piece of text that has many more than eight words in it to ensure it goes over the limit.";
      expect(detectCategory("", longText)).toBe("length");
    });

    it("all 6 categories are reachable", () => {
      const results = new Set<StyleCategory>();

      // subject
      results.add(detectCategory("Hello", "Hi"));
      // length
      results.add(
        detectCategory(
          "Short.",
          "This is much much longer text with many words added. Another sentence too. And more content here to push it over the threshold significantly.",
        ),
      );
      // opener (must be >8 words to avoid subject classification)
      results.add(
        detectCategory(
          "I came across your profile and wanted to reach out. Your team at Acme seems to be growing fast. Would love to connect with you.",
          "Noticed Acme just raised a Series B round recently. Your team at Acme seems to be growing fast. Would love to connect with you.",
        ),
      );
      // cta (must be >8 words to avoid subject classification)
      results.add(
        detectCategory(
          "Your team at Acme seems to be growing pretty fast. We help companies scale their outbound efforts. Want to book a quick call this week?",
          "Your team at Acme seems to be growing pretty fast. We help companies scale their outbound efforts. Open to a quick fifteen minute chat?",
        ),
      );
      // tone
      results.add(
        detectCategory(
          "We are delighted to assist. Our solution excels.",
          "We can help you win faster. Our tool is proven.",
        ),
      );
      // general (identical text)
      results.add(
        detectCategory(
          "First sentence here. Second sentence here. Third sentence here.",
          "First sentence here. Second sentence here. Third sentence here.",
        ),
      );

      expect(results.size).toBe(6);
      expect(results).toContain("subject");
      expect(results).toContain("length");
      expect(results).toContain("opener");
      expect(results).toContain("cta");
      expect(results).toContain("tone");
      expect(results).toContain("general");
    });

    it("priority: subject wins over length for short texts", () => {
      // 3 words → 1 word = 66% change, but both ≤8 words → subject wins
      expect(detectCategory("Three words here", "One")).toBe("subject");
    });

    it("priority: length wins over opener for big changes", () => {
      // First sentence different + huge length change → length wins (checked first)
      const original =
        "Old opener. Same middle. Same end.";
      const edit =
        "New opener. Same middle. Same end. Plus many extra words added to make this significantly longer than the original version.";
      expect(detectCategory(original, edit)).toBe("length");
    });
  });
});
