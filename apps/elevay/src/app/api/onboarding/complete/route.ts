import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@leadsens/db';
import { z } from 'zod';

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

  // Map onboarding fields to ElevayBrandProfile schema
  const brandName = d.brandName?.trim() || (user.name ?? new URL(d.siteUrl).hostname);
  const alertChannels: string[] = [];
  if (d.alertChannel === 'email') alertChannels.push('email');
  if (d.alertChannel === 'slack') alertChannels.push('slack');
  if (d.alertChannel === 'digest') alertChannels.push('report');

  // Build social_connections with API keys
  const socialConnections: Record<string, string> = {};
  if (d.ahrefsApiKey) socialConnections.ahrefsApiKey = d.ahrefsApiKey;
  if (d.semrushApiKey) socialConnections.semrushApiKey = d.semrushApiKey;
  const socialConnectionsJson = Object.keys(socialConnections).length > 0
    ? (socialConnections as unknown as Prisma.InputJsonValue)
    : undefined;

  await prisma.elevayBrandProfile.upsert({
    where: { workspaceId: user.workspaceId },
    create: {
      workspaceId: user.workspaceId,
      brand_name: brandName,
      brand_url: d.siteUrl,
      country: d.language === 'en' ? 'US' : d.language === 'fr' ? 'FR' : d.language.toUpperCase(),
      language: d.language,
      competitors: [],
      primary_keyword: d.sector ?? '',
      secondary_keyword: '',
      sector: d.sector,
      priority_channels: ['SEO'],
      objective: 'acquisition',
      report_recurrence: 'on_demand',
      ...(socialConnectionsJson && { social_connections: socialConnectionsJson }),
    },
    update: {
      brand_name: brandName,
      brand_url: d.siteUrl,
      country: d.language === 'en' ? 'US' : d.language === 'fr' ? 'FR' : d.language.toUpperCase(),
      language: d.language,
      sector: d.sector,
      ...(socialConnectionsJson && { social_connections: socialConnectionsJson }),
    },
  });

  return Response.json({ success: true });
}
