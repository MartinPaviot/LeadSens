import { GracefulFallback, KwScore } from '../../../core/types';
import { getKeywordData, getRankings } from '../../../core/tools/dataForSeo';
import { getSerp } from '../../../core/tools/serpApi';
import { getLowHangingFruit } from '../../../core/tools/gsc';
import { ahrefsGetKeywordMetrics, ahrefsGetOrganicCompetitors } from '../../../core/tools/ahrefs';
import { semrushGetKeywordsBatch, semrushGetCompetitors } from '../../../core/tools/semrush';
import { isToolConnected } from '../../../core/tools/composio';
import {
  Kga08Inputs,
  GeoMarketScore,
  CityLandingPage,
  ActionPlan90d,
  GbpAudit,
  HreflangPlan,
} from './types';

const FALLBACKS: GracefulFallback[] = [
  {
    missingTool: 'gsc',
    fallbackBehavior: 'DataForSEO uniquement — fruits mûrs (pos. 4-15) non disponibles',
    degradedOutput: 'Plan basé sur opportunités nouvelles uniquement',
  },
  {
    missingTool: 'ahrefs',
    fallbackBehavior: 'Backlinks non disponibles — difficulté KW estimée via DataForSEO',
    degradedOutput: 'Score difficulté moins précis sur les KW compétitifs',
  },
  {
    missingTool: 'gbp',
    fallbackBehavior: 'Module GBP désactivé',
    degradedOutput: 'Audit fiche Google Business Profile non disponible',
  },
];

export async function collectLowHangingFruit(
  inputs: Kga08Inputs,
  userId: string,
): Promise<KwScore[]> {
  if (!inputs.gscConnected) return [];
  try {
    const gscKw = await getLowHangingFruit(inputs.siteUrl, userId);
    return gscKw.map((k) => ({
      keyword: k.keyword,
      score: 0,
      trafficPotential: k.impressions * 0.15,
      seoDifficulty: 30,
      businessValue: 50,
      geoRelevance: 50,
      geo: inputs.targetGeos[0] ?? 'FR',
      intent: 'informational' as const,
      targetPage: k.url,
      recommendedAction: 'update' as const,
      horizon: 'M1' as const,
    }));
  } catch {
    return [];
  }
}

export async function expandKeywords(
  inputs: Kga08Inputs,
  seedKeywords: string[],
  userId: string,
): Promise<KwScore[]> {
  try {
    const results: KwScore[] = [];
    for (const geo of inputs.targetGeos) {
      const kwData = await getKeywordData(seedKeywords, geo);
      for (const kw of kwData) {
        const score = computeScore({
          volume: kw.volume,
          difficulty: kw.difficulty,
          intent: kw.intent,
          localVolume: kw.volume,
          nationalVolume: kw.volume * 3,
        });
        results.push({
          keyword: kw.keyword,
          score,
          trafficPotential: kw.volume * 0.15,
          seoDifficulty: kw.difficulty,
          businessValue: assessBusinessValue(kw.intent),
          geoRelevance: 60,
          geo,
          intent: mapIntent(kw.intent),
          targetPage: 'create',
          recommendedAction: 'create',
          horizon: score > 70 ? 'M1' : score > 50 ? 'M2' : 'M3',
        });
      }
    }

    // Enrich with Ahrefs or SEMrush keyword difficulty if connected
    const ahrefsConnected = await isToolConnected('ahrefs', userId);
    const semrushConnected = await isToolConnected('semrush', userId);

    if (ahrefsConnected) {
      try {
        const enriched = await ahrefsGetKeywordMetrics(seedKeywords, inputs.targetGeos[0] ?? 'FR', userId);
        const enrichedMap = new Map(enriched.map((k) => [k.keyword, k]));
        for (const result of results) {
          const match = enrichedMap.get(result.keyword);
          if (match) {
            result.seoDifficulty = match.difficulty;
            result.score = computeScore({
              volume: result.trafficPotential / 0.15,
              difficulty: match.difficulty,
              intent: result.intent,
              localVolume: result.trafficPotential / 0.15,
              nationalVolume: (result.trafficPotential / 0.15) * 3,
            });
          }
        }
      } catch {
        // Ahrefs enrichment failed — keep DataForSEO data
      }
    } else if (semrushConnected) {
      try {
        const enriched = await semrushGetKeywordsBatch(seedKeywords, inputs.targetGeos[0] ?? 'FR', userId);
        const enrichedMap = new Map(enriched.map((k) => [k.keyword, k]));
        for (const result of results) {
          const match = enrichedMap.get(result.keyword);
          if (match) {
            result.seoDifficulty = match.difficulty;
            result.score = computeScore({
              volume: result.trafficPotential / 0.15,
              difficulty: match.difficulty,
              intent: result.intent,
              localVolume: result.trafficPotential / 0.15,
              nationalVolume: (result.trafficPotential / 0.15) * 3,
            });
          }
        }
      } catch {
        // SEMrush enrichment failed — keep DataForSEO data
      }
    }

    return results;
  } catch {
    return [];
  }
}

export function scoreGeoMarkets(
  inputs: Kga08Inputs,
  kwScores: KwScore[],
): GeoMarketScore[] {
  return inputs.targetGeos.map((geo) => {
    const geoKws = kwScores.filter((k) => k.geo === geo);
    if (geoKws.length === 0) {
      return {
        geo,
        volume: 0,
        commercialPotential: 0,
        competition: 0,
        entryEase: 0,
        totalScore: 0,
      };
    }
    const avgVolume = average(geoKws.map((k) => k.trafficPotential));
    const avgDifficulty = average(geoKws.map((k) => k.seoDifficulty));
    return {
      geo,
      volume: avgVolume,
      commercialPotential: avgVolume * 0.3,
      competition: avgDifficulty,
      entryEase: 100 - avgDifficulty,
      totalScore: (avgVolume * 0.4 + (100 - avgDifficulty) * 0.6) / 2,
    };
  });
}

export function detectCityLandingPages(
  inputs: Kga08Inputs,
  kwScores: KwScore[],
): CityLandingPage[] {
  if (inputs.geoLevel !== 'city' && inputs.geoLevel !== 'regional') return [];
  const MAX_CITIES = 10;
  return kwScores
    .filter((k) => k.trafficPotential > 100 && k.seoDifficulty < 40 && k.targetPage === 'create')
    .slice(0, MAX_CITIES)
    .map((k) => ({
      city: k.geo,
      keyword: k.keyword,
      monthlyVolume: k.trafficPotential,
      keywordDifficulty: k.seoDifficulty,
      recommendedUrl: `/services/${slugify(k.keyword)}-${slugify(k.geo)}`,
      targetAgent: 'WPW-09' as const,
    }));
}

export function buildActionPlan(kwScores: KwScore[]): ActionPlan90d {
  const sorted = [...kwScores].sort((a, b) => b.score - a.score);
  return {
    month1: sorted.filter((k) => k.horizon === 'M1'),
    month2: sorted.filter((k) => k.horizon === 'M2'),
    month3: sorted.filter((k) => k.horizon === 'M3'),
  };
}

export function buildClusterMap(kwScores: KwScore[]): Record<string, KwScore[]> {
  const clusters: Record<string, KwScore[]> = {};
  for (const kw of kwScores) {
    const theme = extractTheme(kw.keyword);
    if (!clusters[theme]) clusters[theme] = [];
    clusters[theme].push(kw);
  }
  return clusters;
}

export async function buildGbpAudit(gbpId: string, inputs: Kga08Inputs): Promise<GbpAudit> {
  const missingFields: string[] = [];
  const recommendations: string[] = [];

  // Attempt to fetch public GBP data from Google Maps
  const publicData = await fetchGbpPublicData(gbpId);

  if (publicData) {
    // Data-driven audit based on real public page content
    if (!publicData.hasDescription) missingFields.push('description');
    if (!publicData.hasPhotos) missingFields.push('photos');
    if (!publicData.hasPosts) missingFields.push('posts');
    if (!publicData.hasHours) missingFields.push('hours');
    if (!publicData.hasQA) missingFields.push('q&a');

    if (!publicData.hasDescription) {
      recommendations.push(
        buildGeoAwareRec(
          'Rédiger une description GBP de 750 caractères intégrant les mots-clés',
          inputs,
        ),
      );
    }
    if (!publicData.hasPhotos) {
      recommendations.push(
        'Ajouter au moins 10 photos (façade, intérieur, équipe, produits/services) — les fiches avec +10 photos reçoivent 2x plus de clics',
      );
    }
    if (!publicData.hasPosts) {
      recommendations.push(
        'Publier un Google Post par semaine avec un CTA clair — les posts expirent après 7 jours',
      );
    }
    if (!publicData.hasHours) {
      recommendations.push(
        "Compléter les horaires d'ouverture incluant les horaires spéciaux (jours fériés)",
      );
    }
    if (!publicData.hasQA) {
      recommendations.push(
        'Pré-remplir la section Q&A avec les 10 questions les plus fréquentes de vos clients',
      );
    }

    if (publicData.reviewCount !== null && publicData.reviewCount < 20) {
      recommendations.push(
        `Seulement ${publicData.reviewCount} avis — mettre en place un processus de sollicitation d'avis pour atteindre 50+ avis`,
      );
    }
    if (publicData.rating !== null && publicData.rating < 4.5) {
      recommendations.push(
        `Note actuelle : ${publicData.rating}/5 — répondre à tous les avis négatifs sous 24h et viser 4.5+`,
      );
    }

    // Add geo-specific recommendations even with real data
    pushGeoSpecificRecs(recommendations, inputs);
  } else {
    // Fallback: context-aware recommendations based on inputs
    missingFields.push('description', 'photos', 'posts', 'hours', 'q&a');

    recommendations.push(
      buildGeoAwareRec(
        'Rédiger une description GBP de 750 caractères intégrant les mots-clés',
        inputs,
      ),
    );
    recommendations.push(
      'Ajouter au moins 10 photos (façade, intérieur, équipe, produits/services) — les fiches avec +10 photos reçoivent 2x plus de clics',
    );
    recommendations.push(
      'Publier un Google Post par semaine avec un CTA clair — les posts expirent après 7 jours',
    );
    recommendations.push(
      "Compléter les horaires d'ouverture incluant les horaires spéciaux (jours fériés)",
    );
    recommendations.push(
      'Pré-remplir la section Q&A avec les 10 questions les plus fréquentes de vos clients',
    );
    pushGeoSpecificRecs(recommendations, inputs);
  }

  return { profileId: gbpId, missingFields, recommendations };
}

interface GbpPublicData {
  hasDescription: boolean;
  hasPhotos: boolean;
  hasPosts: boolean;
  hasHours: boolean;
  hasQA: boolean;
  rating: number | null;
  reviewCount: number | null;
}

async function fetchGbpPublicData(gbpId: string): Promise<GbpPublicData | null> {
  try {
    const url = `https://www.google.com/maps/place/?cid=${encodeURIComponent(gbpId)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    if (!html || html.length < 500) return null;

    return {
      hasDescription: /class="[^"]*PYvSYb[^"]*"/.test(html) || /itemprop="description"/.test(html),
      hasPhotos:
        /class="[^"]*ofKBgf[^"]*"/.test(html) || /photos.*\d+/.test(html),
      hasPosts: /class="[^"]*FvcPe[^"]*"/.test(html) || /Google\s*Post/.test(html),
      hasHours:
        /class="[^"]*OqCZI[^"]*"/.test(html) || /itemprop="openingHours"/.test(html),
      hasQA: /class="[^"]*mgr77e[^"]*"/.test(html) || /Questions.*answers/i.test(html),
      rating: extractRating(html),
      reviewCount: extractReviewCount(html),
    };
  } catch {
    return null;
  }
}

function extractRating(html: string): number | null {
  // Try structured data first, then common patterns
  const match =
    html.match(/itemprop="ratingValue"[^>]*content="([\d.]+)"/) ??
    html.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/) ??
    html.match(/([\d.]+)\s*étoiles?\b/);
  if (!match?.[1]) return null;
  const rating = parseFloat(match[1]);
  return rating >= 1 && rating <= 5 ? rating : null;
}

function extractReviewCount(html: string): number | null {
  const match =
    html.match(/itemprop="reviewCount"[^>]*content="(\d+)"/) ??
    html.match(/"reviewCount"\s*:\s*"?(\d+)"?/) ??
    html.match(/([\d,]+)\s*avis\b/);
  if (!match?.[1]) return null;
  const count = parseInt(match[1].replace(/,/g, ''), 10);
  return count >= 0 ? count : null;
}

function buildGeoAwareRec(baseRec: string, inputs: Kga08Inputs): string {
  const geos = inputs.targetGeos.slice(0, 3).join(', ');
  switch (inputs.geoLevel) {
    case 'city':
      return `${baseRec} géo-locaux pour ${geos} (ex: "[service] + [ville]")`;
    case 'regional':
      return `${baseRec} régionaux pour ${geos} (ex: "[service] + [région/département]")`;
    case 'multi-geo':
      return `${baseRec} pour chaque zone cible : ${geos}`;
    default:
      return `${baseRec} nationaux alignés sur l'objectif "${inputs.businessObjective}"`;
  }
}

function pushGeoSpecificRecs(recommendations: string[], inputs: Kga08Inputs): void {
  if (inputs.geoLevel === 'city' || inputs.geoLevel === 'regional') {
    recommendations.push(
      `Ajouter la zone de service couvrant ${inputs.targetGeos.slice(0, 5).join(', ')} dans les paramètres GBP`,
    );
  }

  if (inputs.businessObjective === 'lead-gen') {
    recommendations.push(
      'Activer le bouton "Demander un devis" et le lien de prise de RDV dans la fiche GBP',
    );
  } else if (inputs.businessObjective === 'local-awareness') {
    recommendations.push(
      'Utiliser les attributs GBP (Wi-Fi, accessibilité, paiements) pour maximiser la visibilité locale',
    );
  } else if (inputs.businessObjective === 'sales') {
    recommendations.push(
      'Ajouter les produits/services avec prix dans la section "Produits" de la fiche GBP',
    );
  }

  if (inputs.targetGeos.length > 1) {
    recommendations.push(
      `Créer une fiche GBP distincte pour chaque établissement physique dans ${inputs.targetGeos.slice(0, 3).join(', ')}`,
    );
  }
}

export async function buildHreflangPlan(inputs: Kga08Inputs): Promise<HreflangPlan> {
  if (!inputs.multiCountry || inputs.targetGeos.length <= 1) {
    return { needed: false, architecture: '', errors: [], recommendations: [] };
  }

  // Try to crawl sitemap and check existing hreflang tags
  const urls = await fetchSitemapUrls(inputs.siteUrl);
  if (urls.length === 0) {
    // Fallback: check homepage + priority pages
    const fallbackUrls = [inputs.siteUrl, ...inputs.targetPages.slice(0, 4)];
    const hreflangMap = await crawlHreflangTags(fallbackUrls);

    if (hreflangMap.size === 0) {
      // No hreflang found anywhere — return template with note
      return {
        needed: true,
        architecture: inputs.targetGeos
          .map((g) => `<link rel="alternate" hreflang="${g.toLowerCase()}" href="/${g.toLowerCase()}/"/>`)
          .join('\n'),
        errors: ['Sitemap inaccessible — aucun hreflang détecté sur les pages testées'],
        recommendations: [
          'Implémenter les balises hreflang sur toutes les pages multi-langues',
          'Ajouter un x-default pointant vers la version principale',
          'Utiliser des sous-répertoires (/fr/, /be/) plutôt que des sous-domaines',
          'Vérifier la réciprocité de chaque balise hreflang',
        ],
      };
    }

    return analyzeHreflangMap(hreflangMap, inputs.targetGeos);
  }

  // Crawl hreflang tags from sitemap URLs (capped at 50)
  const pagesToCheck = urls.slice(0, 50);
  const hreflangMap = await crawlHreflangTags(pagesToCheck);

  return analyzeHreflangMap(hreflangMap, inputs.targetGeos);
}

// ─── Hreflang helpers ────────────────────────────────────

interface HreflangEntry {
  lang: string;
  href: string;
}

async function fetchSitemapUrls(siteUrl: string): Promise<string[]> {
  const base = siteUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/sitemap.xml`, {
      headers: { 'User-Agent': 'ElevayBot/1.0 (SEO Audit)', Accept: 'text/xml,application/xml' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Extract <loc> tags — handles both sitemap index and direct sitemap
    const locs: string[] = [];
    const locRegex = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
    let match: RegExpExecArray | null;
    while ((match = locRegex.exec(xml)) !== null) {
      if (match[1]) locs.push(match[1]);
    }

    // If this is a sitemap index, fetch the first sub-sitemap
    if (xml.includes('<sitemapindex') && locs.length > 0 && locs.length < 20) {
      const subUrl = locs[0];
      if (subUrl) {
        try {
          const subRes = await fetch(subUrl, {
            headers: { 'User-Agent': 'ElevayBot/1.0', Accept: 'text/xml,application/xml' },
            signal: AbortSignal.timeout(10_000),
          });
          if (subRes.ok) {
            const subXml = await subRes.text();
            const subLocs: string[] = [];
            let subMatch: RegExpExecArray | null;
            const subLocRegex = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
            while ((subMatch = subLocRegex.exec(subXml)) !== null) {
              if (subMatch[1]) subLocs.push(subMatch[1]);
            }
            return subLocs;
          }
        } catch {
          // sub-sitemap fetch failed — use index URLs
        }
      }
    }

    return locs;
  } catch {
    return [];
  }
}

async function crawlHreflangTags(
  urls: string[],
): Promise<Map<string, HreflangEntry[]>> {
  const map = new Map<string, HreflangEntry[]>();

  // Fetch pages in parallel with concurrency limit
  const CONCURRENCY = 5;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'ElevayBot/1.0 (SEO Audit)', Accept: 'text/html' },
            signal: AbortSignal.timeout(8_000),
          });
          if (!res.ok) return { url, entries: [], status: res.status };
          // Only read the <head> section (first 50KB should be enough)
          const html = (await res.text()).slice(0, 50_000);
          const entries = extractHreflangFromHtml(html);
          return { url, entries, status: 200 };
        } catch {
          return { url, entries: [], status: 0 };
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        map.set(result.value.url, result.value.entries);
      }
    }
  }

  return map;
}

function extractHreflangFromHtml(html: string): HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  // Match <link rel="alternate" hreflang="..." href="..." /> in any attribute order
  const regex = /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1] && match[2]) {
      entries.push({ lang: match[1], href: match[2] });
    }
  }
  // Also match reverse attribute order: hreflang before rel
  const regex2 = /<link[^>]+hreflang=["']([^"']+)["'][^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = regex2.exec(html)) !== null) {
    if (match[1] && match[2]) {
      // Avoid duplicates
      if (!entries.some((e) => e.lang === match?.[1] && e.href === match?.[2])) {
        entries.push({ lang: match[1], href: match[2] });
      }
    }
  }
  return entries;
}

function analyzeHreflangMap(
  hreflangMap: Map<string, HreflangEntry[]>,
  targetGeos: string[],
): HreflangPlan {
  const errors: string[] = [];
  const recommendations: string[] = [];
  const architectureLines: string[] = [];

  let totalPagesChecked = 0;
  let pagesWithHreflang = 0;
  let hasXDefault = false;

  // Check each page's hreflang tags
  for (const [url, entries] of hreflangMap) {
    totalPagesChecked++;
    if (entries.length === 0) continue;
    pagesWithHreflang++;

    // Check for x-default
    if (entries.some((e) => e.lang === 'x-default')) {
      hasXDefault = true;
    }

    // Check locale code validity
    for (const entry of entries) {
      if (entry.lang !== 'x-default' && !isValidHreflangCode(entry.lang)) {
        errors.push(`${url} : code hreflang invalide "${entry.lang}" — utiliser le format "fr" ou "fr-FR"`);
      }
    }

    // Check reciprocity: for each hreflang target, verify it points back
    for (const entry of entries) {
      if (entry.lang === 'x-default') continue;
      const targetEntries = hreflangMap.get(normalizeUrlForHreflang(entry.href));
      if (targetEntries !== undefined) {
        const pointsBack = targetEntries.some(
          (e) => normalizeUrlForHreflang(e.href) === normalizeUrlForHreflang(url),
        );
        if (!pointsBack) {
          errors.push(`Hreflang asymétrique : ${url} → ${entry.href} (${entry.lang}) mais pas de retour`);
        }
      }
    }

    // Build architecture display
    const langList = entries.map((e) => `${e.lang}=${e.href}`).join(', ');
    architectureLines.push(`${url}: ${langList}`);
  }

  // Global checks
  if (pagesWithHreflang === 0) {
    errors.push('Aucune balise hreflang détectée sur les pages crawlées');
    recommendations.push('Implémenter les balises hreflang sur toutes les pages multi-langues');
  } else if (pagesWithHreflang < totalPagesChecked * 0.5) {
    errors.push(`Seulement ${pagesWithHreflang}/${totalPagesChecked} pages avec hreflang — couverture incomplète`);
    recommendations.push('Étendre les hreflang à toutes les pages indexables');
  }

  if (!hasXDefault && pagesWithHreflang > 0) {
    errors.push('Balise x-default manquante — Google ne peut pas déterminer la version par défaut');
    recommendations.push('Ajouter hreflang="x-default" pointant vers la version principale du site');
  }

  // Check target geos coverage
  const detectedLangs = new Set<string>();
  for (const entries of hreflangMap.values()) {
    for (const e of entries) {
      detectedLangs.add(e.lang.toLowerCase().split('-')[0] ?? '');
    }
  }
  for (const geo of targetGeos) {
    const geoLower = geo.toLowerCase().split('-')[0] ?? '';
    if (!detectedLangs.has(geoLower)) {
      errors.push(`GEO cible "${geo}" non couvert par les hreflang existants`);
      recommendations.push(`Ajouter les balises hreflang pour ${geo} sur toutes les pages`);
    }
  }

  // Default recommendations if none generated
  if (recommendations.length === 0 && errors.length === 0) {
    recommendations.push('Architecture hreflang correcte — continuer à surveiller');
  }
  if (recommendations.length === 0 && errors.length > 0) {
    recommendations.push('Corriger les erreurs hreflang détectées ci-dessus');
    recommendations.push("S'assurer que les canonical ne contredisent pas les hreflang");
  }

  return {
    needed: true,
    architecture: architectureLines.length > 0
      ? architectureLines.join('\n')
      : targetGeos
          .map((g) => `<link rel="alternate" hreflang="${g.toLowerCase()}" href="/${g.toLowerCase()}/"/>`)
          .join('\n'),
    errors,
    recommendations,
  };
}

const VALID_LANG_CODES = new Set([
  'af','am','ar','az','be','bg','bn','bs','ca','cs','cy','da','de','el','en','es','et',
  'eu','fa','fi','fr','ga','gl','gu','ha','he','hi','hr','hu','hy','id','ig','is','it',
  'ja','ka','kk','km','kn','ko','ku','ky','lo','lt','lv','mk','ml','mn','mr','ms','mt',
  'my','nb','ne','nl','nn','no','pa','pl','ps','pt','ro','ru','sd','si','sk','sl','so',
  'sq','sr','sv','sw','ta','te','tg','th','tk','tl','tr','uk','ur','uz','vi','yo','zh',
]);

function isValidHreflangCode(code: string): boolean {
  if (code === 'x-default') return true;
  const parts = code.toLowerCase().split('-');
  if (parts.length === 1) return VALID_LANG_CODES.has(parts[0] ?? '');
  if (parts.length === 2) return VALID_LANG_CODES.has(parts[0] ?? '') && (parts[1] ?? '').length === 2;
  return false;
}

function normalizeUrlForHreflang(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

export async function fetchCompetitorInsights(
  inputs: Kga08Inputs,
  userId: string,
): Promise<{ domain: string; commonKeywords: number; organicTraffic: number }[]> {
  if (inputs.competitors.length === 0) return [];

  const ahrefsConnected = await isToolConnected('ahrefs', userId);
  const semrushConnected = await isToolConnected('semrush', userId);

  for (const competitor of inputs.competitors.slice(0, 3)) {
    try {
      if (ahrefsConnected) {
        return await ahrefsGetOrganicCompetitors(competitor, userId);
      } else if (semrushConnected) {
        const results = await semrushGetCompetitors(
          competitor,
          inputs.targetGeos[0] ?? 'FR',
          userId,
        );
        return results.map((c) => ({
          domain: c.domain,
          commonKeywords: c.commonKeywords,
          organicTraffic: c.organicTraffic,
        }));
      }
    } catch {
      // continue to next competitor
    }
  }
  return [];
}

// — helpers —

function computeScore(params: {
  volume: number;
  difficulty: number;
  intent: string;
  localVolume: number;
  nationalVolume: number;
}): number {
  const trafficPotential = Math.min(params.volume * 0.15, 100) * 0.30;
  const seoDifficulty = (100 - params.difficulty) * 0.25;
  const businessValue = assessBusinessValue(params.intent) * 0.25;
  const geoRelevance =
    Math.min((params.localVolume / (params.nationalVolume || 1)) * 100, 100) * 0.20;
  return Math.round(trafficPotential + seoDifficulty + businessValue + geoRelevance);
}

function assessBusinessValue(intent: string): number {
  if (intent.includes('commercial') || intent.includes('transactional')) return 85;
  if (intent.includes('navigational')) return 60;
  return 40;
}

function mapIntent(intent: string): KwScore['intent'] {
  if (intent.includes('commercial')) return 'commercial';
  if (intent.includes('transactional')) return 'transactional';
  if (intent.includes('navigational')) return 'navigational';
  return 'informational';
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function extractTheme(keyword: string): string {
  return keyword.split(' ').slice(0, 2).join(' ');
}

export { FALLBACKS };
