/**
 * Helpers pour filtrer les modules selon les canaux prioritaires sélectionnés.
 * Les `priority_channels` utilisent la forme canonique ('X', 'TikTok', 'Instagram', etc.)
 * alors que les modules sociaux utilisent des clés minuscules en interne.
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
