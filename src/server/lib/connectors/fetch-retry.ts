/**
 * Shared fetch helper with exponential backoff retry.
 *
 * Retries on 429 (rate limit) and 5xx (server errors).
 * Same pattern as instantly.ts but extracted for reuse across connectors.
 */

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface FetchRetryOptions {
  /** Connector name for error messages */
  name: string;
  /** Base URL */
  baseUrl: string;
  /** Default headers applied to every request */
  defaultHeaders?: Record<string, string>;
  /** Timeout in ms (default 30s) */
  timeout?: number;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  /** Extra headers for this request only */
  headers?: Record<string, string>;
}

/**
 * Creates a connector-specific fetch function with retry and backoff.
 *
 * Usage:
 *   const wpFetch = createFetchWithRetry({ name: "Woodpecker", baseUrl: "https://api.woodpecker.co/rest/v2", defaultHeaders: { "x-api-key": apiKey } });
 *   const data = await wpFetch("/campaigns", { method: "POST", body: { name: "test" } });
 */
export function createFetchWithRetry(options: FetchRetryOptions) {
  const { name, baseUrl, defaultHeaders = {}, timeout = 30_000 } = options;

  return async function fetchWithRetry(path: string, reqOptions?: RequestOptions): Promise<unknown> {
    const method = reqOptions?.method ?? "GET";
    const body = reqOptions?.body;
    const extraHeaders = reqOptions?.headers ?? {};

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            ...defaultHeaders,
            ...extraHeaders,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (err) {
        // Network error or timeout — retry if attempts remain
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * BASE_DELAY_MS));
          continue;
        }
        throw new Error(`${name} ${method} ${path} failed: ${err instanceof Error ? err.message : "network error"}`);
      }

      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType?.includes("application/json")) return {};
        return res.json();
      }

      // Retry on 429 or 5xx
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        // Use Retry-After header if present, else exponential backoff
        const retryAfter = res.headers.get("retry-after");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * BASE_DELAY_MS;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const text = await res.text().catch(() => "");
      throw new Error(`${name} ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
    }

    throw new Error(`${name} ${method} ${path} failed after ${MAX_RETRIES} retries`);
  };
}

/**
 * Sleep utility for rate-limiting between sequential API calls.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Default delay between single verification calls in batch mode.
 * Conservative: 200ms = max 5 req/s, well under most verifier limits.
 */
export const BATCH_VERIFY_DELAY_MS = 200;
