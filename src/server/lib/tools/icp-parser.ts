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

Standard correspondences (user says → use these filters).
CRITICAL: Each line = ONE seniority level. Variations are SYNONYMS at the same level, NOT titles from a different management level.

C-Level (strategic decision-makers, sign budgets, define company strategy):
- "CEO" / "PDG" / "dirigeant" / "DG" → job_titles: ["CEO", "Chief Executive Officer", "PDG", "Directeur Général"], department: []
- "CTO" / "Directeur Technique" → job_titles: ["CTO", "Chief Technology Officer", "Chief Technical Officer"], department: ["Engineering"]
- "CFO" / "DAF" → job_titles: ["CFO", "Chief Financial Officer", "DAF"], department: ["Finance & Administration"]
- "CRO" / "Chief Revenue Officer" → job_titles: ["CRO", "Chief Revenue Officer"], department: ["Sales"]
- "CMO" / "Directeur Marketing" (C-level) → job_titles: ["CMO", "Chief Marketing Officer"], department: ["Marketing"]
- "COO" / "Directeur des Opérations" (C-level) → job_titles: ["COO", "Chief Operating Officer"], department: ["Operations"]
- "CHRO" / "DRH" → job_titles: ["CHRO", "Chief Human Resources Officer", "DRH"], department: ["Human Resources"]
- "CIO" / "DSI" → job_titles: ["CIO", "Chief Information Officer", "DSI"], department: ["IT & IS"]
- "CPO" / "Chief Product Officer" → job_titles: ["CPO", "Chief Product Officer"], department: ["Engineering"]
- "CCO" / "Chief Commercial Officer" → job_titles: ["CCO", "Chief Commercial Officer"], department: ["Sales"]
- "CSO" / "CISO" / "RSSI" → job_titles: ["CISO", "Chief Information Security Officer", "CSO", "RSSI"], department: ["IT & IS"]
- "CDO" / "Chief Digital Officer" / "Chief Data Officer" → job_titles: ["CDO", "Chief Digital Officer", "Chief Data Officer"], department: ["IT & IS"]

VP-Level (execute C-level strategy, run large teams/business units):
- "VP Sales" → job_titles: ["VP Sales", "VP of Sales", "Vice President Sales"], department: ["Sales"]
- "VP Marketing" → job_titles: ["VP Marketing", "VP of Marketing", "Vice President Marketing"], department: ["Marketing"]
- "VP Finance" → job_titles: ["VP Finance", "VP of Finance", "Vice President Finance"], department: ["Finance & Administration"]
- "VP HR" / "VP People" → job_titles: ["VP HR", "VP Human Resources", "VP People", "VP of People"], department: ["Human Resources"]
- "VP Ops" → job_titles: ["VP Operations", "VP Ops", "Vice President Operations"], department: ["Operations"]
- "VP Engineering" → job_titles: ["VP Engineering", "VP of Engineering", "Vice President Engineering"], department: ["Engineering"]
- "VP Product" → job_titles: ["VP Product", "VP of Product", "Vice President Product"], department: ["Engineering"]
- "VP Customer Success" → job_titles: ["VP Customer Success", "VP of Customer Success"], department: ["Support"]
- "VP Revenue" → job_titles: ["VP Revenue", "VP of Revenue"], department: ["Sales"]

Director / Head-Level (run a department or function, report to VP/C-level):
- "Sales Director" / "Directeur Commercial" / "Head of Sales" → job_titles: ["Sales Director", "Director of Sales", "Head of Sales", "Directeur Commercial"], department: ["Sales"]
- "Marketing Director" / "Head of Marketing" → job_titles: ["Marketing Director", "Director of Marketing", "Head of Marketing"], department: ["Marketing"]
- "HR Director" / "Head of HR" → job_titles: ["HR Director", "Head of HR", "Director of Human Resources"], department: ["Human Resources"]
- "IT Director" / "Head of IT" → job_titles: ["IT Director", "Director of IT", "Head of IT"], department: ["IT & IS"]
- "Finance Director" / "Head of Finance" / "Directeur Financier" → job_titles: ["Finance Director", "Director of Finance", "Head of Finance", "Directeur Financier"], department: ["Finance & Administration"]
- "Head of Product" / "Product Director" → job_titles: ["Head of Product", "Product Director", "Director of Product"], department: ["Engineering"]
- "Head of Growth" / "Growth Director" → job_titles: ["Head of Growth", "Growth Director", "Director of Growth"], department: ["Marketing"]
- "Head of Procurement" / "Directeur Achat" → job_titles: ["Head of Procurement", "Procurement Director", "Director of Procurement", "Directeur Achat"], department: ["Operations"]
- "Head of Customer Success" → job_titles: ["Head of Customer Success", "Director of Customer Success", "CS Director"], department: ["Support"]
- "Head of Partnerships" / "Directeur Partenariats" → job_titles: ["Head of Partnerships", "Director of Partnerships", "Partnerships Director"], department: ["Sales"]
- "Head of Data" → job_titles: ["Head of Data", "Data Director", "Director of Data"], department: ["Engineering"]
- "Head of Legal" / "Directeur Juridique" → job_titles: ["Head of Legal", "Legal Director", "General Counsel", "Directeur Juridique"], department: ["Finance & Administration"]
- "Head of Design" → job_titles: ["Head of Design", "Design Director", "Director of Design"], department: ["Engineering"]
- "Engineering Director" → job_titles: ["Engineering Director", "Director of Engineering", "Head of Engineering"], department: ["Engineering"]
- "Head of RevOps" → job_titles: ["Head of RevOps", "Head of Revenue Operations", "Director of Revenue Operations"], department: ["Sales"]

Manager-Level (manage a team within a department, report to Director/Head):
- "Sales Manager" / "Responsable Commercial" → job_titles: ["Sales Manager", "Responsable Commercial"], department: ["Sales"]
- "Marketing Manager" / "Responsable Marketing" → job_titles: ["Marketing Manager", "Responsable Marketing"], department: ["Marketing"]
- "Product Manager" → job_titles: ["Product Manager", "PM"], department: ["Engineering"]
- "Project Manager" / "Chef de Projet" → job_titles: ["Project Manager", "Chef de Projet"], department: ["Operations"]
- "Customer Success Manager" / "CSM" → job_titles: ["Customer Success Manager", "CSM"], department: ["Support"]
- "Account Manager" → job_titles: ["Account Manager", "Key Account Manager", "KAM"], department: ["Sales"]
- "Growth Manager" / "Growth Hacker" → job_titles: ["Growth Manager", "Growth Hacker"], department: ["Marketing"]
- "RevOps Manager" → job_titles: ["Revenue Operations Manager", "RevOps Manager"], department: ["Sales"]
- "Purchasing Manager" / "Responsable Achat" → job_titles: ["Purchasing Manager", "Responsable Achat", "Procurement Manager"], department: ["Operations"]
- "HR Manager" / "Responsable RH" → job_titles: ["HR Manager", "Responsable RH", "Human Resources Manager"], department: ["Human Resources"]
- "Engineering Manager" → job_titles: ["Engineering Manager", "Software Engineering Manager"], department: ["Engineering"]

Individual Contributor (IC) (no direct reports, execute within a team):
- "SDR" / "BDR" → job_titles: ["SDR", "Sales Development Representative", "BDR", "Business Development Representative"], department: ["Sales"]
- "AE" / "Account Executive" → job_titles: ["Account Executive", "AE"], department: ["Sales"]
- "Consultant" → job_titles: ["Consultant", "Senior Consultant"]
- "Data Analyst" → job_titles: ["Data Analyst", "Business Analyst"], department: ["Engineering"]
- "Data Scientist" → job_titles: ["Data Scientist", "Senior Data Scientist"], department: ["Engineering"]

Founders (ownership role — may or may not hold a C-level operational title):
- "Fondateur" / "Founder" → job_titles: ["Founder", "Co-Founder", "Fondateur"]
- "Owner" / "Gérant" → job_titles: ["Owner", "Gérant", "Managing Partner"]

When user mentions multiple seniority levels (e.g. "VP or Director Sales"), include all relevant titles:
  job_titles: ["VP Sales", "VP of Sales", "Sales Director", "Director of Sales", "Head of Sales"], department: ["Sales"]

RULES for job_titles:
- Include 2-3 title variations that are SYNONYMS at the SAME level of seniority and responsibility. Do NOT add titles from a different management level (e.g., don't add "VP Finance" when targeting "CFO", don't add "Sales Manager" when targeting "Sales Director"). Variations should only differ in wording, not in seniority.
- Keep titles SHORT and realistic (exactly what you'd see on LinkedIn)
- For C-level roles, use the acronym + full title (e.g., "CTO" + "Chief Technology Officer")
- department is OPTIONAL but recommended — it narrows results to the right functional area
- ABBREVIATION DISAMBIGUATION: "CS" = Customer Success (NOT Chief Security). "CS dir" = "Director of Customer Success". "SDR" = Sales Development Rep. "AE" = Account Executive. "BDR" = Business Development Rep. "CSM" = Customer Success Manager.

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
  - "agroalimentaire" / "food manufacturing" → ["Manufacturing"]
  - "transport" / "logistique" → ["Transportation & Storage"]
  - "retail" / "commerce" → ["Retail"]

IMPORTANT — Niche sub-sectors within industries:
When the user specifies a niche within a broad industry, use BOTH industries AND sub_industries:
- "mode" / "fashion" / "prêt-à-porter" → industries: ["Retail"], sub_industries: ["Apparel & Fashion"]
- "luxe" / "luxury" → industries: ["Retail"], sub_industries: ["Luxury Goods & Jewelry"]
- "cosmétique" / "beauty" → industries: ["Retail"], sub_industries: ["Cosmetics"]
- "food" / "alimentation" / "FoodTech" → industries: ["Retail"], sub_industries: ["Food Production", "Food & Beverages"]
- "vin" / "wine" → industries: ["Retail"], sub_industries: ["Wine and Spirits"]
- "automobile" / "automotive" → industries: ["Manufacturing"], sub_industries: ["Automotive"]
- "aéronautique" / "aerospace" → industries: ["Manufacturing"], sub_industries: ["Aviation & Aerospace"]
- "gaming" / "jeux vidéo" → industries: ["Software & Internet"], sub_industries: ["Computer Games"]
- "pharma" / "pharmaceutique" → industries: ["Healthcare, Pharmaceuticals, & Biotech"], sub_industries: ["Pharmaceuticals"]
- "biotech" → industries: ["Healthcare, Pharmaceuticals, & Biotech"], sub_industries: ["Biotechnology"]
- "edtech" → industries: ["Education"], sub_industries: ["E-Learning"]
- "immobilier" / "real estate" → industries: ["Real Estate & Construction"], sub_industries: ["Real Estate", "Commercial Real Estate"]
- "assurance" / "insurance" → industries: ["Financial Services"], sub_industries: ["Insurance"]
- "banque" / "banking" → industries: ["Financial Services"], sub_industries: ["Banking"]
- "logistique" / "logistics" → industries: ["Transportation & Storage"], sub_industries: ["Logistics and Supply Chain"]
- "transport routier" / "road transport" / "trucking" → industries: ["Transportation & Storage"], sub_industries: ["Transportation/Trucking/Railroad"]
- "logistics AND road transport" → industries: ["Transportation & Storage"], sub_industries: ["Logistics and Supply Chain", "Transportation/Trucking/Railroad"]
- "maritime" / "shipping" → industries: ["Transportation & Storage"], sub_industries: ["Maritime"]
- "aviation" / "airlines" → industries: ["Transportation & Storage"], sub_industries: ["Airlines/Aviation"]
- "warehousing" / "entreposage" → industries: ["Transportation & Storage"], sub_industries: ["Warehousing"]
- "fret" / "freight" / "delivery" → industries: ["Transportation & Storage"], sub_industries: ["Package/Freight Delivery"]
- "consulting" / "conseil" → industries: ["Business Services"], sub_industries: ["Management Consulting"]
- "recrutement" / "staffing" → industries: ["Business Services"], sub_industries: ["Staffing and Recruiting"]
- "cybersecurity" / "cybersécurité" → industries: ["Software & Internet"], sub_industries: ["Computer & Network Security"]
CRITICAL: When the user describes a NICHE within a broad industry, you MUST set sub_industries with the exact Instantly enum value.
NEVER leave sub_industries empty when the user narrows their sector (e.g. "transport routier" is NOT just "Transportation & Storage").
sub_industries is an array of exact Instantly API values. Only use it for specific niches, NOT for broad industry terms like "SaaS" or "tech".

- employee_count: string[] — Company size. STRICT values with exact formatting:
  "0 - 25", "25 - 100", "100 - 250", "250 - 1000", "1K - 10K", "10K - 50K", "50K - 100K", "> 100K"
  MAPPINGS (choisis les tranches qui couvrent la fourchette demandée) :
  - "startup" / "petite boite" / "< 25" → ["0 - 25"]
  - "petite entreprise" / "25-100" → ["0 - 25", "25 - 100"]
  - "PME" / "50-200" → ["25 - 100", "100 - 250"]
  - "50-500" → ["25 - 100", "100 - 250", "250 - 1000"]
  - "100-500" → ["25 - 100", "100 - 250", "250 - 1000"]
  - "ETI" / "mid-market" / "500-5000" → ["250 - 1000", "1K - 10K"]
  - "SMB" / "small business" → ["0 - 25", "25 - 100", "100 - 250"]
  - "grande entreprise" / "enterprise" / "> 5000" → ["10K - 50K", "50K - 100K", "> 100K"]
  - "large enterprise" / "grand groupe" → ["10K - 50K", "50K - 100K", "> 100K"]
  - "multinationale" / "très grande entreprise" / "> 50000" → ["50K - 100K", "> 100K"]
  - "TPE" / "micro-entreprise" → ["0 - 25"]
  - "scaleup" / "scale-up" → ["100 - 250", "250 - 1000"]
  - "unicorn" / "licorne" → ["250 - 1000", "1K - 10K"]
  - "bootstrapped" → ["0 - 25", "25 - 100"]
  - "VC-backed" / "venture-backed" → ["0 - 25", "25 - 100", "100 - 250"]
  - "PE-backed" → ["250 - 1000", "1K - 10K", "10K - 50K"]
  - "family business" / "boite familiale" → ["0 - 25", "25 - 100", "100 - 250"]
  - "franchise" → ["25 - 100", "100 - 250"]
  - "early-stage" / "seed-stage" → ["0 - 25"]
  - "Series A" → ["0 - 25", "25 - 100"]
  - "Series B" / "Series B+" → ["25 - 100", "100 - 250"]
  - "Series C" / "Series C+" → ["100 - 250", "250 - 1000"]
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
- sub_industries: string[] — Exact Instantly sub-industry values for niche targeting. Only use with industries.
  Common values: "Apparel & Fashion", "Automotive", "Aviation & Aerospace", "Banking", "Biotechnology",
  "Cosmetics", "Computer Games", "Commercial Real Estate", "E-Learning", "Financial Services",
  "Food Production", "Food & Beverages", "Insurance", "Logistics and Supply Chain",
  "Luxury Goods & Jewelry", "Pharmaceuticals", "Real Estate", "Wine and Spirits"
- keyword_filter: string — Plain keyword string (NOT an object). Searches bio, title, company description.
  IMPORTANT: Do NOT use keyword_filter when the intent is covered by industries or sub_industries.
  - "SaaS", "SaaS B2B", "tech" → industries: ["Software & Internet"] only (NO keyword_filter)
  - "fashion" → industries: ["Retail"], sub_industries: ["Apparel & Fashion"] (NO keyword_filter)
  - "AI for healthcare" → industries: ["Healthcare, Pharmaceuticals, & Biotech"] + keyword_filter: "artificial intelligence"
- technologies: string[] — Tech stack. Ex: ["Salesforce", "HubSpot", "React", "AWS"]
  - "qui utilise Salesforce" → technologies: ["Salesforce"]
- lookalike_domain: string — Find companies similar to this domain
  - "entreprises comme Stripe" → lookalike_domain: "stripe.com"
- news: string[] — STRICT ENUM values for company news filters. Use ONLY these exact values:
  "has_had_recent_funding", "has_had_recent_acquisition_or_merger", "has_had_recent_job_change",
  "has_had_recent_technology_change", "has_had_recent_leadership_change", "has_had_recent_layoffs",
  "has_upcoming_contract_renewal", "has_had_recent_new_partnerships", "has_had_recent_award",
  "has_had_product_launch", "has_had_recent_expansion", "has_had_recent_earnings_report",
  "has_active_job_listings", "has_had_recent_investment", "has_had_ipo"
  MAPPINGS:
  - "qui lèvent des fonds" / "funding" → news: ["has_had_recent_funding"]
  - "qui recrutent" / "hiring" → news: ["has_had_recent_job_change"]
  - "acquisition" / "rachat" → news: ["has_had_recent_acquisition_or_merger"]
  - "partenariat" → news: ["has_had_recent_new_partnerships"]
  - "lancement produit" → news: ["has_had_product_launch"]
  - "IPO" → news: ["has_had_ipo"]
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
10. job_titles, industries, sub_industries, department are PLAIN ARRAYS — NOT { include, exclude } objects
11. keyword_filter is a PLAIN STRING — NOT an object. news and sub_industries are PLAIN ARRAYS OF STRINGS.
12. company_names uses { include: [...], exclude: [...] } format
13. CRITICAL: Output a FLAT JSON object with ALL fields at the root level. NEVER nest fields inside "person_filters", "company_filters", "location_filters" or any wrapper object.
14. NEVER include "level" in the output. Use job_titles instead to target seniority.
15. NEVER add a location filter unless the user EXPLICITLY mentions a country, city, or region. Do NOT infer location from the language of the query. A French-language query does NOT imply France. If no location is mentioned, omit the locations field entirely.
16. When the user references a stock index ("CAC 40", "Fortune 500", "FTSE 100", "DAX 30", "S&P 500") or a cross-sector group, do NOT set industries — these indices span ALL sectors. Use company_names or employee_count to target them instead.
17. NEGATION: When the user says "not X", "excluding X", "sauf X", "hors X", "pas de X", do NOT include X in any filter (industries, sub_industries, etc.). Only use company_names.exclude for company exclusions. For industry/sub_industry exclusions, simply OMIT the excluded value — there is no exclude mechanism for these fields.
    CRITICAL FOR EMPLOYEE_COUNT: "pas de startups" / "no startups" / "not freelancers" / "pas de freelances" = do NOT set employee_count at all. There is no exclude mechanism. Setting 7 out of 8 ranges is NOT a valid workaround — it's over-broadening. Simply OMIT employee_count.
18. JOB TITLE PRECISION: The job_titles you generate must ALL be at the same level of decision-making power as the role described by the user. A CFO (signs budgets, defines strategy) is NOT the same as a VP Finance (executes the CFO's strategy). A Head of Sales (runs the department) is NOT the same as a Sales Manager (manages a team within the department). When in doubt, stay NARROW — it's better to miss some leads than to include people at the wrong seniority level.
19. NEWS vs ROLE: "qui nouveau CEO" / "who recently hired a new CEO" is a TRIGGER EVENT (use news: ["has_had_recent_leadership_change"]), NOT the target role. The TARGET ROLE is the other role mentioned in the description (e.g., "Gestionnaire de Flotte qui nouveau CEO" → job_titles: ["Fleet Manager", "Gestionnaire de Flotte"], news: ["has_had_recent_leadership_change"]).

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

  // ── Named size terms (SDR shorthand) ──
  "SMB": ["0 - 25", "25 - 100", "100 - 250"],
  "smb": ["0 - 25", "25 - 100", "100 - 250"],
  "small business": ["0 - 25", "25 - 100", "100 - 250"],
  "mid-market": ["250 - 1000", "1K - 10K"],
  "midmarket": ["250 - 1000", "1K - 10K"],
  "mid market": ["250 - 1000", "1K - 10K"],
  "enterprise": ["10K - 50K", "50K - 100K", "> 100K"],
  "large enterprise": ["10K - 50K", "50K - 100K", "> 100K"],
  "startup": ["0 - 25"],
  "early-stage": ["0 - 25"],
  "early stage": ["0 - 25"],
  "seed-stage": ["0 - 25"],
  "seed stage": ["0 - 25"],
  "scaleup": ["100 - 250", "250 - 1000"],
  "scale-up": ["100 - 250", "250 - 1000"],
  "scale up": ["100 - 250", "250 - 1000"],
  "unicorn": ["250 - 1000", "1K - 10K"],
  "licorne": ["250 - 1000", "1K - 10K"],
  "bootstrapped": ["0 - 25", "25 - 100"],
  "VC-backed": ["0 - 25", "25 - 100", "100 - 250"],
  "PE-backed": ["250 - 1000", "1K - 10K", "10K - 50K"],
  "family business": ["0 - 25", "25 - 100", "100 - 250"],
  "boite familiale": ["0 - 25", "25 - 100", "100 - 250"],
  "franchise": ["25 - 100", "100 - 250"],
  "TPE": ["0 - 25"],
  "tpe": ["0 - 25"],
  "micro-entreprise": ["0 - 25"],
  "PME": ["25 - 100", "100 - 250"],
  "pme": ["25 - 100", "100 - 250"],
  "ETI": ["250 - 1000", "1K - 10K"],
  "eti": ["250 - 1000", "1K - 10K"],
  "grand groupe": ["10K - 50K", "50K - 100K", "> 100K"],
  "Series A": ["0 - 25", "25 - 100"],
  "series_a": ["0 - 25", "25 - 100"],
  "Series B": ["25 - 100", "100 - 250"],
  "series_b": ["25 - 100", "100 - 250"],
  "Series B+": ["25 - 100", "100 - 250", "250 - 1000"],
  "Series C": ["100 - 250", "250 - 1000"],
  "series_c": ["100 - 250", "250 - 1000"],

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

// Maps common industry terms → Instantly SuperSearch categories.
// Value is a single string or an array for cross-sector terms (e.g. FinTech = Finance + Software).
const INDUSTRY_FIXES: Record<string, string | string[]> = {
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
  "Intelligence artificielle": "Software & Internet",
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
  "FinTech": ["Financial Services", "Software & Internet"],
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
  "HealthTech": ["Healthcare, Pharmaceuticals, & Biotech", "Software & Internet"],
  "MedTech": ["Healthcare, Pharmaceuticals, & Biotech", "Software & Internet"],
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
  "E-commerce": ["Retail", "Software & Internet"],
  "E-Commerce": ["Retail", "Software & Internet"],
  "Ecommerce": ["Retail", "Software & Internet"],
  "Commerce": "Retail",
  "Commerce de détail": "Retail",
  "Grande distribution": "Retail",
  "Apparel & Fashion": "Retail",
  "Mode": "Retail",
  "Fashion": "Retail",
  "Luxury Goods & Jewelry": "Retail",
  "Luxury": "Retail",
  "Luxe": "Retail",
  "Cosmetics": "Retail",
  "Cosmétique": "Retail",
  "Furniture": "Retail",
  "Meuble": "Retail",
  "Ameublement": "Retail",
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
  "Education": "Education",
  "Education Management": "Education",
  "E-Learning": "Education",
  "EdTech": ["Education", "Software & Internet"],
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
  "EV": "Manufacturing",
  "Electric Vehicles": "Manufacturing",
  "Véhicules électriques": "Manufacturing",
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
  "Defense & Space": ["Manufacturing", "Government"],
  "Defense": ["Manufacturing", "Government"],
  "Defence": ["Manufacturing", "Government"],
  "Défense": ["Manufacturing", "Government"],
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
  "Associatif": "Non-Profit",
  "Non-profit": "Non-Profit",

  // ── Energy & Utilities (additional) ──
  "Waste Management": "Energy & Utilities",
  "Gestion des déchets": "Energy & Utilities",
  "Water Treatment": "Energy & Utilities",
  "Traitement des eaux": "Energy & Utilities",

  // ── Wholesale & Distribution ──
  "Wholesale": "Wholesale & Distribution",
  "Distribution": "Wholesale & Distribution",
  "Grossiste": "Wholesale & Distribution",
  "Négoce": "Wholesale & Distribution",
  "Import and Export": "Wholesale & Distribution",
  "Import/Export": "Wholesale & Distribution",
  "Import-Export": "Wholesale & Distribution",
};

// ── Pre-built lowercase lookup for description scanning ──
// Flattens string | string[] values → always string[] for uniform handling.
const INDUSTRY_FIXES_LOWER = new Map<string, string[]>(
  Object.entries(INDUSTRY_FIXES).map(([k, v]) => [
    k.toLowerCase(),
    Array.isArray(v) ? v : [v],
  ]),
);

// ── Niche sub-industry mapping ──
// Maps niche terms → exact Instantly sub_industries values.
// Replaces keyword_filter workaround with the proper API filter.
const NICHE_SUBINDUSTRY_MAP: Record<string, string[]> = {
  // ── Retail ──
  "mode": ["Apparel & Fashion"],
  "fashion": ["Apparel & Fashion"],
  "prêt-à-porter": ["Apparel & Fashion"],
  "apparel": ["Apparel & Fashion"],
  "luxe": ["Luxury Goods & Jewelry"],
  "luxury": ["Luxury Goods & Jewelry"],
  "cosmétique": ["Cosmetics"],
  "cosmetics": ["Cosmetics"],
  "beauty": ["Cosmetics"],
  "food": ["Food Production", "Food & Beverages"],
  "alimentation": ["Food Production", "Food & Beverages"],
  "foodtech": ["Food Production"],
  "agroalimentaire": ["Food Production", "Food & Beverages"],
  "vin": ["Wine and Spirits"],
  "wine": ["Wine and Spirits"],

  // ── Manufacturing ──
  "automobile": ["Automotive"],
  "automotive": ["Automotive"],
  "ev": ["Automotive"],
  "electric vehicles": ["Automotive"],
  "véhicules électriques": ["Automotive"],
  "aéronautique": ["Aviation & Aerospace"],
  "aerospace": ["Aviation & Aerospace"],
  "semi-conducteur": ["Semiconductors"],
  "semiconductor": ["Semiconductors"],
  "chimie": ["Chemicals"],
  "chemicals": ["Chemicals"],
  "textiles": ["Textiles"],
  "textile": ["Textiles"],
  "plastics": ["Plastics"],
  "plastique": ["Plastics"],
  "construction navale": ["Shipbuilding"],
  "shipbuilding": ["Shipbuilding"],
  "automatisation industrielle": ["Industrial Automation"],
  "industrial automation": ["Industrial Automation"],

  // ── Transportation & Storage ──
  "logistique": ["Logistics and Supply Chain"],
  "logistics": ["Logistics and Supply Chain"],
  "supply chain": ["Logistics and Supply Chain"],
  "chaîne logistique": ["Logistics and Supply Chain"],
  "transport routier": ["Transportation/Trucking/Railroad"],
  "road transport": ["Transportation/Trucking/Railroad"],
  "trucking": ["Transportation/Trucking/Railroad"],
  "camionnage": ["Transportation/Trucking/Railroad"],
  "routier": ["Transportation/Trucking/Railroad"],
  "fret": ["Package/Freight Delivery"],
  "freight": ["Package/Freight Delivery"],
  "colis": ["Package/Freight Delivery"],
  "parcel": ["Package/Freight Delivery"],
  "livraison": ["Package/Freight Delivery"],
  "delivery": ["Package/Freight Delivery"],
  "courier": ["Package/Freight Delivery"],
  "coursier": ["Package/Freight Delivery"],
  "last mile": ["Package/Freight Delivery"],
  "maritime": ["Maritime"],
  "shipping": ["Maritime"],
  "naval": ["Maritime"],
  "aviation": ["Airlines/Aviation"],
  "airlines": ["Airlines/Aviation"],
  "aérien": ["Airlines/Aviation"],
  "compagnies aériennes": ["Airlines/Aviation"],
  "warehousing": ["Warehousing"],
  "entreposage": ["Warehousing"],
  "entrepôt": ["Warehousing"],
  "packaging": ["Packaging and Containers"],
  "emballage": ["Packaging and Containers"],

  // ── Business Services ──
  "consulting": ["Management Consulting"],
  "conseil": ["Management Consulting"],
  "management consulting": ["Management Consulting"],
  "recrutement": ["Staffing and Recruiting"],
  "staffing": ["Staffing and Recruiting"],
  "recruiting": ["Staffing and Recruiting"],
  "juridique": ["Legal Services"],
  "legal": ["Legal Services"],
  "formation": ["Professional Training & Coaching"],
  "training": ["Professional Training & Coaching"],
  "design": ["Design"],
  "événementiel": ["Events Services"],
  "events": ["Events Services"],
  "outsourcing": ["Outsourcing/Offshoring"],
  "import export": ["Import and Export"],

  // ── Software & Internet ──
  "gaming": ["Computer Games"],
  "jeux vidéo": ["Computer Games"],
  "cybersecurity": ["Computer & Network Security"],
  "cybersécurité": ["Computer & Network Security"],
  "saas": ["Internet"],
  "e-commerce": ["Internet"],
  "cloud": ["Internet"],

  // ── Healthcare ──
  "pharma": ["Pharmaceuticals"],
  "pharmaceutique": ["Pharmaceuticals"],
  "biotech": ["Biotechnology"],
  "medical devices": ["Medical Devices"],
  "dispositifs médicaux": ["Medical Devices"],
  "hôpital": ["Hospital & Health Care"],
  "hospital": ["Hospital & Health Care"],
  "santé mentale": ["Mental Health Care"],
  "mental health": ["Mental Health Care"],
  "vétérinaire": ["Veterinary"],
  "veterinary": ["Veterinary"],
  "wellness": ["Health, Wellness and Fitness"],
  "bien-être": ["Health, Wellness and Fitness"],

  // ── Financial Services ──
  "fintech": ["Financial Services"],
  "assurance": ["Insurance"],
  "insurance": ["Insurance"],
  "banque": ["Banking"],
  "banking": ["Banking"],
  "comptabilité": ["Accounting"],
  "accounting": ["Accounting"],

  // ── Energy & Utilities ──
  "oil": ["Oil & Energy"],
  "pétrole": ["Oil & Energy"],
  "gas": ["Oil & Energy"],
  "gaz": ["Oil & Energy"],
  "renewables": ["Renewables & Environment"],
  "renouvelable": ["Renewables & Environment"],
  "solaire": ["Renewables & Environment"],
  "solar": ["Renewables & Environment"],
  "éolien": ["Renewables & Environment"],
  "wind energy": ["Renewables & Environment"],

  // ── Education ──
  "edtech": ["E-Learning"],

  // ── Real Estate & Construction ──
  "immobilier": ["Real Estate", "Commercial Real Estate"],
  "real estate": ["Real Estate", "Commercial Real Estate"],

  // ── Media & Entertainment ──
  "publishing": ["Publishing"],
  "édition": ["Publishing"],
  "music": ["Music"],
  "musique": ["Music"],
  "film": ["Motion Pictures and Film"],
  "cinéma": ["Motion Pictures and Film"],
  "presse": ["Newspapers"],

  // ── Energy & Utilities ──
  "waste management": ["Environmental Services"],
  "gestion des déchets": ["Environmental Services"],
  "water treatment": ["Water Treatment"],
  "traitement des eaux": ["Water Treatment"],

  // ── Cross-industry tech niches (sub_industries for Software & Internet) ──
  "healthtech": ["Health, Wellness and Fitness"],
  "medtech": ["Medical Devices"],
  "proptech": ["Real Estate"],
  "regtech": ["Financial Services"],
  "insurtech": ["Insurance"],
  "martech": ["Marketing and Advertising"],
  "adtech": ["Marketing and Advertising"],
  "hrtech": ["Human Resources"],
  "hr tech": ["Human Resources"],
  "legaltech": ["Legal Services"],
  "agritech": ["Farming"],
  "cleantech": ["Renewables & Environment"],
  "deeptech": ["Nanotechnology"],

  // ── Pet care ──
  "pet care": ["Veterinary"],
  "animalerie": ["Veterinary"],
  "pet": ["Veterinary"],
};

// Pre-built lowercase lookup for niche sub-industries
const NICHE_SUBINDUSTRY_LOWER = new Map<string, string[]>(
  Object.entries(NICHE_SUBINDUSTRY_MAP).map(([k, v]) => [k.toLowerCase(), v]),
);

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
  "Executive", "Manager", "Senior",
  "Chief X Officer (CxO)", "Internship",
  "Vice President (VP)", "Unpaid / Internship", "Partner",
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
  // ── New API values ──
  "executive": "Executive",
  "partner": "Partner",
  "internship": "Internship",
  "intern": "Internship",
  "stagiaire": "Internship",
  "stage": "Internship",
  "unpaid": "Unpaid / Internship",
  "cxo": "Chief X Officer (CxO)",
  // ── French ──
  "dirigeant": "C-Level",
  "vice-président": "VP-Level",
  "directeur": "Director-Level",
  "responsable": "Manager-Level",
  "confirmé": "Mid-Senior level",
  "junior": "Entry level",
  "débutant": "Entry level",
  "fondateur": "Owner",
  "associé": "Partner",
  "partenaire": "Partner",
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
  "series_e", "series_f", "series_g", "series_h", "series_i", "series_j",
  "pre_series_a", "pre_series_b", "pre_series_c", "pre_series_d",
  "pre_series_e", "pre_series_f", "pre_series_g", "pre_series_h", "pre_series_i", "pre_series_j",
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
  "Series H": "series_h",
  "Series I": "series_i",
  "Series J": "series_j",
  "Pre-Series A": "pre_series_a",
  "Pre-Series B": "pre_series_b",
  "Pre-Series C": "pre_series_c",
  "Pre-Series D": "pre_series_d",
  "Pre-Series E": "pre_series_e",
  "Pre-Series F": "pre_series_f",
  "Pre-Series G": "pre_series_g",
  "Pre-Series H": "pre_series_h",
  "Pre-Series I": "pre_series_i",
  "Pre-Series J": "pre_series_j",
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



// ── News filter validation ──
// API expects exact snake_case enum values. LLMs often produce short keywords instead.
const VALID_NEWS = new Set([
  "has_had_recent_funding", "has_had_recent_acquisition_or_merger",
  "has_had_recent_job_change", "has_had_recent_technology_change",
  "has_had_recent_leadership_change", "has_had_recent_layoffs",
  "has_upcoming_contract_renewal", "has_had_recent_new_partnerships",
  "has_had_recent_award", "has_had_product_launch",
  "has_had_recent_expansion", "has_had_recent_earnings_report",
  "has_had_recent_data_breach_security_event", "has_had_recent_regulatory_change",
  "has_had_recent_customer_win_or_significant_deal",
  "has_filed_recent_patent", "has_had_recent_cost_cutting",
  "has_had_recent_rebranding", "has_had_ipo",
  "has_entered_new_market_or_geography", "has_had_recent_restructuring",
  "has_had_recent_sustainability_csr_initiative",
  "has_had_recent_legal_issue_or_controversy",
  "has_had_recent_management_change",
  "has_active_job_listings", "has_had_ieo",
  "has_had_recent_investment", "has_had_recent_dividend_announcement",
]);

const NEWS_FIXES: Record<string, string> = {
  // ── Common LLM short keywords → exact API values ──
  "funding": "has_had_recent_funding",
  "financing": "has_had_recent_funding",
  "levée de fonds": "has_had_recent_funding",
  "receives_financing": "has_had_recent_funding",
  "acquisition": "has_had_recent_acquisition_or_merger",
  "merger": "has_had_recent_acquisition_or_merger",
  "m&a": "has_had_recent_acquisition_or_merger",
  "fusion": "has_had_recent_acquisition_or_merger",
  "rachat": "has_had_recent_acquisition_or_merger",
  "hiring": "has_had_recent_job_change",
  "hires": "has_had_recent_job_change",
  "recrutement": "has_had_recent_job_change",
  "job_change": "has_had_recent_job_change",
  "technology_change": "has_had_recent_technology_change",
  "leadership_change": "has_had_recent_leadership_change",
  "layoffs": "has_had_recent_layoffs",
  "licenciements": "has_had_recent_layoffs",
  "partnership": "has_had_recent_new_partnerships",
  "partnerships": "has_had_recent_new_partnerships",
  "partenariat": "has_had_recent_new_partnerships",
  "partners_with": "has_had_recent_new_partnerships",
  "award": "has_had_recent_award",
  "product_launch": "has_had_product_launch",
  "launches": "has_had_product_launch",
  "lancement": "has_had_product_launch",
  "expansion": "has_had_recent_expansion",
  "croissance": "has_had_recent_expansion",
  "ipo": "has_had_ipo",
  "introduction en bourse": "has_had_ipo",
  "patent": "has_filed_recent_patent",
  "brevet": "has_filed_recent_patent",
  "rebranding": "has_had_recent_rebranding",
  "restructuring": "has_had_recent_restructuring",
  "restructuration": "has_had_recent_restructuring",
  "job_listings": "has_active_job_listings",
  "job listings": "has_active_job_listings",
  "offres d'emploi": "has_active_job_listings",
  "investment": "has_had_recent_investment",
  "investissement": "has_had_recent_investment",
};

function fixNews(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  const fixed = new Set<string>();
  for (const v of values) {
    if (VALID_NEWS.has(v)) {
      fixed.add(v);
    } else {
      const mapped = NEWS_FIXES[v]
        ?? NEWS_FIXES[v.toLowerCase().trim()]
        ?? Object.entries(NEWS_FIXES).find(
          ([k]) => k.toLowerCase() === v.toLowerCase().trim(),
        )?.[1];
      if (mapped) {
        fixed.add(mapped);
      } else {
        // Try snake_case conversion as last resort
        const snaked = v.toLowerCase().trim().replace(/[\s-]+/g, "_");
        if (VALID_NEWS.has(snaked)) {
          fixed.add(snaked);
        } else {
          console.warn(`[fixNews] Dropped unknown value: "${v}"`);
        }
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}

// ── Fuzzy matching fallback ──
// If a value doesn't match any fix map entry, find the closest valid value
// using substring containment. This catches edge cases the LLM invents.
function fuzzyMatchIndustry(value: string): string[] | undefined {
  const lower = value.toLowerCase().trim();
  // Try substring match: if the LLM value contains a valid category name (or vice versa)
  for (const valid of VALID_INDUSTRIES) {
    if (lower.includes(valid.toLowerCase()) || valid.toLowerCase().includes(lower)) {
      return [valid];
    }
  }
  // Try substring match against fix map keys
  for (const [key, mapped] of Object.entries(INDUSTRY_FIXES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return Array.isArray(mapped) ? mapped : [mapped];
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
      // Try exact match first, then without spaces, then case-insensitive
      const stripped = v.replace(/\s/g, "");
      const mapped = EMPLOYEE_COUNT_FIXES[v]
        ?? EMPLOYEE_COUNT_FIXES[stripped]
        ?? EMPLOYEE_COUNT_FIXES[v.toLowerCase().trim()]
        ?? EMPLOYEE_COUNT_FIXES[v.toUpperCase().trim()];
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

/** Helper: add one or many industry values to the fixed set */
function addIndustry(fixed: Set<string>, mapped: string | string[]): void {
  if (Array.isArray(mapped)) {
    mapped.forEach((m) => fixed.add(m));
  } else {
    fixed.add(mapped);
  }
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
        addIndustry(fixed, mapped);
      } else {
        // Fuzzy fallback: substring matching
        const fuzzy = fuzzyMatchIndustry(v);
        if (fuzzy) fuzzy.forEach((f) => fixed.add(f));
        else console.warn(`[fixIndustries] Dropped unknown value: "${v}"`);
      }
    }
  }
  return fixed.size > 0 ? [...fixed] : undefined;
}


/**
 * Safety net: scans the original user description for known industry terms.
 * Handles two cases:
 * 1. keyword_filter contains a known industry term → convert to industries
 * 2. industries is empty but description contains recognizable terms → inject
 *
 * Only modifies filters when the LLM missed or misplaced the industry.
 * Returns the list of industries inferred from the description (step 2 only)
 * so the caller can ask the user for confirmation.
 */
function inferIndustriesFromDescription(
  description: string,
  filters: Record<string, unknown>,
): string[] | undefined {
  // NOTE: Stock index industry-drop logic is now handled in parseICP() with description context.
  // inferIndustries still skips when company_names is huge (no point adding industries on top of 40 company names).
  const cn = filters.company_names as { include?: string[] } | undefined;
  if (cn?.include && cn.include.length >= 10) {
    console.log(`[inferIndustries] Skipping — company_names has ${cn.include.length} entries (stock index)`);
    return undefined;
  }

  const inferred = new Set<string>();

  // ── Step 1: Convert keyword_filter → industries if it's a known industry term ──
  // The LLM put an industry term in keyword_filter instead of industries.
  // Flag for confirmation since this changes filter semantics.
  if (filters.keyword_filter && typeof filters.keyword_filter === "string") {
    const kf = (filters.keyword_filter as string).trim();
    const kfMatch = INDUSTRY_FIXES_LOWER.get(kf.toLowerCase()); // string[]
    if (kfMatch) {
      const existing = (filters.industries as string[] | undefined) ?? [];
      const merged = new Set([...existing, ...kfMatch]);
      filters.industries = [...merged];
      kfMatch.forEach((m) => inferred.add(m));
      delete filters.keyword_filter;
      console.log(`[inferIndustries] keyword_filter "${kf}" → industry ${JSON.stringify(kfMatch)}`);
    }
  }

  // ── Step 2: If industries still empty, infer from description ──
  if ((filters.industries as string[] | undefined)?.length && inferred.size === 0) {
    // Industries were set by the LLM (not by step 1) — no inference needed.
    return undefined;
  }

  const lower = description.toLowerCase();
  const words = lower.split(/[\s,;:!?.()/'«»"]+/).filter(w => w.length >= 2);

  // Build candidate terms: single words (3+ chars), bigrams, trigrams
  const candidates = new Set<string>();
  for (const w of words) {
    if (w.length >= 3) {
      candidates.add(w);
    }
  }
  for (let i = 0; i < words.length - 1; i++) {
    candidates.add(`${words[i]} ${words[i + 1]}`);
  }
  for (let i = 0; i < words.length - 2; i++) {
    candidates.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  // Special: uppercase short codes (too short for the >= 3 word filter, but unambiguous in uppercase)
  if (/\bAI\b/.test(description) || /\bIA\b/.test(description) || /\bIT\b/.test(description)) {
    inferred.add("Software & Internet");
  }
  if (/\bEV\b/.test(description)) {
    inferred.add("Manufacturing");
  }

  for (const term of candidates) {
    const match = INDUSTRY_FIXES_LOWER.get(term); // string[]
    if (match) match.forEach((m) => inferred.add(m));
  }

  if (inferred.size > 0) {
    // Merge with any industries from step 1
    const existing = (filters.industries as string[] | undefined) ?? [];
    const merged = new Set([...existing, ...inferred]);
    filters.industries = [...merged];
    console.log(`[inferIndustries] Inferred from description: ${[...inferred].join(", ")}`);
  }

  return inferred.size > 0 ? [...inferred] : undefined;
}

/**
 * Infers sub_industries from the user's natural language description.
 * Runs INDEPENDENTLY of inferIndustriesFromDescription() — no early return can bypass it.
 * Tokenizes the description into single words, bigrams, and trigrams,
 * then scans against NICHE_SUBINDUSTRY_LOWER for matches.
 *
 * Skips if:
 * - sub_industries is already set (LLM or previous step handled it)
 * - industries is empty (no parent industry context)
 */
function inferSubIndustriesFromDescription(
  description: string,
  filters: Record<string, unknown>,
): void {
  // Already set — don't override
  if ((filters.sub_industries as string[] | undefined)?.length) return;

  // No parent industry — sub_industries without industry makes no sense
  if (!(filters.industries as string[] | undefined)?.length) return;

  const lower = description.toLowerCase();
  const words = lower.split(/[\s,;:!?.()/'«»"]+/).filter(w => w.length >= 2);

  // Build candidate terms: single words (3+ chars), bigrams, trigrams
  const candidates = new Set<string>();
  for (const w of words) {
    if (w.length >= 3) candidates.add(w);
  }
  for (let i = 0; i < words.length - 1; i++) {
    candidates.add(`${words[i]} ${words[i + 1]}`);
  }
  for (let i = 0; i < words.length - 2; i++) {
    candidates.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  const subIndustries = new Set<string>();
  for (const term of candidates) {
    const subs = NICHE_SUBINDUSTRY_LOWER.get(term);
    if (subs) {
      subs.forEach((s) => subIndustries.add(s));
      console.log(`[inferSubIndustries] Added sub_industries: ${JSON.stringify(subs)} from term "${term}"`);
    }
  }

  if (subIndustries.size > 0) {
    filters.sub_industries = [...subIndustries];
    console.log(`[inferSubIndustries] Final sub_industries: ${JSON.stringify(filters.sub_industries)}`);
  }
}

/**
 * Detect negation patterns in the description and strip matching values
 * from industries and sub_industries. Handles "not X", "excluding X",
 * "sauf X", "hors X", "pas de X", "except X", etc.
 */
function stripNegatedFilters(description: string, filters: Record<string, unknown>): void {
  const lower = description.toLowerCase();

  // Match negation patterns followed by a term
  const negationPatterns = [
    /\bnot\s+([\w\s/&-]+?)(?:\s*,|\s*$|\s+and\b|\s+or\b|\s+with\b|\s+in\b|\s+at\b)/gi,
    /\bexclud(?:e|ing)\s+([\w\s/&-]+?)(?:\s*,|\s*$|\s+and\b|\s+or\b|\s+with\b|\s+in\b)/gi,
    /\bsauf\s+([\w\s/&'-]+?)(?:\s*,|\s*$|\s+et\b|\s+ou\b|\s+avec\b|\s+en\b)/gi,
    /\bhors\s+([\w\s/&'-]+?)(?:\s*,|\s*$|\s+et\b|\s+ou\b|\s+avec\b|\s+en\b)/gi,
    /\bpas\s+(?:de|d')\s*([\w\s/&'-]+?)(?:\s*,|\s*$|\s+et\b|\s+ou\b|\s+avec\b)/gi,
    /\bexcept\s+([\w\s/&-]+?)(?:\s*,|\s*$|\s+and\b|\s+or\b|\s+with\b)/gi,
  ];

  const negatedTerms: string[] = [];
  for (const pattern of negationPatterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      negatedTerms.push(match[1].trim());
    }
  }

  if (negatedTerms.length === 0) return;

  console.log(`[stripNegatedFilters] Detected negated terms: ${JSON.stringify(negatedTerms)}`);

  // Strip matching sub_industries
  if (Array.isArray(filters.sub_industries)) {
    const before = filters.sub_industries as string[];
    filters.sub_industries = before.filter((si) => {
      const siLower = si.toLowerCase();
      return !negatedTerms.some((term) => siLower.includes(term) || term.includes(siLower));
    });
    if ((filters.sub_industries as string[]).length === 0) delete filters.sub_industries;
    if ((filters.sub_industries as string[] | undefined)?.length !== before.length) {
      console.log(`[stripNegatedFilters] Stripped sub_industries: ${JSON.stringify(before)} → ${JSON.stringify(filters.sub_industries)}`);
    }
  }

  // Strip matching industries
  if (Array.isArray(filters.industries)) {
    const before = filters.industries as string[];
    filters.industries = before.filter((ind) => {
      const indLower = ind.toLowerCase();
      return !negatedTerms.some((term) => indLower.includes(term) || term.includes(indLower));
    });
    if ((filters.industries as string[]).length === 0) delete filters.industries;
    if ((filters.industries as string[] | undefined)?.length !== before.length) {
      console.log(`[stripNegatedFilters] Stripped industries: ${JSON.stringify(before)} → ${JSON.stringify(filters.industries)}`);
    }
  }
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

  // news string → array (schema expects string[])
  if (filters.news && typeof filters.news === "string") {
    filters.news = [filters.news];
  }

  // subIndustry → sub_industries (field name migration)
  if (filters.subIndustry && !filters.sub_industries) {
    const si = filters.subIndustry;
    filters.sub_industries = Array.isArray(si) ? si : [si];
    delete filters.subIndustry;
  } else {
    delete filters.subIndustry;
  }

  // sub_industries: flatten include/exclude wrapper if present
  if (filters.sub_industries && typeof filters.sub_industries === "object" && !Array.isArray(filters.sub_industries)) {
    const obj = filters.sub_industries as { include?: string[] };
    filters.sub_industries = obj.include ?? undefined;
  }

  // ── Flatten include/exclude wrappers on array fields ──
  // LLM sometimes generates {include: [...]} instead of plain arrays
  // even when the field name is already correct.
  for (const field of ["job_titles", "industries", "sub_industries", "technologies", "domains", "funding_type", "news"]) {
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

  if (filters.news) {
    filters.news = fixNews(filters.news as string[]);
  }

  // Remove undefined/null fields to avoid Zod issues
  for (const key of Object.keys(filters)) {
    if (filters[key] === undefined || filters[key] === null) {
      delete filters[key];
    }
  }

  // NOTE: Stock index + industry logic moved to parseICP() where we have access to the description.
  // This allows us to only drop industries when the user did NOT explicitly mention one.

  // ── Strip "global"/"worldwide" locations ──
  // When user says "global", "worldwide", "mondial", "partout", they mean NO geo filter.
  // LLM sometimes outputs locations: ["Worldwide"] or ["Global"] which are not valid Instantly values.
  if (Array.isArray(filters.locations)) {
    const locs = filters.locations as string[];
    const globalTerms = new Set(["worldwide", "global", "mondial", "partout", "international", "globally", "all countries", "any country", "no geo"]);
    const filtered = locs.filter(l => !globalTerms.has(l.toLowerCase().trim()));
    if (filtered.length === 0) {
      delete filters.locations;
    } else {
      filters.locations = filtered;
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


// ─── Location guard ─────────────────────────────────────
// Hard safeguard: strip locations if the user never mentioned any geography.
// Prompt rules can be ignored by the LLM — this guarantees no hallucinated geo.

const GEO_PATTERNS = [
  // Countries (worldwide)
  /\b(france|états[- ]unis|us|usa|united states|uk|united kingdom|grande[- ]bretagne|royaume[- ]uni|allemagne|germany|deutschland|espagne|spain|italie|italy|canada|australie|australia|brésil|brazil|inde|india|japon|japan|chine|china|suisse|switzerland|belgique|belgium|pays[- ]bas|netherlands|portugal|mexique|mexico|suède|sweden|norvège|norway|danemark|denmark|finlande|finland|pologne|poland|autriche|austria|irlande|ireland|israël|israel|singapour|singapore|corée|korea|south africa|afrique du sud|uae|emirates|émirats|saudi|arabie|nigeria|nigéria|kenya|ghana|egypt|égypte|morocco|maroc|tunisia|tunisie|senegal|sénégal|côte d'ivoire|ivory coast|ethiopia|éthiopie|tanzania|tanzanie|congo|rdc|zambia|zambie|colombia|colombie|chile|chili|peru|pérou|argentina|argentine|costa rica|panama|uruguay|qatar|bahrain|oman|kuwait|koweït|thailand|thaïlande|vietnam|indonesia|indonésie|malaysia|malaisie|philippines|taiwan|taïwan|pakistan|bangladesh|sri lanka|new zealand|nouvelle[- ]zélande|luxembourg|croatia|croatie|maldives|seychelles|algeria|algérie|hungary|hongrie|greece|grèce|romania|roumanie|czech republic|république tchèque|tchéquie|angleterre)\b/i,
  // French adjective forms of countries
  /\b(français|française|françaises|européen|européenne|européennes|européens|anglais|anglaise|britannique|allemand|allemande|américain|américaine|canadien|canadienne|indien|indienne|japonais|japonaise|chinois|chinoise|suédois|suédoise|espagnol|espagnole|italien|italienne|belge|néerlandais|néerlandaise|portugais|portugaise|marocain|tunisien|nigérian|mexicain|brésilien|colombien|coréen|ivoirien|sénégalais|ghanéen)\b/i,
  // Regions / continents
  /\b(europe|amérique|america|asie|asia|afrique|africa|moyen[- ]orient|middle east|océanie|oceania|latam|apac|emea|dach|nordics|benelux|scandinav|southeast asia|south east asia|asie du sud|east asia|sub[- ]saharan|subsaharien|asia[- ]pacific|central america|caribbean|caraïbes|gcc|gulf|mena|anz|maghreb|west africa|afrique de l'ouest|east africa|afrique de l'est|north america|amérique du nord|south america|amérique du sud)\b|(?<=\s|,|^)NA(?=\s|,|$)/i,
  // French regions
  /\b(île[- ]de[- ]france|ile[- ]de[- ]france|idf|rhône[- ]alpes|auvergne|bretagne|normandie|occitanie|nouvelle[- ]aquitaine|hauts[- ]de[- ]france|grand est|paca|bassin parisien|sud de la france|nord de la france)\b/i,
  // Cities (worldwide)
  /\b(paris|london|londres|new york|nyc|berlin|madrid|barcelone|barcelona|amsterdam|rotterdam|bruxelles|brussels|zurich|zürich|genève|geneva|milan|rome|lisbonne|lisbon|dublin|stockholm|oslo|copenhague|copenhagen|helsinki|varsovie|warsaw|prague|vienne|vienna|budapest|bucarest|bucharest|mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|pune|tokyo|osaka|shanghai|beijing|shenzhen|guangzhou|hangzhou|sydney|melbourne|brisbane|perth|auckland|toronto|montréal|vancouver|calgary|são paulo|sao paulo|rio de janeiro|mexico city|ciudad de méxico|buenos aires|santiago|lima|bogota|bogotá|tel aviv|dubai|dubaï|abu dhabi|doha|riyadh|riyad|jeddah|singapour|singapore|hong kong|séoul|seoul|busan|taipei|jakarta|bangkok|kuala lumpur|manila|ho chi minh|lagos|nairobi|johannesburg|cape town|le cap|cairo|le caire|casablanca|tunis|accra|dakar|san francisco|los angeles|chicago|boston|austin|miami|seattle|denver|nashville|portland|atlanta|houston|dallas|phoenix|washington dc|marseille|lyon|toulouse|bordeaux|lille|nantes|strasbourg|le havre|munich|münchen|hamburg|frankfurt|wichita)\b/i,
  // Explicit geo markers
  /\b(worldwide|mondial|partout|global|no preference|pas de préférence|emerging markets|marchés émergents|anywhere|any geo)\b/i,
  // Language-as-location markers
  /\b(francophone|anglophone|hispanophone|lusophone)\b/i,
  // Specific area names
  /\b(bay area|silicon valley|wall street|la défense|midwest|east coast|west coast)\b/i,
  // Common abbreviations (checked with word boundary to avoid false positives)
  /(?<=\s|,|^)(SF|NYC)(?=\s|,|$)/,
  // ISO 2-letter country codes (uppercase, word-boundary)
  // NOTE: CA omitted — conflicts with French "CA" (Chiffre d'Affaires)
  // NOTE: IT omitted — conflicts with "IT" (Information Technology)
  // NOTE: QA omitted — conflicts with "QA" (Quality Assurance)
  // NOTE: ID omitted — conflicts with "ID" (identifier/identity)
  /(?<=\s|,|^)(DE|FR|ES|NL|BE|CH|AT|SE|DK|FI|PL|IE|PT|CZ|HU|GR|RO|LU|BR|MX|AR|CO|CL|PE|CN|JP|KR|SG|TH|MY|PH|TW|VN|AU|NZ|ZA|NG|KE|EG|MA|TN|GH|SA|AE|BH|KW|IL|TR)(?=\s|,|$)/,
];

function descriptionMentionsLocation(description: string): boolean {
  // First try compiled regex patterns (fast, handles ASCII terms well)
  if (GEO_PATTERNS.some((pattern) => pattern.test(description))) return true;

  // Fallback: check against all keys in LOCATION_NAME_MAP and REGION_EXPANSION_MAP
  // using unicode-aware word boundary (handles accented characters like États-Unis, Scandinavie)
  const lower = description.toLowerCase();
  for (const key of Object.keys(REGION_EXPANSION_MAP)) {
    // Skip very short keys (2 chars) — already handled by GEO_PATTERNS with proper boundaries
    if (key.length <= 2) continue;
    if (unicodeWordBoundaryRegex(key).test(lower)) return true;
  }
  for (const key of Object.keys(LOCATION_NAME_MAP)) {
    // Skip very short keys (2 chars) — too ambiguous for unicode fallback
    if (key.length <= 2) continue;
    if (unicodeWordBoundaryRegex(key).test(lower)) return true;
  }
  return false;
}

/** Map of FR/EN location names → standard English name for Instantly.
 *  Keys must be lowercase. Only includes locations that exist in LOCATION_PLACE_IDS. */
const LOCATION_NAME_MAP: Record<string, string> = {
  // Countries FR → EN
  "france": "France", "états-unis": "United States", "états unis": "United States",
  "us": "United States", "usa": "United States", "united states": "United States",
  "uk": "United Kingdom", "united kingdom": "United Kingdom",
  "grande-bretagne": "United Kingdom", "grande bretagne": "United Kingdom",
  "allemagne": "Germany", "germany": "Germany", "deutschland": "Germany",
  "espagne": "Spain", "spain": "Spain",
  "italie": "Italy", "italy": "Italy",
  "canada": "Canada",
  "australie": "Australia", "australia": "Australia",
  "brésil": "Brazil", "brazil": "Brazil",
  "inde": "India", "india": "India",
  "japon": "Japan", "japan": "Japan",
  "chine": "China", "china": "China",
  "suisse": "Switzerland", "switzerland": "Switzerland",
  "belgique": "Belgium", "belgium": "Belgium",
  "pays-bas": "Netherlands", "pays bas": "Netherlands", "netherlands": "Netherlands",
  "portugal": "Portugal", "mexique": "Mexico", "mexico": "Mexico",
  "suède": "Sweden", "sweden": "Sweden",
  "norvège": "Norway", "norway": "Norway",
  "danemark": "Denmark", "denmark": "Denmark",
  "finlande": "Finland", "finland": "Finland",
  "pologne": "Poland", "poland": "Poland",
  "autriche": "Austria", "austria": "Austria",
  "irlande": "Ireland", "ireland": "Ireland",
  "israël": "Israel", "israel": "Israel",
  "singapour": "Singapore", "singapore": "Singapore",
  "corée": "South Korea", "korea": "South Korea",
  "south africa": "South Africa", "uae": "UAE",
  // Major cities
  "paris": "Paris", "london": "London", "londres": "London",
  "new york": "New York", "berlin": "Berlin", "madrid": "Madrid",
  "barcelone": "Barcelona", "barcelona": "Barcelona",
  "amsterdam": "Amsterdam", "bruxelles": "Brussels", "brussels": "Brussels",
  "zurich": "Zurich", "zürich": "Zurich", "genève": "Geneva", "geneva": "Geneva",
  "milan": "Milan", "rome": "Rome", "lisbonne": "Lisbon", "lisbon": "Lisbon",
  "dublin": "Dublin", "stockholm": "Stockholm", "oslo": "Oslo",
  "copenhague": "Copenhagen", "copenhagen": "Copenhagen",
  "helsinki": "Helsinki", "varsovie": "Warsaw", "warsaw": "Warsaw",
  "prague": "Prague", "vienne": "Vienna", "vienna": "Vienna",
  "budapest": "Budapest", "mumbai": "Mumbai", "delhi": "Delhi",
  "tokyo": "Tokyo", "shanghai": "Shanghai", "sydney": "Sydney",
  "toronto": "Toronto", "montréal": "Montreal", "montreal": "Montreal",
  "vancouver": "Vancouver", "tel aviv": "Tel Aviv", "dubai": "Dubai",
  "san francisco": "San Francisco", "bay area": "San Francisco",
  "los angeles": "Los Angeles",
  "chicago": "Chicago", "sao paulo": "Sao Paulo", "são paulo": "Sao Paulo",
  // French cities
  "marseille": "Marseille", "lyon": "Lyon", "toulouse": "Toulouse",
  "bordeaux": "Bordeaux", "lille": "Lille", "nantes": "Nantes",
  "strasbourg": "Strasbourg", "le havre": "Le Havre",
  // German cities
  "munich": "Munich", "münchen": "Munich",
  // Asia cities
  "bangalore": "Bangalore", "bengaluru": "Bangalore", "hyderabad": "Hyderabad",
  "chennai": "Chennai", "pune": "Pune", "osaka": "Osaka",
  "shenzhen": "Shenzhen", "hangzhou": "Hangzhou", "guangzhou": "Guangzhou",
  "seoul": "Seoul", "séoul": "Seoul", "busan": "Busan", "taipei": "Taipei",
  "jakarta": "Jakarta", "bangkok": "Bangkok", "kuala lumpur": "Kuala Lumpur",
  "manila": "Manila", "ho chi minh": "Ho Chi Minh City",
  // Middle East cities
  "abu dhabi": "Abu Dhabi", "doha": "Doha", "riyadh": "Riyadh", "riyad": "Riyadh",
  "jeddah": "Jeddah",
  // Africa cities
  "lagos": "Lagos", "nairobi": "Nairobi", "johannesburg": "Johannesburg",
  "cape town": "Cape Town", "le cap": "Cape Town",
  "cairo": "Cairo", "le caire": "Cairo", "casablanca": "Casablanca",
  "accra": "Accra", "dakar": "Dakar", "tunis": "Tunis",
  // LATAM cities
  "buenos aires": "Buenos Aires", "bogota": "Bogota", "bogotá": "Bogota",
  "santiago": "Santiago", "lima": "Lima", "rio de janeiro": "Rio de Janeiro",
  "mexico city": "Mexico City",
  // US cities
  "austin": "Austin", "denver": "Denver", "nashville": "Nashville",
  "miami": "Miami", "seattle": "Seattle", "boston": "Boston",
  "portland": "Portland", "atlanta": "Atlanta",
  // Oceania
  "auckland": "Auckland", "brisbane": "Brisbane", "perth": "Perth",
  // Countries (more)
  "colombia": "Colombia", "colombie": "Colombia",
  "chile": "Chile", "chili": "Chile",
  "peru": "Peru", "pérou": "Peru",
  "qatar": "Qatar", "bahrain": "Bahrain",
  "thailand": "Thailand", "thaïlande": "Thailand",
  "vietnam": "Vietnam",
  "indonesia": "Indonesia", "indonésie": "Indonesia",
  "malaysia": "Malaysia", "malaisie": "Malaysia",
  "philippines": "Philippines",
  "taiwan": "Taiwan", "taïwan": "Taiwan",
  "new zealand": "New Zealand", "nouvelle-zélande": "New Zealand",
  "egypt": "Egypt", "égypte": "Egypt",
  "morocco": "Morocco", "maroc": "Morocco",
  "tunisia": "Tunisia", "tunisie": "Tunisia",
  "ghana": "Ghana", "senegal": "Senegal", "sénégal": "Senegal",
  "côte d'ivoire": "Ivory Coast", "ivory coast": "Ivory Coast",
  "zambia": "Zambia", "zambie": "Zambia",
  // French adjective forms → country
  "français": "France", "française": "France", "françaises": "France", "francophone": "France",
  "européen": "Europe", "européenne": "Europe", "européennes": "Europe", "européens": "Europe",
  "marocain": "Morocco", "tunisien": "Tunisia", "nigérian": "Nigeria",
  "mexicain": "Mexico", "brésilien": "Brazil", "colombien": "Colombia", "coréen": "South Korea",
  // French regions
  "île-de-france": "Paris", "ile-de-france": "Paris", "idf": "Paris",
  "rhône-alpes": "Lyon", "bassin parisien": "Paris",
  // Missing countries
  "royaume-uni": "United Kingdom", "angleterre": "United Kingdom",
  "czech republic": "Czech Republic", "république tchèque": "Czech Republic", "tchéquie": "Czech Republic",
  "arabie saoudite": "Saudi Arabia", "saudi arabia": "Saudi Arabia",
  "kenya": "Kenya", "nigeria": "Nigeria", "nigéria": "Nigeria",
  "ethiopia": "Ethiopia", "éthiopie": "Ethiopia",
  "tanzania": "Tanzania", "tanzanie": "Tanzania",
  "algeria": "Algeria", "algérie": "Algeria",
  "argentina": "Argentina", "argentine": "Argentina",
  "hong kong": "Hong Kong",
  "sf": "San Francisco", "nyc": "New York",
  "pakistan": "Pakistan", "bangladesh": "Bangladesh", "sri lanka": "Sri Lanka",
  "luxembourg": "Luxembourg", "hungary": "Hungary", "hongrie": "Hungary",
  "greece": "Greece", "grèce": "Greece", "romania": "Romania", "roumanie": "Romania",
  "croatia": "Croatia", "croatie": "Croatia", "kuwait": "Kuwait", "koweït": "Kuwait",
  "oman": "Oman",
  // ISO 2-letter country codes (commonly used in abbreviated ICP descriptions)
  "de": "Germany", "fr": "France", "es": "Spain",
  "nl": "Netherlands", "be": "Belgium", "ch": "Switzerland",
  "at": "Austria", "se": "Sweden", "no": "Norway", "dk": "Denmark",
  "fi": "Finland", "pl": "Poland", "ie": "Ireland", "pt": "Portugal",
  "cz": "Czech Republic", "hu": "Hungary", "gr": "Greece", "ro": "Romania",
  // NOTE: "hr" omitted as ISO code — conflicts with "HR" (Human Resources) which is very common in ICP descriptions
  "bg": "Bulgaria", "sk": "Slovakia", "si": "Slovenia",
  "lu": "Luxembourg", "lt": "Lithuania", "lv": "Latvia", "ee": "Estonia",
  "br": "Brazil", "mx": "Mexico", "ar": "Argentina", "co": "Colombia",
  "cl": "Chile", "pe": "Peru",
  "cn": "China", "jp": "Japan", "kr": "South Korea", "in": "India",
  "sg": "Singapore", "th": "Thailand", "my": "Malaysia",
  "ph": "Philippines", "tw": "Taiwan", "vn": "Vietnam",
  "au": "Australia", "nz": "New Zealand",
  "za": "South Africa", "ng": "Nigeria", "ke": "Kenya", "eg": "Egypt",
  "ma": "Morocco", "tn": "Tunisia", "gh": "Ghana",
  "sa": "Saudi Arabia", "ae": "UAE", "bh": "Bahrain",
  "kw": "Kuwait", "om": "Oman",
  "il": "Israel", "tr": "Turkey",
  // NOTE: "ca" omitted — conflicts with French "CA" (Chiffre d'Affaires)
  // Canada is already covered by "canada" key
};

/** Region names → expanded list of countries. Used by extractLocationsFromDescription. */
const REGION_EXPANSION_MAP: Record<string, string[]> = {
  "maghreb": ["Morocco", "Tunisia", "Algeria"],
  "scandinavie": ["Sweden", "Norway", "Denmark", "Finland"],
  "scandinavia": ["Sweden", "Norway", "Denmark", "Finland"],
  "scandinavian": ["Sweden", "Norway", "Denmark", "Finland"],
  "nordics": ["Sweden", "Norway", "Denmark", "Finland"],
  "nordic": ["Sweden", "Norway", "Denmark", "Finland"],
  "anz": ["Australia", "New Zealand"],
  "dach": ["Germany", "Austria", "Switzerland"],
  "d-a-ch": ["Germany", "Austria", "Switzerland"],
  "benelux": ["Belgium", "Netherlands", "Luxembourg"],
  "gcc": ["UAE", "Saudi Arabia", "Qatar", "Bahrain", "Kuwait", "Oman"],
  "gulf": ["UAE", "Saudi Arabia", "Qatar", "Bahrain", "Kuwait", "Oman"],
  "mena": ["UAE", "Saudi Arabia", "Egypt", "Morocco", "Tunisia"],
  "latam": ["Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru"],
  "amérique latine": ["Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru"],
  "latin america": ["Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru"],
  "emea": ["Europe"],
  "apac": ["Singapore", "Japan", "Australia", "India", "South Korea"],
  "asia pacific": ["Singapore", "Japan", "Australia", "India", "South Korea"],
  "asia-pacific": ["Singapore", "Japan", "Australia", "India", "South Korea"],
  "southeast asia": ["Singapore", "Thailand", "Indonesia", "Malaysia", "Philippines", "Vietnam"],
  "asie du sud-est": ["Singapore", "Thailand", "Indonesia", "Malaysia", "Philippines", "Vietnam"],
  "south east asia": ["Singapore", "Thailand", "Indonesia", "Malaysia", "Philippines", "Vietnam"],
  "east asia": ["Japan", "South Korea", "China", "Taiwan"],
  "asie de l'est": ["Japan", "South Korea", "China", "Taiwan"],
  "west africa": ["Nigeria", "Ghana", "Senegal", "Ivory Coast"],
  "afrique de l'ouest": ["Nigeria", "Ghana", "Senegal", "Ivory Coast"],
  "east africa": ["Kenya", "Tanzania", "Ethiopia"],
  "afrique de l'est": ["Kenya", "Tanzania", "Ethiopia"],
  "sub-saharan": ["Nigeria", "Kenya", "South Africa", "Ghana", "Ethiopia"],
  "subsaharien": ["Nigeria", "Kenya", "South Africa", "Ghana", "Ethiopia"],
  "north america": ["United States", "Canada"],
  "amérique du nord": ["United States", "Canada"],
  "na": ["United States", "Canada"],
  "europe": ["Europe"],
  "midwest": ["United States"],
  "east coast": ["United States"],
  "west coast": ["United States"],
  "silicon valley": ["San Francisco"],
  "bay area": ["San Francisco"],
  "paca": ["Marseille"],
  "sud de la france": ["Marseille", "Toulouse"],
  "nord de la france": ["Lille"],
};

/**
 * Extracts location names from the user's ICP description.
 * Returns standard English names ready for Instantly's location resolver.
 * Used as a safety net when the LLM forgets to include locations.
 */
/**
 * Unicode-aware word boundary matcher.
 * Standard \b doesn't work with accented characters (é, è, ü, etc.)
 * because \w only matches [a-zA-Z0-9_].
 */
function unicodeWordBoundaryRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use lookbehind/lookahead for word boundaries that handle Unicode
  return new RegExp(`(?<=^|[\\s,;:!?.()/'"«»\\-])${escaped}(?=$|[\\s,;:!?.()/'"«»\\-])`, "i");
}

// ISO 2-letter country codes — must be matched UPPERCASE to avoid "de" in French etc.
const ISO_COUNTRY_CODES = new Set([
  "DE", "FR", "ES", "NL", "BE", "CH", "AT", "SE", "DK", "FI", "PL",
  "IE", "PT", "CZ", "HU", "GR", "RO", "LU", "BR", "MX", "AR", "CO",
  "CL", "PE", "CN", "JP", "KR", "SG", "TH", "MY", "PH", "TW", "VN",
  "AU", "NZ", "ZA", "NG", "KE", "EG", "MA", "TN", "GH", "SA", "AE",
  "BH", "KW", "IL", "TR",
  // NOTE: "CA" omitted — conflicts with French "CA" (Chiffre d'Affaires)
]);

function extractLocationsFromDescription(description: string): string[] {
  const lower = description.toLowerCase();
  const found: string[] = [];
  const seen = new Set<string>();

  // Filter out "worldwide"/"global" markers first — these mean no location filter
  const globalMarkers = ["worldwide", "global", "mondial", "partout", "international"];
  for (const marker of globalMarkers) {
    if (unicodeWordBoundaryRegex(marker).test(lower)) return [];
  }

  // Check ISO codes (UPPERCASE only in original text to avoid "de" in French)
  const words = description.split(/[\s,;:!?.()/']+/);
  for (const w of words) {
    if (ISO_COUNTRY_CODES.has(w)) {
      const canonical = LOCATION_NAME_MAP[w.toLowerCase()];
      if (canonical && !seen.has(canonical)) {
        seen.add(canonical);
        found.push(canonical);
      }
    }
  }

  // Check region expansions FIRST (longer, more specific)
  const sortedRegions = Object.keys(REGION_EXPANSION_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedRegions) {
    if (unicodeWordBoundaryRegex(key).test(lower)) {
      for (const country of REGION_EXPANSION_MAP[key]) {
        if (!seen.has(country)) {
          seen.add(country);
          found.push(country);
        }
      }
    }
  }

  // Then check individual country/city names
  // Skip ISO 2-letter codes here (already handled above with uppercase check)
  const sortedKeys = Object.keys(LOCATION_NAME_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length <= 2 && ISO_COUNTRY_CODES.has(key.toUpperCase())) continue;
    if (unicodeWordBoundaryRegex(key).test(lower)) {
      const canonical = LOCATION_NAME_MAP[key];
      if (!seen.has(canonical)) {
        seen.add(canonical);
        found.push(canonical);
      }
    }
  }

  return found;
}

// ─── Main parser ────────────────────────────────────────

/** Check if filters contain at least one meaningful field (not just dedup flags) */
function hasSubstantiveFilters(filters: Record<string, unknown>): boolean {
  const DEDUP_ONLY = new Set(["skip_owned_leads", "show_one_lead_per_company"]);
  return Object.keys(filters).some(
    (k) => !DEDUP_ONLY.has(k) && filters[k] !== undefined && filters[k] !== null,
  );
}

export interface ParseICPResult {
  filters: InstantlySearchFilters;
  /** Industries inferred from the description (not from the LLM).
   *  When present, the agent should confirm with the user before proceeding. */
  inferredIndustries?: string[];
  /** Warnings about filter issues (e.g. stripped locations, unresolved geo).
   *  When present, the agent MUST inform the user before proceeding. */
  parseWarnings?: string[];
  /** Explains where Instantly's bucket granularity doesn't match the user's exact request.
   *  The agent MUST relay these to the user so they understand the approximation. */
  approximations?: string[];
  /** When set, the description is too vague to produce reliable filters.
   *  The agent MUST relay this message to the user and NOT proceed with sourcing. */
  clarificationNeeded?: string;
}

// ── Vagueness detection ──────────────────────────────────
// Two-stage approach:
// 1. Pre-LLM: Block obviously empty descriptions (saves API calls)
// 2. Post-LLM: Check if the LLM managed to generate meaningful filters

/** Pre-LLM check: only block obviously insufficient descriptions. */
function checkDescriptionTooShort(description: string): string | null {
  const trimmed = description.trim();

  // Ultra-short descriptions (< 10 chars) can't contain meaningful targeting info
  if (trimmed.length < 10) {
    return "Ta description est trop courte pour cibler des leads. Précise au minimum :\n- le **rôle/titre** ciblé (ex: CEO, VP Marketing, Directeur Commercial...)\n- le **secteur/industrie** (ex: SaaS, fintech, manufacturing, e-commerce...)\n\nExemple : « CTO de startups SaaS en France »";
  }

  return null;
}

/** Post-LLM check: verify the LLM produced meaningful targeting filters. */
function checkFiltersCompleteness(
  filters: Record<string, unknown>,
): string | null {
  const hasJobTitles = Array.isArray(filters.job_titles) && filters.job_titles.length > 0;
  const hasCompanyNames = filters.company_names &&
    typeof filters.company_names === "object" &&
    (filters.company_names as Record<string, unknown>).include &&
    (Array.isArray((filters.company_names as Record<string, unknown>).include)) &&
    ((filters.company_names as Record<string, unknown>).include as unknown[]).length > 0;
  const hasLookalike = typeof filters.lookalike_domain === "string" && filters.lookalike_domain.length > 0;
  // At least one person targeting method must be present
  if (!hasJobTitles && !hasCompanyNames && !hasLookalike) {
    return "Je n'ai pas pu identifier de cible précise dans ta description. Pour une recherche pertinente, précise au minimum :\n- le **rôle/titre** ciblé (ex: CEO, VP Marketing, Directeur Commercial, Data Scientist...)\n- le **secteur/industrie** (ex: SaaS, fintech, manufacturing, e-commerce, santé...)\n\nExemple : « CTO de startups SaaS en France »";
  }

  // If we have job titles but no industry at all, warn (but don't block — industry can be inferred)
  // This is handled by the existing inferredIndustries confirmation_needed in the tool.

  return null;
}

export async function parseICP(
  description: string,
  workspaceId: string,
): Promise<ParseICPResult> {
  // 0. Pre-LLM check: block obviously empty descriptions
  const tooShort = checkDescriptionTooShort(description);
  if (tooShort) {
    console.log("[parseICP] Description too short, asking for clarification");
    return {
      filters: { skip_owned_leads: true } as InstantlySearchFilters,
      clarificationNeeded: tooShort,
    };
  }

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

  // 2.1 Stock index + industry logic
  // When user mentions a stock index (CAC 40, Fortune 500, etc.), the LLM may either:
  // a) Expand it to company_names (40+ entries)
  // b) Just guess an industry (wrong — stock indices span ALL sectors)
  // Drop industries ONLY if the user didn't explicitly mention one.
  const STOCK_INDEX_PATTERNS = /\b(cac\s*40|fortune\s*500|fortune\s*1000|ftse\s*100|dax\s*30|s&p\s*500|sbf\s*120|next\s*40|french\s*tech\s*120|inc\s*5000|nasdaq|dow\s*jones|nikkei|euronext|stoxx)\b/i;
  const hasStockIndex = STOCK_INDEX_PATTERNS.test(description);
  const cn = (fixed as Record<string, unknown>).company_names as { include?: string[] } | undefined;
  const hasLargeCompanyNames = cn?.include && cn.include.length >= 10;

  if ((hasStockIndex || hasLargeCompanyNames) && fixed.industries) {
    // Check if the description explicitly mentions an industry term
    const descLower = description.toLowerCase();
    // Remove stock index terms from the check to avoid false positives
    const descWithoutIndex = descLower.replace(STOCK_INDEX_PATTERNS, "");
    const hasExplicitIndustry = [...INDUSTRY_FIXES_LOWER.keys()].some(term => {
      if (term.length < 3) return false;
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return regex.test(descWithoutIndex);
    });
    if (!hasExplicitIndustry) {
      console.log(`[parseICP] Stock index detected — dropping LLM-guessed industries: ${JSON.stringify(fixed.industries)}`);
      delete (fixed as Record<string, unknown>).industries;
      delete (fixed as Record<string, unknown>).sub_industries;
    } else {
      console.log(`[parseICP] Stock index detected but description mentions an industry — keeping industries: ${JSON.stringify(fixed.industries)}`);
    }
  }

  // 2.5 Strip hallucinated locations — hard guard
  const parseWarnings: string[] = [];
  if (fixed.locations && !descriptionMentionsLocation(description)) {
    console.log(`[parseICP] Stripped hallucinated locations: ${JSON.stringify(fixed.locations)} (not mentioned in description)`);
    parseWarnings.push(`Location filter "${JSON.stringify(fixed.locations)}" was removed — not found in your description. If you intended a geographic filter, please specify the location explicitly.`);
    delete (fixed as Record<string, unknown>).locations;
    delete (fixed as Record<string, unknown>).location_filter_type;
  }

  // 2.55 Inject missing locations — safety net (reverse of 2.5)
  // If user mentioned a country/city but LLM forgot to include locations, inject it
  if (!fixed.locations && descriptionMentionsLocation(description)) {
    const extracted = extractLocationsFromDescription(description);
    if (extracted.length > 0) {
      (fixed as Record<string, unknown>).locations = extracted;
      console.log(`[parseICP] Injected missing locations: ${JSON.stringify(extracted)} (detected in description but LLM omitted)`);
    }
  }

  // 2.6 Infer missing industries from description (safety net)
  const inferredIndustries = inferIndustriesFromDescription(description, fixed as unknown as Record<string, unknown>);

  // 2.7 Infer niche sub_industries from description (runs independently of industry inference)
  inferSubIndustriesFromDescription(description, fixed as unknown as Record<string, unknown>);

  // 2.75 Strip over-broad employee_count from negation patterns
  // When user says "pas de startups" / "no startups", the LLM generates employee_count
  // with everything EXCEPT 0-25 (7 out of 8 ranges). This is over-broadening — it's an
  // exclusion intent, not a positive filter. Remove employee_count entirely in this case.
  const empCount = (fixed as Record<string, unknown>).employee_count as string[] | undefined;
  if (empCount && empCount.length >= 6) {
    // 6+ ranges out of 8 = essentially "everything" → not a meaningful filter
    console.log(`[parseICP] Over-broad employee_count (${empCount.length}/8 ranges) — stripping as negation artifact`);
    delete (fixed as Record<string, unknown>).employee_count;
  }

  // 2.8 Strip negated industries/sub_industries
  // If description says "not automotive", "excluding fintech", "sauf luxe", etc.
  // we must remove those values from industries/sub_industries.
  stripNegatedFilters(description, fixed as unknown as Record<string, unknown>);

  console.log("[parseICP] After inferIndustries+SubIndustries:", JSON.stringify(fixed).slice(0, 1000));

  // 3. Validate with Zod AFTER post-processing
  const validated = searchFiltersSchema.safeParse(fixed);
  let finalFilters: InstantlySearchFilters;

  if (validated.success) {
    // Guard: check if we accidentally stripped everything
    if (!hasSubstantiveFilters(validated.data as unknown as Record<string, unknown>)) {
      console.error("[parseICP] WARNING: All filters were stripped! Raw had:", Object.keys(raw as object).join(", "));
      // Try stripping from the raw output directly (in case postProcess failed to flatten)
      const rawStripped = { skip_owned_leads: true, ...stripInvalidFields(postProcessFilters(raw as Record<string, unknown>)) } as InstantlySearchFilters;
      if (hasSubstantiveFilters(rawStripped as unknown as Record<string, unknown>)) {
        console.log("[parseICP] Recovered filters from raw:", JSON.stringify(rawStripped).slice(0, 1000));
        finalFilters = rawStripped;
      } else {
        finalFilters = validated.data;
      }
    } else {
      console.log("[parseICP] Final filters (Zod OK):", JSON.stringify(validated.data).slice(0, 1000));
      finalFilters = validated.data;
    }
  } else {
    // 4. If still invalid, extract valid fields individually (never throw)
    console.warn("[parseICP] Zod validation failed:", JSON.stringify(validated.error.issues));
    const stripped = { skip_owned_leads: true, ...stripInvalidFields(fixed) } as InstantlySearchFilters;
    console.log("[parseICP] Final filters (stripped):", JSON.stringify(stripped).slice(0, 1000));
    finalFilters = stripped;
  }

  // 5. Post-LLM check: verify the LLM produced meaningful targeting filters
  const insufficientFilters = checkFiltersCompleteness(finalFilters as unknown as Record<string, unknown>);
  if (insufficientFilters) {
    console.log("[parseICP] LLM output lacks targeting — asking for clarification");
    return {
      filters: finalFilters,
      inferredIndustries,
      parseWarnings,
      clarificationNeeded: insufficientFilters,
    };
  }

  return { filters: finalFilters, inferredIndustries, parseWarnings };
}

// ─── Phase 2: Two-phase parser (extraction + mapping) ───

// Raw intent schema — NO Instantly enums, just semantic meaning
const rawIntentSchema = z.object({
  roles: z.array(z.object({
    title: z.string(),
    function_area: z.string().optional(),
  })).optional(),
  industry: z.string().optional(),
  sub_industry: z.string().optional(),
  employee_range: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    label: z.string().optional(),
  }).optional(),
  revenue_range: z.object({
    min_millions: z.number().optional(),
    max_millions: z.number().optional(),
  }).optional(),
  locations: z.array(z.string()).optional(),
  excluded_terms: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  news_signals: z.array(z.string()).optional(),
  lookalike_domain: z.string().optional(),
  company_names: z.object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),
  keyword: z.string().optional(),
});

type RawIntent = z.infer<typeof rawIntentSchema>;

// ── Simplified LLM prompt for raw intent extraction ──

const RAW_INTENT_SYSTEM = `You are an ICP (Ideal Customer Profile) parser. Extract the user's targeting intent into structured JSON — do NOT map to any API-specific enums.

## PERSON TARGETING

For each role mentioned, extract:
- title: the exact role name (e.g., "CTO", "VP Sales", "Gestionnaire de Flotte")
- function_area: the functional department (e.g., "sales", "engineering", "HR", "marketing", "finance", "operations", "IT", "support")

Standard role correspondences (user says → extract):

C-Level (strategic decision-makers):
- "CEO" / "PDG" / "dirigeant" / "DG" → title: "CEO", function_area: "executive"
- "CTO" / "Directeur Technique" → title: "CTO", function_area: "engineering"
- "CFO" / "DAF" → title: "CFO", function_area: "finance"
- "CRO" / "Chief Revenue Officer" → title: "CRO", function_area: "sales"
- "CMO" / "Directeur Marketing" (C-level) → title: "CMO", function_area: "marketing"
- "COO" / "Directeur des Opérations" → title: "COO", function_area: "operations"
- "CHRO" / "DRH" → title: "CHRO", function_area: "HR"
- "CIO" / "DSI" → title: "CIO", function_area: "IT"
- "CISO" / "RSSI" → title: "CISO", function_area: "IT"

VP-Level (execute C-level strategy):
- "VP Sales" → title: "VP Sales", function_area: "sales"
- "VP Marketing" → title: "VP Marketing", function_area: "marketing"
- "VP Engineering" → title: "VP Engineering", function_area: "engineering"
- "VP Product" → title: "VP Product", function_area: "engineering"

Director / Head-Level:
- "Sales Director" / "Head of Sales" / "Directeur Commercial" → title: "Sales Director", function_area: "sales"
- "Head of Product" → title: "Head of Product", function_area: "engineering"
- "Engineering Director" → title: "Engineering Director", function_area: "engineering"
- "Head of RevOps" → title: "Head of RevOps", function_area: "sales"

Manager-Level:
- "Sales Manager" / "Responsable Commercial" → title: "Sales Manager", function_area: "sales"
- "Product Manager" → title: "Product Manager", function_area: "engineering"
- "CSM" / "Customer Success Manager" → title: "Customer Success Manager", function_area: "support"

IC-Level:
- "SDR" / "BDR" → title: "SDR", function_area: "sales"
- "AE" / "Account Executive" → title: "Account Executive", function_area: "sales"

Founders:
- "Founder" / "Fondateur" → title: "Founder"
- "Owner" / "Gérant" → title: "Owner"

RULES for roles:
- Include the EXACT title the user mentioned. If French, translate to the closest English equivalent AND keep the French variant.
- ABBREVIATION DISAMBIGUATION: "CS" = Customer Success. "SDR" = Sales Development Rep. "AE" = Account Executive. "BDR" = Business Development Rep. "CSM" = Customer Success Manager.
- When user mentions multiple seniority levels (e.g. "VP or Director Sales"), create multiple role entries.
- JOB TITLE PRECISION: Each role must be at the SAME level of decision-making as described. A CFO ≠ VP Finance. A Head of Sales ≠ Sales Manager.
- NEWS vs ROLE: "qui nouveau CEO" = news signal (leadership_change), NOT target role.

## COMPANY TARGETING

- industry: The broad industry name (e.g., "waste management", "fintech", "SaaS", "aerospace", "e-commerce"). Use the common English or French term.
- sub_industry: More specific niche if mentioned (e.g., "automotive", "cybersecurity", "fashion", "pharma").
- employee_range: Extract as numeric min/max OR a label:
  - "50-200 employees" → { min: 50, max: 200 }
  - "startup" → { label: "startup" }
  - "PME" → { label: "PME" }
  - "enterprise" / "grande entreprise" → { label: "enterprise" }
  - "500+" → { min: 500 }
  - "< 100" → { max: 100 }
- revenue_range: Extract as min/max in millions:
  - "10-50M revenue" → { min_millions: 10, max_millions: 50 }
  - "> 100M CA" → { min_millions: 100 }

## LOCATION
- locations: Array of location names AS WRITTEN by the user. Keep the original language. e.g., ["France"], ["Scandinavie"], ["Bay Area"], ["États-Unis"].
- CRITICAL: Do NOT infer location from the language of the query. A French-language query does NOT imply France. Only include locations explicitly mentioned.

## EXCLUSIONS
- excluded_terms: Things the user explicitly wants to EXCLUDE. e.g., ["ESN", "Big 4", "non-profit", "startups"]
- If the user says "not X", "excluding X", "sauf X", "hors X", "pas de X" → add X to excluded_terms.

## ADVANCED
- technologies: Tech stack mentioned (e.g., ["Salesforce", "HubSpot"])
- news_signals: Business signals (e.g., ["hiring", "funding", "acquisition", "new CEO", "product launch"])
- lookalike_domain: "companies like Stripe" → "stripe.com"
- company_names: { include: [...], exclude: [...] } for specific company targeting
- keyword: Freeform keyword for niche targeting not covered by other fields

## STOCK INDICES
When the user references a stock index ("CAC 40", "Fortune 500", "FTSE 100"), do NOT set industry. These indices span ALL sectors.

## OUTPUT FORMAT
Output a FLAT JSON object with these EXACT field names. Do NOT nest fields inside "person_targeting", "company_targeting", or any wrapper object.

Example for "CTO at SaaS companies with 10-50 employees in France":
{
  "roles": [{"title": "CTO", "function_area": "engineering"}],
  "industry": "SaaS",
  "employee_range": {"min": 10, "max": 50},
  "locations": ["France"]
}

Example for "VP Sales ou Directeur Commercial dans la fintech, PME, Paris":
{
  "roles": [
    {"title": "VP Sales", "function_area": "sales"},
    {"title": "Directeur Commercial", "function_area": "sales"}
  ],
  "industry": "fintech",
  "employee_range": {"label": "PME"},
  "locations": ["Paris"]
}

Example for "Head of Procurement at automotive companies in DACH, 500+ employees":
{
  "roles": [{"title": "Head of Procurement", "function_area": "operations"}],
  "industry": "manufacturing",
  "sub_industry": "automotive",
  "employee_range": {"min": 500},
  "locations": ["DACH"]
}

WRONG — never nest:
{
  "person_targeting": [{"title": "CTO"}],
  "company_targeting": {"industry": "SaaS"}
}

Only include fields that are clearly specified or strongly implied. Interpret both French AND English descriptions.`;

// ── Deterministic mapping functions (exported for testing) ──

const EMPLOYEE_BUCKETS = [
  { label: "0 - 25", min: 0, max: 25 },
  { label: "25 - 100", min: 25, max: 100 },
  { label: "100 - 250", min: 100, max: 250 },
  { label: "250 - 1000", min: 250, max: 1000 },
  { label: "1K - 10K", min: 1000, max: 10000 },
  { label: "10K - 50K", min: 10000, max: 50000 },
  { label: "50K - 100K", min: 50000, max: 100000 },
  { label: "> 100K", min: 100000, max: Infinity },
];

const LABEL_TO_EMPLOYEE: Record<string, string[]> = {
  "startup": ["0 - 25"],
  "early-stage": ["0 - 25"],
  "early stage": ["0 - 25"],
  "seed-stage": ["0 - 25"],
  "seed stage": ["0 - 25"],
  "tpe": ["0 - 25"],
  "micro-entreprise": ["0 - 25"],
  "bootstrapped": ["0 - 25", "25 - 100"],
  "petite entreprise": ["0 - 25", "25 - 100"],
  "small business": ["0 - 25", "25 - 100"],
  "series a": ["0 - 25", "25 - 100"],
  "vc-backed": ["0 - 25", "25 - 100", "100 - 250"],
  "venture-backed": ["0 - 25", "25 - 100", "100 - 250"],
  "smb": ["0 - 25", "25 - 100", "100 - 250"],
  "pme": ["25 - 100", "100 - 250"],
  "franchise": ["25 - 100", "100 - 250"],
  "family business": ["0 - 25", "25 - 100", "100 - 250"],
  "boite familiale": ["0 - 25", "25 - 100", "100 - 250"],
  "series b": ["25 - 100", "100 - 250"],
  "scaleup": ["100 - 250", "250 - 1000"],
  "scale-up": ["100 - 250", "250 - 1000"],
  "scale up": ["100 - 250", "250 - 1000"],
  "series c": ["100 - 250", "250 - 1000"],
  "unicorn": ["250 - 1000", "1K - 10K"],
  "licorne": ["250 - 1000", "1K - 10K"],
  "eti": ["250 - 1000", "1K - 10K"],
  "mid-market": ["250 - 1000", "1K - 10K"],
  "midmarket": ["250 - 1000", "1K - 10K"],
  "mid market": ["250 - 1000", "1K - 10K"],
  "pe-backed": ["250 - 1000", "1K - 10K", "10K - 50K"],
  "enterprise": ["10K - 50K", "50K - 100K", "> 100K"],
  "large enterprise": ["10K - 50K", "50K - 100K", "> 100K"],
  "grande entreprise": ["10K - 50K", "50K - 100K", "> 100K"],
  "grand groupe": ["10K - 50K", "50K - 100K", "> 100K"],
  "multinationale": ["50K - 100K", "> 100K"],
};

export function mapEmployeeRange(min?: number, max?: number, label?: string): string[] | undefined {
  // If min/max are provided, use numeric mapping
  if (min !== undefined || max !== undefined) {
    const lo = min ?? 0;
    const hi = max ?? Infinity;
    // Instantly buckets use inclusive ranges (e.g., "25-100" includes both 25 and 100).
    // Include any bucket where: bucket.min <= hi AND bucket.max >= lo.
    // Exception: when hi exactly equals a bucket's lower boundary AND lo < that boundary,
    // don't include the next bucket up (e.g., [0,25] should not include "25-100").
    const buckets = EMPLOYEE_BUCKETS
      .filter(b => {
        if (b.max < lo || b.min > hi) return false;
        // Don't include next bucket when range ends exactly at its start
        if (b.min === hi && lo < hi) return false;
        return true;
      })
      .map(b => b.label);
    return buckets.length > 0 ? buckets : undefined;
  }
  // Fall back to label mapping
  if (label) {
    const key = label.toLowerCase().trim();
    return LABEL_TO_EMPLOYEE[key] ?? undefined;
  }
  return undefined;
}

export function mapIndustry(raw: string): string[] | undefined {
  // 1. Check if it's already a valid Instantly industry
  if (VALID_INDUSTRIES.has(raw)) return [raw];
  // 2. Check fix map (case-insensitive)
  const direct = INDUSTRY_FIXES[raw] ?? INDUSTRY_FIXES[raw.trim()];
  if (direct) return Array.isArray(direct) ? direct : [direct];
  const ciMatch = Object.entries(INDUSTRY_FIXES).find(
    ([k]) => k.toLowerCase() === raw.toLowerCase().trim(),
  )?.[1];
  if (ciMatch) return Array.isArray(ciMatch) ? ciMatch : [ciMatch];
  // 3. Fuzzy fallback
  return fuzzyMatchIndustry(raw);
}

export function mapSubIndustry(raw: string): string[] | undefined {
  const key = raw.toLowerCase().trim();
  return NICHE_SUBINDUSTRY_LOWER.get(key) ?? undefined;
}

export function mapDepartment(raw: string): string | undefined {
  if (VALID_DEPARTMENTS.has(raw)) return raw;
  const mapped = DEPARTMENT_FIXES[raw]
    ?? DEPARTMENT_FIXES[raw.toLowerCase().trim()]
    ?? Object.entries(DEPARTMENT_FIXES).find(
      ([k]) => k.toLowerCase() === raw.toLowerCase().trim(),
    )?.[1];
  return mapped ?? undefined;
}

const REVENUE_BUCKETS = [
  { label: "$0 - 1M", min: 0, max: 1 },
  { label: "$1M - 10M", min: 1, max: 10 },
  { label: "$10M - 50M", min: 10, max: 50 },
  { label: "$50M - 100M", min: 50, max: 100 },
  { label: "$100M - 250M", min: 100, max: 250 },
  { label: "$250M - 500M", min: 250, max: 500 },
  { label: "$500M - 1B", min: 500, max: 1000 },
  { label: "> $1B", min: 1000, max: Infinity },
];

export function mapRevenue(minM?: number, maxM?: number): string[] | undefined {
  if (minM === undefined && maxM === undefined) return undefined;
  const lo = minM ?? 0;
  const hi = maxM ?? Infinity;
  const buckets = REVENUE_BUCKETS
    .filter(b => b.min < hi && b.max > lo)
    .map(b => b.label);
  return buckets.length > 0 ? buckets : undefined;
}

export function mapNews(signals: string[]): string[] | undefined {
  if (!signals?.length) return undefined;
  const result = new Set<string>();
  for (const s of signals) {
    if (VALID_NEWS.has(s)) {
      result.add(s);
    } else {
      const mapped = NEWS_FIXES[s]
        ?? NEWS_FIXES[s.toLowerCase().trim()]
        ?? Object.entries(NEWS_FIXES).find(
          ([k]) => k.toLowerCase() === s.toLowerCase().trim(),
        )?.[1];
      if (mapped) {
        result.add(mapped);
      } else {
        const snaked = s.toLowerCase().trim().replace(/[\s-]+/g, "_");
        if (VALID_NEWS.has(snaked)) result.add(snaked);
      }
    }
  }
  return result.size > 0 ? [...result] : undefined;
}

const GLOBAL_LOCATION_TERMS = new Set([
  "worldwide", "global", "mondial", "partout", "international",
  "globally", "all countries", "any country", "no geo",
]);

export function mapLocations(raw: string[]): string[] {
  if (!raw?.length) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const loc of raw) {
    const lower = loc.toLowerCase().trim();
    // Skip global markers
    if (GLOBAL_LOCATION_TERMS.has(lower)) return [];
    // Check region expansion
    const expanded = REGION_EXPANSION_MAP[lower];
    if (expanded) {
      for (const c of expanded) {
        if (!seen.has(c)) { seen.add(c); result.push(c); }
      }
      continue;
    }
    // Check location name map
    const canonical = LOCATION_NAME_MAP[lower];
    if (canonical) {
      if (!seen.has(canonical)) { seen.add(canonical); result.push(canonical); }
      continue;
    }
    // Passthrough (already English name or unknown)
    if (!seen.has(loc)) { seen.add(loc); result.push(loc); }
  }
  return result;
}

// ── Role synonym expansion ──

const ROLE_SYNONYMS: Record<string, string[]> = {
  "CEO": ["CEO", "Chief Executive Officer"],
  "CTO": ["CTO", "Chief Technology Officer", "Chief Technical Officer"],
  "CFO": ["CFO", "Chief Financial Officer"],
  "CRO": ["CRO", "Chief Revenue Officer"],
  "CMO": ["CMO", "Chief Marketing Officer"],
  "COO": ["COO", "Chief Operating Officer"],
  "CHRO": ["CHRO", "Chief Human Resources Officer"],
  "CIO": ["CIO", "Chief Information Officer"],
  "CISO": ["CISO", "Chief Information Security Officer"],
  "CDO": ["CDO", "Chief Digital Officer", "Chief Data Officer"],
  "CPO": ["CPO", "Chief Product Officer"],
  "CCO": ["CCO", "Chief Commercial Officer"],
  "VP Sales": ["VP Sales", "VP of Sales", "Vice President Sales"],
  "VP Marketing": ["VP Marketing", "VP of Marketing", "Vice President Marketing"],
  "VP Engineering": ["VP Engineering", "VP of Engineering", "Vice President Engineering"],
  "VP Product": ["VP Product", "VP of Product", "Vice President Product"],
  "VP Finance": ["VP Finance", "VP of Finance", "Vice President Finance"],
  "VP HR": ["VP HR", "VP Human Resources", "VP People", "VP of People"],
  "VP Operations": ["VP Operations", "VP Ops", "Vice President Operations"],
  "VP Customer Success": ["VP Customer Success", "VP of Customer Success"],
  "Sales Director": ["Sales Director", "Director of Sales", "Head of Sales"],
  "Marketing Director": ["Marketing Director", "Director of Marketing", "Head of Marketing"],
  "HR Director": ["HR Director", "Head of HR", "Director of Human Resources"],
  "IT Director": ["IT Director", "Director of IT", "Head of IT"],
  "Finance Director": ["Finance Director", "Director of Finance", "Head of Finance"],
  "Engineering Director": ["Engineering Director", "Director of Engineering", "Head of Engineering"],
  "Head of Product": ["Head of Product", "Product Director", "Director of Product"],
  "Head of Growth": ["Head of Growth", "Growth Director", "Director of Growth"],
  "Head of Data": ["Head of Data", "Data Director", "Director of Data"],
  "Head of RevOps": ["Head of RevOps", "Head of Revenue Operations", "Director of Revenue Operations"],
  "Head of Customer Success": ["Head of Customer Success", "Director of Customer Success"],
  "Head of Partnerships": ["Head of Partnerships", "Director of Partnerships", "Partnerships Director"],
  "Head of Legal": ["Head of Legal", "Legal Director", "General Counsel"],
  "Head of Design": ["Head of Design", "Design Director", "Director of Design"],
  "Head of Procurement": ["Head of Procurement", "Procurement Director", "Director of Procurement"],
  "Sales Manager": ["Sales Manager"],
  "Marketing Manager": ["Marketing Manager"],
  "Product Manager": ["Product Manager", "PM"],
  "Project Manager": ["Project Manager"],
  "Customer Success Manager": ["Customer Success Manager", "CSM"],
  "Account Manager": ["Account Manager", "Key Account Manager", "KAM"],
  "Growth Manager": ["Growth Manager", "Growth Hacker"],
  "RevOps Manager": ["Revenue Operations Manager", "RevOps Manager"],
  "HR Manager": ["HR Manager", "Human Resources Manager"],
  "Engineering Manager": ["Engineering Manager", "Software Engineering Manager"],
  "SDR": ["SDR", "Sales Development Representative", "BDR", "Business Development Representative"],
  "Account Executive": ["Account Executive", "AE"],
  "Data Analyst": ["Data Analyst", "Business Analyst"],
  "Data Scientist": ["Data Scientist", "Senior Data Scientist"],
  "Consultant": ["Consultant", "Senior Consultant"],
  "Founder": ["Founder", "Co-Founder", "Fondateur"],
  "Owner": ["Owner", "Gérant", "Managing Partner"],
};

// French role titles → canonical English key in ROLE_SYNONYMS
const FRENCH_ROLE_MAP: Record<string, string> = {
  "PDG": "CEO",
  "Directeur Général": "CEO",
  "DG": "CEO",
  "Directeur Technique": "CTO",
  "DAF": "CFO",
  "Directeur Financier": "CFO",
  "Directeur Marketing": "CMO",
  "Directeur des Opérations": "COO",
  "DRH": "CHRO",
  "DSI": "CIO",
  "RSSI": "CISO",
  "Directeur Commercial": "Sales Director",
  "Responsable Commercial": "Sales Manager",
  "Responsable Marketing": "Marketing Manager",
  "Chef de Projet": "Project Manager",
  "Responsable Achat": "Head of Procurement",
  "Directeur Achat": "Head of Procurement",
  "Responsable RH": "HR Manager",
  "Fondateur": "Founder",
  "Gérant": "Owner",
  "Directeur Juridique": "Head of Legal",
  "Directeur Partenariats": "Head of Partnerships",
};

function getSynonyms(title: string): string[] {
  // Try exact match first
  const exact = ROLE_SYNONYMS[title];
  if (exact) return exact;
  // Try case-insensitive
  const ciKey = Object.keys(ROLE_SYNONYMS).find(k => k.toLowerCase() === title.toLowerCase());
  if (ciKey) return ROLE_SYNONYMS[ciKey];
  // Try French → English mapping
  const frenchKey = FRENCH_ROLE_MAP[title]
    ?? Object.entries(FRENCH_ROLE_MAP).find(([k]) => k.toLowerCase() === title.toLowerCase())?.[1];
  if (frenchKey) {
    const synonyms = ROLE_SYNONYMS[frenchKey];
    if (synonyms) return [...synonyms, title]; // Include both English synonyms AND the French title
  }
  // No synonyms found — return the title itself
  return [title];
}

// ── Assemble raw intent → Instantly filters ──

interface MappingResult {
  filters: InstantlySearchFilters;
  approximations: string[];
}

/**
 * Detect when bucket ranges don't exactly match the user's request.
 * Returns human-readable explanations for each approximation.
 */
function detectBucketApproximations(
  requestedMin: number | undefined,
  requestedMax: number | undefined,
  selectedBuckets: { label: string; min: number; max: number }[],
  fieldLabel: string,
  formatNum: (n: number) => string,
): string[] {
  if (!selectedBuckets.length) return [];
  const results: string[] = [];

  const firstBucket = selectedBuckets[0];
  const lastBucket = selectedBuckets[selectedBuckets.length - 1];

  // Check if the first selected bucket starts below the requested min
  if (requestedMin !== undefined && firstBucket.min < requestedMin) {
    results.push(
      `Tu as demandé ${fieldLabel} > ${formatNum(requestedMin)}, mais Instantly filtre par tranches. ` +
      `La tranche la plus proche est "${firstBucket.label}" qui inclut aussi des valeurs en dessous de ${formatNum(requestedMin)}.`,
    );
  }

  // Check if the last selected bucket extends above the requested max
  if (requestedMax !== undefined && lastBucket.max > requestedMax && lastBucket.max !== Infinity) {
    results.push(
      `Tu as demandé ${fieldLabel} < ${formatNum(requestedMax)}, mais Instantly filtre par tranches. ` +
      `La tranche la plus proche est "${lastBucket.label}" qui inclut aussi des valeurs au-dessus de ${formatNum(requestedMax)}.`,
    );
  }

  return results;
}

function formatMillions(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}B`;
  return `$${n}M`;
}

function formatEmployees(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function mapRawIntentToFilters(raw: RawIntent): MappingResult {
  const filters: Record<string, unknown> = {};
  const approximations: string[] = [];

  // Roles → job_titles + department
  if (raw.roles?.length) {
    const titles = new Set<string>();
    for (const r of raw.roles) {
      for (const syn of getSynonyms(r.title)) {
        titles.add(syn);
      }
      // Also add the raw title itself (in case getSynonyms didn't match)
      titles.add(r.title);
    }
    filters.job_titles = [...titles];

    // Department from first role's function_area
    const area = raw.roles[0].function_area;
    if (area) {
      const dept = mapDepartment(area);
      if (dept) filters.department = [dept];
    }
  }

  // Industry
  if (raw.industry) {
    const industries = mapIndustry(raw.industry);
    if (industries) filters.industries = industries;
  }

  // Sub-industry
  if (raw.sub_industry) {
    const subs = mapSubIndustry(raw.sub_industry);
    if (subs) filters.sub_industries = subs;
  }

  // Employee count
  if (raw.employee_range) {
    const emp = mapEmployeeRange(raw.employee_range.min, raw.employee_range.max, raw.employee_range.label);
    if (emp) {
      filters.employee_count = emp;
      // Detect approximation
      const min = raw.employee_range.min;
      const max = raw.employee_range.max;
      if (min !== undefined || max !== undefined) {
        const matched = emp.map(l => EMPLOYEE_BUCKETS.find(b => b.label === l)).filter(Boolean) as typeof EMPLOYEE_BUCKETS;
        approximations.push(...detectBucketApproximations(min, max, matched, "taille d'entreprise", formatEmployees));
      }
    }
  }

  // Revenue
  if (raw.revenue_range) {
    const rev = mapRevenue(raw.revenue_range.min_millions, raw.revenue_range.max_millions);
    if (rev) {
      filters.revenue = rev;
      // Detect approximation
      const min = raw.revenue_range.min_millions;
      const max = raw.revenue_range.max_millions;
      if (min !== undefined || max !== undefined) {
        const matched = rev.map(l => REVENUE_BUCKETS.find(b => b.label === l)).filter(Boolean) as typeof REVENUE_BUCKETS;
        approximations.push(...detectBucketApproximations(min, max, matched, "chiffre d'affaires", formatMillions));
      }
    }
  }

  // Locations
  if (raw.locations?.length) {
    const locs = mapLocations(raw.locations);
    if (locs.length > 0) filters.locations = locs;
  }

  // Technologies
  if (raw.technologies?.length) {
    filters.technologies = raw.technologies;
  }

  // News
  if (raw.news_signals?.length) {
    const news = mapNews(raw.news_signals);
    if (news) filters.news = news;
  }

  // Lookalike
  if (raw.lookalike_domain) {
    filters.lookalike_domain = raw.lookalike_domain;
  }

  // Company names
  if (raw.company_names) {
    filters.company_names = raw.company_names;
  }

  // Keyword
  if (raw.keyword) {
    filters.keyword_filter = raw.keyword;
  }

  // Always enforce dedup
  filters.skip_owned_leads = true;
  filters.show_one_lead_per_company = true;

  return { filters: filters as InstantlySearchFilters, approximations };
}

// ── Filter summary for UX confirmation ──

export function buildFilterSummary(filters: InstantlySearchFilters): string {
  const f = filters as Record<string, unknown>;
  const parts: string[] = [];
  if (Array.isArray(f.job_titles) && f.job_titles.length) {
    parts.push(`Role : ${(f.job_titles as string[]).slice(0, 4).join(", ")}${(f.job_titles as string[]).length > 4 ? "..." : ""}`);
  }
  if (Array.isArray(f.industries) && f.industries.length) {
    parts.push(`Secteur : ${(f.industries as string[]).join(", ")}`);
  }
  if (Array.isArray(f.sub_industries) && f.sub_industries.length) {
    parts.push(`Niche : ${(f.sub_industries as string[]).join(", ")}`);
  }
  if (Array.isArray(f.employee_count) && f.employee_count.length) {
    parts.push(`Taille : ${(f.employee_count as string[]).join(", ")}`);
  }
  if (Array.isArray(f.revenue) && f.revenue.length) {
    parts.push(`CA : ${(f.revenue as string[]).join(", ")}`);
  }
  if (Array.isArray(f.locations) && f.locations.length) {
    parts.push(`Geo : ${(f.locations as string[]).slice(0, 4).join(", ")}${(f.locations as string[]).length > 4 ? "..." : ""}`);
  }
  if (Array.isArray(f.technologies) && f.technologies.length) {
    parts.push(`Tech : ${(f.technologies as string[]).join(", ")}`);
  }
  if (Array.isArray(f.news) && f.news.length) {
    parts.push(`Signaux : ${(f.news as string[]).join(", ")}`);
  }
  if (typeof f.lookalike_domain === "string") {
    parts.push(`Lookalike : ${f.lookalike_domain}`);
  }
  if (typeof f.keyword_filter === "string") {
    parts.push(`Keyword : ${f.keyword_filter}`);
  }
  return parts.join(" | ");
}

// ── Flatten common LLM nesting mistakes in raw intent ──

function flattenRawIntent(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw };

  // Flatten person_targeting / person / targeting wrappers
  for (const wrapper of ["person_targeting", "person", "targeting", "company_targeting", "company"]) {
    const nested = result[wrapper];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
        if (value !== undefined && value !== null && !(key in result)) {
          result[key] = value;
        }
      }
      delete result[wrapper];
    }
    // Also handle array wrappers (person_targeting as array → roles)
    if (Array.isArray(nested) && !result.roles) {
      result.roles = nested;
      delete result[wrapper];
    }
  }

  // Common field name aliases
  if (result.person_targeting && Array.isArray(result.person_targeting) && !result.roles) {
    result.roles = result.person_targeting;
    delete result.person_targeting;
  }
  if (result.targets && Array.isArray(result.targets) && !result.roles) {
    result.roles = result.targets;
    delete result.targets;
  }

  return result;
}

// ── Two-phase parseICP (new entrypoint) ──

export async function parseICPv2(
  description: string,
  workspaceId: string,
): Promise<ParseICPResult> {
  // 0. Pre-LLM check
  const tooShort = checkDescriptionTooShort(description);
  if (tooShort) {
    return {
      filters: { skip_owned_leads: true } as InstantlySearchFilters,
      clarificationNeeded: tooShort,
    };
  }

  // 1. Extract raw intent from LLM (no enums)
  let rawIntent: RawIntent;
  try {
    const raw = await mistralClient.jsonRaw({
      model: "mistral-large-latest",
      system: RAW_INTENT_SYSTEM,
      prompt: `Extract the targeting intent from this ICP description:\n\n${description}`,
      workspaceId,
      action: "icp-parse-v2",
    });

    console.log("[parseICPv2] Raw LLM intent:", JSON.stringify(raw).slice(0, 1000));

    // Flatten common nesting mistakes
    const flattened = flattenRawIntent(raw as Record<string, unknown>);
    console.log("[parseICPv2] After flatten:", JSON.stringify(flattened).slice(0, 1000));

    const parsed = rawIntentSchema.safeParse(flattened);
    if (!parsed.success) {
      // Retry once with Zod error injected
      console.warn("[parseICPv2] Schema validation failed, retrying:", parsed.error.message);
      const retryRaw = await mistralClient.jsonRaw({
        model: "mistral-large-latest",
        system: RAW_INTENT_SYSTEM,
        prompt: `Extract the targeting intent from this ICP description:\n\n${description}\n\nYour previous output had schema errors:\n${parsed.error.message}\n\nFix the errors and output valid JSON.`,
        workspaceId,
        action: "icp-parse-v2-retry",
      });
      const retryParsed = rawIntentSchema.safeParse(retryRaw);
      if (!retryParsed.success) {
        console.warn("[parseICPv2] Retry also failed, falling back to v1:", retryParsed.error.message);
        return parseICP(description, workspaceId);
      }
      rawIntent = retryParsed.data;
    } else {
      rawIntent = parsed.data;
    }
  } catch (err) {
    console.error("[parseICPv2] LLM call failed, falling back to v1:", err);
    return parseICP(description, workspaceId);
  }

  // 2. Deterministic mapping: raw intent → Instantly filters
  const { filters: mapped, approximations } = mapRawIntentToFilters(rawIntent);
  console.log("[parseICPv2] After mapping:", JSON.stringify(mapped).slice(0, 1000));

  // 3. Apply the same safety nets from v1
  const parseWarnings: string[] = [];
  const filters = mapped as unknown as Record<string, unknown>;

  // 3.1 Stock index detection
  const STOCK_INDEX_PATTERNS = /\b(cac\s*40|fortune\s*500|fortune\s*1000|ftse\s*100|dax\s*30|s&p\s*500|sbf\s*120|next\s*40|french\s*tech\s*120|inc\s*5000|nasdaq|dow\s*jones|nikkei|euronext|stoxx)\b/i;
  const hasStockIndex = STOCK_INDEX_PATTERNS.test(description);
  const cn = filters.company_names as { include?: string[] } | undefined;
  const hasLargeCompanyNames = cn?.include && cn.include.length >= 10;
  if ((hasStockIndex || hasLargeCompanyNames) && filters.industries) {
    const descWithoutIndex = description.toLowerCase().replace(STOCK_INDEX_PATTERNS, "");
    const hasExplicitIndustry = [...INDUSTRY_FIXES_LOWER.keys()].some(term => {
      if (term.length < 3) return false;
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return regex.test(descWithoutIndex);
    });
    if (!hasExplicitIndustry) {
      delete filters.industries;
      delete filters.sub_industries;
    }
  }

  // 3.2 Hallucinated location guard
  if (filters.locations && !descriptionMentionsLocation(description)) {
    parseWarnings.push(`Location filter "${JSON.stringify(filters.locations)}" was removed — not found in your description.`);
    delete filters.locations;
    delete filters.location_filter_type;
  }

  // 3.3 Inject missing locations
  if (!filters.locations && descriptionMentionsLocation(description)) {
    const extracted = extractLocationsFromDescription(description);
    if (extracted.length > 0) filters.locations = extracted;
  }

  // 3.4 Infer missing industries
  const inferredIndustries = inferIndustriesFromDescription(description, filters);

  // 3.5 Infer niche sub_industries
  inferSubIndustriesFromDescription(description, filters);

  // 3.6 Strip over-broad employee_count
  const empCount = filters.employee_count as string[] | undefined;
  if (empCount && empCount.length >= 6) {
    delete filters.employee_count;
  }

  // 3.7 Strip negated filters
  stripNegatedFilters(description, filters);

  // 4. Validate with Zod
  const validated = searchFiltersSchema.safeParse(filters);
  let finalFilters: InstantlySearchFilters;
  if (validated.success) {
    if (!hasSubstantiveFilters(validated.data as unknown as Record<string, unknown>)) {
      const rawStripped = { skip_owned_leads: true, ...stripInvalidFields(filters) } as InstantlySearchFilters;
      finalFilters = hasSubstantiveFilters(rawStripped as unknown as Record<string, unknown>) ? rawStripped : validated.data;
    } else {
      finalFilters = validated.data;
    }
  } else {
    console.warn("[parseICPv2] Zod validation failed:", JSON.stringify(validated.error.issues));
    finalFilters = { skip_owned_leads: true, ...stripInvalidFields(filters) } as InstantlySearchFilters;
  }

  // 5. Completeness check
  const insufficientFilters = checkFiltersCompleteness(finalFilters as unknown as Record<string, unknown>);
  if (insufficientFilters) {
    return {
      filters: finalFilters,
      inferredIndustries,
      parseWarnings,
      approximations: approximations.length > 0 ? approximations : undefined,
      clarificationNeeded: insufficientFilters,
    };
  }

  return {
    filters: finalFilters,
    inferredIndustries,
    parseWarnings,
    approximations: approximations.length > 0 ? approximations : undefined,
  };
}
