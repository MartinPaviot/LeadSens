import type { z } from "zod/v4";

// ─── Stream Events (SPEC-BACKEND.md section 2.1) ─────────

export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-available"; toolCallId: string; input: unknown }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "status"; label: string }
  | { type: "step-complete"; usage: StepUsage }
  | { type: "finish"; usage: TotalUsage; finishReason: string }
  | { type: "error"; message: string };

export interface StepUsage {
  tokensIn: number;
  tokensOut: number;
}

export interface TotalUsage {
  tokensIn: number;
  tokensOut: number;
  totalSteps: number;
}

// ─── Tool Definition ──────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any, ctx: ToolContext) => Promise<any>;
  isSideEffect?: boolean;
}

export interface ToolContext {
  workspaceId: string;
  userId: string;
  onStatus?: (label: string) => void;
}

// ─── LLM Method Options ──────────────────────────────────

export type MistralModel = "mistral-large-latest" | "mistral-small-latest";

export interface ChatStreamOptions {
  model?: MistralModel;
  system: string;
  messages: ChatMessage[];
  tools?: Record<string, ToolDefinition>;
  maxSteps?: number;
  temperature?: number;
  workspaceId: string;
  userId?: string;
  onStatus?: (label: string) => void;
}

export interface CompleteOptions {
  model?: MistralModel;
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  workspaceId: string;
  action: string;
}

export interface JsonOptions<T> {
  model?: MistralModel;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  workspaceId: string;
  action: string;
}

export interface JsonRawOptions {
  model?: MistralModel;
  system: string;
  prompt: string;
  temperature?: number;
  workspaceId: string;
  action: string;
}

export interface DraftEmailOptions {
  system: string;
  prompt: string;
  workspaceId: string;
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

// ─── Chat Messages ────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface CompleteResult {
  text: string;
  usage: StepUsage;
}
