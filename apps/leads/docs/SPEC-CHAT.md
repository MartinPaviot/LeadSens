# SPEC-CHAT.md — Chat Interface Specification

> **Origine :** Specs Elevay (Chat.md), utilisées comme référence pour l'UI chat de LeadSens.
> **Rôle :** Suivre ce fichier pour TOUT ce qui touche au frontend chat.

## ⚠️ Adaptations LeadSens

**Sections à utiliser telles quelles :**
- Sections 1-7 : Architecture, Thread, Assistant/User Message, Composer, Greeting Loader, Scroll-to-Bottom
- Section 9 : Agent Runtime Provider (ExternalStoreRuntime bridge)
- Section 10 : Streaming Architecture (SSE, RAF batch, safety bounds)
- Section 12 : Inline Components pattern (lazy-loading, InlineComponentProps, HITL bridge)
- Section 13 : Message Types (ChatMessageExtended)
- Section 14 : Tool Activity Labels
- Section 18 : Design Tokens

**Sections à IGNORER :**
- Section 8 (Context Panel) → LeadSens n'a pas de sidebar info agent en V1
- Section 11 (Flow Mode) → Pas de flow nodes/edges dans LeadSens
- Section 15 (Agent Visual Identity) → LeadSens = 1 agent fixe, pas de templates/colors dynamiques
- Les 21 inline components Elevay → LeadSens en a 4 spécifiques : lead-table-card, email-preview-card, campaign-summary-card, progress-bar

**Inline components LeadSens (à ajouter au registry) :**
| Component | Tool Name | Purpose |
|-----------|-----------|---------|
| `LeadTableCard` | `render_lead_table` | Tableau de leads (name, email, company, title, ICP score) |
| `EmailPreviewCard` | `render_email_preview` | Preview email avec tabs pour les 3 steps, boutons Edit/Approve |
| `CampaignSummaryCard` | `render_campaign_summary` | Résumé campagne avec stats + lien Instantly |
| `ProgressBar` | `render_inline_progress` | Barre de progression enrichissement/drafting |

---

## 1. Architecture Overview

### Component Tree

```
AgentChat (agentId)
├── AgentActivityContext.Provider (label: string | null)
│   ├── AgentRuntimeProvider (bridges SSE state ↔ assistant-ui)
│   │   ├── ChatHeader (top bar)
│   │   ├── ToolUIRegistry (mounts 20 tool UIs)
│   │   └── ElevayThread (main chat thread)
│   │       ├── ThreadPrimitive.Root
│   │       │   └── ThreadPrimitive.Viewport (scrollable)
│   │       │       ├── bg-elevay-mesh overlay
│   │       │       ├── Content area (max-w-[720px] mx-auto)
│   │       │       │   ├── GreetingLoader (when messages.length === 0)
│   │       │       │   └── ThreadPrimitive.Messages
│   │       │       │       ├── ElevayUserMessage
│   │       │       │       └── ElevayAssistantMessage (stable memoized ref)
│   │       │       └── ThreadPrimitive.ViewportFooter (sticky bottom)
│   │       │           ├── ScrollToBottomPill
│   │       │           └── ElevayComposer
│   └── ContextPanel (right sidebar, 320px)
```

### Key Patterns

- **Runtime:** `assistant-ui` with `ExternalStoreRuntime` — full control over streaming/state
- **Streaming:** SSE via `fetch()` + `ReadableStream` from `POST /api/agents/chat` (NOT WebSocket)
- **State:** React hooks + refs for streaming, TanStack Query for server state, `AgentActivityContext` for activity labels
- **Inline components:** 21 lazy-loaded UI components rendered inside agent bubbles via tool calls

---

## 2. Layout & Structure

### Full Page Layout

```tsx
<main className="flex h-dvh" aria-label="Agent chat">
  {/* Chat zone */}
  <AgentRuntimeProvider ...>
    <div className="flex-1 flex flex-col min-w-0">
      <ChatHeader />
      <ToolUIRegistry />
      <ElevayThread />
    </div>
  </AgentRuntimeProvider>

  {/* Right sidebar — conditionally rendered */}
  {isContextOpen && <ContextPanel />}

  {/* Screen reader streaming announcements */}
  <div className="sr-only" aria-live="polite">
    {isStreaming && (activityLabel || "Agent is generating a response...")}
  </div>
</main>
```

### Layout Properties

| Element | Classes | Notes |
|---------|---------|-------|
| Main container | `flex h-dvh` | Full viewport height |
| Chat zone | `flex-1 flex flex-col min-w-0` | Takes remaining space |
| Thread root | `flex-1 flex flex-col min-h-0` | Fills chat zone |
| Viewport | `flex-1 overflow-y-auto scrollbar-thin relative flex flex-col` | Scrollable messages |
| Content column | `max-w-[720px] mx-auto w-full px-4 md:px-6 py-4` | Centered, responsive padding |
| Mesh overlay | `pointer-events-none absolute inset-0 bg-elevay-mesh` | Subtle background gradient |
| Footer | `sticky bottom-0` | Always visible at bottom |

---

## 3. Chat Header

**File:** `features/agents/components/chat/chat-header.tsx`

### Props

```typescript
interface ChatHeaderProps {
  agentId: string;
  agentName: string;
  templateIcon?: string | null;   // Emoji from template
  templateColor?: string | null;  // Hex color from template
  status?: ContextPanelStatus;    // "idle" | "configuring" | "running" | "done" | "error" | "scheduled"
  isContextOpen: boolean;
  onToggleContext: () => void;
}
```

### Structure

```
header (flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur-sm shrink-0)
├── Back button (Link → /agents, ghost variant, ArrowLeft icon)
├── Agent identity (flex items-center gap-2.5 flex-1 min-w-0)
│   ├── Avatar (size-7 rounded-lg, gradient or hex color)
│   │   └── Emoji OR Phosphor icon (size-3.5 text-white weight="fill")
│   ├── Name (h1, text-sm font-semibold truncate)
│   └── Status badge (aria-live="polite")
│       └── Badge (text-[10px] px-2 py-0.5)
└── Actions (flex items-center gap-1)
    ├── Settings (Link → /agents/{id}/flow, GearSix icon)
    └── Sidebar toggle (SidebarSimple, fill when open, regular when closed)
```

### Status Badge Mapping

| Status | Label | Badge Variant |
|--------|-------|---------------|
| `idle` | Ready | `secondary` |
| `configuring` | Configuring | `outline` |
| `running` | Running | `default` |
| `done` | Done | `secondary` |
| `error` | Error | `outline` |
| `scheduled` | Scheduled | `secondary` |

### Avatar Color Logic

```typescript
// If template provides a hex color → inline gradient style
const avatarStyle = config.color
  ? { background: `linear-gradient(135deg, ${config.color}, ${darkenHex(config.color, 20)})` }
  : undefined;

// Otherwise → Tailwind gradient classes
// Default: "from-indigo-500 to-violet-600"
```

### `darkenHex()` Utility

```typescript
function darkenHex(hex: string, percent: number): string {
  const num = Number.parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0xff) - Math.round(2.55 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
```

---

## 4. Message Bubbles

### 4.1 Assistant Message (`ElevayAssistantMessage`)

**File:** `features/agents/components/chat/elevay-assistant-message.tsx`

```
MessagePrimitive.Root (flex gap-3 items-start max-w-[85%], fade-in-up 0.3s)
├── Avatar (aui-avatar, relative shrink-0)
│   └── Container (size-8 rounded-lg, gradient or hex color)
│       └── Emoji OR Robot icon (size-4 text-white weight="fill")
└── Content bubble
    └── MessagePrimitive.Content
        ├── Text → MarkdownTextWithCursor
        │   ├── MarkdownTextPrimitive (smooth)
        │   └── MessagePartPrimitive.InProgress → cursor span
        └── Empty → TypingIndicator
```

#### Bubble Styles

| Property | Value |
|----------|-------|
| Border radius | `rounded-[16px_16px_16px_4px]` (asymmetric: bottom-left is tight) |
| Background | `bg-secondary/90 backdrop-blur-sm` |
| Padding | `px-4 py-2` |
| Font size | `text-[13.5px]` |
| Line height | `leading-relaxed` |
| Typography | `prose prose-sm dark:prose-invert max-w-none` |
| Paragraph spacing | `[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0` |
| Animation | `motion-safe:animate-[fade-in-up_0.3s_ease-out]` |

#### Streaming Cursor

```tsx
<span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-middle rounded-sm animate-pulse" aria-hidden="true" />
```

Only visible during streaming (via `MessagePartPrimitive.InProgress`).

#### Typing Indicator

Shown when message content is empty AND thread is running:

```tsx
<div className="flex items-center gap-2 py-1" role="status" aria-label={label || "Agent is typing"}>
  <div className="flex items-center gap-1">
    <span className="size-1.5 rounded-full bg-primary/60 typing-dot" />
    <span className="size-1.5 rounded-full bg-primary/60 typing-dot" />
    <span className="size-1.5 rounded-full bg-primary/60 typing-dot" />
  </div>
  {label && (
    <span className="text-xs text-muted-foreground motion-safe:animate-[fade-in-up_0.15s_ease-out]">
      {label}
    </span>
  )}
</div>
```

The `label` comes from `AgentActivityContext` (e.g., "Searching knowledge...", "Sending email").

#### Avatar Visibility

Consecutive assistant messages hide the avatar via CSS (`.aui-avatar` class + global CSS rule). Only the first message in a sequence shows the avatar.

### 4.2 User Message (`ElevayUserMessage`)

**File:** `features/agents/components/chat/elevay-user-message.tsx`

```
MessagePrimitive.Root (flex justify-end max-w-[85%] ml-auto, fade-in-up 0.3s)
└── Content bubble
    └── MessagePrimitive.Content
```

#### Bubble Styles

| Property | Value |
|----------|-------|
| Border radius | `rounded-[16px_16px_4px_16px]` (asymmetric: bottom-right is tight) |
| Background | `bg-primary/90 backdrop-blur-sm` |
| Padding | `px-[18px] py-[10px]` |
| Font size | `text-[13.5px]` |
| Line height | `leading-relaxed` |
| Text color | `text-primary-foreground` |
| Word wrap | `min-w-0 break-words` |
| Animation | `motion-safe:animate-[fade-in-up_0.3s_ease-out]` |

---

## 5. Composer (`ElevayComposer`)

**File:** `features/agents/components/chat/elevay-composer.tsx`

### Props

```typescript
interface ElevayComposerProps {
  agentName?: string;
  placeholder?: string;
}
```

### Structure

```
Container (px-6 pb-4 pt-2 shrink-0)
└── Inner (max-w-[720px] mx-auto)
    └── ComposerPrimitive.Root (flex items-center gap-2 rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-3 transition-all)
        ├── ComposerPrimitive.Input (textarea)
        ├── Send button (when NOT streaming)
        │   └── ComposerPrimitive.Send → Button (icon-sm, rounded-lg)
        │       └── PaperPlaneTilt (size-4, weight="fill")
        └── Cancel button (when streaming)
            └── ComposerPrimitive.Cancel → Button (icon-sm, outline, rounded-lg)
                └── StopCircle (size-4)
```

### Textarea Styles

```tsx
className={cn(
  "min-h-0 max-h-32 flex-1 resize-none border-0 bg-transparent shadow-none",
  "focus:outline-none focus-visible:ring-0 p-0 text-[14px]",
)}
```

| Property | Value |
|----------|-------|
| Min height | `min-h-0` |
| Max height | `max-h-32` (128px = ~32 lines) |
| Rows | `1` (auto-resize) |
| Font size | `text-[14px]` |
| Auto focus | `true` |
| Placeholder | `"Message {agentName}..."` |

### Keyboard

- **Enter** = send (built into `ComposerPrimitive`)
- **Shift+Enter** = newline (built into `ComposerPrimitive`)

### Button Toggle Logic

```tsx
{/* Send: visible when NOT streaming */}
<AuiIf condition={(s) => !s.thread.isRunning}>
  <ComposerPrimitive.Send asChild>...</ComposerPrimitive.Send>
</AuiIf>

{/* Cancel: visible when streaming */}
<AuiIf condition={(s) => s.thread.isRunning}>
  <ComposerPrimitive.Cancel asChild>...</ComposerPrimitive.Cancel>
</AuiIf>
```

---

## 6. Greeting Loader

**File:** `features/agents/components/chat/greeting-loader.tsx`

Shown when `messages.length === 0` — before the agent's first greeting arrives.

### Structure

```
Container (flex-1 flex items-center justify-center px-6 py-12)
└── Inner (text-center space-y-4)
    ├── Avatar (relative mx-auto w-fit, fade-in-up 0.5s)
    │   ├── Icon container (size-16 rounded-2xl, gradient or hex color)
    │   │   └── Emoji OR Robot icon (size-8 text-white weight="fill")
    │   └── Glow (absolute inset-0 rounded-2xl blur-xl opacity-25 -z-10 scale-150)
    ├── Agent name (text-sm font-medium text-muted-foreground, fade-in-up +100ms)
    └── Typing dots (flex items-center justify-center gap-1, fade-in-up +200ms)
        ├── Dot (size-2 rounded-full bg-muted-foreground/40 typing-dot)
        ├── Dot (size-2 ... typing-dot [animation-delay:150ms])
        └── Dot (size-2 ... typing-dot [animation-delay:300ms])
```

### Animation Timing

| Element | Animation |
|---------|-----------|
| Avatar | `fade-in-up 0.5s ease-out` |
| Agent name | `fade-in-up 0.5s ease-out 100ms both` |
| Typing dots | `fade-in-up 0.4s ease-out 200ms both` |
| Dot 1 | `typing-dot` (no delay) |
| Dot 2 | `typing-dot` + `[animation-delay:150ms]` |
| Dot 3 | `typing-dot` + `[animation-delay:300ms]` |

The `typing-dot` CSS animation is defined in global CSS (bouncing dots).

---

## 7. Scroll-to-Bottom Pill

**File:** `features/agents/components/chat/scroll-to-bottom-pill.tsx`

### Visibility Conditions

Shows only when BOTH conditions are true:
1. User has scrolled up (`!isAtBottom` from `useThreadViewport`)
2. Viewport has scrollable content (`scrollHeight > clientHeight + 10`)

Uses `ResizeObserver` on the scrollable parent to detect overflow changes.

### Structure

```tsx
<button
  type="button"
  onClick={() => scrollToBottom()}
  className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm bg-background/95 border shadow-md hover:shadow-lg transition-all cursor-pointer motion-safe:animate-[fade-in-up_0.2s_ease-out]"
  aria-label="Scroll to latest message"
>
  <ArrowDown className="size-3.5" weight="bold" aria-hidden="true" />
</button>
```

---

## 8. Context Panel (Right Sidebar)

**File:** `features/agents/components/chat/context/context-panel.tsx`

### Layout

```tsx
<aside className="w-[320px] border-l border-border bg-background shrink-0 hidden lg:flex lg:flex-col" aria-label="Agent info panel">
```

- **Width:** 320px fixed
- **Visibility:** `hidden lg:flex lg:flex-col` (desktop only)
- **Toggle:** via `isContextOpen` state + `SidebarSimple` button in header

### Sections

1. **Header** — "Agent" title + close button (px-4 py-3 border-b)
2. **About** — Template badge + description
3. **Capabilities** — Custom tools (Wrench icon) + suggested skills (brand icons)
4. **Agent Info** — Model badge + conversation count
5. **Quick Links** — Brief, Settings, Memory (with Phosphor icons)

### Skill Icon Map (17 entries)

| Skill | Icon | Color |
|-------|------|-------|
| Email / Gmail | `SiGmail` | `#EA4335` |
| CRM / HubSpot | `SiHubspot` | `#FF7A59` |
| Calendar / Google Calendar | `SiGooglecalendar` | `#4285F4` |
| Docs / Google Docs | `SiGoogledocs` | `#4285F4` |
| Spreadsheet / Google Sheets | `SiGooglesheets` | `#0F9D58` |
| Google Drive | `SiGoogledrive` | `#4285F4` |
| Slack | `SiSlack` | `#4A154B` |
| Salesforce | `SiSalesforce` | `#00A1E0` |
| QuickBooks | `SiQuickbooks` | `#2CA01C` |
| Xero | `SiXero` | `#13B5EA` |
| Accounting | `SiQuickbooks` | `#2CA01C` |
| Web Search | `MagnifyingGlass` | (inherits) |
| Meeting Recorder | `VideoCamera` | (inherits) |
| Social Media | `Megaphone` | (inherits) |
| Blog / Newsletter | `Newspaper` | (inherits) |
| Knowledge Base | `BookOpen` | (inherits) |
| Chat | `ChatCircle` | (inherits) |
| People Data Labs | `PDLIcon` (custom) | (inherits) |

### Section Title Component

```tsx
<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px]">{children}</h2>
```

---

## 9. Agent Runtime Bridge

**File:** `features/agents/components/chat/agent-runtime-provider.tsx`

### Purpose

Bridges Elevay's SSE-based message state with `assistant-ui`'s rendering system. Uses `ExternalStoreRuntime` for full control — no built-in streaming or API calls from assistant-ui.

### Props

```typescript
interface AgentRuntimeProviderProps {
  children: ReactNode;
  messages: ChatMessageExtended[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  onAddToolResult?: (toolCallId: string, result: unknown) => void;
}
```

### Runtime Configuration

```typescript
const runtime = useExternalStoreRuntime({
  messages,                    // ChatMessageExtended[]
  convertMessage,              // ChatMessageExtended → ThreadMessageLike
  isRunning: isStreaming,      // Controls typing indicator + cancel button
  onNew: handleNew,            // User sends a message
  onCancel: handleCancel,      // User clicks stop
  onAddToolResult: handleAdd,  // Inline component response
});
```

### Message Adapter (`assistant-ui-adapter.ts`)

Converts `ChatMessageExtended` → `ThreadMessageLike`:

| Source | Target |
|--------|--------|
| `role: "user"` | `{ role: "user", content: [text] }` |
| `role: "system"` | `{ role: "system", content: [text] }` |
| `messageType: "component"` | `{ role: "assistant", content: [text, tool-call], status: requires-action }` |
| `messageType: "thinking"` | `{ role: "assistant", content: [text, __thinking__ tool-call], status: complete }` |
| `messageType: "connector"` | `{ role: "assistant", content: [__connector__ tool-call], status: running/complete }` |
| `messageType: "progress"` | `{ role: "assistant", content: [text, __progress__ tool-call], status: running/complete }` |
| `role: "tool"` | `{ role: "assistant", content: [text, tool-call], status: running/complete }` |
| `role: "assistant"` (text) | `{ role: "assistant", content: [text], status: complete }` |

**Important:** Every assistant message includes at least one text part (even if empty) — assistant-ui requires this.

### Tool Name Conversion

- Component → tool: `InlineButtons` → `render_inline_buttons`, `DNACard` → `render_dna_card`
- Tool → component: `render_inline_buttons` → `InlineButtons`, `render_dna_card` → `DNACard`

---

## 10. Streaming Architecture

### Protocol

SSE (Server-Sent Events) via `fetch()` + `ReadableStream`.

### Endpoint

```
POST /api/agents/chat
Content-Type: application/json

{
  conversationId: string,       // CUID
  messages: [{ role: string, content: string }],
  files?: ProcessedFile[],      // Base64 encoded, max 10MB each
  isGreeting?: boolean          // Fast path for initial greeting
}
```

### SSE Event Types

| Event | Payload | Frontend Handling |
|-------|---------|-------------------|
| `status` | `{ type: "status", label: string }` | Sets `activityLabel` state |
| `text-delta` | `{ type: "text-delta", delta: string }` | Appends to `pendingContentRef`, RAF batch update |
| `tool-input-start` | `{ type: "tool-input-start", toolCallId, toolName }` | Adds tool message or waits for inline |
| `tool-input-available` | `{ type: "tool-input-available", toolCallId, input }` | Updates tool input or renders inline component |
| `tool-output-available` | `{ type: "tool-output-available", toolCallId, output }` | Updates tool message with result |
| `rag-sources` | `{ type: "rag-sources", sources: [...] }` | (Currently ignored in UI) |
| `error` | `{ type: "error", message: string }` | Toast + console error |

### Text Streaming Optimization

```typescript
// Accumulate in ref (no re-render)
pendingContentRef.current += data.delta;

// Batch via requestAnimationFrame (one render per frame)
if (!updateScheduledRef.current) {
  updateScheduledRef.current = true;
  requestAnimationFrame(() => {
    const content = pendingContentRef.current;
    const msgId = assistantMessageIdRef.current;
    setMessages((prev) =>
      prev.map((msg) => msg.id === msgId ? { ...msg, content } : msg)
    );
    updateScheduledRef.current = false;
  });
}
```

### Safety Bounds

- **500K character limit:** Aborts stream if response exceeds 500,000 characters
- **AbortController:** User can cancel via stop button at any time
- **Empty message cleanup:** Removes empty assistant placeholders after stream ends
- **Final flush:** Ensures last pending content is written to state on stream end

### Error Handling

- `AbortError` is silently ignored (user cancelled)
- Other errors: console.error + toast + visible error message in chat:
  ```
  "Something went wrong. Please try again."
  ```

---

## 11. Conversation Lifecycle

### Initialization Flow

```
useEffect (on mount) →
  ├── If activeConversation exists →
  │   ├── Load messages via tRPC fetch
  │   └── If 0 messages → triggerGreeting(convId)
  └── If no conversation →
      ├── ensureConversation() → createConversation mutation
      └── triggerGreeting(newConvId)
```

### Auto-Greeting

- Agent sends the first message automatically (no fake user "hello" visible)
- Uses `isGreeting: true` flag → backend skips RAG, memories, style loading for speed
- `greetingSentRef` prevents duplicate greetings
- On failure: toast + reset ref so user can retry

### Conversation Deduplication

```typescript
// ensureConversation() deduplicates concurrent calls
if (creatingConversationRef.current) return creatingConversationRef.current;
const promise = new Promise<string>((resolve, reject) => {
  createConversation.mutate({ agentId }, { onSuccess: (data) => resolve(data.id) });
});
creatingConversationRef.current = promise;
```

### Flow Mode

If agent has `flowData` (nodes + edges), messages stream from `/api/agents/flow/execute` instead of `/api/agents/chat`. Flow-specific events: `node-start`, `node-complete`, `node-reused`, `node-error`, `flow-complete`, `flow-error`.

### Send Message Flow

```
handleSend(message) →
  1. Add user message to state (optimistic)
  2. ensureConversation()
  3. if hasFlow → streamFlowChat(convId, message)
     else → streamChat(convId, message)
```

---

## 12. Inline Components

### Registry

**File:** `features/agents/lib/inline-component-registry.ts`

All components are **lazy-loaded** to keep the initial bundle small. Tool names use `render_` prefix (e.g., `render_inline_buttons` → `InlineButtons`).

### Shared Interface

```typescript
interface InlineComponentProps<T = unknown> {
  props: Record<string, unknown>;     // Config from LLM tool call input
  onResponse: (value: T) => void;     // User interaction callback
  isLocked: boolean;                   // Read-only after user responds
}
```

### HITL (Human-in-the-Loop) Bridge

When a user interacts with an inline component:

1. `onAddToolResult(toolCallId, result)` is called
2. Component is **locked** (`isLocked: true`)
3. User's response is added as a new user message
4. Agent continues streaming with the response as context

### Component Catalog

#### Tier 1 — Briefing Essentials

| Component | Tool Name | Purpose |
|-----------|-----------|---------|
| `InlineButtons` | `render_inline_buttons` | 2-4 quick-choice buttons |
| `InlineRadio` | `render_inline_radio` | Single selection from list |
| `InlineCheckboxes` | `render_inline_checkboxes` | Multiple selection |
| `InlineSlider` | `render_inline_slider` | Range slider with min/max/step |
| `InlineApproval` | `render_inline_approval` | Confirm / Adjust / Cancel buttons |
| `DNACard` | `render_dna_card` | Profile/data card display |

#### Tier 2 — Extended Input

| Component | Tool Name | Purpose |
|-----------|-----------|---------|
| `InlineFileUpload` | `render_inline_file_upload` | Drag-drop file upload |
| `InlineTextTags` | `render_inline_text_tags` | Tag input with autocomplete |
| `InlineDatePicker` | `render_inline_date_picker` | Date/range selection |

#### Tier 3 — Progress / Status

| Component | Tool Name | Purpose |
|-----------|-----------|---------|
| `InlineProgress` | `render_inline_progress` | Progress bar + metrics + activity feed |
| `InlineSteps` | `render_inline_steps` | Step-by-step status tracker |
| `ChatThinking` | (sentinel `__thinking__`) | 3 bouncing dots + label |
| `ChatConnectorBlock` | (sentinel `__connector__`) | Compact integration status |

#### Tier 4 — Output

| Component | Tool Name | Purpose |
|-----------|-----------|---------|
| `InlinePreview` | `render_inline_preview` | Content preview/spotlight |
| `InlineCompare` | `render_inline_compare` | Side-by-side comparison |
| `InlineTable` | `render_inline_table` | Data table with columns/rows |
| `InlineFile` | `render_inline_file` | File display/download |
| `InlineLink` | `render_inline_link` | Clickable link with metadata |
| `InlineChart` | `render_inline_chart` | Data visualization |
| `InlineNextAction` | `render_inline_next_action` | Next step CTA |
| `InlineScheduler` | `render_inline_scheduler` | Calendar/scheduling widget |

### Tool UI Registration

**File:** `features/agents/components/chat/tool-uis/tool-ui-registry.tsx`

All 20 tool UIs are mounted inside `<AssistantRuntimeProvider>` as a flat list. Sentinel tools (`__thinking__`, `__connector__`, `__progress__`) are non-interactive.

---

## 13. Message Types

**File:** `features/agents/types/chat-messages.ts`

### `ChatMessageExtended`

```typescript
interface ChatMessageExtended {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;

  // Message type discriminator
  messageType?: "text" | "component" | "thinking" | "progress" | "connector";

  // Component fields (when messageType === "component")
  componentName?: string;
  componentProps?: Record<string, unknown>;

  // Interaction state
  isLocked?: boolean;        // Component disabled after user responds
  userResponse?: unknown;     // Value user selected

  // Connector block fields (when messageType === "connector")
  connectorName?: string;
  connectorIcon?: string;
  connectorAction?: string;
  connectorStatus?: "running" | "done" | "error";

  // Tool fields (backward compat)
  toolName?: string;
  toolCallId?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  nodeIcon?: string;
  nodeType?: string;
}
```

### Supporting Types

```typescript
type AgentMessageType = "text" | "component" | "thinking" | "progress" | "connector";

type ContextPanelStatus = "idle" | "configuring" | "running" | "done" | "error" | "scheduled";

interface Metric {
  label: string;
  value: number | string;
  trend?: "up" | "down" | "neutral";
}

interface StepIndicator {
  label: string;
  status: "done" | "running" | "pending";
}

interface FeedItem {
  icon: string;
  text: string;
  timestamp: string;
  priority: "normal" | "high" | "error";
}
```

---

## 14. Tool Activity Labels

**File:** `features/agents/lib/tool-labels.ts`

Activity labels shown in the typing indicator while the agent processes tool calls.

### Label Map (selected entries)

| Tool Name | Label |
|-----------|-------|
| `send_email` | "Sending email" |
| `list_emails` | "Checking emails" |
| `search_emails` | "Searching emails" |
| `list_events` | "Checking calendar" |
| `create_calendar_event` | "Creating event" |
| `send_slack_message` | "Sending Slack message" |
| `search_notion_pages` | "Searching Notion" |
| `read_sheet` | "Reading spreadsheet" |
| `web_search` | "Searching the web" |
| `save_memory` | "Saving to memory" |
| `search_knowledge` | "Searching knowledge base" |
| `hubspot_search_contacts` | "Searching HubSpot" |
| `xero_get_invoices` | "Checking Xero" |

### Fallback Rules

```typescript
if (toolName.startsWith("render_")) return "Preparing response";
if (toolName.startsWith("talk_to_")) return `Talking to ${name}`;
if (toolName.startsWith("run_workflow_")) return "Running workflow";
// Default: snake_case → "Sentence case"
```

---

## 15. Agent Visual Identity

**File:** `lib/agent-display.ts`

### `getAgentConfig(agentName, templateIcon?, templateColor?)`

Returns `{ icon: PhosphorIcon, gradient: string, emoji?: string, color?: string }`.

**Priority:** Template emoji/color > exact name match > keyword match > default.

### Exact Match Configs (14)

| Name Pattern | Icon | Gradient |
|-------------|------|----------|
| lead generator | `Target` | `from-amber-400 to-orange-500` |
| lead outreacher | `EnvelopeOpen` | `from-violet-400 to-purple-500` |
| customer support | `Headset` | `from-pink-400 to-rose-500` |
| support chatbot | `ChatDots` | `from-pink-400 to-rose-500` |
| email assistant | `EnvelopeOpen` | `from-indigo-400 to-blue-600` |
| meeting scheduler | `CalendarCheck` | `from-sky-400 to-blue-600` |
| meeting notetaker | `Microphone` | `from-indigo-400 to-violet-600` |
| newsletter writer | `Newspaper` | `from-green-400 to-emerald-600` |
| content creator | `Palette` | `from-fuchsia-400 to-pink-600` |
| resume screener | `FileText` | `from-amber-400 to-yellow-600` |
| recruiting agent | `UserPlus` | `from-indigo-400 to-blue-600` |
| web researcher | `Globe` | `from-emerald-400 to-teal-600` |
| voice of customer | `ChatText` | `from-blue-400 to-indigo-500` |
| phone support | `PhoneCall` | `from-indigo-400 to-violet-500` |

### Keyword Fallbacks (17)

sales/lead → amber-orange, support/chat → pink-rose, email → indigo-blue, phone/call → cyan-teal, meeting → sky-blue, newsletter → green-emerald, content → fuchsia-pink, recruit → indigo-blue, resume → amber-yellow, research/web → emerald-teal, voice → blue-indigo, project → blue-indigo, task → violet-purple

### Default

`{ icon: Robot, gradient: "from-blue-400 to-blue-600" }`

### Agent Color Palette (8 colors)

```
#6366F1 (Indigo), #3B82F6 (Blue), #8B5CF6 (Violet), #06B6D4 (Cyan),
#0EA5E9 (Sky), #7C3AED (Purple), #2563EB (Blue-600), #4F46E5 (Indigo-600)
```

---

## 16. State Management

### Client State (React hooks in `AgentChat`)

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `messages` | `ChatMessageExtended[]` | `[]` | All messages in current conversation |
| `isStreaming` | `boolean` | `false` | Whether LLM is streaming |
| `conversationId` | `string \| null` | `null` | Current conversation ID |
| `isContextOpen` | `boolean` | `true` | Context panel visibility |
| `contextStatus` | `ContextPanelStatus` | `"idle"` | Agent execution status |
| `activityLabel` | `string \| null` | `null` | Current tool activity label |

### Refs (for streaming performance)

| Ref | Type | Purpose |
|-----|------|---------|
| `abortControllerRef` | `AbortController \| null` | Cancel streaming |
| `pendingContentRef` | `string` | Accumulate streamed text (no re-render) |
| `assistantMessageIdRef` | `string` | Track current message being streamed |
| `updateScheduledRef` | `boolean` | RAF debounce flag |
| `greetingSentRef` | `boolean` | Prevent duplicate greetings |
| `conversationIdRef` | `string \| null` | Stable ref for async closures |
| `creatingConversationRef` | `Promise<string> \| null` | Dedup concurrent creates |

### Activity Context

```typescript
interface AgentActivityState {
  label: string | null;   // e.g., "Searching knowledge...", "Sending email"
}

export const AgentActivityContext = createContext<AgentActivityState>({ label: null });
export function useAgentActivity(): AgentActivityState { return useContext(AgentActivityContext); }
```

### Server State (TanStack Query via tRPC)

| Hook | Query Key | Purpose |
|------|-----------|---------|
| `useSuspenseAgent(id)` | `["agents", "getAgent"]` | Agent data |
| `useSuspenseConversations(agentId)` | `["agents", "getConversations"]` | Conversation list |
| `useCreateConversation()` | mutation | Create new conversation |

---

## 17. Backend Pipeline (`/api/agents/chat`)

**File:** `app/api/agents/chat/route.ts` (~2000 lines)

### Request Flow

```
1. Auth (Better Auth session)
2. Input validation (Zod: conversationId is CUID, messages array)
3. Fetch conversation + agent + workspace (with includes)
4. RBAC check (resolveWorkspace + canAccessResource)
5. AgentTracer initialization (for observability)
6. Parallel context loading:
   ├── RAG search (searchKnowledge, limit 5, minScore 0.7)
   ├── Agent memories (getRelevantMemories)
   ├── Style corrections (formatStyleCorrectionsForPrompt)
   └── Skills (loadSkills, market-aware)
7. System prompt construction:
   ├── Personality (3-layer: vertical + market + DB overrides)
   ├── Base agent systemPrompt
   ├── Briefing config (if template with briefSchema)
   ├── Agent context field
   ├── Company DNA (workspace.companyDna)
   ├── Agent memories
   ├── Client brief (agent.briefData)
   ├── RAG context
   ├── Style corrections
   └── Memory management instructions
8. Build tool array:
   ├── Workflow tools (from agentTools)
   ├── Agent connection tools (talk_to_{alias})
   ├── Skill tools (market-aware integrations)
   ├── Inline tools (render_* components)
   └── Memory tools (save/get/delete memory)
9. ClaudeClient.chatStream() — Sonnet tier, max 5 steps
10. Stream SSE events to client
11. Post-stream:
    ├── Save assistant message to DB
    ├── Extract and save memories
    ├── Record metrics
    ├── Run eval L1/L2/L3
    ├── Dispatch proposal generation (every ~10 conversations)
    └── Complete tracer
```

### Tool Execution Loop

- Max 5 steps (tool call rounds)
- 30s timeout per tool execution
- Inline tools: return `{ rendered: true }` (no real execution)
- Side-effect tools: respect autonomy tier (FULL/AUTO/REVIEW)
- Each tool call: saved as Message (role: TOOL), logged in tracer, logged as activity

### Key Constants

```typescript
export const maxDuration = 300;  // 5 minutes for Pro plan
```

---

## 18. Design Tokens & Dependencies

### Framework Dependencies

| Package | Usage |
|---------|-------|
| `@assistant-ui/react` | Thread/Composer/Message primitives, `ExternalStoreRuntime` |
| `@assistant-ui/react-markdown` | `MarkdownTextPrimitive` with `smooth` streaming |
| `@phosphor-icons/react` | Primary icon library (Robot, ArrowLeft, PaperPlaneTilt, StopCircle, etc.) |
| `react-icons/si` | Brand icons (Gmail, HubSpot, Slack, Xero, etc.) |
| `sonner` | Toast notifications |
| `next/link` | Navigation links |

### Tailwind Utilities

| Utility | Source |
|---------|--------|
| `cn()` | `clsx` + `tailwind-merge` |
| `bg-elevay-mesh` | Custom Tailwind class (subtle mesh gradient background) |
| `typing-dot` | Global CSS animation (bouncing dots) |
| `scrollbar-thin` | Scrollbar styling |

### Design Tokens

| Token | Value |
|-------|-------|
| Message font size | `text-[13.5px]` |
| Composer font size | `text-[14px]` |
| Section title | `text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px]` |
| Badge font size | `text-[10px]` |
| Agent name (header) | `text-sm font-semibold` |
| Content max width | `max-w-[720px]` |
| Message max width | `max-w-[85%]` |
| Context panel width | `w-[320px]` |
| Avatar size (header) | `size-7` (28px) |
| Avatar size (message) | `size-8` (32px) |
| Avatar size (greeting) | `size-16` (64px) |
| Border radius (assistant) | `rounded-[16px_16px_16px_4px]` |
| Border radius (user) | `rounded-[16px_16px_4px_16px]` |
| Border radius (avatar) | `rounded-lg` |
| Border radius (composer) | `rounded-xl` |
| Blur effect | `backdrop-blur-sm` |
| Primary gradient | `from-indigo-500 to-violet-600` |
| Animation | `fade-in-up 0.3s ease-out` |

### Accessibility

- All interactive elements have `aria-label`
- Status badge has `aria-live="polite"`
- Typing indicator has `role="status"` + `aria-label`
- Screen reader streaming announcements via `sr-only` div with `aria-live="polite"`
- Icons are `aria-hidden="true"`
- Avatars are `aria-hidden="true"`
- Scroll-to-bottom pill has `aria-label="Scroll to latest message"`

### Custom CSS (globals.css)

These custom styles MUST be present in the global stylesheet for the chat to render correctly.

#### Mesh Gradient Background

```css
/* Light mode — warm multi-color mesh */
.bg-elevay-mesh {
  background:
    radial-gradient(ellipse 80% 60% at 15% 20%, rgba(23, 195, 178, 0.30) 0%, transparent 70%),
    radial-gradient(ellipse 70% 50% at 75% 15%, rgba(44, 107, 237, 0.28) 0%, transparent 65%),
    radial-gradient(ellipse 60% 55% at 60% 70%, rgba(255, 122, 61, 0.25) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 25% 80%, rgba(217, 119, 6, 0.22) 0%, transparent 55%),
    radial-gradient(ellipse 90% 70% at 50% 50%, rgba(255, 247, 237, 0.35) 0%, transparent 80%);
}

/* Dark mode — same colors at reduced opacity */
.dark .bg-elevay-mesh {
  background:
    radial-gradient(ellipse 80% 60% at 15% 20%, rgba(23, 195, 178, 0.16) 0%, transparent 70%),
    radial-gradient(ellipse 70% 50% at 75% 15%, rgba(44, 107, 237, 0.18) 0%, transparent 65%),
    radial-gradient(ellipse 60% 55% at 60% 70%, rgba(255, 122, 61, 0.14) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 25% 80%, rgba(217, 119, 6, 0.12) 0%, transparent 55%);
}
```

**Color breakdown of the mesh:**
- Top-left: Teal `rgba(23, 195, 178)` — 30% light / 16% dark
- Top-right: Blue `rgba(44, 107, 237)` — 28% light / 18% dark
- Bottom-right: Orange `rgba(255, 122, 61)` — 25% light / 14% dark
- Bottom-left: Amber `rgba(217, 119, 6)` — 22% light / 12% dark
- Center: Warm white `rgba(255, 247, 237)` — 35% light only

Applied as `pointer-events-none absolute inset-0` overlay on the chat viewport.

#### Fade-in-up Animation

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Used on message bubbles (`0.3s ease-out`), greeting loader (`0.5s`), scroll pill (`0.2s`), activity label (`0.15s`).

#### Typing Dot Animation

```css
@keyframes typing-dot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.typing-dot {
  animation: typing-dot 1.2s infinite;
}
.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}
```

#### Consecutive Message Collapsing

```css
/* Hide tool-call-only assistant messages before the final text response */
.aui-assistant-msg:has(+ .aui-assistant-msg) {
  display: none;
}
```

This ensures only the final assistant message in a sequence is visible. Tool call results render inside the next message's tool UI.

#### Thread Max Width

```css
[data-aui-thread] {
  --aui-thread-max-width: 720px;
}
```

---

## 19. Visual Reference — Chat Layout

```
+--------------------------------------------------------------------+
| [<] Agent Name [icon]  [Ready]                   [gear] [sidebar]  |  <- ChatHeader
+--------------------------------------------------------------------+
|                                                       |             |
|    +--- max-w-[720px] centered ---+                   |  CONTEXT    |
|    |                               |                   |  PANEL      |
|    |  [avatar] +-----------------+ |                   |  (320px)    |
|    |           | Agent message    | |                   |             |
|    |           | with markdown    | |                   |  About      |
|    |           | support and      | |                   |  --------   |
|    |           | streaming cursor | |                   |  Caps       |
|    |           +-----------------+ |                   |  [Gmail]    |
|    |                               |                   |  [HubSpot]  |
|    |      +------------------+ |   |                   |  [Slack]    |
|    |      | User message     | |   |                   |  --------   |
|    |      | right-aligned    |--   |                   |  Info       |
|    |      +------------------+     |                   |  Model: S   |
|    |                               |                   |  Convs: 12  |
|    |  [avatar] +-----------------+ |                   |  --------   |
|    |           | [*] [*] [*]     | |                   |  Links      |
|    |           | Typing dots...  | |                   |  Brief      |
|    |           +-----------------+ |                   |  Settings   |
|    |                               |                   |  Memory     |
|    +-------------------------------+                   |             |
|                                                       |             |
|    ..... bg-elevay-mesh (teal/blue/orange/amber) .... |             |
|                                                       |             |
|              [v Scroll to bottom]                      |             |
|    +-------------------------------+                   |             |
|    | [Message agent...        ] [>]|                   |             |
|    +-------------------------------+                   |             |
+--------------------------------------------------------------------+
```

### Bubble Shapes (asymmetric border radius)

```
Assistant bubble:                    User bubble:
+------------------+                     +------------------+
|                  |                     |                  |
|   Agent text     |                     |    User text     |
|                  |                     |                  |
+--            ----+                     +----            --+
  ^ 4px corner                                   4px corner ^

rounded-[16px_16px_16px_4px]         rounded-[16px_16px_4px_16px]
(bottom-left tight)                  (bottom-right tight)
```

### Color Scheme

```
Mesh background (light mode):
  +-----------------------------------------+
  |  teal (30%)     |      blue (28%)       |
  |  @ 15%,20%      |      @ 75%,15%       |
  |                  |                       |
  |        warm white (35%) center           |
  |                  |                       |
  |  amber (22%)     |     orange (25%)     |
  |  @ 25%,80%      |      @ 60%,70%       |
  +-----------------------------------------+

Agent avatar gradient (default):
  from-indigo-500 (#6366F1) → to-violet-600 (#7C3AED)
  Direction: 135deg (top-left → bottom-right)

Agent color palette:
  #6366F1  #3B82F6  #8B5CF6  #06B6D4
  #0EA5E9  #7C3AED  #2563EB  #4F46E5
```

---

## 20. Key Source Files

| File | Role |
|------|------|
| `src/components/chat/agent-chat.tsx` | Main chat container, streaming, state |
| `src/components/chat/thread.tsx` | Thread layout with assistant-ui primitives |
| `src/components/chat/composer.tsx` | Chat input (textarea + send/stop) |
| `src/components/chat/assistant-message.tsx` | Agent bubble + markdown + cursor + typing |
| `src/components/chat/user-message.tsx` | User bubble |
| `src/components/chat/greeting-loader.tsx` | Initial loading state |
| `src/components/chat/scroll-to-bottom.tsx` | Floating scroll pill |
| `src/components/chat/agent-runtime-provider.tsx` | assistant-ui bridge |
| `src/components/chat/activity-bar.tsx` | Activity label context |
| `src/components/chat/inline/lead-table-card.tsx` | Lead table inline component |
| `src/components/chat/inline/email-preview-card.tsx` | Email preview inline component |
| `src/components/chat/inline/campaign-summary-card.tsx` | Campaign summary inline component |
| `src/components/chat/inline/progress-bar.tsx` | Progress bar inline component |
| `src/lib/inline-component-registry.ts` | Lazy component registry |
| `src/lib/ai-events.ts` | SSE event types |
| `src/app/api/agents/chat/route.ts` | Chat API endpoint |
