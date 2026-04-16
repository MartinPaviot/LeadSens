// Re-export from the canonical design tokens
export {
  getScoreColor,
  getDeltaColor,
  AGENT_TOKENS,
  ZONE_TOKENS,
  URGENCY_TOKENS,
  BRAND,
  GRADIENTS,
} from "@/lib/design-tokens"

// Backward-compat aliases for old Elevay components (cards/, charts/, ui/)
export { getScoreColor as scoreColor } from "@/lib/design-tokens"

export const COLORS = {
  teal: "#17c3b2",
  orange: "#FF7A3D",
  blue: "#2c6bed",
  bg: "#FFF7ED",
  textPrimary: "#1a1a1a",
  textSecondary: "#6b6b6b",
  border: "rgba(0,0,0,0.08)",
  white: "#ffffff",
} as const

export const URGENCY = {
  urgent: { bg: "#FFECE8", color: "#C0390E", label: "Urgent" },
  moyen: { bg: "#FFF3DC", color: "#A05C00", label: "Medium term" },
  quickwin: { bg: "#E6F9F5", color: "#0A7A68", label: "Quick win" },
} as const

export const AGENT_NAMES: Record<string, string> = {
  bpi01: "Brand Presence Audit",
  mts02: "Market Trends",
  cia03: "Competitive Intelligence",
}

export const AGENT_COLORS: Record<string, string> = {
  bpi01: "#2c6bed",
  mts02: "#7c3aed",
  cia03: "#FF7A3D",
}

// Tailwind class helpers
export function getScoreColorClass(score: number): string {
  if (score >= 70) return "text-teal"
  if (score >= 50) return "text-orange"
  return "text-destructive"
}

export function getScoreBg(score: number): string {
  if (score >= 70) return "bg-teal"
  if (score >= 50) return "bg-orange"
  return "bg-destructive"
}
