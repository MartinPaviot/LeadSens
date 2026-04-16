import { type APIRequestContext, request } from '@playwright/test';
import { prisma } from '../../lib/prisma';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const TEST_PASSWORD = 'PlaywrightTest123!';

/**
 * Creates a fresh test user via the Better Auth signup API,
 * captures the session cookie, and returns an authenticated API context.
 *
 * Also seeds workspace.settings for the workspace so agent routes work.
 */
export async function createAuthenticatedContext(): Promise<{
  apiContext: APIRequestContext;
  userId: string;
  workspaceId: string;
  email: string;
  cleanup: () => Promise<void>;
}> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.elevay.dev`;

  // Sign up via Better Auth API
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const signupRes = await ctx.post('/api/auth/sign-up/email', {
    data: {
      name: 'E2E Test',
      email,
      password: TEST_PASSWORD,
    },
  });

  if (signupRes.status() !== 200) {
    const text = await signupRes.text();
    throw new Error(`Signup failed [${signupRes.status()}]: ${text.slice(0, 200)}`);
  }

  // Extract session cookie from signup response (auto sign-in)
  const cookies = await ctx.storageState();
  const sessionCookie = cookies.cookies.find(
    (c) => c.name === 'better-auth.session_token' || c.name === '__Secure-better-auth.session_token',
  );
  if (!sessionCookie) {
    throw new Error('No session cookie after signup');
  }

  // Look up user and workspace
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, workspaceId: true },
  });
  if (!user?.workspaceId) {
    throw new Error('User or workspace not found after signup');
  }

  const wkspId = user.workspaceId;
  const uId = user.id;

  // Seed workspace settings (required by most agent routes)
  await prisma.workspace.update({
    where: { id: wkspId },
    data: {
      name: 'E2E Test Brand',
      companyUrl: 'https://e2e-test.example.com',
      country: 'FR',
      settings: {
        language: 'fr',
        competitors: [{ name: 'Competitor A', url: 'https://competitor-a.com' }],
        primaryKeyword: 'test keyword',
        secondaryKeyword: 'secondary test',
        priorityChannels: ['SEO'],
      },
    },
  });

  return {
    apiContext: ctx,
    userId: uId,
    workspaceId: wkspId,
    email,
    cleanup: async () => {
      // Delete in dependency order
      await prisma.elevayAgentRun.deleteMany({ where: { workspaceId: wkspId } });
      await prisma.session.deleteMany({ where: { userId: uId } });
      await prisma.user.deleteMany({ where: { id: uId } });
      await prisma.workspace.deleteMany({ where: { id: wkspId } });
      await ctx.dispose();
    },
  };
}

/** Minimal valid SEO profile payload for agent route requests. */
export const TEST_SEO_PROFILE = {
  siteUrl: 'https://e2e-test.example.com',
  cmsType: 'other' as const,
  automationLevel: 'audit' as const,
  geoLevel: 'national' as const,
  targetGeos: ['FR'],
  priorityPages: [],
  alertChannels: [] as string[],
  connectedTools: { gsc: false, ga: false, ahrefs: false, semrush: false },
};

/** Build a valid agentRouteSchema body. */
export function agentRouteBody(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: `e2e-conv-${Date.now()}`,
    siteUrl: 'https://e2e-test.example.com',
    profile: TEST_SEO_PROFILE,
    ...overrides,
  };
}
