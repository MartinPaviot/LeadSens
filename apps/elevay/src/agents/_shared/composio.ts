import { env } from "@/lib/env"

// ── Generic fetch helper with retry ─────────────────────────────────────────

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries: number,
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        console.warn(`[API] ${res.status} ${res.statusText} — ${url}`)
        if (attempt === retries) return null
      } else {
        return (await res.json()) as T
      }
    } catch (err) {
      console.warn("[API] fetch failed:", url, String(err))
      if (attempt === retries) return null
    }
    await new Promise<void>((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
  return null
}

// ── SerpAPI — Google SERP results ───────────────────────────────────────────

async function searchSerp(q: string, num = 10): Promise<unknown> {
  const key = env.SERPAPI_KEY
  if (!key) return null
  const params = new URLSearchParams({
    api_key: key,
    q,
    num: String(num),
    engine: "google",
  })
  return fetchWithRetry(
    `https://serpapi.com/search.json?${params}`,
    { method: "GET" },
    2,
  )
}

// ── GNews — news articles ───────────────────────────────────────────────────

async function searchNews(q: string, lang = "fr"): Promise<unknown> {
  const key = env.GNEWS_API_KEY
  if (!key) return null
  const params = new URLSearchParams({
    apikey: key,
    q,
    lang,
    max: "10",
  })
  return fetchWithRetry(
    `https://gnews.io/api/v4/search?${params}`,
    { method: "GET" },
    1,
  )
}

// ── YouTube Data API v3 — video search ──────────────────────────────────────

async function getYoutube(q: string): Promise<unknown> {
  const key = env.YOUTUBE_API_KEY
  if (!key) return null
  // Search first to get video IDs
  const searchParams = new URLSearchParams({
    key,
    part: "snippet",
    q,
    maxResults: "10",
    type: "video",
  })
  const searchResult = await fetchWithRetry<{
    items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }>
  }>(
    `https://www.googleapis.com/youtube/v3/search?${searchParams}`,
    { method: "GET" },
    1,
  )
  if (!searchResult?.items?.length) return searchResult

  // Fetch statistics for found videos
  const videoIds = searchResult.items
    .map((item) => item.id?.videoId)
    .filter(Boolean)
    .join(",")

  if (!videoIds) return searchResult

  const statsParams = new URLSearchParams({
    key,
    part: "snippet,statistics",
    id: videoIds,
  })
  const statsResult = await fetchWithRetry(
    `https://www.googleapis.com/youtube/v3/videos?${statsParams}`,
    { method: "GET" },
    1,
  )

  return statsResult ?? searchResult
}

// ── DataForSEO — keyword data ───────────────────────────────────────────────

async function getKeywords(
  keywords: string[],
  country = "fr",
): Promise<unknown> {
  const login = env.DATAFORSEO_LOGIN
  const password = env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  const auth = Buffer.from(`${login}:${password}`).toString("base64")
  return fetchWithRetry(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords,
          location_name:
            country === "fr"
              ? "France"
              : country === "us"
                ? "United States"
                : country,
          language_name: "French",
        },
      ]),
    },
    2,
  )
}

// ── Firecrawl — web scraping ────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<unknown> {
  const key = env.FIRECRAWL_API_KEY
  if (!key) return null
  const result = await fetchWithRetry<{
    success?: boolean
    data?: unknown
  }>(
    "https://api.firecrawl.dev/v1/scrape",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    },
    1,
  )
  return result?.data ?? result
}

// ── Public API ──────────────────────────────────────────────────────────────

export const composio = {
  searchSerp,
  searchNews,
  getYoutube,
  getKeywords,
  scrapeUrl,
}
