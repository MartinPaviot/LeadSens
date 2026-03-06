import { ApifyClient } from "apify-client";

const ACTOR_ID = "2SyF0bVxmgGr8IVCZ";

export interface LinkedInProfileData {
  linkedinHeadline: string | null;
  linkedinSummary: string | null;
  recentLinkedInPosts: string[];
  careerHistory: string[];
  /** Company website extracted from current experience (if available) */
  companyWebsite: string | null;
}

/**
 * Scrapes LinkedIn profile data via Apify (dev_fusion/linkedin-profile-scraper).
 * Extracts headline, about, and work experience — no cookies needed.
 * Returns structured JSON directly — no LLM summarization needed.
 * Best-effort: returns null on any failure.
 *
 * Cost: ~$0.01/profile.
 */
export async function scrapeLinkedInViaApify(
  linkedinUrl: string,
  onStatus?: (msg: string) => void,
): Promise<LinkedInProfileData | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[apify] APIFY_API_TOKEN not set — skipping LinkedIn scrape");
    return null;
  }

  onStatus?.("Scraping LinkedIn profile via Apify...");

  try {
    const client = new ApifyClient({ token });

    const run = await client.actor(ACTOR_ID).call(
      { profileUrls: [linkedinUrl] },
      { timeout: 120 },
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.warn(`[apify] No results for ${linkedinUrl}`);
      return null;
    }

    const profile = items[0] as Record<string, unknown>;

    // Extract headline
    const headline = (profile.headline ?? profile.occupation ?? null) as string | null;

    // Extract about/summary
    const summary = (profile.summary ?? profile.about ?? null) as string | null;

    // Extract work experience → careerHistory strings
    const careerHistory: string[] = [];
    const experiences = profile.experience ?? profile.experiences ?? profile.workExperience ?? [];
    if (Array.isArray(experiences)) {
      for (const exp of experiences) {
        if (typeof exp === "string") {
          careerHistory.push(exp);
        } else if (typeof exp === "object" && exp !== null) {
          const e = exp as Record<string, unknown>;
          const title = e.title ?? e.jobTitle ?? "";
          const company = e.company ?? e.companyName ?? e.organization ?? "";
          const dates = e.dates ?? e.duration ?? e.dateRange ?? "";
          const parts = [title, company, dates].filter((p) => typeof p === "string" && p.length > 0);
          if (parts.length > 0) careerHistory.push(parts.join(" @ "));
        }
      }
    }

    // Extract posts if available (some scrapers include them)
    const posts: string[] = [];
    const rawPosts = profile.posts ?? profile.recentPosts ?? profile.activities ?? [];
    if (Array.isArray(rawPosts)) {
      for (const p of rawPosts) {
        if (typeof p === "string" && p.length > 0) {
          posts.push(p);
        } else if (typeof p === "object" && p !== null) {
          const obj = p as Record<string, unknown>;
          const text = (obj.text ?? obj.summary ?? obj.content ?? obj.title ?? "") as string;
          if (text.length > 0) posts.push(text);
        }
      }
    }

    // Extract company website from profile or current experience
    let companyWebsite: string | null = null;

    // Try top-level profile fields first
    const topLevelUrl = (
      profile.companyWebsite ?? profile.companyUrl ?? profile.company_website ?? profile.website ?? null
    ) as string | null;
    if (topLevelUrl && typeof topLevelUrl === "string" && topLevelUrl.includes(".")) {
      companyWebsite = topLevelUrl;
    }

    // Fallback: extract from the first (current) experience entry
    if (!companyWebsite && Array.isArray(experiences) && experiences.length > 0) {
      const current = experiences[0];
      if (typeof current === "object" && current !== null) {
        const e = current as Record<string, unknown>;
        const expUrl = (
          e.companyWebsite ?? e.companyUrl ?? e.url ?? e.website ??
          e.company_website ?? e.companyLinkedinUrl ?? e.companyLink ?? null
        ) as string | null;
        if (expUrl && typeof expUrl === "string" && expUrl.includes(".")) {
          companyWebsite = expUrl;
        }
      }
    }

    // Log all profile keys for debugging (helps discover available fields)
    console.log(`[apify] Profile keys: ${Object.keys(profile).join(", ")}`);
    console.log(
      `[apify] LinkedIn scraped: headline=${!!headline}, career=${careerHistory.length}, posts=${posts.length}, companyWebsite=${companyWebsite} for ${linkedinUrl}`,
    );

    return {
      linkedinHeadline: headline,
      linkedinSummary: summary,
      recentLinkedInPosts: posts,
      careerHistory,
      companyWebsite,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("timeout")) {
      console.warn(`[apify] Timeout for ${linkedinUrl}`);
    } else {
      console.warn(`[apify] Error for ${linkedinUrl}:`, err);
    }
    return null;
  }
}
