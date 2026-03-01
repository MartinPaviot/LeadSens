"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface LeadRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  company?: string | null;
  jobTitle?: string | null;
  icpScore?: number | null;
  status: string;
}

interface LeadTableCardProps {
  title: string;
  leads: LeadRow[];
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <Badge variant="outline">—</Badge>;
  if (score >= 8) return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">{score}</Badge>;
  if (score >= 5) return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">{score}</Badge>;
  return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">{score}</Badge>;
}

export function LeadTableCard({ title, leads }: LeadTableCardProps) {
  const displayLeads = leads.slice(0, 10);

  return (
    <Card className="overflow-hidden my-2">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{leads.length} leads</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Company</th>
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-center font-medium">ICP</th>
            </tr>
          </thead>
          <tbody>
            {displayLeads.map((lead) => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 whitespace-nowrap">
                  {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{lead.email}</td>
                <td className="px-3 py-2">{lead.company ?? "—"}</td>
                <td className="px-3 py-2 max-w-[200px] truncate">{lead.jobTitle ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <ScoreBadge score={lead.icpScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads.length > 10 && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t">
          +{leads.length - 10} more leads
        </div>
      )}
    </Card>
  );
}
