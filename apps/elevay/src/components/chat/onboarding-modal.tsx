"use client";

import { useState } from "react";
import { z } from "zod/v4";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
  Progress,
} from "@leadsens/ui";
import { cn } from "@leadsens/ui";
import { trpc } from "@/lib/trpc-client";

// ─── Schemas ─────────────────────────────────────────────

const step1Schema = z.object({
  brand_name: z.string().min(1, "Obligatoire"),
  brand_url: z.string().url("URL invalide (ex: https://monsite.com)"),
});

const step2Schema = z.object({
  country: z.string().min(1, "Obligatoire"),
  language: z.string().min(1, "Obligatoire"),
  primary_keyword: z.string().min(1, "Obligatoire"),
  secondary_keyword: z.string().min(1, "Obligatoire"),
});

const competitorSchema = z.object({
  name: z.string().min(1, "Obligatoire"),
  url: z.string().url("URL invalide"),
});

// ─── Types ───────────────────────────────────────────────

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Competitor = z.infer<typeof competitorSchema>;

export interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

// ─── Field Error ─────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

// ─── Type guard for Google OAuth postMessage ──────────────

function isGoogleDriveMessage(data: unknown): data is { type: "GOOGLE_DRIVE_CONNECTED"; email: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === "GOOGLE_DRIVE_CONNECTED" &&
    typeof (data as Record<string, unknown>).email === "string"
  );
}

// ─── Component ───────────────────────────────────────────

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>({ brand_name: "", brand_url: "" });
  const [step2, setStep2] = useState<Step2Data>({
    country: "",
    language: "",
    primary_keyword: "",
    secondary_keyword: "",
  });
  const [competitors, setCompetitors] = useState<Competitor[]>([{ name: "", url: "" }]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "gdoc">("pdf");
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const upsert = trpc.brandProfile.upsert.useMutation({ onSuccess: onComplete });

  // ─── Step validation ─────────────────────────────────

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
    const result = step2Schema.safeParse(step2);
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

  function validateStep3(): boolean {
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
      errs.competitors = "Ajoutez au moins un concurrent";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
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
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
  }

  function handleSubmit() {
    if (exportFormat === "gdoc" && !googleEmail) {
      setErrors({ gdoc: "Connectez d'abord votre Google Drive" });
      return;
    }
    upsert.mutate({ ...step1, ...step2, competitors, exportFormat });
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

  // ─── Competitors helpers ──────────────────────────────

  function addCompetitor() {
    if (competitors.length < 5) {
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

  const progressValue = (step / 4) * 100;
  const stepLabel =
    step === 1 ? "Votre marque"
    : step === 2 ? "Contexte marché"
    : step === 3 ? "Vos concurrents"
    : "Vos exports";

  return (
    <Dialog open={open} onOpenChange={() => { /* blocked — no close without completion */ }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Configurez votre profil de marque</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ces informations seront utilisées par tous les agents d&apos;analyse.
          </p>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Étape {step} sur 4</span>
            <span>{stepLabel}</span>
          </div>
          <Progress value={progressValue} className="h-1.5" />
        </div>

        {/* Step 1 — Votre marque */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom de la marque</label>
              <Input
                value={step1.brand_name}
                onChange={(e) => setStep1({ ...step1, brand_name: e.target.value })}
                placeholder="Ex: Acme Corp"
                className="mt-1"
              />
              <FieldError message={errors.brand_name} />
            </div>
            <div>
              <label className="text-sm font-medium">URL du site</label>
              <Input
                value={step1.brand_url}
                onChange={(e) => setStep1({ ...step1, brand_url: e.target.value })}
                placeholder="https://monsite.com"
                className="mt-1"
              />
              <FieldError message={errors.brand_url} />
            </div>
          </div>
        )}

        {/* Step 2 — Contexte marché */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Pays</label>
                <Input
                  value={step2.country}
                  onChange={(e) => setStep2({ ...step2, country: e.target.value })}
                  placeholder="France"
                  className="mt-1"
                />
                <FieldError message={errors.country} />
              </div>
              <div>
                <label className="text-sm font-medium">Langue</label>
                <Input
                  value={step2.language}
                  onChange={(e) => setStep2({ ...step2, language: e.target.value })}
                  placeholder="Français"
                  className="mt-1"
                />
                <FieldError message={errors.language} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Mot-clé principal</label>
              <Input
                value={step2.primary_keyword}
                onChange={(e) => setStep2({ ...step2, primary_keyword: e.target.value })}
                placeholder="logiciel RH"
                className="mt-1"
              />
              <FieldError message={errors.primary_keyword} />
            </div>
            <div>
              <label className="text-sm font-medium">Mot-clé secondaire</label>
              <Input
                value={step2.secondary_keyword}
                onChange={(e) => setStep2({ ...step2, secondary_keyword: e.target.value })}
                placeholder="SIRH PME"
                className="mt-1"
              />
              <FieldError message={errors.secondary_keyword} />
            </div>
          </div>
        )}

        {/* Step 3 — Vos concurrents */}
        {step === 3 && (
          <div className="space-y-3">
            {competitors.map((competitor, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Concurrent {index + 1}</span>
                  {competitors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCompetitor(index)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      value={competitor.name}
                      onChange={(e) => updateCompetitor(index, "name", e.target.value)}
                      placeholder="Nom"
                    />
                    <FieldError message={errors[`competitors.${index}.name`]} />
                  </div>
                  <div>
                    <Input
                      value={competitor.url}
                      onChange={(e) => updateCompetitor(index, "url", e.target.value)}
                      placeholder="https://concurrent.com"
                    />
                    <FieldError message={errors[`competitors.${index}.url`]} />
                  </div>
                </div>
              </div>
            ))}
            {errors.competitors && (
              <p className="text-xs text-destructive">{errors.competitors}</p>
            )}
            {competitors.length < 5 && (
              <button
                type="button"
                onClick={addCompetitor}
                className="text-xs text-primary hover:underline"
              >
                + Ajouter un concurrent
              </button>
            )}
          </div>
        )}

        {/* Step 4 — Vos exports */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choisissez comment vous souhaitez recevoir votre rapport d&apos;audit.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Card PDF */}
              <button
                type="button"
                onClick={() => setExportFormat("pdf")}
                className={cn(
                  "p-4 border-2 rounded-lg text-left transition-colors",
                  exportFormat === "pdf"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div className="text-2xl mb-2">📑</div>
                <div className="font-medium text-sm">PDF</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Téléchargement direct, aucun compte requis
                </div>
              </button>

              {/* Card Google Docs */}
              <button
                type="button"
                onClick={() => setExportFormat("gdoc")}
                className={cn(
                  "p-4 border-2 rounded-lg text-left transition-colors",
                  exportFormat === "gdoc"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div className="text-2xl mb-2">📄</div>
                <div className="font-medium text-sm">Google Docs</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Document éditable, sauvegardé dans votre Google Drive
                </div>
              </button>
            </div>

            {/* Google OAuth — only shown if gdoc selected */}
            {exportFormat === "gdoc" && (
              <div className="mt-3">
                {googleEmail ? (
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <span>✓</span> Google Drive connecté — {googleEmail}
                  </p>
                ) : (
                  <Button variant="outline" className="w-full" onClick={handleConnectGoogle}>
                    Connecter Google Drive
                  </Button>
                )}
                <FieldError message={errors.gdoc} />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1}>
            Précédent
          </Button>
          {step < 4 ? (
            <Button onClick={handleNext}>Suivant</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={upsert.isPending}>
              {upsert.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                  Enregistrement...
                </span>
              ) : (
                "Terminer l'onboarding"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
