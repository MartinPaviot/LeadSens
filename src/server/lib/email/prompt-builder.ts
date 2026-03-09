import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "@/server/lib/email/campaign-angle";
import type { LeadForEmail, DraftedEmailRef } from "./types";
import { findBestMatches, findPortfolioMatches } from "./industry-taxonomy";

interface Framework {
  name: string;
  instructions: string;
  objective: string;
  maxWords: number;
}

export function getFramework(step: number): Framework {
  switch (step) {
    case 0:
      return {
        name: "PAS (Timeline Hook)",
        instructions:
          "PAS (Problem-Agitate-Solve) framework with TIMELINE HOOK. " +
          "1) OPENER: use the most recent and relevant signal as a timeline hook. Winning format: \"Since [signal], [consequence for their business]...\" " +
          "2) One sentence that amplifies — concrete consequence of this problem. " +
          "3) Present your solution in 1 sentence with timeline proof if available. " +
          "CTA: open-ended question oriented toward exchange (medium commitment). E.g.: 'Worth a 10-min call?'",
        objective: "Trigger curiosity via a concrete signal. The prospect should think 'they know what's going on at our company'.",
        maxWords: 90,
      };
    case 1:
      return {
        name: "Value-add",
        instructions:
          "Deliver concrete value: a data-backed insight, an industry benchmark, or a case study with TIMELINE (e.g.: 'In 90 days, [client] achieved [result]'). " +
          "NO 'following up on my last email'. The prospect must learn something. " +
          "Use a DIFFERENT signal from step 0. If signal stacking is possible (2+ signals), combine them. " +
          "CTA: low commitment (resource, insight). E.g.: 'Want me to send the benchmark?'",
        objective: "Position yourself as a peer who brings value. Case study + timeline = credibility.",
        maxWords: 70,
      };
    case 2:
      return {
        name: "Social Proof",
        instructions:
          "Detailed case study in the SAME INDUSTRY as the prospect. Narrative format: " +
          "'[Similar client] had [same problem]. In [timeline], they achieved [result]. " +
          "With [similar size/context], you could [projection].' " +
          "If no same-industry case study, use the best available case study with projection. " +
          "CTA: medium commitment (demo, call).",
        objective: "Make the prospect project themselves into the result. Narrative > feature listing.",
        maxWords: 80,
      };
    case 3:
      return {
        name: "New Angle",
        instructions:
          "COMPLETELY different angle from steps 0-2. " +
          "Use a previously unexploited signal (techStackChanges, publicPriorities, or an unexplored pain point). " +
          "Element of surprise — address a problem the prospect may not have identified themselves. " +
          "CTA: low commitment (open question, insight sharing).",
        objective: "Reignite attention with an unexpected perspective. Show the depth of your understanding.",
        maxWords: 65,
      };
    case 4:
      return {
        name: "Micro-value",
        instructions:
          "3-4 sentences maximum. ONE SINGLE actionable insight that demonstrates your domain expertise. " +
          "Can be: a recent industry stat, a practical tip, an observation about their market. " +
          "Open-ended question at the end — no pitch, just pure value. " +
          "CTA: low commitment (open question).",
        objective: "Ultra-short, ultra-targeted. The prospect should think 'this person knows my business'.",
        maxWords: 50,
      };
    case 5:
      return {
        name: "Breakup",
        instructions:
          "2-3 sentences max. Acknowledge this may not be the right timing. " +
          "Recall THE best result from the entire sequence (the strongest case study or stat). " +
          "Leave the door open without pressure. " +
          "CTA: low commitment. E.g.: 'If timing's better later, let me know when.'",
        objective: "Close the loop cleanly. Low-pressure, high-respect. Recall the best argument.",
        maxWords: 50,
      };
    default:
      return getFramework(0);
  }
}

// ─── Signal Prioritization ──────────────────────────────

interface PrioritizedSignal {
  type: string;
  label: string;
  detail: string;
  recency: "recent" | "older" | "unknown";
}

function classifyRecency(dateStr: string | null | undefined): "recent" | "older" | "unknown" {
  if (!dateStr) return "unknown";
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return "unknown";
  return parsed >= sixMonthsAgo ? "recent" : "older";
}

/** Default signal weights (hardcoded from benchmark data) */
const DEFAULT_SIGNAL_WEIGHTS: Record<string, number> = {
  leadership_change: 5,
  funding: 4,
  hiring: 3,
  public_priority: 2.5,
  tech_stack_change: 2,
  signal: 1,
};

export function prioritizeSignals(ed: EnrichmentData, weights?: Record<string, number>): PrioritizedSignal[] {
  const signals: PrioritizedSignal[] = [];

  // 1. Leadership changes (14-25% reply rate)
  for (const lc of ed.leadershipChanges ?? []) {
    signals.push({
      type: "leadership_change",
      label: "Leadership",
      detail: lc.event + (lc.date ? ` (${lc.date})` : ""),
      recency: classifyRecency(lc.date),
    });
  }

  // 2. Funding signals (12-20% reply rate)
  for (const f of ed.fundingSignals ?? []) {
    signals.push({
      type: "funding",
      label: "Funding",
      detail: f,
      recency: "unknown",
    });
  }

  // 3. Hiring signals (10-18% reply rate)
  for (const h of ed.hiringSignals ?? []) {
    signals.push({
      type: "hiring",
      label: "Hiring",
      detail: h,
      recency: "unknown",
    });
  }

  // 4. Public priorities (10-15% reply rate)
  for (const pp of ed.publicPriorities ?? []) {
    signals.push({
      type: "public_priority",
      label: "Public priority",
      detail: pp.statement + (pp.date ? ` (${pp.date})` : ""),
      recency: classifyRecency(pp.date),
    });
  }

  // 5. Tech stack changes (8-15% reply rate)
  for (const tc of ed.techStackChanges ?? []) {
    signals.push({
      type: "tech_stack_change",
      label: "Tech stack",
      detail: tc.change + (tc.date ? ` (${tc.date})` : ""),
      recency: classifyRecency(tc.date),
    });
  }

  // 6. Generic signals (fallback)
  for (const s of ed.signals ?? []) {
    signals.push({
      type: "signal",
      label: "Signal",
      detail: s,
      recency: "unknown",
    });
  }

  // Sort: recent first, then by weight (data-driven if available, else default)
  const w = weights ?? DEFAULT_SIGNAL_WEIGHTS;
  signals.sort((a, b) => {
    const recencyOrder = { recent: 0, unknown: 1, older: 2 };
    const recencyDiff = recencyOrder[a.recency] - recencyOrder[b.recency];
    if (recencyDiff !== 0) return recencyDiff;
    return (w[b.type] ?? 1) - (w[a.type] ?? 1);
  });

  return signals;
}

function buildSignalsSection(ed: EnrichmentData, weights?: Record<string, number>): string {
  const signals = prioritizeSignals(ed, weights);
  if (signals.length === 0) return "";

  const lines = ["## BUYING SIGNALS (by priority)"];
  for (let i = 0; i < signals.length && i < 8; i++) {
    const s = signals[i];
    const recencyTag = s.recency === "recent" ? " ★ RECENT" : "";
    lines.push(`${i + 1}. [${s.type}] ${s.detail}${recencyTag}`);
  }

  if (signals.filter((s) => s.recency === "recent").length >= 2) {
    lines.push("");
    lines.push("⚡ SIGNAL STACKING POSSIBLE: 2+ recent signals available. Combine the 2 best in steps 0-1 for 25-40% reply rate (vs 8-15% for a single signal).");
  }

  return lines.join("\n");
}

// ─── Social Proof Matching (taxonomy-aware) ─────────────

function findRelevantProof(
  socialProof: NonNullable<CompanyDna["socialProof"]>,
  leadIndustry?: string | null,
): string | null {
  if (!socialProof.length) return null;

  const ranked = findBestMatches(socialProof, leadIndustry);
  const best = ranked[0];
  if (!best) return null;

  const sp = best.item;
  const clientList = sp.clients.slice(0, 3).join(", ");
  const parts: string[] = [`${sp.industry} clients: ${clientList}`];
  if (sp.keyMetric) parts[0] += ` (${sp.keyMetric})`;
  if (sp.testimonialQuote) parts.push(`"${sp.testimonialQuote}"`);
  return parts.join("\n");
}

// ─── Case Study Matching (taxonomy-aware) ───────────────

function findRelevantCaseStudy(
  caseStudies: NonNullable<CompanyDna["caseStudies"]>,
  leadIndustry?: string | null,
): string | null {
  if (!caseStudies.length) return null;

  const ranked = findBestMatches(caseStudies, leadIndustry);
  const best = ranked[0].item;

  const parts: string[] = [];
  if (best.beforeState) {
    parts.push(`Before: ${best.beforeState}`);
  }
  parts.push(
    `In ${best.timeline}, ${best.client} (${best.industry}) achieved ${best.result}${best.context ? ` — ${best.context}` : ""}`,
  );
  if (best.productUsed) {
    parts.push(`Using: ${best.productUsed}`);
  }
  if (best.quote) {
    parts.push(`"${best.quote}"`);
  }
  return parts.join("\n");
}

// ─── CTA Selection ──────────────────────────────────────

function selectCta(
  ctas: NonNullable<CompanyDna["ctas"]>,
  step: number,
): string | null {
  if (!ctas.length) return null;
  // Steps 0, 2 = medium commitment (demo, call, audit)
  // Steps 1, 3, 4, 5 = low commitment (resource, insight, question)
  const targetCommitment = step === 0 || step === 2 ? "medium" : "low";
  const match = ctas.find((c) => c.commitment === targetCommitment);
  const selected = match ?? ctas[0];
  return selected.url ? `${selected.label} (${selected.url})` : selected.label;
}

// ─── Build "Who You Are" section ────────────────────────

function buildWhoYouAre(
  companyDna: CompanyDna | string,
  step: number,
  leadIndustry?: string | null,
  campaignAngle?: CampaignAngle,
): string {
  // String-only fallback (no structured DNA)
  if (typeof companyDna === "string") {
    return `## Who you are\n${companyDna}`;
  }

  const dna = companyDna;
  const parts: string[] = [];

  // Identity
  const oneLiner = campaignAngle?.angleOneLiner ?? dna.oneLiner;
  parts.push(`## WHO YOU ARE\n${oneLiner}`);

  // Problem
  const problem = campaignAngle?.mainProblem ?? dna.problemsSolved[0];
  if (problem) {
    parts.push(`Problem you solve: ${problem}`);
  }

  // Social proof (industry-matched)
  const proof = findRelevantProof(dna.socialProof ?? [], leadIndustry);
  const angleProof = campaignAngle?.proofPoint;
  if (proof || angleProof) {
    const lines = ["## SOCIAL PROOF"];
    if (proof) lines.push(`- ${proof}`);
    if (angleProof && angleProof !== proof) lines.push(`- ${angleProof}`);
    if (dna.keyResults.length > 0) {
      lines.push(...dna.keyResults.slice(0, 2).map((r) => `- ${r}`));
    }
    parts.push(lines.join("\n"));
  } else if (dna.keyResults.length > 0) {
    parts.push(`## PROOF\n${dna.keyResults.slice(0, 3).map((r) => `- ${r}`).join("\n")}`);
  }

  // Case studies (industry-matched, timeline format)
  const caseStudy = findRelevantCaseStudy(dna.caseStudies ?? [], leadIndustry);
  if (caseStudy) {
    parts.push(`## CASE STUDY (timeline format)\n${caseStudy}`);
  }

  // Similar clients from portfolio (industry-matched)
  if (dna.clientPortfolio?.length && leadIndustry) {
    const similarClients = findPortfolioMatches(dna.clientPortfolio, leadIndustry);
    if (similarClients.length > 0) {
      parts.push(
        `## SIMILAR CLIENTS IN THEIR INDUSTRY\nCompanies in ${leadIndustry}: ${similarClients.slice(0, 5).join(", ")}\n→ Drop these names naturally in the email for maximum resonance.`,
      );
    }
  }

  // Timeline proof & signal hooks from campaign angle
  if (campaignAngle?.timelineProof) {
    parts.push(`Timeline proof: ${campaignAngle.timelineProof}`);
  }
  if (campaignAngle?.signalHooks?.length) {
    parts.push(`## SIGNAL HOOKS\n${campaignAngle.signalHooks.map((h) => `- ${h}`).join("\n")}`);
  }

  // Differentiators
  if (dna.differentiators.length > 0) {
    parts.push(`What sets you apart: ${dna.differentiators.join(", ")}`);
  }

  // CTA
  const cta = selectCta(dna.ctas ?? [], step);
  if (cta) {
    parts.push(`## CTA TO USE\n${cta}`);
  }

  // Tone
  const tone = dna.toneOfVoice;
  if (tone) {
    const toneParts: string[] = [`Register: ${tone.register}`];
    if (tone.traits.length > 0) toneParts.push(`Traits: ${tone.traits.join(", ")}`);
    const avoidWords = [
      ...(tone.avoidWords ?? []),
      ...(campaignAngle?.avoid ? [campaignAngle.avoid] : []),
    ];
    if (avoidWords.length > 0) toneParts.push(`Avoid: ${avoidWords.join(", ")}`);
    parts.push(`## TONE\n${toneParts.join("\n")}`);
  } else if (campaignAngle?.tone) {
    parts.push(`## TONE\n${campaignAngle.tone}`);
  }

  // Sender identity
  const sender = dna.senderIdentity;
  if (sender && (sender.name || sender.role)) {
    let senderLine = `## SENDER\n${sender.name}${sender.role ? `, ${sender.role}` : ""}`;
    if (step === 0 && sender.signatureHook) {
      senderLine += `\nSignature hook: ${sender.signatureHook}`;
    }
    parts.push(senderLine);
  }

  return parts.join("\n\n");
}

// ─── Previous Emails Section ────────────────────────────

function buildPreviousEmailsSection(previousEmails: DraftedEmailRef[]): string {
  if (!previousEmails.length) return "";

  const lines = ["## Previous emails (DO NOT repeat, ADVANCE the conversation)"];
  for (const email of previousEmails) {
    lines.push(`### Step ${email.step} — "${email.subject}"`);
    if (email.body) {
      const truncated = email.body.length > 500 ? email.body.slice(0, 500) + "..." : email.body;
      lines.push(`Body: ${truncated}`);
    }
  }
  return lines.join("\n");
}

// ─── Style + Performance Section Builders ────────────────

function buildStyleSection(
  styleSamples?: string[],
  winningPatterns?: WinningPattern[],
): string {
  const parts: string[] = ["## Style guide"];

  if (styleSamples?.length) {
    parts.push("### From user corrections:");
    parts.push(...styleSamples);
  }

  if (winningPatterns?.length) {
    parts.push("");
    parts.push("### From winning emails (emails that got replies):");
    for (const p of winningPatterns) {
      parts.push(`- ${p.summary} (${p.replyRate.toFixed(1)}% reply rate)`);
    }
  }

  return parts.join("\n");
}

function buildStepAnnotation(
  annotation: StepPerformanceAnnotation,
  step: number,
): string {
  if (annotation.sampleSize < 50) return ""; // Only annotate with high confidence
  const comparison = annotation.isTop
    ? "This is your best-performing step."
    : "This step underperforms compared to others.";
  return `\n## PERFORMANCE DATA (Step ${step}: ${annotation.stepName})
Your ${annotation.stepName} emails average ${annotation.replyRate.toFixed(1)}% reply rate (${annotation.sampleSize} emails). ${comparison}\n`;
}

/** Performance annotations injected when we have data */
export interface StepPerformanceAnnotation {
  stepName: string;
  replyRate: number;
  sampleSize: number;
  isTop: boolean;
}

/** Winning email patterns from past campaigns */
export interface WinningPattern {
  summary: string; // e.g. "Used leadership_change signal, 62 words, question CTA"
  replyRate: number;
}

/**
 * Builds a structured email drafting prompt.
 * 6-step sequence with signal intelligence and timeline hooks.
 */
export function buildEmailPrompt(params: {
  lead: LeadForEmail;
  step: number;
  companyDna: CompanyDna | string;
  campaignAngle?: CampaignAngle;
  previousEmails?: DraftedEmailRef[];
  styleSamples?: string[];
  icpDescription?: string;
  /** Data-driven signal weights (from correlator) */
  signalWeights?: Record<string, number>;
  /** Performance annotation for this step */
  stepAnnotation?: StepPerformanceAnnotation;
  /** Winning email patterns from past campaigns */
  winningPatterns?: WinningPattern[];
}): string {
  const fw = getFramework(params.step);
  const ed = params.lead.enrichmentData;

  // Build prioritized signals section (data-driven weights if available)
  const signalsSection = ed ? buildSignalsSection(ed, params.signalWeights) : "";

  // Vertical mismatch detection
  let verticalWarning = "";
  if (params.icpDescription && ed?.industry) {
    const icpLower = params.icpDescription.toLowerCase();
    const leadIndustry = (ed.industry as string).toLowerCase();
    const icpIndustryTerms = icpLower.match(/\b(saas|fintech|healthcare|edtech|martech|e-commerce|ecommerce|retail|manufacturing|logistics|real estate|insurance|legal|hr|cybersecurity|ai|ml|data|analytics|cloud|devops|iot|blockchain|crypto)\b/g) ?? [];
    const mismatch = icpIndustryTerms.length > 0 && !icpIndustryTerms.some((term) => leadIndustry.includes(term));
    if (mismatch) {
      verticalWarning = `\n## VERTICAL ADAPTATION REQUIRED
The ICP targets "${icpIndustryTerms.join("/")}" but this prospect is in "${ed.industry}".
ADAPT your angle to their actual vertical. Use their specific pain points and products — do NOT apply a generic ${icpIndustryTerms[0] ?? "SaaS"} playbook.
Frame the sender's solution in terms that resonate with ${ed.industry} buyers.\n`;
    }
  }

  // Enrichment enforcement block
  const hasEnrichment = !!(ed?.companySummary || ed?.painPoints?.length || ed?.products?.length);
  const hasPainPoints = (ed?.painPoints?.length ?? 0) > 0;
  const hasProducts = (ed?.products?.length ?? 0) > 0;
  const hasSignals = signalsSection.length > 0;

  let enforcementBlock = "";
  if (hasEnrichment) {
    const requirements: string[] = [];
    if (hasPainPoints) requirements.push("at least 1 pain point from the prospect's data above");
    if (hasProducts) requirements.push("a reference to their product/service (not yours)");
    if (hasSignals) requirements.push("at least 1 buying signal from the BUYING SIGNALS section");

    enforcementBlock = `## ENRICHMENT DATA USAGE (MANDATORY)
Rich prospect data is available above. You MUST use:
${requirements.map((r) => `- ${r}`).join("\n")}
Do NOT write a generic email that could apply to any company. Every sentence must show you know THIS prospect's business.
${ed?.industry ? `If the prospect's industry (${ed.industry}) differs from typical targets, ADAPT the angle to their vertical — do not force a mismatched playbook.` : ""}
`;
  } else {
    enforcementBlock = `## LIMITED PROSPECT DATA
No detailed enrichment data available for this prospect. Use the basic profile (role, company, industry) and ICP context to write a relevant but less personalized email. Acknowledge internally that personalization is limited — keep the email shorter and more question-oriented.
`;
  }

  return `
${buildWhoYouAre(params.companyDna, params.step, params.lead.industry, params.campaignAngle)}

## The prospect
- First name: ${params.lead.firstName ?? ""}
- Role: ${params.lead.jobTitle ?? "unknown"}
- Company: ${params.lead.company ?? "unknown"}
${params.lead.industry ? `- Industry: ${params.lead.industry}` : ""}
${params.lead.companySize ? `- Company size: ${params.lead.companySize}` : ""}
${params.lead.country ? `- Location: ${params.lead.country}` : ""}
${ed?.companySummary ? `- Business: ${ed.companySummary}` : ""}
${ed?.painPoints?.length ? `- Pain points: ${ed.painPoints.join(", ")}` : ""}
${ed?.products?.length ? `- Products/Services: ${ed.products.join(", ")}` : ""}
${ed?.targetMarket ? `- Target market: ${ed.targetMarket}` : ""}
${ed?.valueProposition ? `- Value proposition: ${ed.valueProposition}` : ""}
${ed?.techStack?.length ? `- Tech stack: ${ed.techStack.join(", ")}` : ""}
${ed?.industry ? `- Industry (enriched): ${ed.industry}` : ""}
${ed?.linkedinHeadline ? `- LinkedIn headline: ${ed.linkedinHeadline}` : ""}
${ed?.recentLinkedInPosts?.length ? `- Recent LinkedIn posts: ${ed.recentLinkedInPosts.join(" | ")}` : ""}
${ed?.careerHistory?.length ? `- Career path: ${ed.careerHistory.join(" → ")}` : ""}
${verticalWarning}
${signalsSection}

## CRITICAL INSTRUCTION — Connection Bridge
Do NOT LIST the prospect's pain points separately.
Choose THE SINGLE pain point that resonates most with your solution (section "WHO YOU ARE").
Build the ENTIRE email around this unique bridge:
  1. Specific signal or problem from the prospect
  2. → Specific capability of your solution that solves THIS problem
  3. → Proof with TIMELINE (client case, metric, duration) that demonstrates the result
If no pain point matches → use the most recent buying signal.

## Framework — Step ${params.step}: ${fw.name}
${fw.instructions}

## Objective
${fw.objective}

${params.previousEmails?.length ? buildPreviousEmailsSection(params.previousEmails) : ""}
${params.styleSamples?.length || params.winningPatterns?.length ? buildStyleSection(params.styleSamples, params.winningPatterns) : ""}
${params.stepAnnotation ? buildStepAnnotation(params.stepAnnotation, params.step) : ""}

${params.step === 0 ? `## TIMELINE HOOK (step 0 only)
Winning format: "Since [signal], [consequence for their business]..."
This is 2.3x more effective than problem hooks or rhetorical questions.

Opener priority:
1. Recent signal (★ RECENT in the list) → Timeline hook mandatory
2. Recent news/event → Direct reference with consequence
3. LinkedIn job change → Reference to new role
4. If no signal → Data-driven industry observation

AVOID: problem hooks ("Are you struggling with..."), rhetorical questions, flattery, "I'd love to..."
` : ""}${params.step <= 1 && signalsSection.includes("SIGNAL STACKING") ? `## SIGNAL STACKING (steps 0-1)
Combine the 2 best signals in your message. Signal stacking (2-3 combined signals) generates 25-40% reply rate vs 8-15% for a single signal.
Format: "[Signal 1] + [Signal 2] → [combined consequence] → [your solution]"
` : ""}${enforcementBlock}
## SUBJECT LINE PATTERNS (pick the best fit for this step)
| Pattern | Best for | Examples |
|---------|----------|---------|
| **Question** | Step 0, 4 — sparks curiosity | "quick question, {{firstName}}" · "thoughts on {{painPoint}}?" · "{{company}}'s approach to {{topic}}?" |
| **Observation** | Step 0, 1 — shows research | "noticed your {{signal}}" · "saw {{company}} is {{action}}" · "your {{recentMove}}" |
| **Curiosity gap** | Step 1, 3 — teases insight | "idea for {{painPoint}}" · "{{industry}} trend you'll want to see" · "what {{similarCompany}} changed" |
| **Direct** | Step 2, 5 — cuts to the point | "{{solution}} for {{company}}" · "{{result}} in {{timeline}}" · "{{company}} + {{senderCompany}}" |
| **Personalized** | Any step with strong signal | "re: {{specific_trigger}}" · "congrats on {{achievement}}" · "following {{event}}" |

Each variant in "subjects" MUST use a DIFFERENT pattern from this table. Never repeat the same pattern across variants.

## Constraints
- Max ${fw.maxWords} words for the body. Every word must earn its place.
- Subject: 2-4 words, lowercase, no forced caps, no punctuation.
- 1 single CTA oriented toward meeting/exchange/call. Never a passive "let me know".
- At least 1 prospect-specific element (signal, news, pain point).
- Language: English by default. Write in the prospect's language only if their country is non-English-speaking.
- Start with first name, no greeting formula.
- FORMATTING: use \\n for line breaks in the body JSON. Each bullet point on its own line. Paragraphs separated by \\n\\n.

JSON uniquement : {"subject": "...", "body": "..."}`.trim();
}
