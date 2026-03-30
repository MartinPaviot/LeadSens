import { ToolUnavailableError, CmsCorrection } from '../../types';

// ─── Types ────────────────────────────────────────────────

export interface HubSpotCredentials {
  portalId: string;          // HubSpot portal/account ID
  accessToken: string;       // Private app access token
}

export interface HubSpotPage {
  id: string;
  url: string;
  title: string;
  metaDescription: string;
  slug: string;
  state: 'PUBLISHED' | 'DRAFT';
  type: 'page' | 'post';
}

// ─── Auth ─────────────────────────────────────────────────

async function hubFetch<T>(
  creds: HubSpotCredentials,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`HubSpot API failed: HTTP ${res.status}`);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error('HubSpot API returned non-JSON response: HTTP ' + res.status);

  return res.json() as Promise<T>;
}

// ─── Read pages + posts ───────────────────────────────────

export async function hubGetPageMap(
  creds: HubSpotCredentials,
): Promise<Map<string, { id: string; type: 'page' | 'post' }>> {
  if (!creds.portalId) throw new Error('HubSpot portalId is required');
  const map = new Map<string, { id: string; type: 'page' | 'post' }>();

  try {
    // Fetch site pages (paginated, max 100 per request)
    type RawPage = { id: string; url: string; slug: string; name: string; metaDescription: string; state: string };
    type PageResponse = { results: RawPage[]; paging?: { next?: { after: string } } };

    let after: string | undefined;
    let pageCount = 0;
    do {
      const query = after ? `?limit=100&after=${after}` : '?limit=100';
      const response = await hubFetch<PageResponse>(creds, `/cms/v3/pages/site-pages${query}`);
      if (response.results.length === 0) break;
      for (const p of response.results) {
        const url = p.url || `https://${creds.portalId}.hubspotpagebuilder.com/${p.slug}`;
        map.set(normalizeUrl(url), { id: p.id, type: 'page' });
      }
      after = response.paging?.next?.after;
      pageCount += response.results.length;
    } while (after && pageCount < 200);

    // Fetch blog posts
    let postAfter: string | undefined;
    let postCount = 0;
    do {
      const query = postAfter ? `?limit=100&after=${postAfter}` : '?limit=100';
      const response = await hubFetch<PageResponse>(creds, `/cms/v3/blogs/posts${query}`);
      if (response.results.length === 0) break;
      for (const p of response.results) {
        const url = p.url || `https://${creds.portalId}.hubspotpagebuilder.com/blog/${p.slug}`;
        map.set(normalizeUrl(url), { id: p.id, type: 'post' });
      }
      postAfter = response.paging?.next?.after;
      postCount += response.results.length;
    } while (postAfter && postCount < 200);
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('hubspot:getPageMap', 'core/tools/cms');
  }

  return map;
}

// ─── Update meta (title, description, canonical) ─────────

export async function hubUpdateMeta(
  creds: HubSpotCredentials,
  pageId: string,
  meta: { title?: string; metaDescription?: string; canonical?: string },
  contentType: 'page' | 'post' = 'page',
): Promise<CmsCorrection> {
  try {
    const endpoint = contentType === 'post'
      ? `/cms/v3/blogs/posts/${pageId}`
      : `/cms/v3/pages/site-pages/${pageId}`;

    const body: Record<string, string> = {};
    if (meta.title) body.htmlTitle = meta.title;
    if (meta.metaDescription) body.metaDescription = meta.metaDescription;
    if (meta.canonical) body.linkRelCanonicalUrl = meta.canonical;

    await hubFetch(creds, endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    return {
      url: pageId,
      field: 'meta',
      oldValue: '',
      newValue: JSON.stringify(meta),
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('hubspot:updateMeta', 'core/tools/cms');
  }
}

// ─── Create page as draft ────────────────────────────────

export async function hubCreatePage(
  creds: HubSpotCredentials,
  data: { title: string; content: string; slug: string; metaDescription?: string },
): Promise<{ id: string; url: string; editUrl: string }> {
  if (!creds.portalId) throw new Error('HubSpot portalId is required');
  try {
    type RawResult = { id: string; url: string };
    const result = await hubFetch<RawResult>(creds, '/cms/v3/pages/site-pages', {
      method: 'POST',
      body: JSON.stringify({
        name: data.title,
        htmlTitle: data.title,
        slug: data.slug,
        layoutSections: {},
        widgets: {},
        state: 'DRAFT',
        htmlContent: data.content,
        ...(data.metaDescription ? { metaDescription: data.metaDescription } : {}),
      }),
    });

    return {
      id: result.id,
      url: result.url || '',
      editUrl: `https://app.hubspot.com/pages/${creds.portalId}/editor/${result.id}`,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('hubspot:createPage', 'core/tools/cms');
  }
}

// ─── Create blog post as draft ───────────────────────────

export async function hubCreatePost(
  creds: HubSpotCredentials,
  data: { title: string; content: string; slug: string; metaDescription?: string; tags?: string[] },
): Promise<{ id: string; url: string; editUrl: string }> {
  try {
    type RawResult = { id: string; url: string };
    const result = await hubFetch<RawResult>(creds, '/cms/v3/blogs/posts', {
      method: 'POST',
      body: JSON.stringify({
        name: data.title,
        htmlTitle: data.title,
        slug: data.slug,
        postBody: data.content,
        state: 'DRAFT',
        ...(data.metaDescription ? { metaDescription: data.metaDescription } : {}),
        ...(data.tags ? { tagIds: data.tags } : {}),
      }),
    });

    return {
      id: result.id,
      url: result.url || '',
      editUrl: `https://app.hubspot.com/blog/${creds.portalId}/editor/${result.id}`,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('hubspot:createPost', 'core/tools/cms');
  }
}

// ─── Update image alt text ───────────────────────────────

export async function hubUpdateImageAlt(
  creds: HubSpotCredentials,
  fileId: string,
  altText: string,
): Promise<CmsCorrection> {
  try {
    type RawFile = { url: string };
    const file = await hubFetch<RawFile>(creds, `/filemanager/api/v3/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ alt: altText }),
    });

    return {
      url: file.url ?? fileId,
      field: 'alt_text',
      oldValue: '',
      newValue: altText,
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('hubspot:updateImageAlt', 'core/tools/cms');
  }
}

// ─── File map (for ALT-12 image injection) ──────────────

export async function hubGetFileMap(
  creds: HubSpotCredentials,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    type RawFile = { id: string; url: string; name: string };
    type FileResponse = { objects: RawFile[]; totalCount: number };

    let offset = 0;
    let fetched = 0;
    do {
      const response = await hubFetch<FileResponse>(
        creds,
        `/filemanager/api/v3/files?limit=100&offset=${offset}`,
      );

      for (const f of response.objects) {
        // Key by full URL (lowercased)
        if (f.url) map.set(f.url.toLowerCase(), f.id);
        // Also key by filename (last path segment) for fuzzy matching
        const filename = f.name || f.url?.split('/').pop() || '';
        if (filename) map.set(filename.toLowerCase(), f.id);
      }

      fetched += response.objects.length;
      offset += 100;
    } while (fetched < 500 && offset < 500);
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('hubspot:getFileMap', 'core/tools/cms');
  }

  return map;
}

// ─── Helper ──────────────────────────────────────────────

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}
