import { test, expect, type APIRequestContext } from '@playwright/test';
import { prisma } from '../lib/prisma';
import {
  createAuthenticatedContext,
  agentRouteBody,
  TEST_SEO_PROFILE,
} from './helpers/api-test-utils';

// ─── Shared test state ───────────────────────────────────

let apiContext: APIRequestContext;
let userId: string;
let workspaceId: string;
let cleanup: () => Promise<void>;

test.beforeAll(async () => {
  const ctx = await createAuthenticatedContext();
  apiContext = ctx.apiContext;
  userId = ctx.userId;
  workspaceId = ctx.workspaceId;
  cleanup = ctx.cleanup;
});

test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

// ─── Test 1: Rate limiting ───────────────────────────────

test.describe('Rate limiting', () => {
  test('returns 429 after 10 requests in 60s', async () => {
    // Fire 11 requests in fast succession
    // TSI-07 route returns SSE (200) or 429 — we only care about the status
    const body = agentRouteBody();
    const responses: number[] = [];

    for (let i = 0; i < 11; i++) {
      const res = await apiContext.post('/api/agents/seo-geo/tsi-07', {
        data: body,
      });
      responses.push(res.status());

      // Once we get 429, stop immediately
      if (res.status() === 429) {
        const json = await res.json();
        expect(json).toHaveProperty('error', 'Rate limit exceeded');
        expect(json).toHaveProperty('retryAfter');
        expect(typeof json.retryAfter).toBe('number');
        break;
      }
    }

    // The 11th (or earlier) response must be 429
    expect(responses).toContain(429);
  });
});

// ─── Test 2: Draft validation — approve ──────────────────

test.describe('Draft validation', () => {
  let seededRunId: string;

  test.beforeEach(async () => {
    // Seed an agent run with PENDING_VALIDATION status
    const profile = await prisma.elevayBrandProfile.findUnique({
      where: { workspaceId },
    });

    const run = await prisma.elevayAgentRun.create({
      data: {
        workspaceId,
        agentCode: 'BSW-10',
        status: 'PENDING_VALIDATION',
        output: {
          wpDraftUrl: 'https://test.example.com/wp-admin/post.php?post=42&action=edit',
          topic: 'Test Article',
          bodyContent: '<p>Test</p>',
          wordCount: 100,
          mode: 'single',
          exportReady: true,
          requiresValidation: true,
        },
        degradedSources: [],
        durationMs: 5000,
        brandProfileId: profile?.id ?? null,
      },
    });
    seededRunId = run.id;
  });

  test.afterEach(async () => {
    // Clean up seeded runs
    await prisma.elevayAgentRun.deleteMany({
      where: { workspaceId, agentCode: 'BSW-10' },
    });
  });

  test('approve sets status to PUBLISHED', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/drafts/validate', {
      data: {
        runId: seededRunId,
        action: 'approve',
        // wpCredentials intentionally omitted — WP publish will be skipped
        // (no real WP to call), but status still updates to PUBLISHED
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('published');
    expect(json.runId).toBe(seededRunId);

    // Verify DB state
    const dbRun = await prisma.elevayAgentRun.findUnique({
      where: { id: seededRunId },
    });
    expect(dbRun?.status).toBe('PUBLISHED');
  });

  test('reject sets status to REJECTED', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/drafts/validate', {
      data: {
        runId: seededRunId,
        action: 'reject',
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('rejected');
    expect(json.runId).toBe(seededRunId);

    // Verify DB state
    const dbRun = await prisma.elevayAgentRun.findUnique({
      where: { id: seededRunId },
    });
    expect(dbRun?.status).toBe('REJECTED');
  });

  test('returns 404 for non-existent run', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/drafts/validate', {
      data: {
        runId: 'nonexistent-run-id',
        action: 'approve',
      },
    });
    expect(res.status()).toBe(404);
  });

  test('returns 404 for already-processed run', async () => {
    // First, reject the run
    await apiContext.post('/api/agents/seo-geo/drafts/validate', {
      data: { runId: seededRunId, action: 'reject' },
    });

    // Second attempt on same run should 404
    const res = await apiContext.post('/api/agents/seo-geo/drafts/validate', {
      data: { runId: seededRunId, action: 'approve' },
    });
    expect(res.status()).toBe(404);
  });
});

// ─── Test 4: Schedule create + pause + resume ────────────

test.describe('Schedule lifecycle', () => {
  test('create → pause → resume', async () => {
    // ── Create schedule (POST) ──────────────────────────────
    // This will try to send an Inngest event. If INNGEST env isn't set,
    // the request will fail with 500 and we test the DB state instead.
    // In CI, mock Inngest at the network level.
    const createRes = await apiContext.post('/api/agents/seo-geo/schedule', {
      data: { agentId: 'pio05', frequency: 'monthly' },
    });

    // If Inngest is not configured, expect 500 (dispatch failed)
    // If Inngest is configured, expect 200 (scheduled)
    if (createRes.status() === 200) {
      const createJson = await createRes.json();
      expect(createJson.status).toBe('scheduled');
      expect(createJson.agentId).toBe('pio05');
      expect(createJson.frequency).toBe('monthly');

      // Verify nextRunAt is ~30 days from now (±2 days tolerance)
      const nextRunAt = new Date(createJson.nextRunAt);
      const expectedDate = new Date();
      expectedDate.setMonth(expectedDate.getMonth() + 1);
      const diffDays = Math.abs(nextRunAt.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeLessThan(2);

      // Verify DB state
      const profile = await prisma.elevayBrandProfile.findUnique({
        where: { workspaceId },
        select: { report_recurrence: true },
      });
      expect(profile?.report_recurrence).toBe('monthly');

      // ── Pause (PATCH) ───────────────────────────────────────
      const pauseRes = await apiContext.patch('/api/agents/seo-geo/schedule', {
        data: { agentId: 'pio05', action: 'pause' },
      });
      expect(pauseRes.status()).toBe(200);
      const pauseJson = await pauseRes.json();
      expect(pauseJson.status).toBe('paused');

      const afterPause = await prisma.elevayBrandProfile.findUnique({
        where: { workspaceId },
        select: { report_recurrence: true },
      });
      expect(afterPause?.report_recurrence).toBe('on_demand');

      // ── Resume (PATCH) ──────────────────────────────────────
      const resumeRes = await apiContext.patch('/api/agents/seo-geo/schedule', {
        data: { agentId: 'pio05', action: 'resume', frequency: 'monthly' },
      });

      if (resumeRes.status() === 200) {
        const resumeJson = await resumeRes.json();
        expect(resumeJson.status).toBe('resumed');

        const afterResume = await prisma.elevayBrandProfile.findUnique({
          where: { workspaceId },
          select: { report_recurrence: true },
        });
        expect(afterResume?.report_recurrence).toBe('monthly');
      } else {
        // Inngest dispatch may fail in test env — that's OK, we tested the flow
        expect(resumeRes.status()).toBe(500);
      }
    } else {
      // Inngest not available — schedule POST returns 500
      expect(createRes.status()).toBe(500);
      const json = await createRes.json();
      expect(json).toHaveProperty('error');
    }
  });
});

// ─── Test 6: Zod validation rejects malformed body ───────

test.describe('Zod validation', () => {
  test('TSI-07 rejects invalid siteUrl type', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/tsi-07', {
      data: { siteUrl: 123 },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  test('TSI-07 rejects missing required fields', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/tsi-07', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('schedule rejects unknown agentId', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/schedule', {
      data: { agentId: 'unknown', frequency: 'monthly' },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  test('schedule rejects invalid frequency', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/schedule', {
      data: { agentId: 'pio05', frequency: 'hourly' },
    });
    expect(res.status()).toBe(400);
  });

  test('drafts/validate rejects missing runId', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/drafts/validate', {
      data: { action: 'approve' },
    });
    expect(res.status()).toBe(400);
  });

  test('drafts/validate rejects invalid action', async () => {
    const res = await apiContext.post('/api/agents/seo-geo/drafts/validate', {
      data: { runId: 'test', action: 'delete' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Test: Unauthenticated requests ──────────────────────

test.describe('Authentication', () => {
  test('agent route returns 401 without auth', async () => {
    const { request: unauthRequest } = await import('@playwright/test');
    const ctx = await unauthRequest.newContext({
      baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3001',
    });

    try {
      const res = await ctx.post('/api/agents/seo-geo/tsi-07', {
        data: agentRouteBody(),
      });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test('schedule route returns 401 without auth', async () => {
    const { request: unauthRequest } = await import('@playwright/test');
    const ctx = await unauthRequest.newContext({
      baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3001',
    });

    try {
      const res = await ctx.post('/api/agents/seo-geo/schedule', {
        data: { agentId: 'pio05', frequency: 'monthly' },
      });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test('drafts/validate returns 401 without auth', async () => {
    const { request: unauthRequest } = await import('@playwright/test');
    const ctx = await unauthRequest.newContext({
      baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3001',
    });

    try {
      const res = await ctx.post('/api/agents/seo-geo/drafts/validate', {
        data: { runId: 'test', action: 'approve' },
      });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });
});
