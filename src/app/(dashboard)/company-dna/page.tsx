"use client";

import { useState, useEffect } from "react";
import {
  Buildings,
  Plus,
  Trash,
  Globe,
  Target,
  Lightning,
  ArrowsClockwise,
  Users,
  CursorClick,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc-client";

// ─── Types ──────────────────────────────────────────────

interface TargetBuyer {
  role: string;
  sellingAngle: string;
}

interface SocialProofEntry {
  industry: string;
  clients: string[];
  keyMetric?: string;
}

function arrayToLines(arr: string[]): string {
  return arr.join("\n");
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ─── Section wrapper ────────────────────────────────────

function Section({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="text-muted-foreground shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium leading-none">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────

export default function CompanyDnaPage() {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.workspace.getCompanyDna.useQuery();

  const analyzeMutation = trpc.workspace.analyzeUrl.useMutation({
    onSuccess: () => {
      utils.workspace.getCompanyDna.invalidate();
      toast.success("Site analyzed — DNA generated");
    },
    onError: (err) => {
      toast.error(err.message || "Analysis failed");
    },
  });

  const updateMutation = trpc.workspace.updateCompanyDna.useMutation({
    onSuccess: () => {
      utils.workspace.getCompanyDna.invalidate();
      toast.success("Company DNA saved");
    },
    onError: (err) => {
      toast.error(err.message || "Save failed");
    },
  });

  // Form state
  const [urlInput, setUrlInput] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [problemsSolved, setProblemsSolved] = useState("");
  const [keyResults, setKeyResults] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [socialProof, setSocialProof] = useState<SocialProofEntry[]>([]);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [targetBuyers, setTargetBuyers] = useState<TargetBuyer[]>([]);

  // Sync form state when query data arrives
  useEffect(() => {
    if (!data) return;

    const dna = (data.companyDna ?? {}) as Record<string, unknown>;

    setOneLiner((dna.oneLiner as string) || "");
    setProblemsSolved(arrayToLines((dna.problemsSolved as string[]) || []));
    setKeyResults(arrayToLines((dna.keyResults as string[]) || []));
    setDifferentiators(arrayToLines((dna.differentiators as string[]) || []));
    setSocialProof(
      Array.isArray(dna.socialProof) && dna.socialProof.length > 0
        ? (dna.socialProof as SocialProofEntry[])
        : [],
    );

    // CTA — read first entry from the array
    const ctasArr = Array.isArray(dna.ctas) ? dna.ctas : [];
    const firstCta = ctasArr[0] as { label?: string; url?: string } | undefined;
    setCtaLabel(firstCta?.label || "");
    setCtaUrl(firstCta?.url || "");

    // Target buyers
    const buyers = Array.isArray(dna.targetBuyers) ? dna.targetBuyers : [];
    setTargetBuyers(
      buyers.length > 0
        ? (buyers as TargetBuyer[])
        : [],
    );

    if (data.companyUrl) setUrlInput(data.companyUrl);
  }, [data]);

  // Listen for chat-triggered company DNA updates
  useEffect(() => {
    const handler = () => {
      utils.workspace.getCompanyDna.invalidate();
    };
    window.addEventListener("leadsens:company-dna-updated", handler);
    return () => {
      window.removeEventListener("leadsens:company-dna-updated", handler);
    };
  }, [utils]);

  const handleAnalyze = () => {
    const url = urlInput.trim();
    if (!url) return;
    analyzeMutation.mutate({ url });
  };

  const handleSave = () => {
    // Preserve existing backend fields not shown on this page
    const existing = (data?.companyDna ?? {}) as Record<string, unknown>;

    const payload = {
      oneLiner,
      problemsSolved: linesToArray(problemsSolved),
      keyResults: linesToArray(keyResults),
      differentiators: linesToArray(differentiators),
      socialProof,
      targetBuyers,
      ctas: ctaLabel.trim()
        ? [{ label: ctaLabel.trim(), commitment: "medium" as const, ...(ctaUrl.trim() ? { url: ctaUrl.trim() } : {}) }]
        : [],
      // Preserve backend-only fields
      pricingModel: (existing.pricingModel as string | null) ?? null,
      toneOfVoice: (existing.toneOfVoice as { register: "formal" | "conversational" | "casual"; traits: string[]; avoidWords: string[] }) ?? { register: "conversational" as const, traits: [], avoidWords: [] },
      senderIdentity: (existing.senderIdentity as { name: string; role: string; signatureHook: string }) ?? { name: "", role: "", signatureHook: "" },
      objections: (existing.objections as Array<{ objection: string; response: string }>) ?? [],
    };
    updateMutation.mutate({ companyDna: payload });
  };

  // ─── Array item managers ───────────────────────────────

  // Target buyers
  const addBuyer = () =>
    setTargetBuyers((prev) => [...prev, { role: "", sellingAngle: "" }]);
  const removeBuyer = (idx: number) =>
    setTargetBuyers((prev) => prev.filter((_, i) => i !== idx));
  const updateBuyer = (idx: number, field: keyof TargetBuyer, value: string) =>
    setTargetBuyers((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)),
    );

  // Social proof
  const addSocialProof = () =>
    setSocialProof((prev) => [...prev, { industry: "", clients: [] }]);
  const removeSocialProof = (idx: number) =>
    setSocialProof((prev) => prev.filter((_, i) => i !== idx));
  const updateSocialProof = (idx: number, field: string, value: unknown) =>
    setSocialProof((prev) =>
      prev.map((sp, i) => (i === idx ? { ...sp, [field]: value } : sp)),
    );

  const hasDna = !!data?.companyDna;
  const companyUrl = data?.companyUrl || "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <Buildings className="size-5 text-muted-foreground" weight="duotone" />
          <h1 className="text-lg font-semibold">Company DNA</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your commercial identity used to personalize every email.
          {companyUrl && (
            <>
              {" "}
              Source :{" "}
              <a
                href={companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                {companyUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}
              </a>
            </>
          )}
        </p>
      </div>

      {/* URL auto-analyze */}
      <Card className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              weight="duotone"
            />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://yourcompany.com"
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAnalyze();
              }}
            />
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending || !urlInput.trim()}
            variant={hasDna ? "outline" : "default"}
          >
            {analyzeMutation.isPending ? (
              <>
                <ArrowsClockwise className="size-4 mr-1.5 animate-spin" />
                Analyzing...
              </>
            ) : hasDna ? (
              "Re-analyze"
            ) : (
              "Analyze"
            )}
          </Button>
        </div>
        {!hasDna && !oneLiner && (
          <p className="text-xs text-muted-foreground mt-2">
            Paste your website URL to auto-generate the DNA, or fill in the form
            below manually.
          </p>
        )}
      </Card>

      {/* Form sections */}
      <div className="space-y-8">
        {/* ── 1. One-liner ── */}
        <Section
          icon={<Buildings className="size-4" weight="duotone" />}
          title="One-liner"
          description="What your company does in one sentence."
        >
          <Input
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="[Company] helps [who] to [do what] with [how]."
          />
        </Section>

        {/* ── 2. Selling Points ── */}
        <Section
          icon={<Lightning className="size-4" weight="duotone" />}
          title="Selling Points"
          description="Problems you solve, key results, and differentiators."
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Problems you solve
              </label>
              <Textarea
                value={problemsSolved}
                onChange={(e) => setProblemsSolved(e.target.value)}
                placeholder="One problem per line"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Key results
              </label>
              <Textarea
                value={keyResults}
                onChange={(e) => setKeyResults(e.target.value)}
                placeholder="One result per line (real numbers only)"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                What makes you different
              </label>
              <Textarea
                value={differentiators}
                onChange={(e) => setDifferentiators(e.target.value)}
                placeholder="One differentiator per line"
                rows={2}
              />
            </div>
          </div>
        </Section>

        {/* ── 3. Social Proof ── */}
        <Section
          icon={<Users className="size-4" weight="duotone" />}
          title="Social Proof"
          description="Clients grouped by industry. Used to cite relevant references to each prospect."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={addSocialProof}
            >
              <Plus className="size-3 mr-1" />
              Add
            </Button>
          }
        >
          {socialProof.length > 0 ? (
            <div className="space-y-2">
              {socialProof.map((sp, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 items-start p-2.5 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={sp.industry}
                      onChange={(e) => updateSocialProof(idx, "industry", e.target.value)}
                      placeholder="Industry (e.g. SaaS, FinTech, E-commerce)"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={sp.clients.join(", ")}
                      onChange={(e) =>
                        updateSocialProof(
                          idx,
                          "clients",
                          e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                        )
                      }
                      placeholder="Clients, comma-separated (e.g. Stripe, Notion)"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={sp.keyMetric || ""}
                      onChange={(e) => updateSocialProof(idx, "keyMetric", e.target.value || undefined)}
                      placeholder="Result (e.g. +45% conversion) — optional"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSocialProof(idx)}
                  >
                    <Trash className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No social proof yet. Add client references grouped by industry.
              </p>
            </div>
          )}
        </Section>

        {/* ── 4. CTA ── */}
        <Section
          icon={<CursorClick className="size-4" weight="duotone" />}
          title="CTA"
          description="The call-to-action used in your emails."
        >
          <div className="flex gap-2">
            <Input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="e.g. Free 15-min audit"
              className="text-sm flex-1"
            />
            <Input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="URL (optional)"
              className="text-sm flex-1"
            />
          </div>
        </Section>

        {/* ── 5. Target Buyers ── */}
        <Section
          icon={<Target className="size-4" weight="duotone" />}
          title="Target Buyers"
          description="Who you sell to and what angle resonates with each role."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={addBuyer}
            >
              <Plus className="size-3 mr-1" />
              Add
            </Button>
          }
        >
          {targetBuyers.length > 0 ? (
            <div className="space-y-2">
              {targetBuyers.map((buyer, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 items-start p-2.5 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={buyer.role}
                      onChange={(e) => updateBuyer(idx, "role", e.target.value)}
                      placeholder="Role (e.g. Head of Growth)"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={buyer.sellingAngle}
                      onChange={(e) => updateBuyer(idx, "sellingAngle", e.target.value)}
                      placeholder="Selling angle for this role"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeBuyer(idx)}
                  >
                    <Trash className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No target buyers yet. Click Add to define your personas.
              </p>
            </div>
          )}
        </Section>

        {/* Save */}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Changes are saved to your workspace and used for all future emails.
          </p>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
