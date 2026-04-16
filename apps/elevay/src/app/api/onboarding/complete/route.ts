import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@leadsens/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic'

const completeSchema = z.object({
  brandName: z.string().optional(),
  siteUrl: z.string().url(),
  language: z.string().min(1),
  sector: z.string().optional(),
  toneOfVoice: z.string().optional(),
  cmsType: z.enum(['wordpress', 'hubspot', 'shopify', 'webflow', 'none', 'other']),
  otherCms: z.string().optional(),
  connectedTools: z.object({
    gsc: z.boolean(),
    ga: z.boolean(),
    cms: z.boolean(),
    googleDrive: z.boolean(),
    googleDocs: z.boolean(),
    slack: z.boolean(),
    ahrefs: z.boolean(),
    semrush: z.boolean(),
  }),
  ahrefsApiKey: z.string().optional(),
  semrushApiKey: z.string().optional(),
  automationLevel: z.enum(['audit', 'semi-auto', 'full-auto']),
  alertChannel: z.enum(['email', 'slack', 'digest']),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true, name: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  const parsed = completeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid data', details: parsed.error.format() }, { status: 400 });
  }

  const d = parsed.data;
  const brandName = d.brandName?.trim() || (user.name ?? new URL(d.siteUrl).hostname);
  const alertChannelMap: Record<string, string> = { email: 'email', slack: 'slack', digest: 'report' };

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { settings: true },
  });
  const existingSettings = (workspace?.settings as Record<string, unknown> | null) ?? {};

  const newSettings = {
    ...existingSettings,
    language: d.language,
    cmsType: d.cmsType === 'none' ? 'other' : d.cmsType,
    automationSeo: d.automationLevel,
    alertChannel: alertChannelMap[d.alertChannel] ?? 'email',
    tone: d.toneOfVoice,
    ...(d.ahrefsApiKey && { ahrefsApiKey: d.ahrefsApiKey }),
    ...(d.semrushApiKey && { semrushApiKey: d.semrushApiKey }),
  };

  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: {
      name: brandName,
      companyUrl: d.siteUrl,
      country: d.language === 'en' ? 'US' : d.language === 'fr' ? 'FR' : d.language.toUpperCase(),
      industry: d.sector,
      onboardingCompletedAt: new Date(),
      settings: newSettings as unknown as Prisma.InputJsonValue,
    },
  });

  return Response.json({ success: true });
}
