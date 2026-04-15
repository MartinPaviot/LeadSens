import { CACHE_TTL } from "../core/constants"

interface CacheEntry {
  hashtags: string[]
  expiresAt: number
}

/** In-memory hashtag cache with 7-day TTL, isolated per workspace. */
const cache = new Map<string, CacheEntry>()

function cacheKey(workspaceId: string, topic: string): string {
  return `${workspaceId}:${topic.toLowerCase()}`
}

export function getCachedHashtags(
  workspaceId: string,
  topic: string,
): string[] | null {
  const key = cacheKey(workspaceId, topic)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.hashtags
}

export function setCachedHashtags(
  workspaceId: string,
  topic: string,
  hashtags: string[],
): void {
  cache.set(cacheKey(workspaceId, topic), {
    hashtags,
    expiresAt: Date.now() + CACHE_TTL.HASHTAGS * 1000,
  })
}
