"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
} from "@leadsens/ui";

// ─── Types ────────────────────────────────────────────────

export interface Wpw09FormData {
  pageType: string;
  brief: string;
  targetKeywords: string[];
  brandTone: string;
  targetAudience: string;
  exportFormat: string;
  cta: string;
}

export interface Bsw10FormData {
  topic: string;
  mode: string;
  articleFormat: string;
  targetKeywords: string[];
  brandTone: string;
  targetAudience: string;
  cta: string;
}

export interface Kga08FormData {
  seedKeywords: string[];
}

type FormType = "wpw09" | "bsw10" | "kga08";

interface SeoAgentFormsProps {
  open: FormType | null;
  onClose: () => void;
  onSubmitWpw09: (data: Wpw09FormData) => void;
  onSubmitBsw10: (data: Bsw10FormData) => void;
  onSubmitKga08: (data: Kga08FormData) => void;
}

// ─── Shared UI helpers ────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function OptionGrid({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-xs py-2 px-3 rounded-lg border transition-colors ${
            value === opt.value
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border hover:border-primary/50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── WPW-09 Form ──────────────────────────────────────────

const PAGE_TYPES = [
  { value: "landing", label: "Landing page" },
  { value: "service", label: "Service page" },
  { value: "about", label: "About page" },
  { value: "pillar", label: "Pillar page" },
  { value: "contact", label: "Contact page" },
  { value: "category", label: "Category page" },
];

const EXPORT_FORMATS = [
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
];

function Wpw09Form({ onSubmit }: { onSubmit: (data: Wpw09FormData) => void }) {
  const [pageType, setPageType] = useState("landing");
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [brandTone, setBrandTone] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [exportFormat, setExportFormat] = useState("html");
  const [cta, setCta] = useState("");

  const handleSubmit = useCallback(() => {
    if (!brief.trim()) return;
    onSubmit({
      pageType,
      brief: brief.trim(),
      targetKeywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      brandTone: brandTone.trim() || "professional",
      targetAudience: targetAudience.trim() || "B2B decision-makers",
      exportFormat,
      cta: cta.trim(),
    });
  }, [pageType, brief, keywords, brandTone, targetAudience, exportFormat, cta, onSubmit]);

  return (
    <div className="space-y-4">
      <FormField label="Page type">
        <OptionGrid options={PAGE_TYPES} value={pageType} onChange={setPageType} />
      </FormField>

      <FormField label="Brief / topic *">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Describe the page content in a few sentences..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </FormField>

      <FormField label="Target keywords (comma-separated)">
        <Input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="local seo, organic search, ..."
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Brand tone">
          <Input
            value={brandTone}
            onChange={(e) => setBrandTone(e.target.value)}
            placeholder="professional"
          />
        </FormField>
        <FormField label="Target audience">
          <Input
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="B2B decision-makers"
          />
        </FormField>
      </div>

      <FormField label="CTA (call to action)">
        <Input
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="Get a free quote"
        />
      </FormField>

      <FormField label="Export format">
        <OptionGrid options={EXPORT_FORMATS} value={exportFormat} onChange={setExportFormat} />
      </FormField>

      <Button
        onClick={handleSubmit}
        disabled={!brief.trim()}
        className="w-full"
        style={{ background: "var(--elevay-gradient-btn)" }}
      >
        Generate page
      </Button>
    </div>
  );
}

// ─── BSW-10 Form ──────────────────────────────────────────

const ARTICLE_FORMATS = [
  { value: "guide", label: "Complete guide" },
  { value: "list", label: "List / Top N" },
  { value: "tutorial", label: "Tutorial" },
  { value: "comparison", label: "Comparison" },
  { value: "case-study", label: "Case study" },
  { value: "opinion", label: "Opinion" },
  { value: "glossary", label: "Glossary" },
];

const ARTICLE_MODES = [
  { value: "single", label: "Single article" },
  { value: "cluster", label: "Topic cluster" },
  { value: "calendar", label: "Cluster + calendar" },
];

function Bsw10Form({ onSubmit }: { onSubmit: (data: Bsw10FormData) => void }) {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("single");
  const [articleFormat, setArticleFormat] = useState("guide");
  const [keywords, setKeywords] = useState("");
  const [brandTone, setBrandTone] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [cta, setCta] = useState("");

  const handleSubmit = useCallback(() => {
    if (!topic.trim()) return;
    onSubmit({
      topic: topic.trim(),
      mode,
      articleFormat,
      targetKeywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      brandTone: brandTone.trim() || "professional",
      targetAudience: targetAudience.trim() || "marketers",
      cta: cta.trim() || "Discover our solution",
    });
  }, [topic, mode, articleFormat, keywords, brandTone, targetAudience, cta, onSubmit]);

  return (
    <div className="space-y-4">
      <FormField label="Article topic *">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Complete guide to local SEO in 2025"
        />
      </FormField>

      <FormField label="Mode">
        <OptionGrid options={ARTICLE_MODES} value={mode} onChange={setMode} />
      </FormField>

      <FormField label="Format">
        <OptionGrid options={ARTICLE_FORMATS} value={articleFormat} onChange={setArticleFormat} />
      </FormField>

      <FormField label="Target keywords (comma-separated)">
        <Input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="local seo, organic search, ..."
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Brand tone">
          <Input
            value={brandTone}
            onChange={(e) => setBrandTone(e.target.value)}
            placeholder="professional"
          />
        </FormField>
        <FormField label="Target audience">
          <Input
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="marketers"
          />
        </FormField>
      </div>

      <FormField label="CTA (call to action)">
        <Input
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="Discover our solution"
        />
      </FormField>

      <Button
        onClick={handleSubmit}
        disabled={!topic.trim()}
        className="w-full"
        style={{ background: "var(--elevay-gradient-btn)" }}
      >
        Write article
      </Button>
    </div>
  );
}

// ─── KGA-08 Seed Keywords Form ─────────��──────────────────

function Kga08Form({ onSubmit }: { onSubmit: (data: Kga08FormData) => void }) {
  const [keywords, setKeywords] = useState("");

  const handleSubmit = useCallback(() => {
    onSubmit({
      seedKeywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    });
  }, [keywords, onSubmit]);

  return (
    <div className="space-y-4">
      <FormField label="Seed keywords (comma-separated)">
        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="local seo, organic search, web agency, ..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Leave empty for an analysis based only on your site and GSC.
      </p>
      <Button
        onClick={handleSubmit}
        className="w-full"
        style={{ background: "var(--elevay-gradient-btn)" }}
      >
        Run analysis
      </Button>
    </div>
  );
}

// ─── Main Form Modal ──────────────────────────────────────

const FORM_TITLES: Record<FormType, string> = {
  wpw09: "Write an SEO page",
  bsw10: "Write a blog article",
  kga08: "Keyword strategy",
};

export function SeoAgentForms({
  open,
  onClose,
  onSubmitWpw09,
  onSubmitBsw10,
  onSubmitKga08,
}: SeoAgentFormsProps) {
  if (!open) return null;

  return (
    <Dialog open={!!open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{FORM_TITLES[open]}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {open === "wpw09" && <Wpw09Form onSubmit={onSubmitWpw09} />}
          {open === "bsw10" && <Bsw10Form onSubmit={onSubmitBsw10} />}
          {open === "kga08" && <Kga08Form onSubmit={onSubmitKga08} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
