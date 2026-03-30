import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SSEEncoder, SSE_HEADERS, generateStreamId } from "@/lib/sse";
import { callLLM } from "@/agents/_shared/llm";
import { SYSTEM_PROMPT, buildConsolidatedPrompt, type ModuleResults } from "@/agents/bpi-01/prompt";
import { fetchSerp } from "@/agents/bpi-01/modules/serp";
import { fetchPress } from "@/agents/bpi-01/modules/press";
import { fetchYoutube } from "@/agents/bpi-01/modules/youtube";
import { fetchSocial } from "@/agents/bpi-01/modules/social";
import { fetchSeo } from "@/agents/bpi-01/modules/seo";
import { fetchBenchmark } from "@/agents/bpi-01/modules/benchmark";
import { fetchGoogleMapsReputation } from "@/agents/bpi-01/modules/google-maps";
import { fetchTrustpilot } from "@/agents/bpi-01/modules/trustpilot";
import { calculateBpiScores } from "@/agents/bpi-01/scoring";
import type { ElevayAgentProfile, ModuleResult } from "@/agents/_shared/types";
import type { BpiOutput, Risk, QuickWin, RoadmapPhase } from "@/agents/bpi-01/types";
import type { AgentOutput } from "@/agents/_shared/types";
import { Prisma } from "@leadsens/db";

export const maxDuration = 300; // 5 min — modules parallèles + appel LLM

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse la réponse JSON du LLM avec fallback gracieux si malformée */
function parseLLMAnalysis(raw: string): {
  top_risks: Risk[]
  quick_wins: QuickWin[]
  roadmap_90d: RoadmapPhase[]
} {
  const empty = { top_risks: [], quick_wins: [], roadmap_90d: [] };
  try {
    const parsed = JSON.parse(raw.trim()) as typeof empty;
    return {
      top_risks:   Array.isArray(parsed.top_risks)   ? parsed.top_risks   : [],
      quick_wins:  Array.isArray(parsed.quick_wins)  ? parsed.quick_wins  : [],
      roadmap_90d: Array.isArray(parsed.roadmap_90d) ? parsed.roadmap_90d : [],
    };
  } catch {
    // Fallback : extraire le JSON du bloc markdown si l'IA a ignoré la consigne
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as typeof empty;
        return {
          top_risks:   Array.isArray(parsed.top_risks)   ? parsed.top_risks   : [],
          quick_wins:  Array.isArray(parsed.quick_wins)  ? parsed.quick_wins  : [],
          roadmap_90d: Array.isArray(parsed.roadmap_90d) ? parsed.roadmap_90d : [],
        };
      } catch { /* ignore */ }
    }
    return empty;
  }
}

/** Wrap un module pour émettre un status SSE à sa complétion */
function withStatus<T>(
  promise: Promise<ModuleResult<T>>,
  step: number,
  label: string,
  encoder: SSEEncoder,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<ModuleResult<T>> {
  controller.enqueue(
    encoder.encode("status", { step, total: 8, label: `[${step}/8] ${label} in progress…` }),
  );
  return promise
    .then((result) => {
      controller.enqueue(
        encoder.encode("status", { step, total: 8, label: `[${step}/8] ${label} ✓` }),
      );
      return result;
    })
    .catch((err: unknown) => {
      controller.enqueue(
        encoder.encode("status", { step, total: 8, label: `[${step}/8] ${label} ✗` }),
      );
      throw err;
    });
}

/** Format BpiOutput as readable markdown for the chat stream */
function formatBpiAsMarkdown(brandName: string, payload: BpiOutput): string {
  const { scores } = payload;
  const delta = scores.previous
    ? ` *(${scores.global >= scores.previous.global ? "+" : ""}${scores.global - scores.previous.global} vs audit précédent)*`
    : "";

  const rows = (
    [
      ["Réputation",                scores.reputation],
      ["Visibilité",                scores.visibility],
      ["Présence sociale",          scores.social],
      ["Dominance concurrentielle", scores.competitive],
    ] as [string, number][]
  )
    .map(([label, score]) => `| ${label} | **${score}/100** |`)
    .join("\n");

  const risks = payload.top_risks
    .map((r, i) => `${i + 1}. **[${r.urgency}]** ${r.description} *(${r.source})*`)
    .join("\n");

  const wins = payload.quick_wins
    .map(
      (w) =>
        `- **${w.action}** — impact: ${w.impact} · effort: ${w.effort} · ⏱ ${w.estimated_time}`,
    )
    .join("\n");

  const roadmap = payload.roadmap_90d
    .map(
      (p) =>
        `**${p.label}** — ${p.objective}\n${p.actions.map((a) => `  - ${a}`).join("\n")}`,
    )
    .join("\n\n");

  // ── Google Maps section ───────────────────────────────────────────────────
  const gmaps = payload.googleMapsReputation;
  let googleMapsSection = "";
  if (gmaps?.found) {
    const total = (gmaps.sentiment?.positive ?? 0) + (gmaps.sentiment?.neutral ?? 0) + (gmaps.sentiment?.negative ?? 0);
    const positiveRate = total > 0 ? Math.round(((gmaps.sentiment?.positive ?? 0) / total) * 100) : 0;
    const negativeRate = total > 0 ? Math.round(((gmaps.sentiment?.negative ?? 0) / total) * 100) : 0;

    const posReviews = (gmaps.top_positive_reviews ?? [])
      .map((t) => `  - *"${t.slice(0, 100)}..."*`)
      .join("\n");
    const negReviews = (gmaps.top_negative_reviews ?? [])
      .map((t) => `  - *"${t.slice(0, 100)}..."*`)
      .join("\n");

    googleMapsSection = [
      ``,
      `### 🗺️ Google Maps Reputation`,
      `- ⭐ Note : ${gmaps.rating}/5 (${gmaps.review_count} avis)`,
      `- Score réputation : ${gmaps.reputation_score}/100`,
      `- Sentiment : ${positiveRate}% positif, ${negativeRate}% négatif`,
      posReviews ? `\n**Points forts clients :**\n${posReviews}` : "",
      negReviews ? `\n**Points d'attention :**\n${negReviews}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // ── Trustpilot section ────────────────────────────────────────────────────
  const tp = payload.trustpilot;
  let trustpilotSection = "";
  if (tp?.found && tp.rating !== undefined) {
    trustpilotSection = [
      ``,
      `### ⭐ Trustpilot`,
      `- Rating: ${tp.rating}/5${tp.review_count ? ` (${tp.review_count} reviews)` : ""}`,
      `- Sentiment: ${tp.sentiment_label ?? "–"}`,
      tp.profile_url ? `- [View on Trustpilot](${tp.profile_url})` : "",
    ].filter(Boolean).join("\n");
  }

  return [
    `## 📊 Audit de présence en ligne — ${brandName}`,
    ``,
    `**Score global : ${scores.global}/100**${delta}`,
    ``,
    `| Axe | Score |`,
    `|-----|-------|`,
    rows,
    googleMapsSection,
    trustpilotSection,
    ``,
    `### ⚠️ Risques prioritaires`,
    risks || "*Aucun risque identifié*",
    ``,
    `### ✅ Quick wins`,
    wins || "*Aucun quick win identifié*",
    ``,
    `### 🗺️ Roadmap 90 jours`,
    roadmap || "*Roadmap not available*",
  ].join("\n");
}

// ── Route POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    return await handleBpiRequest(req);
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

async function handleBpiRequest(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Optional body (priority_channels) ─────────────────────────────────────
  let priority_channels: string[] | undefined;
  try {
    const body = await req.json() as unknown;
    if (
      body &&
      typeof body === "object" &&
      "priority_channels" in body &&
      Array.isArray((body as { priority_channels: unknown }).priority_channels)
    ) {
      priority_channels = (body as { priority_channels: string[] }).priority_channels;
    }
  } catch {
    // Body absent ou invalide → toutes les plateformes actives
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 400 });
  }

  const workspaceId = user.workspaceId;

  // ── Profil de marque ───────────────────────────────────────────────────────
  const brandProfileRecord = await prisma.elevayBrandProfile.findUnique({
    where: { workspaceId },
  });

  if (!brandProfileRecord) {
    const encoder = new SSEEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode("error", { message: "Profil de marque non configuré. Rendez-vous dans les paramètres pour renseigner votre marque." }),
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

  // ── Run précédent pour comparaison historique ──────────────────────────────
  const previousRunRecord = await prisma.elevayAgentRun.findFirst({
    where: { workspaceId, agentCode: "BPI-01", status: { in: ["COMPLETED", "PARTIAL"] } },
    orderBy: { createdAt: "desc" },
  });

  const previousScores = previousRunRecord
    ? (() => {
        const output = previousRunRecord.output as { scores?: BpiOutput["scores"]; analysis_date?: string } | null;
        if (!output?.scores) return undefined;
        return {
          ...output.scores,
          date: previousRunRecord.createdAt.toISOString(),
        };
      })()
    : undefined;

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
            conversationId: `bpi-${workspaceId}`,
            ts: Date.now(),
          }),
        );

        // ── Modules en parallèle avec status par module ────────────────────
        const [
          serpSettled,
          pressSettled,
          youtubeSettled,
          socialSettled,
          seoSettled,
          benchmarkSettled,
          googleMapsSettled,
          trustpilotSettled,
        ] = await Promise.allSettled([
          withStatus(fetchSerp(profile),                                               1, "SERP",         encoder, controller),
          withStatus(fetchPress(profile, priority_channels),                           2, "Presse",        encoder, controller),
          withStatus(fetchYoutube(profile),                                            3, "YouTube",       encoder, controller),
          withStatus(fetchSocial(profile, priority_channels),                         4, "Social",        encoder, controller),
          withStatus(fetchSeo(profile, priority_channels),                            5, "SEO",           encoder, controller),
          withStatus(fetchBenchmark(profile, profile.competitors.map((c) => c.name)), 6, "Benchmark",     encoder, controller),
          withStatus(fetchGoogleMapsReputation(profile),                              7, "Google Maps",   encoder, controller),
          withStatus(fetchTrustpilot(profile),                                        8, "Trustpilot",    encoder, controller),
        ]);

        // ── Extraction des résultats ───────────────────────────────────────
        const degraded_sources: string[] = [];

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

        const results: ModuleResults = {
          serp:       extract(serpSettled,       "serp"),
          press:      extract(pressSettled,      "press"),
          youtube:    extract(youtubeSettled,    "youtube"),
          social:     extract(socialSettled,     "social"),
          seo:        extract(seoSettled,        "seo"),
          benchmark:  extract(benchmarkSettled,  "benchmark"),
          googleMaps: extract(googleMapsSettled, "gmaps"),
          trustpilot: extract(trustpilotSettled, "trustpilot"),
        };

        // ── Calcul des scores ─────────────────────────────────────────────
        const scores = calculateBpiScores(results);

        // ── Appel LLM consolidé ───────────────────────────────────────────
        controller.enqueue(
          encoder.encode("status", { label: "LLM analysis in progress…" }),
        );

        const prompt = buildConsolidatedPrompt(profile, results, scores, previousScores);
        const llmResponse = await callLLM({
          system: SYSTEM_PROMPT,
          prompt,
          maxTokens: 4096,
        });

        const analysis = parseLLMAnalysis(llmResponse.content);

        // ── Emit text-delta (markdown pour le chat) ───────────────────────
        // Construit d'abord les scores partiels pour le formatage
        const partialScores = {
          ...scores,
          ...(previousScores
            ? {
                previous: {
                  global:      previousScores.global,
                  reputation:  previousScores.reputation,
                  visibility:  previousScores.visibility,
                  social:      previousScores.social,
                  competitive: previousScores.competitive,
                  date:        previousScores.date,
                },
              }
            : {}),
        };
        const previewPayload: BpiOutput = {
          scores:               partialScores,
          serp_data:            results.serp?.data        ?? null,
          press_data:           results.press?.data       ?? null,
          youtube_data:         results.youtube?.data     ?? null,
          social_data:          results.social?.data      ?? null,
          seo_data:             results.seo?.data         ?? null,
          benchmark_data:       results.benchmark?.data   ?? null,
          googleMapsReputation: results.googleMaps?.data  ?? undefined,
          trustpilot:           results.trustpilot?.data  ?? undefined,
          top_risks:            analysis.top_risks,
          quick_wins:           analysis.quick_wins,
          roadmap_90d:          analysis.roadmap_90d,
        };
        // ── Emit structured result (for client-side summary + export) ────
        controller.enqueue(encoder.encode("result", { bpiOutput: previewPayload, brandName: profile.brand_name }));

        const markdown = formatBpiAsMarkdown(profile.brand_name, previewPayload);
        controller.enqueue(encoder.encode("text-delta", { delta: markdown }));

        // ── Construction du payload final ─────────────────────────────────
        const payload: BpiOutput = {
          scores: {
            ...scores,
            ...(previousScores
              ? {
                  previous: {
                    global:      previousScores.global,
                    reputation:  previousScores.reputation,
                    visibility:  previousScores.visibility,
                    social:      previousScores.social,
                    competitive: previousScores.competitive,
                    date:        previousScores.date,
                  },
                }
              : {}),
          },
          serp_data:            results.serp?.data        ?? null,
          press_data:           results.press?.data       ?? null,
          youtube_data:         results.youtube?.data     ?? null,
          social_data:          results.social?.data      ?? null,
          seo_data:             results.seo?.data         ?? null,
          benchmark_data:       results.benchmark?.data   ?? null,
          googleMapsReputation: results.googleMaps?.data  ?? undefined,
          trustpilot:           results.trustpilot?.data  ?? undefined,
          top_risks:            analysis.top_risks,
          quick_wins:           analysis.quick_wins,
          roadmap_90d:          analysis.roadmap_90d,
        };

        const agentOutput: AgentOutput<BpiOutput> = {
          agent_code:    "BPI-01",
          analysis_date: new Date().toISOString(),
          brand_profile: profile,
          payload,
          degraded_sources,
          version:       "1.0",
        };

        // ── Persistance ───────────────────────────────────────────────────
        const status = degraded_sources.length > 0 ? "PARTIAL" : "COMPLETED";
        await prisma.elevayAgentRun.create({
          data: {
            workspaceId,
            agentCode:      "BPI-01",
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
            totalSteps:  8,
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
