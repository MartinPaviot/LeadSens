import { handleOAuthStart } from "@/server/lib/integrations/oauth-handler";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  return handleOAuthStart(req, tool.toUpperCase());
}
