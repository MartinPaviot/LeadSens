import { VERTICAL_CONFIGS, PLATFORM_META } from "./constants"
import type { Vertical, Platform } from "./types"

// ── Helpers ────────────────────────────────────────────

function verticalBlock(vertical: Vertical): string {
  const cfg = VERTICAL_CONFIGS[vertical]
  return [
    `Vertical: ${cfg.label}`,
    `Primary KPIs: ${cfg.primaryKpis.join(", ")}`,
    `Secondary KPIs: ${cfg.secondaryKpis.join(", ")}`,
    `Typical CPA range: ${cfg.typicalCpa.min}-${cfg.typicalCpa.max} EUR`,
    `Typical ROAS range: ${cfg.typicalRoas.min}x-${cfg.typicalRoas.max}x`,
  ].join("\n")
}

function platformsBlock(platforms: Platform[]): string {
  return platforms
    .map((p) => {
      const meta = PLATFORM_META[p]
      return [
        `### ${meta.label}`,
        `Min daily budget: ${meta.minDailyBudget} EUR`,
        `Best for: ${meta.bestFor.join(", ")}`,
        `Ad formats: ${meta.adFormats.join(", ")}`,
      ].join("\n")
    })
    .join("\n\n")
}

// ── Diagnostic / Strategy Prompt ───────────────────────

export function getDiagnosticPrompt(language: string): string {
  return `You are an expert Social Media Campaign Manager (code: SMC-19).
Your job is to analyze a campaign brief and create a complete paid + organic strategy.

You must produce:
1. Budget allocation (cold/retargeting/scaling/tests split + per-platform)
2. Campaign structures for each platform (name, type, audience, creatives, KPI targets)
3. Recommendations for creative angles and messaging

RULES:
- Respond ENTIRELY in ${language}.
- Return ONLY a valid JSON object with this structure:
{
  "budgetAllocation": {
    "split": { "cold": 40, "retargeting": 25, "scaling": 25, "tests": 10 },
    "byPlatform": [{ "platform": "meta", "amount": 2000, "percentage": 50 }],
    "totalMonthly": 4000
  },
  "campaigns": [
    {
      "platform": "meta",
      "name": "Cold - Lookalike Interest",
      "type": "cold",
      "budget": 800,
      "audience": { "name": "Lookalike 1%", "targeting": "Interest-based lookalike", "estimatedSize": "500K-1M" },
      "creatives": [{ "headline": "...", "body": "...", "cta": "Learn More", "format": "carousel" }],
      "kpiTargets": [{ "metric": "CPA", "target": 25, "unit": "EUR" }],
      "status": "draft"
    }
  ],
  "strategySummary": "Brief explanation of the overall strategy"
}
- Adapt budget splits to the vertical and objective.
- Each campaign must have at least 2 creative variations.
- KPI targets must be realistic for the vertical.
- No markdown fences. No text before or after the JSON.`
}

// ── Organic Calendar Prompt ────────────────────────────

export function getOrganicCalendarPrompt(language: string): string {
  return `You are an expert Social Media Calendar Planner (part of SMC-19 agent).
Generate an editorial calendar of organic posts for the specified platforms and month.

RULES:
- Respond ENTIRELY in ${language}.
- Return ONLY a valid JSON object with this structure:
{
  "posts": [
    {
      "platform": "meta",
      "date": "2026-04-01",
      "time": "09:00",
      "content": "Post caption text...",
      "hashtags": ["tag1", "tag2"],
      "mediaType": "image",
      "objective": "engagement",
      "status": "planned"
    }
  ],
  "platformBreakdown": { "meta": 16, "linkedin": 12 }
}
- Space posts evenly across the month.
- Vary content types and objectives.
- Use platform-specific best practices for timing.
- Each post should be complete and ready to publish.
- No markdown fences. No text before or after the JSON.`
}

// ── Campaign Creative Prompt ───────────────────────────

export function getCampaignCreativePrompt(language: string): string {
  return `You are an expert Ad Creative Writer (part of SMC-19 agent).
Generate ad creatives for a paid social media campaign.

RULES:
- Respond ENTIRELY in ${language}.
- Return ONLY a valid JSON object with this structure:
{
  "creatives": [
    {
      "headline": "Headline text (max 40 chars)",
      "body": "Ad body text",
      "cta": "Call to action button text",
      "format": "image",
      "angle": "pain-point | benefit | social-proof | urgency | curiosity"
    }
  ]
}
- Generate at least 3 variations with different angles.
- Headlines must be punchy and under 40 characters.
- Body must match the platform's tone and character limits.
- CTAs must be action-oriented and specific.
- No markdown fences. No text before or after the JSON.`
}

// ── Weekly Report Prompt ───────────────────────────────

export function getReportPrompt(language: string): string {
  return `You are an expert Campaign Performance Analyst (part of SMC-19 agent).
Analyze campaign metrics and generate a weekly performance report with actionable recommendations.

RULES:
- Respond ENTIRELY in ${language}.
- Return ONLY a valid JSON object with this structure:
{
  "summary": "Executive summary of the week",
  "recommendations": [
    {
      "priority": "high",
      "action": "Specific action to take",
      "expectedImpact": "Expected result of this action"
    }
  ],
  "actions": [
    {
      "type": "pause",
      "campaign": "Campaign name",
      "reason": "Why this action",
      "impact": "Expected impact"
    }
  ]
}
- Focus on actionable insights, not vanity metrics.
- Flag any KPI threshold breaches.
- Recommend budget reallocation if warranted.
- Prioritize recommendations by impact.
- No markdown fences. No text before or after the JSON.`
}

// ── User Prompt Builders ───────────────────────────────

export function buildDiagnosticUserPrompt(
  brief: {
    objective: string
    monthlyBudget: number
    platforms: Platform[]
    vertical: Vertical
    audience: string
    product: string
    kpis: string[]
  },
): string {
  const lines = [
    `Objective: ${brief.objective}`,
    `Monthly budget: ${brief.monthlyBudget} EUR`,
    `Product/Service: ${brief.product}`,
    `Target audience: ${brief.audience}`,
    `KPIs: ${brief.kpis.join(", ")}`,
    "",
    verticalBlock(brief.vertical),
    "",
    "Target platforms:",
    platformsBlock(brief.platforms),
  ]
  return lines.join("\n")
}

export function buildCalendarUserPrompt(
  month: string,
  platforms: Platform[],
  product: string,
  audience: string,
  vertical: Vertical,
): string {
  return [
    `Month: ${month}`,
    `Product/Service: ${product}`,
    `Target audience: ${audience}`,
    "",
    verticalBlock(vertical),
    "",
    "Platforms:",
    platformsBlock(platforms),
  ].join("\n")
}
