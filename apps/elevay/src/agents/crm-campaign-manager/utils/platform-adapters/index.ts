import type { CRMPlatform, SMSPlatform, PlatformAdapter } from "../../core/types"
import { HubSpotAdapter } from "./hubspot"
import { KlaviyoAdapter } from "./klaviyo"
import { BrevoAdapter } from "./brevo"
import { TwilioAdapter } from "./twilio"

export function getCRMAdapter(platform: CRMPlatform): PlatformAdapter {
  switch (platform) {
    case "hubspot":
      return new HubSpotAdapter()
    case "klaviyo":
      return new KlaviyoAdapter()
    case "brevo":
      return new BrevoAdapter()
  }
}

export function getSMSAdapter(platform: SMSPlatform): PlatformAdapter {
  switch (platform) {
    case "twilio":
      return new TwilioAdapter()
  }
}
