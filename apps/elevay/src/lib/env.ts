/**
 * Safe environment variable access.
 * Fails fast at module load time with a clear error message.
 */
export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}
