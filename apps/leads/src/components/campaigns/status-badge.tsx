import {
  Play,
  Pause,
  Clock,
  CheckCircle,
  PencilSimple,
  ChartBar,
  Envelope,
  Users,
} from "@phosphor-icons/react";

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof Play }
> = {
  DRAFT: { label: "Draft", color: "text-muted-foreground", bg: "bg-muted", icon: PencilSimple },
  SOURCING: { label: "Sourcing", color: "text-blue-600", bg: "bg-blue-500/10", icon: Users },
  SCORING: { label: "Scoring", color: "text-blue-600", bg: "bg-blue-500/10", icon: ChartBar },
  ENRICHING: { label: "Enriching", color: "text-amber-600", bg: "bg-amber-500/10", icon: Clock },
  DRAFTING: { label: "Drafting", color: "text-amber-600", bg: "bg-amber-500/10", icon: Envelope },
  READY: { label: "Ready", color: "text-emerald-600", bg: "bg-emerald-500/10", icon: CheckCircle },
  PUSHED: { label: "Pushed", color: "text-indigo-600", bg: "bg-indigo-500/10", icon: Play },
  ACTIVE: { label: "Active", color: "text-emerald-600", bg: "bg-emerald-500/10", icon: Play },
  PAUSED: { label: "Paused", color: "text-amber-600", bg: "bg-amber-500/10", icon: Pause },
  MONITORING: { label: "Monitoring", color: "text-violet-600", bg: "bg-violet-500/10", icon: ChartBar },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${config.color} ${config.bg}`}
    >
      <Icon className="size-3" weight="bold" />
      {config.label}
    </span>
  );
}
