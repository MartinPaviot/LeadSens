import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error("ENCRYPTION_KEY env var is required")
  const buf = Buffer.from(key, "hex")
  if (buf.length !== KEY_LENGTH) {
    throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)")
  }
  return buf
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex).
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":")
}

/**
 * Decrypt a ciphertext string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":")
  if (parts.length !== 3) throw new Error("Invalid ciphertext format")
  const [ivHex, tagHex, encryptedHex] = parts as [string, string, string]
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
}

/**
 * Check if a string looks like it was encrypted by encrypt().
 * Simple heuristic: 3 colon-separated hex segments.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":")
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p))
}
