export const BRAND = {
  teal: "#17c3b2",
  orange: "#FF7A3D",
  blue: "#2c6bed",
  cream: "#FFF7ED",
  textPrimary: "#1a1a1a",
  textSecondary: "#6b6b6b",
  border: "rgba(0,0,0,0.08)",
} as const

export const GRADIENTS = {
  button: "linear-gradient(90deg, #17c3b2, #FF7A3D)",
  cta: "linear-gradient(135deg, #17c3b2, #2c6bed)",
  trilogy: "linear-gradient(160deg, #FFF7ED, #ffffff)",
  cardHover:
    "linear-gradient(135deg, rgba(23,195,178,0.06), rgba(44,107,237,0.06))",
  full: "linear-gradient(135deg, #17c3b2, #FF7A3D, #2c6bed)",
} as const

export function getScoreColor(score: number): string {
  if (score >= 70) return "#17c3b2"
  if (score >= 50) return "#FF7A3D"
  return "#E24B4A"
}

export function getDeltaColor(delta: number): string {
  if (delta > 0) return "#17c3b2"
  if (delta < 0) return "#E24B4A"
  return "#6b6b6b"
}

export const URGENCY_TOKENS = {
  Urgent: { bg: "#FFECE8", color: "#C0390E" },
  "Mid-term": { bg: "#FFF3DC", color: "#A05C00" },
  "Quick win": { bg: "#E6F9F5", color: "#0A7A68" },
} as const

export const ZONE_TOKENS = {
  red: {
    label: "Red Zone",
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
  saturated: {
    label: "Saturated",
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-200",
  },
  neutral: {
    label: "Neutral",
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  },
  green: {
    label: "Opportunity",
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
  },
} as const

export const AGENT_TOKENS = {
  "BPI-01": {
    label: "Online Presence",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "#2c6bed",
  },
  "MTS-02": {
    label: "Trends",
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "#7c3aed",
  },
  "CIA-03": {
    label: "Competitive Analysis",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "#FF7A3D",
  },
} as const
