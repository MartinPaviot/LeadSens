import { ToolUnavailableError, CmsCorrection } from '../../types';

// ─── Types ────────────────────────────────────────────────

export interface ShopifyCredentials {
  storeDomain: string;         // ex: mystore.myshopify.com
  accessToken: string;         // Admin API access token
}

type ShopifyResourceType = 'page' | 'product' | 'blog';

// ─── Auth ─────────────────────────────────────────────────

const SHOPIFY_API_VERSION = '2024-01';

function shopifyBaseUrl(creds: ShopifyCredentials): string {
  const domain = creds.storeDomain.replace(/\/+$/, '');
  return domain.includes('myshopify.com')
    ? `https://${domain}`
    : `https://${domain}.myshopify.com`;
}

async function shopFetch<T>(
  creds: ShopifyCredentials,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = shopifyBaseUrl(creds);

  const res = await fetch(`${base}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': creds.accessToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Shopify API failed: HTTP ${res.status}`);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error('Shopify API returned non-JSON response: HTTP ' + res.status);

  return res.json() as Promise<T>;
}

// ─── Update meta (title, description) ────────────────────
// Note: Shopify Admin API does not support canonical — skipped silently.

export async function shopifyUpdateMeta(
  creds: ShopifyCredentials,
  resourceType: ShopifyResourceType,
  id: number,
  meta: { title?: string; metaDescription?: string },
): Promise<CmsCorrection> {
  try {
    const resourcePath = getResourcePath(resourceType);

    // Build the update body based on resource type
    const body: Record<string, unknown> = {};
    const resourceKey = resourceType === 'blog' ? 'article' : resourceType;

    const fields: Record<string, unknown> = { id };
    if (meta.title) fields.title = meta.title;

    // Meta description goes into metafields for pages/products
    if (meta.metaDescription) {
      fields.metafields = [{
        namespace: 'global',
        key: 'description_tag',
        value: meta.metaDescription,
        type: 'single_line_text_field',
      }];
    }

    body[resourceKey] = fields;

    await shopFetch(creds, `/${resourcePath}/${id}.json`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    return {
      url: `shopify://${resourceType}/${id}`,
      field: 'meta',
      oldValue: '',
      newValue: JSON.stringify(meta),
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('shopify:updateMeta', 'core/tools/cms');
  }
}

// ─── Create page as unpublished ──────────────────────────

export async function shopifyCreatePage(
  creds: ShopifyCredentials,
  data: { title: string; content: string; metaDescription?: string },
): Promise<{ id: number; url: string; editUrl: string }> {
  try {
    type RawResult = { page: { id: number; handle: string } };
    const result = await shopFetch<RawResult>(creds, '/pages.json', {
      method: 'POST',
      body: JSON.stringify({
        page: {
          title: data.title,
          body_html: data.content,
          published: false,
          ...(data.metaDescription ? {
            metafields: [{
              namespace: 'global',
              key: 'description_tag',
              value: data.metaDescription,
              type: 'single_line_text_field',
            }],
          } : {}),
        },
      }),
    });

    const baseUrl = shopifyBaseUrl(creds);
    return {
      id: result.page.id,
      url: `${baseUrl}/pages/${result.page.handle}`,
      editUrl: `${baseUrl}/admin/pages/${result.page.id}`,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('shopify:createPage', 'core/tools/cms');
  }
}

// ─── Update image alt text ───────────────────────────────

export async function shopifyUpdateImageAlt(
  creds: ShopifyCredentials,
  productId: number,
  imageId: number,
  altText: string,
): Promise<CmsCorrection> {
  try {
    await shopFetch(creds, `/products/${productId}/images/${imageId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        image: { id: imageId, alt: altText },
      }),
    });

    return {
      url: `shopify://product/${productId}/image/${imageId}`,
      field: 'alt_text',
      oldValue: '',
      newValue: altText,
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('shopify:updateImageAlt', 'core/tools/cms');
  }
}

// ─── Page map (URL → { type, id }) ───────────────────────

export async function shopifyGetPageMap(
  creds: ShopifyCredentials,
): Promise<Map<string, { type: 'page' | 'product'; id: number }>> {
  const map = new Map<string, { type: 'page' | 'product'; id: number }>();
  const baseUrl = shopifyBaseUrl(creds);

  try {
    // Fetch all pages
    await paginateShopify<{ pages: { id: number; handle: string }[] }>(
      creds,
      '/pages.json?limit=250&fields=id,handle',
      (data) => {
        for (const p of data.pages) {
          map.set(normalizeUrl(`${baseUrl}/pages/${p.handle}`), { type: 'page', id: p.id });
        }
      },
    );

    // Fetch all products
    await paginateShopify<{ products: { id: number; handle: string }[] }>(
      creds,
      '/products.json?limit=250&fields=id,handle',
      (data) => {
        for (const p of data.products) {
          map.set(normalizeUrl(`${baseUrl}/products/${p.handle}`), { type: 'product', id: p.id });
        }
      },
    );
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('shopify:getPageMap', 'core/tools/cms');
  }

  return map;
}

// ─── Image map (imageUrl → { productId, imageId }) ───────

export async function shopifyGetImageMap(
  creds: ShopifyCredentials,
): Promise<Map<string, { productId: number; imageId: number }>> {
  const map = new Map<string, { productId: number; imageId: number }>();

  try {
    await paginateShopify<{ products: { id: number; images: { id: number; src: string }[] }[] }>(
      creds,
      '/products.json?limit=250&fields=id,images',
      (data) => {
        for (const product of data.products) {
          for (const img of product.images) {
            map.set(normalizeUrl(img.src), { productId: product.id, imageId: img.id });
          }
        }
      },
    );
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('shopify:getImageMap', 'core/tools/cms');
  }

  return map;
}

// ─── Helpers ─────────────────────────────────────────────

function getResourcePath(resourceType: ShopifyResourceType): string {
  switch (resourceType) {
    case 'page': return 'pages';
    case 'product': return 'products';
    case 'blog': return 'articles';
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

/**
 * Paginate a Shopify Admin API endpoint using Link header pagination.
 * Calls `onPage` for each page of results.
 */
async function paginateShopify<T>(
  creds: ShopifyCredentials,
  initialPath: string,
  onPage: (data: T) => void,
): Promise<void> {
  const base = shopifyBaseUrl(creds);

  let path: string | null = initialPath;
  let pageCount = 0;

  while (path && pageCount < 50) {
    const url = path.startsWith('http') ? path : `${base}/admin/api/${SHOPIFY_API_VERSION}${path}`;
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': creds.accessToken,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Shopify API failed: HTTP ${res.status}`);

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) throw new Error('Shopify API returned non-JSON response: HTTP ' + res.status);

    const data = await res.json() as T;
    onPage(data);

    // Parse Link header for next page
    path = parseNextLink(res.headers.get('Link'));
    pageCount++;
  }

  if (pageCount >= 50 && path) {
    console.warn('[shopify] Pagination cap reached — some items may be missing');
  }
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
  return match?.[1] ?? null;
}
