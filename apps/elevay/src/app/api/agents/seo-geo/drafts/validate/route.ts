import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { wpPublishPage, wpPublishPost } from '@core/tools/cms/wordpress';

export const dynamic = 'force-dynamic'

const validateSchema = z.object({
  runId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  // WordPress credentials required for approve (not stored in DB)
  wpCredentials: z.object({
    siteUrl: z.string(),
    username: z.string(),
    applicationPassword: z.string(),
  }).optional(),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const parsed = validateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 });
  }
  const { runId, action, wpCredentials } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true },
  });
  if (!user?.workspaceId) {
    return Response.json({ error: 'No workspace found' }, { status: 404 });
  }

  // Load the agent run — must belong to user's workspace and be pending
  const run = await prisma.elevayAgentRun.findFirst({
    where: {
      id: runId,
      workspaceId: user.workspaceId,
      status: 'PENDING_VALIDATION',
    },
  });
  if (!run) {
    return Response.json({ error: 'Run not found or already processed' }, { status: 404 });
  }

  const output = run.output as Record<string, unknown> | null;
  const draftUrl = (output?.wpDraftUrl as string) ?? '';

  if (action === 'reject') {
    await prisma.elevayAgentRun.update({
      where: { id: runId },
      data: { status: 'REJECTED' },
    });
    return Response.json({ status: 'rejected', runId });
  }

  // action === 'approve' — publish the CMS draft
  let publishedUrl: string | null = null;

  if (draftUrl && wpCredentials) {
    // Extract WP post ID from draft URL (format: /wp-admin/post.php?post=123&action=edit)
    const match = draftUrl.match(/[?&]post=(\d+)/);
    const postId = match ? parseInt(match[1], 10) : null;

    if (postId) {
      try {
        const isPage = run.agentCode === 'WPW-09';
        const result = isPage
          ? await wpPublishPage(wpCredentials, postId)
          : await wpPublishPost(wpCredentials, postId);
        publishedUrl = result.url;
      } catch (err) {
        void err;
        return Response.json(
          { error: 'Failed to publish WordPress draft' },
          { status: 500 },
        );
      }
    }
  }

  await prisma.elevayAgentRun.update({
    where: { id: runId },
    data: { status: 'PUBLISHED' },
  });

  return Response.json({
    status: 'published',
    runId,
    publishedUrl,
  });
}
