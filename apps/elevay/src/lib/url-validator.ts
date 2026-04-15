const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS metadata
  "100.100.100.200", // Alibaba metadata
  "metadata.google.internal", // GCP metadata
]

const ALLOWED_PROTOCOLS = ["https:", "http:"]

export function validateUrl(rawUrl: string): {
  valid: boolean
  url?: URL
  error?: string
} {
  try {
    const url = new URL(rawUrl)

    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: `Protocol ${url.protocol} not allowed` }
    }

    const hostname = url.hostname.toLowerCase()

    // Block private/internal hosts
    if (
      BLOCKED_HOSTS.some(
        (h) => hostname === h || hostname.endsWith(`.${h}`),
      )
    ) {
      return { valid: false, error: "Private/internal URLs not allowed" }
    }

    // Block private IP ranges (RFC 1918)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const ipMatch = hostname.match(ipv4Regex)
    if (ipMatch) {
      const a = Number(ipMatch[1])
      const b = Number(ipMatch[2])
      if (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 0
      ) {
        return { valid: false, error: "Private IP ranges not allowed" }
      }
    }

    return { valid: true, url }
  } catch {
    return { valid: false, error: "Invalid URL format" }
  }
}
