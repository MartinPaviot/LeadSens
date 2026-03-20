/**
 * TAM Build SSE endpoint.
 *
 * Streams progress updates while the TAM engine runs.
 * Uses the same SSE pattern as the chat route.
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildTAM, type TAMProgress } from "@/server/lib/tam/tam-engine";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Auth
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const workspaceId = (session.user as { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    return new Response("No workspace", { status: 400 });
  }

  // Check workspace has Company DNA
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { companyDna: true },
  });

  if (!workspace.companyDna) {
    return new Response(
      JSON.stringify({ error: "Company DNA required. Complete website analysis first." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream may be closed
        }
      };

      try {
        const result = await buildTAM(workspaceId, (progress: TAMProgress) => {
          send({ type: "progress", ...progress });
        });

        send({
          type: "complete",
          result: {
            total: result.counts.total,
            burningEstimate: result.burningEstimate,
            leadsCount: result.leads.length,
            roles: result.icp.roles.map((r) => r.title),
            buildDurationMs: result.buildDurationMs,
          },
        });
      } catch (err) {
        logger.error("[tam/build] TAM build failed", {
          workspaceId,
          error: err instanceof Error ? err.message : String(err),
        });
        send({
          type: "error",
          message: err instanceof Error ? err.message : "TAM build failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
