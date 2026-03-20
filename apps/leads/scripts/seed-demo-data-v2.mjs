/**
 * Seed Demo Data v2 for LeadSens
 *
 * Updates the CORRECT workspace (cmm8f2796008cid2ca9zosgje) with:
 * - TAM result
 * - Enriched ICP scores/breakdowns on existing leads
 * - 3 ACTIVE campaigns with analyticsCache
 * - 10 reply threads with replies
 *
 * Also cleans up wrongly-seeded data in cmmu6ys2h0000v4awqnlegp8f
 *
 * Run: node scripts/seed-demo-data-v2.mjs
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appsLeadsDir = resolve(__dirname, "..", "apps", "leads");
const require = createRequire(resolve(appsLeadsDir, "package.json"));
process.loadEnvFile(resolve(appsLeadsDir, ".env"));

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const WORKSPACE_ID = "cmm8f2796008cid2ca9zosgje";
const WRONG_WORKSPACE_ID = "cmmu6ys2h0000v4awqnlegp8f";

// ─── Signal Templates ────────────────────────────────────

const SIGNAL_TEMPLATES = [
  { name: "Hiring Outbound", evidence: "3 open SDR positions", reasoning: "Actively building outbound team" },
  { name: "Sales-Led Growth", evidence: "VP Sales reports to CEO", reasoning: "Sales-led org structure" },
  { name: "Tech Stack Fit", evidence: "Uses HubSpot CRM", reasoning: "Compatible CRM integration" },
  { name: "Recent Funding", evidence: "Series B $15M (2 months ago)", reasoning: "Fresh capital for growth" },
  { name: "New in Role", evidence: "Started role 3 months ago", reasoning: "New leaders drive change" },
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
  const firstName = lead.firstName || "this contact";
  const jobTitle = lead.jobTitle || "Contact";
  const company = lead.company || "Unknown";
  const industry = lead.industry || "Tech";
  const companySize = lead.companySize || "?";

  return {
    tierReasons: [
      `${tierLabels[tier]}: ${jobTitle} at B2B ${industry}`,
      `Company size in ${score >= 7 ? "sweet spot" : "range"} (${companySize} employees)`,
    ],
    heatReasons: signals.filter((s) => s.detected).map((s) => s.evidence),
    actionPhrase: `${tier === "A" ? "Priority" : tier === "B" ? "Strong" : "Consider"} outreach to ${firstName}`,
    whyThisLead: `Score ${score}/10 — ${jobTitle} at ${company}, a ${companySize}-person ${industry} company.${signalCount > 0 ? ` ${signals.filter((s) => s.detected).map((s) => s.evidence).join(". ")}.` : ""}`,
    signals,
  };
}

// ─── Main ────────────────────────────────────────────────

async function seed() {
  console.log("Seed v2 — workspace:", WORKSPACE_ID);

  // 0. Clean up wrongly-seeded data
  console.log("\n0. Cleaning up wrong workspace data...");
  const wrongThreads = await prisma.replyThread.findMany({ where: { workspaceId: WRONG_WORKSPACE_ID }, select: { id: true } });
  if (wrongThreads.length > 0) {
    await prisma.reply.deleteMany({ where: { threadId: { in: wrongThreads.map(t => t.id) } } });
    await prisma.replyThread.deleteMany({ where: { workspaceId: WRONG_WORKSPACE_ID } });
  }
  await prisma.emailPerformance.deleteMany({ where: { campaign: { workspaceId: WRONG_WORKSPACE_ID } } });
  await prisma.lead.deleteMany({ where: { workspaceId: WRONG_WORKSPACE_ID } });
  await prisma.campaign.deleteMany({ where: { workspaceId: WRONG_WORKSPACE_ID } });
  console.log("   Cleaned up wrong workspace");

  // 1. Set TAM result
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

  // 2. Update existing leads with ICP scores + breakdowns
  console.log("\n2. Enriching existing leads with ICP scores...");
  const leads = await prisma.lead.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, firstName: true, lastName: true, company: true, jobTitle: true, industry: true, companySize: true, icpScore: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`   Found ${leads.length} leads to enrich`);

  // Assign scores: first 8 -> Tier A (9-10), next 15 -> Tier B (7-8), next 25 -> Tier C (5-6), rest -> Tier D
  const scoreAssignments = [];
  for (let i = 0; i < leads.length; i++) {
    if (i < 8) scoreAssignments.push(9 + (i % 2)); // 9 or 10
    else if (i < 23) scoreAssignments.push(7 + (i % 2)); // 7 or 8
    else if (i < 48) scoreAssignments.push(5 + (i % 2)); // 5 or 6
    else scoreAssignments.push(i % 5 === 0 ? null : (i % 4) + 1); // null or 1-4
  }

  let tierCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const score = scoreAssignments[i];
    const tier = score == null ? "D" : score >= 9 ? "A" : score >= 7 ? "B" : score >= 5 ? "C" : "D";
    tierCounts[tier]++;

    const status = score >= 9 ? "ENRICHED" : score >= 7 ? "SCORED" : "SOURCED";

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        icpScore: score,
        icpBreakdown: score != null ? makeBreakdown(score, lead) : undefined,
        enrichedAt: score != null && score >= 7 ? new Date() : undefined,
        status,
      },
    });
  }
  console.log(`   Enriched: ${tierCounts.A}A + ${tierCounts.B}B + ${tierCounts.C}C + ${tierCounts.D}D`);

  // 3. Update existing campaigns to ACTIVE + add analyticsCache, or create new ones
  console.log("\n3. Updating campaigns...");
  const existingCampaigns = await prisma.campaign.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, name: true, leadsTotal: true },
    orderBy: { createdAt: "asc" },
  });

  const analyticsData = [
    { sent: 93, opened: 56, replied: 7, bounced: 3, meetings: 2 },
    { sent: 24, opened: 11, replied: 1, bounced: 2 },
    { sent: 200, opened: 140, replied: 14, bounced: 12, meetings: 4 },
  ];

  for (let i = 0; i < existingCampaigns.length; i++) {
    const c = existingCampaigns[i];
    const analytics = analyticsData[i] || analyticsData[0];
    await prisma.campaign.update({
      where: { id: c.id },
      data: {
        status: "ACTIVE",
        analyticsCache: analytics,
        lastSyncedAt: new Date(),
        leadsPushed: analytics.sent,
        leadsDrafted: analytics.sent,
        leadsEnriched: c.leadsTotal,
        leadsScored: c.leadsTotal,
      },
    });
    console.log(`   Updated "${c.name}" -> ACTIVE (${analytics.sent} sent, ${analytics.replied} replied)`);
  }

  // Assign first 8 leads (Tier A) to first campaign
  const firstCampaign = existingCampaigns[0];
  const tierALeads = leads.slice(0, 8);
  await prisma.lead.updateMany({
    where: { id: { in: tierALeads.map(l => l.id) } },
    data: { campaignId: firstCampaign.id, status: "PUSHED" },
  });
  console.log(`   Assigned 8 Tier A leads to "${firstCampaign.name}"`);

  // 4. Create reply threads + replies
  console.log("\n4. Creating reply threads and replies...");

  // First delete any existing ones to avoid conflicts
  const existingThreads = await prisma.replyThread.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { id: true } });
  if (existingThreads.length > 0) {
    await prisma.reply.deleteMany({ where: { threadId: { in: existingThreads.map(t => t.id) } } });
    await prisma.replyThread.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  }

  // 4 INTERESTED threads (Tier A leads)
  const interestedReplies = [
    { body: "Hi, this sounds really interesting. We've been looking for something like this. Can you share a case study from a similar company?", subject: "Re: Quick question about your outbound" },
    { body: "Thanks for reaching out! We're actually evaluating solutions right now. Would love to hop on a call next week.", subject: "Re: Growth at scale" },
    { body: "I've been thinking about this exact problem. We're spending too much time on manual outreach. When can we chat?", subject: "Re: Outbound automation" },
    { body: "Very timely. We just got budget approved for a tool like this. Can you send over pricing?", subject: "Re: Outbound strategy" },
  ];

  for (let i = 0; i < 4; i++) {
    const lead = tierALeads[i];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId: lead.id,
        campaignId: firstCampaign.id,
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
        fromEmail: `${(lead.firstName || "contact").toLowerCase()}@example.com`,
        toEmail: "martin.paviot@live.fr",
        subject: interestedReplies[i].subject,
        body: interestedReplies[i].body,
        preview: interestedReplies[i].body.slice(0, 100),
        sentAt: new Date(Date.now() - (i + 1) * 3600_000),
      },
    });
  }
  console.log("   4 INTERESTED reply threads");

  // 3 NOT_INTERESTED threads (leads 8-10, Tier B)
  const notInterestedReplies = [
    { body: "Thanks but we're not interested. Please remove me from your list.", subject: "Re: Quick question" },
    { body: "Not a fit for us right now. We handle outbound internally and are happy with our process.", subject: "Re: Outbound strategy" },
    { body: "Please stop emailing me.", subject: "Re: Growth" },
  ];

  for (let i = 0; i < 3; i++) {
    const lead = leads[8 + i];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId: lead.id,
        campaignId: firstCampaign.id,
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
        fromEmail: `${(lead.firstName || "contact").toLowerCase()}@example.com`,
        toEmail: "martin.paviot@live.fr",
        subject: notInterestedReplies[i].subject,
        body: notInterestedReplies[i].body,
        preview: notInterestedReplies[i].body.slice(0, 100),
        sentAt: new Date(Date.now() - (i + 5) * 3600_000),
      },
    });
  }
  console.log("   3 NOT_INTERESTED reply threads");

  // 2 OPEN threads with auto-reply (leads 11-12)
  const autoReplies = [
    { body: "I'm out of office until March 25th. I'll get back to you when I return. For urgent matters, please contact support@company.com.", subject: "Re: Auto: Out of Office" },
    { body: "Thank you for your email. This inbox is no longer monitored. Please reach out to info@company.com for all inquiries.", subject: "Re: Auto: Unmonitored inbox" },
  ];

  for (let i = 0; i < 2; i++) {
    const lead = leads[11 + i];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId: lead.id,
        campaignId: firstCampaign.id,
        subject: autoReplies[i].subject,
        status: "OPEN",
        interestScore: null,
      },
    });

    await prisma.reply.create({
      data: {
        threadId: thread.id,
        direction: "INBOUND",
        fromEmail: `${(lead.firstName || "contact").toLowerCase()}@example.com`,
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

  // 1 OPEN thread with a question (lead 13)
  {
    const lead = leads[13];
    const thread = await prisma.replyThread.create({
      data: {
        workspaceId: WORKSPACE_ID,
        leadId: lead.id,
        campaignId: firstCampaign.id,
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
        fromEmail: `${(lead.firstName || "contact").toLowerCase()}@example.com`,
        toEmail: "martin.paviot@live.fr",
        subject: "Re: Sales automation question",
        body: "Interesting approach. Can you explain how your tool handles multi-channel sequences? We currently use Outreach.io and are evaluating alternatives. What's the typical onboarding timeline?",
        preview: "Interesting approach. Can you explain how your tool handles multi-channel sequences? We currently use",
        sentAt: new Date(Date.now() - 2 * 3600_000),
      },
    });
  }
  console.log("   1 OPEN question thread");

  // 5. Create EmailPerformance for the first 8 leads
  console.log("\n5. Creating email performance records...");
  // Clean existing
  await prisma.emailPerformance.deleteMany({ where: { campaignId: firstCampaign.id } });

  for (let i = 0; i < 8; i++) {
    const lead = tierALeads[i];
    await prisma.emailPerformance.create({
      data: {
        leadId: lead.id,
        campaignId: firstCampaign.id,
        email: `${(lead.firstName || "lead").toLowerCase()}.${(lead.lastName || "x").toLowerCase()}@example.com`,
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
  console.log("   8 email performance records");

  // 6. Update replied leads status
  await prisma.lead.updateMany({
    where: { id: { in: tierALeads.slice(0, 4).map(l => l.id) } },
    data: { status: "REPLIED" },
  });
  console.log("   Updated replied leads status");

  console.log("\nDemo data seeded successfully!");
  console.log(`   Leads: ${leads.length} (${tierCounts.A}A + ${tierCounts.B}B + ${tierCounts.C}C + ${tierCounts.D}D)`);
  console.log(`   Campaigns: ${existingCampaigns.length} (all ACTIVE)`);
  console.log(`   Reply threads: 10 (4 interested, 3 not interested, 2 auto-reply, 1 question)`);
  console.log(`   TAM: 14,247 accounts, ~435 burning`);
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
