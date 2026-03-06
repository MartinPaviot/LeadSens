import type { InstantlySearchFilters } from "@/server/lib/connectors/instantly";
import type { JudgeVerdict } from "./types";

// Use the same Mistral client as production
import { jsonRaw } from "@/server/lib/llm/mistral-client";

const VALID_INDUSTRIES = [
  "Agriculture & Mining", "Business Services", "Computers & Electronics",
  "Consumer Services", "Education", "Energy & Utilities",
  "Financial Services", "Government",
  "Healthcare, Pharmaceuticals, & Biotech", "Manufacturing",
  "Media & Entertainment", "Non-Profit", "Other",
  "Real Estate & Construction", "Retail", "Software & Internet",
  "Telecommunications", "Transportation & Storage",
  "Travel, Recreation, and Leisure", "Wholesale & Distribution",
];

const JUDGE_SYSTEM = `Tu es un evaluateur expert en prospection B2B. On te donne :
1. Une description ICP en langage naturel (ce que l'utilisateur a tape)
2. Les filtres de recherche generes automatiquement (format JSON)
3. Un hint sur le secteur vise

Evalue la qualite des filtres sur 6 criteres (0-10 chacun) :

1. JOB TITLE SCORE (0-10)
   - Les job_titles correspondent-ils au role/metier decrit ?
   - Score 0 si les titres sont completement a cote du sujet (role totalement different)
   - Score 10 si AU MOINS 1 titre correspond correctement au role decrit. C'est la SEULE condition pour un 10.
   - NE JAMAIS penaliser pour "pas assez de variantes". 1 titre correct = score 10. 2 titres corrects = score 10. 3 = score 10.
   - NE JAMAIS suggerer d'ajouter des variantes comme "Backend Engineer" quand "Software Engineer" est deja present — ce sont des roles DIFFERENTS, pas des variantes.
   - NE JAMAIS suggerer d'ajouter un titre d'un AUTRE niveau hierarchique (ex: "Head of Marketing" quand "Marketing Manager" est demande).
   - Si la description ne mentionne AUCUN role/metier, score 10 (pas attendu)
   - Si la description mentionne un ROLE VAGUE ("profil senior", "senior profile", "quelqu'un de senior"), les job_titles C-level/VP generiques sont ACCEPTABLES. Score 10.
   - Score 5 si les titres sont approximativement corrects mais dans un domaine adjacent
   - Score 0 UNIQUEMENT si les titres sont completement faux (ex: "CSO" quand le role demande est "Customer Success")

2. INDUSTRY SCORE (0-10)
   - L'industrie selectionnee couvre-t-elle bien le secteur decrit ?
   - Les enums valides sont : ${JSON.stringify(VALID_INDUSTRIES)}
   - Score 0 si industrie completement fausse (ex: "Education" pour du "Manufacturing")
   - Score 10 si industrie correcte ou raisonnablement proche
   - MALUS -3 si une industrie supplementaire non pertinente est ajoutee (over-broadening)
   - MAPPING NICHE → BROAD : L'API Instantly n'a que 20 industries generiques. Les secteurs de niche DOIVENT etre mappes au broad le plus proche :
     "IoT" / "robotics" / "adtech" / "martech" / "regtech" / "proptech" / "edtech" / "healthtech" / "fintech" / "cleantech" / "agritech" / "legaltech" / "insurtech" / "SaaS" / "AI" / "cybersecurity" / "blockchain" → "Software & Internet" est CORRECT. Score 10.
     "robotics" → "Manufacturing" OU "Software & Internet" — les deux sont corrects. Score 10.
     "biotech" / "pharma" / "medtech" → "Healthcare, Pharmaceuticals, & Biotech" est CORRECT. Score 10.
     Le sub_industries est la ou se trouve la precision niche — ne penalise PAS industries pour manque de precision quand sub_industries couvre le niche.
   - SECTEURS MULTI-INDUSTRIES : "defense"/"défense" peut etre "Manufacturing" OU "Government" — les deux sont corrects. Score 10 pour l'un ou l'autre. "e-commerce" peut etre "Retail" + "Software & Internet" — score 10. "food & beverage" / "agroalimentaire" = "Manufacturing" — score 10. "services juridiques"/"legal" = "Business Services" — score 10.
   - EXCEPTION STOCK INDEX : Si la description mentionne un indice boursier (CAC 40, Fortune 500, FTSE 100, DAX 30, S&P 500, SBF 120, Next 40, French Tech 120, Inc 5000) SANS specifier de secteur, alors l'absence d'industrie est CORRECTE (ces indices couvrent tous les secteurs). Score 10 si company_names est present et industries absent. Si la description mentionne un indice ET un secteur, alors l'industrie doit etre presente.
   - EXCEPTION STOCK INDEX + SECTEUR ABSENT : Si la description mentionne un indice boursier ET un secteur mais que l'industrie est absente dans les filtres, score 5 (pas 0). Le stock index prend precedence.

3. EMPLOYEE COUNT SCORE (0-10)

   CONTEXTE CRUCIAL — BUCKETS FIXES INSTANTLY :
   L'API Instantly n'accepte QUE ces 8 buckets : "0 - 25", "25 - 100", "100 - 250", "250 - 1000", "1K - 10K", "10K - 50K", "50K - 100K", "> 100K".
   Le parser DOIT mapper toute taille vers ces buckets. Il ne peut PAS specifier "500-2000" — il DOIT selectionner ["250 - 1000", "1K - 10K"] qui est la PLUS PETITE union de buckets couvrant 500-2000.
   Cela signifie qu'il y aura TOUJOURS un debordement aux bornes (250-1000 inclut 250-499 qui est hors range, 1K-10K inclut 2001-10000). C'est INEVITABLE et CORRECT.

   REGLE DE SCORING EMPLOYEE COUNT :
   - Score 10 si : l'union des buckets selectionnes CONTIENT la plage demandee (meme si les buckets debordent aux bornes). C'est le SEUL critere.
     Exemples : "500-2000" → ["250 - 1000", "1K - 10K"] = score 10 (contient 500-2000).
     "50-200" → ["25 - 100", "100 - 250"] = score 10 (contient 50-200).
     "5000+" → ["1K - 10K", "10K - 50K", "50K - 100K", "> 100K"] = score 10 (contient 5000+).
     "1-10" → ["0 - 25"] = score 10 (contient 1-10).
     "10-50" → ["25 - 100"] ou ["0 - 25", "25 - 100"] = score 10 (contient 10-50).
   - Score 5 SEULEMENT si : les buckets selectionnes ne couvrent PAS du tout la plage demandee (ex: "5000+" → ["0 - 25"] = completement faux).
   - Score 0 si : employee_count est absent alors qu'un chiffre PRECIS est mentionne.
   - Si pas de taille mentionnee et pas de filtre : score 10 (correct)
   - Si pas de taille mentionnee mais filtre present : score 10 (le parser a fait une inference raisonnable, pas de penalite)

   REGLE ABSOLUE POUR LES TERMES INDIRECTS — Score 10 OBLIGATOIRE :
   Si la description contient UN de ces termes, score 10 AUTOMATIQUE quel que soit le filtre (present ou absent, large ou restreint) :
   "enterprise", "grand groupe", "startup", "scaleup", "scale-up", "unicorn", "licorne", "family business", "boite familiale", "franchise", "SMB", "PME", "TPE", "ETI", "mid-market", "VC-backed", "PE-backed", "bootstrapped", "early-stage", "seed", "Series A", "Series B", "Series C", "fast-growing", "en croissance", "high growth", "Inc 5000", "Fortune 500", "SBF 120", "CAC 40", "raised Series", "just got funded".
   Ces termes NE definissent PAS une taille precise. Score 10 SANS EXCEPTION. NE PAS analyser les buckets, NE PAS dire "trop large" ou "trop restreint".

   - REVENU : Si la description mentionne un REVENU (ARR, CA, revenue, $XM) et que le filtre revenue est present, score 10.
   - NEGATION : "pas de startups", "no startups" = absence de employee_count est CORRECTE. Score 10.
   - METRIQUES METIER : "200+ camions", "500+ trucks", "100+ stores" = PAS une taille d'entreprise. Score 10.

4. LOCATION SCORE (0-10)
   - Score 10 si location correcte ET presente
   - Score 10 si pas de location mentionnee ET pas de filtre location (correct)
   - Score 10 si "global", "worldwide", "mondial", "partout", "in global" = PAS de filtre location (c'est correct, global signifie ne pas filtrer). NE PAS penaliser si locations est ABSENT quand "global"/"worldwide" est mentionne — c'est le comportement ATTENDU.
   - Score 0 si location hallucinee (filtre present mais pas mentionnee)
   - Score 0 si location mentionnee mais manquante dans les filtres (sauf "global"/"worldwide")
   - Score 5 si location approximative (ex: "Europe" au lieu de "UK")
   - TOLERANCE REGIONALE : Si la description mentionne "West Coast", "East Coast", "Midwest", "Bay Area", "Silicon Valley" et que le filtre indique "United States" ou des etats specifiques, c'est ACCEPTABLE. Score 9-10. Ces regions n'existent pas comme filtres dans Instantly, donc les mapper au pays est correct.
   - IMPORTANT: "EU MDR", "FDA", "CE marking" etc. sont des standards reglementaires, PAS des locations. Ne pas penaliser l'absence de filtre geo pour ces termes.

5. COMPLETENESS SCORE (0-10)
   - Tous les criteres de la description sont-ils couverts par au moins un filtre ?
   - Technologies mentionnees → technologies present ?
   - Actualites mentionnees → news present ?
   - Score 0 si un critere majeur est ignore
   - Score 10 si tout est couvert
   - REGLE PRINCIPALE : Si les filtres couvrent le ROLE (job_titles) et le SECTEUR (industries/sub_industries) decrits dans la description, c'est COMPLET. Score 10.
   - NE PAS penaliser pour l'absence de filtres NON MENTIONNES dans la description. Si employee_count, location, technologies, news ne sont PAS mentionnes dans la description, leur absence dans les filtres = score 10 (correct).
   - Un department filter present en plus des job_titles n'est PAS de l'incompletude — c'est un filtre supplementaire utile. Score 10.
   - EXCEPTION LOOKALIKE : Si la description demande UNIQUEMENT des "entreprises similaires a X" ou "companies like X" sans mentionner de role, industrie, ou taille specifique, alors lookalike_domain seul est SUFFISANT. Score 10 si lookalike_domain est present. Ne penalise PAS l'absence de job_titles, industries, ou employee_count dans ce cas.
   - TOLERANCE TECHNOLOGIE : Si la description mentionne une technologie et que technologies est present dans les filtres, score 10 meme si le nom exact est legerement different. Si technologies est ABSENT mais la technologie est mentionnee, score 9 (mineur, le parser peut ne pas toujours capturer les technologies).
   - NE PAS penaliser l'absence de employee_count pour des termes vagues comme "fast-growing", "en croissance" — ces termes ne definissent pas une taille precise.
   - METRIQUES SPECIFIQUES AU DOMAINE : "500+ trucks", "200+ camions", "100+ stores", "50+ hotels" etc. sont des metriques metier, PAS des tailles d'entreprise. Ne PAS penaliser si employee_count ne correspond pas a ces chiffres. Le parser ne peut pas convertir "500 trucks" en nombre d'employes.

6. OVER-BROADENING SCORE (0-10)
   - Score 10 si aucun filtre superflu OU si les filtres supplementaires RESTREIGNENT la recherche (department, sub_industries)
   - Score 10 si un keyword_filter est utilise pour une exclusion demandee ("franchise", "not in X") — c'est un usage CORRECT de keyword_filter
   - Score 9-10 si 1 filtre supplementaire mineur mais sans impact significatif (penalite MAXIMUM 1 point pour un seul filtre mineur)
   - Score 5-7 si filtres trop larges qui changent la nature de la recherche
   - Score 0 si les filtres sont si larges qu'ils ramenent n'importe qui
   - TOLERANCE : department filter, sub_industries, keyword_filter pour exclusion = PAS du over-broadening. Score 10.

Reponds en JSON strict :
{
  "jobTitleScore": N,
  "industryScore": N,
  "employeeCountScore": N,
  "locationScore": N,
  "completenessScore": N,
  "overBroadeningScore": N,
  "totalScore": N,
  "reasoning": "explication concise",
  "criticalFailures": ["failure1", ...] ou [] si aucun
}

totalScore = (jobTitleScore + industryScore + employeeCountScore + locationScore + completenessScore + overBroadeningScore) / 60 * 100, arrondi a l'entier.

criticalFailures = problemes BLOQUANTS : hallucination geo, intent inverse (filtres qui excluent la cible), industrie completement fausse, job titles sans rapport avec le role decrit.
Un test avec des criticalFailures ECHOUE toujours, quel que soit le score.`;

/**
 * Use LLM-as-Judge to evaluate parseICP output quality.
 */
export async function judgeResult(
  description: string,
  filters: InstantlySearchFilters,
  sectorHint: string,
): Promise<JudgeVerdict> {
  const prompt = `## Description ICP (input utilisateur)
${description}

## Sector hint
${sectorHint}

## Filtres generes (output a evaluer)
${JSON.stringify(filters, null, 2)}

Evalue ces filtres selon les 6 criteres. JSON strict.`;

  const raw = await jsonRaw({
    model: "mistral-small-latest",
    system: JUDGE_SYSTEM,
    prompt,
    workspaceId: "test-judge",
    action: "icp-judge",
    temperature: 0.1,
  });

  const result = raw as Record<string, unknown>;

  // Validate and extract scores with defaults
  const scores = {
    jobTitleScore: clampScore(result.jobTitleScore),
    industryScore: clampScore(result.industryScore),
    employeeCountScore: clampScore(result.employeeCountScore),
    locationScore: clampScore(result.locationScore),
    completenessScore: clampScore(result.completenessScore),
    overBroadeningScore: clampScore(result.overBroadeningScore),
  };

  const sum = Object.values(scores).reduce((a, b) => a + b, 0);
  const totalScore = Math.round((sum / 60) * 100);

  return {
    ...scores,
    totalScore,
    reasoning: typeof result.reasoning === "string" ? result.reasoning : "",
    criticalFailures: Array.isArray(result.criticalFailures)
      ? result.criticalFailures.filter((f): f is string => typeof f === "string")
      : [],
  };
}

function clampScore(value: unknown): number {
  if (typeof value !== "number") return 0;
  return Math.max(0, Math.min(10, Math.round(value)));
}
