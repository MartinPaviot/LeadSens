import type { YoutubeData } from "../types";

/** Fetch YouTube presence for a brand */
export async function fetchYoutube(_brand: string): Promise<YoutubeData> {
  // TODO: integrate with YouTube Data API v3 (via Composio or direct)
  return {
    videos: [],
  };
}
