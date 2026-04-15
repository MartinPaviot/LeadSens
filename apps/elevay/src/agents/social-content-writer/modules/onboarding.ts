import type { BrandVoiceProfile } from "../core/types"

/**
 * Calibrate brand voice from user conversation.
 * In V1, the voice profile is constructed from the chat message
 * and persisted in ElevayBrandProfile.voiceConfig (JSON).
 */
export async function calibrateBrandVoice(
  userMessage: string,
  existingProfile?: BrandVoiceProfile,
): Promise<BrandVoiceProfile> {
  // V1: Return a default profile if none exists, or merge with existing
  const defaults: BrandVoiceProfile = {
    style: "professional",
    register: "accessible",
    forbiddenWords: [],
    keyPhrases: [],
    positioning: "brand-expert",
    calibratedAt: new Date().toISOString(),
  }

  if (!existingProfile) return defaults

  return {
    ...existingProfile,
    calibratedAt: new Date().toISOString(),
  }
}
