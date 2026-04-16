"use client"

import { MissionControl } from "@/components/social-campaigns/MissionControl"

export default function SocialCampaignsPage() {
  return (
    <div
      className="h-full"
      style={{
        background:
          "radial-gradient(ellipse at top left, rgba(23,195,178,0.06) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(44,107,237,0.05) 0%, transparent 50%), radial-gradient(ellipse at top right, rgba(255,122,61,0.04) 0%, transparent 40%), #FFF7ED",
      }}
    >
      <MissionControl />
    </div>
  )
}
