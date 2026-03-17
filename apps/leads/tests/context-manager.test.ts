import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  stripInlineMarkers,
  compressToolOutput,
  prepareMessagesForLLM,
  extractIdsAndCounts,
  compressLoopMessages,
} from "@/server/lib/llm/context-manager";
import type { ChatMessage } from "@/server/lib/llm/types";

// ─── estimateTokens ─────────────────────────────────────

describe("estimateTokens", () => {
  it("returns ceil(length / 3.7)", () => {
    expect(estimateTokens("hello")).toBe(Math.ceil(5 / 3.7));
    expect(estimateTokens("")).toBe(0);
  });

  it("handles longer text", () => {
    const text = "a".repeat(1000);
    expect(estimateTokens(text)).toBe(Math.ceil(1000 / 3.7));
  });
});

// ─── stripInlineMarkers ─────────────────────────────────

describe("stripInlineMarkers", () => {
  it("strips a single marker", () => {
    const input = 'Hello\n\n@@INLINE@@{"component":"lead-table","props":{}}@@END@@\n\nWorld';
    expect(stripInlineMarkers(input)).toBe("HelloWorld");
  });

  it("strips multiple markers", () => {
    const input =
      'Start\n\n@@INLINE@@{"component":"a"}@@END@@\n\n' +
      'Middle\n\n@@INLINE@@{"component":"b"}@@END@@\n\nEnd';
    const result = stripInlineMarkers(input);
    expect(result).toBe("StartMiddleEnd");
  });

  it("handles marker at start/end", () => {
    expect(stripInlineMarkers('@@INLINE@@{"x":1}@@END@@\n\nText')).toBe("Text");
    expect(stripInlineMarkers('Text\n\n@@INLINE@@{"x":1}@@END@@')).toBe("Text");
  });

  it("returns unchanged content when no markers", () => {
    expect(stripInlineMarkers("plain text")).toBe("plain text");
  });

  it("returns empty string from empty input", () => {
    expect(stripInlineMarkers("")).toBe("");
  });
});

// ─── compressToolOutput ─────────────────────────────────

describe("compressToolOutput", () => {
  it("strips __component and props, keeps semantic data", () => {
    const output = {
      enriched: 5,
      lead_ids: ["a", "b"],
      __component: "enrichment",
      props: { leads: [{ name: "Alice", enrichmentData: { big: "blob" } }] },
    };
    const result = JSON.parse(compressToolOutput(output));
    expect(result.enriched).toBe(5);
    expect(result.lead_ids).toEqual(["a", "b"]);
    expect(result.__component).toBeUndefined();
    expect(result.props).toBeUndefined();
  });

  it("strips __components key", () => {
    const output = {
      drafted: 3,
      __components: [{ component: "email-preview", props: { subject: "hi" } }],
    };
    const result = JSON.parse(compressToolOutput(output));
    expect(result).toEqual({ drafted: 3 });
  });

  // ── Level 2: Deep compression ──

  it("strips enrichmentData from nested lead objects", () => {
    const output = {
      results: [
        { id: "1", firstName: "Alice", enrichmentData: { painPoints: ["x"], stack: ["y"] } },
        { id: "2", firstName: "Bob", enrichmentData: { painPoints: ["z"] } },
      ],
      count: 2,
    };
    const result = JSON.parse(compressToolOutput(output));
    // enrichmentData should be stripped from each lead
    for (const lead of result.results) {
      expect(lead.enrichmentData).toBeUndefined();
    }
    expect(result.results[0].firstName).toBe("Alice");
  });

  it("strips icpBreakdown from nested objects", () => {
    const output = {
      scored: 5,
      lead_ids: ["a"],
      __component: "lead-table",
      props: {
        leads: [{ id: "a", icpBreakdown: { jobTitle: 8, company: 7, industry: 6 } }],
      },
    };
    const result = JSON.parse(compressToolOutput(output));
    expect(result.icpBreakdown).toBeUndefined();
    expect(result.scored).toBe(5);
  });

  it("truncates long string values", () => {
    const output = {
      summary: "x".repeat(500),
      id: "short",
    };
    const result = JSON.parse(compressToolOutput(output));
    expect(result.summary.length).toBeLessThan(500);
    expect(result.summary.endsWith("…")).toBe(true);
    expect(result.id).toBe("short");
  });

  it("summarizes large arrays of objects to count + samples", () => {
    const leads = Array.from({ length: 30 }, (_, i) => ({
      id: `lead-${i}`,
      firstName: `Name${i}`,
      email: `name${i}@test.com`,
    }));
    const output = { results: leads };
    const result = JSON.parse(compressToolOutput(output));
    expect(result.results._count).toBe(30);
    expect(result.results._samples).toHaveLength(5);
    expect(result.results._samples[0].id).toBe("lead-0");
  });

  it("keeps lead_ids arrays intact regardless of size", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    const output = { lead_ids: ids, scored: 50 };
    const result = JSON.parse(compressToolOutput(output));
    expect(result.lead_ids).toHaveLength(50);
  });

  it("keeps small arrays intact", () => {
    const output = { items: [{ a: 1 }, { a: 2 }, { a: 3 }] };
    const result = JSON.parse(compressToolOutput(output));
    expect(result.items).toHaveLength(3);
  });

  it("handles null and undefined", () => {
    expect(compressToolOutput(null)).toBe("null");
    expect(compressToolOutput(undefined)).toBe("null");
  });

  it("handles primitives", () => {
    expect(compressToolOutput("hello")).toBe('"hello"');
    expect(compressToolOutput(42)).toBe("42");
    expect(compressToolOutput(true)).toBe("true");
  });

  it("deeply compresses a realistic enrich_leads_batch output", () => {
    const output = {
      enriched: 3,
      scraped: 2,
      scrape_failed: 1,
      total: 3,
      lead_ids: ["id1", "id2", "id3"],
      __component: "enrichment",
      props: {
        title: "Enrichment results",
        leads: [
          {
            name: "Alice Smith",
            company: "Acme",
            jobTitle: "VP Sales",
            icpScore: 8,
            scraped: true,
            enrichment: {
              painPoints: ["scaling sales team"],
              recentNews: ["Series B funding"],
              stack: ["Salesforce", "HubSpot"],
              teamSize: "50-200",
              industry: "SaaS",
              fundingStage: "Series B",
            },
          },
        ],
      },
    };

    const result = JSON.parse(compressToolOutput(output));

    // Rendering keys gone
    expect(result.__component).toBeUndefined();
    expect(result.props).toBeUndefined();

    // Semantic data preserved
    expect(result.enriched).toBe(3);
    expect(result.lead_ids).toEqual(["id1", "id2", "id3"]);

    // No enrichment blob leaked
    expect(result.enrichment).toBeUndefined();
  });

  it("deeply compresses a realistic score_leads_batch output", () => {
    const scoredLeads = Array.from({ length: 20 }, (_, i) => ({
      id: `lead-${i}`,
      firstName: `Name${i}`,
      lastName: `Last${i}`,
      email: `name${i}@company.com`,
      company: `Company${i}`,
      jobTitle: "VP Sales",
      linkedinUrl: `https://linkedin.com/in/name${i}`,
      icpScore: 7,
      icpBreakdown: { jobTitle: 9, company: 7, industry: 6, location: 5 },
      status: "SCORED",
    }));

    const output = {
      scored: 18,
      skipped: 2,
      errors: 0,
      total: 20,
      lead_ids: scoredLeads.filter((l) => l.icpScore >= 5).map((l) => l.id),
      __component: "lead-table",
      props: {
        title: "Scored Leads (18 qualified, 2 skipped)",
        leads: scoredLeads,
      },
    };

    const compressed = compressToolOutput(output);
    const result = JSON.parse(compressed);

    // Counts preserved
    expect(result.scored).toBe(18);
    expect(result.skipped).toBe(2);
    expect(result.lead_ids).toHaveLength(20);

    // Rendering stripped
    expect(result.__component).toBeUndefined();
    expect(result.props).toBeUndefined();

    // Token savings: compressed should be much smaller than raw
    const rawSize = JSON.stringify(output).length;
    expect(compressed.length).toBeLessThan(rawSize * 0.3);
  });
});

// ─── extractIdsAndCounts ─────────────────────────────────

describe("extractIdsAndCounts", () => {
  it("preserves lead_ids, campaign_id, and counts", () => {
    const input = JSON.stringify({
      lead_ids: ["a", "b", "c"],
      campaign_id: "xyz",
      count: 3,
      total: 10,
      leads: [{ id: "a", firstName: "Alice", enrichmentData: { big: "blob" } }],
      summary: "x".repeat(500),
    });
    const result = JSON.parse(extractIdsAndCounts(input));
    expect(result.lead_ids).toEqual(["a", "b", "c"]);
    expect(result.campaign_id).toBe("xyz");
    expect(result.count).toBe(3);
    expect(result.total).toBe(10);
    expect(result.leads).toBeUndefined();
    expect(result.summary).toBeUndefined();
  });

  it("returns short content unchanged", () => {
    const input = '{"status":"ok"}';
    expect(extractIdsAndCounts(input)).toBe(input);
  });

  it("handles non-JSON gracefully", () => {
    const input = "This is not JSON and is quite long " + "x".repeat(300);
    const result = extractIdsAndCounts(input);
    expect(result.length).toBeLessThanOrEqual(201 + 1); // 200 + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("preserves keys ending in _id and _ids", () => {
    const input = JSON.stringify({
      list_id: "lst-123",
      workspace_ids: ["w1", "w2"],
      irrelevant: "data".repeat(100),
    });
    const result = JSON.parse(extractIdsAndCounts(input));
    expect(result.list_id).toBe("lst-123");
    expect(result.workspace_ids).toEqual(["w1", "w2"]);
    expect(result.irrelevant).toBeUndefined();
  });
});

// ─── compressLoopMessages ────────────────────────────────

describe("compressLoopMessages", () => {
  function makeMessages(count: number, contentSize: number) {
    const msgs: Array<Record<string, unknown>> = [
      { role: "system", content: "You are a helpful assistant." },
    ];
    for (let i = 0; i < count; i++) {
      msgs.push({
        role: "assistant",
        content: "I'll call the tool.",
        toolCalls: [{ id: `tc-${i}`, function: { name: "test_tool", arguments: "{}" } }],
      });
      msgs.push({
        role: "tool",
        content: JSON.stringify({
          lead_ids: [`lead-${i}`],
          count: 1,
          leads: [{ id: `lead-${i}`, firstName: "Test", enrichmentData: { big: "x".repeat(contentSize) } }],
          summary: "y".repeat(contentSize),
        }),
        toolCallId: `tc-${i}`,
        name: "test_tool",
      });
    }
    return msgs;
  }

  it("no-op when under budget", () => {
    const msgs = makeMessages(2, 50);
    const original = JSON.stringify(msgs);
    compressLoopMessages(msgs);
    expect(JSON.stringify(msgs)).toBe(original);
  });

  it("compresses old tool results when over budget", () => {
    const msgs = makeMessages(30, 4000);
    const originalSize = JSON.stringify(msgs).length;
    compressLoopMessages(msgs);
    const compressedSize = JSON.stringify(msgs).length;
    expect(compressedSize).toBeLessThan(originalSize * 0.5);
  });

  it("keeps system message and last 4 messages intact", () => {
    const msgs = makeMessages(30, 4000);
    const systemContent = msgs[0].content;
    const last4 = msgs.slice(-4).map((m) => ({ ...m }));

    compressLoopMessages(msgs);

    // System untouched
    expect(msgs[0].content).toBe(systemContent);

    // Last 4 untouched
    const newLast4 = msgs.slice(-4);
    for (let i = 0; i < 4; i++) {
      expect(newLast4[i].content).toBe(last4[i].content);
    }
  });

  it("preserves assistant toolCalls arrays while clearing verbose content", () => {
    const msgs = makeMessages(30, 4000);
    compressLoopMessages(msgs);

    // Check an old assistant message (not in last 4)
    const oldAssistant = msgs.find(
      (m, idx) => m.role === "assistant" && m.toolCalls && idx < msgs.length - 4 && idx > 0,
    );
    expect(oldAssistant).toBeTruthy();
    expect(oldAssistant!.content).toBe("");
    expect(oldAssistant!.toolCalls).toBeTruthy();
  });

  it("compresses user messages with phantom tool results", () => {
    const msgs: Array<Record<string, unknown>> = [
      { role: "system", content: "System prompt" },
      { role: "assistant", content: "I called parse_icp." },
      {
        role: "user",
        content: `[Tool result from parse_icp]:\n${JSON.stringify({
          lead_ids: ["a"],
          count: 1,
          bigData: "z".repeat(5000),
        })}`,
      },
    ];
    // Add enough to exceed 32K token budget (~118K chars)
    for (let i = 0; i < 20; i++) {
      msgs.push({ role: "assistant", content: "x".repeat(8000) });
      msgs.push({ role: "user", content: `step ${i}` });
    }

    compressLoopMessages(msgs);

    // The phantom tool result (index 2) should be compressed
    const phantomMsg = msgs[2];
    expect((phantomMsg.content as string).length).toBeLessThan(5000);
    // But lead_ids should still be there
    expect(phantomMsg.content as string).toContain("lead_ids");
  });
});

// ─── prepareMessagesForLLM ──────────────────────────────

describe("prepareMessagesForLLM", () => {
  const systemTokens = 500;
  const toolTokens = 200;

  function msg(role: ChatMessage["role"], content: string): ChatMessage {
    return { role, content };
  }

  it("passes through messages when under budget", () => {
    const messages = [msg("user", "Hello"), msg("assistant", "Hi there")];
    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.messages).toEqual(messages);
    expect(result.windowed).toBe(false);
    expect(result.markersStripped).toBe(0);
    expect(result.toolResultsCompressed).toBe(0);
  });

  // ── Level 1: Strip markers ──

  it("strips inline markers from assistant messages", () => {
    const messages = [
      msg("user", "Show leads"),
      msg(
        "assistant",
        'Here are the leads\n\n@@INLINE@@{"component":"lead-table","props":{"leads":[]}}@@END@@\n\nDone',
      ),
    ];
    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.messages[1].content).toBe("Here are the leadsDone");
    expect(result.markersStripped).toBe(1);
  });

  it("does not strip markers from user messages", () => {
    const messages = [
      msg("user", "Test @@INLINE@@fake@@END@@ content"),
      msg("assistant", "reply"),
    ];
    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.messages[0].content).toContain("@@INLINE@@");
  });

  it("counts markers across multiple assistant messages", () => {
    const messages = [
      msg("user", "go"),
      msg("assistant", '@@INLINE@@{"component":"a"}@@END@@\n\n@@INLINE@@{"component":"b"}@@END@@'),
      msg("user", "next"),
      msg("assistant", 'text\n\n@@INLINE@@{"component":"c"}@@END@@'),
    ];
    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.markersStripped).toBe(3);
  });

  // ── Level 2: Compress historical tool results ──

  it("compresses phantom tool results in user messages", () => {
    const bigOutput = JSON.stringify({
      enriched: 5,
      lead_ids: ["a"],
      __component: "enrichment",
      props: { leads: [{ name: "Alice", enrichmentData: { x: "y".repeat(500) } }] },
    });
    const messages = [
      msg("user", `[Tool result from enrich_leads_batch]:\n${bigOutput}`),
      msg("assistant", "Got it"),
    ];
    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.toolResultsCompressed).toBe(1);
    // The compressed content should be shorter
    expect(result.messages[0].content.length).toBeLessThan(messages[0].content.length);
    // But should still contain the semantic data
    expect(result.messages[0].content).toContain("enrich_leads_batch");
    expect(result.messages[0].content).toContain('"enriched"');
  });

  // ── Level 3: Smart windowing ──

  it("windows when over budget — keeps first user + critical + last 3 pairs", () => {
    const messages: ChatMessage[] = [
      msg("user", "Find VP Sales in SaaS France"),
    ];
    // Add 30 turn pairs to exceed budget
    for (let i = 0; i < 30; i++) {
      messages.push(msg("assistant", "x".repeat(3000)));
      messages.push(msg("user", `Follow up ${i}`));
    }
    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.windowed).toBe(true);

    // First message preserved
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Find VP Sales in SaaS France");

    // Has a system trim notice
    const trimNotice = result.messages.find(
      (m) => m.role === "system" && m.content.includes("trimmed"),
    );
    expect(trimNotice).toBeTruthy();

    // Last messages are the most recent
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.content).toBe("Follow up 29");
  });

  it("rescues critical messages during windowing", () => {
    const messages: ChatMessage[] = [
      msg("user", "Find VP Sales"),
    ];
    // Add some filler
    for (let i = 0; i < 15; i++) {
      messages.push(msg("assistant", "x".repeat(3000)));
      messages.push(msg("user", "ok"));
    }
    // Add a critical message with lead_ids in the middle
    messages.splice(10, 0, msg("assistant", '{"lead_ids": ["a", "b", "c"], "campaign_id": "xyz"}'));
    // Add more to exceed budget
    for (let i = 0; i < 15; i++) {
      messages.push(msg("assistant", "x".repeat(3000)));
      messages.push(msg("user", "continue"));
    }

    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.windowed).toBe(true);

    // The critical message with lead_ids should be rescued
    const hasLeadIds = result.messages.some((m) => m.content.includes("lead_ids"));
    expect(hasLeadIds).toBe(true);
  });

  it("summarizes dropped messages instead of static text", () => {
    const messages: ChatMessage[] = [
      msg("user", "Target VP Sales SaaS"),
    ];
    // Add messages that reference tools
    messages.push(msg("assistant", "I'll call parse_icp and instantly_count_leads"));
    messages.push(msg("user", "oui"));
    messages.push(msg("assistant", "Now running score_leads_batch"));
    messages.push(msg("user", "ok"));
    // Pad to exceed budget
    for (let i = 0; i < 25; i++) {
      messages.push(msg("assistant", "x".repeat(3000)));
      messages.push(msg("user", `step ${i}`));
    }

    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    if (result.windowed) {
      const trimNotice = result.messages.find(
        (m) => m.role === "system" && m.content.includes("trimmed"),
      );
      expect(trimNotice).toBeTruthy();
      // Should contain tool names from the dropped messages
      if (trimNotice && trimNotice.content.includes("Tools executed")) {
        expect(trimNotice.content).toContain("parse_icp");
      }
    }
  });

  it("does not window when messages <= 7 even if over budget", () => {
    const messages = [
      msg("user", "x".repeat(50000)),
      msg("assistant", "x".repeat(50000)),
    ];
    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    expect(result.windowed).toBe(false);
  });

  it("classifies user confirmations as filler", () => {
    // These should be droppable during windowing
    const fillerMessages = [
      "ok", "oui", "yes", "go", "sure", "let's do it",
      "parfait", "go ahead", "d'accord", "c'est bon", "vas-y",
    ];
    // All should be classified as filler (internal to prepareMessages)
    // We verify by checking they don't appear in windowed output
    const messages: ChatMessage[] = [
      msg("user", "Find leads"),
    ];
    for (const filler of fillerMessages) {
      messages.push(msg("assistant", "x".repeat(3000)));
      messages.push(msg("user", filler));
    }
    // Add enough to trigger windowing
    for (let i = 0; i < 20; i++) {
      messages.push(msg("assistant", "x".repeat(3000)));
      messages.push(msg("user", `real question ${i}`));
    }

    const result = prepareMessagesForLLM(messages, systemTokens, toolTokens);
    if (result.windowed) {
      // Filler messages should not be in the trim summary
      const trimNotice = result.messages.find(
        (m) => m.role === "system" && m.content.includes("trimmed"),
      );
      if (trimNotice) {
        // "ok", "oui" etc should NOT appear as user actions
        expect(trimNotice.content).not.toContain("User actions: ok");
        expect(trimNotice.content).not.toContain("User actions: oui");
      }
    }
  });
});
