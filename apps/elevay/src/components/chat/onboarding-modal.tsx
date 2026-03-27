"use client";

import { useState, useEffect, useRef } from "react";
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
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";

// ─── Constants ───────────────────────────────────────────

const TOTAL_STEPS = 6;

const CHANNEL_OPTIONS = [
  "SEO", "LinkedIn", "YouTube", "TikTok",
  "Instagram", "Facebook", "X", "Press",
] as const;

const OBJECTIVE_OPTIONS = [
  { value: "lead_gen"    as const, label: "Generate leads",              Icon: Target },
  { value: "acquisition" as const, label: "Acquire new customers",       Icon: Users  },
  { value: "retention"   as const, label: "Retain existing clients",     Icon: Heart  },
  { value: "branding"    as const, label: "Strengthen brand awareness",  Icon: Star   },
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

const step1Schema = z.object({
  brand_name: z.string().min(1, "Required"),
  brand_url: z.string().url("Invalid URL (e.g. https://mysite.com)"),
});

const step3Schema = z.object({
  country: z.string().min(1, "Required"),
  language: z.string().min(1, "Required"),
  primary_keyword: z.string().min(1, "Required"),
  secondary_keyword: z.string().min(1, "Required"),
});

const competitorSchema = z.object({
  name: z.string().min(1, "Required"),
  url: z.string().url("Invalid URL"),
});

// ─── Types ───────────────────────────────────────────────

type Step1Data = z.infer<typeof step1Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Competitor = z.infer<typeof competitorSchema>;

export interface OnboardingInitialData {
  brand_name: string | null;
  brand_url: string | null;
  country: string | null;
  language: string | null;
  primary_keyword: string | null;
  secondary_keyword: string | null;
  sector: string | null;
  priority_channels: string[];
  objective: string | null;
  exportFormat: string;
  report_recurrence: string | null;
  competitors: unknown;
}

export interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  initialData?: OnboardingInitialData | null;
}

// ─── FieldError ──────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

// ─── Type guards for OAuth postMessages ──────────────────

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

// ─── Platform logo with emoji/img fallback ───────────────

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

// ─── Gradient Button ─────────────────────────────────────

function GradientButton({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 px-6 rounded-xl font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      )}
      style={{ background: "var(--elevay-gradient-btn)" }}
    >
      {children}
    </button>
  );
}

// ─── Component ───────────────────────────────────────────

export function OnboardingModal({ open, onComplete, initialData }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>(() => ({
    brand_name: initialData?.brand_name ?? "",
    brand_url:  initialData?.brand_url  ?? "",
  }));
  const [step3, setStep3] = useState<Step3Data>(() => ({
    country:           initialData?.country           ?? "",
    language:          initialData?.language          ?? "",
    primary_keyword:   initialData?.primary_keyword   ?? "",
    secondary_keyword: initialData?.secondary_keyword ?? "",
  }));
  const [sector, setSector] = useState(() => initialData?.sector ?? "");
  const [priorityChannels, setPriorityChannels] = useState<string[]>(() => initialData?.priority_channels ?? []);
  const [objective, setObjective] = useState<"lead_gen" | "acquisition" | "retention" | "branding" | "">(() => {
    const obj = initialData?.objective;
    return (["lead_gen", "acquisition", "retention", "branding"].includes(obj ?? "") ? obj : "") as "lead_gen" | "acquisition" | "retention" | "branding" | "";
  });
  const [detecting, setDetecting] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>(() => {
    const raw = initialData?.competitors;
    if (Array.isArray(raw) && raw.length > 0) return raw as Competitor[];
    return [{ name: "", url: "" }];
  });
  const [exportFormat, setExportFormat] = useState<"pdf" | "gdoc">(() =>
    initialData?.exportFormat === "gdoc" ? "gdoc" : "pdf",
  );
  const [reportRecurrence, setReportRecurrence] = useState<"on_demand" | "weekly" | "monthly" | "quarterly">(() => {
    const rec = initialData?.report_recurrence;
    return (["on_demand", "weekly", "monthly", "quarterly"].includes(rec ?? "") ? rec : "on_demand") as "on_demand" | "weekly" | "monthly" | "quarterly";
  });
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [socialConnections, setSocialConnections] = useState<Record<string, boolean>>({});
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const socialFetchedRef = useRef(false);

  const upsert = trpc.brandProfile.upsert.useMutation({ onSuccess: onComplete });

  // ─── Platforms to show in Step 6 ──────────────────────

  const platformsToShow: PlatformKey[] = [
    ...ALWAYS_SHOW_PLATFORMS,
    ...priorityChannels.flatMap(ch => CHANNEL_TO_PLATFORMS[ch] ?? []),
  ].filter((key, i, arr) => arr.indexOf(key) === i);

  // ─── Load social statuses on step 6 ───────────────────

  useEffect(() => {
    if (step !== 6 || socialFetchedRef.current) return;
    socialFetchedRef.current = true;
    setLoadingSocial(true);
    Promise.allSettled(
      platformsToShow.map(key =>
        fetch(`/api/auth/social/${key}/status`)
          .then(r => r.ok ? r.json() as Promise<{ connected: boolean }> : { connected: false })
          .then(data => ({ key, connected: data.connected }))
      ),
    ).then(results => {
      const map: Record<string, boolean> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value.key] = r.value.connected;
      }
      setSocialConnections(map);
      setLoadingSocial(false);
    }).catch(() => setLoadingSocial(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Brand detect ─────────────────────────────────────

  async function detectBrand(url: string) {
    if (!url || !z.string().url().safeParse(url).success) return;
    setDetecting(true);
    try {
      const res = await fetch("/api/brand/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_url: url,
          country: step3.country || "FR",
          language: step3.language || "fr",
          brand_name: step1.brand_name || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json() as {
          suggested_brand_name: string;
          suggested_sector: string;
          suggested_competitors: { name: string; url: string }[];
        };
        if (data.suggested_brand_name && !step1.brand_name) {
          setStep1(prev => ({ ...prev, brand_name: data.suggested_brand_name }));
        }
        if (data.suggested_sector && !sector) setSector(data.suggested_sector);
      }
    } catch {
      // best-effort — ignore failures silently
    } finally {
      setDetecting(false);
    }
  }

  // Auto-detect once on mount if brand_url is pre-filled
  useEffect(() => {
    if (step1.brand_url.startsWith("http")) void detectBrand(step1.brand_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-detect with 1500ms debounce when URL changes
  useEffect(() => {
    const url = step1.brand_url;
    if (!url.startsWith("http")) return;
    const timer = setTimeout(() => { void detectBrand(url); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1.brand_url]);

  // ─── Step validation ──────────────────────────────────

  function validateStep1(): boolean {
    const result = step1Schema.safeParse(step1);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errs[String(issue.path[0])] = issue.message;
      }
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    for (let i = 0; i < competitors.length; i++) {
      const r = competitorSchema.safeParse(competitors[i]);
      if (!r.success) {
        for (const issue of r.error.issues) {
          errs[`competitors.${i}.${String(issue.path[0])}`] = issue.message;
        }
      }
    }
    if (competitors.length === 0) {
      errs.competitors = "Add at least one competitor";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep3(): boolean {
    const result = step3Schema.safeParse(step3);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errs[String(issue.path[0])] = issue.message;
      }
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep4(): boolean {
    if (priorityChannels.length === 0) {
      setErrors({ priority_channels: "Select at least 1 channel" });
      return false;
    }
    setErrors({});
    return true;
  }

  // ─── Navigation ──────────────────────────────────────

  function handleNext() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
    else if (step === 4 && validateStep4()) setStep(5);
    else if (step === 5) setStep(6);
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
  }

  function handleSubmit() {
    const cleanedSector = sector.includes("http") || sector.includes("www")
      ? ""
      : sector.slice(0, 100);
    upsert.mutate({
      ...step1,
      ...step3,
      competitors,
      exportFormat,
      sector: cleanedSector || undefined,
      priority_channels: priorityChannels.length > 0
        ? (priorityChannels as ("SEO" | "LinkedIn" | "YouTube" | "TikTok" | "Instagram" | "Facebook" | "X" | "Press")[])
        : undefined,
      objective: objective || undefined,
      report_recurrence: reportRecurrence,
    });
  }

  // ─── Google OAuth popup ───────────────────────────────

  function handleConnectGoogle() {
    const popup = window.open(
      "/api/auth/google-drive",
      "google-auth",
      "width=500,height=650,popup=1",
    );
    if (!popup) return;
    const openedPopup = popup;

    function onMessage(e: MessageEvent<unknown>) {
      if (!isGoogleDriveMessage(e.data)) return;
      setGoogleEmail(e.data.email);
      setErrors({});
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

  // ─── LinkedIn Community OAuth (chained after LinkedIn user auth) ──────────

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

  // ─── Competitors helpers ──────────────────────────────

  function addCompetitor() {
    if (competitors.length < 3) {
      setCompetitors((prev) => [...prev, { name: "", url: "" }]);
    }
  }

  function updateCompetitor(index: number, field: keyof Competitor, value: string) {
    setCompetitors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  function removeCompetitor(index: number) {
    if (competitors.length > 1) {
      setCompetitors((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // ─── Priority channels toggle ─────────────────────────

  function toggleChannel(ch: string) {
    setPriorityChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  // ─── Step label ──────────────────────────────────────

  const stepLabel =
    step === 1 ? "Brand Identity"
    : step === 2 ? "Competitors"
    : step === 3 ? "Analysis Parameters"
    : step === 4 ? "Strategy"
    : step === 5 ? "Report Settings"
    : "Connect Your Tools";

  return (
    <Dialog open={open} onOpenChange={() => { /* blocked — no close without completion */ }}>
      <DialogContent
        className="max-w-[560px] p-8 max-h-[90vh] overflow-y-auto sm:max-h-[90vh] max-h-[95vh] pb-6"
        showCloseButton={false}
        data-testid="onboarding-modal"
      >

        {/* Logo */}
        <div className="flex justify-center mb-2">
          <img src="/logo-elevay.svg" alt="Elevay" className="h-10" />
        </div>

        {/* Header */}
        <DialogHeader className="text-center mb-2">
          <DialogTitle className="text-xl font-semibold text-center">{stepLabel}</DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            This information will be used by all analysis agents.
          </p>
        </DialogHeader>

        {/* Gradient progress bar */}
        <div className="space-y-1 mb-2">
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(step / TOTAL_STEPS) * 100}%`,
                background: "var(--elevay-gradient-btn)",
              }}
            />
          </div>
        </div>

        {/* Step 1 — Brand Identity */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Website URL</label>
              <div className="relative mt-1.5">
                <Input
                  value={step1.brand_url}
                  onChange={(e) => setStep1({ ...step1, brand_url: e.target.value })}
                  placeholder="https://mysite.com"
                />
                {detecting && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="size-3.5 border-2 border-primary border-r-transparent rounded-full animate-spin inline-block" />
                  </span>
                )}
              </div>
              <FieldError message={errors.brand_url} />
              {detecting && (
                <p className="text-xs text-muted-foreground mt-1">Auto-detecting brand info…</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Brand name</label>
              <Input
                value={step1.brand_name}
                onChange={(e) => setStep1({ ...step1, brand_name: e.target.value })}
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
        )}

        {/* Step 2 — Competitors */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Add 2 to 3 competitors for benchmarking</p>
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
            {errors.competitors && (
              <p className="text-xs text-destructive">{errors.competitors}</p>
            )}
            {competitors.length < 3 && (
              <button
                type="button"
                onClick={addCompetitor}
                className="text-xs text-primary hover:underline"
              >
                + Add a competitor
              </button>
            )}
          </div>
        )}

        {/* Step 3 — Analysis Parameters (keywords only) */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Analysis country</label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Geographic scope of the analysis</p>
                <Input
                  value={step3.country}
                  onChange={(e) => setStep3({ ...step3, country: e.target.value })}
                  placeholder="France"
                />
                <FieldError message={errors.country} />
              </div>
              <div>
                <label className="text-sm font-medium">Report language</label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Language of the audit report</p>
                <Input
                  value={step3.language}
                  onChange={(e) => setStep3({ ...step3, language: e.target.value })}
                  placeholder="English"
                />
                <FieldError message={errors.language} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Primary keyword</label>
              <Input
                value={step3.primary_keyword}
                onChange={(e) => setStep3({ ...step3, primary_keyword: e.target.value })}
                placeholder="HR software"
                className="mt-1.5"
              />
              <FieldError message={errors.primary_keyword} />
            </div>
            <div>
              <label className="text-sm font-medium">Secondary keyword</label>
              <Input
                value={step3.secondary_keyword}
                onChange={(e) => setStep3({ ...step3, secondary_keyword: e.target.value })}
                placeholder="HRIS SMB"
                className="mt-1.5"
              />
              <FieldError message={errors.secondary_keyword} />
            </div>
          </div>
        )}

        {/* Step 4 — Strategy (channels + objective) */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Priority channels */}
            <div>
              <label className="text-sm font-medium block mb-2">
                Priority channels <span className="text-destructive">*</span>
              </label>
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
              <FieldError message={errors.priority_channels} />
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
        )}

        {/* Step 5 — Report Settings */}
        {step === 5 && (
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
                  <FieldError message={errors.gdoc} />
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
        )}

        {/* Step 6 — Connect Your Tools (filtered by priority channels) */}
        {step === 6 && (
          <div className="space-y-5">
            {loadingSocial ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <span className="size-3 border-2 border-primary border-r-transparent rounded-full animate-spin inline-block" />
                Loading connection status…
              </div>
            ) : (
              CATEGORIES.map(category => {
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
                            data-testid={`connect-${key}`}
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
                            {connected && (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            <p className="text-xs text-muted-foreground text-center pt-1">
              Connecting your accounts improves data quality.<br />
              Agents work without them — public data is used as fallback.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0"
          >
            Back
          </button>
          {step < TOTAL_STEPS ? (
            <GradientButton onClick={handleNext}>
              Next
            </GradientButton>
          ) : (
            <GradientButton onClick={handleSubmit} disabled={upsert.isPending}>
              {upsert.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 border-2 border-white border-r-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "Start"
              )}
            </GradientButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
