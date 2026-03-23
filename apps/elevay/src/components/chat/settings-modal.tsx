"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
} from "@leadsens/ui";
import { cn } from "@leadsens/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";

type Competitor = { name: string; url: string };

type FormState = {
  brand_name: string;
  brand_url: string;
  country: string;
  language: string;
  primary_keyword: string;
  secondary_keyword: string;
  competitors: Competitor[];
  exportFormat: "pdf" | "gdoc";
};

// ─── Helpers ──────────────────────────────────────────────

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// ─── Types ────────────────────────────────────────────────

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Field error ──────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

// ─── Default form state ───────────────────────────────────

const DEFAULT_FORM: FormState = {
  brand_name: "",
  brand_url: "",
  country: "",
  language: "",
  primary_keyword: "",
  secondary_keyword: "",
  competitors: [{ name: "", url: "" }],
  exportFormat: "pdf",
};

// ─── Component ────────────────────────────────────────────

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { data: rawProfile } = trpc.brandProfile.get.useQuery();
  // Narrow to a simple type to avoid TypeScript deep-instantiation errors from tRPC inference
  const profile = rawProfile as {
    brand_name: string;
    brand_url: string;
    country: string;
    language: string;
    primary_keyword: string;
    secondary_keyword: string;
    competitors: unknown;
    exportFormat: string;
  } | null | undefined;

  const upsert = trpc.brandProfile.upsert.useMutation({
    onSuccess: () => {
      toast.success("Profil mis à jour");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill from profile each time the modal opens
  useEffect(() => {
    if (open && profile) {
      setForm({
        brand_name: profile.brand_name,
        brand_url: profile.brand_url,
        country: profile.country,
        language: profile.language,
        primary_keyword: profile.primary_keyword,
        secondary_keyword: profile.secondary_keyword,
        competitors: (profile.competitors as Competitor[]).length > 0
          ? (profile.competitors as Competitor[])
          : [{ name: "", url: "" }],
        exportFormat: profile.exportFormat === "gdoc" ? "gdoc" : "pdf",
      });
      setErrors({});
    }
  }, [open, profile]);

  // ─── Submit ─────────────────────────────────────────

  function handleSubmit() {
    const errs: Record<string, string> = {};

    if (!form.brand_name.trim()) errs.brand_name = "Obligatoire";
    if (!isValidUrl(form.brand_url)) errs.brand_url = "URL invalide (ex: https://monsite.com)";
    if (!form.country.trim()) errs.country = "Obligatoire";
    if (!form.language.trim()) errs.language = "Obligatoire";
    if (!form.primary_keyword.trim()) errs.primary_keyword = "Obligatoire";
    if (!form.secondary_keyword.trim()) errs.secondary_keyword = "Obligatoire";
    if (form.competitors.length === 0) errs.competitors = "Ajoutez au moins un concurrent";

    for (let i = 0; i < form.competitors.length; i++) {
      const c = form.competitors[i];
      if (!c) continue;
      if (!c.name.trim()) errs[`competitors.${i}.name`] = "Obligatoire";
      if (!isValidUrl(c.url)) errs[`competitors.${i}.url`] = "URL invalide";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    upsert.mutate(form);
  }

  function handleCancel() {
    onOpenChange(false);
  }

  // ─── Competitor helpers ──────────────────────────────

  function addCompetitor() {
    if (form.competitors.length < 5) {
      setForm((prev) => ({
        ...prev,
        competitors: [...prev.competitors, { name: "", url: "" }],
      }));
    }
  }

  function updateCompetitor(index: number, field: keyof Competitor, value: string) {
    setForm((prev) => ({
      ...prev,
      competitors: prev.competitors.map((c, i) =>
        i === index ? { ...c, [field]: value } : c,
      ),
    }));
  }

  function removeCompetitor(index: number) {
    if (form.competitors.length > 1) {
      setForm((prev) => ({
        ...prev,
        competitors: prev.competitors.filter((_, i) => i !== index),
      }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres</DialogTitle>
          <p className="text-sm text-muted-foreground">Profil &amp; Onboarding</p>
        </DialogHeader>

        <div className="space-y-6">

          {/* ── Votre marque ───────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Votre marque
            </h3>
            <div>
              <label className="text-sm font-medium">Nom de la marque</label>
              <Input
                value={form.brand_name}
                onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                placeholder="Ex: Acme Corp"
                className="mt-1"
              />
              <FieldError message={errors.brand_name} />
            </div>
            <div>
              <label className="text-sm font-medium">URL du site</label>
              <Input
                value={form.brand_url}
                onChange={(e) => setForm({ ...form, brand_url: e.target.value })}
                placeholder="https://monsite.com"
                className="mt-1"
              />
              <FieldError message={errors.brand_url} />
            </div>
          </div>

          {/* ── Contexte marché ─────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Contexte marché
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Pays</label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="France"
                  className="mt-1"
                />
                <FieldError message={errors.country} />
              </div>
              <div>
                <label className="text-sm font-medium">Langue</label>
                <Input
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  placeholder="Français"
                  className="mt-1"
                />
                <FieldError message={errors.language} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Mot-clé principal</label>
              <Input
                value={form.primary_keyword}
                onChange={(e) => setForm({ ...form, primary_keyword: e.target.value })}
                placeholder="logiciel RH"
                className="mt-1"
              />
              <FieldError message={errors.primary_keyword} />
            </div>
            <div>
              <label className="text-sm font-medium">Mot-clé secondaire</label>
              <Input
                value={form.secondary_keyword}
                onChange={(e) => setForm({ ...form, secondary_keyword: e.target.value })}
                placeholder="SIRH PME"
                className="mt-1"
              />
              <FieldError message={errors.secondary_keyword} />
            </div>
          </div>

          {/* ── Concurrents ─────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Concurrents
            </h3>
            {form.competitors.map((competitor, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Concurrent {index + 1}</span>
                  {form.competitors.length > 1 && (
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
            {form.competitors.length < 5 && (
              <button
                type="button"
                onClick={addCompetitor}
                className="text-xs text-primary hover:underline"
              >
                + Ajouter un concurrent
              </button>
            )}
          </div>

          {/* ── Format d'export ─────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Format d&apos;export
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, exportFormat: "pdf" })}
                className={cn(
                  "p-4 border-2 rounded-lg text-left transition-colors",
                  form.exportFormat === "pdf"
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
              <button
                type="button"
                onClick={() => setForm({ ...form, exportFormat: "gdoc" })}
                className={cn(
                  "p-4 border-2 rounded-lg text-left transition-colors",
                  form.exportFormat === "gdoc"
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
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={handleCancel} disabled={upsert.isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={upsert.isPending}>
            {upsert.isPending ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                Enregistrement...
              </span>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
