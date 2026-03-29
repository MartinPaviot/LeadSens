/**
 * GSC — thin adapter over core/tools/composio.ts
 * Direct DataForSEO calls removed — all GSC data goes through Composio OAuth.
 * These exports maintain backward compatibility with agent imports.
 */

export {
  gscGetTopPages as getTopPages,
  gscGetLowHangingFruit as getLowHangingFruit,
} from './composio';

// Re-export types expected by agents
export type GscPage = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscKeyword = {
  keyword: string;
  url: string;
  position: number;
  impressions: number;
  clicks: number;
};
