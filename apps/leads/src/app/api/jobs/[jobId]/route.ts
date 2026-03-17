/**
 * Job Progress API — GET /api/jobs/:jobId
 *
 * Returns the current progress of a background job (enrichment, drafting, push).
 * Data is stored in Redis with a 1h TTL by Inngest functions.
 *
 * Polled by the job-progress chat component every 2 seconds.
 */

import { getJobProgress } from "@/lib/redis";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const progress = await getJobProgress(jobId);

  return Response.json(progress ?? { status: "unknown" }, {
    headers: { "Cache-Control": "no-cache, no-store" },
  });
}
