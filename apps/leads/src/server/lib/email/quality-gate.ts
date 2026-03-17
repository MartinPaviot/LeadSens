import { mistralClient } from "@/server/lib/llm/mistral-client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { scanForSpamWords, SPAM_THRESHOLD } from "@/server/lib/email/spam-words";
import { scanForFillerPhrases } from "@/server/lib/email/filler-phrases";
import { scanForAiTells } from "@/server/lib/email/ai-tell-scanner";
import { getFramework } from "@/server/lib/email/prompt-builder";
import { z } from "zod/v4";

const qualityScoreSchema = z.object({
  relevance: z.number().int().min(1).max(10),
  specificity: z.number().int().min(1).max(10),
  formatting: z.number().int().min(1).max(10),
  coherence: z.number().int().min(1).max(10),
  overall: z.number().int().min(1).max(10),
  issues: z.array(z.string()).optional(),
});

export type QualityScore = z.infer<typeof qualityScoreSchema>;

interface QualityGateContext {
  leadName: string;
  leadJobTitle?: string | null;
  leadCompany?: string | null;
  step: number;
  icpDescription?: string;
  enrichmentCompleteness?: number | null;
}

const SUBJECT_MAX_WORDS = 5;
const SUBJECT_MAX_CHARS = 50;

/**
 * Check all subjects (primary + variants) for length violations.
 * Prompt says "2-5 words, lowercase" — max 5 words enforced deterministically.
 * Research recommends <50 chars for optimal open rates.
 * Returns an issue string if violated, null if OK.
 */
export function checkSubjectLength(
  primarySubject: string,
  variants?: string[],
): string | null {
  const allSubjects = [primarySubject, ...(variants ?? [])].filter(Boolean);

  const violations: string[] = [];
  for (const subj of allSubjects) {
    const words = subj
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const chars = subj.length;

    if (words > SUBJECT_MAX_WORDS) {
      violations.push(`"${subj}" has ${words} words (max ${SUBJECT_MAX_WORDS})`);
    } else if (chars > SUBJECT_MAX_CHARS) {
      violations.push(
        `"${subj}" has ${chars} chars (max ${SUBJECT_MAX_CHARS})`,
      );
    }
  }

  if (violations.length === 0) return null;

  return `Subject line too long: ${violations.join("; ")}. Subjects should be 2-5 words and under ${SUBJECT_MAX_CHARS} characters.`;
}

/**
 * Score a drafted email on 4 axes using Mistral Small.
 * Returns a structured score — caller decides what to do with it.
 */
export async function scoreEmail(params: {
  subject: string;
  body: string;
  context: QualityGateContext;
  workspaceId: string;
}): Promise<QualityScore> {
  const { subject, body, context, workspaceId } = params;

  const stepNames = [
    "PAS (Timeline Hook)", "Value-add", "Social Proof",
    "New Angle", "Micro-value", "Breakup",
  ];

  return mistralClient.json<QualityScore>({
    model: "mistral-small-latest",
    system: `You are a cold email quality scorer. Score each axis 1-10.

AXES:
- relevance: Does the email address the prospect's likely pain points? Is the solution connected to their role/industry?
- specificity: Does it use concrete data (signals, metrics, names, tech stack)? Or is it generic/templated?
- formatting: Proper line breaks (\\n), short paragraphs, no wall of text? Subject 2-5 words, lowercase?
- coherence: Does it follow the ${stepNames[context.step] ?? `step ${context.step}`} framework correctly? Is the CTA appropriate for this step?

OVERALL: weighted average (relevance 35%, specificity 30%, formatting 15%, coherence 20%).

If overall < ${context.step === 0 ? 8 : 7}, list the specific issues in "issues" array. ${context.step === 0 ? "Step 0 is the first touch — it generates 60-80% of all replies. Be strict." : ""}

JSON only: {"relevance":N,"specificity":N,"formatting":N,"coherence":N,"overall":N,"issues":["..."]}`,
    prompt: `PROSPECT: ${context.leadName} — ${context.leadJobTitle ?? "unknown role"} at ${context.leadCompany ?? "unknown company"}
STEP: ${context.step} (${stepNames[context.step] ?? "unknown"})

SUBJECT: ${subject}
BODY:
${body}`,
    schema: qualityScoreSchema,
    workspaceId,
    action: "quality-gate",
  });
}

/**
 * Step 0 generates 58-79% of all replies (Instantly + Sales.co data).
 * A higher threshold filters mediocre first touches at ~$0.002/lead extra cost.
 */
const STEP_0_QUALITY_SCORE = 8;
const DEFAULT_QUALITY_SCORE = 7;
const MAX_RETRIES = 2;

/** AgentMemory key for dynamic quality gate threshold */
export const QUALITY_GATE_MEMORY_KEY = "quality_gate_threshold";

export function getMinQualityScore(step: number, dynamicThreshold?: number): number {
  if (step === 0) return STEP_0_QUALITY_SCORE; // Step 0 always strict
  return dynamicThreshold ?? DEFAULT_QUALITY_SCORE;
}

/**
 * Read the quality gate threshold from AgentMemory.
 * Returns null if no dynamic threshold is stored (falls back to hardcoded).
 */
export async function getDynamicQualityThreshold(workspaceId: string): Promise<number | null> {
  const memory = await prisma.agentMemory.findUnique({
    where: { workspaceId_key: { workspaceId, key: QUALITY_GATE_MEMORY_KEY } },
  });
  if (!memory) return null;
  const parsed = parseInt(memory.value, 10);
  return isNaN(parsed) ? null : parsed;
}

interface DraftResult {
  subject: string;
  subjects?: string[];
  body: string;
}

/**
 * Draft an email with quality gate: if score < threshold, regenerate up to MAX_RETRIES times.
 * Step 0 threshold = 8/10 (first touch dominance), all others = 7/10.
 * Returns the best result (highest overall score).
 */
export async function draftWithQualityGate(params: {
  draftFn: () => Promise<DraftResult>;
  context: QualityGateContext;
  workspaceId: string;
  dynamicThreshold?: number;
}): Promise<DraftResult & { qualityScore: QualityScore }> {
  const minScore = getMinQualityScore(params.context.step, params.dynamicThreshold);
  let bestResult: (DraftResult & { qualityScore: QualityScore }) | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const draft = await params.draftFn();

    // Spam word scan — instant, zero cost, runs BEFORE LLM scoring
    const spamScan = scanForSpamWords(draft.subject, draft.body);

    // Deterministic word count check — research consensus: <80 words = highest reply rates
    const fw = getFramework(params.context.step);
    const wordCount = draft.body.split(/\s+/).filter((w) => w.length > 0).length;
    const wordCountExceeded = wordCount > fw.maxWords * 1.3;

    // Deterministic subject line length check — prompt says 2-4 words, research says <50 chars
    const subjectViolation = checkSubjectLength(draft.subject, draft.subjects);

    // Filler phrase scan — generic openers kill reply rates (threshold = 1)
    const fillerScan = scanForFillerPhrases(draft.body);

    const score = await scoreEmail({
      subject: draft.subject,
      body: draft.body,
      context: params.context,
      workspaceId: params.workspaceId,
    });

    // Merge spam issues into quality score
    if (spamScan.flagged) {
      const spamIssue = `Spam risk: ${spamScan.matchCount} trigger words detected (${spamScan.matches.slice(0, 5).join(", ")}). Threshold is ${SPAM_THRESHOLD}. Rephrase to avoid spam filters.`;
      score.issues = [...(score.issues ?? []), spamIssue];
      // Penalize overall score — spam risk is a deliverability problem
      score.overall = Math.max(1, score.overall - 1);
    }

    // Merge word count violation into quality score
    if (wordCountExceeded) {
      const wordCountIssue = `Word count violation: ${wordCount} words exceeds limit of ${fw.maxWords} (max allowed: ${Math.round(fw.maxWords * 1.3)}). Shorten the email.`;
      score.issues = [...(score.issues ?? []), wordCountIssue];
      score.overall = Math.max(1, score.overall - 1);
    }

    // Merge subject length violation into quality score
    if (subjectViolation) {
      score.issues = [...(score.issues ?? []), subjectViolation];
      score.overall = Math.max(1, score.overall - 1);
    }

    // Merge filler phrase violation into quality score
    if (fillerScan.flagged) {
      const fillerIssue = `Filler opener detected: "${fillerScan.matches[0]}". Generic openers signal mass template — use a specific signal, pain point, or trigger event instead.`;
      score.issues = [...(score.issues ?? []), fillerIssue];
      score.overall = Math.max(1, score.overall - 1);
    }

    // AI "tell" scan — formal language, corporate buzzwords, repetitive structure
    const aiTellScan = scanForAiTells(draft.body);
    if (aiTellScan.flagged) {
      const aiTellIssue = `AI tell (${aiTellScan.category}): "${aiTellScan.matches[0]}". Rewrite in casual peer-to-peer tone — no formal language, no corporate buzzwords.`;
      score.issues = [...(score.issues ?? []), aiTellIssue];
      score.overall = Math.max(1, score.overall - 1);
    }

    if (!bestResult || score.overall > bestResult.qualityScore.overall) {
      bestResult = { ...draft, qualityScore: score };
    }

    if (
      score.overall >= minScore &&
      !spamScan.flagged &&
      !wordCountExceeded &&
      !subjectViolation &&
      !fillerScan.flagged &&
      !aiTellScan.flagged
    ) {
      // Return current clean result, not bestResult — bestResult may have violations
      // Add thin-data warning (non-blocking, informational only)
      addThinDataWarning(score, params.context);
      return { ...draft, qualityScore: score };
    }

    logger.debug(
      `[quality-gate] ${params.context.leadName} step ${params.context.step}: score ${score.overall}/${minScore} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
      { issues: score.issues?.join(", ") ?? "" },
    );
  }

  // Return best attempt even if below threshold
  addThinDataWarning(bestResult!.qualityScore, params.context);
  return bestResult!;
}

const THIN_DATA_THRESHOLD = 0.4;

/**
 * Adds an informational warning when enrichment data is thin (< 40% fields filled).
 * Non-blocking — doesn't trigger retry or penalize score. Just informs the agent.
 */
function addThinDataWarning(score: QualityScore, context: QualityGateContext): void {
  if (
    context.enrichmentCompleteness != null &&
    context.enrichmentCompleteness < THIN_DATA_THRESHOLD
  ) {
    const pct = Math.round(context.enrichmentCompleteness * 100);
    score.issues = [
      ...(score.issues ?? []),
      `Thin enrichment data (${pct}% completeness). Email may lack personalization — consider re-enriching or using broader signals.`,
    ];
  }
}
