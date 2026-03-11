import { mistralClient } from "@/server/lib/llm/mistral-client";
import { buildEmailPrompt } from "./prompt-builder";
import type { StepPerformanceAnnotation, WinningPattern, WinningSubject } from "./prompt-builder";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "./campaign-angle";
import type { LeadTier } from "@/server/lib/enrichment/icp-scorer";
import type { LeadForEmail, DraftedEmailRef } from "./types";

/**
 * Drafts a single email for a lead using Mistral Large.
 *
 * UPGRADE PATH: To switch to Claude Sonnet, change only the
 * mistralClient.draftEmail() call below. No callers need to change.
 */
export async function draftEmail(params: {
  lead: LeadForEmail;
  step: number;
  companyDna: CompanyDna | string;
  campaignAngle?: CampaignAngle;
  workspaceId: string;
  previousEmails?: DraftedEmailRef[];
  styleSamples?: string[];
  /** Subject line style corrections from user edits */
  subjectStyleSamples?: string[];
  icpDescription?: string;
  /** Data-driven signal weights from correlator */
  signalWeights?: Record<string, number>;
  /** Performance annotation for this step */
  stepAnnotation?: StepPerformanceAnnotation;
  /** Winning email patterns from past campaigns */
  winningPatterns?: WinningPattern[];
  /** Thompson-ranked subject line patterns */
  patternRanking?: string;
  /** Winning subject lines from past campaigns (A/B winner propagation) */
  winningSubjects?: WinningSubject[];
  /** Lead tier for tone adaptation */
  tier?: LeadTier;
}): Promise<{ subject: string; subjects?: string[]; body: string }> {
  const prompt = buildEmailPrompt({
    lead: params.lead,
    step: params.step,
    companyDna: params.companyDna,
    campaignAngle: params.campaignAngle,
    previousEmails: params.previousEmails,
    styleSamples: params.styleSamples,
    subjectStyleSamples: params.subjectStyleSamples,
    icpDescription: params.icpDescription,
    signalWeights: params.signalWeights,
    stepAnnotation: params.stepAnnotation,
    winningPatterns: params.winningPatterns,
    patternRanking: params.patternRanking,
    winningSubjects: params.winningSubjects,
    tier: params.tier,
  });

  return mistralClient.draftEmail({
    system: `You are a B2B cold email expert. You write ultra-concise emails that trigger replies.
6-email sequence: PAS (Timeline Hook) → Value-add → Social Proof → New Angle → Micro-value → Breakup.

LANGUAGE: Write emails in English by default. Only write in the prospect's language if their country is non-English-speaking (e.g., France → French, Germany → German).

ABSOLUTE RULES:
- Subject: 2-5 words max, lowercase, no clickbait, no [FirstName]
- Body: short sentences, direct tone, peer-to-peer style
- ONE SINGLE CTA oriented toward exchange (call, meeting, chat) — never a generic CTA
- Start with first name, no "Hi" or "Hello"
- No signature, no "Best regards"
- No links in the first email

BODY FORMATTING (CRITICAL):
- Use \\n for line breaks in JSON. Each idea = a new line.
- Bullet points (✅, •, -) must EACH be on a separate line with \\n before each bullet.
- Separate paragraphs with \\n\\n (double line break).
- Correct example: "Thomas,\\n\\nSince your Series B, the pressure to scale outbound is real.\\n\\n✅ Multichannel automation\\n✅ 600M+ leads\\n✅ AI personalization\\n\\nWorth a 10-min call?"
- INCORRECT example: "Thomas, You're looking for... ✅ Auto ✅ 600M ✅ Perso" (all on one line)

TIMELINE HOOKS (2.3x more effective than problem hooks):
- Step 0: ALWAYS open with a timeline hook if a recent signal is available.
- Format: "Since [signal], [consequence for their business]..."
- NEVER: "Are you struggling with...", "Do you..." (problem hooks), rhetorical questions.
- A good timeline hook shows you know what's happening RIGHT NOW at the prospect's company.

SIGNAL STACKING (steps 0-1, if 2+ signals available):
- Combine the 2 best signals into one coherent message.
- Signal stacking = 25-40% reply rate vs 8-15% for a single signal.
- Format: Signal 1 sets the context, signal 2 reinforces urgency.

CROSS-EMAIL NARRATIVE (full body of previous emails is provided):
- Each email must ADVANCE the conversation, not repeat it.
- Step 1: Bring a NEW angle compared to step 0. Don't summarize, enrich.
- Step 2: The case study should answer the implicit objection "does this actually work?".
- Step 3: Surprise — an angle the prospect didn't expect.
- Step 4: One sharp insight, not a disguised pitch.
- Step 5: Recall the best argument from the sequence, not a summary of everything.

PERSONA ADAPTATION (based on prospect's role):
- C-Level (CEO, COO, CFO) → Strategic. Talk ROI, business impact, vision. Ultra-short sentences. No technical details.
- Tech (CTO, VP Engineering, Dev Lead) → Technical and direct. Concrete mentions (stack, perf, scale). No marketing BS. If the prospect's tech stack is available, mention ONE specific tool from their stack and bridge it to your solution.
- Sales/Revenue (VP Sales, Head of Sales, SDR, AE) → Peer-to-peer, casual. Talk results, pipeline, quotas.
- Marketing (CMO, Head of Marketing, Growth) → Data-driven. Talk metrics, conversion, campaign ROI. Concrete numbers.
- Ops/Product (COO, Product Manager, Ops) → Pragmatic. Talk process, efficiency, time savings. No fluff.
- If the role doesn't fit any category → Neutral tone, professional but not corporate.

TECH STACK (if available):
- Use ONE element from the prospect's stack as a hook (not a list).
- Show you understand their technical environment.

LINKEDIN (if available):
- Use ONE recent post or ONE job change as opener. Best personalization signal.
- Ex: "Saw your post about [topic] — [connection to your solution]"
- Don't quote the post word-for-word, show you understood it.

BANNED PHRASES (dead lines that kill reply rate):
- "I hope this finds you well"
- "I came across your profile"
- "I'd love to"
- "Just checking in"
- "Let me know if you're interested" (too passive)
- Any flattery about the company or career path

SUBJECT LINE VARIANTS (A/B testing):
- Generate 3 subject line variants in "subjects": ["...", "...", "..."]
- "subject" = your best variant (also included in "subjects")
- Variants: same intent, different angles/phrasing
- All variants: 2-5 words, lowercase, no clickbait

JSON only: {"subject": "...", "subjects": ["...", "...", "..."], "body": "..."}`,
    prompt,
    workspaceId: params.workspaceId,
  });
}
