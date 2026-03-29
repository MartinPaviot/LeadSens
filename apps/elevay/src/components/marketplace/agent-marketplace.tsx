"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────

type AgentStatus = "available" | "coming-soon";
type AgentCategory =
  | "all"
  | "seo"
  | "brand"
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
    tagline: "Dominez Google et les moteurs génératifs",
    description:
      "Audit technique, stratégie mots-clés, rédaction SEO, optimisation continue et visibilité dans les IA (SGE, Copilot, Perplexity).",
    agentCount: 8,
    status: "available",
    route: "/seo-chat",
    gradient: "from-[#17c3b2] to-[#0ea5a0]",
    icon: <TrendingUp size={28} strokeWidth={1.5} />,
    agents: [
      "Audit technique",
      "Stratégie KW",
      "Rédaction pages",
      "Blog & Clusters",
      "Meta descriptions",
      "ALT texts",
      "Optimisation continue",
      "Score citabilité IA",
    ],
    badge: "8 agents",
  },
  {
    id: "brand-intel",
    category: "brand",
    name: "Brand & Market Intelligence",
    tagline: "Comprenez votre marché en temps réel",
    description:
      "Analyse de positionnement, veille concurrentielle, tendances marché et intelligence de marque pour des décisions fondées sur la data.",
    agentCount: 3,
    status: "available",
    route: "/chat",
    gradient: "from-[#FF7A3D] to-[#e05a20]",
    icon: <Brain size={28} strokeWidth={1.5} />,
    agents: ["Brand Performance", "Market Trends", "Competitive Intel"],
    badge: "3 agents",
  },
  {
    id: "social",
    category: "social",
    name: "Social Media",
    tagline: "Contenu et stratégie sur tous les réseaux",
    description:
      "Génération de contenu, calendrier éditorial, analyse de performance et recommandations par plateforme.",
    agentCount: 0,
    status: "coming-soon",
    route: "",
    gradient: "from-[#8b5cf6] to-[#6d28d9]",
    icon: <Share2 size={28} strokeWidth={1.5} />,
    agents: ["Content creator", "Calendrier éditorial", "Analytics social"],
  },
  {
    id: "email",
    category: "email",
    name: "Email Marketing",
    tagline: "Campagnes email qui convertissent",
    description:
      "Rédaction, segmentation, A/B testing et optimisation de delivrabilité pour maximiser vos taux d'ouverture et de conversion.",
    agentCount: 0,
    status: "coming-soon",
    route: "",
    gradient: "from-[#f59e0b] to-[#d97706]",
    icon: <Mail size={28} strokeWidth={1.5} />,
    agents: ["Rédaction campagnes", "Segmentation", "A/B testing"],
  },
  {
    id: "analytics",
    category: "analytics",
    name: "Performance & Analytics",
    tagline: "Vos KPIs marketing au même endroit",
    description:
      "Dashboard unifié, reporting automatisé et recommandations intelligentes basées sur toutes vos sources de données marketing.",
    agentCount: 0,
    status: "coming-soon",
    route: "",
    gradient: "from-[#ec4899] to-[#be185d]",
    icon: <BarChart2 size={28} strokeWidth={1.5} />,
    agents: ["Dashboard unifié", "Reporting auto", "Recommandations"],
  },
];

const CATEGORIES: { id: AgentCategory; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "seo", label: "SEO & GEO" },
  { id: "brand", label: "Brand Intel" },
  { id: "social", label: "Social Media" },
  { id: "email", label: "Email" },
  { id: "analytics", label: "Analytics" },
];

// ─── Component ────────────────────────────────────────────

export function AgentMarketplace() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<AgentCategory>("all");
  const [search, setSearch] = useState("");

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
      {/* Header */}
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: "rgba(23,195,178,0.12)", color: "#17c3b2" }}
        >
          <Sparkles size={12} />
          Vos agents marketing IA
        </div>
        <h1
          className="text-3xl font-semibold tracking-tight mb-3"
          style={{ color: "var(--foreground)" }}
        >
          Que voulez-vous accomplir aujourd&apos;hui ?
        </h1>
        <p
          className="text-base max-w-xl mx-auto"
          style={{ color: "var(--muted-foreground)" }}
        >
          Choisissez une famille d&apos;agents. Chaque famille regroupe des
          agents spécialisés qui travaillent ensemble.
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
            placeholder="Rechercher…"
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
          Aucune famille d&apos;agents ne correspond à votre recherche.
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
              Bientôt disponible
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
