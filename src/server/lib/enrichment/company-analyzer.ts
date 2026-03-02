import { z } from "zod/v4";
import { scrapeViaJina } from "@/server/lib/connectors/jina";
import { mistralClient } from "@/server/lib/llm/mistral-client";

// ─── Schema ──────────────────────────────────────────────

export const companyDnaSchema = z.object({
  // --- Core (existants) ---
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
  problemsSolved: z.array(z.string()).default([]),
  pricingModel: z.string().nullable().default(null),

  // --- Legacy (kept for migration, optional) ---
  proofPoints: z.array(z.string()).optional(),

  // --- New fields ---
  socialProof: z
    .array(
      z.object({
        industry: z.string(),
        clients: z.array(z.string()),
        keyMetric: z.string().optional(),
      }),
    )
    .default([]),

  toneOfVoice: z
    .object({
      register: z
        .enum(["formal", "conversational", "casual"])
        .default("conversational"),
      traits: z.array(z.string()).default([]),
      avoidWords: z.array(z.string()).default([]),
    })
    .default({ register: "conversational", traits: [], avoidWords: [] }),

  ctas: z
    .array(
      z.object({
        label: z.string(),
        commitment: z.enum(["low", "medium", "high"]).default("low"),
        url: z.string().optional(),
      }),
    )
    .default([]),

  senderIdentity: z
    .object({
      name: z.string().default(""),
      role: z.string().default(""),
      signatureHook: z.string().default(""),
    })
    .default({ name: "", role: "", signatureHook: "" }),

  objections: z
    .array(
      z.object({
        objection: z.string(),
        response: z.string(),
      }),
    )
    .default([]),
});

export type CompanyDna = z.infer<typeof companyDnaSchema>;

// ─── System Prompt ───────────────────────────────────────

const COMPANY_ANALYSIS_SYSTEM = `Tu analyses le contenu scrapé d'un site web d'entreprise pour comprendre PRÉCISÉMENT ce qu'elle vend, à qui, et pourquoi c'est utile. Ton analyse sera utilisée pour écrire des cold emails B2B de prospection — elle doit donc être orientée "selling points", pas description neutre.

Tu DOIS retourner un objet JSON avec EXACTEMENT ces clés (camelCase, pas de snake_case) :

{
  "oneLiner": "UNE phrase. Format : '[Nom] aide [qui] à [faire quoi] grâce à [comment].'",

  "problemsSolved": ["Les 2-4 problèmes concrets que le produit/service résout. Extrais-les du contenu (pain points clients, frustrations, inefficacités). Phrase courte commençant par un verbe ou un nom."],

  "targetBuyers": [{"role": "Titre de poste (ex: VP Sales, Head of Growth, CTO)", "sellingAngle": "L'angle de vente qui résonne pour ce rôle — quel bénéfice spécifique lui importe"}],

  "socialProof": [{"industry": "Secteur d'activité (ex: SaaS, E-commerce, FinTech, Santé)", "clients": ["Nom du client 1", "Nom du client 2"], "keyMetric": "+45% de conversion chez Client 1 (optionnel, seulement si mentionné)"}],

  "keyResults": ["Chiffres, stats, métriques, résultats de case studies RÉELLEMENT mentionnés sur le site. Ex: '+45% de conversion', '500+ clients', '3x plus rapide'. Si AUCUN chiffre n'est mentionné, retourne []."],

  "differentiators": ["2-3 points qui distinguent l'entreprise de la concurrence. Avantages uniques, techno propriétaire, approche différente."],

  "toneOfVoice": {"register": "formal|conversational|casual", "traits": ["2-3 adjectifs décrivant le style d'écriture du site : direct, empathique, technique, data-driven, etc."], "avoidWords": []},

  "ctas": [{"label": "Le texte du CTA visible sur le site (ex: 'Démarrer gratuitement', 'Réserver une démo')", "commitment": "low|medium|high", "url": "URL du CTA si visible"}],

  "pricingModel": "Le modèle tarifaire si visible (freemium, par siège, sur devis, essai gratuit, etc.). null si pas trouvé.",

  "senderIdentity": {"name": "", "role": "", "signatureHook": ""},
  "objections": []
}

RÈGLES STRICTES :
- Base-toi EXCLUSIVEMENT sur le contenu fourni. N'invente RIEN. Ne complète JAMAIS avec tes connaissances.
- CHAQUE champ doit être rempli à partir du contenu réel du site. Cherche activement dans toutes les pages fournies.
- "problemsSolved" : Déduis les problèmes de la proposition de valeur, des sections "why us", des pain points mentionnés. C'est un champ CRITIQUE pour les cold emails.
- "targetBuyers" : Déduis des cas d'usage, des témoignages, des intitulés de pages (ex: "pour les équipes sales", "pour les marketers").
- "socialProof" : C'est LE champ le plus important pour les cold emails. Cherche ACTIVEMENT : sections "trusted by", "ils nous font confiance", logos clients, case studies, témoignages. GROUPE les clients par industrie/secteur. Si un résultat chiffré est associé à un client, mets-le dans keyMetric. Si tu ne connais pas l'industrie d'un client, utilise "General".
- "keyResults" : UNIQUEMENT des chiffres/stats explicitement écrits sur le site. JAMAIS de chiffres inventés.
- "toneOfVoice" : Analyse le style d'écriture du site. Formel = vouvoiement, corporate. Conversational = tutoiement, naturel. Casual = très familier, startup. Traits = 2-3 adjectifs. avoidWords = toujours [].
- "ctas" : Extrais les CTAs visibles sur le site (boutons, liens d'action). Commitment : low = ressource gratuite, newsletter. medium = démo, call, audit. high = achat, abonnement.
- "pricingModel" : Cherche dans la page pricing si elle est fournie.
- "senderIdentity" et "objections" : Retourne TOUJOURS vide — ces infos ne sont pas sur le site, l'utilisateur les remplira.
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
const CASE_STUDY_PATHS = [
  "/case-studies",
  "/customers",
  "/clients",
  "/success-stories",
  "/temoignages",
  "/cas-clients",
];

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

  onStatus?.("Looking for case studies / clients page...");
  const caseStudies = await scrapeWithRetry(() =>
    scrapeWithFallbacks(baseUrl, CASE_STUDY_PATHS),
  );

  const pages = [
    homepage ? "homepage" : null,
    about ? "about" : null,
    pricing ? "pricing" : null,
    caseStudies ? "case studies" : null,
  ].filter(Boolean);
  onStatus?.(`Scraped ${pages.length} page(s): ${pages.join(", ")}`);

  const combined = [homepage, about, pricing, caseStudies]
    .filter(Boolean)
    .join("\n\n---PAGE SUIVANTE---\n\n");

  return combined.slice(0, 25000);
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
