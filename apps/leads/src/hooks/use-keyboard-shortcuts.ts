import { useEffect } from "react";

interface ShortcutHandlers {
  onSearch?: () => void;
  onNewChat?: () => void;
  onCancelStream?: () => void;
  onToggleAgent?: () => void;
}

export function useKeyboardShortcuts({
  onSearch,
  onNewChat,
  onCancelStream,
  onToggleAgent,
}: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+K → search
      if (isCtrlOrMeta && e.key === "k") {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // Ctrl+J / Cmd+J → toggle agent panel
      if (isCtrlOrMeta && e.key === "j") {
        e.preventDefault();
        onToggleAgent?.();
        return;
      }

      // Ctrl+Shift+O → new chat
      if (isCtrlOrMeta && e.shiftKey && e.key === "O") {
        e.preventDefault();
        onNewChat?.();
        return;
      }

      // Escape → cancel streaming
      if (e.key === "Escape") {
        onCancelStream?.();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearch, onNewChat, onCancelStream, onToggleAgent]);
}
