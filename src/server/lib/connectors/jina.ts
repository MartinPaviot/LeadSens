const JINA_BASE = "https://r.jina.ai";

export interface JinaResult {
  ok: true;
  markdown: string;
}

export interface JinaError {
  ok: false;
  reason: "not_found" | "timeout" | "rate_limit" | "network" | "empty";
  message: string;
}

/**
 * Scrapes a URL via Jina Reader and returns clean markdown.
 * Returns a structured result so callers can decide how to handle failures.
 */
export async function scrapeViaJina(
  url: string,
): Promise<JinaResult | JinaError> {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      headers: { Accept: "text/markdown" },
      signal: AbortSignal.timeout(20_000),
    });

    if (res.status === 422) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: "not_found", message: `URL inaccessible: ${body}` };
    }
    if (res.status === 429) {
      return { ok: false, reason: "rate_limit", message: "Jina rate limit (20 req/min)" };
    }
    if (!res.ok) {
      return { ok: false, reason: "network", message: `Jina HTTP ${res.status}` };
    }

    const md = await res.text();
    if (!md || md.trim().length < 50) {
      return { ok: false, reason: "empty", message: "Page returned too little content" };
    }

    return { ok: true, markdown: md.slice(0, 8000) };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { ok: false, reason: "timeout", message: "Jina timeout (20s)" };
    }
    return {
      ok: false,
      reason: "network",
      message: err instanceof Error ? err.message : "Unknown network error",
    };
  }
}
