"use client";

export interface SuggestionAction {
  label: string;
  handler: string;
}

export interface ChatSuggestion {
  content: string;
  actions: SuggestionAction[];
}

interface SuggestionBubbleProps {
  suggestion: ChatSuggestion;
  onAction: (handler: string) => void;
}

export function SuggestionBubble({ suggestion, onAction }: SuggestionBubbleProps) {
  return (
    <div className="flex items-start w-full motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      {/* Spacer aligned with assistant message avatar column */}
      <div className="w-12 shrink-0" />
      <div
        className="flex-1 rounded-[12px] p-4"
        style={{
          background: "rgba(23,195,178,0.06)",
          border: "1px solid rgba(23,195,178,0.3)",
        }}
      >
        <p className="text-sm text-muted-foreground mb-3">{suggestion.content}</p>
        <div className="flex flex-wrap gap-2">
          {suggestion.actions.map((action) => (
            <button
              key={action.handler}
              type="button"
              onClick={() => onAction(action.handler)}
              className="px-4 py-1.5 rounded-full text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--elevay-gradient-btn)" }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
