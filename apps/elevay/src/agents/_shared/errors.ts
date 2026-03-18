export enum ErrorCode {
  LLM_ERROR = "LLM_ERROR",
  MODULE_FETCH_FAILED = "MODULE_FETCH_FAILED",
  COMPOSIO_ERROR = "COMPOSIO_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  CACHE_ERROR = "CACHE_ERROR",
  SCORING_ERROR = "SCORING_ERROR",
}

export class AgentError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AgentError";
  }
}
