import { ToolUnavailableError, CmsCorrection } from '../../types';

// ─── Types ────────────────────────────────────────────────

export interface WordPressCredentials {
  siteUrl: string;              // ex: https://monsite.fr
  username: string;             // WordPress username
  applicationPassword: string;  // Generated from WP Admin → Users → Application Passwords
}

export interface WordPressPage {
  id: number;
  url: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  status: 'publish' | 'draft' | 'private';
  slug: string;
}

export interface WordPressImage {
  id: number;
  url: string;
  altText: string;
  filename: string;
}

// ─── Auth ─────────────────────────────────────────────────

function wpBasicAuth(creds: WordPressCredentials): string {
  return (
    'Basic ' +
    Buffer.from(`${creds.username}:${creds.applicationPassword}`).toString('base64')
  );
}

async function wpFetch<T>(
  creds: WordPressCredentials,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!creds.siteUrl || !creds.siteUrl.startsWith('http')) {
    throw new Error('WordPress siteUrl must be a valid URL starting with http');
  }
  const base = creds.siteUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/wp-json/wp/v2${path}`, {
    ...options,
    headers: {
      'Authorization': wpBasicAuth(creds),
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`WordPress API failed: HTTP ${res.status}`);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error('WordPress API returned non-JSON response: HTTP ' + res.status);

  return res.json() as Promise<T>;
}

// ─── Read pages ───────────────────────────────────────────

export async function wpGetPages(
  creds: WordPressCredentials,
  limit = 100,
): Promise<WordPressPage[]> {
  try {
    type RawPage = {
      id: number;
      link: string;
      slug: string;
      status: string;
      title: { rendered: string };
      yoast_head_json?: {
        title?: string;
        description?: string;
      };
    };

    const pages = await wpFetch<RawPage[]>(
      creds,
      `/pages?per_page=${limit}&_fields=id,link,slug,status,title,yoast_head_json`,
    );

    return pages.map((p) => ({
      id: p.id,
      url: p.link,
      title: p.title.rendered,
      metaTitle: p.yoast_head_json?.title ?? p.title.rendered,
      metaDescription: p.yoast_head_json?.description ?? '',
      status: p.status as WordPressPage['status'],
      slug: p.slug,
    }));
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:getPages', 'core/tools/cms');
  }
}

export async function wpGetPosts(
  creds: WordPressCredentials,
  limit = 100,
): Promise<WordPressPage[]> {
  try {
    type RawPost = {
      id: number;
      link: string;
      slug: string;
      status: string;
      title: { rendered: string };
      yoast_head_json?: {
        title?: string;
        description?: string;
      };
    };

    const posts = await wpFetch<RawPost[]>(
      creds,
      `/posts?per_page=${limit}&_fields=id,link,slug,status,title,yoast_head_json`,
    );

    return posts.map((p) => ({
      id: p.id,
      url: p.link,
      title: p.title.rendered,
      metaTitle: p.yoast_head_json?.title ?? p.title.rendered,
      metaDescription: p.yoast_head_json?.description ?? '',
      status: p.status as WordPressPage['status'],
      slug: p.slug,
    }));
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:getPosts', 'core/tools/cms');
  }
}

// ─── Create page as draft ────────────────────────────────

export async function wpCreatePage(
  creds: WordPressCredentials,
  title: string,
  content: string,
  metaTitle?: string,
  metaDescription?: string,
): Promise<{ id: number; url: string; editUrl: string }> {
  try {
    type RawPage = { id: number; link: string };
    const page = await wpFetch<RawPage>(
      creds,
      '/pages',
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          status: 'draft',
          ...(metaTitle || metaDescription ? {
            meta: {
              ...(metaTitle ? { _yoast_wpseo_title: metaTitle } : {}),
              ...(metaDescription ? { _yoast_wpseo_metadesc: metaDescription } : {}),
            },
          } : {}),
        }),
      },
    );

    const base = creds.siteUrl.replace(/\/$/, '');
    return {
      id: page.id,
      url: page.link,
      editUrl: `${base}/wp-admin/post.php?post=${page.id}&action=edit`,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:createPage', 'core/tools/cms');
  }
}

// ─── Create post as draft ────────────────────────────────

export async function wpCreatePost(
  creds: WordPressCredentials,
  title: string,
  content: string,
  metaTitle?: string,
  metaDescription?: string,
): Promise<{ id: number; url: string; editUrl: string }> {
  try {
    type RawPost = { id: number; link: string };
    const post = await wpFetch<RawPost>(
      creds,
      '/posts',
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          status: 'draft',
          ...(metaTitle || metaDescription ? {
            meta: {
              ...(metaTitle ? { _yoast_wpseo_title: metaTitle } : {}),
              ...(metaDescription ? { _yoast_wpseo_metadesc: metaDescription } : {}),
            },
          } : {}),
        }),
      },
    );

    const base = creds.siteUrl.replace(/\/$/, '');
    return {
      id: post.id,
      url: post.link,
      editUrl: `${base}/wp-admin/post.php?post=${post.id}&action=edit`,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:createPost', 'core/tools/cms');
  }
}

// ─── Publish a draft page ─────────────────────────────────

export async function wpPublishPage(
  creds: WordPressCredentials,
  pageId: number,
): Promise<{ id: number; url: string }> {
  try {
    type RawPage = { id: number; link: string };
    const page = await wpFetch<RawPage>(
      creds,
      `/pages/${pageId}`,
      { method: 'POST', body: JSON.stringify({ status: 'publish' }) },
    );
    return { id: page.id, url: page.link };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:publishPage', 'core/tools/cms');
  }
}

// ─── Publish a draft post ─────────────────────────────────

export async function wpPublishPost(
  creds: WordPressCredentials,
  postId: number,
): Promise<{ id: number; url: string }> {
  try {
    type RawPost = { id: number; link: string };
    const post = await wpFetch<RawPost>(
      creds,
      `/posts/${postId}`,
      { method: 'POST', body: JSON.stringify({ status: 'publish' }) },
    );
    return { id: post.id, url: post.link };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:publishPost', 'core/tools/cms');
  }
}

// ─── Delete a draft ───────────────────────────────────────

export async function wpDeleteDraft(
  creds: WordPressCredentials,
  postId: number,
  postType: 'pages' | 'posts' = 'posts',
): Promise<void> {
  try {
    await wpFetch(
      creds,
      `/${postType}/${postId}`,
      { method: 'DELETE', body: JSON.stringify({ force: false }) },
    );
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:deleteDraft', 'core/tools/cms');
  }
}

// ─── Update meta (Yoast SEO) ──────────────────────────────

export async function wpUpdateMeta(
  creds: WordPressCredentials,
  pageId: number,
  metaTitle: string,
  metaDescription: string,
  postType: 'pages' | 'posts' = 'pages',
): Promise<CmsCorrection> {
  try {
    await wpFetch(
      creds,
      `/${postType}/${pageId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          meta: {
            // Yoast SEO meta fields
            _yoast_wpseo_title: metaTitle,
            _yoast_wpseo_metadesc: metaDescription,
          },
        }),
      },
    );

    return {
      url: `${creds.siteUrl}/?p=${pageId}`,
      field: 'meta',
      oldValue: '',
      newValue: JSON.stringify({ metaTitle, metaDescription }),
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:updateMeta', 'core/tools/cms');
  }
}

// ─── Update canonical (Yoast SEO) ───────────────────────

export async function wpUpdateCanonical(
  creds: WordPressCredentials,
  pageId: number,
  canonicalUrl: string,
  postType: 'pages' | 'posts' = 'pages',
): Promise<CmsCorrection> {
  try {
    await wpFetch(
      creds,
      `/${postType}/${pageId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          meta: {
            _yoast_wpseo_canonical: canonicalUrl,
          },
        }),
      },
    );

    return {
      url: `${creds.siteUrl}/?p=${pageId}`,
      field: 'canonical',
      oldValue: '',
      newValue: canonicalUrl,
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:updateCanonical', 'core/tools/cms');
  }
}

// ─── Update redirect ──────────────────────────────────────
// Requires the Redirection plugin (wordpress.org/plugins/redirection)
// or Yoast Premium. Will 404 if neither is installed.

export async function wpAddRedirect(
  creds: WordPressCredentials,
  fromPath: string,
  toUrl: string,
): Promise<CmsCorrection> {
  try {
    // Redirection plugin REST API endpoint
    await wpFetch(
      creds,
      '/redirection/v1/redirect',
      {
        method: 'POST',
        body: JSON.stringify({
          url: fromPath,
          action_data: { url: toUrl },
          action_type: 'url',
          match_type: 'url',
          status: 'enabled',
        }),
      },
    );

    return {
      url: fromPath,
      field: 'redirect',
      oldValue: fromPath,
      newValue: toUrl,
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:addRedirect', 'core/tools/cms');
  }
}

// ─── Update image ALT text ────────────────────────────────

export async function wpUpdateImageAlt(
  creds: WordPressCredentials,
  mediaId: number,
  altText: string,
): Promise<CmsCorrection> {
  try {
    type RawMedia = { source_url: string };
    const media = await wpFetch<RawMedia>(
      creds,
      `/media/${mediaId}`,
      {
        method: 'POST',
        body: JSON.stringify({ alt_text: altText }),
      },
    );

    return {
      url: media.source_url,
      field: 'alt_text',
      oldValue: '',
      newValue: altText,
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:updateImageAlt', 'core/tools/cms');
  }
}

// ─── Get all images ───────────────────────────────────────

export async function wpGetImages(
  creds: WordPressCredentials,
  limit = 100,
): Promise<WordPressImage[]> {
  try {
    type RawMedia = {
      id: number;
      source_url: string;
      alt_text: string;
      slug: string;
    };

    const media = await wpFetch<RawMedia[]>(
      creds,
      `/media?per_page=${limit}&media_type=image&_fields=id,source_url,alt_text,slug`,
    );

    return media.map((m) => ({
      id: m.id,
      url: m.source_url,
      altText: m.alt_text,
      filename: m.slug,
    }));
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('wordpress:getImages', 'core/tools/cms');
  }
}

// ─── Ping sitemap ─────────────────────────────────────────

export async function wpPingSitemap(
  creds: WordPressCredentials,
): Promise<void> {
  try {
    const base = creds.siteUrl.replace(/\/$/, '');
    await fetch(
      `https://www.google.com/ping?sitemap=${base}/sitemap_index.xml`,
    );
  } catch {
    // Non-blocking — sitemap ping failure never throws
    console.warn('[wordpress] Sitemap ping failed — non-blocking');
  }
}
