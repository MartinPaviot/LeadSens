/**
 * Helpers to filter modules by selected priority channels.
 * `priority_channels` use canonical form ('X', 'TikTok', 'Instagram', etc.)
 * while social modules use lowercase keys internally.
 */

export type SocialPlatformKey = "LinkedIn" | "TikTok" | "Instagram" | "Facebook" | "X" | "YouTube";

/**
 * Retourne true si la plateforme doit être analysée.
 * `priority_channels` vide / undefined = toutes les plateformes actives (comportement V0).
 */
export function shouldRunSocialPlatform(
  platform: SocialPlatformKey,
  priority_channels: string[] | undefined,
): boolean {
  if (!priority_channels || priority_channels.length === 0) return true;
  return priority_channels.includes(platform);
}

/** Retourne true si les modules SEO/DataForSEO doivent s'exécuter. */
export function shouldRunSEO(priority_channels: string[] | undefined): boolean {
  if (!priority_channels || priority_channels.length === 0) return true;
  return priority_channels.includes("SEO");
}

/** Retourne true si le module presse doit s'exécuter. */
export function shouldRunPress(priority_channels: string[] | undefined): boolean {
  if (!priority_channels || priority_channels.length === 0) return true;
  return priority_channels.includes("Press");
}
