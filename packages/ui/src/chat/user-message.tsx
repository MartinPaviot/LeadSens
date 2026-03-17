"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessagePrimitive, useMessage } from "@assistant-ui/react";
import { PencilSimple, Copy, Check } from "@phosphor-icons/react";
import { useMessageActions } from "./message-actions-context";

interface UserMessageProps {
  userInitial: string;
}

export function UserMessage({ userInitial }: UserMessageProps) {
  const message = useMessage();
  const { onEdit } = useMessageActions();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messageId = message.id ?? "";
  let rawText = "";
  for (const part of message.content ?? []) {
    if (part.type === "text") {
      rawText += (part as { type: "text"; text: string }).text;
    }
  }

  const startEdit = useCallback(() => {
    setEditValue(rawText);
    setIsEditing(true);
  }, [rawText]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const confirmEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== rawText && messageId) {
      onEdit(messageId, trimmed);
    }
    setIsEditing(false);
  }, [editValue, rawText, messageId, onEdit]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!rawText) return;
    await navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rawText]);

  if (isEditing) {
    return (
      <div className="flex justify-end max-w-[85%] ml-auto motion-safe:animate-[fade-in-up_0.3s_ease-out]">
        <div className="flex items-start gap-2 w-full">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  confirmEdit();
                }
                if (e.key === "Escape") cancelEdit();
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[13.5px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 min-h-[60px]"
              rows={3}
            />
            <div className="flex justify-end gap-1.5 mt-1.5">
              <button
                onClick={cancelEdit}
                className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEdit}
                className="text-xs text-primary-foreground bg-primary hover:bg-primary/90 px-2.5 py-1 rounded-md transition-colors"
              >
                Save & Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MessagePrimitive.Root className="group flex justify-end max-w-[85%] ml-auto motion-safe:animate-[fade-in-up_0.3s_ease-out]">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="rounded-[16px_16px_4px_16px] bg-primary/90 backdrop-blur-sm px-[18px] py-[10px] break-words">
            <MessagePrimitive.Content
              components={{
                Text: ({ text }) => (
                  <p className="text-[13.5px] leading-relaxed text-primary-foreground">
                    {text}
                  </p>
                ),
              }}
            />
          </div>

          {/* Action bar — visible on hover */}
          <div className="flex justify-end gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={startEdit}
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Edit message"
            >
              <PencilSimple className="size-3" />
            </button>
            <button
              onClick={handleCopy}
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="size-3" weight="bold" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          </div>
        </div>

        {/* User avatar */}
        <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[11px] font-medium text-primary">
            {userInitial}
          </span>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}
