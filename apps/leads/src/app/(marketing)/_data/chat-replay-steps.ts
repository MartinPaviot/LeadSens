export interface ChatReplayStep {
  role: "user" | "assistant";
  content: string;
  /** Delay in ms before showing this step */
  delay: number;
  /** Optional: show typing indicator for this duration before revealing */
  typingDuration?: number;
  /** Optional: tags to display below the message */
  tags?: Array<{ text: string; color: string }>;
}

export const CHAT_REPLAY_STEPS: ChatReplayStep[] = [
  {
    role: "user",
    content:
      "Find me VP Sales in B2B SaaS companies, 50-500 employees, US and UK, revenue over $10M",
    delay: 800,
  },
  {
    role: "assistant",
    content: "Parsing your ICP...",
    delay: 600,
    typingDuration: 1200,
    tags: [
      { text: "VP Sales", color: "#0d9488" },
      { text: "B2B SaaS", color: "#0284c7" },
      { text: "US + UK", color: "#2563eb" },
      { text: "50-500 emp", color: "#ea580c" },
      { text: "> $10M", color: "#b45309" },
    ],
  },
  {
    role: "assistant",
    content: "Found 2,847 leads matching your criteria. Scoring with fit + intent + timing...",
    delay: 1800,
    typingDuration: 1000,
  },
  {
    role: "assistant",
    content:
      "Top 312 leads scored 8+/10. Enriching with company data, LinkedIn profiles, and hiring signals...",
    delay: 2000,
    typingDuration: 800,
  },
  {
    role: "assistant",
    content:
      "Drafting 6-step email sequences with personalized openers. Each email uses a different framework: PAS, Value-add, Social Proof...",
    delay: 2200,
    typingDuration: 1000,
  },
  {
    role: "assistant",
    content:
      "Campaign ready. 312 leads, 6 steps each, 3 subject line variants per step. A/B testing enabled. Push to Instantly?",
    delay: 1500,
    typingDuration: 800,
  },
  {
    role: "user",
    content: "Yes, launch it",
    delay: 2000,
  },
  {
    role: "assistant",
    content:
      "Campaign launched! Monitoring replies, auto-classifying responses, and routing interested leads to HubSpot. I'll pause underperforming variants automatically.",
    delay: 800,
    typingDuration: 1200,
  },
];
