"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EmailPreviewCardProps {
  leadId: string;
  step: number;
  subject: string;
  body: string;
  leadName: string;
  leadCompany?: string;
}

const STEP_LABELS = ["PAS", "Value-add", "Breakup"];

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

export function EmailPreviewCard({
  step,
  subject,
  body,
  leadName,
  leadCompany,
}: EmailPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(body);
  const [approved, setApproved] = useState(false);

  return (
    <Card className="overflow-hidden my-2 border-border/60">
      {/* ── Step badge ── */}
      <div className="px-4 py-2 border-b border-border/40 flex items-center justify-between bg-muted/30">
        <Badge variant="outline" className="text-[10px]">
          Step {step + 1} — {STEP_LABELS[step] ?? "Email"}
        </Badge>
        {approved && (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">
            Approved
          </Badge>
        )}
      </div>

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
                onClick={() => setIsEditing(false)}
              >
                Save
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
                onClick={() => setApproved(true)}
              >
                Approve
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
