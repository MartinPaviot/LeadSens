export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConnectorError extends AppError {
  constructor(message: string, public connector: string) {
    super(message, "CONNECTOR_ERROR");
    this.name = "ConnectorError";
  }
}

export class EnrichmentError extends AppError {
  constructor(message: string) {
    super(message, "ENRICHMENT_ERROR");
    this.name = "EnrichmentError";
  }
}

export class EmailDraftError extends AppError {
  constructor(message: string) {
    super(message, "EMAIL_DRAFT_ERROR");
    this.name = "EmailDraftError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, public retryAfterMs?: number) {
    super(message, "RATE_LIMIT", 429);
    this.name = "RateLimitError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details?: Array<{ path: string; message: string }>,
  ) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      "NOT_FOUND",
      404,
    );
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode },
    );
  }
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

export function formatErrorForUser(err: unknown): string {
  if (err instanceof ConnectorError) {
    if (err.connector === "INSTANTLY" && err.message.includes("401")) {
      return "API key invalid. Please reconnect Instantly in Settings.";
    }
    if (err.message.includes("429")) {
      return "Rate limit reached. Retrying shortly...";
    }
    return `${err.connector} error: ${err.message}`;
  }

  if (err instanceof EnrichmentError) {
    return `Enrichment failed: ${err.message}`;
  }

  if (err instanceof EmailDraftError) {
    return `Email draft failed: ${err.message}`;
  }

  if (err instanceof ValidationError) {
    return `Invalid input: ${err.message}`;
  }

  if (err instanceof NotFoundError) {
    return err.message;
  }

  if (err instanceof ForbiddenError) {
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "An unexpected error occurred";
}
