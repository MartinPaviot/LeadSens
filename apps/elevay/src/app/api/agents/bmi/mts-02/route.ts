import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { callLLM } from "@/agents/_shared/llm";
import {
  SYSTEM_PROMPT,
  buildConsolidatedPrompt,
  type ModuleResults,
} from "@/agents/mts-02/prompt";
import { calculateMtsScores } from "@/agents/mts-02/scoring";
import { runSynthesis } from "@/agents/mts-02/modules/synthesis";
import { fetchTrends } from "@/agents/mts-02/modules/trends";
import { fetchContent } from "@/agents/mts-02/modules/content";
import { fetchCompetitive } from "@/agents/mts-02/modules/competitive";
import { fetchSocialListening } from "@/agents/mts-02/modules/social-listening";
import type {
  MtsOutput,
  MtsSessionContext,
  RoadmapEntry,
  TrendingTopic,
  SaturatedTopic,
  FormatEntry,
  ContentPerformanceData,
} from "@/agents/mts-02/types";
import type { AgentOutput, ModuleResult } from "@/agents/_shared/types";
import type { ElevayAgentProfile } from "@/agents/_shared/types";
import { Prisma } from "@leadsens/db";
import { z } from "zod";

export const maxDuration = 300; // 5 min — modules parallèles + appel LLM

// ── Input validation ──────────────────────────────────────────────────────────

const MtsRequestSchema = z.object({
  sector:            z.string().min(2).max(200),
  priority_channels: z.array(z.enum(["SEO", "LinkedIn", "YouTube", "TikTok", "Instagram", "Facebook", "X", "Press"])).min(1),
});

// ── LLM response parsing ──────────────────────────────────────────────────────

interface LlmAnalysis {
  trending_topics: TrendingTopic[]
  saturated_topics: SaturatedTopic[]
  differentiating_angles: string[]
  roadmap_30d: RoadmapEntry[]
  format_matrix: FormatEntry[]
}

function parseLLMAnalysis(raw: string): LlmAnalysis {
  const empty: LlmAnalysis = {
    trending_topics: [],
    saturated_topics: [],
    differentiating_angles: [],
    roadmap_30d: [],
    format_matrix: [],
  };

  function parse(text: string): LlmAnalysis | null {
    try {
      const parsed = JSON.parse(text.trim()) as Partial<LlmAnalysis>;
      return {
        trending_topics:      Array.isArray(parsed.trending_topics)      ? parsed.trending_topics      : [],
        saturated_topics:     Array.isArray(parsed.saturated_topics)     ? parsed.saturated_topics     : [],
        differentiating_angles: Array.isArray(parsed.differentiating_angles) ? parsed.differentiating_angles : [],
        roadmap_30d:          Array.isArray(parsed.roadmap_30d)          ? parsed.roadmap_30d          : [],
        format_matrix:        Array.isArray(parsed.format_matrix)        ? parsed.format_matrix        : [],
      };
    } catch {
      return null;
    }
  }

  return (
    parse(raw) ??
    ((): LlmAnalysis => {
      const match = raw.match(/\{[\s\S]*\}/);
      return match ? (parse(match[0]) ?? empty) : empty;
    })()
  );
}

// ── SSE status wrapper ────────────────────────────────────────────────────────

function withStatus<T>(
  promise: Promise<ModuleResult<T>>,
  step: number,
  label: string,
  encoder: SSEEncoder,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<ModuleResult<T>> {
  controller.enqueue(
    encoder.encode("status", { step, total: 5, label: `[${step}/5] ${label} in progress…` }),
  );
  return promise
    .then((result) => {
      controller.enqueue(
        encoder.encode("status", { step, total: 5, label: `[${step}/5] ${label} ✓` }),
      );
      return result;
    })
    .catch((err: unknown) => {
      controller.enqueue(
        encoder.encode("status", { step, total: 5, label: `[${step}/5] ${label} ✗` }),
      );
      throw err;
    });
}

// ── Markdown formatter ────────────────────────────────────────────────────────

function formatMtsAsMarkdown(brandName: string, payload: MtsOutput): string {
  const topTopics = payload.trending_topics
    .slice(0, 5)
    .map(
      (t) =>
        `| ${t.topic} | **${t.opportunity_score}/100** | ${t.classification} | ${t.estimated_horizon} |`,
    )
    .join("\n");

  const angles = payload.differentiating_angles
    .map((a, i) => `${i + 1}. ${a}`)
    .join("\n");

  const roadmap = [1, 2, 3, 4]
    .map((week) => {
      const entries = payload.roadmap_30d.filter((e) => e.week === week);
      if (entries.length === 0) return null;
      const lines = entries
        .map((e) => `  - **[${e.priority}]** ${e.canal} · ${e.format} — *${e.suggested_title}*`)
        .join("\n");
      return `**Semaine ${week}**\n${lines}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    `## 📈 Analyse tendances — ${brandName}`,
    ``,
    `### 🚀 Top opportunités`,
    `| Sujet | Score | Classification | Horizon |`,
    `|-------|-------|----------------|---------|`,
    topTopics || "*Aucun topic identifié*",
    ``,
    `### 🎯 Angles différenciants`,
    angles || "*Aucun angle identifié*",
    ``,
    `### 🗓️ Roadmap 30 jours`,
    roadmap || "*Roadmap not available*",
  ].join("\n");
}

// ── Route POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    return await handleMtsRequest(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected internal error";
    const encoder = new SSEEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("error", { message }));
        controller.enqueue(encoder.encode("stream-end", {}));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }
}

async function handleMtsRequest(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 400 });
  }

  const workspaceId = user.workspaceId;

  // ── Input validation ───────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const parsed = MtsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(`Invalid input: ${parsed.error.message}`, { status: 400 });
  }

  const context: MtsSessionContext = {
    sector:            parsed.data.sector,
    priority_channels: parsed.data.priority_channels,
  };

  // ── Profil de marque ───────────────────────────────────────────────────────
  const brandProfileRecord = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId },
  });

  if (!brandProfileRecord) {
    const encoder = new SSEEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode("error", {
            message:
              "Brand profile not configured. Go to settings to set up your brand.",
          }),
        );
        controller.enqueue(encoder.encode("stream-end", {}));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  const profile: ElevayAgentProfile = {
    organisationId:    brandProfileRecord.workspaceId,
    brand_name:        brandProfileRecord.brand_name,
    brand_url:         brandProfileRecord.brand_url,
    country:           brandProfileRecord.country,
    language:          brandProfileRecord.language,
    competitors:       brandProfileRecord.competitors as { name: string; url: string }[],
    primary_keyword:   brandProfileRecord.primary_keyword,
    secondary_keyword: brandProfileRecord.secondary_keyword,
  };

  // ── SSE Stream ────────────────────────────────────────────────────────────
  const encoder = new SSEEncoder();
  const streamId = generateStreamId();
  const startTime = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.retryDirective(3000));
        controller.enqueue(
          encoder.encode("stream-start", {
            streamId,
            conversationId: `mts-${workspaceId}`,
            ts: Date.now(),
          }),
        );

        // ── Phase A — modules 1, 3, 4 en parallèle ───────────────────────
        const degraded_sources: string[] = [];

        const [trendsSettled, competitiveSettled, socialListeningSettled] =
          await Promise.allSettled([
            withStatus(fetchTrends(profile, context.sector, context.priority_channels),          1, "Tendances macro",         encoder, controller),
            withStatus(fetchCompetitive(profile, context.sector),                                  3, "Analyse concurrentielle", encoder, controller),
            withStatus(fetchSocialListening(profile, context.sector, context.priority_channels),  4, "Social listening",        encoder, controller),
          ]);

        function extract<T>(
          settled: PromiseSettledResult<ModuleResult<T>>,
          source: string,
        ): ModuleResult<T> | null {
          if (settled.status === "fulfilled") {
            if (settled.value.degraded) degraded_sources.push(source);
            return settled.value;
          }
          degraded_sources.push(source);
          return null;
        }

        const trendsResult          = extract(trendsSettled,          "trends");
        const competitiveResult     = extract(competitiveSettled,     "competitive");
        const socialListeningResult = extract(socialListeningSettled, "social-listening");

        // ── Phase B — module 2 après trends (dépend des rising_keywords) ──
        const risingKeywords = trendsResult?.data?.rising_keywords ?? [];
        const contentSettledRaw = await withStatus(
          fetchContent(profile, risingKeywords),
          2, "Contenus performants",
          encoder, controller,
        )
          .then((r) => ({ status: "fulfilled" as const, value: r }))
          .catch((err: unknown) => ({ status: "rejected" as const, reason: err }));

        const contentResult = extract(
          contentSettledRaw as PromiseSettledResult<ModuleResult<ContentPerformanceData>>,
          "content",
        );

        // ── Phase C — synthèse + LLM ──────────────────────────────────────
        controller.enqueue(
          encoder.encode("status", { step: 5, total: 5, label: "[5/5] Synthesis and scoring in progress…" }),
        );

        // ── Synthèse ──────────────────────────────────────────────────────
        const synthesis = runSynthesis({
          trends: trendsResult,
          content: contentResult,
          competitive: competitiveResult,
          socialListening: socialListeningResult,
        });

        const scores = calculateMtsScores(synthesis);

        const results: ModuleResults = {
          trends: trendsResult,
          content: contentResult,
          competitive: competitiveResult,
          socialListening: socialListeningResult,
        };

        // ── Appel LLM consolidé ───────────────────────────────────────────

        const prompt = buildConsolidatedPrompt(profile, context, results, synthesis, scores);
        const llmResponse = await callLLM({
          system: SYSTEM_PROMPT,
          prompt,
          maxTokens: 4096,
        });

        const analysis = parseLLMAnalysis(llmResponse.content);

        // ── Assembler le payload final ─────────────────────────────────────
        const payload: MtsOutput = {
          session_context: context,
          trending_topics: analysis.trending_topics.length > 0
            ? analysis.trending_topics
            : synthesis.trending_topics,
          saturated_topics: analysis.saturated_topics.length > 0
            ? analysis.saturated_topics
            : synthesis.saturated_topics,
          content_gap_map: synthesis.content_gap_map,
          format_matrix: analysis.format_matrix.length > 0
            ? analysis.format_matrix
            : synthesis.format_matrix,
          social_signals: synthesis.social_signals,
          differentiating_angles: analysis.differentiating_angles.length > 0
            ? analysis.differentiating_angles
            : synthesis.differentiating_angles,
          roadmap_30d: analysis.roadmap_30d,
          opportunity_scores: scores.opportunity_scores,
        };

        const agentOutput: AgentOutput<MtsOutput> = {
          agent_code:    "MTS-02",
          analysis_date: new Date().toISOString(),
          brand_profile: profile,
          payload,
          degraded_sources,
          version:       "1.0",
        };

        // ── Emit result + markdown ────────────────────────────────────────
        controller.enqueue(
          encoder.encode("result", { mtsOutput: payload, brandName: profile.brand_name }),
        );

        const markdown = formatMtsAsMarkdown(profile.brand_name, payload);
        controller.enqueue(encoder.encode("text-delta", { delta: markdown }));

        // ── Persistance ───────────────────────────────────────────────────
        const status = degraded_sources.length > 0 ? "PARTIAL" : "COMPLETED";
        await prisma.elevayAgentRun.create({
          data: {
            workspaceId,
            agentCode:      "MTS-02",
            status,
            output:         agentOutput as unknown as Prisma.InputJsonValue,
            degradedSources: degraded_sources,
            durationMs:     Date.now() - startTime,
            brandProfileId: brandProfileRecord.id,
          },
        });

        // ── Fin du stream ─────────────────────────────────────────────────
        controller.enqueue(
          encoder.encode("finish", {
            tokensIn:    llmResponse.inputTokens,
            tokensOut:   llmResponse.outputTokens,
            totalSteps:  5,
            finishReason: llmResponse.stopReason,
          }),
        );
        controller.enqueue(encoder.encode("stream-end", {}));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(encoder.encode("error", { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
