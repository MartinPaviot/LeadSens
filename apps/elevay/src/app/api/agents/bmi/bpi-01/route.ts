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
import type { BpiOutput, AxisDiagnostic, Priority90d } from "@/agents/bpi-01/types";
import type { AgentOutput } from "@/agents/_shared/types";
import { Prisma } from "@leadsens/db";

export const maxDuration = 300; // 5 min — modules parallèles + appel LLM

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse la réponse JSON du LLM avec fallback gracieux si malformée */
function parseLLMAnalysis(raw: string): {
  axis_diagnostics: AxisDiagnostic[]
  priorities_90d: Priority90d[]
} {
  const empty: { axis_diagnostics: AxisDiagnostic[]; priorities_90d: Priority90d[] } = {
    axis_diagnostics: [],
    priorities_90d: [],
  };

  function tryParse(json: string): typeof empty | null {
    try {
      const parsed = JSON.parse(json) as typeof empty;
      return {
        axis_diagnostics: Array.isArray(parsed.axis_diagnostics) ? parsed.axis_diagnostics : [],
        priorities_90d:   Array.isArray(parsed.priorities_90d)   ? parsed.priorities_90d   : [],
      };
    } catch {
      return null;
    }
  }

  return tryParse(raw.trim())
    ?? tryParse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "")
    ?? empty;
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

/** Format BpiOutput as readable markdown — 8 blocs thématiques */
function formatBpiAsMarkdown(brandName: string, payload: BpiOutput): string {
  const { scores } = payload;
  const today = new Date().toISOString().slice(0, 10);

  // Helper: find diagnostic by axis
  function diag(axis: string): string {
    return payload.axis_diagnostics.find((d) => d.axis === axis)?.diagnostic ?? "—";
  }

  // ── Bloc 1 — En-tête ─────────────────────────────────────────────────────
  const delta = scores.previous
    ? ` *(${scores.global >= scores.previous.global ? "+" : ""}${scores.global - scores.previous.global} pts vs audit précédent du ${scores.previous.date.slice(0, 10)})*`
    : "";

  const bloc1 = [
    `## Audit de présence en ligne — ${brandName}`,
    ``,
    `**Score global : ${scores.global}/100**${delta}`,
    `Date d'analyse : ${today}`,
  ].join("\n");

  // ── Bloc 2 — Scores par axe ──────────────────────────────────────────────
  const axeRows = [
    ["SERP",                 scores.serp,      "serp"],
    ["Presse",               scores.press,     "press"],
    ["YouTube",              scores.youtube,   "youtube"],
    ["Réseaux sociaux",      scores.social,    "social"],
    ["SEO organique",        scores.seo,       "seo"],
    ["Benchmark concurrentiel", scores.benchmark, "benchmark"],
  ] as [string, number, string][];

  const bloc2 = [
    `### Scores par axe`,
    ``,
    `| Axe | Score | Diagnostic |`,
    `|-----|-------|------------|`,
    ...axeRows.map(([label, score, axis]) =>
      `| ${label} | **${score}/100** | ${diag(axis)} |`,
    ),
  ].join("\n");

  // ── Bloc 3 — Résumé SERP ─────────────────────────────────────────────────
  const serpLines: string[] = [`### Résumé SERP`];
  const serp = payload.serp_data;
  if (serp) {
    const posLabel = serp.official_site_position !== null
      ? `Position ${serp.official_site_position}`
      : "Non trouvé en page 1";
    serpLines.push(`- Site officiel : **${posLabel}**`);
    if (serp.negative_snippets.length > 0) {
      serpLines.push(`- Contenus négatifs détectés : ${serp.negative_snippets.length} snippet(s)`);
    } else {
      serpLines.push(`- Aucun contenu négatif détecté en page 1`);
    }
    const compEntries = Object.entries(serp.competitor_positions);
    if (compEntries.length > 0) {
      serpLines.push(`- Concurrents sur votre requête : ${compEntries.map(([name, pos]) => `${name} (pos. ${pos ?? "–"})`).join(", ")}`);
    }
    serpLines.push(``, `**Votre marque est-elle bien représentée sur sa propre requête ?** ${serp.official_site_position !== null && serp.official_site_position <= 3 && serp.negative_snippets.length === 0 ? "Oui — bonne maîtrise de la page 1." : "Marge d'amélioration identifiée."}`);
  } else {
    serpLines.push(`*Données SERP indisponibles*`);
  }

  // Google Maps sub-section
  const gmaps = payload.googleMapsReputation;
  if (gmaps?.found) {
    const total = (gmaps.sentiment?.positive ?? 0) + (gmaps.sentiment?.neutral ?? 0) + (gmaps.sentiment?.negative ?? 0);
    const positiveRate = total > 0 ? Math.round(((gmaps.sentiment?.positive ?? 0) / total) * 100) : 0;
    serpLines.push(``, `**Avis Google** : ${gmaps.rating}/5 (${gmaps.review_count} avis) — ${positiveRate}% positifs`);
    if (gmaps.top_positive_reviews?.length) {
      serpLines.push(...gmaps.top_positive_reviews.map((t) => `  - *"${t.slice(0, 100)}..."*`));
    }
  }

  // Trustpilot sub-section
  const tp = payload.trustpilot;
  if (tp?.found && tp.rating !== undefined) {
    serpLines.push(``, `**Trustpilot** : ${tp.rating}/5 — ${tp.sentiment_label ?? "–"}${tp.profile_url ? ` ([voir](${tp.profile_url}))` : ""}`);
  }

  const bloc3 = serpLines.join("\n");

  // ── Bloc 4 — Presse & mentions ────────────────────────────────────────────
  const pressLines: string[] = [`### Presse & mentions`];
  const press = payload.press_data;
  if (press) {
    pressLines.push(`- Articles récents : **${press.article_count}**`);
    pressLines.push(`- Sentiment global : **${press.sentiment}**`);
    pressLines.push(`- Angle éditorial dominant : ${press.editorial_angle}`);
    if (press.top_domains.length > 0) {
      pressLines.push(`- Domaines couvrant la marque : ${press.top_domains.join(", ")}`);
    }
    if (press.pr_opportunities.length > 0) {
      pressLines.push(``, `**Opportunités RP :**`);
      pressLines.push(...press.pr_opportunities.map((o) => `- ${o}`));
    }
  } else {
    pressLines.push(`*Données presse indisponibles*`);
  }
  const bloc4 = pressLines.join("\n");

  // ── Bloc 5 — YouTube ──────────────────────────────────────────────────────
  const ytLines: string[] = [`### YouTube`];
  const yt = payload.youtube_data;
  if (yt) {
    ytLines.push(`- Vidéos trouvées : **${yt.video_count}**`);
    ytLines.push(`- Sentiment des commentaires : **${yt.sentiment}**`);
    if (yt.top_videos.length > 0) {
      ytLines.push(``, `**Vidéos principales :**`);
      yt.top_videos.slice(0, 5).forEach((v) => {
        ytLines.push(`- [${v.title}](${v.url}) — ${v.channel}${v.sentiment ? ` (${v.sentiment})` : ""}`);
      });
    }
    if (yt.influencer_opportunities.length > 0) {
      ytLines.push(``, `**Opportunités de collaboration :**`);
      ytLines.push(...yt.influencer_opportunities.map((o) => `- ${o}`));
    }
  } else {
    ytLines.push(`*Données YouTube indisponibles*`);
  }
  const bloc5 = ytLines.join("\n");

  // ── Bloc 6 — Réseaux sociaux ──────────────────────────────────────────────
  const socialLines: string[] = [`### Réseaux sociaux`];
  const social = payload.social_data;
  if (social) {
    if (social.platforms.length > 0) {
      socialLines.push(``, `| Plateforme | Followers | Engagement | Fréquence | Sentiment | Status |`);
      socialLines.push(`|------------|-----------|------------|-----------|-----------|--------|`);
      social.platforms.forEach((p) => {
        socialLines.push(`| ${p.platform} | ${p.followers.toLocaleString()} | ${p.engagement_rate}% | ${p.post_frequency} | ${p.sentiment} | ${p.status} |`);
      });
    }
    socialLines.push(``, `- Cohérence de marque : **${social.brand_coherence_score}/100**`);
    if (social.dominant_topics.length > 0) {
      socialLines.push(`- Sujets dominants : ${social.dominant_topics.join(", ")}`);
    }
  } else {
    socialLines.push(`*Données réseaux sociaux indisponibles*`);
  }
  const bloc6 = socialLines.join("\n");

  // ── Bloc 7 — SEO organique ────────────────────────────────────────────────
  const seoLines: string[] = [`### SEO organique`];
  const seoData = payload.seo_data;
  if (seoData) {
    const kwEntries = Object.entries(seoData.keyword_positions);
    if (kwEntries.length > 0) {
      seoLines.push(`- Positions : ${kwEntries.map(([kw, pos]) => `**${kw}** → pos. ${pos ?? "–"}`).join(" · ")}`);
    }
    seoLines.push(`- Domain Authority : **${seoData.domain_authority}**`);
    seoLines.push(`- Backlinks : **${seoData.backlink_count.toLocaleString()}**`);
    if (seoData.competitor_comparison.length > 0) {
      seoLines.push(``, `**Comparaison concurrents :**`);
      seoLines.push(`| Concurrent | DA | Score SEO |`);
      seoLines.push(`|------------|-----|-----------|`);
      seoData.competitor_comparison.forEach((c) => {
        seoLines.push(`| ${c.competitor} | ${c.domain_authority} | ${c.seo_score}/100 |`);
      });
    }
    if (seoData.keyword_gaps.length > 0) {
      seoLines.push(``, `**Mots-clés exploitables :** ${seoData.keyword_gaps.join(", ")}`);
    }
  } else {
    seoLines.push(`*Données SEO indisponibles*`);
  }
  const bloc7 = seoLines.join("\n");

  // ── Bloc 8 — Benchmark concurrentiel ──────────────────────────────────────
  const benchLines: string[] = [`### Benchmark concurrentiel`];
  const bench = payload.benchmark_data;
  if (bench) {
    benchLines.push(`- Score de dominance : **${bench.competitive_score}/100**`);
    if (bench.radar.length > 0) {
      benchLines.push(``, `| Concurrent | SERP | Presse | SEO | YouTube | Social |`);
      benchLines.push(`|------------|------|--------|-----|---------|--------|`);
      bench.radar.forEach((r) => {
        benchLines.push(`| ${r.name} | ${r.serp_share} | ${r.press_volume} | ${r.seo_score} | ${r.youtube_reach} | ${r.social_score} |`);
      });
    }
  } else {
    benchLines.push(`*Données benchmark indisponibles*`);
  }
  const bloc8 = benchLines.join("\n");

  // ── Bloc 9 — Priorités 90 jours ──────────────────────────────────────────
  const prioLines: string[] = [`### Priorités 90 jours`];
  if (payload.priorities_90d.length > 0) {
    payload.priorities_90d.forEach((p, i) => {
      prioLines.push(`${i + 1}. **[${p.tag}]** ${p.action}`);
      prioLines.push(`   *${p.source_problem}*`);
    });
  } else {
    prioLines.push(`*Aucune priorité identifiée*`);
  }
  const bloc9 = prioLines.join("\n");

  return [bloc1, bloc2, bloc3, bloc4, bloc5, bloc6, bloc7, bloc8, bloc9].join("\n\n");
}

// ── Route POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    return await handleBpiRequest(req);
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
          encoder.encode("error", { message: "Brand profile not configured. Go to settings to set up your brand." }),
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

  // Adaptateur rétrocompatible : ancien format (4 axes) → nouveau (6 axes)
  const previousScores = previousRunRecord
    ? (() => {
        const output = previousRunRecord.output as {
          scores?: Record<string, number>;
          payload?: { scores?: Record<string, number> };
          analysis_date?: string;
        } | null;
        const raw = output?.payload?.scores ?? output?.scores;
        if (!raw || typeof raw.global !== "number") return undefined;
        const date = previousRunRecord.createdAt.toISOString();
        // New format has 'serp' key, old format has 'reputation'
        if ("serp" in raw) {
          return {
            global:    raw.global,
            serp:      raw.serp ?? 0,
            press:     raw.press ?? 0,
            youtube:   raw.youtube ?? 0,
            social:    raw.social ?? 0,
            seo:       raw.seo ?? 0,
            benchmark: raw.benchmark ?? 0,
            date,
          };
        }
        // Old format: map composite axes to closest new axes
        return {
          global:    raw.global,
          serp:      raw.reputation ?? 0,
          press:     0,
          youtube:   0,
          social:    raw.social ?? 0,
          seo:       raw.visibility ?? 0,
          benchmark: raw.competitive ?? 0,
          date,
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
        const partialScores = {
          ...scores,
          ...(previousScores
            ? {
                previous: {
                  global:    previousScores.global,
                  serp:      previousScores.serp,
                  press:     previousScores.press,
                  youtube:   previousScores.youtube,
                  social:    previousScores.social,
                  seo:       previousScores.seo,
                  benchmark: previousScores.benchmark,
                  date:      previousScores.date,
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
          axis_diagnostics:     analysis.axis_diagnostics,
          priorities_90d:       analysis.priorities_90d,
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
                    global:    previousScores.global,
                    serp:      previousScores.serp,
                    press:     previousScores.press,
                    youtube:   previousScores.youtube,
                    social:    previousScores.social,
                    seo:       previousScores.seo,
                    benchmark: previousScores.benchmark,
                    date:      previousScores.date,
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
          axis_diagnostics:     analysis.axis_diagnostics,
          priorities_90d:       analysis.priorities_90d,
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
        const message = err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(encoder.encode("error", { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
