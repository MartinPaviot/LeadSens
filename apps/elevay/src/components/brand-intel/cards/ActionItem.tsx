"use client";

import { UrgencyTag } from '../ui/UrgencyTag';

type Urgency = 'urgent' | 'moyen' | 'quickwin';

export function ActionItem({ text, urgency, source }: {
  text: string;
  urgency: Urgency;
  source?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
      <UrgencyTag level={urgency} />
      <div className="min-w-0 flex-1">
        <p className="text-sm" style={{ color: '#1a1a1a' }}>{text}</p>
        {source && <p className="mt-0.5 text-[11px]" style={{ color: '#6b6b6b' }}>{source}</p>}
      </div>
    </div>
  );
}
