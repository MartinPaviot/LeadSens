"use client";

export function CrossSignalCard({ tag, text }: { tag: string; text: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(0,0,0,0.08)', background: '#ffffff' }}>
      <span
        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mb-1.5"
        style={{ background: 'rgba(23,195,178,0.08)', color: '#17c3b2' }}
      >
        {tag}
      </span>
      <p className="text-sm" style={{ color: '#1a1a1a' }}>{text}</p>
    </div>
  );
}
