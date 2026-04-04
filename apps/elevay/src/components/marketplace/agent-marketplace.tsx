"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  TrendingUp,
  Brain,
  Share2,
  Mail,
  BarChart2,
  Lock,
  ArrowRight,
  Sparkles,
  Sun,
  Moon,
  Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────

type AgentStatus = "available" | "coming-soon";
type AgentCategory =
  | "all"
  | "seo"
  | "brand"
  | "influence"
  | "social"
  | "email"
  | "analytics";

interface AgentFamily {
  id: string;
  category: AgentCategory;
  name: string;
  tagline: string;
  description: string;
  agentCount: number;
  status: AgentStatus;
  route: string;
  gradient: string;
  icon: React.ReactNode;
  agents: string[];
  badge?: string;
}

// ─── Data ─────────────────────────────────────────────────

const AGENT_FAMILIES: AgentFamily[] = [
  {
    id: "seo-geo",
    category: "seo",
    name: "SEO & GEO",
    tagline: "Dominate Google and generative search engines",
    description:
      "Technical audit, keyword strategy, SEO writing, continuous optimization, and AI visibility (SGE, Copilot, Perplexity).",
    agentCount: 8,
    status: "available",
    route: "/dashboard",
    gradient: "from-[#17c3b2] to-[#0ea5a0]",
    icon: <TrendingUp size={28} strokeWidth={1.5} />,
    agents: [
      "Technical audit",
      "KW strategy",
      "Page writing",
      "Blog & Clusters",
      "Meta descriptions",
      "ALT texts",
      "Continuous optimization",
      "AI citability score",
    ],
    badge: "8 agents",
  },
  {
    id: "brand-intel",
    category: "brand",
    name: "Brand & Market Intelligence",
    tagline: "Understand your market in real time",
    description:
      "Brand positioning analysis, competitive monitoring, market trends, and brand intelligence for data-driven decisions.",
    agentCount: 3,
    status: "available",
    route: "/brand-intel",
    gradient: "from-[#FF7A3D] to-[#e05a20]",
    icon: <Brain size={28} strokeWidth={1.5} />,
    agents: ["Brand Performance", "Market Trends", "Competitive Intel"],
    badge: "3 agents",
  },
  {
    id: "influence",
    category: "influence",
    name: "Influencer & Campaigns",
    tagline: "Find the perfect influencers for your brand",
    description:
      "AI-powered influencer discovery, compatibility scoring, collaboration briefs, and campaign planning across Instagram, TikTok, YouTube, and LinkedIn.",
    agentCount: 1,
    status: "available",
    route: "/influence",
    gradient: "from-[#17c3b2] to-[#0ea5a0]",
    icon: <Users size={28} strokeWidth={1.5} />,
    agents: ["Influencer Discovery"],
    badge: "1 agent",
  },
  {
    id: "social",
    category: "social",
    name: "Social Media",
    tagline: "Content and strategy across all platforms",
    description:
      "Content creation, editorial calendar, performance analysis, and recommendations by platform.",
    agentCount: 0,
    status: "coming-soon",
    route: "",
    gradient: "from-[#8b5cf6] to-[#6d28d9]",
    icon: <Share2 size={28} strokeWidth={1.5} />,
    agents: ["Content creator", "Editorial calendar", "Social analytics"],
  },
  {
    id: "email",
    category: "email",
    name: "Email Marketing",
    tagline: "Email campaigns that convert",
    description:
      "Copywriting, segmentation, A/B testing, and deliverability optimization to maximize your open and conversion rates.",
    agentCount: 0,
    status: "coming-soon",
    route: "",
    gradient: "from-[#f59e0b] to-[#d97706]",
    icon: <Mail size={28} strokeWidth={1.5} />,
    agents: ["Campaign copywriting", "Segmentation", "A/B testing"],
  },
  {
    id: "analytics",
    category: "analytics",
    name: "Performance & Analytics",
    tagline: "All your marketing KPIs in one place",
    description:
      "Unified dashboard, automated reporting, and intelligent recommendations based on all your marketing data sources.",
    agentCount: 0,
    status: "coming-soon",
    route: "",
    gradient: "from-[#ec4899] to-[#be185d]",
    icon: <BarChart2 size={28} strokeWidth={1.5} />,
    agents: ["Unified dashboard", "Auto reporting", "Recommendations"],
  },
];

const CATEGORIES: { id: AgentCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "seo", label: "SEO & GEO" },
  { id: "brand", label: "Brand Intel" },
  { id: "influence", label: "Influence" },
  { id: "social", label: "Social Media" },
  { id: "email", label: "Email" },
  { id: "analytics", label: "Analytics" },
];

// ─── Component ────────────────────────────────────────────

export function AgentMarketplace() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AgentCategory>("all");
  const [search, setSearch] = useState("");

  useEffect(() => { setMounted(true); }, []);

  const filtered = AGENT_FAMILIES.filter((f) => {
    const matchCat = activeCategory === "all" || f.category === activeCategory;
    const matchSearch =
      search.trim() === "" ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      {/* Theme toggle — top right */}
      {mounted && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      )}
      {/* Header */}
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: "rgba(23,195,178,0.12)", color: "#17c3b2" }}
        >
          <Sparkles size={12} />
          Your AI marketing agents
        </div>
        <h1
          className="text-3xl font-semibold tracking-tight mb-3"
          style={{ color: "var(--foreground)" }}
        >
          What do you want to accomplish today?
        </h1>
        <p
          className="text-base max-w-xl mx-auto"
          style={{ color: "var(--muted-foreground)" }}
        >
          Choose an agent family. Each family includes specialised agents
          that work together.
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none transition-colors"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={
                activeCategory === cat.id
                  ? { background: "#17c3b2", color: "#fff" }
                  : {
                      background: "var(--muted)",
                      color: "var(--muted-foreground)",
                    }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((family) => (
          <AgentCard
            key={family.id}
            family={family}
            onClick={() => {
              if (family.status === "available") router.push(family.route);
            }}
          />
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div
          className="text-center py-20"
          style={{ color: "var(--muted-foreground)" }}
        >
          No agent families match your search.
        </div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────

function AgentCard({
  family,
  onClick,
}: {
  family: AgentFamily;
  onClick: () => void;
}) {
  const available = family.status === "available";

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden border transition-all duration-200"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        cursor: available ? "pointer" : "default",
        opacity: available ? 1 : 0.65,
      }}
    >
      {/* Visual header */}
      <div
        className={`relative h-36 bg-gradient-to-br ${family.gradient} flex items-center justify-center`}
      >
        <div className="text-white opacity-90">{family.icon}</div>

        {/* Badge */}
        {family.badge && (
          <span
            className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
          >
            {family.badge}
          </span>
        )}

        {/* Coming soon lock */}
        {!available && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
            >
              <Lock size={11} />
              Coming soon
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h2
            className="text-base font-semibold leading-tight"
            style={{ color: "var(--foreground)" }}
          >
            {family.name}
          </h2>
          {available && (
            <ArrowRight
              size={16}
              className="mt-0.5 shrink-0 transition-transform group-hover:translate-x-1"
              style={{ color: "#17c3b2" }}
            />
          )}
        </div>

        <p className="text-xs font-medium mb-2" style={{ color: "#17c3b2" }}>
          {family.tagline}
        </p>

        <p
          className="text-sm leading-relaxed mb-4"
          style={{ color: "var(--muted-foreground)" }}
        >
          {family.description}
        </p>

        {/* Agent pills */}
        <div className="flex flex-wrap gap-1.5">
          {family.agents.map((agent) => (
            <span
              key={agent}
              className="px-2 py-0.5 rounded-md text-xs"
              style={{
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              {agent}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
