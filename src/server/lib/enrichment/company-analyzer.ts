import { z } from "zod/v4";
import { scrapeViaJina } from "@/server/lib/connectors/jina";
import { mistralClient } from "@/server/lib/llm/mistral-client";

// ─── Schema ──────────────────────────────────────────────

export const companyDnaSchema = z.object({
  oneLiner: z.string().default(""),
  targetBuyers: z
    .array(
      z.object({
        role: z.string(),
        sellingAngle: z.string().default(""),
      }),
    )
    .default([]),
  keyResults: z.array(z.string()).default([]),
  differentiators: z.array(z.string()).default([]),
  proofPoints: z.array(z.string()).default([]),
  problemsSolved: z.array(z.string()).default([]),
  pricingModel: z.string().nullable().default(null),
});

export type CompanyDna = z.infer<typeof companyDnaSchema>;

// ─── System Prompt ───────────────────────────────────────

const COMPANY_ANALYSIS_SYSTEM = `Tu analyses le contenu scrapé d'un site web d'entreprise pour comprendre PRÉCISÉMENT ce qu'elle vend, à qui, et pourquoi c'est utile. Ton analyse sera utilisée pour écrire des cold emails B2B de prospection — elle doit donc être orientée "selling points", pas description neutre.

Tu DOIS retourner un objet JSON avec EXACTEMENT ces 7 clés (camelCase, pas de snake_case) :

{
  "oneLiner": "string — UNE phrase décrivant l'entreprise. Format : '[Nom] aide [qui] à [faire quoi] grâce à [comment].'",
  "problemsSolved": ["string[] — Les 2-4 problèmes concrets que le produit/service résout. Extrais-les du contenu (pain points clients, frustrations, inefficacités mentionnées). Formule chaque problème comme une phrase courte commençant par un verbe ou un nom."],
  "targetBuyers": [{"role": "Titre de poste (ex: VP Sales, Head of Growth, CTO)", "sellingAngle": "L'angle de vente qui résonne pour ce rôle — quel bénéfice spécifique lui importe"}],
  "keyResults": ["string[] — Chiffres, stats, métriques, résultats de case studies RÉELLEMENT mentionnés sur le site. Ex: '+45% de conversion', '500+ clients', '3x plus rapide'. Si AUCUN chiffre n'est mentionné, retourne []."],
  "differentiators": ["string[] — 2-3 points qui distinguent l'entreprise de la concurrence. Extrais du contenu les avantages uniques, la techno propriétaire, l'approche différente."],
  "proofPoints": ["string[] — Noms de clients, logos, témoignages, certifications, prix, notes (G2, Capterra), partenariats mentionnés sur le site."],
  "pricingModel": "string | null — Le modèle tarifaire si visible (freemium, par siège, sur devis, essai gratuit, etc.). null si pas trouvé."
}

RÈGLES STRICTES :
- Base-toi EXCLUSIVEMENT sur le contenu fourni. N'invente RIEN. Ne complète JAMAIS avec tes connaissances.
- CHAQUE champ doit être rempli à partir du contenu réel du site. Cherche activement dans toutes les pages fournies.
- "problemsSolved" : Déduis les problèmes de la proposition de valeur, des sections "why us", des pain points mentionnés. C'est un champ CRITIQUE pour les cold emails.
- "targetBuyers" : Déduis des cas d'usage, des témoignages, des intitulés de pages (ex: "pour les équipes sales", "pour les marketers").
- "keyResults" : UNIQUEMENT des chiffres/stats explicitement écrits sur le site. JAMAIS de chiffres inventés.
- "proofPoints" : Cherche les logos, "ils nous font confiance", "trusted by", témoignages, badges.
- "pricingModel" : Cherche dans la page pricing si elle est fournie.
- Si une info est VRAIMENT absente du contenu → [] ou null. Mais cherche bien avant de conclure qu'elle est absente.
- UTILISE EXACTEMENT les noms de clés ci-dessus (camelCase). PAS de snake_case.`;

// ─── Scraping ────────────────────────────────────────────

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

const ABOUT_PATHS = ["/about", "/about-us", "/a-propos", "/qui-sommes-nous"];
const PRICING_PATHS = ["/pricing", "/tarifs", "/plans", "/offres"];

/** Extract markdown from Jina result, return null on failure. */
function extractMarkdown(result: Awaited<ReturnType<typeof scrapeViaJina>>): string | null {
  return result.ok ? result.markdown : null;
}

/** Try primary path, then fallbacks. Returns first successful result. */
async function scrapeWithFallbacks(
  baseUrl: string,
  paths: string[],
): Promise<string | null> {
  for (const path of paths) {
    const md = extractMarkdown(await scrapeViaJina(`${baseUrl}${path}`));
    if (md && md.length > 100) return md;
  }
  return null;
}

/** Retry a scrape once after a short delay (for transient Jina failures). */
async function scrapeWithRetry(
  fn: () => Promise<string | null>,
): Promise<string | null> {
  const first = await fn();
  if (first) return first;
  await new Promise((r) => setTimeout(r, 1000));
  return fn();
}

async function scrapeClientSite(
  url: string,
  onStatus?: (label: string) => void,
): Promise<string> {
  const baseUrl = normalizeUrl(url);

  // Homepage is mandatory — fail fast with a clear error
  onStatus?.("Scraping homepage...");
  const homepageResult = await scrapeViaJina(baseUrl);

  if (!homepageResult.ok) {
    throw new Error(
      `Impossible d'accéder à ${baseUrl} : ${homepageResult.message}. Vérifie que l'URL est correcte et que le site est accessible.`,
    );
  }

  const homepage = homepageResult.markdown;

  onStatus?.("Looking for about page...");
  const about = await scrapeWithRetry(() =>
    scrapeWithFallbacks(baseUrl, ABOUT_PATHS),
  );

  onStatus?.("Looking for pricing page...");
  const pricing = await scrapeWithRetry(() =>
    scrapeWithFallbacks(baseUrl, PRICING_PATHS),
  );

  const pages = [
    homepage ? "homepage" : null,
    about ? "about" : null,
    pricing ? "pricing" : null,
  ].filter(Boolean);
  onStatus?.(`Scraped ${pages.length} page(s): ${pages.join(", ")}`);

  const combined = [homepage, about, pricing]
    .filter(Boolean)
    .join("\n\n---PAGE SUIVANTE---\n\n");

  return combined.slice(0, 20000);
}

// ─── Key normalization (snake_case → camelCase) ──────────

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function normalizeKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = normalizeKeys(value);
    }
    return result;
  }
  return obj;
}

// ─── Analysis ────────────────────────────────────────────

export async function analyzeClientSite(
  url: string,
  workspaceId: string,
  onStatus?: (label: string) => void,
): Promise<CompanyDna> {
  const markdown = await scrapeClientSite(url, onStatus);

  if (!markdown || markdown.length < 50) {
    throw new Error("Could not scrape enough content from the provided URL.");
  }

  onStatus?.("Analyzing with Mistral...");

  const raw = await mistralClient.jsonRaw({
    model: "mistral-large-latest",
    system: COMPANY_ANALYSIS_SYSTEM,
    prompt: `Analyse ce site web et extrais les informations commerciales :\n\n${markdown}`,
    workspaceId,
    action: "company-analysis",
    temperature: 0.3,
  });

  const normalized = normalizeKeys(raw);
  return companyDnaSchema.parse(normalized);
}
