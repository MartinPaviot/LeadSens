/**
 * Migration script: encrypt existing OAuth tokens in the Integration table.
 * Run with: npx tsx apps/elevay/scripts/encrypt-tokens.ts
 *
 * Requires ENCRYPTION_KEY and DATABASE_URL in .env
 */
import { PrismaClient } from "@prisma/client"
import { encrypt, isEncrypted } from "../src/lib/encryption"

const prisma = new PrismaClient()

async function migrateTokens() {
  process.stdout.write("Starting token encryption migration...\n")

  const integrations = await prisma.integration.findMany({
    where: {
      OR: [
        { accessToken: { not: null } },
        { refreshToken: { not: null } },
      ],
    },
  })

  let migrated = 0
  for (const integration of integrations) {
    const updates: Record<string, string> = {}

    if (integration.accessToken && !isEncrypted(integration.accessToken)) {
      updates.accessToken = encrypt(integration.accessToken)
    }
    if (integration.refreshToken && !isEncrypted(integration.refreshToken)) {
      updates.refreshToken = encrypt(integration.refreshToken)
    }

    if (Object.keys(updates).length > 0) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: updates,
      })
      migrated++
    }
  }

  process.stdout.write(
    `Migrated ${migrated}/${integrations.length} integrations\n`,
  )
  await prisma.$disconnect()
}

migrateTokens().catch((err) => {
  process.stderr.write(`Migration failed: ${String(err)}\n`)
  process.exit(1)
})
