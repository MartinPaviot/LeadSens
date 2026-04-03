export const SCORING_ANALYSIS_PROMPT = `You are analyzing influencer profiles for campaign compatibility. For each profile, evaluate these 5 dimensions on a 0-100 scale:

1. Reach x Engagement (40%): Audience size weighted by engagement rate. Higher engagement with moderate reach scores better than massive reach with low engagement.
2. Thematic Affinity (25%): How well the influencer's niche aligns with the campaign sector. Exact match = 90+, adjacent = 70-89, tangential = below 70.
3. Brand Safety (20%): Content history, past collaborations, any controversies. Clean history = 85+, minor flags = 60-84, risks = below 60.
4. Content Quality (10%): Visual aesthetics, editorial consistency, video completion rates. Professional quality = 85+, good = 70-84, average = below 70.
5. Credibility (5%): Data reliability, posting consistency, audience authenticity signals.

Output format per profile:
- Total weighted score (0-100)
- Individual component scores
- One-line recommendation`;
