"use client";

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
}

export function ProgressBar({ label, current, total }: ProgressBarProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="my-2 space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {current}/{total}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
