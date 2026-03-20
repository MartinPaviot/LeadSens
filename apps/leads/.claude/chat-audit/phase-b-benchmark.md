# Phase B — Competitive Benchmark: Claude.ai & ChatGPT

> Benchmark date: 2026-03-16
> Phase A reference: `phase-a-audit.md` (52/70, 74%)
> Method: Live Playwright MCP browsing (Claude.ai logged in, ChatGPT logged out) + product expertise
> Screenshots: `.claude/chat-audit/screenshots/` (claude-* and chatgpt-*)

---

## B.1 Claude.ai Analysis

### B.1.1 Layout & Structure

**Sidebar (280px, collapsible)**
- Top: "Claude" logo + sidebar toggle (Ctrl+Shift+O = new chat)
- Actions: "Nouvelle conversation", "Rechercher" (Ctrl+K), "Personnaliser"
- Sections: Discussions, Projets, Artéfacts, Code (4 top-level categories)
- Recent conversations: flat list, truncated titles (~35 chars), "..." context menu on hover
- Bottom: User avatar (initial letter) + name + plan ("Plan Max") + download button + settings chevron
- Sidebar can be fully collapsed to icon rail (7 icons: toggle, new, search, customize, discussions, projects, artifacts, code, download, profile)

**Main area**
- Max-width: ~720px content area, centered
- Greeting: "{emoji} Bon après-midi, Martin" — time-aware, personalized
- Subtle warm beige background (`#faf8f5`-ish)
- Top bar in conversation: editable title (click) + dropdown chevron + "Partager" (Share) button

**Key UX pattern**: Clean, minimal, literary feel. No visual noise. Warm palette (beige, terracotta asterisk). Sidebar feels like a document library, not a chat history.

**Screenshots**: `claude-01-dashboard.png`, `claude-01-dashboard-sidebar.png`, `claude-10-sidebar-expanded.png`

### B.1.2 Composer

**Composer (centered, rounded rect, ~660px wide)**
- Placeholder: "Comment puis-je vous aider ?" (empty state) / "Répondre..." (in conversation)
- Auto-resize: grows vertically with content
- Left: "+" menu button
- Right: Model selector ("Sonnet 4.6" dropdown) + voice mode button (audio waves icon)
- Send: appears as arrow button when text is present

**"+" Menu (7 items)**
1. Ajouter des fichiers ou des photos (Add files/photos)
2. Prendre une capture d'écran (Take screenshot)
3. Ajouter au projet (Add to project) — sub-menu
4. Ajouter depuis GitHub (Add from GitHub)
5. Recherche (Search)
6. Recherche Web (Web search) — toggle, checkmark when active
7. Utiliser le style (Use style) — sub-menu
8. Ajouter des connecteurs (Add connectors)

**Model Selector**
- Dropdown: Opus 4.6 ("Le plus performant pour les travaux ambitieux"), Sonnet 4.6 (checkmark, "Most efficient for everyday tasks"), Haiku 4.5 ("Le plus rapide pour les réponses rapides")
- Extended Thinking toggle: "Réflexion étendue — Réfléchir plus longtemps pour les tâches complexes" with on/off switch
- "Plus de modèles" link for more options

**Suggestion Chips (5 categories, tablist)**
- Code (`</>` icon), Créer (sparkle), Stratégiser (chart), Écrire (pencil), Apprendre (brain)
- Below composer in empty state only, disappear once conversation starts

**Bottom disclaimer**: "Claude est une IA et peut faire des erreurs. Veuillez vérifier les réponses." with link

**Screenshots**: `claude-02-new-chat.png`, `claude-03-composer.png`

### B.1.3 Streaming & Thinking

**Streaming**
- Character-by-character rendering (smooth, not chunky)
- No visible cursor/caret during streaming
- Claude asterisk logo (⊛) appears as avatar below response during/after streaming
- Scroll-to-bottom pill appears when scrolled up

**Extended Thinking**
- Separate collapsible block above response
- Shows thinking steps with status indicators
- Timer showing elapsed thinking time
- Can be toggled per-message via model selector

**Screenshots**: `claude-04-streaming.png`

### B.1.4 Message Rendering & Actions

**User Message**
- Right-aligned, dark background bubble (dark brown/charcoal)
- White text
- On hover: action bar appears below with timestamp + Retry + Edit + Copy buttons
- Edit: replaces message with editable textbox, re-sends
- Timestamp shown on hover (e.g., "11:49")

**Assistant Message**
- Left-aligned, no bubble (flat against background)
- Markdown rendering: headers, bold, inline code (`monospace`), paragraphs
- Code blocks: language tag (e.g., "python") top-left, "Copier dans le presse-papiers" button top-right, syntax highlighting (purple keywords, green strings, blue builtins)
- Below message: action row with 4 icons: Copy, Thumbs up, Thumbs down, Retry
- Claude asterisk avatar (⊛, terracotta) at bottom of message

**Code Block Quality**
- Full syntax highlighting (token-level coloring)
- Language label
- One-click copy button
- Dark-on-light color scheme
- No line numbers (clean look)
- No "Run" button (unlike some competitors)

**Screenshots**: `claude-04-streaming.png`, `claude-05-message.png`, `claude-13-message-actions.png`

### B.1.5 Artifacts & Side Panel

**Artifacts System**
- Dedicated "Artéfacts" section in sidebar (top-level navigation)
- When Claude generates code/documents, creates an artifact in a slide-out side panel
- Side panel: right side, ~50% width, resizable
- Artifact types: code, documents, React components (live preview), SVG, Mermaid diagrams
- Version control: multiple iterations tracked, can revert
- Inline link in message: clickable reference to artifact
- "Open in Claude Code" integration for code artifacts

**Key insight**: Artifacts are a first-class concept — they have their own library, versioning, and can be shared independently from conversations.

### B.1.6 Tool Use & Web Search

**Web Search**
- Toggle in "+" menu (checkmark when enabled)
- When active: Claude can search the web and cite sources
- Results shown inline with source links
- No separate "search results" card — woven into response

**Connectors (MCP)**
- "Ajouter des connecteurs" in "+" menu
- MCP-based architecture for external tools
- Connectors available: Google Drive, GitHub, and growing list
- Each connector has its own auth flow

**GitHub Integration**
- "Ajouter depuis GitHub" — can reference repos, files, PRs
- Deep integration for code review workflows

### B.1.7 Conversation Management

**Context Menu (3-dot "..." on hover)**
- Ajouter aux favoris (Add to favorites)
- Renommer (Rename) — inline editing in sidebar
- Ajouter au projet (Add to project) — organize into projects
- ─── separator ───
- Supprimer (Delete)

**Title**
- Auto-generated from first message
- Editable: click title in top bar → dropdown → rename
- Also renamable from sidebar context menu

**Search**
- Ctrl+K: opens search modal
- Searches across all conversations
- Recent results shown inline

**Projects**
- Group conversations into projects
- Project-level context (files, instructions)
- Shared with team (on Team/Enterprise plans)

**Screenshots**: `claude-16-conv-management.png`

### B.1.8 UX Intelligences (Memory, Personalization, Styles)

**Customize Hub** (`/customize`)
- Two main sections: Compétences (Skills) and Connecteurs (Connectors)
- "Connectez vos outils" — MCP connector setup
- "Créer de nouvelles compétences" — teach Claude your processes, team standards, expertise

**Memory**
- Claude remembers context across conversations
- No explicit "memory" settings page (unlike ChatGPT)
- Memory is implicit — Claude learns from conversation patterns
- Skills system replaces explicit memory: you define instructions Claude follows

**Styles**
- "Utiliser le style" in "+" menu
- Custom response styles (formal, concise, creative, etc.)
- Applied per-message or as default

**User Menu**
- Email, Paramètres (Settings, Shift+Ctrl+,), Langue (Language), Obtenir de l'aide, Voir tous les forfaits, Obtenir des applications et extensions, Offrir Claude, En savoir plus, Se déconnecter
- Plan displayed: "Plan Max"

**Screenshots**: `claude-17-customize.png`, `claude-17-user-menu.png`

---

## B.2 ChatGPT Analysis

### B.2.1 Layout & Structure

**Sidebar (~260px, collapsible)**
- Top: OpenAI logo + sidebar toggle
- Actions: "Nouveau chat" (Ctrl+Shift+O), "Rechercher des chats" (Ctrl+K)
- Dedicated sections: Images, Applications (GPT Store), Recherche approfondie (Deep Research), Santé (Health)
- Conversations: organized by date groups ("Aujourd'hui", "Hier", "7 derniers jours", "30 derniers jours")
- Bottom (logged in): user avatar + name, upgrade button

**Main area**
- Max-width: ~768px content area, centered
- Greeting: "Poser une question" (Ask a question) — NOT personalized (no user name, no time-of-day)
- Clean white/light background
- Top bar: Model selector dropdown ("ChatGPT") + login/signup buttons (logged out) or share button (logged in)

**Key UX pattern**: More utilitarian than Claude.ai. Heavier sidebar with date-grouped conversations. Dark mode available. Less warmth, more productivity tool aesthetic.

**Screenshots**: `chatgpt-00-loggedout.png`

### B.2.2 Composer

**Composer (centered, rounded rect, ~680px wide)**
- Placeholder: "Poser une question" (Ask a question)
- Auto-resize: grows vertically
- Left: "+" button (files, photos, camera)
- Right: Voice button ("Voix" label)
- Send: arrow button appears with text
- No model selector in composer (it's in the top bar)

**"+" Menu (logged in)**
1. Upload from computer
2. Upload from Google Drive
3. Upload from OneDrive
4. Take photo (mobile)

**Model Selector (top bar dropdown)**
- ChatGPT (default — auto-routes between models)
- GPT-4o (standard)
- o3 (reasoning model, thinking mode)
- o4-mini (fast reasoning)
- GPT-4.5 (research preview)
- Deep Research (autonomous multi-step)
- Plus: DALL-E, Code Interpreter auto-enabled

**Suggestion chips**: Not present in same way. ChatGPT shows 4 suggestion cards on empty state (rotating examples like "Help me write...", "Plan a trip...", "Explain this code...", "Analyze data...")

### B.2.3 Streaming & Thinking

**Standard Streaming (GPT-4o)**
- Token-by-token rendering (slightly chunkier than Claude)
- Blinking cursor ("|") at end of stream
- Shimmer/skeleton effect on loading
- Stop button during generation

**o3 Thinking Mode**
- "Thinking..." label with animated dots
- Collapsible thinking block (similar to Claude's Extended Thinking)
- Shows reasoning steps
- Time elapsed indicator
- Can take 30s-2min for complex tasks

**Deep Research**
- Multi-step autonomous agent
- Progress panel showing: sources being searched, pages read, synthesis steps
- Can take 5-30 minutes
- Produces long-form research report

### B.2.4 Message Rendering & Actions

**User Message**
- Right-aligned, light gray bubble
- Dark text
- Edit button on hover (pencil icon)
- No explicit copy or retry on user messages

**Assistant Message**
- Left-aligned, no bubble
- GPT icon (sparkle) as avatar, left of message
- Markdown rendering: headers, bold, lists, tables, LaTeX/math (KaTeX)
- Code blocks: language tag, copy button, line numbers (optional)
- Below message: action row with icons: Copy, Read Aloud (speaker), Thumbs up, Thumbs down, Regenerate, Share (arrow)
- "Read Aloud" — TTS reads the response (unique feature)

**Code Block Quality**
- Syntax highlighting (dark theme by default in code blocks)
- Language label + "Copy code" button
- Can be edited inline (with Canvas)
- "Run" button for Python code (Code Interpreter)

**Math/LaTeX**
- Native KaTeX rendering for mathematical expressions
- Significantly better than Claude.ai for technical/academic content

### B.2.5 Canvas & Side Panel

**Canvas (side panel for collaborative editing)**
- Activated by asking to write/edit code or documents
- Right-side panel, ~50% width
- Inline editing: click any part of the text/code to edit
- Shortcuts bar at bottom: suggestions for improvements
- Version history: navigate between iterations
- Code canvas: syntax highlighting, can run Python
- Document canvas: rich text editing
- Can share canvas independently

**Key differences from Claude Artifacts**:
- Canvas is more interactive (inline editing vs. view-only artifacts)
- Canvas has a shortcuts bar for quick actions ("Make shorter", "Fix bugs", "Add comments")
- Artifacts has a broader type system (Mermaid, SVG, React components)

### B.2.6 Agent Mode & Multi-Tool

**Tool orchestration (GPT-4o)**
- Web browsing (Bing) — automatic when needed
- DALL-E image generation — triggered by "create an image"
- Code Interpreter — Python sandbox, file upload/download
- All tools available simultaneously, auto-selected

**Deep Research (autonomous agent)**
- Multi-step research with tool chaining
- Progress card: "Searching...", "Reading...", "Analyzing..."
- Sources panel with numbered citations
- Can process uploaded documents

**GPTs (Custom Agents)**
- GPT Store: marketplace of specialized agents
- Custom instructions, knowledge files, API actions
- Can be published and shared

### B.2.7 Conversation Management

**Context Menu (hover on conversation in sidebar)**
- Share
- Archive
- Rename
- Delete

**Title**
- Auto-generated, editable inline (click to rename in sidebar)
- Also shows in top bar

**Search**
- Ctrl+K: search across all conversations
- Full-text search with highlighted results

**Archive**
- Archive conversations (hidden but not deleted)
- Accessible from Settings > Archived chats

**Folders/Organization**
- No native folder system (unlike Claude's Projects)
- Relies on date-based grouping + search

### B.2.8 Memory & Personalization

**Memory (explicit system)**
- Settings > Personalization > Memory
- Toggle on/off
- Claude-like: ChatGPT remembers facts across conversations
- "Remembered" indicator appears in conversation when memory is used
- "Manage memories" page: list of all stored memories, deletable individually
- Can say "Remember that..." or "Forget that..."

**Custom Instructions (2 fields)**
- "What would you like ChatGPT to know about you?"
- "How would you like ChatGPT to respond?"
- Always active across all conversations

**Personalization (GPT-4o)**
- Less warm than Claude.ai (no time-of-day greeting, no personalized name in greeting)
- But deeper memory system with explicit management UI

---

## B.3 Comparative Table

| # | Feature | Claude.ai | ChatGPT | LeadSens | Gap vs Best |
|---|---------|-----------|---------|----------|-------------|
| 1 | **Sidebar structure** | Sections (Discussions, Projects, Artifacts, Code) + collapsible to icon rail | Date-grouped + dedicated pages (Images, Apps, Deep Research) | Flat conversation list + workspace selector | **High** — No sections, no search, no collapsible rail |
| 2 | **Conversation search** | Ctrl+K, modal, cross-conversation | Ctrl+K, full-text search | None | **Critical** — Both competitors have it |
| 3 | **Greeting/empty state** | Personalized ("Bon après-midi, Martin") + 5 suggestion category tabs | Generic "Ask a question" + 4 rotating example cards | Personalized greeting + phase-aware suggestion chips + tool pills | **Ahead** — LeadSens greeting is competitive |
| 4 | **Composer** | "+" menu (8 items), model selector, voice, auto-resize | "+" (files), voice, auto-resize, model in top bar | Basic textbox, send/stop, no attachments, no voice | **Critical** — Missing file upload, voice, "+" menu |
| 5 | **Model selector** | In composer, 3 models + Extended Thinking toggle | Top bar dropdown, 5+ models + auto-routing | N/A (single model) | **N/A** — Single model is fine for vertical SaaS |
| 6 | **Streaming quality** | Smooth char-by-char, no cursor | Token-by-token with blinking cursor | RAF batching, smooth | **OK** — LeadSens streaming is solid |
| 7 | **Thinking/progress** | Extended Thinking (collapsible, timed) | o3 thinking (collapsible, timed) | ThinkingBlock (steps, icons, dedup) | **Ahead** — LeadSens ThinkingBlock is best-in-class for agent use case |
| 8 | **User message actions** | Timestamp + Retry + Edit + Copy | Edit | None | **Critical** — No edit, no retry, no copy |
| 9 | **Assistant message actions** | Copy + Thumbs up/down + Retry | Copy + Read Aloud + Thumbs up/down + Regenerate + Share | Copy only | **High** — Missing feedback, retry, share |
| 10 | **Code blocks** | Syntax highlighting + copy + language tag | Syntax highlighting + copy + language tag + run (Python) | None (not needed for B2B email) | **Low** — Not core to use case |
| 11 | **Side panel / Artifacts** | Artifacts library, versioned, React/SVG/Mermaid preview | Canvas (inline edit), code runner, document editor | Inline cards (12 types) | **Different** — Inline cards are better for agent workflow |
| 12 | **File upload** | Files, photos, screenshots, GitHub | Files, Google Drive, OneDrive, photos | None | **Critical** — CSV import blocked (STRATEGY Tier A) |
| 13 | **Voice input** | Microphone button in composer | "Voix" button with advanced voice mode | None | **Low** — Nice-to-have for mobile |
| 14 | **Web search** | Toggle in "+" menu, inline citations | Auto-triggered, Bing, inline citations | N/A (agent does web scraping) | **N/A** — Different paradigm |
| 15 | **Conversation rename** | Inline in sidebar (via context menu) | Inline in sidebar (click to edit) | `window.prompt()` | **High** — Amateur feel vs polished UX |
| 16 | **Conversation delete** | Context menu → (likely confirmation dialog) | Context menu → confirmation | `window.confirm()` | **High** — Amateur feel |
| 17 | **Conversation organization** | Projects (folders with context) | Date groups + archive | Flat list only | **Medium** — Projects would help power users |
| 18 | **Memory/personalization** | Implicit (Skills system, style presets) | Explicit (toggleable, manageable, "remember/forget") | None | **Medium** — Autonomy selector is unique differentiator instead |
| 19 | **Keyboard shortcuts** | Ctrl+K (search), Ctrl+Shift+O (new), Ctrl+Shift+, (settings) | Ctrl+K (search), Ctrl+Shift+O (new) | None | **Medium** — Power user feature |
| 20 | **Message feedback** | Thumbs up + Thumbs down per message | Thumbs up + Thumbs down per message | None | **High** — Can't improve without feedback signal |
| 21 | **Share** | "Partager" button, shareable conversation links | Share per-message + conversation link | None | **Low** — Not critical for B2B agent |
| 22 | **Disclaimer/safety** | Bottom: "Claude est une IA..." with link | Bottom: terms + privacy links | None | **Low** — Should add for trust |
| 23 | **Theme** | Light only (warm beige) | Light + Dark mode | Light + Dark (via toggle) | **OK** — LeadSens has this |
| 24 | **Avatar** | Claude asterisk (⊛, terracotta) + user initial circle | GPT sparkle icon + user avatar | LeadSens logo + no user avatar | **Low** — Functional but minimal |
| 25 | **Autonomy control** | None | None | 3-level autonomy selector (Manual/Supervised/Auto) | **Unique** — LeadSens differentiator |
| 26 | **Inline rich components** | Artifacts (separate panel) | Canvas (separate panel) | 12 inline card types in conversation flow | **Unique** — LeadSens differentiator |

---

## B.4 Action Plan (Tier 1 / 2 / 3)

### Tier 1 — Critical Gaps (blocks user trust & core workflow)

| # | Action | Inspiration | Files | Complexity | UX Impact /10 |
|---|--------|-------------|-------|------------|---------------|
| 1 | **Add message editing** | Claude.ai (Edit button on user msgs) | `user-message.tsx`, `agent-chat.tsx` | M | 9/10 |
| 2 | **Add message regeneration** | Claude.ai + ChatGPT (Retry/Regenerate) | `assistant-message.tsx`, `agent-chat.tsx` | M | 9/10 |
| 3 | **Add file upload to composer** | Both ("+", files, drag-and-drop) | `composer.tsx`, new `file-upload.tsx`, API route | L | 9/10 |
| 4 | **Replace window.prompt with inline rename** | Claude.ai (sidebar inline edit) | `app-sidebar.tsx` | S | 7/10 |
| 5 | **Replace window.confirm with Dialog** | Both (proper confirmation modals) | `app-sidebar.tsx`, new `delete-dialog.tsx` | S | 7/10 |
| 6 | **Add message feedback (thumbs up/down)** | Both (per-message thumbs) | `assistant-message.tsx`, new API route, DB table | M | 8/10 |

### Tier 2 — High-Value Polish (professional feel)

| # | Action | Inspiration | Files | Complexity | UX Impact /10 |
|---|--------|-------------|-------|------------|---------------|
| 7 | **Add conversation search** | Both (Ctrl+K modal) | `app-sidebar.tsx`, new `search-dialog.tsx` | M | 8/10 |
| 8 | **Add keyboard shortcuts** | Claude.ai (Ctrl+K, Ctrl+Shift+O) | `agent-chat.tsx`, new `use-keyboard-shortcuts.ts` | S | 6/10 |
| 9 | **Improve composer with "+" menu** | Claude.ai ("+" with 8 items) | `composer.tsx`, new `composer-menu.tsx` | M | 7/10 |
| 10 | **Add hover action bar on user messages** | Claude.ai (timestamp + actions on hover) | `user-message.tsx` | S | 6/10 |
| 11 | **Collapsible sidebar with icon rail** | Claude.ai (icon rail when collapsed) | `app-sidebar.tsx` | M | 5/10 |
| 12 | **Add user avatar in messages** | Both (user avatar circle) | `user-message.tsx` | S | 4/10 |

### Tier 3 — Nice-to-Have (delight features)

| # | Action | Inspiration | Files | Complexity | UX Impact /10 |
|---|--------|-------------|-------|------------|---------------|
| 13 | **Add voice input** | Both (microphone button in composer) | `composer.tsx`, Web Speech API | M | 4/10 |
| 14 | **Add "Read Aloud" for responses** | ChatGPT (speaker icon on messages) | `assistant-message.tsx`, Web Speech API | S | 3/10 |
| 15 | **Add share conversation** | Both (shareable links) | New API route, `app-sidebar.tsx` | M | 4/10 |
| 16 | **Add conversation archive** | ChatGPT (archive vs delete) | `app-sidebar.tsx`, DB migration | S | 3/10 |
| 17 | **Add AI disclaimer footer** | Both (bottom disclaimer) | `thread.tsx` | S | 2/10 |
| 18 | **Add conversation favorites** | Claude.ai (Add to favorites) | `app-sidebar.tsx`, DB migration | S | 3/10 |
| 19 | **Time-of-day greeting variation** | Claude.ai ("Bon après-midi, Martin") | `greeting-screen.tsx` | S | 3/10 |

---

## B.5 LeadSens Unique Advantages (Keep & Amplify)

These are features where LeadSens is **ahead** of both Claude.ai and ChatGPT:

| Feature | LeadSens | Competitors | Why It Matters |
|---------|----------|-------------|----------------|
| **Autonomy Selector** | 3-level (Manual/Supervised/Auto) | None | Trust calibration unique to B2B agents — users choose their comfort level |
| **Inline Rich Cards** | 12 card types rendered in conversation flow | Side panels (Artifacts/Canvas) | Better for agent workflows — data stays in context, no panel switching |
| **Phase-Aware UX** | System prompts + suggestion chips adapt by pipeline phase | Generic suggestions | Guided journey from ICP → Campaign, not open-ended chat |
| **ThinkingBlock** | Step-by-step with icons, dedup, collapsible | Simple "Thinking..." text | Best visibility into multi-tool agent operations |
| **Domain-Specific Greeting** | Tool pills, example ICP, tag legend | Generic greeting | Immediate context: "this is a B2B prospecting tool" |

**Recommendation**: Don't lose these differentiators while closing the gaps above. The inline cards + autonomy selector + phase awareness are LeadSens's competitive moat.

---

## B.6 Priority Matrix

```
                    HIGH UX IMPACT
                         |
     Tier 1:             |           Tier 1:
     File upload (3)     |           Message edit (1)
     Feedback (6)        |           Message regen (2)
                         |
  ─────────────────────MEDIUM────────────────────────
                         |
     Tier 2:             |           Tier 2:
     Composer "+" (9)    |           Conv search (7)
     Sidebar collapse(11)|           KB shortcuts (8)
                         |
                    LOW UX IMPACT
                         |
  LOW EFFORT ────────────+──────────── HIGH EFFORT
```

### Recommended Implementation Order

1. **Rename/Delete dialogs** (S, quick win, removes "amateur" feel)
2. **Message edit + regenerate** (M, table-stakes for any chat UI)
3. **Message feedback** (M, enables improvement loop)
4. **Conversation search** (M, power user must-have)
5. **File upload** (L, unblocks CSV import = STRATEGY Tier A)
6. **Keyboard shortcuts** (S, cheap polish)
7. **Composer "+" menu** (M, professional feel)
8. **User message hover actions** (S, cheap polish)
9. Rest of Tier 2-3 as capacity allows

---

## B.7 Screenshots Reference

### Claude.ai
| File | Content |
|------|---------|
| `claude-00-login.png` | Login page + cookie consent |
| `claude-01-dashboard.png` | Dashboard (sidebar collapsed) with greeting |
| `claude-01-dashboard-sidebar.png` | Dashboard with sidebar expanded |
| `claude-02-new-chat.png` | Model selector dropdown (Opus/Sonnet/Haiku + Extended Thinking) |
| `claude-03-composer.png` | "+" menu (8 items) |
| `claude-04-streaming.png` | Code block response with syntax highlighting |
| `claude-05-message.png` | (blank) |
| `claude-10-sidebar-expanded.png` | Full sidebar with time-of-day greeting |
| `claude-13-message-actions.png` | Message with action bar (Copy, Thumbs up/down, Retry) |
| `claude-16-conv-management.png` | Conversation context menu (Favorites, Rename, Project, Delete) |
| `claude-17-customize.png` | Customize page (Skills + Connectors) |
| `claude-17-user-menu.png` | User menu (Settings, Language, Plans, etc.) |

### ChatGPT
| File | Content |
|------|---------|
| `chatgpt-00-loggedout.png` | Logged-out state (sidebar + composer + model selector) |

---

## B.8 Key Takeaways

1. **Claude.ai is the closer benchmark** — warm, clean, literary aesthetic matches LeadSens's aspirational feel. ChatGPT is more utilitarian.

2. **Both competitors have table-stakes features LeadSens lacks**: message edit, regenerate, feedback, search, file upload. These must be closed before launch.

3. **LeadSens has genuine differentiators** that neither competitor offers: autonomy selector, inline rich cards, phase-aware UX, domain-specific thinking block. These should be preserved and amplified.

4. **The gap is in polish, not in architecture**. LeadSens's SSE streaming, inline component system, and phase management are architecturally competitive. The gaps are in interaction patterns (edit, retry, search) and visual refinement (dialogs, hover states).

5. **Estimated effort to close critical gaps**: ~3-4 days of focused engineering for Tier 1 items (6 items). Tier 2 adds ~2-3 days. Total: ~1 week to reach competitive parity on interaction patterns while maintaining unique advantages.
