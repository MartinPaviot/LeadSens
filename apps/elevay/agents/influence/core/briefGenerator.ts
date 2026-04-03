import type { InfluencerProfile, CampaignBrief } from '../types';

/**
 * Generate a collaboration brief for a specific influencer.
 * V1: template-based. When Anthropic API is integrated,
 * this will use Claude for personalized briefs.
 */
export function generateCollaborationBrief(
  influencer: InfluencerProfile,
  brief: Partial<CampaignBrief>,
): string {
  const objective = brief.objective ?? 'branding';
  const sector = brief.sector ?? 'your industry';
  const style = brief.contentStyle ?? 'lifestyle';

  return `Hi ${influencer.name},

We're launching a ${objective} campaign in the ${sector} space and your content style aligns perfectly with what we're looking for.

Campaign overview:
- Objective: ${objective}
- Content style: ${style}
- Platforms: ${influencer.platforms.join(', ')}
- Timeline: 4-6 weeks

What we love about your profile:
- Your ${influencer.niche} content resonates with our target audience
- ${influencer.engagementRate}% engagement rate shows genuine community connection
- Your aesthetic and tone match our brand values

We'd love to discuss a collaboration. Are you available for a quick call this week?

Best regards`;
}
