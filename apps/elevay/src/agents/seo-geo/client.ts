import type { SeoAgentProfile } from './types';
import { checkNoConfig, type NoConfigInfo } from '@/lib/no-config-check';

export type { NoConfigInfo } from '@/lib/no-config-check';

export async function streamTsi07Audit(
  conversationId: string,
  siteUrl: string,
  profile: SeoAgentProfile,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/tsi-07', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl, profile }),
  });
  await consumeSse(res, onChunk);
}

export async function streamKga08Audit(
  conversationId: string,
  siteUrl: string,
  profile: SeoAgentProfile,
  onChunk: (chunk: string) => void,
  seedKeywords?: string[],
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/kga-08', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl, profile, seedKeywords }),
  });
  await consumeSse(res, onChunk);
}

export async function streamOpt06Audit(
  conversationId: string,
  siteUrl: string,
  profile: SeoAgentProfile,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/opt-06', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl, profile }),
  });
  await consumeSse(res, onChunk);
}

export async function streamPio05Audit(
  conversationId: string,
  siteUrl: string,
  profile: SeoAgentProfile,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/pio-05', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl, profile }),
  });
  await consumeSse(res, onChunk);
}

export async function streamMdg11Audit(
  conversationId: string,
  siteUrl: string,
  profile: SeoAgentProfile,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/mdg-11', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl, profile }),
  });
  await consumeSse(res, onChunk);
}

export async function streamAlt12Audit(
  conversationId: string,
  siteUrl: string,
  profile: SeoAgentProfile,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/alt-12', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, siteUrl, profile }),
  });
  await consumeSse(res, onChunk);
}

export async function streamWpw09Page(
  conversationId: string,
  profile: SeoAgentProfile,
  params: {
    pageType: string;
    brief: string;
    brandTone: string;
    targetAudience: string;
    internalLinksAvailable: string[];
    exportFormat: string;
    targetKeywords?: string[];
  },
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/wpw09', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, profile, ...params }),
  });
  await consumeSse(res, onChunk);
}

export async function streamBsw10Article(
  conversationId: string,
  profile: SeoAgentProfile,
  params: {
    topic: string;
    mode: string;
    articleFormat: string;
    targetAudience: string;
    expertiseLevel: string;
    objective: string;
    brandTone: string;
    cta: string;
    internalLinksAvailable: string[];
    targetKeywords?: string[];
    calendarDuration?: 30 | 60 | 90;
  },
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/agents/seo-geo/bsw10', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, profile, ...params }),
  });
  await consumeSse(res, onChunk);
}

// ─── Shared SSE consumer ──────────────────────────────────
// Reads raw bytes from the response body and feeds them to the onChunk callback.
// The caller is responsible for parsing SSE events (e.g. via eventsource-parser).

export class NoConfigError extends Error {
  readonly info: NoConfigInfo;
  constructor(info: NoConfigInfo) {
    super('NO_CONFIG')
    this.name = 'NoConfigError'
    this.info = info
  }
}

async function consumeSse(
  res: Response,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!res.ok) {
    const noConfig = await checkNoConfig(res);
    if (noConfig) throw new NoConfigError(noConfig);
    return;
  }
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
