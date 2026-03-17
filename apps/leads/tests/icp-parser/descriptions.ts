import type { TestCase } from "./types";

/**
 * 100 realistic ICP descriptions — systematic coverage of:
 * - ALL Instantly filters (job_titles, industries, employee_count, revenue, locations,
 *   technologies, news, funding_type, lookalike_domain, keyword_filter, job_listing,
 *   company_names exclude, sub_industries, domains)
 * - Global geography (every continent, tier 2/3 cities, multi-geo, exclusions)
 * - 40 FR / 40 EN / 20 edge cases (vague, ultra-specific, mixed lang, typos, abbreviations)
 * - Wide sector diversity (not Franco-centric)
 *
 * DO NOT regenerate — committed for reproducibility.
 */
export const TEST_CASES: TestCase[] = [
  // ═══════════════════════════════════════════════════════════════════
  // SECTION A: CORE FILTERS — each test stresses a specific filter
  // ═══════════════════════════════════════════════════════════════════

  // ── A1: revenue filter ──
  { id: 1, description: "CFOs at SaaS companies with $10M-50M annual revenue, US and Canada", language: "en", sectorHint: "SaaS revenue targeting" },
  { id: 2, description: "On cherche des VP Sales dans des boites avec un CA supérieur à 100 millions, industrie manufacturière, Allemagne", language: "fr", sectorHint: "manufacturing revenue" },
  { id: 3, description: "Founders of startups with less than $1M revenue, pre-seed or seed, anywhere", language: "en", sectorHint: "early stage revenue" },

  // ── A2: technologies filter ──
  { id: 4, description: "CTOs at companies using Salesforce and HubSpot, 100-500 employees, North America", language: "en", sectorHint: "CRM tech stack" },
  { id: 5, description: "Engineering leads at companies running Kubernetes and AWS, Series B+, global", language: "en", sectorHint: "cloud infrastructure tech" },
  { id: 6, description: "Les DSI de boites qui utilisent SAP, plus de 1000 salariés, Europe", language: "fr", sectorHint: "SAP enterprise" },

  // ── A3: lookalike_domain filter ──
  { id: 7, description: "I need companies similar to Stripe, fintech space, any geo", language: "en", sectorHint: "fintech lookalike" },
  { id: 8, description: "On veut des boites comme HubSpot ou Salesforce, SaaS marketing/sales, US", language: "fr", sectorHint: "SaaS lookalike" },

  // ── A4: news filter ──
  { id: 9, description: "CEOs of companies that recently raised funding, Series A-C, US", language: "en", sectorHint: "recently funded" },
  { id: 10, description: "VP HR at companies that just had layoffs, tech sector, 500+ employees", language: "en", sectorHint: "post-layoffs HR" },
  { id: 11, description: "Directeurs généraux de boites qui viennent de faire une acquisition, Europe", language: "fr", sectorHint: "post-acquisition" },
  { id: 12, description: "Head of Product at companies that launched a new product in the last 6 months, SaaS", language: "en", sectorHint: "product launch" },

  // ── A5: funding_type filter ──
  { id: 13, description: "CTOs at Series B startups in cybersecurity, US and Israel", language: "en", sectorHint: "Series B cyber" },
  { id: 14, description: "Fondateurs de startups en pre-seed/seed dans l'IA, pas de geo", language: "fr", sectorHint: "pre-seed AI" },

  // ── A6: job_listing filter ──
  { id: 15, description: "Companies hiring data engineers right now, I want to reach their VP Engineering, SaaS, US", language: "en", sectorHint: "hiring data engineers" },
  { id: 16, description: "Boites qui recrutent des commerciaux, je veux parler au Head of Sales, France", language: "fr", sectorHint: "hiring sales reps" },

  // ── A7: company_names exclude ──
  { id: 17, description: "Marketing directors at consulting firms, not McKinsey, not BCG, not Bain, not Deloitte, EMEA", language: "en", sectorHint: "consulting excl Big 4" },
  { id: 18, description: "VP Engineering SaaS, exclure Google, Meta, Amazon, Microsoft, Apple — on veut du mid-market", language: "fr", sectorHint: "SaaS excl FAANG" },

  // ── A8: sub_industries precision ──
  { id: 19, description: "Directeurs commerciaux dans le transport routier et la logistique, 200-1000 employés, France", language: "fr", sectorHint: "road transport" },
  { id: 20, description: "VP Sales at insurance companies, specifically P&C insurance, not life, US", language: "en", sectorHint: "P&C insurance" },

  // ═══════════════════════════════════════════════════════════════════
  // SECTION B: GLOBAL GEOGRAPHY — every continent, tier 2/3 cities
  // ═══════════════════════════════════════════════════════════════════

  // ── B1: Asia ──
  { id: 21, description: "CTOs at fintech companies in Singapore, 50-500 employees", language: "en", sectorHint: "Singapore fintech" },
  { id: 22, description: "VP of Engineering at SaaS companies in Bangalore and Hyderabad, India", language: "en", sectorHint: "India tech cities" },
  { id: 23, description: "Country managers at FMCG companies across Japan, South Korea, and Taiwan", language: "en", sectorHint: "East Asia FMCG" },
  { id: 24, description: "Head of Digital at banks in Hong Kong and Shanghai, enterprise level", language: "en", sectorHint: "China banking digital" },

  // ── B2: Middle East & Africa ──
  { id: 25, description: "CEOs of construction companies in UAE and Saudi Arabia, 500+ employees", language: "en", sectorHint: "Gulf construction" },
  { id: 26, description: "IT Directors at telecom operators in Nigeria, Kenya, and South Africa", language: "en", sectorHint: "Africa telecom" },
  { id: 27, description: "Heads of procurement at oil & gas companies, Abu Dhabi and Doha", language: "en", sectorHint: "Gulf oil gas" },

  // ── B3: Latin America ──
  { id: 28, description: "VP Marketing at e-commerce companies in Brazil, São Paulo and Rio", language: "en", sectorHint: "Brazil ecommerce" },
  { id: 29, description: "CTOs de startups fintech en México y Colombia, menos de 200 empleados", language: "fr", sectorHint: "LATAM fintech" },
  { id: 30, description: "General managers at mining companies in Chile and Peru, 1000+ employees", language: "en", sectorHint: "LATAM mining" },

  // ── B4: Oceania ──
  { id: 31, description: "CIOs at healthcare companies in Australia and New Zealand, 500+ staff", language: "en", sectorHint: "ANZ healthcare IT" },

  // ── B5: Multi-geo complex ──
  { id: 32, description: "VP Sales at B2B SaaS, US, UK, Germany, and Australia — no other geos", language: "en", sectorHint: "multi-geo SaaS" },
  { id: 33, description: "Directeurs financiers dans le manufacturing, DACH + Benelux, CA > 50M€", language: "fr", sectorHint: "DACH Benelux manufacturing" },
  { id: 34, description: "Heads of logistics at retail companies across all of Southeast Asia", language: "en", sectorHint: "SEA retail logistics" },

  // ── B6: Tier 2/3 cities ──
  { id: 35, description: "Founders of tech startups in Austin, Denver, and Nashville — not SF or NYC", language: "en", sectorHint: "US tier 2 cities tech" },
  { id: 36, description: "Directeurs d'usine dans l'agroalimentaire, Bretagne et Normandie", language: "fr", sectorHint: "French regions manufacturing" },

  // ═══════════════════════════════════════════════════════════════════
  // SECTION C: WORLDWIDE SECTOR DIVERSITY (not Franco-centric)
  // ═══════════════════════════════════════════════════════════════════

  // ── C1: Manufacturing & heavy industry (global) ──
  { id: 37, description: "Plant managers at semiconductor fabs, TSMC competitors, Asia", language: "en", sectorHint: "semiconductor manufacturing" },
  { id: 38, description: "VP Operations in automotive OEMs, Germany and Japan, 10K+ employees", language: "en", sectorHint: "automotive OEM global" },
  { id: 39, description: "HSE directors at mining companies in Canada, Australia, and South Africa, revenue > $500M", language: "en", sectorHint: "mining HSE global" },

  // ── C2: Financial services (global) ──
  { id: 40, description: "Chief Risk Officers at banks with more than $1B in assets, US and UK", language: "en", sectorHint: "banking risk global" },
  { id: 41, description: "Heads of wealth management technology at private banks, Switzerland and Luxembourg", language: "en", sectorHint: "Swiss private banking" },
  { id: 42, description: "VP of Compliance at crypto exchanges and DeFi companies, any jurisdiction", language: "en", sectorHint: "crypto compliance" },

  // ── C3: Healthcare (global) ──
  { id: 43, description: "Medical directors at hospital chains in India, 500+ beds, using Epic or Cerner", language: "en", sectorHint: "India hospital tech" },
  { id: 44, description: "VP Clinical Operations at CROs running Phase II/III trials, US and EU", language: "en", sectorHint: "CRO clinical ops" },

  // ── C4: Tech (global) ──
  { id: 45, description: "Head of AI at companies using Databricks and Snowflake, that recently raised funding, 100-1000 employees", language: "en", sectorHint: "AI data platforms funded" },
  { id: 46, description: "VP Sales at developer tools companies, companies like Datadog or PagerDuty, US and Europe", language: "en", sectorHint: "devtools sales global" },
  { id: 47, description: "Directores de ingeniería en empresas SaaS B2B in Latin America, 50-500 employees", language: "en", sectorHint: "LATAM SaaS eng" },

  // ── C5: Government & public sector ──
  { id: 48, description: "IT directors at government agencies, federal level, US and Canada", language: "en", sectorHint: "government IT" },
  { id: 49, description: "Directeurs de la transition numérique dans les collectivités territoriales françaises de plus de 100k habitants", language: "fr", sectorHint: "French govt digital" },

  // ── C6: Non-profit ──
  { id: 50, description: "Program directors at international NGOs, headquarters in Geneva, Nairobi, or New York", language: "en", sectorHint: "NGO programs global" },

  // ── C7: Media & entertainment ──
  { id: 51, description: "VP Content at streaming platforms and media companies, US, 500+ employees", language: "en", sectorHint: "streaming content" },
  { id: 52, description: "Directeurs marketing dans le gaming / jeux vidéo, France, Canada, Japon", language: "fr", sectorHint: "gaming marketing global" },

  // ── C8: Real estate ──
  { id: 53, description: "Heads of proptech at commercial real estate firms, US and UK, using Yardi or MRI Software", language: "en", sectorHint: "commercial RE proptech" },

  // ── C9: Travel & hospitality ──
  { id: 54, description: "Revenue managers at hotel chains, 200+ properties, Middle East and Asia Pacific", language: "en", sectorHint: "hotel revenue APAC" },
  { id: 55, description: "GMs of luxury resorts, 5-star, Maldives, Bali, and Seychelles", language: "en", sectorHint: "luxury resort" },

  // ── C10: Agriculture ──
  { id: 56, description: "CEOs of agritech startups, precision farming, US, Brazil, and India", language: "en", sectorHint: "agritech global" },

  // ── C11: Telecom ──
  { id: 57, description: "CTOs at mobile operators in Sub-Saharan Africa, 5M+ subscribers", language: "en", sectorHint: "Africa mobile operators" },

  // ── C12: Defense ──
  { id: 58, description: "VP Business Development at defense contractors, US only, revenue > $100M", language: "en", sectorHint: "US defense" },

  // ── C13: Maritime ──
  { id: 59, description: "Fleet managers at container shipping companies, global, 50+ vessels", language: "en", sectorHint: "container shipping" },

  // ── C14: Aerospace ──
  { id: 60, description: "Head of supply chain at aerospace manufacturers, Toulouse, Seattle, and Wichita", language: "en", sectorHint: "aerospace supply chain" },

  // ═══════════════════════════════════════════════════════════════════
  // SECTION D: MULTI-FILTER COMBOS — stacking 3+ filters
  // ═══════════════════════════════════════════════════════════════════

  { id: 61, description: "VP Marketing at Series B+ SaaS companies using HubSpot, 100-500 employees, US, that recently raised funding", language: "en", sectorHint: "multi-filter SaaS marketing" },
  { id: 62, description: "CTOs at healthcare companies, $50M-500M revenue, using AWS, that had a recent leadership change, US and UK", language: "en", sectorHint: "multi-filter healthcare CTO" },
  { id: 63, description: "Head of Sales dans les fintech Series A-B, qui recrutent des commerciaux, France et Allemagne, 25-100 employés", language: "fr", sectorHint: "multi-filter fintech sales" },
  { id: 64, description: "Founders of cleantech companies, seed funding, using Salesforce, that had a product launch, US West Coast", language: "en", sectorHint: "multi-filter cleantech" },
  { id: 65, description: "Procurement directors at manufacturing companies, $100M+ revenue, hiring supply chain roles, Germany and Poland, not automotive", language: "en", sectorHint: "multi-filter procurement" },

  // ═══════════════════════════════════════════════════════════════════
  // SECTION E: FRENCH DIVERSITY (not just France-based)
  // ═══════════════════════════════════════════════════════════════════

  { id: 66, description: "On cible les DRH de groupes hôteliers au Maroc et en Tunisie, 500+ employés", language: "fr", sectorHint: "Maghreb hospitality HR" },
  { id: 67, description: "VP Ventes dans les boites SaaS canadiennes, Montréal et Toronto, 50-200 personnes", language: "fr", sectorHint: "Canada SaaS sales" },
  { id: 68, description: "Directeurs logistique dans le retail, Afrique de l'Ouest, Nigeria et Côte d'Ivoire", language: "fr", sectorHint: "West Africa retail logistics" },
  { id: 69, description: "Responsables achats dans la chimie fine, Suisse et Allemagne, entreprises > 500 salariés, qui utilisent SAP", language: "fr", sectorHint: "Swiss German chemistry" },
  { id: 70, description: "CTO de fintechs au Moyen-Orient, Dubai et Riyadh, série A+", language: "fr", sectorHint: "Middle East fintech" },
  { id: 71, description: "Les directeurs de la supply chain dans l'automobile, Japon et Corée du Sud, grands groupes", language: "fr", sectorHint: "Japan Korea auto SC" },
  { id: 72, description: "Responsables RSE dans le secteur minier en Afrique, RDC, Zambie, Ghana", language: "fr", sectorHint: "Africa mining CSR" },
  { id: 73, description: "VP Marketing dans le e-commerce, Inde et Asie du Sud-Est, boites en croissance qui viennent de lever", language: "fr", sectorHint: "India SEA ecommerce" },
  { id: 74, description: "Directeurs R&D pharma, entreprises cotées, Europe et US, CA > 1 milliard", language: "fr", sectorHint: "pharma R&D global" },
  { id: 75, description: "Les fondateurs de startups edtech en Amérique latine, Brésil, Mexique, Argentine", language: "fr", sectorHint: "LATAM edtech" },

  // ═══════════════════════════════════════════════════════════════════
  // SECTION F: EDGE CASES — vague, ultra-specific, mixed lang, typos
  // ═══════════════════════════════════════════════════════════════════

  // ── F1: Very vague descriptions ──
  { id: 76, description: "I need leads in tech", language: "en", sectorHint: "vague tech" },
  { id: 77, description: "Des décideurs dans la santé", language: "fr", sectorHint: "vague healthcare" },
  { id: 78, description: "Sales people", language: "en", sectorHint: "vague role only" },

  // ── F2: Ultra-specific / overloaded ──
  { id: 79, description: "I'm looking for VP of Revenue Operations at B2B SaaS companies using Salesforce, HubSpot and Outreach, Series C+, 200-1000 employees, US West Coast only (SF Bay Area, LA, Seattle, Portland), that recently had a leadership change, revenue $50M-250M, not in healthcare or fintech, actively hiring SDRs", language: "en", sectorHint: "ultra-specific RevOps" },
  { id: 80, description: "Le Head of Growth de boites e-commerce DTC mode/beauté en France qui utilisent Shopify et Klaviyo, moins de 50 personnes, qui ont levé récemment, CA entre 1 et 10M€, pas les marques de luxe", language: "fr", sectorHint: "ultra-specific DTC growth" },

  // ── F3: Mixed language / Spanglish / Franglais ──
  { id: 81, description: "On cherche des C-level dans des startups SaaS, seed to Series A, anywhere in Europe, qui utilisent AWS", language: "fr", sectorHint: "franglais SaaS" },
  { id: 82, description: "Busco directores de marketing en empresas de software, 100-500 empleados, Spain and Portugal", language: "en", sectorHint: "Spanish mixed lang" },
  { id: 83, description: "VP Sales bei SaaS Unternehmen, 50-200 Mitarbeiter, DACH region", language: "en", sectorHint: "German mixed lang" },

  // ── F4: Typos and abbreviations ──
  { id: 84, description: "CTO de boites en cybersecu, 50-500 ppl, US et Israel", language: "fr", sectorHint: "typo cybersecurity" },
  { id: 85, description: "VP mktg at saas co's, 100-500 emps, US", language: "en", sectorHint: "abbreviations SaaS" },
  { id: 86, description: "Head of biz dev at fintch companies in the UK, series B+", language: "en", sectorHint: "typo fintech" },

  // ── F5: Implicit/ambiguous filters ──
  { id: 87, description: "Decision makers at enterprise companies", language: "en", sectorHint: "ambiguous enterprise" },
  { id: 88, description: "Les patrons de grosses boites industrielles", language: "fr", sectorHint: "ambiguous industrial" },
  { id: 89, description: "Anyone in charge of buying software at mid-market companies in Europe", language: "en", sectorHint: "ambiguous software buyer" },

  // ── F6: Negation / exclusion heavy ──
  { id: 90, description: "CTOs at SaaS companies, NOT in healthcare, NOT in fintech, NOT in edtech, US only, 100-500 employees", language: "en", sectorHint: "exclusion heavy SaaS" },
  { id: 91, description: "VP Sales dans le conseil, pas McKinsey, pas BCG, pas Bain, pas les Big 4, France et UK", language: "fr", sectorHint: "exclusion consulting" },

  // ── F7: Role-less descriptions (company targeting only) ──
  { id: 92, description: "Fintech companies in London that recently raised Series A, using Stripe", language: "en", sectorHint: "company-only fintech" },
  { id: 93, description: "Startups IA à Paris qui recrutent des devs, moins de 50 personnes", language: "fr", sectorHint: "company-only AI Paris" },

  // ── F8: Revenue in non-USD ──
  { id: 94, description: "VP Finance at manufacturing companies in Germany, Umsatz über 50 Mio EUR", language: "en", sectorHint: "EUR revenue German" },
  { id: 95, description: "Les DAF de boites industrielles avec un chiffre d'affaires de 10 à 50 millions d'euros, France", language: "fr", sectorHint: "EUR revenue French" },

  // ── F9: Stock index / cross-sector ──
  { id: 96, description: "L&D directors at Fortune 500 companies, any industry, US", language: "en", sectorHint: "Fortune 500 L&D" },
  { id: 97, description: "Responsables formation continue dans les entreprises du CAC 40", language: "fr", sectorHint: "CAC 40 training" },

  // ── F10: Domains filter ──
  { id: 98, description: "I want to reach the CTO at shopify.com, stripe.com, and twilio.com specifically", language: "en", sectorHint: "specific domains" },

  // ── F11: Multi-role targeting ──
  { id: 99, description: "Both the CTO and VP Engineering at B2B SaaS companies, 50-200 employees, US and Europe", language: "en", sectorHint: "multi-role SaaS" },
  { id: 100, description: "Je veux toucher le CEO ou le DG et le DAF des PME industrielles en France, 50-500 salariés", language: "fr", sectorHint: "multi-role industrial" },
];
