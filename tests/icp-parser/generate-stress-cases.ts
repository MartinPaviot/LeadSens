/**
 * Generates 1000 realistic SDR ICP descriptions for stress testing.
 * Run with: npx tsx tests/icp-parser/generate-stress-cases.ts
 */
import { writeFileSync } from "fs";
import { resolve } from "path";

interface RawCase {
  description: string;
  language: "en" | "fr";
  sectorHint: string;
}

// ── Building blocks ──────────────────────────────────────

const ROLES_EN = {
  clevel: [
    "CEO", "CTO", "CFO", "CMO", "COO", "CRO", "CHRO", "CIO", "CISO", "CPO", "CDO", "CCO",
    "Chief Executive Officer", "Chief Technology Officer", "Chief Financial Officer",
    "Chief Marketing Officer", "Chief Revenue Officer", "Chief Product Officer",
    "Chief Information Security Officer", "Chief Digital Officer", "Chief Data Officer",
    "Chief Commercial Officer", "Chief People Officer", "Chief Strategy Officer",
  ],
  vp: [
    "VP Sales", "VP Marketing", "VP Engineering", "VP Product", "VP Finance",
    "VP Operations", "VP Customer Success", "VP Revenue", "VP People", "VP HR",
    "VP of Sales", "VP of Marketing", "VP of Engineering", "VP of Product",
    "VP Business Development", "VP Growth", "VP Partnerships", "VP Strategy",
    "VP Supply Chain", "VP IT", "VP Design", "VP Data",
    "SVP Sales", "SVP Marketing", "SVP Engineering",
  ],
  director: [
    "Sales Director", "Marketing Director", "Engineering Director", "Product Director",
    "Finance Director", "IT Director", "HR Director", "Operations Director",
    "Director of Sales", "Director of Marketing", "Director of Engineering",
    "Director of Product", "Director of Finance", "Director of IT",
    "Head of Sales", "Head of Marketing", "Head of Engineering", "Head of Product",
    "Head of Growth", "Head of Partnerships", "Head of Customer Success",
    "Head of Data", "Head of Design", "Head of Legal", "Head of Compliance",
    "Head of Procurement", "Head of Supply Chain", "Head of Talent",
    "Head of RevOps", "Head of Security", "Head of QA", "Head of DevOps",
    "Head of Content", "Head of Brand", "Head of Demand Gen",
    "Head of Employer Branding", "Head of L&D", "Head of Training",
    "Head of Facilities", "Head of Fleet", "Head of Risk",
    "Head of Treasury", "Head of Regulatory Affairs",
  ],
  manager: [
    "Sales Manager", "Marketing Manager", "Product Manager", "Engineering Manager",
    "Project Manager", "Account Manager", "Customer Success Manager",
    "Operations Manager", "HR Manager", "Finance Manager", "IT Manager",
    "Growth Manager", "Growth Hacker", "RevOps Manager", "Procurement Manager",
    "Supply Chain Manager", "Logistics Manager", "Quality Manager",
    "Brand Manager", "Content Manager", "Community Manager",
    "Demand Gen Manager", "SEO Manager", "PPC Manager",
    "Talent Acquisition Manager", "Recruiting Manager",
    "Plant Manager", "Fleet Manager", "Warehouse Manager",
    "Risk Manager", "Compliance Manager", "Treasury Manager",
    "Key Account Manager", "Regional Sales Manager", "Territory Manager",
    "Channel Manager", "Partner Manager", "Alliances Manager",
  ],
  ic: [
    "SDR", "BDR", "Account Executive", "AE",
    "Sales Development Representative", "Business Development Representative",
    "Consultant", "Senior Consultant", "Management Consultant",
    "Data Analyst", "Business Analyst", "Data Scientist",
    "Software Engineer", "Senior Developer", "DevOps Engineer",
    "UX Designer", "Product Designer", "UX Researcher",
    "Recruiter", "Technical Recruiter", "Sourcer",
    "Buyer", "Procurement Specialist", "Purchasing Agent",
    "Financial Analyst", "Controller", "Accountant",
    "Legal Counsel", "Paralegal",
  ],
};

const ROLES_FR = {
  clevel: [
    "PDG", "DG", "Directeur Général", "DAF", "DRH", "DSI", "RSSI",
    "Directeur Technique", "Directeur Marketing", "Directeur Commercial",
    "Directeur des Opérations", "Directeur Financier",
  ],
  vp: [
    "VP Ventes", "VP Marketing", "VP Ingénierie", "VP RH", "VP Ops",
  ],
  director: [
    "Directeur Commercial", "Directeur Marketing", "Directeur IT",
    "Directeur RH", "Directeur Achat", "Directeur Supply Chain",
    "Directeur Logistique", "Directeur Qualité", "Directeur Juridique",
    "Directeur de la Conformité", "Directeur de Production",
    "Directeur des Partenariats", "Directeur de la Stratégie",
    "Responsable Commercial", "Responsable Marketing", "Responsable RH",
    "Responsable IT", "Responsable Achat", "Responsable Formation",
    "Responsable Recrutement", "Responsable Qualité",
    "Chef de Projet", "Chef de Produit", "Chef des Ventes",
  ],
  manager: [
    "Manager Commercial", "Manager Marketing", "Manager RH",
    "Responsable de Zone", "Responsable Grand Compte",
    "Responsable Communication", "Responsable Digital",
    "Responsable Logistique", "Responsable Production",
    "Gestionnaire de Flotte", "Responsable HSE",
  ],
  ic: [
    "Commercial", "Consultant", "Analyste", "Développeur",
    "Chargé de Recrutement", "Acheteur", "Contrôleur de Gestion",
    "Juriste", "Comptable",
  ],
};

const INDUSTRIES = [
  { en: "SaaS", fr: "SaaS", hint: "SaaS" },
  { en: "B2B SaaS", fr: "SaaS B2B", hint: "B2B SaaS" },
  { en: "fintech", fr: "fintech", hint: "fintech" },
  { en: "healthcare", fr: "santé", hint: "healthcare" },
  { en: "pharma", fr: "pharmaceutique", hint: "pharma" },
  { en: "biotech", fr: "biotech", hint: "biotech" },
  { en: "medical devices", fr: "dispositifs médicaux", hint: "medtech" },
  { en: "manufacturing", fr: "industrie", hint: "manufacturing" },
  { en: "automotive", fr: "automobile", hint: "automotive" },
  { en: "aerospace", fr: "aéronautique", hint: "aerospace" },
  { en: "defense", fr: "défense", hint: "defense" },
  { en: "energy", fr: "énergie", hint: "energy" },
  { en: "oil & gas", fr: "pétrole et gaz", hint: "oil & gas" },
  { en: "mining", fr: "mines", hint: "mining" },
  { en: "retail", fr: "retail", hint: "retail" },
  { en: "e-commerce", fr: "e-commerce", hint: "ecommerce" },
  { en: "fashion", fr: "mode", hint: "fashion" },
  { en: "luxury", fr: "luxe", hint: "luxury" },
  { en: "food & beverage", fr: "agroalimentaire", hint: "food" },
  { en: "wine & spirits", fr: "vins et spiritueux", hint: "wine" },
  { en: "hospitality", fr: "hôtellerie", hint: "hospitality" },
  { en: "travel", fr: "tourisme", hint: "travel" },
  { en: "real estate", fr: "immobilier", hint: "real estate" },
  { en: "construction", fr: "BTP", hint: "construction" },
  { en: "logistics", fr: "logistique", hint: "logistics" },
  { en: "transportation", fr: "transport", hint: "transport" },
  { en: "trucking", fr: "transport routier", hint: "trucking" },
  { en: "shipping", fr: "maritime", hint: "shipping" },
  { en: "aviation", fr: "aviation", hint: "aviation" },
  { en: "telecom", fr: "télécom", hint: "telecom" },
  { en: "media", fr: "média", hint: "media" },
  { en: "entertainment", fr: "divertissement", hint: "entertainment" },
  { en: "gaming", fr: "jeux vidéo", hint: "gaming" },
  { en: "education", fr: "éducation", hint: "education" },
  { en: "edtech", fr: "edtech", hint: "edtech" },
  { en: "government", fr: "secteur public", hint: "government" },
  { en: "non-profit", fr: "associatif", hint: "non-profit" },
  { en: "agriculture", fr: "agriculture", hint: "agriculture" },
  { en: "consulting", fr: "conseil", hint: "consulting" },
  { en: "staffing", fr: "recrutement", hint: "staffing" },
  { en: "insurance", fr: "assurance", hint: "insurance" },
  { en: "banking", fr: "banque", hint: "banking" },
  { en: "legal services", fr: "services juridiques", hint: "legal" },
  { en: "cybersecurity", fr: "cybersécurité", hint: "cybersecurity" },
  { en: "AI", fr: "intelligence artificielle", hint: "AI" },
  { en: "robotics", fr: "robotique", hint: "robotics" },
  { en: "IoT", fr: "IoT", hint: "IoT" },
  { en: "cleantech", fr: "cleantech", hint: "cleantech" },
  { en: "EV", fr: "véhicules électriques", hint: "EV" },
  { en: "solar", fr: "solaire", hint: "solar" },
  { en: "beauty", fr: "cosmétique", hint: "beauty" },
  { en: "pet care", fr: "animalerie", hint: "pet care" },
  { en: "sports", fr: "sport", hint: "sports" },
  { en: "fitness", fr: "fitness", hint: "fitness" },
  { en: "HR tech", fr: "HR tech", hint: "HR tech" },
  { en: "proptech", fr: "proptech", hint: "proptech" },
  { en: "insurtech", fr: "insurtech", hint: "insurtech" },
  { en: "regtech", fr: "regtech", hint: "regtech" },
  { en: "martech", fr: "martech", hint: "martech" },
  { en: "adtech", fr: "adtech", hint: "adtech" },
  { en: "healthtech", fr: "healthtech", hint: "healthtech" },
  { en: "agritech", fr: "agritech", hint: "agritech" },
  { en: "water treatment", fr: "traitement des eaux", hint: "water" },
  { en: "waste management", fr: "gestion des déchets", hint: "waste" },
  { en: "nuclear", fr: "nucléaire", hint: "nuclear" },
  { en: "furniture", fr: "ameublement", hint: "furniture" },
  { en: "packaging", fr: "emballage", hint: "packaging" },
  { en: "chemicals", fr: "chimie", hint: "chemicals" },
  { en: "textiles", fr: "textile", hint: "textiles" },
  { en: "printing", fr: "imprimerie", hint: "printing" },
];

const SIZES_EN = [
  "startup", "early-stage startup", "seed-stage", "Series A",
  "1-10 employees", "10-50 employees", "50-200 employees", "100-500 employees",
  "500-1000 employees", "1000-5000 employees", "5000+ employees",
  "SMB", "mid-market", "enterprise", "large enterprise",
  "Fortune 500", "Fortune 1000", "Inc 5000",
  "unicorn", "scaleup", "bootstrapped", "VC-backed", "PE-backed",
  "family business", "franchise",
];

const SIZES_FR = [
  "startup", "jeune pousse", "PME", "ETI", "grand groupe",
  "TPE", "micro-entreprise", "scale-up", "licorne",
  "0-25 employés", "25-100 employés", "100-500 employés", "500-2000 employés",
  "CAC 40", "SBF 120", "boite familiale",
];

const GEOS_EN = [
  "US", "USA", "United States", "North America", "NA", "Canada",
  "UK", "United Kingdom", "London", "Europe", "Western Europe",
  "Germany", "DACH", "Nordics", "Benelux", "France",
  "Spain", "Italy", "Eastern Europe", "Poland", "Czech Republic",
  "Middle East", "Gulf", "GCC", "UAE", "Dubai", "Saudi Arabia",
  "Africa", "South Africa", "Nigeria", "Kenya", "West Africa", "East Africa",
  "India", "China", "Japan", "South Korea", "Southeast Asia", "Singapore",
  "Australia", "ANZ", "New Zealand",
  "LATAM", "Brazil", "Mexico", "Argentina", "Colombia",
  "global", "worldwide",
  "San Francisco", "New York", "Boston", "Austin", "Chicago", "Seattle",
  "Toronto", "Berlin", "Amsterdam", "Stockholm", "Zurich",
  "Tel Aviv", "Bangalore", "Mumbai", "Shanghai", "Tokyo",
  "Sydney", "Melbourne", "São Paulo",
  "Bay Area", "Silicon Valley", "Midwest", "East Coast", "West Coast",
];

const GEOS_FR = [
  "France", "Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux",
  "Île-de-France", "IDF", "PACA", "Rhône-Alpes",
  "Europe", "Allemagne", "Espagne", "Italie", "Royaume-Uni",
  "DACH", "Benelux", "Scandinavie",
  "Moyen-Orient", "Afrique", "Afrique de l'Ouest", "Maghreb",
  "Asie", "Inde", "Chine", "Japon",
  "Amérique du Nord", "États-Unis", "Canada",
  "Amérique latine", "Brésil", "Mexique",
  "mondial", "partout",
  "Suisse", "Belgique", "Luxembourg",
];

const TECHS = [
  "Salesforce", "HubSpot", "SAP", "Oracle", "AWS", "Azure", "GCP",
  "Kubernetes", "Docker", "React", "Python", "Java", "Snowflake",
  "Datadog", "Splunk", "MongoDB", "PostgreSQL", "Redis",
  "Shopify", "Magento", "Stripe", "Zendesk", "Intercom",
  "Slack", "Microsoft Teams", "Notion", "Jira", "Confluence",
  "Tableau", "Power BI", "Looker", "dbt", "Airflow",
  "Terraform", "Ansible", "Jenkins", "GitHub Actions",
  "Segment", "Amplitude", "Mixpanel", "Google Analytics",
  "Marketo", "Pardot", "Mailchimp", "Braze", "Iterable",
  "Workday", "BambooHR", "Greenhouse", "Lever",
  "Netsuite", "Sage", "QuickBooks", "Xero",
  "ServiceNow", "Freshworks", "Monday.com",
];

const NEWS_EN = [
  "recently raised funding", "just got funded", "raised Series A", "raised Series B",
  "raised Series C", "post-IPO", "went public",
  "recently acquired", "just merged", "post-acquisition",
  "recently had layoffs", "just downsized",
  "launched a new product", "expanding internationally",
  "hiring aggressively", "opening new offices",
  "new CEO", "leadership change",
];

const NEWS_FR = [
  "vient de lever des fonds", "levée de fonds récente", "série A",
  "vient d'être racheté", "fusion récente",
  "a licencié récemment", "plan social",
  "lancement produit", "expansion internationale",
  "recrute massivement", "nouveau CEO", "changement de direction",
];

const EXCLUSIONS_EN = [
  "not consulting", "excluding Big 4", "no agencies",
  "not in government", "exclude FAANG", "no startups",
  "not non-profit", "excluding freelancers",
  "no banks", "not in insurance",
];

const EXCLUSIONS_FR = [
  "pas de conseil", "hors Big 4", "pas d'agences",
  "pas de secteur public", "hors GAFAM", "pas de startups",
  "hors ESN", "pas de freelances", "sauf banques",
];

// ── Utilities ────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function maybe<T>(arr: T[], probability = 0.3): T | null {
  return Math.random() < probability ? pick(arr) : null;
}

function pickRole(lang: "en" | "fr"): { role: string; level: string } {
  const roles = lang === "en" ? ROLES_EN : ROLES_FR;
  const levels = Object.keys(roles) as (keyof typeof roles)[];
  const level = pick(levels);
  const role = pick(roles[level]);
  return { role, level };
}

// ── Template generators ──────────────────────────────────

function genShort(lang: "en" | "fr"): RawCase {
  const { role } = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const geo = lang === "en" ? maybe(GEOS_EN, 0.5) : maybe(GEOS_FR, 0.5);
  const ind = lang === "en" ? industry.en : industry.fr;
  const parts = [role, ind, geo].filter(Boolean);
  return {
    description: parts.join(" "),
    language: lang,
    sectorHint: `${industry.hint} short`,
  };
}

function genNatural(lang: "en" | "fr"): RawCase {
  const { role } = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const ind = lang === "en" ? industry.en : industry.fr;
  const size = lang === "en" ? maybe(SIZES_EN, 0.6) : maybe(SIZES_FR, 0.6);
  const geo = lang === "en" ? maybe(GEOS_EN, 0.7) : maybe(GEOS_FR, 0.7);

  if (lang === "en") {
    const templates = [
      `${role} at ${ind} companies${size ? `, ${size}` : ""}${geo ? ` in ${geo}` : ""}`,
      `Looking for ${role}s in the ${ind} space${geo ? ` based in ${geo}` : ""}${size ? `, ${size}` : ""}`,
      `I need to reach ${role}s at ${ind} companies${geo ? ` in ${geo}` : ""}`,
      `${role} in ${ind}${geo ? `, ${geo}` : ""}${size ? `, ${size} companies` : ""}`,
      `Who's the ${role} at ${size || "mid-market"} ${ind} companies${geo ? ` in ${geo}` : ""}?`,
      `Target: ${role}, ${ind} sector${size ? `, ${size}` : ""}${geo ? `, ${geo}` : ""}`,
      `Find me ${role}s working in ${ind}${geo ? ` across ${geo}` : ""}`,
      `${ind} ${role}s${geo ? ` in ${geo}` : ""}${size ? `, ${size}` : ""}`,
    ];
    return { description: pick(templates), language: "en", sectorHint: `${industry.hint} natural` };
  } else {
    const templates = [
      `${role} dans le ${ind}${size ? `, ${size}` : ""}${geo ? ` en ${geo}` : ""}`,
      `Je cherche les ${role} dans le secteur ${ind}${geo ? ` basés en ${geo}` : ""}`,
      `${role} des entreprises ${ind}${geo ? ` en ${geo}` : ""}${size ? `, ${size}` : ""}`,
      `Cible : ${role}, secteur ${ind}${size ? `, ${size}` : ""}${geo ? `, ${geo}` : ""}`,
      `Trouve-moi des ${role} dans le ${ind}${geo ? ` en ${geo}` : ""}`,
      `Les ${role} du ${ind}${size ? ` (${size})` : ""}${geo ? ` en ${geo}` : ""}`,
    ];
    return { description: pick(templates), language: "fr", sectorHint: `${industry.hint} naturel` };
  }
}

function genDetailed(lang: "en" | "fr"): RawCase {
  const { role } = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const ind = lang === "en" ? industry.en : industry.fr;
  const size = lang === "en" ? pick(SIZES_EN) : pick(SIZES_FR);
  const geo = lang === "en" ? pick(GEOS_EN) : pick(GEOS_FR);
  const tech = maybe(TECHS, 0.4);
  const news = lang === "en" ? maybe(NEWS_EN, 0.3) : maybe(NEWS_FR, 0.3);
  const excl = lang === "en" ? maybe(EXCLUSIONS_EN, 0.2) : maybe(EXCLUSIONS_FR, 0.2);

  if (lang === "en") {
    let desc = `${role} at ${ind} companies, ${size}, in ${geo}`;
    if (tech) desc += `, using ${tech}`;
    if (news) desc += `, that ${news}`;
    if (excl) desc += `, ${excl}`;
    return { description: desc, language: "en", sectorHint: `${industry.hint} detailed` };
  } else {
    let desc = `${role} dans le ${ind}, ${size}, en ${geo}`;
    if (tech) desc += `, utilisant ${tech}`;
    if (news) desc += `, qui ${news}`;
    if (excl) desc += `, ${excl}`;
    return { description: desc, language: "fr", sectorHint: `${industry.hint} détaillé` };
  }
}

function genMultiRole(lang: "en" | "fr"): RawCase {
  const r1 = pickRole(lang);
  const r2 = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const ind = lang === "en" ? industry.en : industry.fr;
  const geo = lang === "en" ? maybe(GEOS_EN, 0.6) : maybe(GEOS_FR, 0.6);

  if (lang === "en") {
    const templates = [
      `${r1.role} or ${r2.role} at ${ind} companies${geo ? ` in ${geo}` : ""}`,
      `Either ${r1.role} or ${r2.role} in ${ind}${geo ? `, ${geo}` : ""}`,
      `${r1.role} / ${r2.role} at ${ind} firms${geo ? ` in ${geo}` : ""}`,
    ];
    return { description: pick(templates), language: "en", sectorHint: `${industry.hint} multi-role` };
  } else {
    const templates = [
      `${r1.role} ou ${r2.role} dans le ${ind}${geo ? ` en ${geo}` : ""}`,
      `${r1.role} / ${r2.role} dans le secteur ${ind}${geo ? `, ${geo}` : ""}`,
    ];
    return { description: pick(templates), language: "fr", sectorHint: `${industry.hint} multi-rôle` };
  }
}

function genVague(lang: "en" | "fr"): RawCase {
  const vagues_en = [
    "tech people", "someone in finance", "decision makers",
    "marketing folks at tech companies", "anyone in sales",
    "leadership at startups", "people who buy software",
    "the person in charge of IT", "whoever handles procurement",
    "executives", "senior people at large companies",
    "someone technical", "business people", "founders",
  ];
  const vagues_fr = [
    "des gens dans la tech", "quelqu'un en finance", "décideurs",
    "des personnes en marketing", "n'importe qui dans les ventes",
    "la direction des startups", "les acheteurs de logiciels",
    "le responsable IT", "celui qui gère les achats",
    "les cadres dirigeants", "des profils seniors",
  ];
  const desc = lang === "en" ? pick(vagues_en) : pick(vagues_fr);
  return { description: desc, language: lang, sectorHint: "vague" };
}

function genWithTypos(lang: "en" | "fr"): RawCase {
  const base = genNatural(lang);
  // Introduce typos
  const typos: Record<string, string> = {
    "Marketing": "Marketting", "marketing": "marketting",
    "Engineering": "Enginering", "engineering": "enginering",
    "Director": "Directer", "director": "directer",
    "Manager": "Manger", "manager": "manger",
    "companies": "companees", "Company": "Companie",
    "employees": "employess", "startup": "start-up",
    "SaaS": "Saas", "fintech": "fin-tech",
    "entreprise": "entreprize",
    "logistique": "logistiqe", "entreprises": "entreprizes",
    "commercial": "comercial", "recrutement": "recrutemnt",
  };
  let desc = base.description;
  for (const [from, to] of Object.entries(typos)) {
    if (desc.includes(from) && Math.random() < 0.5) {
      desc = desc.replace(from, to);
      break;
    }
  }
  return { ...base, description: desc, sectorHint: base.sectorHint.replace(/natural|naturel/, "typo") };
}

function genFranglais(): RawCase {
  const { role } = pickRole(Math.random() < 0.5 ? "en" : "fr");
  const industry = pick(INDUSTRIES);
  const geo = pick([...GEOS_EN.slice(0, 10), ...GEOS_FR.slice(0, 10)]);
  const size = pick([...SIZES_EN.slice(0, 5), ...SIZES_FR.slice(0, 5)]);

  const templates = [
    `${role} dans le ${industry.en}, ${size}, based in ${geo}`,
    `Je cherche des ${role} in ${industry.en} companies en ${geo}`,
    `${role} at ${industry.fr} companies, ${size}, en ${geo}`,
    `Les ${role} du ${industry.en} sector, ${size}`,
    `Find me ${role} dans le ${industry.fr}, ${geo}`,
  ];
  return { description: pick(templates), language: "fr", sectorHint: `${industry.hint} franglais` };
}

function genWithTech(lang: "en" | "fr"): RawCase {
  const { role } = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const ind = lang === "en" ? industry.en : industry.fr;
  const techs = pickN(TECHS, 1, 3);
  const geo = lang === "en" ? maybe(GEOS_EN, 0.5) : maybe(GEOS_FR, 0.5);

  if (lang === "en") {
    return {
      description: `${role} at ${ind} companies using ${techs.join(", ")}${geo ? ` in ${geo}` : ""}`,
      language: "en",
      sectorHint: `${industry.hint} tech stack`,
    };
  } else {
    return {
      description: `${role} dans le ${ind}, utilisant ${techs.join(", ")}${geo ? ` en ${geo}` : ""}`,
      language: "fr",
      sectorHint: `${industry.hint} tech stack`,
    };
  }
}

function genWithNews(lang: "en" | "fr"): RawCase {
  const { role } = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const ind = lang === "en" ? industry.en : industry.fr;
  const news = lang === "en" ? pick(NEWS_EN) : pick(NEWS_FR);
  const geo = lang === "en" ? maybe(GEOS_EN, 0.5) : maybe(GEOS_FR, 0.5);

  if (lang === "en") {
    return {
      description: `${role} at ${ind} companies that ${news}${geo ? `, in ${geo}` : ""}`,
      language: "en",
      sectorHint: `${industry.hint} news`,
    };
  } else {
    return {
      description: `${role} dans le ${ind} qui ${news}${geo ? `, en ${geo}` : ""}`,
      language: "fr",
      sectorHint: `${industry.hint} news`,
    };
  }
}

function genWithRevenue(lang: "en" | "fr"): RawCase {
  const { role } = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const ind = lang === "en" ? industry.en : industry.fr;
  const revenues_en = [
    "$1M-10M revenue", "$10M-50M revenue", "$50M+ revenue",
    "$100M+ revenue", "over $500M revenue", "doing $1B+",
    "under $5M ARR", "$5M-20M ARR",
  ];
  const revenues_fr = [
    "CA de 1 à 10M€", "CA > 50M€", "CA > 100M€",
    "chiffre d'affaires > 10M", "moins de 5M de CA",
    "entre 10 et 50 millions de CA",
  ];
  const rev = lang === "en" ? pick(revenues_en) : pick(revenues_fr);
  const geo = lang === "en" ? maybe(GEOS_EN, 0.4) : maybe(GEOS_FR, 0.4);

  if (lang === "en") {
    return {
      description: `${role} at ${ind} companies, ${rev}${geo ? `, ${geo}` : ""}`,
      language: "en",
      sectorHint: `${industry.hint} revenue`,
    };
  } else {
    return {
      description: `${role} dans le ${ind}, ${rev}${geo ? `, ${geo}` : ""}`,
      language: "fr",
      sectorHint: `${industry.hint} revenue`,
    };
  }
}

function genWithExclusion(lang: "en" | "fr"): RawCase {
  const { role } = pickRole(lang);
  const industry = pick(INDUSTRIES);
  const ind = lang === "en" ? industry.en : industry.fr;
  const excl = lang === "en" ? pick(EXCLUSIONS_EN) : pick(EXCLUSIONS_FR);
  const geo = lang === "en" ? maybe(GEOS_EN, 0.5) : maybe(GEOS_FR, 0.5);

  if (lang === "en") {
    return {
      description: `${role} in ${ind}${geo ? ` in ${geo}` : ""}, ${excl}`,
      language: "en",
      sectorHint: `${industry.hint} exclusion`,
    };
  } else {
    return {
      description: `${role} dans le ${ind}${geo ? ` en ${geo}` : ""}, ${excl}`,
      language: "fr",
      sectorHint: `${industry.hint} exclusion`,
    };
  }
}

function genLookalike(lang: "en" | "fr"): RawCase {
  const domains = [
    "stripe.com", "hubspot.com", "salesforce.com", "shopify.com", "datadog.com",
    "notion.so", "figma.com", "canva.com", "slack.com", "zoom.us",
    "doctolib.fr", "alan.com", "payfit.com", "contentsquare.com",
    "deliveroo.com", "uber.com", "airbnb.com", "booking.com",
  ];
  const domain = pick(domains);
  const company = domain.split(".")[0];

  if (lang === "en") {
    const templates = [
      `Companies similar to ${company}`,
      `Find companies like ${company}`,
      `Lookalike of ${domain}`,
      `${pick(ROLES_EN.director)} at companies similar to ${company}`,
    ];
    return { description: pick(templates), language: "en", sectorHint: "lookalike" };
  } else {
    const templates = [
      `Entreprises similaires à ${company}`,
      `Boites comme ${company}`,
      `${pick(ROLES_FR.director)} dans des boites comme ${company}`,
    ];
    return { description: pick(templates), language: "fr", sectorHint: "lookalike" };
  }
}

function genStockIndex(lang: "en" | "fr"): RawCase {
  const indices_en = ["Fortune 500", "Fortune 1000", "S&P 500", "Inc 5000", "FTSE 100", "DAX 30"];
  const indices_fr = ["CAC 40", "SBF 120", "Next 40", "French Tech 120"];
  const index = lang === "en" ? pick(indices_en) : pick(indices_fr);
  const { role } = pickRole(lang);

  if (lang === "en") {
    return {
      description: `${role} at ${index} companies`,
      language: "en",
      sectorHint: "stock index",
    };
  } else {
    return {
      description: `${role} dans les entreprises du ${index}`,
      language: "fr",
      sectorHint: "indice boursier",
    };
  }
}

function genCasual(lang: "en" | "fr"): RawCase {
  const industry = pick(INDUSTRIES);
  if (lang === "en") {
    const templates = [
      `who's running sales at fast-growing ${industry.en} companies`,
      `the marketing person at ${industry.en} startups`,
      `whoever handles IT buying at ${industry.en} firms`,
      `someone senior in ${industry.en}`,
      `the sales guy at ${industry.en} companies in ${pick(GEOS_EN)}`,
      `I need the head honcho at ${industry.en} companies`,
      `find me the person who signs checks at ${industry.en} companies`,
      `${industry.en} founders who just raised money`,
    ];
    return { description: pick(templates), language: "en", sectorHint: `${industry.hint} casual` };
  } else {
    const templates = [
      `le mec qui gère les ventes dans le ${industry.fr}`,
      `le/la responsable marketing des boites ${industry.fr}`,
      `celui qui achète dans le ${industry.fr}`,
      `un profil senior dans le ${industry.fr}`,
      `le boss des ventes en ${industry.fr} sur ${pick(GEOS_FR)}`,
      `les patrons de boites ${industry.fr}`,
      `les fondateurs ${industry.fr} qui viennent de lever`,
    ];
    return { description: pick(templates), language: "fr", sectorHint: `${industry.hint} casual` };
  }
}

function genAllCaps(lang: "en" | "fr"): RawCase {
  const base = genShort(lang);
  return { ...base, description: base.description.toUpperCase(), sectorHint: base.sectorHint + " CAPS" };
}

function genNiche(lang: "en" | "fr"): RawCase {
  const niches_en = [
    "Head of Regulatory Affairs at medical device companies in the EU",
    "Fleet Manager at trucking companies with 500+ trucks in the Midwest",
    "VP of Procurement at frozen food manufacturers using SAP",
    "CISO at banks with over 1000 employees in Singapore",
    "Director of Clinical Operations at CROs in the US",
    "Head of Sustainability at mining companies in Africa",
    "Treasury Manager at large retailers in the UK",
    "VP of Revenue Operations at B2B SaaS companies, Series B+",
    "Director of Employer Branding at tech companies in Berlin",
    "Head of Quality Assurance at automotive OEMs in Germany",
    "Plant Manager at semiconductor fabs in Taiwan or South Korea",
    "Chief Compliance Officer at crypto exchanges",
    "VP of Talent Acquisition at consulting firms, 5000+ employees",
    "Director of Customer Education at enterprise SaaS",
    "Head of Investor Relations at publicly traded biotech",
    "VP of Channel Sales at cybersecurity companies in North America",
    "Director of Facilities at hospital chains in India",
    "Head of Claims at P&C insurance companies in the US",
    "Senior Buyer at luxury fashion houses in Paris",
    "GM of APAC at SaaS companies expanding to Asia",
  ];
  const niches_fr = [
    "Responsable Affaires Réglementaires dans les dispositifs médicaux en Europe",
    "Gestionnaire de Flotte dans le transport routier avec 200+ camions",
    "Directeur Achat dans l'agroalimentaire utilisant SAP",
    "RSSI dans les banques de plus de 1000 employés",
    "Directeur des Opérations Cliniques dans les CRO",
    "Responsable RSE dans les sociétés minières en Afrique",
    "Trésorier dans les grandes enseignes retail au UK",
    "Responsable RevOps dans les SaaS B2B, Série B+",
    "Directeur Marque Employeur dans la tech à Berlin",
    "Responsable Qualité chez les équipementiers automobiles en Allemagne",
    "Directeur d'Usine dans la fabrication de semi-conducteurs",
    "Directeur de la Conformité dans les exchanges crypto",
    "Directeur du Recrutement dans les cabinets de conseil, 5000+ employés",
    "Responsable Formation Client dans le SaaS enterprise",
    "Directeur Relations Investisseurs en biotech cotée",
    "Directeur des Ventes Partenaires en cybersécurité en Amérique du Nord",
    "Responsable des Installations dans les chaînes hospitalières en Inde",
    "Responsable Sinistres en assurance IARD",
    "Acheteur Senior dans les maisons de luxe à Paris",
    "DG APAC dans les SaaS en expansion en Asie",
  ];

  if (lang === "en") {
    return { description: pick(niches_en), language: "en", sectorHint: "niche specific" };
  } else {
    return { description: pick(niches_fr), language: "fr", sectorHint: "niche spécifique" };
  }
}

function genAbbreviated(lang: "en" | "fr"): RawCase {
  const abbrevs = [
    "mktg dir SaaS US 100-500 emp",
    "eng mgr fintech NYC",
    "biz dev mgr enterprise SW EMEA",
    "CS dir mid-mkt SaaS NA",
    "ops mgr mfg DACH 1K+ emp",
    "prod mgr AI startup SF",
    "HR dir retail EU 500+",
    "IT mgr healthcare US midwest",
    "procurement mgr auto DE",
    "data eng lead SaaS series B",
    "RevOps mgr B2B SaaS US",
    "SDR mgr tech startup London",
    "demand gen mgr SaaS EMEA",
    "partner mgr fintech APAC",
    "infosec dir banking NYC 10K+ emp",
  ];
  return { description: pick(abbrevs), language: "en", sectorHint: "abbreviated" };
}

// ── Generator distribution ───────────────────────────────

type Generator = (lang: "en" | "fr") => RawCase;

const GENERATORS: { gen: Generator | (() => RawCase); weight: number }[] = [
  { gen: genShort, weight: 100 },
  { gen: genNatural, weight: 200 },
  { gen: genDetailed, weight: 150 },
  { gen: genMultiRole, weight: 60 },
  { gen: genVague, weight: 30 },
  { gen: genWithTypos, weight: 20 },
  { gen: genFranglais as () => RawCase, weight: 15 },
  { gen: genWithTech, weight: 80 },
  { gen: genWithNews, weight: 60 },
  { gen: genWithRevenue, weight: 50 },
  { gen: genWithExclusion, weight: 40 },
  { gen: genLookalike, weight: 25 },
  { gen: genStockIndex, weight: 20 },
  { gen: genCasual, weight: 60 },
  { gen: genAllCaps, weight: 15 },
  { gen: genNiche, weight: 40 },
  { gen: genAbbreviated as unknown as Generator, weight: 15 },
];

// ── Main ─────────────────────────────────────────────────

function generate(count: number): RawCase[] {
  // Build weighted array
  const weighted: (Generator | (() => RawCase))[] = [];
  for (const { gen, weight } of GENERATORS) {
    for (let i = 0; i < weight; i++) {
      weighted.push(gen);
    }
  }

  const cases: RawCase[] = [];
  const seen = new Set<string>();

  while (cases.length < count) {
    const gen = pick(weighted);
    const lang: "en" | "fr" = Math.random() < 0.5 ? "en" : "fr";
    let raw: RawCase;
    try {
      raw = gen.length === 0 ? (gen as () => RawCase)() : (gen as Generator)(lang);
    } catch {
      continue;
    }

    // Deduplicate
    const key = raw.description.toLowerCase().trim();
    if (seen.has(key) || key.length < 3) continue;
    seen.add(key);

    cases.push(raw);
  }

  return cases;
}

// Generate and write
const rawCases = generate(1000);

const tsContent = `import type { TestCase } from "./types";

/**
 * 1000 stress test cases — auto-generated by generate-stress-cases.ts
 * Generated: ${new Date().toISOString()}
 */
export const STRESS_TEST_CASES: TestCase[] = ${JSON.stringify(
  rawCases.map((c, i) => ({
    id: i + 1,
    description: c.description,
    language: c.language,
    sectorHint: c.sectorHint,
  })),
  null,
  2,
)};
`;

const outPath = resolve(__dirname, "descriptions-1000.ts");
writeFileSync(outPath, tsContent, "utf-8");
console.log(`Generated ${rawCases.length} test cases → ${outPath}`);

// Stats
const langDist = { en: 0, fr: 0 };
for (const c of rawCases) langDist[c.language]++;
console.log(`Language distribution: EN=${langDist.en}, FR=${langDist.fr}`);

const hintCounts = new Map<string, number>();
for (const c of rawCases) {
  const base = c.sectorHint.split(" ")[0];
  hintCounts.set(base, (hintCounts.get(base) || 0) + 1);
}
const top10 = [...hintCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log("Top 10 sectors:", top10.map(([k, v]) => `${k}(${v})`).join(", "));
