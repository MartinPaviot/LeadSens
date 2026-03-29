import { ToolUnavailableError } from '../types';

export interface GscPage {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscKeyword {
  keyword: string;
  url: string;
  clicks: number;
  impressions: number;
  position: number;
}

export async function getTopPages(
  siteUrl: string,
  userId: string,
  limit = 50,
): Promise<GscPage[]> {
  try {
    // Google Search Console API — top pages by clicks
    return []; // stub
  } catch {
    throw new ToolUnavailableError('gsc:pages', 'core/tools');
  }
}

export async function getLowHangingFruit(
  siteUrl: string,
  userId: string,
): Promise<GscKeyword[]> {
  try {
    // GSC — keywords in position 4-15 ("fruits mûrs")
    return []; // stub
  } catch {
    throw new ToolUnavailableError('gsc:lowHangingFruit', 'core/tools');
  }
}
