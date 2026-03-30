import { ToolUnavailableError, CmsCorrection } from '../../types';

// ─── Types ────────────────────────────────────────────────

export interface WebflowCredentials {
  accessToken: string;
  siteId?: string;           // optional — auto-detected from first site if omitted
}

export interface WebflowSiteEntry {
  pageId?: string;
  collectionId?: string;
  itemId?: string;
  type: 'page' | 'blog';
}

// ─── Auth + fetch ─────────────────────────────────────────

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const RATE_LIMIT_DELAY_MS = 100;

async function wfFetch<T>(
  creds: WebflowCredentials,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${WEBFLOW_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Webflow API failed: HTTP ${res.status}`);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error('Webflow API returned non-JSON response: HTTP ' + res.status);

  return res.json() as Promise<T>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Resolve site ID ─────────────────────────────────────

async function resolveSiteId(creds: WebflowCredentials): Promise<string> {
  if (creds.siteId) return creds.siteId;

  type SitesResponse = { sites: { id: string }[] };
  const data = await wfFetch<SitesResponse>(creds, '/sites');
  const first = data.sites[0];
  if (!first) throw new ToolUnavailableError('webflow:noSite', 'core/tools/cms');
  return first.id;
}

// ─── Site map (URL → entry) ──────────────────────────────

export async function webflowGetSiteMap(
  creds: WebflowCredentials,
): Promise<Map<string, WebflowSiteEntry>> {
  const map = new Map<string, WebflowSiteEntry>();

  try {
    const siteId = await resolveSiteId(creds);

    // Fetch pages + collections in parallel
    type PagesResponse = { pages: { id: string; slug: string; title: string }[] };
    type CollectionsResponse = { collections: { id: string; slug: string; displayName: string }[] };

    const [pagesData, collectionsData] = await Promise.all([
      wfFetch<PagesResponse>(creds, `/sites/${siteId}/pages`),
      wfFetch<CollectionsResponse>(creds, `/sites/${siteId}/collections`),
    ]);
    await delay(RATE_LIMIT_DELAY_MS);

    for (const p of pagesData.pages) {
      map.set(normalizeUrl(`/${p.slug}`), { pageId: p.id, type: 'page' });
    }

    // Collections — find blog collection
    const blogPatterns = ['blog', 'posts', 'articles', 'actualites', 'actualités'];
    const blogCollection = collectionsData.collections.find((c) =>
      blogPatterns.some((p) => c.slug.toLowerCase().includes(p) || c.displayName.toLowerCase().includes(p)),
    );

    if (blogCollection) {
      // Paginate collection items
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        type ItemsResponse = {
          items: { id: string; fieldData: { slug?: string; name?: string } }[];
          pagination: { total: number; offset: number; limit: number };
        };
        const itemsData = await wfFetch<ItemsResponse>(
          creds,
          `/collections/${blogCollection.id}/items?offset=${offset}&limit=100`,
        );
        await delay(RATE_LIMIT_DELAY_MS);

        for (const item of itemsData.items) {
          const slug = item.fieldData.slug ?? item.id;
          map.set(normalizeUrl(`/${blogCollection.slug}/${slug}`), {
            collectionId: blogCollection.id,
            itemId: item.id,
            type: 'blog',
          });
        }

        offset += itemsData.pagination.limit;
        hasMore = offset < itemsData.pagination.total;
        if (offset >= 500) break; // safety cap
      }
    }
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('webflow:getSiteMap', 'core/tools/cms');
  }

  return map;
}

// ─── Update page meta ────────────────────────────────────

export async function webflowUpdatePageMeta(
  creds: WebflowCredentials,
  pageId: string,
  meta: { title?: string; metaDescription?: string },
): Promise<CmsCorrection> {
  try {
    const body: Record<string, string> = {};
    if (meta.title) {
      body.title = meta.title;
      body.openGraphTitle = meta.title;
    }
    if (meta.metaDescription) {
      body.metaDescription = meta.metaDescription;
      body.openGraphDescription = meta.metaDescription;
    }

    await wfFetch(creds, `/pages/${pageId}`, {
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
    throw new ToolUnavailableError('webflow:updatePageMeta', 'core/tools/cms');
  }
}

// ─── Update collection item meta ─────────────────────────

export async function webflowUpdateCollectionItemMeta(
  creds: WebflowCredentials,
  collectionId: string,
  itemId: string,
  meta: { title?: string; metaDescription?: string },
): Promise<CmsCorrection> {
  try {
    // Best effort: use standard CMS field slugs
    const fieldData: Record<string, string> = {};
    if (meta.title) fieldData.name = meta.title;
    if (meta.metaDescription) fieldData['meta-description'] = meta.metaDescription;

    await wfFetch(creds, `/collections/${collectionId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fieldData }),
    });

    return {
      url: `webflow://collection/${collectionId}/item/${itemId}`,
      field: 'meta',
      oldValue: '',
      newValue: JSON.stringify(meta),
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('webflow:updateCollectionItemMeta', 'core/tools/cms');
  }
}

// ─── Create page (CMS collection item as draft) ─────────

export async function webflowCreatePage(
  creds: WebflowCredentials,
  data: { title: string; content: string; slug: string; metaDescription?: string },
): Promise<{ id: string; url: string; editUrl: string }> {
  try {
    const siteId = await resolveSiteId(creds);

    // Find or use the first collection as a drafts target
    type CollectionsResponse = { collections: { id: string; slug: string; displayName: string }[] };
    const collectionsData = await wfFetch<CollectionsResponse>(creds, `/sites/${siteId}/collections`);
    await delay(RATE_LIMIT_DELAY_MS);

    // Prefer a 'pages' or 'drafts' collection, else fall back to first collection
    const pagesPatterns = ['pages', 'drafts', 'landing'];
    const targetCollection = collectionsData.collections.find((c) =>
      pagesPatterns.some((p) => c.slug.toLowerCase().includes(p)),
    ) ?? collectionsData.collections[0];

    if (!targetCollection) {
      throw new ToolUnavailableError('webflow:noCollection', 'core/tools/cms');
    }

    type RawItem = { id: string };
    const item = await wfFetch<RawItem>(
      creds,
      `/collections/${targetCollection.id}/items`,
      {
        method: 'POST',
        body: JSON.stringify({
          isDraft: true,
          fieldData: {
            name: data.title,
            slug: data.slug,
            'post-body': data.content,
            ...(data.metaDescription ? { 'meta-description': data.metaDescription } : {}),
          },
        }),
      },
    );

    return {
      id: item.id,
      url: `/${targetCollection.slug}/${data.slug}`,
      editUrl: `https://webflow.com/design/${siteId}?collectionId=${targetCollection.id}&itemId=${item.id}`,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('webflow:createPage', 'core/tools/cms');
  }
}

// ─── Create blog post (CMS collection item as draft) ─────

export async function webflowCreatePost(
  creds: WebflowCredentials,
  data: { title: string; content: string; slug: string; metaDescription?: string },
): Promise<{ id: string; url: string; editUrl: string }> {
  try {
    const siteId = await resolveSiteId(creds);

    type CollectionsResponse = { collections: { id: string; slug: string; displayName: string }[] };
    const collectionsData = await wfFetch<CollectionsResponse>(creds, `/sites/${siteId}/collections`);
    await delay(RATE_LIMIT_DELAY_MS);

    const blogPatterns = ['blog', 'posts', 'articles', 'actualites', 'actualités'];
    const blogCollection = collectionsData.collections.find((c) =>
      blogPatterns.some((p) => c.slug.toLowerCase().includes(p) || c.displayName.toLowerCase().includes(p)),
    );

    if (!blogCollection) {
      throw new ToolUnavailableError('webflow:noBlogCollection', 'core/tools/cms');
    }

    type RawItem = { id: string };
    const item = await wfFetch<RawItem>(
      creds,
      `/collections/${blogCollection.id}/items`,
      {
        method: 'POST',
        body: JSON.stringify({
          isDraft: true,
          fieldData: {
            name: data.title,
            slug: data.slug,
            'post-body': data.content,
            ...(data.metaDescription ? { 'meta-description': data.metaDescription } : {}),
          },
        }),
      },
    );

    return {
      id: item.id,
      url: `/${blogCollection.slug}/${data.slug}`,
      editUrl: `https://webflow.com/design/${siteId}?collectionId=${blogCollection.id}&itemId=${item.id}`,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('webflow:createPost', 'core/tools/cms');
  }
}

// ─── Image map (asset URL → asset ID) ────────────────────

export async function webflowGetImageMap(
  creds: WebflowCredentials,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    const siteId = await resolveSiteId(creds);

    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      type AssetsResponse = {
        assets: { id: string; url: string; fileName: string }[];
        pagination: { total: number; offset: number; limit: number };
      };
      const data = await wfFetch<AssetsResponse>(
        creds,
        `/sites/${siteId}/assets?offset=${offset}&limit=100`,
      );
      await delay(RATE_LIMIT_DELAY_MS);

      for (const asset of data.assets) {
        if (asset.url) map.set(normalizeUrl(asset.url), asset.id);
        // Also key by filename for fuzzy matching
        if (asset.fileName) map.set(asset.fileName.toLowerCase(), asset.id);
      }

      offset += data.pagination.limit;
      hasMore = offset < data.pagination.total;
      if (offset >= 500) break; // safety cap
    }
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('webflow:getImageMap', 'core/tools/cms');
  }

  return map;
}

// ─── Update image alt text ───────────────────────────────

export async function webflowUpdateImageAlt(
  creds: WebflowCredentials,
  assetId: string,
  altText: string,
): Promise<CmsCorrection | null> {
  try {
    const siteId = await resolveSiteId(creds);

    await wfFetch(creds, `/sites/${siteId}/assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ altText }),
    });

    return {
      url: assetId,
      field: 'alt_text',
      oldValue: '',
      newValue: altText,
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch {
    // Best effort — endpoint may not exist for all asset types
    return null;
  }
}

// ─── Helper ──────────────────────────────────────────────

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}
