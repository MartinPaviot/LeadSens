"use client";

import { useState, useEffect } from "react";
import {
  Buildings,
  Plus,
  Trash,
  Globe,
  Target,
  Trophy,
  Lightning,
  ShieldCheck,
  Warning,
  CurrencyDollar,
  ArrowsClockwise,
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

interface CompanyDna {
  oneLiner: string;
  targetBuyers: TargetBuyer[];
  keyResults: string[];
  differentiators: string[];
  proofPoints: string[];
  problemsSolved: string[];
  pricingModel: string | null;
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
  const [targetBuyers, setTargetBuyers] = useState<TargetBuyer[]>([]);
  const [keyResults, setKeyResults] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [proofPoints, setProofPoints] = useState("");
  const [problemsSolved, setProblemsSolved] = useState("");
  const [pricingModel, setPricingModel] = useState("");

  // Sync form state when query data arrives or changes
  useEffect(() => {
    if (!data) return;

    const dna = (data.companyDna ?? {}) as Partial<CompanyDna>;

    setOneLiner(dna.oneLiner || "");
    setTargetBuyers(dna.targetBuyers?.length ? dna.targetBuyers : []);
    setKeyResults(arrayToLines(dna.keyResults || []));
    setDifferentiators(arrayToLines(dna.differentiators || []));
    setProofPoints(arrayToLines(dna.proofPoints || []));
    setProblemsSolved(arrayToLines(dna.problemsSolved || []));
    setPricingModel(dna.pricingModel || "");
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
    const payload: CompanyDna = {
      oneLiner,
      targetBuyers,
      keyResults: linesToArray(keyResults),
      differentiators: linesToArray(differentiators),
      proofPoints: linesToArray(proofPoints),
      problemsSolved: linesToArray(problemsSolved),
      pricingModel: pricingModel.trim() || null,
    };
    updateMutation.mutate({ companyDna: payload });
  };

  // Target buyers management
  const addBuyer = () =>
    setTargetBuyers((prev) => [...prev, { role: "", sellingAngle: "" }]);
  const removeBuyer = (idx: number) =>
    setTargetBuyers((prev) => prev.filter((_, i) => i !== idx));
  const updateBuyer = (
    idx: number,
    field: keyof TargetBuyer,
    value: string,
  ) =>
    setTargetBuyers((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)),
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
        {/* One-liner */}
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

        {/* Problems Solved — before target buyers for narrative flow */}
        <Section
          icon={<Warning className="size-4" weight="duotone" />}
          title="Problems Solved"
          description="The pain points your product addresses."
        >
          <Textarea
            value={problemsSolved}
            onChange={(e) => setProblemsSolved(e.target.value)}
            placeholder="One problem per line"
            rows={3}
          />
        </Section>

        {/* Target Buyers */}
        <Section
          icon={<Target className="size-4" weight="duotone" />}
          title="Target Buyers"
          description="Who you sell to and what angle resonates."
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
                      onChange={(e) =>
                        updateBuyer(idx, "role", e.target.value)
                      }
                      placeholder="Role (e.g. Head of Growth)"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={buyer.sellingAngle}
                      onChange={(e) =>
                        updateBuyer(idx, "sellingAngle", e.target.value)
                      }
                      placeholder="Selling angle / pain point"
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

        {/* Key Results */}
        <Section
          icon={<Trophy className="size-4" weight="duotone" />}
          title="Key Results"
          description="Stats, metrics, case study outcomes."
        >
          <Textarea
            value={keyResults}
            onChange={(e) => setKeyResults(e.target.value)}
            placeholder="One result per line (only real numbers from your site)"
            rows={3}
          />
        </Section>

        {/* Differentiators */}
        <Section
          icon={<Lightning className="size-4" weight="duotone" />}
          title="Differentiators"
          description="What sets you apart from competitors."
        >
          <Textarea
            value={differentiators}
            onChange={(e) => setDifferentiators(e.target.value)}
            placeholder="One differentiator per line"
            rows={3}
          />
        </Section>

        {/* Proof Points */}
        <Section
          icon={<ShieldCheck className="size-4" weight="duotone" />}
          title="Proof Points"
          description="Client logos, testimonials, certifications, awards."
        >
          <Textarea
            value={proofPoints}
            onChange={(e) => setProofPoints(e.target.value)}
            placeholder="One proof point per line"
            rows={3}
          />
        </Section>

        {/* Pricing Model */}
        <Section
          icon={<CurrencyDollar className="size-4" weight="duotone" />}
          title="Pricing Model"
          description="Optional. Visible pricing model from your site."
        >
          <Input
            value={pricingModel}
            onChange={(e) => setPricingModel(e.target.value)}
            placeholder="e.g. freemium, per seat, custom quote..."
          />
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
