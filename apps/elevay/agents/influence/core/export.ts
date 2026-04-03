import type { InfluencerProfile, CampaignBrief } from '../types';
import { getScoreLabel } from '../config';

/**
 * Generate CSV content with BOM for Excel compatibility.
 * Uses semicolon separator (European standard).
 */
export function toCSV(profiles: InfluencerProfile[]): string {
  const headers = [
    'Name', 'Handle', 'Type', 'Platforms', 'Niche', 'Followers',
    'Engagement Rate', 'Budget Min (€)', 'Budget Max (€)',
    'AI Score', 'Score Label',
    'Reach×Engagement (%)', 'Thematic Affinity (%)', 'Brand Safety (%)',
    'Content Quality (%)', 'Credibility (%)',
  ];

  const rows = profiles.map((p) => [
    p.name,
    p.handle,
    p.type,
    p.platforms.join(', '),
    p.niche,
    String(p.followers),
    `${p.engagementRate}%`,
    String(p.estimatedBudgetMin),
    String(p.estimatedBudgetMax),
    String(p.score.total),
    getScoreLabel(p.score.total),
    String(p.score.reachEngagement),
    String(p.score.thematicAffinity),
    String(p.score.brandSafety),
    String(p.score.contentQuality),
    String(p.score.credibility),
  ]);

  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const bom = '\uFEFF';
  return bom + [headers, ...rows].map((row) => row.map(escape).join(';')).join('\n');
}

/**
 * Trigger CSV download in browser.
 */
export function downloadCSV(profiles: InfluencerProfile[], brief?: Partial<CampaignBrief>): void {
  const csv = toCSV(profiles);
  const sector = brief?.sector?.toLowerCase().replace(/\s+/g, '-') ?? 'all';
  const date = new Date().toISOString().slice(0, 10);
  const filename = `elevay-influencers-${sector}-${date}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
