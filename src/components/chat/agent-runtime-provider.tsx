"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import type { ChatMessage } from "./agent-chat";
import type { ThreadMessageLike } from "@assistant-ui/react";

interface AgentRuntimeProviderProps {
  children: ReactNode;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
}

function convertMessage(msg: ChatMessage): ThreadMessageLike {
  return {
    role: msg.role,
    content: [{ type: "text", text: msg.content }],
  };
}

export function AgentRuntimeProvider({
  children,
  messages,
  isStreaming,
  onSend,
  onCancel,
}: AgentRuntimeProviderProps) {
  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning: isStreaming,
    onNew: async (msg) => {
      if (msg.content[0]?.type === "text") {
        onSend(msg.content[0].text);
      }
    },
    onCancel: async () => {
      onCancel();
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
