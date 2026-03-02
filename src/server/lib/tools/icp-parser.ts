import { z } from "zod/v4";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import {
  searchFiltersSchema,
  type InstantlySearchFilters,
} from "@/server/lib/connectors/instantly";

const ICP_PARSER_SYSTEM = `You are an ICP (Ideal Customer Profile) parser. Convert natural language descriptions of target prospects into structured Instantly SuperSearch filters.

## PERSON TARGETING

ALWAYS use job_titles for person targeting. job_titles is a FREE TEXT field (plain array of strings) that searches against lead job titles in Instantly.

For each role, set:
1. job_titles: array of the role name and common synonyms/variations
2. department (optional): to narrow results to the right functional area

Standard correspondences (user says → use these filters):
- "VP Sales" → job_titles: ["VP Sales", "VP of Sales", "Vice President Sales"], department: ["Sales"]
- "Sales Director" / "Directeur Commercial" → job_titles: ["Sales Director", "Director of Sales", "Head of Sales"], department: ["Sales"]
- "Head of Sales" → job_titles: ["Head of Sales", "Sales Director", "Director of Sales"], department: ["Sales"]
- "VP Marketing" → job_titles: ["VP Marketing", "VP of Marketing", "Vice President Marketing"], department: ["Marketing"]
- "CTO" → job_titles: ["CTO", "Chief Technology Officer", "Chief Technical Officer"], department: ["Engineering"]
- "CEO" / "PDG" / "dirigeant" → job_titles: ["CEO", "Chief Executive Officer", "Founder", "Co-Founder"]
- "DRH" → job_titles: ["CHRO", "Chief Human Resources Officer", "HR Director", "Head of HR"], department: ["Human Resources"]
- "DSI" → job_titles: ["CIO", "Chief Information Officer", "IT Director"], department: ["IT & IS"]
- "VP Ops" → job_titles: ["VP Operations", "VP Ops", "Vice President Operations"], department: ["Operations"]
- "VP Finance" / "DAF" → job_titles: ["CFO", "VP Finance", "Chief Financial Officer"], department: ["Finance & Administration"]
- "VP HR" → job_titles: ["VP HR", "VP Human Resources", "VP People"], department: ["Human Resources"]
- "Manager Marketing" / "Responsable Marketing" → job_titles: ["Marketing Manager"], department: ["Marketing"]
- "Fondateur" / "Founder" → job_titles: ["Founder", "Co-Founder", "CEO", "Owner"]
- "Growth Hacker" → job_titles: ["Growth Hacker", "Head of Growth", "Growth Manager"]
- "Revenue Operations" → job_titles: ["Revenue Operations Manager", "RevOps Manager", "Head of RevOps"]

When user mentions multiple seniority levels (e.g. "VP or Director Sales"), include all relevant titles:
  job_titles: ["VP Sales", "VP of Sales", "Sales Director", "Director of Sales", "Head of Sales"], department: ["Sales"]

RULES for job_titles:
- ALWAYS include 2-3 title variations to maximize coverage (e.g., "VP Sales" + "VP of Sales" + "Vice President Sales")
- Keep titles SHORT and realistic (exactly what you'd see on LinkedIn)
- For C-level roles, use the acronym + full title (e.g., "CTO" + "Chief Technology Officer")
- department is OPTIONAL but recommended — it narrows results to the right functional area

- names: { include?: string[], exclude?: string[] } — Contact name filter. Rarely used.
- department: string[] — Functional department (OPTIONAL, used to narrow results). STRICT ENUM values:
  "Engineering", "Finance & Administration", "Human Resources", "IT & IS",
  "Marketing", "Operations", "Sales", "Support", "Other"
  MAPPINGS:
  - "ventes" / "commercial" → ["Sales"]
  - "technique" / "dev" / "R&D" → ["Engineering"]
  - "RH" / "ressources humaines" → ["Human Resources"]
  - "DSI" / "informatique" / "IT" → ["IT & IS"]
  - "marketing" / "com" → ["Marketing"]
  - "finance" / "comptabilité" / "DAF" → ["Finance & Administration"]
  - "opérations" / "ops" → ["Operations"]
  - "support" / "SAV" / "service client" → ["Support"]
- job_titles: string[] — FREE TEXT role titles to search for. Plain array of strings, NO include/exclude wrapper. ALWAYS set this field.

## COMPANY FILTERS
- industries: string[] — STRICT VALUES from Instantly SuperSearch. Use ONLY these exact values:
  "Agriculture & Mining", "Business Services", "Computers & Electronics",
  "Consumer Services", "Education", "Energy & Utilities", "Financial Services",
  "Government", "Healthcare, Pharmaceuticals, & Biotech", "Manufacturing",
  "Media & Entertainment", "Non-Profit", "Real Estate & Construction", "Retail",
  "Software & Internet", "Telecommunications", "Transportation & Storage",
  "Travel, Recreation, and Leisure", "Wholesale & Distribution"
  MAPPINGS:
  - "SaaS" / "software" / "tech" / "logiciel" / "IT" → ["Software & Internet"]
  - "SaaS B2B" → industries: ["Software & Internet"]  (industry already covers it, do NOT add keyword_filter)
  - "fintech" → ["Financial Services", "Software & Internet"]
  - "e-commerce" → ["Retail", "Software & Internet"]
  - "cybersecurity" / "cybersécurité" → ["Software & Internet"]
  - "AI" / "IA" → ["Software & Internet"]
  - "healthcare" / "santé" / "pharma" → ["Healthcare, Pharmaceuticals, & Biotech"]
  - "consulting" / "conseil" → ["Business Services"]
  - "immobilier" / "real estate" → ["Real Estate & Construction"]
  - "éducation" / "edtech" → ["Education"]
  - "média" / "presse" / "entertainment" → ["Media & Entertainment"]
  - "télécom" → ["Telecommunications"]
  - "énergie" → ["Energy & Utilities"]
  - "banque" / "assurance" / "finance" → ["Financial Services"]
  - "industrie" / "manufacturing" → ["Manufacturing"]
  - "transport" / "logistique" → ["Transportation & Storage"]
  - "retail" / "commerce" → ["Retail"]
- employee_count: string[] — Company size. STRICT values with exact formatting:
  "0 - 25", "25 - 100", "100 - 250", "250 - 1000", "1K - 10K", "10K - 50K", "50K - 100K", "> 100K"
  MAPPINGS (choisis les tranches qui couvrent la fourchette demandée) :
  - "startup" / "petite boite" / "< 25" → ["0 - 25"]
  - "petite entreprise" / "25-100" → ["0 - 25", "25 - 100"]
  - "PME" / "50-200" → ["25 - 100", "100 - 250"]
  - "50-500" → ["25 - 100", "100 - 250", "250 - 1000"]
  - "100-500" → ["25 - 100", "100 - 250", "250 - 1000"]
  - "ETI" / "mid-market" / "500-5000" → ["250 - 1000", "1K - 10K"]
  - "grande entreprise" / "enterprise" / "> 5000" → ["10K - 50K", "50K - 100K", "> 100K"]
  - "multinationale" / "très grande entreprise" / "> 50000" → ["50K - 100K", "> 100K"]
  Si la fourchette chevauche plusieurs tranches, inclus TOUTES les tranches qui intersectent.
- revenue: string[] — Annual revenue (USD). STRICT values:
  "$0 - 1M", "$1M - 10M", "$10M - 50M", "$50M - 100M",
  "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"
  - "CA > 10M" → ["$10M - 50M", "$50M - 100M", "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"]
  - "1 a 10M de CA" → ["$1M - 10M"]
- company_names: { include?: string[], exclude?: string[] } — Include/exclude specific companies
- domains: string[] — Company website domains

## LOCATION FILTERS
- locations: string[] — Country, city, or region names. Examples: ["France"], ["United States", "Canada"]
  IMPORTANT: Use standard English names for countries/regions.
- location_filter_type: "contact" | "company_hq" — Filter by contact location or company HQ. Default: omit.

## ADVANCED FILTERS
- keyword_filter: string — Plain keyword string (NOT an object). Searches bio, title, company description.
  IMPORTANT: Do NOT use keyword_filter when the intent is already covered by industries. keyword_filter is for niche sub-segments not mappable to an industry (e.g., "AI for healthcare" → industries: ["Healthcare, Pharmaceuticals, & Biotech"] + keyword_filter: "artificial intelligence").
  - "SaaS", "SaaS B2B", "tech" → industries: ["Software & Internet"] only (NO keyword_filter)
  - "AI for healthcare" → industries: ["Healthcare, Pharmaceuticals, & Biotech"] + keyword_filter: "artificial intelligence"
- technologies: string[] — Tech stack. Ex: ["Salesforce", "HubSpot", "React", "AWS"]
  - "qui utilise Salesforce" → technologies: ["Salesforce"]
- lookalike_domain: string — Find companies similar to this domain
  - "entreprises comme Stripe" → lookalike_domain: "stripe.com"
- news: string — Free text news filter
  - "qui lèvent des fonds" → news: "financing"
  - "qui recrutent" → news: "hiring"
- job_listing: string — Filter by active job postings
  - "qui recrutent des devs" → job_listing: "developer"

## DEDUPLICATION
- skip_owned_leads: boolean — ALWAYS true
- show_one_lead_per_company: boolean — One lead per company

## RULES
1. ALWAYS set skip_owned_leads: true
2. Interpret French AND English descriptions
3. Only include filters clearly specified or strongly implied by the user
4. employee_count, revenue, industries, department are ALL STRICT ENUMS — use EXACT values from the lists above. NEVER invent values.
5. job_titles is FREE TEXT — ALWAYS set it for person targeting. Include 2-3 variations of the title.
6. Output valid JSON matching the schema exactly
7. For technologies, use exact product/tool names (e.g., "Salesforce" not "CRM")
8. For lookalike_domain, extract just the domain (e.g., "stripe.com" not "https://stripe.com")
9. For locations, use standard English country names
10. job_titles, industries, department are PLAIN ARRAYS — NOT { include, exclude } objects
11. keyword_filter and news are PLAIN STRINGS — NOT objects
12. company_names uses { include: [...], exclude: [...] } format
13. CRITICAL: Output a FLAT JSON object with ALL fields at the root level. NEVER nest fields inside "person_filters", "company_filters", "location_filters" or any wrapper object.
14. NEVER include "level" in the output. Use job_titles instead to target seniority.

## OUTPUT FORMAT
Output a FLAT JSON object. Example for "VP Sales dans le SaaS, 50-200 employés, France":
{
  "job_titles": ["VP Sales", "VP of Sales", "Vice President Sales"],
  "department": ["Sales"],
  "industries": ["Software & Internet"],
  "employee_count": ["25 - 100", "100 - 250"],
  "locations": ["France"],
  "skip_owned_leads": true
}
Example for "CTO SaaS B2B, 100-500 employés":
{
  "job_titles": ["CTO", "Chief Technology Officer"],
  "department": ["Engineering"],
  "industries": ["Software & Internet"],
  "employee_count": ["100 - 250", "250 - 1000"],
  "skip_owned_leads": true
}
Example for "Growth Hacker à Paris":
{
  "job_titles": ["Growth Hacker", "Head of Growth", "Growth Manager"],
  "locations": ["Paris, France"],
  "skip_owned_leads": true
}
WRONG — never use level:
{
  "department": ["Sales"],
  "level": ["VP-Level"]
}
WRONG — never nest:
{
  "person_filters": { "department": [...] },
  "company_filters": { "industries": [...] }
}`;


// ─── Post-processing: fix common LLM enum mistakes ─────

const VALID_EMPLOYEE_COUNT = new Set([
  "0 - 25", "25 - 100", "100 - 250", "250 - 1000",
  "1K - 10K", "10K - 50K", "50K - 100K", "> 100K",
]);

const VALID_REVENUE = new Set([
  "$0 - 1M", "$1M - 10M", "$10M - 50M", "$50M - 100M",
  "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B",
]);

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


// Maps common LLM mistakes → correct Instantly API enum values
// API values: "0 - 25", "25 - 100", "100 - 250", "250 - 1000", "1K - 10K", "10K - 50K", "50K - 100K", "> 100K"
const EMPLOYEE_COUNT_FIXES: Record<string, string[]> = {
  // ── No-space variants of correct values ──
  "0-25": ["0 - 25"],
  "25-100": ["25 - 100"],
  "100-250": ["100 - 250"],
  "250-1000": ["250 - 1000"],
  "1K-10K": ["1K - 10K"],
  "10K-50K": ["10K - 50K"],
  "50K-100K": ["50K - 100K"],

  // ── OLD (wrong) API values our code used to produce — map to new correct values ──
  "1 - 10": ["0 - 25"],
  "11 - 25": ["0 - 25"],
  "26 - 50": ["25 - 100"],
  "51 - 100": ["25 - 100"],
  "101 - 250": ["100 - 250"],
  "251 - 500": ["250 - 1000"],
  "501 - 1000": ["250 - 1000"],
  "1K - 5K": ["1K - 10K"],
  "5K - 10K": ["1K - 10K"],
  "10K - 50K": ["10K - 50K"],
  "50K+": ["50K - 100K", "> 100K"],

  // ── Common LLM ranges (map to closest API ranges) ──
  "1-10": ["0 - 25"],
  "11-25": ["0 - 25"],
  "26-50": ["25 - 100"],
  "51-100": ["25 - 100"],
  "101-250": ["100 - 250"],
  "251-500": ["250 - 1000"],
  "501-1000": ["250 - 1000"],
  "1-50": ["0 - 25"],
  "1-25": ["0 - 25"],
  "1-100": ["0 - 25", "25 - 100"],
  "10-50": ["0 - 25", "25 - 100"],
  "11-50": ["0 - 25", "25 - 100"],
  "25-50": ["0 - 25", "25 - 100"],
  "50-100": ["25 - 100"],
  "50-200": ["25 - 100", "100 - 250"],
  "50-250": ["25 - 100", "100 - 250"],
  "50-500": ["25 - 100", "100 - 250", "250 - 1000"],
  "51-200": ["25 - 100", "100 - 250"],
  "100-500": ["25 - 100", "100 - 250", "250 - 1000"],
  "100-1000": ["25 - 100", "100 - 250", "250 - 1000"],
  "200-500": ["100 - 250", "250 - 1000"],
  "200-1000": ["100 - 250", "250 - 1000"],
  "201-500": ["100 - 250", "250 - 1000"],
  "250-500": ["100 - 250", "250 - 1000"],
  "500-1000": ["250 - 1000"],
  "500-5000": ["250 - 1000", "1K - 10K"],
  "1000-5000": ["1K - 10K"],
  "1000-10000": ["1K - 10K"],
  "1001-5000": ["1K - 10K"],
  "5000-10000": ["1K - 10K", "10K - 50K"],
  "5001-10000": ["1K - 10K", "10K - 50K"],
  "5000-50000": ["10K - 50K"],
  "10000-50000": ["10K - 50K"],
  "10001+": ["10K - 50K", "50K - 100K", "> 100K"],
  "50000+": ["50K - 100K", "> 100K"],
  "10000+": ["10K - 50K", "50K - 100K", "> 100K"],

  // ── With spaces (LLM formatting) ──
  "0 - 50": ["0 - 25"],
  "50 - 200": ["25 - 100", "100 - 250"],
  "50 - 250": ["25 - 100", "100 - 250"],
  "50 - 500": ["25 - 100", "100 - 250", "250 - 1000"],
  "100 - 500": ["25 - 100", "100 - 250", "250 - 1000"],
  "200 - 500": ["100 - 250", "250 - 1000"],
  "500 - 1000": ["250 - 1000"],
  "500 - 5000": ["250 - 1000", "1K - 10K"],
  "1000 - 5000": ["1K - 10K"],
  "1000 - 10000": ["1K - 10K"],
  "5000 - 10000": ["1K - 10K", "10K - 50K"],
  "10000 - 50000": ["10K - 50K"],

  // ── Greater-than ranges ──
  "> 100K": ["> 100K"],
  "> 50K": ["50K - 100K", "> 100K"],
  "> 10K": ["10K - 50K", "50K - 100K", "> 100K"],
  "> 5K": ["1K - 10K", "10K - 50K", "50K - 100K", "> 100K"],
  "> 1000": ["1K - 10K", "10K - 50K", "50K - 100K", "> 100K"],
  "> 500": ["250 - 1000", "1K - 10K", "10K - 50K", "50K - 100K", "> 100K"],
};

const REVENUE_FIXES: Record<string, string[]> = {
  // ── No $ prefix (LLM forgets $) ──
  "0-1M": ["$0 - 1M"],
  "1M-10M": ["$1M - 10M"],
  "10M-50M": ["$10M - 50M"],
  "50M-100M": ["$50M - 100M"],
  "100M-250M": ["$100M - 250M"],
  "250M-500M": ["$250M - 500M"],
  "500M-1B": ["$500M - 1B"],
  "1B+": ["> $1B"],

  // ── With $ but no spaces ──
  "$0-1M": ["$0 - 1M"],
  "$1M-10M": ["$1M - 10M"],
  "$10M-50M": ["$10M - 50M"],
  "$50M-100M": ["$50M - 100M"],
  "$100M-250M": ["$100M - 250M"],
  "$250M-500M": ["$250M - 500M"],
  "$500M-1B": ["$500M - 1B"],

  // ── Old API doc ranges (different granularity) ──
  "$100M - 500M": ["$100M - 250M", "$250M - 500M"],
  "$100 - 500M": ["$100M - 250M", "$250M - 500M"],

  // ── Weird $ placement variants ──
  "$0 - 1M": ["$0 - 1M"],
  "$1 - 10M": ["$1M - 10M"],
  "$10 - 50M": ["$10M - 50M"],
  "$50 - 100M": ["$50M - 100M"],
  "$100 - 250M": ["$100M - 250M"],
  "$250 - 500M": ["$250M - 500M"],

  // ── Greater-than ranges ──
  "> $1B": ["> $1B"],
  ">$1B": ["> $1B"],
  "$1B+": ["> $1B"],
  "> 1B": ["> $1B"],
  "> $500M": ["$500M - 1B", "> $1B"],
  "> $250M": ["$250M - 500M", "$500M - 1B", "> $1B"],
  "> $100M": ["$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"],
  "> $50M": ["$50M - 100M", "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"],
  "> $10M": ["$10M - 50M", "$50M - 100M", "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"],
  "> $1M": ["$1M - 10M", "$10M - 50M", "$50M - 100M", "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"],

  // ── Less-than ranges ──
  "< $1M": ["$0 - 1M"],
  "< $10M": ["$0 - 1M", "$1M - 10M"],
  "< $50M": ["$0 - 1M", "$1M - 10M", "$10M - 50M"],
  "< $100M": ["$0 - 1M", "$1M - 10M", "$10M - 50M", "$50M - 100M"],

  // ── Merged ranges LLM might produce ──
  "$0 - 10M": ["$0 - 1M", "$1M - 10M"],
  "$1M - 50M": ["$1M - 10M", "$10M - 50M"],
  "$10M - 100M": ["$10M - 50M", "$50M - 100M"],
  "$50M - 250M": ["$50M - 100M", "$100M - 250M"],
  "$50M - 500M": ["$50M - 100M", "$100M - 250M", "$250M - 500M"],
  "$100M - 1B": ["$100M - 250M", "$250M - 500M", "$500M - 1B"],
  "$250M - 1B": ["$250M - 500M", "$500M - 1B"],
};

// Maps common industry terms → Instantly SuperSearch categories
const INDUSTRY_FIXES: Record<string, string> = {
  // ── Software & Internet (+ subcategories) ──
  "SaaS": "Software & Internet",
  "Software": "Software & Internet",
  "Computer Software": "Software & Internet",
  "Internet": "Software & Internet",
  "Information Technology": "Software & Internet",
  "Information Technology and Services": "Software & Internet",
  "IT": "Software & Internet",
  "Technology": "Software & Internet",
  "Tech": "Software & Internet",
  "Artificial Intelligence": "Software & Internet",
  "AI": "Software & Internet",
  "IA": "Software & Internet",
  "Machine Learning": "Software & Internet",
  "Cybersecurity": "Software & Internet",
  "Cybersécurité": "Software & Internet",
  "Computer & Network Security": "Software & Internet",
  "Software Development": "Software & Internet",
  "Cloud Computing": "Software & Internet",
  "Cloud": "Software & Internet",
  "Web Development": "Software & Internet",
  "Mobile Apps": "Software & Internet",
  "Data Analytics": "Software & Internet",
  "Big Data": "Software & Internet",
  "DevOps": "Software & Internet",
  "Blockchain": "Software & Internet",
  "IoT": "Software & Internet",
  "Logiciel": "Software & Internet",
  "Informatique": "Software & Internet",
  "Numérique": "Software & Internet",
  "Digital": "Software & Internet",
  "PropTech": "Software & Internet",
  "RegTech": "Software & Internet",
  "InsurTech": "Software & Internet",
  "LegalTech": "Software & Internet",
  "HRTech": "Software & Internet",
  "MarTech": "Software & Internet",
  "AdTech": "Software & Internet",
  "CleanTech": "Software & Internet",
  "DeepTech": "Software & Internet",
  "Gaming": "Software & Internet",
  "Jeux vidéo": "Software & Internet",
  "Video Games": "Software & Internet",

  // ── Financial Services ──
  "FinTech": "Financial Services",
  "Banking": "Financial Services",
  "Insurance": "Financial Services",
  "Finance": "Financial Services",
  "Banque": "Financial Services",
  "Assurance": "Financial Services",
  "Investment Banking": "Financial Services",
  "Investment Management": "Financial Services",
  "Venture Capital": "Financial Services",
  "Capital-risque": "Financial Services",
  "Private Equity": "Financial Services",
  "Wealth Management": "Financial Services",
  "Gestion d'actifs": "Financial Services",
  "Accounting": "Financial Services",
  "Comptabilité": "Financial Services",
  "Capital Markets": "Financial Services",
  "Credit": "Financial Services",
  "Crédit": "Financial Services",
  "Fund Management": "Financial Services",
  "Investissement": "Financial Services",

  // ── Healthcare, Pharmaceuticals, & Biotech ──
  "Healthcare": "Healthcare, Pharmaceuticals, & Biotech",
  "Pharmaceuticals": "Healthcare, Pharmaceuticals, & Biotech",
  "Biotech": "Healthcare, Pharmaceuticals, & Biotech",
  "Biotechnology": "Healthcare, Pharmaceuticals, & Biotech",
  "Biotechnologie": "Healthcare, Pharmaceuticals, & Biotech",
  "Hospital & Health Care": "Healthcare, Pharmaceuticals, & Biotech",
  "Medical Devices": "Healthcare, Pharmaceuticals, & Biotech",
  "Santé": "Healthcare, Pharmaceuticals, & Biotech",
  "Médical": "Healthcare, Pharmaceuticals, & Biotech",
  "Pharma": "Healthcare, Pharmaceuticals, & Biotech",
  "Pharmaceutique": "Healthcare, Pharmaceuticals, & Biotech",
  "Health, Wellness and Fitness": "Healthcare, Pharmaceuticals, & Biotech",
  "Mental Health Care": "Healthcare, Pharmaceuticals, & Biotech",
  "Hôpital": "Healthcare, Pharmaceuticals, & Biotech",
  "Medical Practice": "Healthcare, Pharmaceuticals, & Biotech",
  "HealthTech": "Healthcare, Pharmaceuticals, & Biotech",
  "MedTech": "Healthcare, Pharmaceuticals, & Biotech",
  "Clinical Research": "Healthcare, Pharmaceuticals, & Biotech",
  "Veterinary": "Healthcare, Pharmaceuticals, & Biotech",
  "Vétérinaire": "Healthcare, Pharmaceuticals, & Biotech",

  // ── Business Services ──
  "Consulting": "Business Services",
  "Management Consulting": "Business Services",
  "Professional Services": "Business Services",
  "Human Resources": "Business Services",
  "Staffing and Recruiting": "Business Services",
  "Staffing & Recruiting": "Business Services",
  "Recrutement": "Business Services",
  "Conseil": "Business Services",
  "Services aux entreprises": "Business Services",
  "Services professionnels": "Business Services",
  "Outsourcing": "Business Services",
  "BPO": "Business Services",
  "Market Research": "Business Services",
  "Études de marché": "Business Services",
  "Audit": "Business Services",
  "Legal Services": "Business Services",
  "Services juridiques": "Business Services",
  "Training": "Business Services",
  "Formation professionnelle": "Business Services",
  "Facilities Services": "Business Services",
  "Events Services": "Business Services",
  "Événementiel": "Business Services",
  "Translation": "Business Services",
  "Traduction": "Business Services",
  "Design": "Business Services",
  "Graphic Design": "Business Services",
  "Security and Investigations": "Business Services",
  "Sécurité": "Business Services",
  "Research": "Business Services",
  "Information Services": "Business Services",
  "Environmental Services": "Business Services",

  // ── Retail ──
  "E-commerce": "Retail",
  "E-Commerce": "Retail",
  "Ecommerce": "Retail",
  "Commerce": "Retail",
  "Commerce de détail": "Retail",
  "Grande distribution": "Retail",
  "Apparel & Fashion": "Retail",
  "Mode": "Retail",
  "Fashion": "Retail",
  "Luxury Goods & Jewelry": "Retail",
  "Luxe": "Retail",
  "Cosmetics": "Retail",
  "Cosmétique": "Retail",
  "Sporting Goods": "Retail",
  "Wine and Spirits": "Retail",
  "Vins et spiritueux": "Retail",
  "Consumer Goods": "Retail",
  "FMCG": "Retail",
  "Supermarkets": "Retail",
  "Food Production": "Retail",
  "D2C": "Retail",
  "DTC": "Retail",

  // ── Real Estate & Construction ──
  "Real Estate": "Real Estate & Construction",
  "Construction": "Real Estate & Construction",
  "Commercial Real Estate": "Real Estate & Construction",
  "Immobilier": "Real Estate & Construction",
  "BTP": "Real Estate & Construction",
  "Bâtiment": "Real Estate & Construction",
  "Architecture & Planning": "Real Estate & Construction",
  "Architecture": "Real Estate & Construction",
  "Civil Engineering": "Real Estate & Construction",
  "Génie civil": "Real Estate & Construction",
  "Property Management": "Real Estate & Construction",
  "Gestion immobilière": "Real Estate & Construction",
  "Promotion immobilière": "Real Estate & Construction",
  "Building Materials": "Real Estate & Construction",
  "Matériaux de construction": "Real Estate & Construction",

  // ── Education ──
  "Education Management": "Education",
  "E-Learning": "Education",
  "EdTech": "Education",
  "Éducation": "Education",
  "Enseignement": "Education",
  "Formation": "Education",
  "Higher Education": "Education",
  "Université": "Education",
  "Primary/Secondary Education": "Education",
  "École": "Education",
  "Research and Development": "Education",
  "Recherche": "Education",

  // ── Media & Entertainment ──
  "Media": "Media & Entertainment",
  "Entertainment": "Media & Entertainment",
  "Marketing and Advertising": "Media & Entertainment",
  "Online Media": "Media & Entertainment",
  "Média": "Media & Entertainment",
  "Presse": "Media & Entertainment",
  "Publishing": "Media & Entertainment",
  "Édition": "Media & Entertainment",
  "Broadcasting": "Media & Entertainment",
  "Film": "Media & Entertainment",
  "Cinéma": "Media & Entertainment",
  "Music": "Media & Entertainment",
  "Musique": "Media & Entertainment",
  "Animation": "Media & Entertainment",
  "Digital Media": "Media & Entertainment",
  "Newspapers": "Media & Entertainment",
  "Advertising": "Media & Entertainment",
  "Publicité": "Media & Entertainment",
  "Marketing": "Media & Entertainment",
  "Public Relations": "Media & Entertainment",
  "Relations publiques": "Media & Entertainment",
  "Communications": "Media & Entertainment",
  "Photography": "Media & Entertainment",
  "Photographie": "Media & Entertainment",

  // ── Manufacturing ──
  "Automotive": "Manufacturing",
  "Automobile": "Manufacturing",
  "Aerospace": "Manufacturing",
  "Aéronautique": "Manufacturing",
  "Chemicals": "Manufacturing",
  "Chimie": "Manufacturing",
  "Plastics": "Manufacturing",
  "Plastique": "Manufacturing",
  "Textiles": "Manufacturing",
  "Textile": "Manufacturing",
  "Industrial Automation": "Manufacturing",
  "Packaging and Containers": "Manufacturing",
  "Emballage": "Manufacturing",
  "Paper & Forest Products": "Manufacturing",
  "Mechanical or Industrial Engineering": "Manufacturing",
  "Ingénierie industrielle": "Manufacturing",
  "Defense & Space": "Manufacturing",
  "Défense": "Manufacturing",
  "Industrie": "Manufacturing",
  "Production": "Manufacturing",
  "Fabrication": "Manufacturing",
  "Usine": "Manufacturing",
  "Industrial": "Manufacturing",
  "Industriel": "Manufacturing",
  "Electronics Manufacturing": "Manufacturing",
  "Semiconductors": "Manufacturing",
  "Semi-conducteurs": "Manufacturing",
  "Food Manufacturing": "Manufacturing",
  "Agroalimentaire": "Manufacturing",
  "Métallurgie": "Manufacturing",

  // ── Transportation & Storage ──
  "Logistics": "Transportation & Storage",
  "Logistique": "Transportation & Storage",
  "Transport": "Transportation & Storage",
  "Transportation": "Transportation & Storage",
  "Shipping": "Transportation & Storage",
  "Airlines": "Transportation & Storage",
  "Aviation": "Transportation & Storage",
  "Maritime": "Transportation & Storage",
  "Railroad": "Transportation & Storage",
  "Trucking": "Transportation & Storage",
  "Warehousing": "Transportation & Storage",
  "Entreposage": "Transportation & Storage",
  "Supply Chain": "Transportation & Storage",
  "Package/Freight Delivery": "Transportation & Storage",
  "Livraison": "Transportation & Storage",
  "Fret": "Transportation & Storage",

  // ── Energy & Utilities ──
  "Energy": "Energy & Utilities",
  "Utilities": "Energy & Utilities",
  "Énergie": "Energy & Utilities",
  "Oil & Gas": "Energy & Utilities",
  "Pétrole": "Energy & Utilities",
  "Gaz": "Energy & Utilities",
  "Renewables": "Energy & Utilities",
  "Renouvelable": "Energy & Utilities",
  "Énergies renouvelables": "Energy & Utilities",
  "Solar": "Energy & Utilities",
  "Solaire": "Energy & Utilities",
  "Wind": "Energy & Utilities",
  "Éolien": "Energy & Utilities",
  "Nuclear": "Energy & Utilities",
  "Nucléaire": "Energy & Utilities",
  "Power Generation": "Energy & Utilities",
  "Électricité": "Energy & Utilities",
  "Water": "Energy & Utilities",
  "Eau": "Energy & Utilities",

  // ── Government ──
  "Government Administration": "Government",
  "Gouvernement": "Government",
  "Secteur public": "Government",
  "Administration": "Government",
  "Administration publique": "Government",
  "Collectivités": "Government",
  "Military": "Government",
  "Militaire": "Government",
  "Public Safety": "Government",
  "Public Policy": "Government",
  "Politique publique": "Government",

  // ── Telecommunications ──
  "Telecom": "Telecommunications",
  "Télécom": "Telecommunications",
  "Télécommunications": "Telecommunications",
  "Wireless": "Telecommunications",
  "Cable": "Telecommunications",
  "Satellite": "Telecommunications",
  "ISP": "Telecommunications",
  "Opérateur": "Telecommunications",
  "Réseau": "Telecommunications",
  "Network": "Telecommunications",

  // ── Travel, Recreation, and Leisure ──
  "Hospitality": "Travel, Recreation, and Leisure",
  "Tourism": "Travel, Recreation, and Leisure",
  "Tourisme": "Travel, Recreation, and Leisure",
  "Voyage": "Travel, Recreation, and Leisure",
  "Travel": "Travel, Recreation, and Leisure",
  "Hotels": "Travel, Recreation, and Leisure",
  "Hôtellerie": "Travel, Recreation, and Leisure",
  "Restauration": "Travel, Recreation, and Leisure",
  "Restaurants": "Travel, Recreation, and Leisure",
  "Leisure": "Travel, Recreation, and Leisure",
  "Loisirs": "Travel, Recreation, and Leisure",
  "Sports": "Travel, Recreation, and Leisure",
  "Sport": "Travel, Recreation, and Leisure",
  "Gambling & Casinos": "Travel, Recreation, and Leisure",
  "Recreation": "Travel, Recreation, and Leisure",
  "Amusement Parks": "Travel, Recreation, and Leisure",
  "Wellness": "Travel, Recreation, and Leisure",
  "Bien-être": "Travel, Recreation, and Leisure",

  // ── Agriculture & Mining ──
  "Agriculture": "Agriculture & Mining",
  "Mining": "Agriculture & Mining",
  "Mines": "Agriculture & Mining",
  "Minier": "Agriculture & Mining",
  "Exploitation minière": "Agriculture & Mining",
  "Farming": "Agriculture & Mining",
  "Forestry": "Agriculture & Mining",
  "Fishery": "Agriculture & Mining",
  "Dairy": "Agriculture & Mining",
  "Ranching": "Agriculture & Mining",
  "Élevage": "Agriculture & Mining",
  "Pêche": "Agriculture & Mining",
  "Sylviculture": "Agriculture & Mining",
  "Viticulture": "Agriculture & Mining",

  // ── Computers & Electronics ──
  "Consumer Electronics": "Computers & Electronics",
  "Electronics": "Computers & Electronics",
  "Électronique": "Computers & Electronics",
  "Computer Hardware": "Computers & Electronics",
  "Hardware": "Computers & Electronics",
  "Matériel informatique": "Computers & Electronics",
  "Electronic Manufacturing": "Computers & Electronics",
  "Composants électroniques": "Computers & Electronics",

  // ── Consumer Services ──
  "Food & Beverages": "Consumer Services",
  "Services aux particuliers": "Consumer Services",
  "Services à la personne": "Consumer Services",
  "Personal Services": "Consumer Services",
  "Fitness": "Consumer Services",
  "Beauty": "Consumer Services",
  "Beauté": "Consumer Services",
  "Cleaning Services": "Consumer Services",
  "Nettoyage": "Consumer Services",
  "Coiffure": "Consumer Services",
  "Laundry": "Consumer Services",
  "Home Services": "Consumer Services",
  "Services à domicile": "Consumer Services",

  // ── Non-Profit ──
  "Non-Profit Organization Management": "Non-Profit",
  "NGO": "Non-Profit",
  "ONG": "Non-Profit",
  "Association": "Non-Profit",
  "Charity": "Non-Profit",
  "Caritatif": "Non-Profit",
  "Humanitaire": "Non-Profit",
  "Philanthropy": "Non-Profit",
  "Philanthropie": "Non-Profit",
  "Civic & Social Organization": "Non-Profit",
  "Think Tanks": "Non-Profit",
  "Fund-Raising": "Non-Profit",
  "Fondation": "Non-Profit",

  // ── Wholesale & Distribution ──
  "Wholesale": "Wholesale & Distribution",
  "Distribution": "Wholesale & Distribution",
  "Grossiste": "Wholesale & Distribution",
  "Négoce": "Wholesale & Distribution",
  "Import and Export": "Wholesale & Distribution",
  "Import/Export": "Wholesale & Distribution",
  "Import-Export": "Wholesale & Distribution",
};

// ── Department fix map ──
// Maps common LLM mistakes → correct Instantly API enum values (Title Case)
const VALID_DEPARTMENTS = new Set([
  "Engineering", "Finance & Administration", "Human Resources",
  "IT & IS", "Marketing", "Operations", "Sales", "Support", "Other",
]);

const DEPARTMENT_FIXES: Record<string, string> = {
  // ── Lowercase variants ──
  "engineering": "Engineering",
  "sales": "Sales",
  "marketing": "Marketing",
  "operations": "Operations",
  "support": "Support",
  "other": "Other",
  // ── Abbreviated / old schema values ──
  "hr": "Human Resources",
  "human_resources": "Human Resources",
  "it": "IT & IS",
  "finance": "Finance & Administration",
  "legal": "Other",
  // ── French ──
  "ventes": "Sales",
  "commercial": "Sales",
  "technique": "Engineering",
  "développement": "Engineering",
  "informatique": "IT & IS",
  "ressources humaines": "Human Resources",
  "rh": "Human Resources",
  "opérations": "Operations",
};

function fixDepartment(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const fixed = new Set<string>();
  for (const v of values) {
    if (VALID_DEPARTMENTS.has(v)) {
      fixed.add(v);
    } else {
      const mapped = DEPARTMENT_FIXES[v]
        ?? DEPARTMENT_FIXES[v.toLowerCase().trim()]
        ?? Object.entries(DEPARTMENT_FIXES).find(
          ([k]) => k.toLowerCase() === v.toLowerCase().trim(),
        )?.[1];
      if (mapped) {
        fixed.add(mapped);
      } else {
        console.warn(`[fixDepartment] Dropped unknown value: "${v}"`);
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}

// ── Level fix map ──
// Maps old snake_case values → correct Instantly API enum values
const VALID_LEVELS = new Set([
  "C-Level", "VP-Level", "Director-Level", "Manager-Level",
  "Staff", "Entry level", "Mid-Senior level", "Director",
  "Associate", "Owner",
]);

const LEVEL_FIXES: Record<string, string> = {
  // ── Old snake_case schema values ──
  "c_suite": "C-Level",
  "c-suite": "C-Level",
  "c_level": "C-Level",
  "vp": "VP-Level",
  "vp_level": "VP-Level",
  "vp-level": "VP-Level",
  "director": "Director-Level",
  "director_level": "Director-Level",
  "manager": "Manager-Level",
  "manager_level": "Manager-Level",
  "senior": "Mid-Senior level",
  "mid_senior": "Mid-Senior level",
  "entry": "Entry level",
  "entry_level": "Entry level",
  "staff": "Staff",
  "associate": "Associate",
  "owner": "Owner",
  // ── French ──
  "dirigeant": "C-Level",
  "vice-président": "VP-Level",
  "directeur": "Director-Level",
  "responsable": "Manager-Level",
  "confirmé": "Mid-Senior level",
  "junior": "Entry level",
  "débutant": "Entry level",
  "fondateur": "Owner",
};

function fixLevel(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const fixed = new Set<string>();
  for (const v of values) {
    if (VALID_LEVELS.has(v)) {
      fixed.add(v);
    } else {
      const mapped = LEVEL_FIXES[v]
        ?? LEVEL_FIXES[v.toLowerCase().trim()]
        ?? Object.entries(LEVEL_FIXES).find(
          ([k]) => k.toLowerCase() === v.toLowerCase().trim(),
        )?.[1];
      if (mapped) {
        fixed.add(mapped);
      } else {
        console.warn(`[fixLevel] Dropped unknown value: "${v}"`);
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}

// ── Funding type fix map ──
// API expects lowercase snake_case: "seed", "series_a", "pre_seed", "angel"
// LLMs often produce Title Case: "Seed", "Series A", "Pre-Seed", "Angel"
const VALID_FUNDING_TYPES = new Set([
  "angel", "seed", "pre_seed",
  "series_a", "series_b", "series_c", "series_d",
  "series_e", "series_f", "series_g",
  "convertible_note", "corporate_round", "debt_financing",
  "equity_crowdfunding", "grant", "initial_coin_offering",
  "non_equity_assistance", "post_ipo_debt", "post_ipo_equity",
  "post_ipo_secondary", "private_equity", "product_crowdfunding",
  "secondary_market", "undisclosed",
]);

const FUNDING_TYPE_FIXES: Record<string, string> = {
  "Angel": "angel",
  "Seed": "seed",
  "Pre-Seed": "pre_seed",
  "Pre Seed": "pre_seed",
  "PreSeed": "pre_seed",
  "Series A": "series_a",
  "Series B": "series_b",
  "Series C": "series_c",
  "Series D": "series_d",
  "Series E": "series_e",
  "Series F": "series_f",
  "Series G": "series_g",
  "Convertible Note": "convertible_note",
  "Corporate Round": "corporate_round",
  "Debt Financing": "debt_financing",
  "Equity Crowdfunding": "equity_crowdfunding",
  "Grant": "grant",
  "ICO": "initial_coin_offering",
  "Initial Coin Offering": "initial_coin_offering",
  "Private Equity": "private_equity",
};

function fixFundingType(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const fixed = new Set<string>();
  for (const v of values) {
    if (VALID_FUNDING_TYPES.has(v)) {
      fixed.add(v);
    } else {
      const mapped = FUNDING_TYPE_FIXES[v]
        ?? FUNDING_TYPE_FIXES[v.trim()]
        ?? Object.entries(FUNDING_TYPE_FIXES).find(
          ([k]) => k.toLowerCase() === v.toLowerCase().trim(),
        )?.[1];
      if (mapped) {
        fixed.add(mapped);
      } else {
        // Try converting to snake_case as last resort
        const snaked = v.toLowerCase().trim().replace(/[\s-]+/g, "_");
        if (VALID_FUNDING_TYPES.has(snaked)) {
          fixed.add(snaked);
        } else {
          console.warn(`[fixFundingType] Dropped unknown value: "${v}"`);
        }
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}



// ── Fuzzy matching fallback ──
// If a value doesn't match any fix map entry, find the closest valid value
// using substring containment. This catches edge cases the LLM invents.
function fuzzyMatchIndustry(value: string): string | undefined {
  const lower = value.toLowerCase().trim();
  // Try substring match: if the LLM value contains a valid category name (or vice versa)
  for (const valid of VALID_INDUSTRIES) {
    if (lower.includes(valid.toLowerCase()) || valid.toLowerCase().includes(lower)) {
      return valid;
    }
  }
  // Try substring match against fix map keys
  for (const [key, mapped] of Object.entries(INDUSTRY_FIXES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return mapped;
    }
  }
  return undefined;
}

function fixEmployeeCount(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const fixed = new Set<string>();
  for (const v of values) {
    if (VALID_EMPLOYEE_COUNT.has(v)) {
      fixed.add(v);
    } else {
      // Try exact match first, then without spaces
      const stripped = v.replace(/\s/g, "");
      const mapped = EMPLOYEE_COUNT_FIXES[v] ?? EMPLOYEE_COUNT_FIXES[stripped];
      if (mapped) {
        mapped.forEach((m) => fixed.add(m));
      } else {
        // Fuzzy: try to extract numbers and find matching range
        const nums = v.replace(/[^0-9+KkMm]/g, "").toUpperCase();
        const fuzzy = EMPLOYEE_COUNT_FIXES[nums];
        if (fuzzy) fuzzy.forEach((m) => fixed.add(m));
        else console.warn(`[fixEmployeeCount] Dropped unknown value: "${v}"`);
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}

function fixRevenue(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const fixed = new Set<string>();
  for (const v of values) {
    if (VALID_REVENUE.has(v)) {
      fixed.add(v);
    } else {
      // Try exact match, then stripped of spaces
      const stripped = v.replace(/\s/g, "");
      const mapped = REVENUE_FIXES[v] ?? REVENUE_FIXES[stripped];
      if (mapped) {
        mapped.forEach((m) => fixed.add(m));
      } else {
        // Fuzzy: try with/without $ prefix
        const withDollar = v.startsWith("$") ? v : `$${v}`;
        const fuzzy = REVENUE_FIXES[withDollar] ?? REVENUE_FIXES[withDollar.replace(/\s/g, "")];
        if (fuzzy) fuzzy.forEach((m) => fixed.add(m));
        else console.warn(`[fixRevenue] Dropped unknown value: "${v}"`);
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}

function fixIndustries(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const fixed = new Set<string>();
  for (const v of values) {
    if (VALID_INDUSTRIES.has(v)) {
      fixed.add(v);
    } else {
      // Try case-insensitive lookup in fix map
      const mapped = INDUSTRY_FIXES[v]
        ?? INDUSTRY_FIXES[v.trim()]
        ?? Object.entries(INDUSTRY_FIXES).find(
          ([k]) => k.toLowerCase() === v.toLowerCase().trim(),
        )?.[1];
      if (mapped) {
        fixed.add(mapped);
      } else {
        // Fuzzy fallback: substring matching
        const fuzzy = fuzzyMatchIndustry(v);
        if (fuzzy) fixed.add(fuzzy);
        else console.warn(`[fixIndustries] Dropped unknown value: "${v}"`);
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}


/**
 * Post-processes the LLM output to fix common enum mistakes
 * and migrate old field names to the Instantly API v2 format.
 */
function postProcessFilters(raw: Record<string, unknown>): InstantlySearchFilters {
  const filters = { ...raw } as Record<string, unknown>;

  // ── Flatten nested wrappers ──
  // LLM sometimes wraps filters in person_filters, company_filters, location_filters
  // instead of putting them at the root level. Flatten them.
  for (const wrapper of [
    "person_filters", "company_filters", "location_filters",
    "personFilters", "companyFilters", "locationFilters",
    "advanced_filters", "advancedFilters",
    "deduplication", "dedup",
  ]) {
    const nested = filters[wrapper];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      // Merge nested fields into root (don't overwrite existing root fields)
      for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
        if (value !== undefined && value !== null && !(key in filters)) {
          filters[key] = value;
        }
      }
      delete filters[wrapper];
    }
  }

  // ── Field name migration (old schema → API) ──
  // title → job_titles (flatten include/exclude to plain array)
  if (filters.title && !filters.job_titles) {
    const t = filters.title as { include?: string[]; exclude?: string[] } | string[];
    if (Array.isArray(t)) {
      filters.job_titles = t;
    } else if (t.include) {
      filters.job_titles = t.include;
    }
    delete filters.title;
  }

  // employeeCount → employee_count
  if (filters.employeeCount && !filters.employee_count) {
    filters.employee_count = filters.employeeCount;
    delete filters.employeeCount;
  }

  // industry → industries (flatten include/exclude to plain array)
  if (filters.industry && !filters.industries) {
    const ind = filters.industry as { include?: string[]; exclude?: string[] } | string[];
    if (Array.isArray(ind)) {
      filters.industries = ind;
    } else if (ind.include) {
      filters.industries = ind.include;
    }
    delete filters.industry;
  }

  // company_name → company_names
  if (filters.company_name && !filters.company_names) {
    filters.company_names = filters.company_name;
    delete filters.company_name;
  }

  // name → names (convert string[] to {include})
  if (filters.name && !filters.names) {
    const n = filters.name as string[];
    if (Array.isArray(n)) {
      filters.names = { include: n };
    }
    delete filters.name;
  }

  // location_mode → location_filter_type
  if (filters.location_mode && !filters.location_filter_type) {
    filters.location_filter_type = filters.location_mode;
    delete filters.location_mode;
  }

  // look_alike → lookalike_domain
  if (filters.look_alike && !filters.lookalike_domain) {
    filters.lookalike_domain = filters.look_alike;
    delete filters.look_alike;
  }

  // keyword_filter object → plain string
  if (filters.keyword_filter && typeof filters.keyword_filter === "object") {
    const kf = filters.keyword_filter as { include?: string; exclude?: string };
    filters.keyword_filter = kf.include ?? kf.exclude ?? undefined;
  }

  // news array → plain string
  if (filters.news && Array.isArray(filters.news)) {
    filters.news = (filters.news as string[]).join(", ");
  }

  // Remove subIndustry (not in API)
  delete filters.subIndustry;

  // ── Flatten include/exclude wrappers on array fields ──
  // LLM sometimes generates {include: [...]} instead of plain arrays
  // even when the field name is already correct.
  for (const field of ["job_titles", "industries", "technologies", "domains", "funding_type"]) {
    const val = filters[field];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as { include?: string[]; exclude?: string[] };
      if (obj.include) {
        filters[field] = obj.include;
      } else {
        delete filters[field];
      }
    }
  }

  // ── Fix enum values ──
  // NEVER send `level` to the Instantly API (broken: returns 0 or ignores).
  // If level is present without job_titles, the prepareFiltersForAPI fallback
  // in instantly.ts will auto-generate title from level+department.
  // But ideally, we should strip it here and let the ICP parser always use job_titles.
  if (filters.level && !filters.job_titles) {
    console.log(`[postProcessFilters] level=${JSON.stringify(filters.level)} without job_titles — will be converted to title by prepareFiltersForAPI`);
  }
  // If LLM output both job_titles AND level, drop level (job_titles is the primary targeting).
  if (filters.job_titles && filters.level) {
    console.log("[postProcessFilters] Both job_titles and level set. Dropping level (job_titles wins).");
    delete filters.level;
  }

  if (filters.industries) {
    filters.industries = fixIndustries(filters.industries as string[]);
  }

  if (filters.employee_count) {
    filters.employee_count = fixEmployeeCount(filters.employee_count as string[]);
  }

  if (filters.revenue) {
    filters.revenue = fixRevenue(filters.revenue as string[]);
  }

  if (filters.department) {
    filters.department = fixDepartment(filters.department as string[]);
  }

  if (filters.level) {
    filters.level = fixLevel(filters.level as string[]);
  }

  if (filters.funding_type) {
    filters.funding_type = fixFundingType(filters.funding_type as string[]);
  }

  // Remove undefined/null fields to avoid Zod issues
  for (const key of Object.keys(filters)) {
    if (filters[key] === undefined || filters[key] === null) {
      delete filters[key];
    }
  }

  // Always enforce
  filters.skip_owned_leads = true;
  filters.show_one_lead_per_company = true;

  return filters as InstantlySearchFilters;
}

// ─── Lenient field-by-field extraction ──────────────────
// If Zod still rejects after postProcess, extract what we can field-by-field
// rather than failing entirely.

function stripInvalidFields(raw: Record<string, unknown>): Partial<InstantlySearchFilters> {
  const safe: Record<string, unknown> = {};

  // Build a map of field name → individual Zod schema
  const shape = (searchFiltersSchema as unknown as { shape: Record<string, z.ZodType> }).shape;
  if (!shape) return safe;

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    const fieldSchema = shape[key];
    if (!fieldSchema) continue;
    const result = fieldSchema.safeParse(value);
    if (result.success) {
      safe[key] = result.data;
    }
    // If this field fails, silently drop it
  }

  return safe as Partial<InstantlySearchFilters>;
}


// ─── Main parser ────────────────────────────────────────

/** Check if filters contain at least one meaningful field (not just dedup flags) */
function hasSubstantiveFilters(filters: Record<string, unknown>): boolean {
  const DEDUP_ONLY = new Set(["skip_owned_leads", "show_one_lead_per_company"]);
  return Object.keys(filters).some(
    (k) => !DEDUP_ONLY.has(k) && filters[k] !== undefined && filters[k] !== null,
  );
}

export async function parseICP(
  description: string,
  workspaceId: string,
): Promise<InstantlySearchFilters> {
  // 1. Get raw JSON from LLM (no Zod validation — that happens AFTER post-processing)
  const raw = await mistralClient.jsonRaw({
    model: "mistral-large-latest",
    system: ICP_PARSER_SYSTEM,
    prompt: `Convert this ICP description into Instantly SuperSearch filters:\n\n${description}`,
    workspaceId,
    action: "icp-parse",
  });

  console.log("[parseICP] Raw LLM output:", JSON.stringify(raw).slice(0, 1000));

  // 2. Post-process to fix common LLM enum mistakes
  const fixed = postProcessFilters(raw as Record<string, unknown>);

  console.log("[parseICP] After postProcess:", JSON.stringify(fixed).slice(0, 1000));

  // 3. Validate with Zod AFTER post-processing
  const validated = searchFiltersSchema.safeParse(fixed);
  if (validated.success) {
    // Guard: check if we accidentally stripped everything
    if (!hasSubstantiveFilters(validated.data as unknown as Record<string, unknown>)) {
      console.error("[parseICP] WARNING: All filters were stripped! Raw had:", Object.keys(raw as object).join(", "));
      // Try stripping from the raw output directly (in case postProcess failed to flatten)
      const rawStripped = { skip_owned_leads: true, ...stripInvalidFields(postProcessFilters(raw as Record<string, unknown>)) } as InstantlySearchFilters;
      if (hasSubstantiveFilters(rawStripped as unknown as Record<string, unknown>)) {
        console.log("[parseICP] Recovered filters from raw:", JSON.stringify(rawStripped).slice(0, 1000));
        return rawStripped;
      }
    }
    console.log("[parseICP] Final filters (Zod OK):", JSON.stringify(validated.data).slice(0, 1000));
    return validated.data;
  }

  // 4. If still invalid, extract valid fields individually (never throw)
  console.warn("[parseICP] Zod validation failed:", JSON.stringify(validated.error.issues));
  const stripped = { skip_owned_leads: true, ...stripInvalidFields(fixed) } as InstantlySearchFilters;
  console.log("[parseICP] Final filters (stripped):", JSON.stringify(stripped).slice(0, 1000));
  return stripped;
}
