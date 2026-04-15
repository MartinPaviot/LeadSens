import type { Platform } from "../core/types"

// ── Pixel Verification Result ──────────────────────────

export interface PixelStatus {
  platform: Platform
  pixelId: string | null
  installed: boolean
  firing: boolean
  lastEvent?: string // Last detected event name
  lastFiredAt?: string // ISO 8601
  error?: string
}

export interface TrackingAuditResult {
  allPixelsHealthy: boolean
  statuses: PixelStatus[]
  missingPlatforms: Platform[]
}

// ── Verify Pixels (Stub) ──────────────────────────────

/**
 * Verify that tracking pixels are correctly installed and firing for all platforms.
 *
 * STUB: Will integrate with platform APIs to check pixel health.
 * - Google: Google Ads conversion tracking / GA4
 * - Meta: Meta Pixel
 * - LinkedIn: LinkedIn Insight Tag
 * - X: X Pixel
 * - TikTok: TikTok Pixel
 */
export async function verifyPixels(
  platforms: Platform[],
  _siteUrl?: string,
): Promise<TrackingAuditResult> {
  await Promise.resolve()

  // Stub: all pixels reported as not verified (needs real integration)
  const statuses: PixelStatus[] = platforms.map((platform) => ({
    platform,
    pixelId: null,
    installed: false,
    firing: false,
    error: "Pixel verification not yet integrated. Manual check required.",
  }))

  return {
    allPixelsHealthy: false,
    statuses,
    missingPlatforms: platforms,
  }
}

/**
 * Generate UTM parameters for campaign tracking.
 */
export function generateUtmParams(
  campaignName: string,
  platform: Platform,
  adGroup?: string,
): string {
  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: "paid-social",
    utm_campaign: campaignName.toLowerCase().replace(/\s+/g, "-"),
  })

  if (adGroup) {
    params.set("utm_content", adGroup.toLowerCase().replace(/\s+/g, "-"))
  }

  return params.toString()
}
