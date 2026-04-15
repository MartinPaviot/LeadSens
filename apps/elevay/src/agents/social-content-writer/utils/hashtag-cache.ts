import { CACHE_TTL } from "../core/constants"

interface CacheEntry {
  hashtags: string[]
  expiresAt: number
}

/** In-memory hashtag cache with 7-day TTL. */
const cache = new Map<string, CacheEntry>()

export function getCachedHashtags(topic: string): string[] | null {
  const entry = cache.get(topic.toLowerCase())
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(topic.toLowerCase())
    return null
  }
  return entry.hashtags
}

export function setCachedHashtags(topic: string, hashtags: string[]): void {
  cache.set(topic.toLowerCase(), {
    hashtags,
    expiresAt: Date.now() + CACHE_TTL.HASHTAGS * 1000,
  })
}
