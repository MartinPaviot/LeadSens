// Requires: pnpm --filter @leadsens/elevay add @anthropic-ai/sdk
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = "claude-sonnet-4-6" as const;

export interface LLMRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: req.maxTokens ?? 2048,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
  });

  const content = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  return {
    content,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
