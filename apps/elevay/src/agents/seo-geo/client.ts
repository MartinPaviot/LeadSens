// SEO-GEO agent streaming client
// Mirrors the BMI pattern — one streaming function per agent

export async function streamTsi07Audit(
  conversationId: string,
  siteUrl: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/tsi-07', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl }),
  });
  await consumeSse(res, onChunk);
}

export async function streamKga08Audit(
  conversationId: string,
  siteUrl: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/kga-08', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl }),
  });
  await consumeSse(res, onChunk);
}

export async function streamOpt06Audit(
  conversationId: string,
  siteUrl: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/opt-06', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl }),
  });
  await consumeSse(res, onChunk);
}

export async function streamPio05Audit(
  conversationId: string,
  siteUrl: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/pio-05', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl }),
  });
  await consumeSse(res, onChunk);
}

export async function streamMdg11Audit(
  conversationId: string,
  siteUrl: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/mdg-11', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl }),
  });
  await consumeSse(res, onChunk);
}

export async function streamAlt12Audit(
  conversationId: string,
  siteUrl: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/alt-12', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl }),
  });
  await consumeSse(res, onChunk);
}

// ─── Shared SSE consumer ──────────────────────────────────
// Reads raw bytes from the response body and feeds them to the onChunk callback.
// The caller is responsible for parsing SSE events (e.g. via eventsource-parser).

async function consumeSse(
  res: Response,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!res.ok || !res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
