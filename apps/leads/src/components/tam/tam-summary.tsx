"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@leadsens/ui";

// ─── Types ───────────────────────────────────────────────

interface TAMSummaryProps {
  total: number;
  burningEstimate: number;
  byRole: Array<{ role: string; count: number }>;
  byGeo: Array<{ region: string; count: number }>;
  roles: string[];
}

// ─── Animated Counter ────────────────────────────────────

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) {
      setCurrent(0);
      return;
    }

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));

      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };

    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, duration]);

  return <>{current.toLocaleString()}</>;
}

// ─── Component ───────────────────────────────────────────

export function TAMSummary({ total, burningEstimate, byRole, byGeo, roles }: TAMSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Big number */}
      <div className="text-center">
        <div className="text-4xl font-bold text-foreground tracking-tight">
          <AnimatedNumber target={total} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          matching contacts in your TAM
        </p>
        {burningEstimate > 0 && (
          <p className="text-sm mt-1">
            <span className="text-orange-600 font-semibold">
              ~{burningEstimate.toLocaleString()}
            </span>
            <span className="text-muted-foreground"> estimated Burning</span>
          </p>
        )}
      </div>

      {/* Role breakdown */}
      {byRole.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            By Role
          </p>
          <div className="space-y-1">
            {byRole.map((r) => (
              <div key={r.role} className="flex items-center justify-between">
                <span className="text-xs text-foreground/80 truncate">{r.role}</span>
                <span className="text-xs font-medium text-foreground/60 tabular-nums">
                  {r.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geo breakdown */}
      {byGeo.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            By Region
          </p>
          <div className="flex flex-wrap gap-1.5">
            {byGeo.map((g) => (
              <Badge
                key={g.region}
                variant="outline"
                className="text-[10px] font-normal"
              >
                {g.region}: {g.count.toLocaleString()}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ICP roles */}
      {roles.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            Target Roles
          </p>
          <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge
                key={role}
                variant="outline"
                className="text-[10px] bg-primary/5 border-primary/20 text-primary"
              >
                {role}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
