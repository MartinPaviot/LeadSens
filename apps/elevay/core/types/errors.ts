export class ElevayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly agentCode?: string,
  ) {
    super(message);
    this.name = 'ElevayError';
  }
}

export class ToolUnavailableError extends ElevayError {
  constructor(toolName: string, agentCode?: string) {
    super(`Tool unavailable: ${toolName}`, 'TOOL_UNAVAILABLE', agentCode);
  }
}

export class ValidationError extends ElevayError {
  constructor(message: string, agentCode?: string) {
    super(message, 'VALIDATION_ERROR', agentCode);
  }
}
