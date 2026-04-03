import type { CampaignBrief, BRIEF_FIELDS } from '../types';

type BriefField = (typeof BRIEF_FIELDS)[number];

const REQUIRED_FIELDS: BriefField[] = [
  'objective', 'sector', 'geography', 'platforms', 'budgetMax', 'priority',
];

export function isBriefComplete(brief: Partial<CampaignBrief>): boolean {
  for (const field of REQUIRED_FIELDS) {
    const value = brief[field];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
  }
  return true;
}

export function getMissingFields(brief: Partial<CampaignBrief>): BriefField[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = brief[field];
    if (value === undefined || value === null) return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  });
}

export function formatBriefSummary(brief: Partial<CampaignBrief>): string {
  const lines: string[] = [];
  if (brief.objective) lines.push(`Objective: ${brief.objective}`);
  if (brief.sector) lines.push(`Sector: ${brief.sector}`);
  if (brief.geography) lines.push(`Geography: ${brief.geography}`);
  if (brief.platforms?.length) lines.push(`Platforms: ${brief.platforms.join(', ')}`);
  if (brief.contentStyle) lines.push(`Content style: ${brief.contentStyle}`);
  if (brief.budgetMin || brief.budgetMax) lines.push(`Budget: ${brief.budgetMin ?? '?'}–${brief.budgetMax ?? '?'}€`);
  if (brief.priority) lines.push(`Priority: ${brief.priority}`);
  if (brief.profileType) lines.push(`Profile type: ${brief.profileType}`);
  return lines.join('\n');
}
