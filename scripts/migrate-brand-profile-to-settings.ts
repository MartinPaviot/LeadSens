/**
 * One-shot migration: elevay_brand_profile → workspace.settings + Integration.
 *
 * Uses raw SQL because the ElevayBrandProfile model was already removed
 * from the Prisma schema (table still exists in DB until db:migrate).
 *
 * Idempotent — only writes fields that don't already exist in Settings.
 * Run: pnpm tsx scripts/migrate-brand-profile-to-settings.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface BrandProfileRow {
  id: string
  workspaceId: string
  brand_name: string
  brand_url: string
  country: string
  language: string
  competitors: unknown
  primary_keyword: string
  secondary_keyword: string
  sector: string | null
  priority_channels: string[]
  objective: string | null
  facebookConnected: boolean
  facebookComposioAccountId: string | null
  instagramConnected: boolean
  instagramComposioAccountId: string | null
}

async function main() {
  const profiles = await prisma.$queryRaw<BrandProfileRow[]>`
    SELECT
      id, "workspaceId", brand_name, brand_url, country, language,
      competitors, primary_keyword, secondary_keyword, sector,
      priority_channels, objective,
      "facebookConnected", "facebookComposioAccountId",
      "instagramConnected", "instagramComposioAccountId"
    FROM elevay_brand_profile
  `

  console.log(`Found ${profiles.length} brand profile(s) to migrate.`)

  for (const profile of profiles) {
    const wid = profile.workspaceId

    const workspace = await prisma.workspace.findUnique({
      where: { id: wid },
      select: { industry: true, settings: true },
    })
    if (!workspace) {
      console.log(`  [${wid}] Workspace not found — skipped.`)
      continue
    }

    const existing = (workspace.settings as Record<string, unknown>) ?? {}

    const patch: Record<string, unknown> = {}

    if (!existing['primaryKeyword'] && profile.primary_keyword) {
      patch['primaryKeyword'] = profile.primary_keyword
    }
    if (!existing['secondaryKeyword'] && profile.secondary_keyword) {
      patch['secondaryKeyword'] = profile.secondary_keyword
    }
    if (!existing['priorityChannels'] && profile.priority_channels.length > 0) {
      patch['priorityChannels'] = profile.priority_channels
    }
    if (!existing['businessObjective'] && profile.objective) {
      patch['businessObjective'] = profile.objective
    }
    if (!existing['language'] && profile.language) {
      patch['language'] = profile.language
    }

    const existingCompetitors = (existing['competitors'] as Array<{ name: string; url: string }>) ?? []
    const profileCompetitors = (profile.competitors as Array<{ name: string; url: string }>) ?? []
    const existingNames = new Set(existingCompetitors.map((c) => c.name.toLowerCase()))
    const newCompetitors = profileCompetitors.filter((c) => !existingNames.has(c.name.toLowerCase()))
    if (newCompetitors.length > 0) {
      patch['competitors'] = [...existingCompetitors, ...newCompetitors]
    }

    let industryPatch: string | undefined
    if (!workspace.industry && profile.sector) {
      industryPatch = profile.sector
    }

    if (Object.keys(patch).length > 0 || industryPatch) {
      await prisma.workspace.update({
        where: { id: wid },
        data: {
          ...(industryPatch ? { industry: industryPatch } : {}),
          ...(Object.keys(patch).length > 0 ? { settings: { ...existing, ...patch } } : {}),
        },
      })
      console.log(`  [${wid}] Settings updated: ${Object.keys(patch).join(', ')}${industryPatch ? ' + industry' : ''}`)
    } else {
      console.log(`  [${wid}] Settings already up to date — skipped.`)
    }

    if (profile.facebookConnected && profile.facebookComposioAccountId) {
      const exists = await prisma.integration.findFirst({
        where: { workspaceId: wid, type: 'facebook' },
      })
      if (!exists) {
        await prisma.integration.create({
          data: {
            workspaceId: wid,
            type: 'facebook',
            status: 'ACTIVE',
            accountEmail: profile.facebookComposioAccountId,
            accountName: 'Facebook (migrated from BrandProfile)',
          },
        })
        console.log(`  [${wid}] Created Integration: facebook`)
      }
    }

    if (profile.instagramConnected && profile.instagramComposioAccountId) {
      const exists = await prisma.integration.findFirst({
        where: { workspaceId: wid, type: 'instagram' },
      })
      if (!exists) {
        await prisma.integration.create({
          data: {
            workspaceId: wid,
            type: 'instagram',
            status: 'ACTIVE',
            accountEmail: profile.instagramComposioAccountId,
            accountName: 'Instagram (migrated from BrandProfile)',
          },
        })
        console.log(`  [${wid}] Created Integration: instagram`)
      }
    }
  }

  console.log('\nMigration complete.')
}

main()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
