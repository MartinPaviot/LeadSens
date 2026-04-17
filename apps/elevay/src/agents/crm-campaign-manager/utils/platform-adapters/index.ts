import type { CRMPlatform, SMSPlatform, PlatformAdapter } from "../../core/types"
import { HubSpotAdapter } from "./hubspot"
import { KlaviyoAdapter } from "./klaviyo"
import { BrevoAdapter } from "./brevo"
import { TwilioAdapter } from "./twilio"

export function getCRMAdapter(platform: CRMPlatform, workspaceId: string): PlatformAdapter {
  switch (platform) {
    case "hubspot":
      return new HubSpotAdapter(workspaceId)
    case "klaviyo":
      return new KlaviyoAdapter(workspaceId)
    case "brevo":
      return new BrevoAdapter(workspaceId)
  }
}

export function getSMSAdapter(platform: SMSPlatform, workspaceId: string): PlatformAdapter {
  switch (platform) {
    case "twilio":
      return new TwilioAdapter(workspaceId)
  }
}
