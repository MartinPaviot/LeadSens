import type { CampaignTone, CampaignObjective } from "./types"

// ── Email Generation Prompts ────────────────────────────

const TONE_INSTRUCTIONS: Record<CampaignTone, string> = {
  promotional:
    "Energetic, benefit-focused. Lead with the offer. Create urgency without being pushy. Use numbers and concrete savings.",
  informational:
    "Clear, educational. Focus on value delivery. Structure with headers. Professional but warm.",
  urgency:
    "Time-sensitive, direct. Countdown language. FOMO without manipulation. Clear deadline.",
  storytelling:
    "Narrative-driven. Open with a relatable scenario. Build emotional connection. End with a natural CTA.",
  minimal:
    "Ultra-concise. One key message. Maximum white space. Single CTA. No fluff.",
}

const OBJECTIVE_CONTEXT: Record<CampaignObjective, string> = {
  sale: "Drive purchases. Highlight product benefits, pricing, and social proof.",
  retention:
    "Strengthen relationship with existing customers. Remind them of value received. Exclusive perks.",
  reactivation:
    "Win back inactive contacts. Acknowledge absence. New value proposition or incentive.",
  activation:
    "Convert trial/free users to active users. Show quick wins. Reduce time-to-value.",
  event:
    "Drive event attendance. Key details (date, time, speakers). Urgency on limited spots.",
}

export function getEmailSystemPrompt(
  tone: CampaignTone,
  objective: CampaignObjective,
  segment: string,
  language: string,
): string {
  return `You are an expert Email Marketing Copywriter.
Generate a complete marketing email that drives ${objective}.

TONE: ${TONE_INSTRUCTIONS[tone]}
OBJECTIVE: ${OBJECTIVE_CONTEXT[objective]}
TARGET SEGMENT: ${segment}

RESPOND ENTIRELY in ${language}.
Return ONLY a JSON object:
{
  "subject": "Email subject line (max 60 chars, compelling, no spam triggers)",
  "preHeader": "Pre-header text (max 100 chars, complements subject)",
  "bodyHtml": "Full email body in clean HTML (with inline styles). Use <h1>, <p>, <a>, <strong>. Keep it concise.",
  "cta": { "text": "CTA button text (max 5 words)", "url": "{{OFFER_URL}}" }
}

RULES:
- Subject: no ALL CAPS, no excessive punctuation, no spam words (free!!!, act now, limited time)
- PreHeader: add context the subject doesn't cover
- Body: 150-300 words for promotional/minimal, 200-500 for storytelling/informational
- CTA: single clear action, actionable verb
- No markdown fences. No text before or after JSON.`
}

export function getEmailABPrompt(
  tone: CampaignTone,
  objective: CampaignObjective,
  variableToTest: string,
  language: string,
): string {
  return `You are an expert Email A/B Testing Strategist.
Generate a VARIANT B for an A/B test on the ${variableToTest}.

TONE: ${TONE_INSTRUCTIONS[tone]}
OBJECTIVE: ${OBJECTIVE_CONTEXT[objective]}

RESPOND ENTIRELY in ${language}.
Return ONLY a JSON object with the variant field(s):
${variableToTest === "subject" ? '{ "subject": "Alternative subject line with different angle" }' : ""}
${variableToTest === "cta" ? '{ "cta": { "text": "Alternative CTA", "url": "{{OFFER_URL}}" } }' : ""}
${variableToTest === "content" ? '{ "bodyHtml": "Full alternative email body in HTML" }' : ""}

The variant must be meaningfully different — not just a word swap.
No markdown fences. No text before or after JSON.`
}

// ── SMS Prompts ─────────────────────────────────────────

export function getSMSSystemPrompt(
  tone: CampaignTone,
  objective: CampaignObjective,
  language: string,
): string {
  return `You are an expert SMS Marketing Copywriter.
Generate a concise SMS message for a ${objective} campaign.

TONE: ${TONE_INSTRUCTIONS[tone]}

RESPOND ENTIRELY in ${language}.
Return ONLY a JSON object:
{
  "message": "SMS text max 160 characters including link placeholder {{LINK}}",
  "variantB": { "message": "Alternative SMS for A/B test" }
}

RULES:
- MAX 160 characters total (including {{LINK}} placeholder)
- Include {{LINK}} where the tracked link should go
- Engaging but not spammy
- Include opt-out reminder if legally required: "STOP to unsubscribe"
- No markdown fences. No text before or after JSON.`
}

// ── Report & Recommendations Prompt ─────────────────────

export function getReportPrompt(language: string): string {
  return `You are an expert CRM Performance Analyst.
Analyze the campaign metrics and provide actionable recommendations.

RESPOND ENTIRELY in ${language}.
Return ONLY a JSON object:
{
  "summary": "2-3 sentence executive summary of campaign performance",
  "recommendations": [
    "Specific, actionable recommendation 1",
    "Specific, actionable recommendation 2",
    "Specific, actionable recommendation 3"
  ],
  "nextCampaignSuggestion": {
    "bestTiming": "Day and hour for next send",
    "segmentSuggestion": "Which segment to target next",
    "formatSuggestion": "What to change in the next campaign"
  }
}

Base every recommendation on the actual data. No generic advice.
No markdown fences. No text before or after JSON.`
}
