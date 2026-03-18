"use client";

import { useState } from "react";
import { Card, Button, Badge } from "@leadsens/ui";

interface EmailPreviewCardProps {
  emailId?: string;
  leadId: string;
  step: number;
  subject: string;
  body: string;
  leadName: string;
  leadCompany?: string;
  qualityScore?: number | null;
  signalType?: string | null;
  wordCount?: number | null;
  enrichmentDepth?: string | null;
}

const STEP_LABELS = ["PAS", "Value-add", "Social Proof", "New Angle", "Micro-value", "Breakup"];

/** Splits plain-text body into paragraphs (on \n\n) with inner <br/> for single \n. */
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

function QualityPill({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
    score >= 6 ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
    "text-red-400 bg-red-500/10 border-red-500/20";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {score}/10
    </span>
  );
}

export function EmailPreviewCard({
  emailId,
  step,
  subject,
  body,
  leadName,
  leadCompany,
  qualityScore,
  signalType,
  wordCount,
  enrichmentDepth,
}: EmailPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(body);
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [styleLearned, setStyleLearned] = useState(false);

  async function persistEdit(editBody: string, isApproved?: boolean) {
    if (!emailId) return;
    setSaving(true);
    try {
      await fetch(`/api/emails/${emailId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editBody !== body ? { body: editBody } : {}),
          ...(isApproved !== undefined ? { approved: isApproved } : {}),
        }),
      });
    } catch (err) {
      console.error("[EmailPreviewCard] Failed to persist edit:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden my-2 border-border/60">
      {/* ── Step badge ── */}
      <div className="px-4 py-2 border-b border-border/40 flex items-center justify-between bg-muted/30">
        <Badge variant="outline" className="text-[10px]">
          Step {step + 1} — {STEP_LABELS[step] ?? "Email"}
        </Badge>
        <div className="flex items-center gap-1.5">
          {styleLearned && (
            <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-600/30 text-[10px]">
              Style learned
            </Badge>
          )}
          {approved && (
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">
              Approved
            </Badge>
          )}
        </div>
      </div>

      {/* ── Quality metadata ── */}
      {(qualityScore != null || signalType || wordCount != null || enrichmentDepth) && (
        <div className="px-4 py-1.5 border-b border-border/30 flex items-center gap-2 flex-wrap">
          {qualityScore != null && <QualityPill score={qualityScore} />}
          {signalType && (
            <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
              {signalType}
            </span>
          )}
          {enrichmentDepth && (
            <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
              {enrichmentDepth}
            </span>
          )}
          {wordCount != null && (
            <span className="text-[10px] text-muted-foreground/50">
              {wordCount}w
            </span>
          )}
        </div>
      )}

      {/* ── Email header (To / Subject) ── */}
      <div className="px-4 pt-3 pb-2 space-y-1 border-b border-border/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/60 w-12 shrink-0">To</span>
          <span>
            {leadName}
            {leadCompany ? ` — ${leadCompany}` : ""}
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="font-medium text-foreground/60 text-xs w-12 shrink-0 pt-0.5">Subject</span>
          <span className="font-semibold text-foreground">{subject}</span>
        </div>
      </div>

      {/* ── Email body ── */}
      <div className="px-4 py-4">
        {isEditing ? (
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            className="w-full p-3 text-sm bg-muted/20 rounded-md border min-h-[140px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/30 leading-relaxed"
          />
        ) : (
          <div className="space-y-3">
            {renderBody(editedBody)}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      {!approved && (
        <div className="px-4 py-2.5 border-t border-border/40 flex gap-2 justify-end bg-muted/20">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditedBody(body);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={async () => {
                  const wasEdited = editedBody !== body;
                  await persistEdit(editedBody);
                  setIsEditing(false);
                  if (wasEdited) setStyleLearned(true);
                }}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={async () => {
                  await persistEdit(editedBody, true);
                  setApproved(true);
                }}
              >
                {saving ? "..." : "Approve"}
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
