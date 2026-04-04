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
  CiaPreviousComparison,
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
    encoder.encode("status", { step, total: 6, label: `[${step}/6] ${label} in progress…` }),
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

// ── Markdown formatter — 9 blocs ─────────────────────────────────────────────

function formatCiaAsMarkdown(brandName: string, payload: CiaOutput): string {
  const brandEntry = payload.competitor_scores.find(s => s.is_client);
  const competitors = payload.competitor_scores.filter(s => !s.is_client).sort((a, b) => b.global_score - a.global_score);
  const leader = competitors[0];
  const today = payload.analysis_date.slice(0, 10);
  const objectiveLabels: Record<string, string> = { lead_gen: "Lead generation", acquisition: "Acquisition", retention: "Rétention", branding: "Branding" };
  const prevDelta = payload.previous && brandEntry
    ? (() => {
        const prevBrand = payload.previous.competitor_scores.find(s => s.entity === brandEntry.entity);
        return prevBrand ? ` *(${brandEntry.global_score >= prevBrand.global_score ? "+" : ""}${brandEntry.global_score - prevBrand.global_score} pts vs précédent)*` : "";
      })()
    : "";

  // ── En-tête ───────────────────────────────────────────────────────────────
  const header = [
    `## Analyse concurrentielle — ${brandName}`,
    ``,
    `**Score compétitivité : ${payload.brand_score}/100**${prevDelta}`,
    `Concurrents : ${competitors.map(c => c.entity).join(", ")} · Canal : ${payload.analysis_context.priority_channels.join(", ")} · Objectif : ${objectiveLabels[payload.analysis_context.objective] ?? payload.analysis_context.objective} · ${today}`,
  ].join("\n");

  // ── Bloc 1 — Classement compétitif global ─────────────────────────────────
  const allScored = [brandEntry, ...competitors].filter(Boolean);
  const scoreRows = allScored
    .map(s => `| ${s!.entity}${s!.is_client ? " **(vous)**" : ""} | **${s!.global_score}/100** | ${s!.level} |`)
    .join("\n");
  const leaderDelta = brandEntry && leader ? `Delta vs leader (${leader.entity}) : **${brandEntry.global_score - leader.global_score} pts**` : "";

  const bloc1 = [
    `### Classement compétitif global`,
    `| Entité | Score | Niveau |`,
    `|--------|-------|--------|`,
    scoreRows || "| *Aucune donnée* | | |",
    ``,
    leaderDelta,
  ].filter(Boolean).join("\n");

  // ── Bloc 2 — Analyse Produit & Messaging ──────────────────────────────────
  const msgLines: string[] = [`### Analyse Produit & Messaging`];
  if (payload.product_messaging.length > 0) {
    payload.product_messaging.forEach(m => {
      msgLines.push(``, `**${m.competitor_url}**`);
      msgLines.push(`- Hero : *"${m.hero_message.slice(0, 120)}"*`);
      msgLines.push(`- Value prop : *"${m.value_prop.slice(0, 150)}"*`);
      msgLines.push(`- CTA : ${m.primary_cta} · Posture tarifaire : ${m.pricing_posture} · Angle : ${m.dominant_angle}`);
      msgLines.push(`- Clarté messaging : **${m.messaging_clarity_score}/100** · Différenciation : **${m.differentiation_score}/100**`);
    });
  } else {
    msgLines.push(`*Données messaging indisponibles*`);
  }
  const bloc2 = msgLines.join("\n");

  // ── Bloc 3 — Analyse SEO & Acquisition ────────────────────────────────────
  const seoLines: string[] = [`### Analyse SEO & Acquisition`];
  const allSeo = [payload.seo_data.brand_seo, ...payload.seo_data.competitors_seo];
  if (allSeo.length > 0) {
    seoLines.push(``, `| Entité | DA | Backlinks | Trafic est. | Score SEO | Ads | Snippets |`);
    seoLines.push(`|--------|----|-----------|-------------|-----------|-----|----------|`);
    allSeo.forEach(s => {
      seoLines.push(`| ${s.entity_url} | ${s.domain_authority} | ${s.backlink_count.toLocaleString()} | ${s.estimated_traffic.toLocaleString()} | ${s.seo_score}/100 | ${s.has_google_ads ? "Oui" : "Non"} | ${s.featured_snippets} |`);
    });
    // Positions sur mots-clés
    const kwKeys = Object.keys(payload.seo_data.brand_seo.serp_positions);
    if (kwKeys.length > 0) {
      seoLines.push(``, `**Positions mots-clés stratégiques :**`);
      seoLines.push(`| Entité | ${kwKeys.join(" | ")} |`);
      seoLines.push(`|--------|${kwKeys.map(() => "---").join("|")}|`);
      allSeo.forEach(s => {
        const positions = kwKeys.map(kw => `${s.serp_positions[kw] ?? "–"}`).join(" | ");
        seoLines.push(`| ${s.entity_url} | ${positions} |`);
      });
    }
  } else {
    seoLines.push(`*Données SEO indisponibles*`);
  }
  const bloc3 = seoLines.join("\n");

  // ── Bloc 4 — Analyse Social Media ─────────────────────────────────────────
  const socialLines: string[] = [`### Analyse Social Media`];
  if (payload.social_matrix.length > 0) {
    payload.social_matrix.forEach(sp => {
      socialLines.push(``, `**${sp.competitor_url}** (score social : ${sp.social_score}/100)`);
      const activePlatforms = sp.platforms.filter(p => p.available);
      if (activePlatforms.length > 0) {
        activePlatforms.forEach(p => {
          const hooks = p.recurring_hooks.slice(0, 3).map(h => `*"${h}"*`).join(", ");
          socialLines.push(`- **${p.platform}** — ${p.publication_frequency} · engagement moy. ${p.avg_engagement} · format : ${p.dominant_formats.join(", ")} · ton : ${p.dominant_tone}`);
          if (hooks) socialLines.push(`  Hooks : ${hooks}`);
        });
      } else {
        socialLines.push(`- Aucune plateforme active`);
      }
    });
  } else {
    socialLines.push(`*Données sociales indisponibles*`);
  }
  const bloc4 = socialLines.join("\n");

  // ── Bloc 5 — Analyse Contenu ──────────────────────────────────────────────
  const contentLines: string[] = [`### Analyse Contenu`];
  if (payload.content_competitors.length > 0) {
    payload.content_competitors.forEach(cc => {
      contentLines.push(``, `**${cc.competitor_url}** (score contenu : ${cc.content_score}/100)`);
      contentLines.push(`- Fréquence blog : ${cc.blog_frequency} · Thèmes : ${cc.dominant_themes.slice(0, 5).join(", ")}`);
      if (cc.lead_magnet_types.length > 0) contentLines.push(`- Lead magnets : ${cc.lead_magnet_types.join(", ")}`);
      if (cc.youtube_video_count > 0) contentLines.push(`- YouTube : ${cc.youtube_video_count} vidéos · angle dominant : ${cc.youtube_dominant_angle ?? "—"}`);
    });
  }
  if (payload.content_gap_map.length > 0) {
    contentLines.push(``, `**Gap map éditorial :**`);
    contentLines.push(`| Sujet | Couverture concurrents | Opportunité |`);
    contentLines.push(`|-------|------------------------|-------------|`);
    payload.content_gap_map.forEach(g => {
      contentLines.push(`| ${g.angle} | ${g.competitor_coverage} | ${g.opportunity} |`);
    });
  }
  if (payload.content_competitors.length === 0 && payload.content_gap_map.length === 0) {
    contentLines.push(`*Données contenu indisponibles*`);
  }
  const bloc5 = contentLines.join("\n");

  // ── Bloc 6 — Benchmark consolidé ──────────────────────────────────────────
  const benchLines: string[] = [`### Benchmark consolidé`];
  if (allScored.length > 0) {
    benchLines.push(``, `| Entité | SEO | Produit | Social | Contenu | Positionnement | Global |`);
    benchLines.push(`|--------|-----|---------|--------|---------|----------------|--------|`);
    allScored.forEach(s => {
      benchLines.push(`| ${s!.entity}${s!.is_client ? " **(vous)**" : ""} | ${s!.seo_score} | ${s!.product_score} | ${s!.social_score} | ${s!.content_score} | ${s!.positioning_score} | **${s!.global_score}** |`);
    });
  }
  if (payload.strategic_zones.length > 0) {
    benchLines.push(``, `**Zones stratégiques :**`);
    benchLines.push(`| Axe | Zone | Directive |`);
    benchLines.push(`|-----|------|-----------|`);
    payload.strategic_zones.forEach(z => {
      const icon = z.zone === "green" ? "🟢" : z.zone === "red" ? "🔴" : z.zone === "saturated" ? "🟠" : "⬜";
      benchLines.push(`| ${z.axis} | ${icon} ${z.zone} | ${z.directive} |`);
    });
  }
  const bloc6 = benchLines.join("\n");

  // ── Bloc 7 — Recommandations stratégiques ─────────────────────────────────
  const recoLines: string[] = [`### Recommandations stratégiques`];
  if (payload.threats.length > 0) {
    recoLines.push(``, `**Menaces majeures :**`);
    payload.threats.forEach((t, i) => {
      recoLines.push(`${i + 1}. **[${t.urgency}]** ${t.description}`);
    });
  }
  if (payload.opportunities.length > 0) {
    recoLines.push(``, `**Opportunités immédiates :**`);
    payload.opportunities.forEach((o, i) => {
      recoLines.push(`${i + 1}. **${o.description}** — effort: ${o.effort} · impact: ${o.impact} · ${o.timeframe}`);
    });
  }
  if (payload.threats.length === 0 && payload.opportunities.length === 0) {
    recoLines.push(`*Aucune recommandation*`);
  }
  const bloc7 = recoLines.join("\n");

  // ── Bloc 8 — Plan d'action 60 jours ───────────────────────────────────────
  const planLines: string[] = [`### Plan d'action 60 jours`];
  if (payload.action_plan_60d.length > 0) {
    payload.action_plan_60d.forEach(p => {
      planLines.push(``, `**${p.label}**`);
      planLines.push(`*Objectif :* ${p.objective}`);
      p.actions.forEach(a => planLines.push(`  - ${a}`));
    });
  } else {
    planLines.push(`*Plan non disponible*`);
  }
  const bloc8 = planLines.join("\n");

  // ── Bloc 9 — Évolution vs précédent ───────────────────────────────────────
  let bloc9 = "";
  if (payload.previous) {
    const prevMap = new Map(payload.previous.competitor_scores.map(s => [s.entity, s.global_score]));
    const evolutions: string[] = [];
    allScored.forEach(s => {
      const prev = prevMap.get(s!.entity);
      if (prev !== undefined) {
        const delta = s!.global_score - prev;
        if (delta > 0) evolutions.push(`- **${s!.entity}** : +${delta} pts (${prev} → ${s!.global_score})`);
        else if (delta < 0) evolutions.push(`- **${s!.entity}** : ${delta} pts (${prev} → ${s!.global_score})`);
        else evolutions.push(`- **${s!.entity}** : stable (${s!.global_score})`);
      }
    });
    // New competitors not in previous
    const newEntities = allScored
      .filter(s => !prevMap.has(s!.entity))
      .map(s => `- **${s!.entity}** : nouveau (${s!.global_score}/100)`);

    bloc9 = [
      `### Évolution vs analyse précédente (${payload.previous.date.slice(0, 10)})`,
      ``,
      ...evolutions,
      ...(newEntities.length > 0 ? [``, `**Nouveaux concurrents :**`, ...newEntities] : []),
    ].join("\n");
  }

  const blocs = [header, bloc1, bloc2, bloc3, bloc4, bloc5, bloc6, bloc7, bloc8];
  if (bloc9) blocs.push(bloc9);
  return blocs.join("\n\n");
}

// ── Route POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    return await handleCiaRequest(req);
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
          encoder.encode("status", { step: 5, total: 6, label: "[5/6] Benchmark in progress…" }),
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
          encoder.encode("status", { step: 6, total: 6, label: "[6/6] Recommendations in progress…" }),
        );

        const scores = benchmarkData
          ? calculateCiaScores(benchmarkData, profile)
          : { competitor_scores: [], brand_global_score: 0 };

        // Récupérer l'historique pour comparaison
        let previousData: CiaPreviousComparison | undefined;
        try {
          const lastRun = await getLatestOutputByAgent(workspaceId, "CIA-03");
          if (lastRun) {
            const lastPayload = lastRun.payload as Partial<CiaOutput>;
            if (lastPayload.competitor_scores) {
              previousData = {
                date: (lastRun as { analysis_date?: string }).analysis_date ?? new Date().toISOString(),
                competitor_scores: lastPayload.competitor_scores.map(s => ({
                  entity: s.entity,
                  global_score: s.global_score,
                })),
              };
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
          brand_score:     scores.brand_global_score,
          analysis_date:   new Date().toISOString(),
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
          social_matrix:       socialResult?.data?.competitors ?? [],
          content_gap_map:     contentResult?.data?.editorial_gap_map ?? [],
          content_competitors: contentResult?.data?.competitors ?? [],
          threats:         analysis.threats.length > 0
            ? analysis.threats
            : recoContext?.threats ?? [],
          opportunities:   analysis.opportunities.length > 0
            ? analysis.opportunities
            : recoContext?.opportunities ?? [],
          action_plan_60d: analysis.action_plan_60d.length > 0
            ? analysis.action_plan_60d
            : recoContext?.action_plan_template ?? [],
          ...(previousData ? { previous: previousData } : {}),
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
        const message = err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(encoder.encode("error", { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
