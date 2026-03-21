import { ComposioToolSet } from "composio-core";

// ─── Singleton client ────────────────────────────────────────────────────────

let _client: ComposioToolSet | null = null;

function getClient(): ComposioToolSet {
  if (_client) return _client;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is not set");
  _client = new ComposioToolSet({ apiKey, entityId: "default" });
  return _client;
}

// ─── Retry helper ────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) =>
          setTimeout(r, delayMs * Math.pow(2, attempt)),
        );
      }
    }
  }
  throw lastError;
}

// ─── Core executor ───────────────────────────────────────────────────────────

async function execute(
  actionName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await client.executeAction({ actionName, params } as any)) as {
    data: Record<string, unknown>;
    error?: string;
    successful?: boolean;
  };
  if (result.error) {
    throw new Error(`Composio [${actionName}]: ${result.error}`);
  }
  return result.data;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface SerpOrganicResult {
  position: number;
  link: string;
  title: string;
  snippet: string;
  displayed_link?: string;
}

export interface SerpResponse {
  organic_results: SerpOrganicResult[];
  search_information?: { total_results?: number };
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string | { name?: string };
  publishedAt?: string;
  published_at?: string;
  description?: string;
  snippet?: string;
}

export interface NewsResponse {
  articles?: NewsArticle[];
  news_results?: NewsArticle[];
  totalArticles?: number;
}

export interface KeywordDataResponse {
  rank: number;
  backlinks: number;
  referring_domains: number;
  broken_backlinks?: number;
  new_backlinks?: number;
  lost_backlinks?: number;
}

export interface YoutubeVideoItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    description?: string;
  };
}

export interface YoutubeSearchResponse {
  items: YoutubeVideoItem[];
  nextPageToken?: string;
  pageInfo?: { totalResults: number };
}

export interface YoutubeCommentItem {
  snippet: {
    topLevelComment: {
      snippet: {
        textDisplay: string;
        textOriginal?: string;
        likeCount?: number;
      };
    };
    totalReplyCount?: number;
  };
}

export interface YoutubeCommentsResponse {
  items: YoutubeCommentItem[];
  nextPageToken?: string;
  pageInfo?: { totalResults: number };
}

export type SocialPostItem = Record<string, unknown>;

export interface SocialResponse {
  items: SocialPostItem[];
}

// ─── Platform → env var ───────────────────────────────────────────────────────

const APIFY_TASK_ENV: Record<string, string> = {
  instagram: "APIFY_TASK_INSTAGRAM",
  twitter: "APIFY_TASK_TWITTER",
  tiktok: "APIFY_TASK_TIKTOK",
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * SERP — SerpAPI via Composio (retry ×2, 1s exponentiel)
 * Utilisé par modules/serp.ts (max 7 appels/audit)
 */
export async function searchSerp(
  query: string,
  country: string,
): Promise<SerpResponse> {
  return withRetry(
    async () => {
      const data = await execute("SERPAPI_GOOGLE_LIGHT_SEARCH", {
        q: query,
        gl: country.toLowerCase().slice(0, 2),
        num: 10,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as unknown as SerpResponse;
    },
    2,
    1000,
  );
}

/**
 * News — Composio Search News (retry ×1, 500ms)
 * Utilisé par modules/press.ts (max 3 appels/audit)
 */
export async function searchNews(
  query: string,
  language: string,
): Promise<NewsResponse> {
  return withRetry(
    async () => {
      const data = await execute("COMPOSIO_SEARCH_NEWS", {
        query,
        hl: language.toLowerCase().slice(0, 2),
        when: "m", // past month
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as unknown as NewsResponse;
    },
    1,
    500,
  );
}

/**
 * SEO — DataForSEO backlinks summary (retry ×2, 1s exponentiel)
 * Retourne rank DataForSEO + backlinks + referring_domains
 * Utilisé par modules/seo.ts (cache 30j)
 */
export async function getKeywordData(
  domain: string,
  _country: string,
): Promise<KeywordDataResponse> {
  return withRetry(
    async () => {
      const data = await execute("DATAFORSEO_GET_BACKLINKS_SUMMARY_LIVE", {
        target: domain,
        include_subdomains: true,
      });
      // DataForSEO wraps les résultats dans tasks[0].result[0]
      const tasks = data["tasks"] as
        | Array<{ result?: KeywordDataResponse[] }>
        | undefined;
      const result = tasks?.[0]?.result?.[0];
      if (!result) throw new Error("DataForSEO: empty result");
      return result;
    },
    2,
    1000,
  );
}

/**
 * YouTube search — YouTube Data API v3 (pas de retry, géré par le module)
 * Utilisé par modules/youtube.ts (max 3 appels de recherche)
 */
export async function searchYoutube(
  query: string,
): Promise<YoutubeSearchResponse> {
  const data = await execute("YOUTUBE_SEARCH_YOU_TUBE", {
    q: query,
    type: "video",
    maxResults: 10,
    part: "snippet",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as unknown as YoutubeSearchResponse;
}

/**
 * YouTube comments — max 10 commentaires par vidéo
 * Utilisé par modules/youtube.ts pour analyse sentiment
 */
export async function getYoutubeComments(
  videoId: string,
  maxResults = 10,
): Promise<YoutubeCommentsResponse> {
  const data = await execute("YOUTUBE_LIST_COMMENT_THREADS2", {
    videoId,
    part: "snippet",
    maxResults,
    order: "relevance",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as unknown as YoutubeCommentsResponse;
}

/**
 * Social — Apify actor tasks (pas de retry, degraded si tâche non configurée)
 * Plateformes supportées : instagram, twitter, tiktok
 * Pas de tâche LinkedIn — module social gère le fallback
 */
export async function socialSearch(
  query: string,
  platform: string,
): Promise<SocialResponse> {
  const envVar = APIFY_TASK_ENV[platform.toLowerCase()];
  if (!envVar) {
    throw new Error(`No Apify task configured for platform: ${platform}`);
  }

  const taskId = process.env[envVar];
  if (!taskId) {
    throw new Error(`Env var ${envVar} is not set`);
  }

  const data = await execute("APIFY_ACTOR_TASK_RUN_SYNC_GET_DATASET_ITEMS_POST", {
    actorTaskId: taskId,
    inputOverrides: { query, maxItems: 20 },
    limit: 20,
    waitForFinish: 60,
  });

  // Apify retourne un tableau ou un objet { items: [...] }
  if (Array.isArray(data)) {
    return { items: data as SocialPostItem[] };
  }
  const items = (data["items"] as SocialPostItem[] | undefined) ?? [];
  return { items };
}
