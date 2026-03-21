/** TTL constants (in seconds) */
export const TTL = {
  SERP: 60 * 60 * 6,       // 6 hours
  PRESS: 60 * 60 * 24,     // 24 hours
  YOUTUBE: 60 * 60 * 12,   // 12 hours
  SOCIAL: 60 * 60 * 2,     // 2 hours
  SEO: 60 * 60 * 24 * 30,  // 30 days
  BENCHMARK: 60 * 60 * 24, // 24 hours
  TRENDS: 60 * 60 * 4,     // 4 hours
  DEFAULT: 60 * 60,        // 1 hour
} as const;
