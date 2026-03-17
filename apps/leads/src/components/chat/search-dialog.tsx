"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
}

export function SearchDialog({ open, onOpenChange, onSelect }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/trpc/conversation.search?input=${encodeURIComponent(
          JSON.stringify({ query: q.trim() })
        )}`
      );
      const data = await res.json();
      setResults(data?.result?.data ?? []);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex].id);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search conversations</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 px-3 border-b">
          <MagnifyingGlass className="size-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-11 text-sm"
            autoFocus
          />
          <kbd className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded shrink-0">
            ESC
          </kbd>
        </div>

        {results.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto py-1">
            {results.map((result, i) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result.id)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="truncate">{result.title || "Untitled"}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(result.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No conversations found
          </div>
        )}

        {!query.trim() && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Type to search conversations
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
