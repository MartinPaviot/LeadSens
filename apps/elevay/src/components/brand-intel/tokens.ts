// Brand & Market Intelligence — Design tokens

export const COLORS = {
  teal: '#17c3b2',
  orange: '#FF7A3D',
  blue: '#2c6bed',
  bg: '#FFF7ED',
  textPrimary: '#1a1a1a',
  textSecondary: '#6b6b6b',
  border: 'rgba(0,0,0,0.08)',
  white: '#ffffff',
} as const;

export const GRADIENTS = {
  cta: 'linear-gradient(135deg, #17c3b2, #2c6bed)',
  trilogy: 'linear-gradient(160deg, #FFF7ED, #ffffff)',
  cardHover: 'linear-gradient(135deg, rgba(23,195,178,0.06), rgba(44,107,237,0.06))',
} as const;

export const URGENCY = {
  urgent: { bg: '#FFECE8', color: '#C0390E', label: 'Urgent' },
  moyen: { bg: '#FFF3DC', color: '#A05C00', label: 'Moyen terme' },
  quickwin: { bg: '#E6F9F5', color: '#0A7A68', label: 'Quick win' },
} as const;

export function scoreColor(score: number): string {
  if (score >= 70) return COLORS.teal;
  if (score >= 50) return COLORS.orange;
  return '#E24B4A';
}

export const AGENT_NAMES = {
  bpi01: 'Audit de marque',
  mts02: 'Tendances marché',
  cia03: 'Veille concurrentielle',
} as const;

export const AGENT_COLORS = {
  bpi01: COLORS.teal,
  mts02: COLORS.blue,
  cia03: COLORS.orange,
} as const;
