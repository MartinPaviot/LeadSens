import type { InstantlySearchFilters } from "@/server/lib/connectors/instantly";
import type { StructuralCheck } from "./types";

// ── Valid Instantly API enums ──

const VALID_INDUSTRIES = new Set([
  "Agriculture & Mining", "Business Services", "Computers & Electronics",
  "Consumer Services", "Education", "Energy & Utilities",
  "Financial Services", "Government",
  "Healthcare, Pharmaceuticals, & Biotech", "Manufacturing",
  "Media & Entertainment", "Non-Profit", "Other",
  "Real Estate & Construction", "Retail", "Software & Internet",
  "Telecommunications", "Transportation & Storage",
  "Travel, Recreation, and Leisure", "Wholesale & Distribution",
]);

const VALID_EMPLOYEE_COUNT = new Set([
  "0 - 25", "25 - 100", "100 - 250", "250 - 1000",
  "1K - 10K", "10K - 50K", "50K - 100K", "> 100K",
]);

const VALID_REVENUE = new Set([
  "$0 - 1M", "$1M - 10M", "$10M - 50M", "$50M - 100M",
  "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B",
]);

const VALID_DEPARTMENTS = new Set([
  "Engineering", "Finance & Administration", "Human Resources",
  "IT & IS", "Marketing", "Operations", "Sales", "Support", "Other",
]);

// ── Geo keywords (lowercase) to detect location mentions in description ──
// Comprehensive list covering all continents, major regions, countries, and cities

const GEO_KEYWORDS = [
  // ── Geo markers / catch-alls ──
  "global", "worldwide", "anywhere", "any geo", "no geo", "pas de geo",
  "emerging markets", "marchés émergents",

  // ── Regions / continents ──
  "europe", "european", "européen", "européenne", "européennes", "européens",
  "asia", "asian", "asie", "asiatique",
  "africa", "african", "afrique", "africain",
  "middle east", "moyen-orient", "moyen orient",
  "latin america", "amérique latine", "latam",
  "north america", "amérique du nord",
  "south america", "amérique du sud",
  "southeast asia", "asie du sud-est", "south east asia",
  "east asia", "asie de l'est",
  "sub-saharan", "sub saharan", "subsaharien",
  "central america", "amérique centrale",
  "caribbean", "caraïbes",
  "oceania", "océanie",
  "asia pacific", "asia-pacific",

  // ── Business regions ──
  "dach", "d-a-ch", "nordics", "scandinavi", "benelux",
  "emea", "apac", "anz", "mena", "gcc", "gulf", "maghreb", "na",
  "bay area", "silicon valley", "midwest", "east coast", "west coast",
  "us west coast", "us east coast", "sf", "nyc",

  // ── Countries (EN + FR + adjective forms) ──
  // Europe
  "france", "french", "français", "française", "françaises", "francophone",
  "germany", "german", "allemagne", "allemand", "allemande",
  "uk", "united kingdom", "britain", "british", "england", "english",
  "spain", "spanish", "espagne", "espagnol", "espagnole",
  "italy", "italian", "italie", "italien", "italienne",
  "netherlands", "dutch", "pays-bas", "néerlandais",
  "belgium", "belgian", "belgique", "belge",
  "switzerland", "swiss", "suisse",
  "sweden", "swedish", "suède", "suédois",
  "norway", "norwegian", "norvège",
  "denmark", "danish", "danemark",
  "finland", "finnish", "finlande",
  "austria", "austrian", "autriche",
  "ireland", "irish", "irlande",
  "portugal", "portuguese", "portugais",
  "poland", "polish", "pologne",
  "czech", "tchèque", "romania", "roumanie", "royaume-uni", "royaume uni",
  "algeria", "algérie",
  "hungary", "hungarian", "hongrie",
  "greece", "greek", "grèce",
  "luxembourg", "croatia", "croatie",
  "slovakia", "slovaquie", "slovenia", "slovénie",
  "bulgaria", "bulgarie", "estonia", "estonie",
  "latvia", "lettonie", "lithuania", "lituanie",
  // Americas
  "united states", "usa", "us", "american", "états-unis", "etats-unis", "américain",
  "canada", "canadian", "canadien", "canadienne",
  "mexico", "mexican", "mexique", "mexicain",
  "brazil", "brazilian", "brésil", "brésilien",
  "argentina", "argentine", "argentinien",
  "colombia", "colombian", "colombie",
  "chile", "chilean", "chili",
  "peru", "peruvian", "pérou",
  "costa rica", "panama", "uruguay",
  // Asia
  "china", "chinese", "chine", "chinois",
  "japan", "japanese", "japon", "japonais",
  "india", "indian", "inde", "indien", "indienne",
  "south korea", "korean", "corée", "coréen",
  "taiwan", "taïwan", "taiwanese",
  "singapore", "singapour",
  "hong kong",
  "thailand", "thai", "thaïlande",
  "vietnam", "viêt nam", "vietnamien",
  "indonesia", "indonesian", "indonésie",
  "malaysia", "malaysian", "malaisie",
  "philippines", "philippin",
  // Middle East
  "israel", "israeli", "israël",
  "uae", "emirates", "émirats", "dubai", "dubaï",
  "saudi arabia", "arabie saoudite", "riyadh", "riyad",
  "qatar", "doha",
  "bahrain", "oman", "kuwait", "koweït",
  "abu dhabi",
  // Africa
  "south africa", "afrique du sud",
  "nigeria", "nigéria", "nigérian",
  "kenya", "kenyan",
  "ghana", "ghanéen",
  "egypt", "egyptian", "égypte",
  "morocco", "moroccan", "maroc", "marocain",
  "tunisia", "tunisian", "tunisie", "tunisien",
  "ivory coast", "côte d'ivoire", "ivoirien",
  "senegal", "sénégal", "sénégalais",
  "ethiopia", "éthiopie",
  "tanzania", "tanzanie",
  "congo", "rdc", "zambia", "zambie",
  // Oceania
  "australia", "australian", "australie", "australien",
  "new zealand", "nouvelle-zélande",
  // South Asia
  "pakistan", "pakistanais", "bangladesh", "sri lanka",
  // Maldives / island nations
  "maldives", "seychelles", "bali",

  // ── French regions ──
  "île-de-france", "ile-de-france", "idf", "paca", "rhône-alpes", "bassin parisien",
  "auvergne", "bretagne", "normandie", "occitanie", "nouvelle-aquitaine",
  "hauts-de-france", "grand est", "sud de la france", "nord de la france",
  "afrique de l'ouest", "west africa",

  // ── Cities (worldwide) ──
  // Europe
  "paris", "lyon", "marseille", "toulouse", "bordeaux", "lille", "nantes",
  "strasbourg", "le havre",
  "london", "londres", "berlin", "munich", "münchen", "hamburg", "frankfurt",
  "madrid", "barcelona", "barcelone",
  "amsterdam", "rotterdam",
  "brussels", "bruxelles",
  "zurich", "zürich", "geneva", "genève",
  "rome", "milan",
  "lisbon", "lisbonne",
  "dublin", "stockholm", "oslo", "copenhagen", "copenhague", "helsinki",
  "warsaw", "varsovie", "prague", "vienna", "vienne", "budapest",
  // Americas
  "new york", "nyc", "san francisco", "los angeles", "chicago", "boston",
  "seattle", "austin", "denver", "nashville", "miami", "portland", "atlanta",
  "houston", "dallas", "phoenix", "washington dc",
  "toronto", "vancouver", "montreal", "montréal", "calgary",
  "são paulo", "sao paulo", "rio", "rio de janeiro",
  "mexico city", "ciudad de méxico", "bogota", "bogotá",
  "buenos aires", "santiago", "lima",
  // Asia
  "tokyo", "osaka",
  "shanghai", "beijing", "pékin", "shenzhen", "guangzhou", "hangzhou",
  "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", "pune",
  "singapore", "singapour",
  "hong kong",
  "seoul", "séoul", "busan",
  "taipei",
  "jakarta", "bangkok", "kuala lumpur", "manila", "ho chi minh",
  // Middle East
  "dubai", "dubaï", "abu dhabi", "doha", "riyadh", "riyad", "tel aviv",
  "jeddah", "muscat",
  // Africa
  "lagos", "nairobi", "johannesburg", "cape town", "le cap",
  "cairo", "le caire", "casablanca", "tunis", "accra", "dakar",
  // Oceania
  "sydney", "melbourne", "brisbane", "perth", "auckland",
  // Specific areas
  "wichita",
];

/**
 * Check if description mentions any geographic term.
 */
// ISO 2-letter country codes — must be checked UPPERCASE in original text
const ISO_COUNTRY_CODES = new Set([
  "DE", "FR", "ES", "NL", "BE", "CH", "AT", "SE", "DK", "FI", "PL",
  "IE", "PT", "CZ", "HU", "GR", "RO", "LU", "BR", "MX", "AR", "CO",
  "CL", "PE", "CN", "JP", "KR", "SG", "TH", "MY", "PH", "TW", "VN",
  "AU", "NZ", "ZA", "NG", "KE", "EG", "MA", "TN", "GH", "SA", "AE",
  "BH", "KW", "IL", "TR",
  // NOTE: CA omitted — conflicts with French "CA" (Chiffre d'Affaires)
  // NOTE: IT omitted — conflicts with "IT" (Information Technology)
  // NOTE: QA omitted — conflicts with "QA" (Quality Assurance)
  // NOTE: ID omitted — conflicts with "ID" (identifier/identity)
]);

function descriptionMentionsGeo(description: string): boolean {
  const lower = description.toLowerCase();

  // Check ISO codes first (uppercase only in original text to avoid "de" in French)
  const words = description.split(/[\s,;:!?.()/']+/);
  for (const w of words) {
    if (ISO_COUNTRY_CODES.has(w)) return true;
  }

  return GEO_KEYWORDS.some((kw) => {
    // Word-boundary check to avoid false positives (e.g. "used" matching "us")
    if (kw.length <= 3) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      return regex.test(lower);
    }
    return lower.includes(kw);
  });
}

/**
 * Check if description mentions a role or job function.
 */
function descriptionMentionsRole(description: string): boolean {
  const lower = description.toLowerCase();
  const roleKeywords = [
    "cto", "ceo", "cfo", "coo", "cmo", "cio", "cso", "cpo", "cro", "ciso",
    "vp", "vice president", "director", "head of", "chief",
    "manager", "responsable", "directeur", "directrice", "directores",
    "founder", "fondateur", "fondatrice", "co-founder", "cofondateur",
    "partner", "associé", "président", "president",
    "team lead", "tech lead", "engineer", "developer", "architect", "analyst",
    "consultant", "advisor", "owner", "patron", "gérant",
    "daf", "drh", "dsi", "dg", "pdg", "dpo", "rssi",
    "procurement", "acheteur", "achats",
    "hr", "rh",
    "supply chain", "logistics", "logistique",
    "formation", "training", "recrutement", "recruiting",
    "product", "produit", "growth",
    "gm", "general manager",
    "provost", "revenue manager",
    "fleet manager", "plant manager",
    "decision maker", "décideur",
    "biz dev", "business development",
    // Catch "anyone in charge"
    "in charge",
  ];
  return roleKeywords.some((kw) => {
    // Use word boundary for short keywords to avoid false positives
    // e.g. "doctolib" contains "cto", "hr" inside "chrome", etc.
    if (kw.length <= 4) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      return regex.test(lower);
    }
    return lower.includes(kw);
  });
}

/**
 * Run structural checks on parseICP output.
 * These are hard invariants that must always pass regardless of LLM quality.
 */
export function runStructuralChecks(
  description: string,
  filters: InstantlySearchFilters,
): StructuralCheck {
  const raw = filters as Record<string, unknown>;

  // 1. level must NEVER be present
  const noLevelField = !("level" in raw);

  // 2. skip_owned_leads must be true
  const skipOwnedLeads = filters.skip_owned_leads === true;

  // 3. All enum values must be valid
  let validEnums = true;
  if (filters.industries) {
    validEnums = validEnums && filters.industries.every((v) => VALID_INDUSTRIES.has(v));
  }
  if (filters.employee_count) {
    validEnums = validEnums && filters.employee_count.every((v) => VALID_EMPLOYEE_COUNT.has(v));
  }
  if (filters.revenue) {
    validEnums = validEnums && filters.revenue.every((v) => VALID_REVENUE.has(v));
  }
  if (filters.department) {
    validEnums = validEnums && filters.department.every((v) => VALID_DEPARTMENTS.has(v));
  }

  // 4. No nested wrapper objects
  const flatStructure =
    !("person_filters" in raw) &&
    !("company_filters" in raw) &&
    !("search_filters" in raw) &&
    !("location_filters" in raw) &&
    !("advanced_filters" in raw);

  // 5. If description mentions a SPECIFIC role, job_titles should be present
  // Skip this check when job_titles are actually present or when there's no clear role
  const hasJobTitlesInFilters = Array.isArray(filters.job_titles) && filters.job_titles.length > 0;
  const mentionsRole = hasJobTitlesInFilters ? false : descriptionMentionsRole(description);
  const hasJobTitles = !mentionsRole || hasJobTitlesInFilters;

  // 6. No location hallucination: locations only if geo is mentioned
  const hasLocations = Array.isArray(filters.locations) && filters.locations.length > 0;
  const mentionsGeo = descriptionMentionsGeo(description);
  const noLocationHallucination = !hasLocations || mentionsGeo;

  return {
    noLevelField,
    skipOwnedLeads,
    validEnums,
    flatStructure,
    hasJobTitles,
    noLocationHallucination,
  };
}
