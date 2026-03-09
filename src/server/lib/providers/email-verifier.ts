/**
 * EmailVerifier — Abstraction for email verification services.
 *
 * Implementations: ZeroBounce (V1), Dropcontact (future)
 */

// ─── Common Types ────────────────────────────────────────

export type VerificationStatus =
  | "valid"
  | "invalid"
  | "catch_all"
  | "unknown"
  | "spamtrap"
  | "abuse"
  | "disposable";

export interface VerificationResult {
  email: string;
  status: VerificationStatus;
  subStatus?: string;
  freeEmail?: boolean;
  didYouMean?: string;
}

export interface VerifyBatchResult {
  results: VerificationResult[];
  validCount: number;
  invalidCount: number;
  unknownCount: number;
}

// ─── Interface ───────────────────────────────────────────

export interface EmailVerifier {
  readonly name: "zerobounce" | "dropcontact";

  /** Verify a batch of emails */
  verifyBatch(emails: string[]): Promise<VerifyBatchResult>;

  /** Verify a single email */
  verifySingle(email: string): Promise<VerificationResult>;

  /** Get remaining credits */
  getCredits?(): Promise<number>;
}
