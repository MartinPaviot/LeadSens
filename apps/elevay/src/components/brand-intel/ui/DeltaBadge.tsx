"use client";

export function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return null;
  const color = delta > 0 ? '#17c3b2' : delta < 0 ? '#E24B4A' : '#6b6b6b';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
  return (
    <span className="text-[11px] font-medium" style={{ color }}>
      {arrow} {Math.abs(delta)} pts
    </span>
  );
}
