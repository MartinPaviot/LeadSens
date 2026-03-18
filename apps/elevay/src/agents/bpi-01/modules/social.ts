import type { SocialData } from "../types";

const PLATFORMS = ["twitter", "linkedin", "instagram"] as const;

/** Fetch social media signals for a brand */
export async function fetchSocial(_brand: string): Promise<SocialData[]> {
  // TODO: integrate with social listening APIs (e.g. Brandwatch, Mention via Composio)
  return PLATFORMS.map((platform) => ({
    platform,
    mentions: 0,
    sentiment: "neutral" as const,
  }));
}
