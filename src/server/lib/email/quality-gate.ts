import { mistralClient } from "@/server/lib/llm/mistral-client";
import { scanForSpamWords, SPAM_THRESHOLD } from "@/server/lib/email/spam-words";
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
- formatting: Proper line breaks (\\n), short paragraphs, no wall of text? Subject 2-4 words, lowercase?
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

export function getMinQualityScore(step: number): number {
  return step === 0 ? STEP_0_QUALITY_SCORE : DEFAULT_QUALITY_SCORE;
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
}): Promise<DraftResult & { qualityScore: QualityScore }> {
  const minScore = getMinQualityScore(params.context.step);
  let bestResult: (DraftResult & { qualityScore: QualityScore }) | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const draft = await params.draftFn();

    // Spam word scan — instant, zero cost, runs BEFORE LLM scoring
    const spamScan = scanForSpamWords(draft.subject, draft.body);

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

    if (!bestResult || score.overall > bestResult.qualityScore.overall) {
      bestResult = { ...draft, qualityScore: score };
    }

    if (score.overall >= minScore && !spamScan.flagged) {
      return bestResult;
    }

    console.log(
      `[quality-gate] ${params.context.leadName} step ${params.context.step}: score ${score.overall}/${minScore} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
      score.issues?.join(", ") ?? "",
    );
  }

  // Return best attempt even if below threshold
  return bestResult!;
}
