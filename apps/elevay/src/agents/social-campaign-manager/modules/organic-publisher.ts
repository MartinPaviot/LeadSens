import type { PlannedPost } from "../core/types"
import { prisma } from "@/lib/prisma"
import { agentWarn } from "@/agents/_shared/agent-logger"

const AGENT = "SMC-19"

export interface PublishResult {
  success: boolean
  postId?: string
  url?: string
  error?: string
}

const PLATFORM_INTEGRATION_MAP: Record<string, string> = {
  meta: "facebook",
  linkedin: "linkedin",
  x: "x",
  tiktok: "tiktok",
}

/**
 * Publish a post to Facebook/Instagram via Meta Graph API.
 */
async function publishToMeta(post: PlannedPost, accessToken: string, pageId: string): Promise<PublishResult> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `${post.content}\n\n${post.hashtags.join(" ")}`,
        access_token: accessToken,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `Meta API ${res.status}: ${err.slice(0, 200)}` }
    }
    const data = await res.json() as { id?: string }
    return { success: true, postId: data.id, url: `https://facebook.com/${data.id}` }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Meta publish failed" }
  }
}

/**
 * Publish a post to LinkedIn via API.
 */
async function publishToLinkedIn(post: PlannedPost, accessToken: string, personUrn: string): Promise<PublishResult> {
  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: `${post.content}\n\n${post.hashtags.join(" ")}` },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `LinkedIn API ${res.status}: ${err.slice(0, 200)}` }
    }
    const data = await res.json() as { id?: string }
    return { success: true, postId: data.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "LinkedIn publish failed" }
  }
}

/**
 * Publish a planned post to its target platform.
 * Loads integration credentials from DB and calls platform APIs.
 * Returns stub response if no integration is connected.
 */
export async function publishPost(post: PlannedPost, workspaceId?: string): Promise<PublishResult> {
  if (!workspaceId) {
    agentWarn(AGENT, "organic-publisher", "No workspaceId — cannot publish")
    return { success: false, error: "No workspace context" }
  }

  const integrationType = PLATFORM_INTEGRATION_MAP[post.platform]
  if (!integrationType) {
    return { success: false, error: `Unsupported platform: ${post.platform}` }
  }

  const integration = await prisma.integration.findFirst({
    where: { workspaceId, type: integrationType, status: "ACTIVE" },
    select: { accessToken: true, metadata: true },
  })

  if (!integration?.accessToken) {
    agentWarn(AGENT, "organic-publisher", `No ${integrationType} integration connected`)
    return { success: false, error: `Connect ${integrationType} in Settings to publish` }
  }

  const meta = (integration.metadata as Record<string, string> | null) ?? {}

  switch (post.platform) {
    case "meta": {
      const pageId = meta.pageId
      if (!pageId) return { success: false, error: "No Facebook Page ID configured" }
      return publishToMeta(post, integration.accessToken, pageId)
    }
    case "linkedin": {
      const personUrn = meta.personUrn ?? meta.organizationUrn
      if (!personUrn) return { success: false, error: "No LinkedIn profile URN configured" }
      return publishToLinkedIn(post, integration.accessToken, personUrn)
    }
    default:
      agentWarn(AGENT, "organic-publisher", `${post.platform} publishing not yet implemented`)
      return { success: false, error: `${post.platform} publishing coming soon` }
  }
}

/**
 * Schedule a post for future publishing.
 * Uses platform scheduled publishing when available, otherwise stores for later.
 */
export async function schedulePost(post: PlannedPost, workspaceId?: string): Promise<PublishResult> {
  if (!workspaceId) {
    return { success: false, error: "No workspace context" }
  }

  const integrationType = PLATFORM_INTEGRATION_MAP[post.platform]
  if (!integrationType) {
    return { success: false, error: `Unsupported platform: ${post.platform}` }
  }

  const integration = await prisma.integration.findFirst({
    where: { workspaceId, type: integrationType, status: "ACTIVE" },
    select: { accessToken: true, metadata: true },
  })

  if (!integration?.accessToken) {
    agentWarn(AGENT, "organic-publisher", `No ${integrationType} integration — cannot schedule`)
    return { success: false, error: `Connect ${integrationType} in Settings to schedule posts` }
  }

  // Meta supports scheduled publishing via the API
  if (post.platform === "meta") {
    const meta = (integration.metadata as Record<string, string> | null) ?? {}
    const pageId = meta.pageId
    if (!pageId) return { success: false, error: "No Facebook Page ID configured" }

    try {
      const scheduledTime = Math.floor(new Date(`${post.date}T${post.time}`).getTime() / 1000)
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${post.content}\n\n${post.hashtags.join(" ")}`,
          published: false,
          scheduled_publish_time: scheduledTime,
          access_token: integration.accessToken,
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        return { success: false, error: `Meta scheduling failed: ${res.status}` }
      }
      const data = await res.json() as { id?: string }
      return { success: true, postId: data.id }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Scheduling failed" }
    }
  }

  agentWarn(AGENT, "organic-publisher", `Scheduled publishing not yet supported for ${post.platform}`)
  return { success: false, error: `Scheduled publishing for ${post.platform} coming soon` }
}
