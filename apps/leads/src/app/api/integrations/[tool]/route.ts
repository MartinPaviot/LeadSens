import {
  handleApiKeyConnect,
  handleDisconnect,
  handleValidateApiKey,
} from "@/server/lib/integrations/api-key-handler";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  return handleValidateApiKey(req, tool.toUpperCase());
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  return handleApiKeyConnect(req, tool.toUpperCase());
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  return handleDisconnect(req, tool.toUpperCase());
}
