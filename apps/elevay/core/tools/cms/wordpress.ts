import { ToolUnavailableError, CmsCorrection } from '../../types';

export async function updateMeta(
  siteUrl: string,
  pageId: number,
  metaTitle: string,
  metaDescription: string,
  userId: string,
): Promise<CmsCorrection> {
  try {
    // WordPress REST API + Yoast/RankMath
    return {
      url: `${siteUrl}/?p=${pageId}`,
      field: 'meta',
      oldValue: '',
      newValue: JSON.stringify({ metaTitle, metaDescription }),
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch {
    throw new ToolUnavailableError('wordpress:meta', 'core/tools/cms');
  }
}

export async function updateRedirect(
  siteUrl: string,
  from: string,
  to: string,
  userId: string,
): Promise<CmsCorrection> {
  try {
    // WordPress REST API — 301 redirect via Yoast Premium or Redirection plugin
    return {
      url: from,
      field: 'redirect',
      oldValue: '',
      newValue: to,
      autoFixable: true,
      appliedAt: new Date(),
    };
  } catch {
    throw new ToolUnavailableError('wordpress:redirect', 'core/tools/cms');
  }
}
