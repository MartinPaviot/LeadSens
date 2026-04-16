import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  loadWorkspaceContext,
  noConfigResponse,
  NoConfigError,
  requireFields,
  type WorkspaceContext,
} from '@/lib/agent-context'
import { toClientProfile, type SeoClientProfile } from '@/lib/agent-adapters'

export interface ResolvedSeoContext {
  session: { user: { id: string } }
  workspaceId: string
  ctx: WorkspaceContext
  profile: SeoClientProfile
  siteUrl: string
}

/**
 * Resolve auth + workspace + SEO ClientProfile in one step.
 * Returns a Response object on failure (auth, missing workspace, NO_CONFIG);
 * the caller should return that Response directly.
 *
 * `profileOverride` comes from the request body. Any field it provides wins
 * over Settings (used for tests, ad-hoc runs).
 * `siteUrlOverride` (top-level body.siteUrl) wins over profile.siteUrl.
 */
export async function resolveSeoContext(
  profileOverride: Partial<SeoClientProfile> | undefined,
  siteUrlOverride?: string,
): Promise<ResolvedSeoContext | Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  })
  if (!user?.workspaceId) {
    return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })
  }

  try {
    const ctx = await loadWorkspaceContext(user.workspaceId)
    const base = toClientProfile(ctx)
    const merged = { ...base.data, ...profileOverride }
    // Recompute `missing` against the merged result.
    const missing: string[] = []
    if (!merged.siteUrl && !siteUrlOverride) missing.push('companyUrl')
    if (!merged.cmsType) missing.push('cmsType')
    if (!merged.geoLevel) missing.push('geoLevel')
    if (merged.targetGeos.length === 0) missing.push('targetGeos')
    if (missing.length > 0) throw new NoConfigError(missing, 'SEO & Site')

    const profile: SeoClientProfile = { ...merged, id: session.user.id }
    const siteUrl = siteUrlOverride ?? profile.siteUrl

    return {
      session: { user: { id: session.user.id } },
      workspaceId: user.workspaceId,
      ctx,
      profile,
      siteUrl,
    }
  } catch (err) {
    if (err instanceof NoConfigError) return noConfigResponse(err)
    throw err
  }
}

export function requireCtxOrResponse<T>(x: T | Response): x is Response {
  return x instanceof Response
}
