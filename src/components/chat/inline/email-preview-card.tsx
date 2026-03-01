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
    <Card className="overflow-hidden my-2">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Step {step + 1} — {STEP_LABELS[step] ?? "Email"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            to {leadName}
            {leadCompany ? ` @ ${leadCompany}` : ""}
          </span>
        </div>
        {approved && (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">
            Approved
          </Badge>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        <div>
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">
            Subject
          </span>
          <p className="text-sm font-medium">{subject}</p>
        </div>

        <div>
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">
            Body
          </span>
          {isEditing ? (
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="w-full mt-1 p-2 text-sm bg-muted/30 rounded-md border min-h-[120px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground mt-1">
              {editedBody}
            </p>
          )}
        </div>
      </div>

      {!approved && (
        <div className="px-4 py-3 border-t flex gap-2 justify-end">
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
