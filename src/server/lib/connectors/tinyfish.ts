const TINYFISH_API = "https://agent.tinyfish.ai/v1/automation/run-sse";

export interface LinkedInProfileData {
  recentLinkedInPosts: string[];
}

/**
 * Scrapes recent LinkedIn posts via TinyFish Web Agent (SSE).
 * Extracts only posts — job title/company/career already available from Instantly.
 * Returns structured JSON directly — no LLM summarization needed.
 * Best-effort: returns null on any failure.
 *
 * Typical cost: ~4 steps = $0.06/lead.
 */
export async function scrapeLinkedInViaTinyFish(
  linkedinUrl: string,
  onStatus?: (msg: string) => void,
): Promise<LinkedInProfileData | null> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    console.warn("[tinyfish] TINYFISH_API_KEY not set — skipping LinkedIn scrape");
    return null;
  }

  onStatus?.("Scraping LinkedIn posts via TinyFish...");

  try {
    const res = await fetch(TINYFISH_API, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: linkedinUrl,
        goal: 'Read this LinkedIn profile page. Extract the 3 most recent post previews visible in the activity section. Do NOT navigate away from this page. Return JSON: { "posts": ["one sentence summary", "...", "..."] }',
        browser_profile: "stealth",
      }),
      signal: AbortSignal.timeout(90_000), // 90s timeout for browser automation
    });

    if (!res.ok) {
      console.warn(`[tinyfish] HTTP ${res.status} for ${linkedinUrl}`);
      return null;
    }

    // Parse SSE stream
    const reader = res.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let buffer = "";
    let resultJson: unknown = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (lines ending with \n\n)
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? ""; // Keep incomplete event in buffer

      for (const event of events) {
        for (const line of event.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);

          try {
            const data = JSON.parse(raw);

            // Relay progress events to the user
            if (data.type === "PROGRESS") {
              const msg = data.purpose ?? data.message ?? "Processing...";
              onStatus?.(msg);
            }

            // Capture the final result
            if (data.type === "COMPLETE" && data.resultJson) {
              resultJson = data.resultJson;
            }
          } catch {
            // Not JSON or incomplete — skip
          }
        }
      }
    }

    if (!resultJson) {
      console.warn(`[tinyfish] No resultJson for ${linkedinUrl}`);
      return null;
    }

    // Parse result — handle multiple formats TinyFish may return
    const result = resultJson as Record<string, unknown>;

    // TinyFish may return { posts: [...] } or { recentPosts: [...] } or { result: { posts: [...] } }
    const data = (typeof result.result === "object" && result.result !== null)
      ? result.result as Record<string, unknown>
      : result;

    const rawPosts = data.posts ?? data.recentPosts ?? data.recentLinkedInPosts ?? [];
    if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
      console.warn(`[tinyfish] No posts found for ${linkedinUrl}`);
      return null;
    }

    // Normalize posts — handle both string[] and {title, summary}[] formats
    const posts: string[] = rawPosts
      .map((p: unknown) => {
        if (typeof p === "string") return p;
        if (typeof p === "object" && p !== null) {
          const obj = p as Record<string, unknown>;
          return (obj.summary ?? obj.title ?? obj.text ?? "") as string;
        }
        return "";
      })
      .filter((p) => p.length > 0);

    if (posts.length === 0) {
      console.warn(`[tinyfish] Empty posts after normalization for ${linkedinUrl}`);
      return null;
    }

    console.log(`[tinyfish] LinkedIn scraped: ${posts.length} posts for ${linkedinUrl}`);
    return { recentLinkedInPosts: posts };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      console.warn(`[tinyfish] Timeout for ${linkedinUrl}`);
    } else {
      console.warn(`[tinyfish] Error for ${linkedinUrl}:`, err);
    }
    return null;
  }
}
