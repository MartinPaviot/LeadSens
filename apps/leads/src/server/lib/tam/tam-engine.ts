/**
 * TAM Engine — Orchestrator.
 *
 * Coordinates all TAM phases: ICP inference → count → sample → signals → score → persist.
 * Emits progress callbacks for SSE streaming.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@leadsens/db";
import { logger } from "@/lib/logger";
import { parseCompanyDna, type CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import { searchPeople, enrichOrganization } from "@/server/lib/connectors/apollo";
import { inferICP, type InferredICP } from "./infer-icp";
import { countTAM, type TAMCount } from "./count-tam";
import { detectAllSignals, type SignalResult, type ApolloOrgData } from "./detect-signals";
import { scoreLeads, type ScoredLead } from "./score-leads";

function getApolloKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY not set in environment");
  return key;
}

// ─── Types ───────────────────────────────────────────────

export type TAMPhase =
  | "inferring"
  | "counting"
  | "sampling"
  | "signals"
  | "scoring"
  | "persisting"
  | "complete"
  | "error";

export interface TAMProgress {
  phase: TAMPhase;
  message: string;
  data?: unknown;
}

export interface TAMResult {
  icp: InferredICP;
  counts: TAMCount;
  leads: ScoredLead[];
  burningEstimate: number;
  buildDurationMs: number;
}

// ─── Engine ──────────────────────────────────────────────

/**
 * Build TAM for a workspace. Orchestrates all phases.
 *
 * @param workspaceId - Workspace to build TAM for
 * @param onProgress - Callback for SSE progress updates
 * @returns Full TAM result
 */
export async function buildTAM(
  workspaceId: string,
  onProgress?: (progress: TAMProgress) => void,
): Promise<TAMResult> {
  const startMs = Date.now();
  const emit = (phase: TAMPhase, message: string, data?: unknown) => {
    onProgress?.({ phase, message, data });
  };

  // ── Load Company DNA ──────────────────────────────────
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { companyDna: true },
  });

  const dna = parseCompanyDna(workspace.companyDna);
  if (!dna || typeof dna === "string") {
    throw new Error("Company DNA not found or invalid. Complete the website analysis first.");
  }
  const companyDna = dna as CompanyDna;

  // ── Phase 1: Infer ICP ────────────────────────────────
  emit("inferring", "Analyzing your offer to build ICP...");
  const icp = await inferICP(companyDna, workspaceId);
  emit("inferring", `ICP ready: ${icp.roles.length} roles, ${icp.companies.industries.length} industries`, {
    roles: icp.roles.map((r) => r.title),
  });

  // ── Phase 2: Count TAM ────────────────────────────────
  emit("counting", "Counting your total addressable market...");
  const counts = await countTAM(icp, workspaceId);
  emit("counting", `Found ${counts.total.toLocaleString()} matching contacts`, {
    total: counts.total,
  });

  // ── Phase 3: Sample leads ─────────────────────────────
  emit("sampling", "Pulling sample leads...");
  const apolloKey = getApolloKey();
  const allTitles = icp.roles.flatMap((r) => [r.title, ...r.variations]);
  const searchResult = await searchPeople(apolloKey, {
    person_titles: allTitles,
    person_locations: icp.companies.geography.length > 0 ? icp.companies.geography : undefined,
    organization_num_employees_ranges: [`${icp.companies.employeeRange.min},${icp.companies.employeeRange.max}`],
    per_page: 5,
    page: 1,
  });
  const samplePeople = searchResult?.people ?? [];
  emit("sampling", `Got ${samplePeople.length} sample leads`);

  // ── Phase 4: Detect signals ───────────────────────────
  emit("signals", "Detecting buying signals...");
  const leadsWithSignals: Array<{
    lead: {
      firstName?: string;
      lastName?: string;
      title?: string;
      company?: string;
      domain?: string;
      industry?: string;
      employeeCount?: number;
      country?: string;
      linkedinUrl?: string;
    };
    signals: SignalResult[];
    orgData?: ApolloOrgData;
  }> = [];

  for (const person of samplePeople) {
    const domain = person.organizationDomain;

    // Enrich org data for this lead's company
    let orgData: ApolloOrgData | undefined;
    if (domain) {
      try {
        const orgResult = await enrichOrganization(apolloKey, domain);
        if (orgResult) {
          orgData = {
            domain,
            technologies: orgResult.technologies,
            latestFundingRoundDate: orgResult.latestFundingRoundDate,
            fundingTotal: orgResult.fundingTotal?.toString(),
            employeeCount: orgResult.employeeCount,
            industry: orgResult.industry,
          };
        }
      } catch {
        // Best-effort
      }
    }

    const signals = domain
      ? await detectAllSignals(domain, orgData)
      : [];

    leadsWithSignals.push({
      lead: {
        firstName: person.firstName,
        lastName: person.lastName,
        title: person.title,
        company: person.organizationName,
        domain: person.organizationDomain,
        industry: person.organizationIndustry,
        employeeCount: person.organizationEmployeeCount ?? undefined,
        country: person.country,
        linkedinUrl: person.linkedinUrl,
      },
      signals,
      orgData,
    });

    emit("signals", `Signals for ${person.organizationName ?? "lead"} detected`);
  }

  // ── Phase 5: Score leads ──────────────────────────────
  emit("scoring", "Scoring and ranking leads...");
  const scoredLeads = scoreLeads(
    leadsWithSignals.map(({ lead, signals }) => ({ lead, signals })),
    icp,
  );
  emit("scoring", `${scoredLeads.length} leads scored`);

  // ── Estimate "Burning" count ──────────────────────────
  // Based on sample ratio: if 2/5 leads are Burning, estimate 40% of total
  const burningCount = scoredLeads.filter((l) => l.heat === "Burning").length;
  const burningRatio = samplePeople.length > 0 ? burningCount / samplePeople.length : 0;
  const burningEstimate = Math.round(counts.total * burningRatio);

  // ── Phase 6: Persist ──────────────────────────────────
  emit("persisting", "Saving results...");

  const tamResult: TAMResult = {
    icp,
    counts,
    leads: scoredLeads,
    burningEstimate,
    buildDurationMs: Date.now() - startMs,
  };

  // Save TAM result to workspace
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      tamResult: tamResult as unknown as Prisma.InputJsonValue,
      tamBuiltAt: new Date(),
      tamIcp: icp as unknown as Prisma.InputJsonValue,
    },
  });

  // Persist sample leads as Lead records (status SOURCED)
  for (const scored of scoredLeads) {
    if (!scored.company || !scored.domain) continue;

    // Use domain+title as a placeholder email (email not revealed by Apollo search)
    const placeholderEmail = `${(scored.firstName ?? "unknown").toLowerCase()}.${(scored.lastName ?? "unknown").toLowerCase()}@${scored.domain}`;

    try {
      await prisma.lead.upsert({
        where: {
          workspaceId_email: {
            workspaceId,
            email: placeholderEmail,
          },
        },
        create: {
          workspaceId,
          email: placeholderEmail,
          firstName: scored.firstName ?? null,
          lastName: scored.lastName ?? null,
          company: scored.company ?? null,
          jobTitle: scored.title ?? null,
          industry: scored.industry ?? null,
          companySize: scored.employeeCount?.toString() ?? null,
          country: scored.country ?? null,
          linkedinUrl: scored.linkedinUrl ?? null,
          website: scored.domain ? `https://${scored.domain}` : null,
          companyDomain: scored.domain ?? null,
          status: "SOURCED",
          icpScore: scored.numericScore,
          icpBreakdown: {
            tier: scored.tier,
            heat: scored.heat,
            tierReasons: scored.tierReasons,
            heatReasons: scored.heatReasons,
          } as unknown as Prisma.InputJsonValue,
          enrichmentData: {
            tamSignals: scored.signals.map((s) => ({
              name: s.name,
              detected: s.detected,
              evidence: s.evidence,
              points: s.points,
            })),
          } as unknown as Prisma.InputJsonValue,
        },
        update: {
          icpScore: scored.numericScore,
          icpBreakdown: {
            tier: scored.tier,
            heat: scored.heat,
            tierReasons: scored.tierReasons,
            heatReasons: scored.heatReasons,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      logger.warn("[tam] Failed to persist lead", {
        email: placeholderEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  emit("complete", "TAM build complete!", { total: counts.total, leads: scoredLeads.length });

  return tamResult;
}
