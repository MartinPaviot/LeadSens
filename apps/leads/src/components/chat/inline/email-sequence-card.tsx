"use client";

import { useState } from "react";
import { Card, Badge, Button } from "@leadsens/ui";
import { CaretDown, CaretRight, Envelope } from "@phosphor-icons/react";

// ─── Types ────────────────────────────────────────────────

interface SequenceEmail {
  emailId?: string;
  step: number;
  subject: string;
  body: string;
  leadName: string;
  leadCompany?: string;
  qualityScore?: number | null;
  wordCount?: number | null;
  scheduledDay?: number | null;
}

interface EmailSequenceCardProps {
  emails: SequenceEmail[];
  campaignName?: string;
  leadCount?: number;
}

// ─── Constants ────────────────────────────────────────────

const STEP_LABELS = [
  "PAS",
  "Value-add",
  "Social Proof",
  "New Angle",
  "Micro-value",
  "Breakup",
];

const CADENCE_DAYS = [0, 2, 5, 9, 14, 21];

// ─── Helpers ──────────────────────────────────────────────

function QualityPill({ score }: { score: number }) {
  const color =
    score >= 8
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
      : score >= 6
        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
        : "text-red-400 bg-red-500/10 border-red-500/20";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${color}`}
    >
      {score}/10
    </span>
  );
}

function renderBody(text: string) {
  return text.split(/\n{2,}/).map((paragraph, i) => (
    <p key={i} className="text-sm leading-relaxed text-foreground/80">
      {paragraph.split("\n").map((line, j, arr) => (
        <span key={j}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ))}
    </p>
  ));
}

// ─── Single step row ──────────────────────────────────────

function StepRow({ email }: { email: SequenceEmail }) {
  const [expanded, setExpanded] = useState(email.step === 0);
  const dayLabel = email.scheduledDay ?? CADENCE_DAYS[email.step] ?? email.step;
  const Caret = expanded ? CaretDown : CaretRight;

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Caret className="size-3 text-muted-foreground shrink-0" />
        <Badge variant="outline" className="text-[9px] shrink-0 w-16 justify-center">
          Day {dayLabel}
        </Badge>
        <span className="text-[10px] text-muted-foreground shrink-0 w-20">
          {STEP_LABELS[email.step] ?? `Step ${email.step}`}
        </span>
        <span className="text-xs font-medium truncate flex-1">
          {email.subject}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {email.qualityScore != null && (
            <QualityPill score={email.qualityScore} />
          )}
          {email.wordCount != null && (
            <span className="text-[10px] text-muted-foreground/50">
              {email.wordCount}w
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-muted/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span className="font-medium text-foreground/60 w-12">To</span>
            <span>
              {email.leadName}
              {email.leadCompany ? ` — ${email.leadCompany}` : ""}
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm mb-3">
            <span className="font-medium text-foreground/60 text-xs w-12 shrink-0 pt-0.5">
              Subject
            </span>
            <span className="font-semibold text-foreground">
              {email.subject}
            </span>
          </div>
          <div className="space-y-2 pl-0">{renderBody(email.body)}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────

export function EmailSequenceCard({
  emails,
  campaignName,
  leadCount,
}: EmailSequenceCardProps) {
  const [showAll, setShowAll] = useState(true);

  // Group by step, take first email per step as representative
  const stepMap = new Map<number, SequenceEmail>();
  for (const email of emails) {
    if (!stepMap.has(email.step)) {
      stepMap.set(email.step, email);
    }
  }
  const sortedSteps = Array.from(stepMap.values()).sort(
    (a, b) => a.step - b.step,
  );

  const avgScore =
    emails.filter((e) => e.qualityScore != null).length > 0
      ? (
          emails.reduce((sum, e) => sum + (e.qualityScore ?? 0), 0) /
          emails.filter((e) => e.qualityScore != null).length
        ).toFixed(1)
      : null;

  return (
    <Card className="overflow-hidden my-2 border-border/60">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Envelope className="size-4 text-primary" weight="duotone" />
            <span className="text-sm font-semibold">
              {campaignName ? `Sequence: ${campaignName}` : "Email Sequence"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {leadCount != null && (
              <Badge variant="outline" className="text-[10px]">
                {leadCount} lead{leadCount !== 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {sortedSteps.length} step{sortedSteps.length !== 1 ? "s" : ""}
            </Badge>
            {avgScore && (
              <Badge variant="outline" className="text-[10px]">
                Avg quality: {avgScore}/10
              </Badge>
            )}
          </div>
        </div>

        {/* Cadence visual */}
        <div className="flex items-center gap-1 mt-2">
          {sortedSteps.map((email, idx) => {
            const day = email.scheduledDay ?? CADENCE_DAYS[email.step] ?? 0;
            return (
              <div key={email.step} className="flex items-center">
                {idx > 0 && (
                  <div className="w-3 sm:w-5 h-px bg-border mx-0.5" />
                )}
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-muted-foreground/60">
                    D+{day}
                  </span>
                  <div className="size-2 rounded-full bg-primary/60" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Steps */}
      {showAll && (
        <div>
          {sortedSteps.map((email) => (
            <StepRow key={email.step} email={email} />
          ))}
        </div>
      )}

      {/* Toggle */}
      <div className="px-4 py-2 border-t border-border/40 bg-muted/20 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Collapse sequence" : "Show all steps"}
        </Button>
      </div>
    </Card>
  );
}
