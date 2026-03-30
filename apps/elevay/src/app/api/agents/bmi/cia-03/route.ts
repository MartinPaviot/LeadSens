import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { callLLM } from "@/agents/_shared/llm";
import { SYSTEM_PROMPT, buildConsolidatedPrompt, type CiaModuleResults } from "@/agents/cia-03/prompt";
import { fetchProductMessaging } from "@/agents/cia-03/modules/product-messaging";
import { fetchSeoAcquisition } from "@/agents/cia-03/modules/seo-acquisition";
import { fetchSocialMedia } from "@/agents/cia-03/modules/social-media";
import { fetchContentAnalysis } from "@/agents/cia-03/modules/content";
import { fetchBenchmark } from "@/agents/cia-03/modules/benchmark";
import { buildRecommendations } from "@/agents/cia-03/modules/recommendations";
import { calculateCiaScores } from "@/agents/cia-03/scoring";
import { getLatestOutputByAgent } from "@/lib/agent-history";
import type {
  CiaOutput,
  CiaSessionContext,
  CompetitorScore,
  StrategicZone,
  Threat,
  Opportunity,
  ActionPhase,
  ProductMessagingData,
  SeoAcquisitionData,
  SocialMediaData,
  ContentAnalysisData,
} from "@/agents/cia-03/types";
import type { AgentOutput, ModuleResult } from "@/agents/_shared/types";
import type { ElevayAgentProfile } from "@/agents/_shared/types";
import { Prisma } from "@leadsens/db";
import { z } from "zod";

export const maxDuration = 300; // 5 min — 4 modules parallèles + LLM

// ── Input validation ──────────────────────────────────────────────────────────

const CiaRequestSchema = z.object({
  priority_channels: z.array(z.enum(["SEO", "paid", "social", "product", "global", "LinkedIn", "YouTube", "TikTok", "Instagram", "Facebook", "X", "Press"])).min(1),
  objective:         z.enum(["lead_gen", "acquisition", "retention", "branding"]),
});

// ── LLM response parsing ──────────────────────────────────────────────────────

interface LlmAnalysis {
  competitor_scores: CompetitorScore[]
  strategic_zones:   StrategicZone[]
  threats:           Threat[]
  opportunities:     Opportunity[]
  action_plan_60d:   ActionPhase[]
}

function parseLLMAnalysis(raw: string): LlmAnalysis {
  const empty: LlmAnalysis = {
    competitor_scores: [],
    strategic_zones:   [],
    threats:           [],
    opportunities:     [],
    action_plan_60d:   [],
  };

  function parse(text: string): LlmAnalysis | null {
    try {
      const parsed = JSON.parse(text.trim()) as Partial<LlmAnalysis>;
      return {
        competitor_scores: Array.isArray(parsed.competitor_scores) ? parsed.competitor_scores : [],
        strategic_zones:   Array.isArray(parsed.strategic_zones)   ? parsed.strategic_zones   : [],
        threats:           Array.isArray(parsed.threats)           ? parsed.threats           : [],
        opportunities:     Array.isArray(parsed.opportunities)     ? parsed.opportunities     : [],
        action_plan_60d:   Array.isArray(parsed.action_plan_60d)   ? parsed.action_plan_60d   : [],
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
    encoder.encode("status", { step, total: 6, label: `[${step}/6] ${label} en cours…` }),
  );
  return promise
    .then(result => {
      controller.enqueue(
        encoder.encode("status", { step, total: 6, label: `[${step}/6] ${label} ✓` }),
      );
      return result;
    })
    .catch((err: unknown) => {
      controller.enqueue(
        encoder.encode("status", { step, total: 6, label: `[${step}/6] ${label} ✗` }),
      );
      throw err;
    });
}

// ── Markdown formatter ────────────────────────────────────────────────────────

function formatCiaAsMarkdown(brandName: string, payload: CiaOutput): string {
  const brandEntry = payload.competitor_scores.find(s => s.is_client);
  const competitors = payload.competitor_scores.filter(s => !s.is_client);

  const scoresTable = [brandEntry, ...competitors]
    .filter(Boolean)
    .map(s => `| ${s!.entity} | ${s!.global_score} | ${s!.level} | ${s!.seo_score} | ${s!.product_score} | ${s!.social_score} | ${s!.content_score} |`)
    .join("\n");

  const zonesTable = payload.strategic_zones
    .map(z => `| ${z.axis} | ${z.zone === "green" ? "🟢" : z.zone === "red" ? "🔴" : z.zone === "saturated" ? "🟠" : "⬜"} ${z.zone} | ${z.directive} |`)
    .join("\n");

  const threats = payload.threats
    .map(t => `- **[${t.urgency}]** ${t.description}`)
    .join("\n");

  const opportunities = payload.opportunities
    .map(o => `- **[${o.impact}/${o.effort}]** ${o.description} *(${o.timeframe})*`)
    .join("\n");

  const plan = payload.action_plan_60d
    .map(p => {
      const actions = p.actions.map(a => `  - ${a}`).join("\n");
      return `**${p.label}**\n*Objectif :* ${p.objective}\n${actions}`;
    })
    .join("\n\n");

  return [
    `## 🔍 Analyse concurrentielle — ${brandName}`,
    ``,
    `### 📊 Scores compétitifs`,
    `| Entité | Global | Niveau | SEO | Produit | Social | Contenu |`,
    `|--------|--------|--------|-----|---------|--------|---------|`,
    scoresTable || "*Aucune donnée*",
    ``,
    `### 🗺️ Zones stratégiques`,
    `| Axe | Zone | Directive |`,
    `|-----|------|-----------|`,
    zonesTable || "*Aucune zone identifiée*",
    ``,
    `### ⚠️ Menaces prioritaires`,
    threats || "*Aucune menace identifiée*",
    ``,
    `### 🎯 Opportunités`,
    opportunities || "*Aucune opportunité identifiée*",
    ``,
    `### 🗓️ Plan d'action 60 jours`,
    plan || "*Plan non disponible*",
  ].join("\n");
}

// ── Route POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    return await handleCiaRequest(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne inattendue";
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

async function handleCiaRequest(req: Request) {
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

  const parsed = CiaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(`Invalid input: ${parsed.error.message}`, { status: 400 });
  }

  const context: CiaSessionContext = {
    priority_channels: parsed.data.priority_channels,
    objective:         parsed.data.objective,
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
              "Profil de marque non configuré. Rendez-vous dans les paramètres pour renseigner votre marque.",
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
            conversationId: `cia-${workspaceId}`,
            ts: Date.now(),
          }),
        );

        const degraded_sources: string[] = [];

        // ── Phase A — M1-M4 en parallèle ──────────────────────────────────
        const [messagingSettled, seoSettled, socialSettled, contentSettled] =
          await Promise.allSettled([
            withStatus(fetchProductMessaging(profile),                              1, "Product & Messaging", encoder, controller),
            withStatus(fetchSeoAcquisition(profile, context.priority_channels),   2, "SEO & Acquisition",  encoder, controller),
            withStatus(fetchSocialMedia(profile, context.priority_channels),      3, "Social Media",        encoder, controller),
            withStatus(fetchContentAnalysis(profile, context.priority_channels),  4, "Contenu",             encoder, controller),
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

        const messagingResult = extract(messagingSettled, "product-messaging");
        const seoResult       = extract(seoSettled,       "seo-acquisition");
        const socialResult    = extract(socialSettled,    "social-media");
        const contentResult   = extract(contentSettled,   "content");

        // ── Phase B — M5 Benchmark (calcul pur) ───────────────────────────
        controller.enqueue(
          encoder.encode("status", { step: 5, total: 6, label: "[5/6] Benchmark en cours…" }),
        );

        const benchmarkResult = await fetchBenchmark(profile, {
          messaging: messagingResult,
          seo:       seoResult,
          social:    socialResult,
          content:   contentResult,
        }, workspaceId);
        if (!benchmarkResult.success) degraded_sources.push("benchmark");

        controller.enqueue(
          encoder.encode("status", { step: 5, total: 6, label: `[5/6] Benchmark ${benchmarkResult.success ? "✓" : "✗"}` }),
        );

        // ── M6 Recommandations (calcul pur) ───────────────────────────────
        const benchmarkData = benchmarkResult.data;
        const recoContext = benchmarkData
          ? buildRecommendations(
              benchmarkData.strategic_zones,
              benchmarkData.competitor_scores,
              context,
              context.priority_channels,
              contentResult?.data?.competitors[0]?.dominant_themes[0] ?? "contenu éducatif",
              messagingResult?.data?.competitors[0]?.dominant_angle ?? "ROI",
            )
          : null;

        // ── Phase C — LLM consolidé ────────────────────────────────────────
        controller.enqueue(
          encoder.encode("status", { step: 6, total: 6, label: "[6/6] Recommandations en cours…" }),
        );

        const scores = benchmarkData
          ? calculateCiaScores(benchmarkData, profile)
          : { competitor_scores: [], brand_global_score: 0 };

        // Récupérer l'historique pour previous_scores
        let previous_scores: Record<string, number> | undefined;
        try {
          const lastRun = await getLatestOutputByAgent(workspaceId, "CIA-03");
          if (lastRun) {
            const lastPayload = lastRun.payload as Partial<CiaOutput>;
            if (lastPayload.competitor_scores) {
              previous_scores = Object.fromEntries(
                lastPayload.competitor_scores.map(s => [s.entity, s.global_score]),
              );
            }
          }
        } catch {
          // non-bloquant
        }

        const moduleResultsForPrompt: CiaModuleResults = {
          messaging:   messagingResult,
          seo:         seoResult,
          social:      socialResult,
          content:     contentResult,
          benchmark:   benchmarkData,
          recoContext,
        };

        const prompt = buildConsolidatedPrompt(profile, context, moduleResultsForPrompt);
        const llmResponse = await callLLM({
          system:    SYSTEM_PROMPT,
          prompt,
          maxTokens: 4096,
        });

        const analysis = parseLLMAnalysis(llmResponse.content);

        // ── Assembler le payload final ────────────────────────────────────
        const payload: CiaOutput = {
          analysis_context:  context,
          competitor_scores: analysis.competitor_scores.length > 0
            ? analysis.competitor_scores
            : scores.competitor_scores,
          strategic_zones:   analysis.strategic_zones.length > 0
            ? analysis.strategic_zones
            : benchmarkData?.strategic_zones ?? [],
          product_messaging: messagingResult?.data?.competitors ?? [],
          seo_data:          seoResult?.data ?? {
            brand_seo: {
              entity_url:         profile.brand_url,
              domain_authority:   0,
              estimated_keywords: 0,
              estimated_traffic:  0,
              backlink_count:     0,
              serp_positions:     {},
              has_google_ads:     false,
              featured_snippets:  0,
              seo_score:          0,
            },
            competitors_seo: [],
          },
          social_matrix:   socialResult?.data?.competitors ?? [],
          content_gap_map: contentResult?.data?.editorial_gap_map ?? [],
          threats:         analysis.threats.length > 0
            ? analysis.threats
            : recoContext?.threats ?? [],
          opportunities:   analysis.opportunities.length > 0
            ? analysis.opportunities
            : recoContext?.opportunities ?? [],
          action_plan_60d: analysis.action_plan_60d.length > 0
            ? analysis.action_plan_60d
            : recoContext?.action_plan_template ?? [],
          previous_scores,
        };

        const agentOutput: AgentOutput<CiaOutput> = {
          agent_code:    "CIA-03",
          analysis_date: new Date().toISOString(),
          brand_profile: profile,
          payload,
          degraded_sources,
          version:       "1.0",
        };

        // ── Emit result + markdown ────────────────────────────────────────
        controller.enqueue(
          encoder.encode("result", { bpiOutput: payload, brandName: profile.brand_name }),
        );

        const markdown = formatCiaAsMarkdown(profile.brand_name, payload);
        controller.enqueue(encoder.encode("text-delta", { delta: markdown }));

        // ── Persistance ───────────────────────────────────────────────────
        const status = degraded_sources.length > 0 ? "PARTIAL" : "COMPLETED";
        await prisma.elevayAgentRun.create({
          data: {
            workspaceId,
            agentCode:       "CIA-03",
            status,
            output:          agentOutput as unknown as Prisma.InputJsonValue,
            degradedSources: degraded_sources,
            durationMs:      Date.now() - startTime,
            brandProfileId:  brandProfileRecord.id,
          },
        });

        controller.enqueue(
          encoder.encode("status", { step: 6, total: 6, label: "[6/6] Recommandations ✓" }),
        );

        // ── Fin du stream ─────────────────────────────────────────────────
        controller.enqueue(
          encoder.encode("finish", {
            tokensIn:    llmResponse.inputTokens,
            tokensOut:   llmResponse.outputTokens,
            totalSteps:  6,
            finishReason: llmResponse.stopReason,
          }),
        );
        controller.enqueue(encoder.encode("stream-end", {}));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inattendue";
        controller.enqueue(encoder.encode("error", { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
