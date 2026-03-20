/**
 * Seed Demo Data for LeadSens
 *
 * Populates the workspace with realistic demo data:
 * - TAM result on workspace
 * - 50 leads with varied ICP scores + breakdowns
 * - 3 active campaigns with analyticsCache
 * - 10 reply threads with replies
 *
 * Run: cd apps/leads && node ../../scripts/seed-demo-data.mjs
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appsLeadsDir = resolve(__dirname, "..", "apps", "leads");

// createRequire from apps/leads so it finds @prisma/client in that node_modules
const require = createRequire(resolve(appsLeadsDir, "package.json"));

// Load env from apps/leads/.env
process.loadEnvFile(resolve(appsLeadsDir, ".env"));

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const WORKSPACE_ID = "cmm8f2796008cid2ca9zosgje";

// ─── Lead Templates ──────────────────────────────────────

const LEAD_TEMPLATES = [
  // Tier A (5 leads, score 9-10)
  { firstName: "Sarah", lastName: "Chen", email: "sarah.chen@acmesaas.io", company: "Acme SaaS", jobTitle: "VP Sales", linkedinUrl: "https://linkedin.com/in/sarahchen", country: "US", industry: "SaaS", companySize: "120", website: "https://acmesaas.io" },
  { firstName: "Marcus", lastName: "Williams", email: "marcus.w@growthlabs.com", company: "GrowthLabs", jobTitle: "Head of Growth", linkedinUrl: "https://linkedin.com/in/marcusw", country: "US", industry: "Marketing Technology", companySize: "85", website: "https://growthlabs.com" },
  { firstName: "Priya", lastName: "Patel", email: "priya@revenuestack.io", company: "RevenueStack", jobTitle: "CRO", linkedinUrl: "https://linkedin.com/in/priyapatel", country: "US", industry: "Sales Enablement", companySize: "200", website: "https://revenuestack.io" },
  { firstName: "James", lastName: "Morrison", email: "james.m@closefaster.co", company: "CloseFaster", jobTitle: "VP Sales", linkedinUrl: "https://linkedin.com/in/jamesmorrison", country: "UK", industry: "SaaS", companySize: "150", website: "https://closefaster.co" },
  { firstName: "Elena", lastName: "Volkov", email: "elena@pipelinepro.eu", company: "PipelinePro", jobTitle: "Head of Growth", linkedinUrl: "https://linkedin.com/in/elenavolkov", country: "DE", industry: "CRM", companySize: "95", website: "https://pipelinepro.eu" },

  // Tier B (8 leads, score 7-8)
  { firstName: "David", lastName: "Kim", email: "david.kim@techbridge.io", company: "TechBridge", jobTitle: "VP Sales", linkedinUrl: "https://linkedin.com/in/davidkim", country: "US", industry: "DevTools", companySize: "45", website: "https://techbridge.io" },
  { firstName: "Laura", lastName: "Bennett", email: "laura@scaleup.ai", company: "ScaleUp AI", jobTitle: "Head of Revenue", linkedinUrl: "https://linkedin.com/in/laurabennett", country: "US", industry: "AI/ML", companySize: "60", website: "https://scaleup.ai" },
  { firstName: "Thomas", lastName: "Dubois", email: "t.dubois@finleap.fr", company: "FinLeap", jobTitle: "CRO", linkedinUrl: "https://linkedin.com/in/thomasdubois", country: "FR", industry: "FinTech", companySize: "110", website: "https://finleap.fr" },
  { firstName: "Aisha", lastName: "Rahman", email: "aisha@cloudnine.co.uk", company: "CloudNine", jobTitle: "VP Business Development", linkedinUrl: "https://linkedin.com/in/aisharahman", country: "UK", industry: "Cloud Infrastructure", companySize: "75", website: "https://cloudnine.co.uk" },
  { firstName: "Carlos", lastName: "Mendez", email: "carlos@dataflow.mx", company: "DataFlow", jobTitle: "Head of Growth", linkedinUrl: "https://linkedin.com/in/carlosmendez", country: "US", industry: "Data Analytics", companySize: "55", website: "https://dataflow.mx" },
  { firstName: "Hannah", lastName: "Berg", email: "hannah@nordicops.se", company: "NordicOps", jobTitle: "VP Sales", linkedinUrl: "https://linkedin.com/in/hannahberg", country: "SE", industry: "Operations", companySize: "90", website: "https://nordicops.se" },
  { firstName: "Ryan", lastName: "Cooper", email: "ryan@sellwise.com", company: "SellWise", jobTitle: "Director of Sales", linkedinUrl: "https://linkedin.com/in/ryancooper", country: "US", industry: "Sales Intelligence", companySize: "130", website: "https://sellwise.com" },
  { firstName: "Mei", lastName: "Lin", email: "mei.lin@paybridge.sg", company: "PayBridge", jobTitle: "Head of Partnerships", linkedinUrl: "https://linkedin.com/in/meilin", country: "SG", industry: "FinTech", companySize: "70", website: "https://paybridge.sg" },

  // Tier C (12 leads, score 5-6)
  { firstName: "Alex", lastName: "Turner", email: "alex@startupify.io", company: "Startupify", jobTitle: "CEO", linkedinUrl: "https://linkedin.com/in/alexturner", country: "US", industry: "SaaS", companySize: "12", website: "https://startupify.io" },
  { firstName: "Sophie", lastName: "Martin", email: "sophie@digitalcraft.fr", company: "DigitalCraft", jobTitle: "Marketing Director", linkedinUrl: "https://linkedin.com/in/sophiemartin", country: "FR", industry: "Digital Agency", companySize: "25", website: "https://digitalcraft.fr" },
  { firstName: "Oliver", lastName: "Smith", email: "oliver@buildfast.dev", company: "BuildFast", jobTitle: "CTO", linkedinUrl: "https://linkedin.com/in/oliversmith", country: "UK", industry: "DevTools", companySize: "18", website: "https://buildfast.dev" },
  { firstName: "Nina", lastName: "Kozlov", email: "nina@smarthr.de", company: "SmartHR", jobTitle: "VP People", linkedinUrl: "https://linkedin.com/in/ninakozlov", country: "DE", industry: "HR Tech", companySize: "40", website: "https://smarthr.de" },
  { firstName: "Daniel", lastName: "Ross", email: "daniel@insightcrm.com", company: "InsightCRM", jobTitle: "Account Executive", linkedinUrl: "https://linkedin.com/in/danielross", country: "US", industry: "CRM", companySize: "65", website: "https://insightcrm.com" },
  { firstName: "Yuki", lastName: "Tanaka", email: "yuki@tokiodata.jp", company: "TokioData", jobTitle: "Sales Manager", linkedinUrl: "https://linkedin.com/in/yukitanaka", country: "JP", industry: "Data", companySize: "35", website: "https://tokiodata.jp" },
  { firstName: "Isabella", lastName: "Rossi", email: "isabella@nextstep.it", company: "NextStep", jobTitle: "Growth Lead", linkedinUrl: "https://linkedin.com/in/isabellarossi", country: "IT", industry: "Consulting", companySize: "50", website: "https://nextstep.it" },
  { firstName: "Jake", lastName: "Anderson", email: "jake@rapidscale.co", company: "RapidScale", jobTitle: "SDR Manager", linkedinUrl: "https://linkedin.com/in/jakeanderson", country: "US", industry: "Cloud", companySize: "80", website: "https://rapidscale.co" },
  { firstName: "Emma", lastName: "Clarke", email: "emma@brightspark.co.uk", company: "BrightSpark", jobTitle: "Head of Marketing", linkedinUrl: "https://linkedin.com/in/emmaclarke", country: "UK", industry: "EdTech", companySize: "30", website: "https://brightspark.co.uk" },
  { firstName: "Luis", lastName: "Garcia", email: "luis@crecimiento.es", company: "Crecimiento", jobTitle: "Director Comercial", linkedinUrl: "https://linkedin.com/in/luisgarcia", country: "ES", industry: "SaaS", companySize: "22", website: "https://crecimiento.es" },
  { firstName: "Anna", lastName: "Novak", email: "anna@praguetek.cz", company: "PragueTek", jobTitle: "VP Operations", linkedinUrl: "https://linkedin.com/in/annanovak", country: "CZ", industry: "IT Services", companySize: "45", website: "https://praguetek.cz" },
  { firstName: "Ben", lastName: "Taylor", email: "ben@outreachly.io", company: "Outreachly", jobTitle: "Founder", linkedinUrl: "https://linkedin.com/in/bentaylor", country: "US", industry: "Sales Automation", companySize: "8", website: "https://outreachly.io" },

  // Tier D (25 leads, score 0-4 or null)
  { firstName: "Kevin", lastName: "Nguyen", email: "kevin@webdesignco.com", company: "WebDesignCo", jobTitle: "Junior Developer", linkedinUrl: "https://linkedin.com/in/kevinnguyen", country: "US", industry: "Web Design", companySize: "5", website: "https://webdesignco.com" },
  { firstName: "Rachel", lastName: "Green", email: "rachel@retailhub.com", company: "RetailHub", jobTitle: "Store Manager", linkedinUrl: "https://linkedin.com/in/rachelgreen", country: "US", industry: "Retail", companySize: "500", website: "https://retailhub.com" },
  { firstName: "Ahmed", lastName: "Hassan", email: "ahmed@logisticsnow.ae", company: "LogisticsNow", jobTitle: "Operations Coordinator", linkedinUrl: "https://linkedin.com/in/ahmedhassan", country: "AE", industry: "Logistics", companySize: "300", website: "https://logisticsnow.ae" },
  { firstName: "Chloe", lastName: "Brown", email: "chloe@foodchain.co", company: "FoodChain", jobTitle: "Content Writer", linkedinUrl: "https://linkedin.com/in/chloebrown", country: "UK", industry: "Food & Beverage", companySize: "15", website: "https://foodchain.co" },
  { firstName: "Max", lastName: "Schneider", email: "max@bautech.de", company: "BauTech", jobTitle: "Project Manager", linkedinUrl: "https://linkedin.com/in/maxschneider", country: "DE", industry: "Construction", companySize: "250", website: "https://bautech.de" },
  { firstName: "Olivia", lastName: "Johnson", email: "olivia@healthfirst.com", company: "HealthFirst", jobTitle: "HR Coordinator", linkedinUrl: "https://linkedin.com/in/oliviajohnson", country: "US", industry: "Healthcare", companySize: "1000", website: "https://healthfirst.com" },
  { firstName: "Tom", lastName: "Wilson", email: "tom@autoparts.co.uk", company: "AutoParts UK", jobTitle: "Warehouse Supervisor", linkedinUrl: "https://linkedin.com/in/tomwilson", country: "UK", industry: "Automotive", companySize: "80", website: "https://autoparts.co.uk" },
  { firstName: "Fatima", lastName: "Ali", email: "fatima@mediahub.pk", company: "MediaHub", jobTitle: "Social Media Manager", linkedinUrl: "https://linkedin.com/in/fatimaali", country: "PK", industry: "Media", companySize: "20", website: "https://mediahub.pk" },
  { firstName: "Chris", lastName: "Evans", email: "chris@sportzgear.com", company: "SportzGear", jobTitle: "E-commerce Manager", linkedinUrl: "https://linkedin.com/in/chrisevans", country: "US", industry: "E-commerce", companySize: "35", website: "https://sportzgear.com" },
  { firstName: "Maria", lastName: "Santos", email: "maria@consultabr.com.br", company: "ConsultaBR", jobTitle: "Analyst", linkedinUrl: "https://linkedin.com/in/mariasantos", country: "BR", industry: "Consulting", companySize: "60", website: "https://consultabr.com.br" },
  { firstName: "Peter", lastName: "Muller", email: "peter@greenenergie.de", company: "GreenEnergie", jobTitle: "Sustainability Officer", linkedinUrl: "https://linkedin.com/in/petermuller", country: "DE", industry: "Energy", companySize: "150", website: "https://greenenergie.de" },
  { firstName: "Jessica", lastName: "Lee", email: "jessica@fashionista.co", company: "Fashionista", jobTitle: "Buyer", linkedinUrl: "https://linkedin.com/in/jessicalee", country: "US", industry: "Fashion", companySize: "10", website: "https://fashionista.co" },
  { firstName: "Arjun", lastName: "Sharma", email: "arjun@techsupport.in", company: "TechSupport India", jobTitle: "Team Lead", linkedinUrl: "https://linkedin.com/in/arjunsharma", country: "IN", industry: "IT Support", companySize: "200", website: "https://techsupport.in" },
  { firstName: "Lena", lastName: "Johansson", email: "lena@cleantech.se", company: "CleanTech Nordic", jobTitle: "Research Scientist", linkedinUrl: "https://linkedin.com/in/lenajohansson", country: "SE", industry: "CleanTech", companySize: "40", website: "https://cleantech.se" },
  { firstName: "Mike", lastName: "OBrien", email: "mike@pubgroup.ie", company: "PubGroup", jobTitle: "General Manager", linkedinUrl: "https://linkedin.com/in/mikeobrien", country: "IE", industry: "Hospitality", companySize: "25", website: "https://pubgroup.ie" },
  { firstName: "Zara", lastName: "Khan", email: "zara@edulearn.com", company: "EduLearn", jobTitle: "Curriculum Designer", linkedinUrl: "https://linkedin.com/in/zarakhan", country: "UK", industry: "Education", companySize: "30", website: "https://edulearn.com" },
  { firstName: "Robert", lastName: "Davis", email: "robert@buildrite.com", company: "BuildRite", jobTitle: "Site Foreman", linkedinUrl: "https://linkedin.com/in/robertdavis", country: "US", industry: "Construction", companySize: "100", website: "https://buildrite.com" },
  { firstName: "Chen", lastName: "Wei", email: "chen.wei@huaxin.cn", company: "HuaXin Tech", jobTitle: "Engineer", linkedinUrl: "https://linkedin.com/in/chenwei", country: "CN", industry: "Manufacturing", companySize: "500", website: "https://huaxin.cn" },
  { firstName: "Paula", lastName: "Fischer", email: "paula@reisezeit.at", company: "ReiseZeit", jobTitle: "Travel Consultant", linkedinUrl: "https://linkedin.com/in/paulafischer", country: "AT", industry: "Travel", companySize: "15", website: "https://reisezeit.at" },
  { firstName: "Sam", lastName: "White", email: "sam@petcare.co.nz", company: "PetCare NZ", jobTitle: "Veterinarian", linkedinUrl: "https://linkedin.com/in/samwhite", country: "NZ", industry: "Pet Care", companySize: "8", website: "https://petcare.co.nz" },
  { firstName: "Diana", lastName: "Costa", email: "diana@printshop.pt", company: "PrintShop", jobTitle: "Production Manager", linkedinUrl: "https://linkedin.com/in/dianacosta", country: "PT", industry: "Printing", companySize: "20", website: "https://printshop.pt" },
  { firstName: "Paul", lastName: "Lambert", email: "paul@agritech.fr", company: "AgriTech FR", jobTitle: "Field Technician", linkedinUrl: "https://linkedin.com/in/paullambert", country: "FR", industry: "Agriculture", companySize: "50", website: "https://agritech.fr" },
  { firstName: "Lisa", lastName: "Murphy", email: "lisa@fitnessfirst.ie", company: "FitnessFirst", jobTitle: "Trainer", linkedinUrl: "https://linkedin.com/in/lisamurphy", country: "IE", industry: "Fitness", companySize: "12", website: "https://fitnessfirst.ie" },
  { firstName: "George", lastName: "Papadopoulos", email: "george@oliveoil.gr", company: "OliveOil Co", jobTitle: "Export Manager", linkedinUrl: "https://linkedin.com/in/georgepapadopoulos", country: "GR", industry: "Food", companySize: "30", website: "https://oliveoil.gr" },
  { firstName: "Amy", lastName: "Young", email: "amy@artgallery.com", company: "ArtGallery", jobTitle: "Curator", linkedinUrl: "https://linkedin.com/in/amyyoung", country: "US", industry: "Arts", companySize: "5", website: "https://artgallery.com" },
];

// ─── ICP Breakdown Generators ────────────────────────────

const SIGNAL_TEMPLATES = [
  { name: "Hiring Outbound", evidence: "3 open SDR positions", reasoning: "Actively building outbound team" },
  { name: "Sales-Led Growth", evidence: "VP Sales reports to CEO", reasoning: "Sales-led org structure" },
  { name: "Tech Stack Fit", evidence: "Uses HubSpot CRM", reasoning: "Compatible CRM integration" },
  { name: "Recent Funding", evidence: "Series B $15M (2 months ago)", reasoning: "Fresh capital for growth" },
  { name: "New in Role", evidence: "Started VP Sales 3 months ago", reasoning: "New leaders drive change" },
  { name: "Revenue Growth", evidence: "+40% ARR YoY", reasoning: "Growing fast, needs scale" },
  { name: "International Expansion", evidence: "Opened London office", reasoning: "Expanding outbound reach" },
  { name: "Product Launch", evidence: "Launched enterprise tier", reasoning: "Moving upmarket" },
];

function makeBreakdown(score, lead) {
  const signalCount = score >= 9 ? 4 : score >= 7 ? 2 : score >= 5 ? 1 : 0;
  const signals = SIGNAL_TEMPLATES.map((s, i) => ({
    name: s.name,
    detected: i < signalCount,
    evidence: i < signalCount ? s.evidence : "",
    reasoning: i < signalCount ? s.reasoning : "",
    sources: [],
    points: i < signalCount ? 2 : 0,
  }));

  const tier = score >= 9 ? "A" : score >= 7 ? "B" : score >= 5 ? "C" : "D";
  const tierLabels = { A: "Strong ICP fit", B: "Good ICP fit", C: "Moderate ICP fit", D: "Low ICP fit" };

  return {
    tierReasons: [
      `${tierLabels[tier]}: ${lead.jobTitle} at B2B ${lead.industry}`,
      `Company size in ${score >= 7 ? "sweet spot" : "range"} (${lead.companySize} employees)`,
    ],
    heatReasons: signals.filter((s) => s.detected).map((s) => s.evidence),
    actionPhrase: `${tier === "A" ? "Priority" : tier === "B" ? "Strong" : "Consider"} outreach to ${lead.firstName}`,
    whyThisLead: `Score ${score}/10 — ${lead.jobTitle} at ${lead.company}, a ${lead.companySize}-person ${lead.industry} company.${signalCount > 0 ? ` ${signals.filter((s) => s.detected).map((s) => s.evidence).join(". ")}.` : ""}`,
    signals,
  };
}

function makeEnrichmentData(lead) {
  return {
    domain: lead.website.replace("https://", ""),
    companyDescription: `${lead.company} is a ${lead.industry} company with ${lead.companySize} employees.`,
    technologies: ["HubSpot", "Slack", "Google Workspace"].slice(0, Math.floor(Math.random() * 3) + 1),
    linkedinSummary: `${lead.firstName} ${lead.lastName} is ${lead.jobTitle} at ${lead.company}.`,
  };
}

// Prisma uses DbNull for JSON null
const JsonNull = { __prisma_null: true };

// ─── Main Seed Function ──────────────────────────────────

async function seed() {
  console.log("Seeding demo data for workspace:", WORKSPACE_ID);

  // 1. Update workspace tamResult
  console.log("\n1. Setting TAM result...");
  const tamResult = {
    icp: { roles: [{ title: "VP Sales" }, { title: "Head of Growth" }, { title: "CRO" }] },
    counts: {
      total: 14247,
      byRole: [
        { role: "VP Sales", count: 4200 },
        { role: "Head of Growth", count: 3800 },
        { role: "CRO", count: 6247 },
      ],
      byGeo: [
        { region: "US", count: 8400 },
        { region: "UK", count: 2100 },
        { region: "EU", count: 3747 },
      ],
    },
    leads: [],
    burningEstimate: 435,
    roles: ["VP Sales", "Head of Growth", "CRO"],
  };

  await prisma.$executeRawUnsafe(
    `UPDATE "workspace" SET "tamResult" = $1::jsonb, "tamBuiltAt" = NOW() WHERE "id" = $2`,
    JSON.stringify(tamResult),
    WORKSPACE_ID,
  );
  console.log("   TAM result set (14,247 accounts, ~435 burning)");

  // 2. Create leads
  console.log("\n2. Creating 50 leads...");

  const scores = [
    10, 9, 10, 9, 9,
    8, 8, 7, 7, 8, 7, 8, 7,
    6, 6, 5, 5, 6, 5, 6, 5, 6, 5, 5, 6,
    null, null, 3, null, 2, null, 4, null, 1, null,
    null, 3, null, 2, null, null, 4, null, 1, null,
    null, null, 3, null, null,
  ];

  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push(i < 3 ? "ENRICHED" : "PUSHED");
  for (let i = 0; i < 8; i++) statuses.push(i < 4 ? "ENRICHED" : "SCORED");
  for (let i = 0; i < 12; i++) statuses.push(i < 6 ? "SCORED" : "SOURCED");
  for (let i = 0; i < 25; i++) statuses.push("SOURCED");

  const leadIds = [];
  for (let i = 0; i < LEAD_TEMPLATES.length; i++) {
    const t = LEAD_TEMPLATES[i];
    const score = scores[i];
    const status = statuses[i];

    const lead = await prisma.lead.create({
      data: {
        workspaceId: WORKSPACE_ID,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        company: t.company,
        jobTitle: t.jobTitle,
        linkedinUrl: t.linkedinUrl,
        country: t.country,
        industry: t.industry,
        companySize: t.companySize,
        website: t.website,
        companyDomain: t.website.replace("https://", ""),
        icpScore: score,
        icpBreakdown: score != null ? makeBreakdown(score, t) : undefined,
        enrichmentData: score != null && score >= 5 ? makeEnrichmentData(t) : undefined,
        enrichedAt: score != null && score >= 5 ? new Date() : null,
        status,
      },
    });
    leadIds.push(lead.id);
  }

  const tierA = leadIds.slice(0, 5);
  const tierB = leadIds.slice(5, 13);
  console.log("   Created 50 leads (5 Tier A, 8 Tier B, 12 Tier C, 25 Tier D)");

  // 3. Create campaigns
  console.log("\n3. Creating 3 campaigns...");

  const campaign1 = await prisma.campaign.create({
    data: {
      workspaceId: WORKSPACE_ID,
      name: "SaaS VP Sales \u2014 US",
      status: "ACTIVE",
      icpDescription: "VP Sales and Heads of Growth at B2B SaaS companies in the US, 50-500 employees",
      icpFilters: { roles: ["VP Sales", "Head of Growth"], geography: ["US"], companySize: "50-500", industry: "SaaS" },
      leadsTotal: 150,
      leadsScored: 120,
      leadsEnriched: 95,
      leadsDrafted: 93,
      leadsPushed: 93,
      espCampaignId: "demo-camp-001",
      analyticsCache: { sent: 93, opened: 56, replied: 7, bounced: 3, meetings: 2 },
      lastSyncedAt: new Date(),
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      workspaceId: WORKSPACE_ID,
      name: "FinTech Growth \u2014 UK",
      status: "ACTIVE",
      icpDescription: "CROs and Growth leads at FinTech companies in the UK",
      icpFilters: { roles: ["CRO", "Head of Growth"], geography: ["UK"], industry: "FinTech" },
      leadsTotal: 80,
      leadsScored: 60,
      leadsEnriched: 40,
      leadsDrafted: 24,
      leadsPushed: 24,
      espCampaignId: "demo-camp-002",
      analyticsCache: { sent: 24, opened: 11, replied: 1, bounced: 2 },
      lastSyncedAt: new Date(),
    },
  });

  const campaign3 = await prisma.campaign.create({
    data: {
      workspaceId: WORKSPACE_ID,
      name: "DevTools CROs \u2014 EU",
      status: "ACTIVE",
      icpDescription: "CROs and VP Sales at DevTools companies across Europe",
      icpFilters: { roles: ["CRO", "VP Sales"], geography: ["EU", "UK", "DE", "FR"], industry: "DevTools" },
      leadsTotal: 200,
      leadsScored: 180,
      leadsEnriched: 160,
      leadsDrafted: 200,
      leadsPushed: 200,
      espCampaignId: "demo-camp-003",
      analyticsCache: { sent: 200, opened: 140, replied: 14, bounced: 12, meetings: 4 },
      lastSyncedAt: new Date(),
    },
  });

  console.log(`   Created 3 campaigns: ${campaign1.name}, ${campaign2.name}, ${campaign3.name}`);

  // Assign Tier A + some Tier B leads to Campaign 1
  const assignIds = [...tierA, ...tierB.slice(0, 3)];
  await prisma.lead.updateMany({
    where: { id: { in: assignIds } },
    data: { campaignId: campaign1.id, status: "PUSHED" },
  });
  console.log(`   Assigned ${assignIds.length} leads to "${campaign1.name}"`);

  // 4. Create reply threads + replies
  console.log("\n4. Creating reply threads and replies...");

  // 4 INTERESTED threads
  const interestedReplies = [
    { body: "Hi, this sounds really interesting. We've been looking for something like this. Can you share a case study from a similar company?", subject: "Re: Quick question about your outbound" },
    { body: "Thanks for reaching out! We're actually evaluating solutions right now. Would love to hop on a call next week.", subject: "Re: Growth at scale" },
    { body: "I've been thinking about this exact problem. We're spending too much time on manual outreach. When can we chat?", subject: "Re: Outbound automation for SaaS" },
    { body: "Very timely. We just got budget approved for a tool like this. Can you send over pricing?", subject: "Re: Outbound at CloseFaster" },
  ];

  for (let i = 0; i < 4; i++) {
    const leadId = tierA[i];
    const t = LEAD_TEMPLATES[i];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId,
        campaignId: campaign1.id,
        subject: interestedReplies[i].subject,
        status: "INTERESTED",
        interestScore: 8 + Math.random() * 2,
        classifiedAt: new Date(),
      },
    });

    await prisma.reply.create({
      data: {
        threadId: thread.id,
        direction: "INBOUND",
        fromEmail: t.email,
        toEmail: "martin.paviot@live.fr",
        subject: interestedReplies[i].subject,
        body: interestedReplies[i].body,
        preview: interestedReplies[i].body.slice(0, 100),
        sentAt: new Date(Date.now() - (i + 1) * 3600_000),
      },
    });
  }
  console.log("   4 INTERESTED reply threads");

  // 3 NOT_INTERESTED threads
  const notInterestedReplies = [
    { body: "Thanks but we're not interested. Please remove me from your list.", subject: "Re: Quick question" },
    { body: "Not a fit for us right now. We handle outbound internally and are happy with our process.", subject: "Re: Outbound strategy" },
    { body: "Please stop emailing me.", subject: "Re: Growth" },
  ];

  for (let i = 0; i < 3; i++) {
    const leadIdx = 5 + i;
    const leadId = leadIds[leadIdx];
    const t = LEAD_TEMPLATES[leadIdx];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId,
        campaignId: campaign1.id,
        subject: notInterestedReplies[i].subject,
        status: "NOT_INTERESTED",
        interestScore: 1 + Math.random() * 2,
        classifiedAt: new Date(),
      },
    });

    await prisma.reply.create({
      data: {
        threadId: thread.id,
        direction: "INBOUND",
        fromEmail: t.email,
        toEmail: "martin.paviot@live.fr",
        subject: notInterestedReplies[i].subject,
        body: notInterestedReplies[i].body,
        preview: notInterestedReplies[i].body.slice(0, 100),
        sentAt: new Date(Date.now() - (i + 5) * 3600_000),
      },
    });
  }
  console.log("   3 NOT_INTERESTED reply threads");

  // 2 OPEN threads with auto-reply
  const autoReplies = [
    { body: "I'm out of office until March 25th. I'll get back to you when I return. For urgent matters, please contact support@techbridge.io.", subject: "Re: Auto: Out of Office" },
    { body: "Thank you for your email. This inbox is no longer monitored. Please reach out to info@scaleup.ai for all inquiries.", subject: "Re: Auto: Unmonitored inbox" },
  ];

  for (let i = 0; i < 2; i++) {
    const leadIdx = 8 + i;
    const leadId = leadIds[leadIdx];
    const t = LEAD_TEMPLATES[leadIdx];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId,
        campaignId: campaign1.id,
        subject: autoReplies[i].subject,
        status: "OPEN",
        interestScore: null,
      },
    });

    await prisma.reply.create({
      data: {
        threadId: thread.id,
        direction: "INBOUND",
        fromEmail: t.email,
        toEmail: "martin.paviot@live.fr",
        subject: autoReplies[i].subject,
        body: autoReplies[i].body,
        preview: autoReplies[i].body.slice(0, 100),
        isAutoReply: true,
        sentAt: new Date(Date.now() - (i + 10) * 3600_000),
      },
    });
  }
  console.log("   2 OPEN auto-reply threads");

  // 1 OPEN thread with a question
  {
    const leadIdx = 10;
    const leadId = leadIds[leadIdx];
    const t = LEAD_TEMPLATES[leadIdx];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId,
        campaignId: campaign1.id,
        subject: "Re: Sales automation question",
        status: "OPEN",
        interestScore: 5.5,
        classifiedAt: new Date(),
      },
    });

    await prisma.reply.create({
      data: {
        threadId: thread.id,
        direction: "INBOUND",
        fromEmail: t.email,
        toEmail: "martin.paviot@live.fr",
        subject: "Re: Sales automation question",
        body: "Interesting approach. Can you explain how your tool handles multi-channel sequences? We currently use Outreach.io and are evaluating alternatives. What's the typical onboarding timeline?",
        preview: "Interesting approach. Can you explain how your tool handles multi-channel sequences? We currently use",
        sentAt: new Date(Date.now() - 2 * 3600_000),
      },
    });
  }
  console.log("   1 OPEN question thread");

  // 5. Create EmailPerformance for assigned leads
  console.log("\n5. Creating email performance records...");
  for (let i = 0; i < assignIds.length; i++) {
    const t = LEAD_TEMPLATES[i];
    await prisma.emailPerformance.create({
      data: {
        leadId: assignIds[i],
        campaignId: campaign1.id,
        email: t.email,
        openCount: i < 5 ? 3 : 1,
        replyCount: i < 4 ? 1 : 0,
        bounced: false,
        sentAt: new Date(Date.now() - (i + 1) * 86400_000),
        firstOpenAt: i < 6 ? new Date(Date.now() - i * 86400_000) : null,
        repliedAt: i < 4 ? new Date(Date.now() - i * 3600_000) : null,
        variantIndex: i % 3,
        sentStep: 0,
      },
    });
  }
  console.log(`   ${assignIds.length} email performance records`);

  // 6. Update lead statuses for leads that "replied"
  await prisma.lead.updateMany({
    where: { id: { in: tierA.slice(0, 4) } },
    data: { status: "REPLIED" },
  });
  console.log("   Updated replied leads status");

  console.log("\nDemo data seeded successfully!");
  console.log(`   Leads: 50 (5A + 8B + 12C + 25D)`);
  console.log(`   Campaigns: 3 (all ACTIVE)`);
  console.log(`   Reply threads: 10 (4 interested, 3 not interested, 2 auto-reply, 1 question)`);
  console.log(`   TAM: 14,247 accounts, ~435 burning`);
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
