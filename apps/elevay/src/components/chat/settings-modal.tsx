"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod/v4";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
} from "@leadsens/ui";
import { cn } from "@leadsens/ui";
import { Target, Users, Heart, Star, FileText, FileEdit } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────

const CHANNEL_OPTIONS = [
  "SEO", "LinkedIn", "YouTube", "TikTok",
  "Instagram", "Facebook", "X", "Press",
] as const;

const OBJECTIVE_OPTIONS = [
  { value: "lead_gen"    as const, label: "Generate leads",             Icon: Target },
  { value: "acquisition" as const, label: "Acquire new customers",      Icon: Users  },
  { value: "retention"   as const, label: "Retain existing clients",    Icon: Heart  },
  { value: "branding"    as const, label: "Strengthen brand awareness", Icon: Star   },
];

const RECURRENCE_OPTIONS = [
  { value: "on_demand" as const, label: "On demand only" },
  { value: "weekly"    as const, label: "Weekly" },
  { value: "monthly"   as const, label: "Monthly" },
  { value: "quarterly" as const, label: "Quarterly" },
];

const PLATFORM_CONFIG = {
  googledrive: {
    name: "Google Drive",
    logo: { type: "emoji" as const, value: "📁" },
    category: "PRODUCTIVITY" as const,
  },
  googledocs: {
    name: "Google Docs",
    logo: { type: "emoji" as const, value: "📄" },
    category: "PRODUCTIVITY" as const,
  },
  linkedin: {
    name: "LinkedIn",
    logo: { type: "img" as const, src: "https://www.svgrepo.com/show/448234/linkedin.svg" },
    category: "SOCIAL MEDIA" as const,
  },
  instagram: {
    name: "Instagram",
    logo: { type: "img" as const, src: "https://www.svgrepo.com/show/452229/instagram-1.svg" },
    category: "SOCIAL MEDIA" as const,
  },
  tiktok: {
    name: "TikTok",
    logo: { type: "svg" as const, markup: `<svg viewBox="0 0 24 24" fill="black" xmlns="http://www.w3.org/2000/svg"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.74a4.85 4.85 0 01-1.02-.05z"/></svg>` },
    category: "SOCIAL MEDIA" as const,
  },
  facebook: {
    name: "Facebook",
    logo: { type: "img" as const, src: "https://www.svgrepo.com/show/448224/facebook.svg" },
    category: "SOCIAL MEDIA" as const,
  },
  x: {
    name: "X",
    logo: { type: "svg" as const, markup: `<svg viewBox="0 0 24 24" fill="black" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
    category: "SOCIAL MEDIA" as const,
  },
} satisfies Record<string, {
  name: string;
  logo: { type: "emoji"; value: string } | { type: "img"; src: string } | { type: "svg"; markup: string };
  category: "PRODUCTIVITY" | "SOCIAL MEDIA";
}>;

type PlatformKey = keyof typeof PLATFORM_CONFIG;
const CATEGORIES = ["PRODUCTIVITY", "SOCIAL MEDIA"] as const;

/** Channels that map to a specific platform connection */
const CHANNEL_TO_PLATFORMS: Partial<Record<string, PlatformKey[]>> = {
  LinkedIn:  ["linkedin"],
  Instagram: ["instagram"],
  Facebook:  ["facebook"],
  X:         ["x"],
};

/** Always show these platforms regardless of selected channels */
const ALWAYS_SHOW_PLATFORMS: PlatformKey[] = ["googledrive", "googledocs"];

// ─── Schemas ─────────────────────────────────────────────

const formSchema = z.object({
  brand_name:        z.string().min(1, "Required"),
  brand_url:         z.string().url("Invalid URL (e.g. https://mysite.com)"),
  country:           z.string().min(1, "Required"),
  language:          z.string().min(1, "Required"),
  primary_keyword:   z.string().min(1, "Required"),
  secondary_keyword: z.string().min(1, "Required"),
});

const competitorSchema = z.object({
  name: z.string().min(1, "Required"),
  url:  z.string().url("Invalid URL"),
});

type Competitor = z.infer<typeof competitorSchema>;

// ─── Helpers ─────────────────────────────────────────────

function isGoogleDriveMessage(data: unknown): data is { type: "GOOGLE_DRIVE_CONNECTED"; email: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === "GOOGLE_DRIVE_CONNECTED" &&
    typeof (data as Record<string, unknown>).email === "string"
  );
}

function isSocialConnectedMessage(data: unknown): data is { type: "SOCIAL_CONNECTED"; platform: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === "SOCIAL_CONNECTED" &&
    typeof (data as Record<string, unknown>).platform === "string"
  );
}

// ─── Sub-components ──────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
      {children}
    </h3>
  );
}

function SectionDivider() {
  return <div className="border-t border-gray-100 dark:border-white/[0.06] my-6" />;
}

function PlatformLogo({
  logo,
  name,
}: {
  logo: { type: "emoji"; value: string } | { type: "img"; src: string } | { type: "svg"; markup: string };
  name: string;
}) {
  if (logo.type === "emoji") {
    return <span className="text-base leading-none">{logo.value}</span>;
  }
  if (logo.type === "svg") {
    return (
      <span
        className="inline-flex items-center justify-center size-5 shrink-0"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: logo.markup }}
      />
    );
  }
  return (
    <span className="inline-flex items-center justify-center size-5 shrink-0">
      <img
        src={logo.src}
        alt={name}
        width={20}
        height={20}
        className="size-5 object-contain"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const fb = e.currentTarget.nextElementSibling;
          if (fb) fb.removeAttribute("hidden");
        }}
      />
      <span
        hidden
        className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary"
      >
        {name[0]}
      </span>
    </span>
  );
}

// ─── Props & defaults ────────────────────────────────────

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Component ───────────────────────────────────────────

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  // ── tRPC ────────────────────────────────────────────────
  const { data: rawProfile, refetch } = trpc.brandProfile.get.useQuery();
  const profile = rawProfile as {
    brand_name: string; brand_url: string; country: string; language: string;
    primary_keyword: string; secondary_keyword: string; competitors: unknown;
    exportFormat: string; sector?: string | null;
    priority_channels?: string[]; objective?: string | null;
    report_recurrence?: string | null;
  } | null | undefined;

  const upsert = trpc.brandProfile.upsert.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      void refetch();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to save profile");
    },
  });

  // ── Form state ─────────────────────────────────────────
  const [brand_url,         setBrandUrl]         = useState("");
  const [brand_name,        setBrandName]        = useState("");
  const [sector,            setSector]           = useState("");
  const [competitors,       setCompetitors]      = useState<Competitor[]>([{ name: "", url: "" }]);
  const [country,           setCountry]          = useState("");
  const [language,          setLanguage]         = useState("");
  const [primary_keyword,   setPrimaryKeyword]   = useState("");
  const [secondary_keyword, setSecondaryKeyword] = useState("");
  const [priorityChannels,  setPriorityChannels] = useState<string[]>([]);
  const [objective,         setObjective]        = useState<"lead_gen" | "acquisition" | "retention" | "branding" | "">("");
  const [exportFormat,      setExportFormat]     = useState<"pdf" | "gdoc">("pdf");
  const [reportRecurrence,  setReportRecurrence] = useState<"on_demand" | "weekly" | "monthly" | "quarterly">("on_demand");

  // ── Platforms to show in Connect Your Tools ───────────
  const platformsToShow: PlatformKey[] = [
    ...ALWAYS_SHOW_PLATFORMS,
    ...priorityChannels.flatMap(ch => CHANNEL_TO_PLATFORMS[ch] ?? []),
  ].filter((key, i, arr) => arr.indexOf(key) === i);

  // ── Social connections ─────────────────────────────────
  const [socialConnections, setSocialConnections] = useState<Record<string, boolean>>({});
  const [loadingSocial,     setLoadingSocial]     = useState(false);
  const [googleEmail,       setGoogleEmail]       = useState<string | null>(null);
  const socialFetchedRef = useRef(false);

  // ── Other UI state ─────────────────────────────────────
  const [detecting, setDetecting] = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  // ── Pre-fill from profile when modal opens ─────────────
  useEffect(() => {
    if (!open || !profile) return;
    setBrandUrl(profile.brand_url);
    setBrandName(profile.brand_name);
    setSector(profile.sector ?? "");
    setCompetitors(
      (profile.competitors as Competitor[]).length > 0
        ? (profile.competitors as Competitor[])
        : [{ name: "", url: "" }],
    );
    setCountry(profile.country);
    setLanguage(profile.language);
    setPrimaryKeyword(profile.primary_keyword);
    setSecondaryKeyword(profile.secondary_keyword);
    setPriorityChannels(profile.priority_channels ?? []);
    setObjective(
      (["lead_gen", "acquisition", "retention", "branding"].includes(profile.objective ?? "")
        ? profile.objective
        : "") as "lead_gen" | "acquisition" | "retention" | "branding" | "",
    );
    setExportFormat(profile.exportFormat === "gdoc" ? "gdoc" : "pdf");
    setReportRecurrence(
      (["on_demand", "weekly", "monthly", "quarterly"].includes(profile.report_recurrence ?? "")
        ? profile.report_recurrence
        : "on_demand") as "on_demand" | "weekly" | "monthly" | "quarterly",
    );
    setErrors({});
  }, [open, profile]);

  // ── Load social status + Google Drive OAuth status when modal opens ─────────
  useEffect(() => {
    if (!open || socialFetchedRef.current) return;
    socialFetchedRef.current = true;
    setLoadingSocial(true);
    // Load social connections and Google Drive OAuth status in parallel
    void fetch("/api/auth/google-drive/status")
      .then(r => r.ok ? r.json() as Promise<{ connected: boolean; email: string | null }> : null)
      .then(data => { if (data?.connected && data.email) setGoogleEmail(data.email); })
      .catch(() => {});
    Promise.allSettled(
      platformsToShow.map(key =>
        fetch(`/api/auth/social/${key}/status`)
          .then(r => r.ok ? r.json() as Promise<{ connected: boolean }> : { connected: false })
          .then(data => ({ key, connected: data.connected })),
      ),
    ).then(results => {
      const map: Record<string, boolean> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value.key] = r.value.connected;
      }
      setSocialConnections(map);
      setLoadingSocial(false);
    }).catch(() => setLoadingSocial(false));
  }, [open]);

  // Reset social fetch flag when modal closes
  useEffect(() => {
    if (!open) socialFetchedRef.current = false;
  }, [open]);

  // Auto-detect with 1500ms debounce when Website URL changes
  useEffect(() => {
    if (!brand_url.startsWith("http")) return;
    const timer = setTimeout(() => { void handleRedetect(); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand_url]);

  // ── Re-detect ─────────────────────────────────────────
  async function handleRedetect() {
    if (!brand_url) return;
    if (!z.string().url().safeParse(brand_url).success) {
      setErrors(prev => ({ ...prev, brand_url: "Invalid URL (e.g. https://mysite.com)" }));
      return;
    }
    setDetecting(true);
    try {
      const res = await fetch("/api/brand/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_url,
          country: country || "US",
          language: language || "en",
          brand_name: brand_name || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json() as {
          suggested_brand_name: string;
          suggested_sector: string;
          suggested_competitors: { name: string; url: string }[];
        };
        if (data.suggested_brand_name) setBrandName(data.suggested_brand_name);
        if (data.suggested_sector)     setSector(data.suggested_sector);
        if (data.suggested_competitors.length > 0) {
          setCompetitors(data.suggested_competitors.slice(0, 3));
        }
        // eslint-disable-next-line no-console
        console.log("[detect] sector applied:", data.suggested_sector);
        // eslint-disable-next-line no-console
        console.log("[detect] competitors applied:", data.suggested_competitors);
        toast.success("Brand info re-detected");
      }
    } catch {
      // best-effort
    } finally {
      setDetecting(false);
    }
  }

  // ── Google OAuth popup ─────────────────────────────────
  function handleConnectGoogle() {
    const popup = window.open("/api/auth/google-drive", "google-auth", "width=500,height=650,popup=1");
    if (!popup) return;
    const openedPopup = popup;
    function onMessage(e: MessageEvent<unknown>) {
      if (!isGoogleDriveMessage(e.data)) return;
      setGoogleEmail(e.data.email);
      window.removeEventListener("message", onMessage);
      openedPopup.close();
    }
    window.addEventListener("message", onMessage);
  }

  async function handleConnectSocial(platform: string) {
    try {
      const res = await fetch(`/api/auth/social/${platform}/connect`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json() as { redirectUrl?: string | null; status?: string };

      if (!data.redirectUrl) {
        toast.error("Connection failed", {
          description: "Could not initiate OAuth. Check server logs for details.",
        });
        return;
      }

      const popup = window.open(data.redirectUrl, `connect-${platform}`, "width=600,height=700,popup=1");
      if (!popup) return;
      const openedPopup = popup;

      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearInterval(closeWatcher);
      }

      function onMessage(e: MessageEvent<unknown>) {
        if (!isSocialConnectedMessage(e.data) || e.data.platform !== platform) return;
        setSocialConnections(prev => ({ ...prev, [platform]: true }));
        cleanup();
        openedPopup.close();
        // LinkedIn user auth succeeded → automatically chain LinkedIn Community auth
        if (platform === "linkedin") void handleConnectLinkedInCommunity();
      }

      // Detect popup closed without success — clean up listener, leave state unchanged
      const closeWatcher = setInterval(() => {
        if (openedPopup.closed) cleanup();
      }, 500);

      window.addEventListener("message", onMessage);
    } catch {
      // best-effort
    }
  }

  // ── LinkedIn Community OAuth (chained after LinkedIn user auth) ────────────

  async function handleConnectLinkedInCommunity() {
    try {
      const res = await fetch("/api/auth/social/linkedin-community/connect", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json() as { redirectUrl?: string | null };
      if (!data.redirectUrl) return; // community unavailable — silent, user auth is sufficient

      const popup = window.open(data.redirectUrl, "connect-linkedin-community", "width=600,height=700,popup=1");
      if (!popup) return;
      const openedPopup = popup;

      function cleanup() {
        window.removeEventListener("message", onMsg);
        clearInterval(watcher);
      }
      function onMsg(e: MessageEvent<unknown>) {
        if (!isSocialConnectedMessage(e.data) || e.data.platform !== "linkedin-community") return;
        setSocialConnections(prev => ({ ...prev, "linkedin-community": true }));
        cleanup();
        openedPopup.close();
      }
      const watcher = setInterval(() => { if (openedPopup.closed) cleanup(); }, 500);
      window.addEventListener("message", onMsg);
    } catch {
      // best-effort — community is optional
    }
  }

  // ── Competitor helpers ─────────────────────────────────
  function addCompetitor() {
    if (competitors.length < 3) {
      setCompetitors(prev => [...prev, { name: "", url: "" }]);
    }
  }
  function updateCompetitor(index: number, field: keyof Competitor, value: string) {
    setCompetitors(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }
  function removeCompetitor(index: number) {
    if (competitors.length > 1) {
      setCompetitors(prev => prev.filter((_, i) => i !== index));
    }
  }

  // ── Channel toggle ─────────────────────────────────────
  function toggleChannel(ch: string) {
    setPriorityChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch],
    );
  }

  // ── Validation ────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {};

    const base = formSchema.safeParse({ brand_name, brand_url, country, language, primary_keyword, secondary_keyword });
    if (!base.success) {
      for (const issue of base.error.issues) {
        errs[String(issue.path[0])] = issue.message;
      }
    }

    if (competitors.length === 0) {
      errs.competitors = "Add at least one competitor";
    }
    for (let i = 0; i < competitors.length; i++) {
      const r = competitorSchema.safeParse(competitors[i]);
      if (!r.success) {
        for (const issue of r.error.issues) {
          errs[`competitors.${i}.${String(issue.path[0])}`] = issue.message;
        }
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  }

  // ── Submit ────────────────────────────────────────────
  function handleSave() {
    if (!validate()) return;
    const cleanedSector = sector.includes("http") || sector.includes("www")
      ? ""
      : sector.slice(0, 100);
    upsert.mutate({
      brand_name,
      brand_url,
      country,
      language,
      primary_keyword,
      secondary_keyword,
      competitors,
      exportFormat,
      sector:            cleanedSector || undefined,
      priority_channels: priorityChannels.length > 0
        ? (priorityChannels as ("SEO" | "LinkedIn" | "YouTube" | "TikTok" | "Instagram" | "Facebook" | "X" | "Press")[])
        : undefined,
      objective:         objective || undefined,
      report_recurrence: reportRecurrence,
    });
  }

  // ─── Render ──────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[88vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold">Settings</DialogTitle>
          <p className="text-sm text-muted-foreground">Brand Profile</p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">

          {/* ── Section 1 — Brand Identity ───────────────── */}
          <SectionTitle>Brand Identity</SectionTitle>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Website URL</label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={brand_url}
                  onChange={(e) => setBrandUrl(e.target.value)}
                  placeholder="https://mysite.com"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRedetect()}
                  disabled={detecting}
                  className="shrink-0"
                >
                  {detecting ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 border-2 border-current border-r-transparent rounded-full animate-spin" />
                      Detecting…
                    </span>
                  ) : (
                    "Re-detect"
                  )}
                </Button>
              </div>
              <FieldError message={errors.brand_url} />
            </div>
            <div>
              <label className="text-sm font-medium">Brand name</label>
              <Input
                value={brand_name}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="mt-1.5"
              />
              <FieldError message={errors.brand_name} />
            </div>
            <div>
              <label className="text-sm font-medium">Industry</label>
              <Input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="e.g. HR software, e-commerce…"
                className="mt-1.5"
              />
            </div>
          </div>

          <SectionDivider />

          {/* ── Section 2 — Competitors ──────────────────── */}
          <SectionTitle>Competitors</SectionTitle>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground -mt-1">Add up to 3 competitors for benchmarking.</p>
            {competitors.map((competitor, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Competitor {index + 1}</span>
                  {competitors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCompetitor(index)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      value={competitor.name}
                      onChange={(e) => updateCompetitor(index, "name", e.target.value)}
                      placeholder="Name"
                    />
                    <FieldError message={errors[`competitors.${index}.name`]} />
                  </div>
                  <div>
                    <Input
                      value={competitor.url}
                      onChange={(e) => updateCompetitor(index, "url", e.target.value)}
                      placeholder="https://competitor.com"
                    />
                    <FieldError message={errors[`competitors.${index}.url`]} />
                  </div>
                </div>
              </div>
            ))}
            {errors.competitors && <p className="text-xs text-destructive">{errors.competitors}</p>}
            {competitors.length < 3 && (
              <button
                type="button"
                onClick={addCompetitor}
                className="text-xs text-primary hover:underline"
              >
                + Add competitor
              </button>
            )}
          </div>

          <SectionDivider />

          {/* ── Section 3 — Analysis Parameters ─────────── */}
          <SectionTitle>Analysis Parameters</SectionTitle>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Analysis country</label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Geographic scope</p>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="France"
                />
                <FieldError message={errors.country} />
              </div>
              <div>
                <label className="text-sm font-medium">Report language</label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Language of reports</p>
                <Input
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="English"
                />
                <FieldError message={errors.language} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Primary keyword</label>
              <Input
                value={primary_keyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                placeholder="HR software"
                className="mt-1.5"
              />
              <FieldError message={errors.primary_keyword} />
            </div>
            <div>
              <label className="text-sm font-medium">Secondary keyword</label>
              <Input
                value={secondary_keyword}
                onChange={(e) => setSecondaryKeyword(e.target.value)}
                placeholder="HRIS SMB"
                className="mt-1.5"
              />
              <FieldError message={errors.secondary_keyword} />
            </div>

            {/* Priority channels */}
            <div>
              <label className="text-sm font-medium block mb-2">Priority channels</label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((ch) => {
                  const selected = priorityChannels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm border transition-all",
                        selected
                          ? "text-white border-transparent"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                      style={selected ? { background: "var(--elevay-gradient-btn)" } : {}}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Objective */}
            <div>
              <label className="text-sm font-medium block mb-2">Strategic objective</label>
              <div className="space-y-2">
                {OBJECTIVE_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setObjective(value)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                      objective === value
                        ? "border-[#17c3b2] dark:border-[#3be8d7] bg-[#17c3b2]/[0.06] dark:bg-[#3be8d7]/[0.06]"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        objective === value ? "text-[#17c3b2] dark:text-[#3be8d7]" : "text-muted-foreground",
                      )}
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Section 4 — Report Settings ──────────────── */}
          <SectionTitle>Report Settings</SectionTitle>

          <div className="space-y-5">
            {/* Export format */}
            <div>
              <p className="text-sm font-medium mb-3">Export format</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setExportFormat("pdf")}
                  className={cn(
                    "flex items-center gap-3 px-4 py-[10px] rounded-[10px] border text-left transition-all",
                    exportFormat === "pdf"
                      ? "border-2 border-[#17c3b2] dark:border-[#3be8d7] bg-[#17c3b2]/[0.06] dark:bg-[#3be8d7]/[0.06]"
                      : "border border-[#E5E7EB] hover:border-primary/40",
                  )}
                >
                  <FileText className="size-5 shrink-0" style={{ color: "#FF7A3D" }} />
                  <div>
                    <div className="font-medium text-sm">PDF</div>
                    <div className="text-xs text-gray-400">Direct download, no account required</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("gdoc")}
                  className={cn(
                    "flex items-center gap-3 px-4 py-[10px] rounded-[10px] border text-left transition-all",
                    exportFormat === "gdoc"
                      ? "border-2 border-[#17c3b2] dark:border-[#3be8d7] bg-[#17c3b2]/[0.06] dark:bg-[#3be8d7]/[0.06]"
                      : "border border-[#E5E7EB] hover:border-primary/40",
                  )}
                >
                  <FileEdit className="size-5 shrink-0" style={{ color: "#2c6bed" }} />
                  <div>
                    <div className="font-medium text-sm">Google Docs</div>
                    <div className="text-xs text-gray-400">Editable document, saved to your Google Drive</div>
                  </div>
                </button>
              </div>
              {exportFormat === "gdoc" && (
                <div className="mt-3">
                  {googleEmail ? (
                    <p className="text-sm text-emerald-600 flex items-center gap-2">
                      <span>✓</span> Google Drive connected — {googleEmail}
                    </p>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={handleConnectGoogle}>
                      Connect Google Drive
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Report recurrence */}
            <div>
              <p className="text-sm font-medium mb-3">Report recurrence</p>
              <div className="flex flex-wrap gap-2">
                {RECURRENCE_OPTIONS.map((opt) => {
                  const selected = reportRecurrence === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReportRecurrence(opt.value)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm border transition-all",
                        selected
                          ? "text-white border-transparent"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                      style={selected ? { background: "var(--elevay-gradient-btn)" } : {}}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Section 5 — Connected Tools ──────────────── */}
          <SectionTitle>Connected Tools</SectionTitle>

          {loadingSocial ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <span className="size-3 border-2 border-primary border-r-transparent rounded-full animate-spin inline-block" />
              Loading connection status…
            </div>
          ) : (
            <div className="space-y-5">
              {CATEGORIES.map(category => {
                const platforms = platformsToShow.filter(k => PLATFORM_CONFIG[k].category === category);
                if (platforms.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                      {category}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {platforms.map(key => {
                        const cfg = PLATFORM_CONFIG[key];
                        const connected = socialConnections[key] === true;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => !connected && void handleConnectSocial(key)}
                            disabled={connected}
                            className={cn(
                              "inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all",
                              connected
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-foreground cursor-default"
                                : "border-border bg-background hover:border-primary cursor-pointer",
                            )}
                          >
                            <PlatformLogo logo={cfg.logo} name={cfg.name} />
                            <span>{cfg.name}</span>
                            {connected ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">✓ Connected</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Connect</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-1">
                Connecting your accounts improves data quality. Agents work without them — public data is used as fallback.
              </p>
            </div>
          )}

        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={upsert.isPending}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleSave}
            disabled={upsert.isPending}
            className="h-10 px-6 rounded-xl font-semibold text-white text-sm transition-opacity duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--elevay-gradient-btn)" }}
          >
            {upsert.isPending ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 border-2 border-white border-r-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              "Save changes"
            )}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
