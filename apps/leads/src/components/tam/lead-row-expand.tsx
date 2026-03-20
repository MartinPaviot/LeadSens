"use client";

import { Badge } from "@leadsens/ui";
import { Check, X, LinkedinLogo } from "@phosphor-icons/react";

// ─── Types ───────────────────────────────────────────────

interface SignalData {
  name: string;
  detected: boolean;
  evidence: string;
  points: number;
}

interface LeadData {
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  country?: string;
  linkedinUrl?: string;
  tier: string;
  heat: string;
  signals: SignalData[];
  whyThisLead: string;
  numericScore: number;
}

interface LeadRowExpandProps {
  lead: LeadData;
}

// ─── Component ───────────────────────────────────────────

export function LeadRowExpand({ lead }: LeadRowExpandProps) {
  return (
    <div className="px-4 py-3 space-y-3">
      {/* Why this lead */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Why this lead
        </p>
        <p className="text-xs text-foreground/80 leading-relaxed">
          {lead.whyThisLead}
        </p>
      </div>

      {/* Lead details */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {lead.company && (
          <span className="text-muted-foreground">
            Company: <span className="text-foreground/80">{lead.company}</span>
          </span>
        )}
        {lead.industry && (
          <span className="text-muted-foreground">
            Industry: <span className="text-foreground/80">{lead.industry}</span>
          </span>
        )}
        {lead.employeeCount && (
          <span className="text-muted-foreground">
            Size: <span className="text-foreground/80">{lead.employeeCount.toLocaleString()} employees</span>
          </span>
        )}
        {lead.country && (
          <span className="text-muted-foreground">
            Location: <span className="text-foreground/80">{lead.country}</span>
          </span>
        )}
        {lead.linkedinUrl && (
          <a
            href={lead.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <LinkedinLogo className="size-3" weight="fill" />
            LinkedIn
          </a>
        )}
      </div>

      {/* Signal checklist */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Signal Checklist
        </p>
        <div className="flex flex-wrap gap-1.5">
          {lead.signals.map((signal) => (
            <Badge
              key={signal.name}
              variant="outline"
              className={`text-[10px] gap-1 ${
                signal.detected
                  ? "bg-emerald-500/5 text-emerald-700 border-emerald-500/20"
                  : "bg-muted/30 text-muted-foreground/50 border-border/50"
              }`}
            >
              {signal.detected ? (
                <Check weight="bold" className="size-2.5" />
              ) : (
                <X weight="bold" className="size-2.5" />
              )}
              {signal.name}
              {signal.detected && (
                <span className="text-[9px] opacity-60">+{signal.points}</span>
              )}
            </Badge>
          ))}
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/30">
        <span>Score: <strong className="text-foreground">{lead.numericScore > 0 ? `${lead.numericScore}/10` : "—"}</strong></span>
        <span className="size-0.5 rounded-full bg-muted-foreground/20" />
        <span>Tier {lead.tier} · {lead.heat}</span>
      </div>
    </div>
  );
}
