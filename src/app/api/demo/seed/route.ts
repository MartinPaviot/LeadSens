import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { draftEmail } from "@/server/lib/email/drafting";
import { generateCampaignAngle } from "@/server/lib/email/campaign-angle";
import { getInstantlyClient } from "@/server/lib/connectors/instantly";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";

// ─── Demo Data ──────────────────────────────────────────

const DEMO_LEADS: Array<{
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  industry: string;
  companySize: string;
  website: string;
  country: string;
  enrichmentData: EnrichmentData;
}> = [
  {
    firstName: "Sophie",
    lastName: "Martin",
    email: "demo+sophie.martin@example.com",
    company: "CloudMetrics",
    jobTitle: "VP of Sales",
    industry: "Software & Internet",
    companySize: "100 - 250",
    website: "cloudmetrics.io",
    country: "France",
    enrichmentData: {
      companySummary: "CloudMetrics est une plateforme SaaS d'analytics produit basée à Paris, aidant les équipes growth à comprendre le comportement utilisateur en temps réel.",
      products: ["Analytics produit", "Heatmaps", "Session replay"],
      targetMarket: "SaaS B2B et e-commerce",
      valueProposition: "Comprendre pourquoi les utilisateurs quittent votre produit en 5 minutes",
      painPoints: ["Difficulté à scaler l'outbound au-delà de 50 meetings/mois", "Pipeline imprévisible d'un trimestre à l'autre", "SDRs qui passent trop de temps sur la recherche manuelle"],
      recentNews: ["Levée de fonds Série A de 12M€ en janvier 2026"],
      techStack: ["React", "Node.js", "PostgreSQL", "AWS"],
      teamSize: "~120 employés",
      signals: ["Recrutement de 3 AE seniors sur LinkedIn", "Expansion sur le marché DACH"],
    },
  },
  {
    firstName: "Thomas",
    lastName: "Dupont",
    email: "demo+thomas.dupont@example.com",
    company: "DataPulse",
    jobTitle: "VP Sales",
    industry: "Software & Internet",
    companySize: "250 - 1000",
    website: "datapulse.fr",
    country: "France",
    enrichmentData: {
      companySummary: "DataPulse fournit une plateforme de data observability pour les équipes data engineering, détectant les anomalies avant qu'elles n'impactent les dashboards.",
      products: ["Data observability", "Lineage automatique", "Alerting intelligent"],
      targetMarket: "Enterprises avec des pipelines data complexes",
      valueProposition: "Détectez les data incidents avant vos stakeholders",
      painPoints: ["Cycle de vente long (6+ mois) qui grève le cash flow", "Taux de conversion demo→close en dessous de 15%", "Manque de cas clients dans le secteur finance"],
      recentNews: ["Partenariat avec Snowflake annoncé en décembre 2025"],
      techStack: ["Python", "Spark", "Kubernetes", "GCP"],
      teamSize: "~350 employés",
      signals: ["Ouverture d'un bureau à Londres", "Recrutement d'un Head of Partnerships"],
    },
  },
  {
    firstName: "Julien",
    lastName: "Bernard",
    email: "demo+julien.bernard@example.com",
    company: "SalesForge",
    jobTitle: "VP of Sales",
    industry: "Software & Internet",
    companySize: "25 - 100",
    website: "salesforge.io",
    country: "France",
    enrichmentData: {
      companySummary: "SalesForge est un outil de sales engagement tout-en-un pour les startups B2B, combinant séquences email, scoring et CRM léger.",
      products: ["Sales engagement", "Lead scoring", "CRM intégré"],
      targetMarket: "Startups B2B en early stage",
      valueProposition: "L'outil de vente que vos SDRs utiliseront vraiment",
      painPoints: ["Perte de deals face à des concurrents plus rapides à répondre", "SDRs qui utilisent 5 outils différents", "Pas de visibilité sur le pipeline avant le board meeting"],
      recentNews: ["Lancement de la fonctionnalité AI auto-reply en février 2026"],
      techStack: ["Next.js", "TypeScript", "Supabase"],
      teamSize: "~60 employés",
      signals: ["Croissance de 200% YoY", "Recherche de channel partners"],
    },
  },
  {
    firstName: "Marie",
    lastName: "Lefevre",
    email: "demo+marie.lefevre@example.com",
    company: "PayFlow",
    jobTitle: "VP Sales",
    industry: "Financial Services",
    companySize: "100 - 250",
    website: "payflow.eu",
    country: "France",
    enrichmentData: {
      companySummary: "PayFlow simplifie la gestion des paiements B2B pour les PME européennes, avec réconciliation automatique et prévisions de trésorerie.",
      products: ["Paiements B2B", "Réconciliation auto", "Prévisions cash"],
      targetMarket: "PME européennes (50-500 employés)",
      valueProposition: "Vos paiements B2B en pilote automatique",
      painPoints: ["Difficulté à upsell les clients existants vers le plan enterprise", "Market education coûteux dans la fintech", "Réglementation qui ralentit le go-to-market"],
      recentNews: ["Obtention de la licence PSD2 en novembre 2025"],
      techStack: ["Java", "Spring Boot", "AWS", "Stripe Connect"],
      teamSize: "~150 employés",
      signals: ["Recrutement massif côté sales (8 postes ouverts)", "Lancement du marché italien"],
    },
  },
  {
    firstName: "Antoine",
    lastName: "Moreau",
    email: "demo+antoine.moreau@example.com",
    company: "TalentSync",
    jobTitle: "VP of Sales",
    industry: "Software & Internet",
    companySize: "100 - 250",
    website: "talentsync.fr",
    country: "France",
    enrichmentData: {
      companySummary: "TalentSync est une plateforme RH SaaS qui automatise le recrutement tech : sourcing, screening IA, et scheduling entretiens.",
      products: ["ATS intelligent", "Screening IA", "Matching candidats"],
      targetMarket: "Scale-ups tech (100-1000 employés) qui recrutent vite",
      valueProposition: "Recrutez vos devs 2x plus vite sans sacrifier la qualité",
      painPoints: ["No-show rate élevé sur les démos planifiées", "CAC en hausse de 40% sur les 12 derniers mois", "Churn sur les comptes mid-market"],
      recentNews: ["Intégration native avec LinkedIn Recruiter lancée en janvier 2026"],
      techStack: ["React", "Python", "FastAPI", "OpenAI"],
      teamSize: "~130 employés",
      signals: ["Nouveau board member ex-Workday", "Série B en préparation"],
    },
  },
  {
    firstName: "Camille",
    lastName: "Dubois",
    email: "demo+camille.dubois@example.com",
    company: "LogiTrack",
    jobTitle: "VP Sales",
    industry: "Software & Internet",
    companySize: "250 - 1000",
    website: "logitrack.io",
    country: "France",
    enrichmentData: {
      companySummary: "LogiTrack est un TMS (Transport Management System) nouvelle génération pour les chargeurs européens, avec optimisation IA des routes et visibilité temps réel.",
      products: ["TMS cloud", "Optimisation routes IA", "Track & trace"],
      targetMarket: "Chargeurs et retailers européens",
      valueProposition: "Réduisez vos coûts transport de 15% avec l'IA",
      painPoints: ["Cycle de vente enterprise de 9+ mois", "Intégrations legacy ERP qui bloquent les deals", "Concurrence agressive de Transporeon et project44"],
      recentNews: ["Contrat avec Carrefour signé en décembre 2025"],
      techStack: ["Go", "React", "Kubernetes", "Azure"],
      teamSize: "~400 employés",
      signals: ["Expansion Benelux", "Recherche de VP Marketing"],
    },
  },
  {
    firstName: "Pierre",
    lastName: "Girard",
    email: "demo+pierre.girard@example.com",
    company: "CyberShield",
    jobTitle: "VP of Sales",
    industry: "Software & Internet",
    companySize: "25 - 100",
    website: "cybershield.eu",
    country: "France",
    enrichmentData: {
      companySummary: "CyberShield fournit une plateforme de cybersécurité automatisée pour les PME : détection de menaces, patch management, et formation employés.",
      products: ["Threat detection", "Patch management", "Security awareness training"],
      targetMarket: "PME européennes (50-500 employés) sans CISO dédié",
      valueProposition: "La cybersécurité enterprise accessible aux PME",
      painPoints: ["Difficile de vendre de la prévention (pas de douleur immédiate)", "Prospects qui comparent avec des solutions gratuites", "Long cycle d'approbation avec les DSI"],
      recentNews: ["Certification ISO 27001 obtenue en février 2026"],
      techStack: ["Rust", "React", "Elasticsearch", "AWS"],
      teamSize: "~45 employés",
      signals: ["NIS2 crée une urgence réglementaire", "Recherche de partenaires MSP"],
    },
  },
  {
    firstName: "Laura",
    lastName: "Petit",
    email: "demo+laura.petit@example.com",
    company: "GrowthLab",
    jobTitle: "VP Sales",
    industry: "Software & Internet",
    companySize: "25 - 100",
    website: "growthlab.fr",
    country: "France",
    enrichmentData: {
      companySummary: "GrowthLab est une plateforme d'expérimentation et d'A/B testing pour les équipes produit et growth, avec analyse statistique automatique.",
      products: ["A/B testing", "Feature flags", "Analyse statistique"],
      targetMarket: "SaaS B2B et marketplaces avec >10K MAU",
      valueProposition: "Prenez des décisions produit basées sur les données, pas les opinions",
      painPoints: ["Win rate en baisse face aux outils gratuits (PostHog)", "Difficulté à prouver le ROI aux CFOs", "Manque de pipeline enterprise"],
      recentNews: ["Lancement de l'offre Enterprise en janvier 2026"],
      techStack: ["TypeScript", "Node.js", "ClickHouse", "Vercel"],
      teamSize: "~55 employés",
      signals: ["Premiers clients US (Product Hunt launch)", "Recrutement de 2 AE enterprise"],
    },
  },
  {
    firstName: "Nicolas",
    lastName: "Roux",
    email: "demo+nicolas.roux@example.com",
    company: "Miravox",
    jobTitle: "VP of Sales",
    industry: "Software & Internet",
    companySize: "100 - 250",
    website: "miravox.io",
    country: "France",
    enrichmentData: {
      companySummary: "Miravox développe une plateforme de voice AI pour les centres d'appels, automatisant le tri, la transcription et l'analyse des conversations.",
      products: ["Voice AI", "Call transcription", "Sentiment analysis", "Agent assist"],
      targetMarket: "Centres de contact et équipes support (100+ agents)",
      valueProposition: "Transformez chaque appel client en donnée actionnable",
      painPoints: ["Vente complexe avec multiples décideurs (IT + Ops + Direction)", "POC qui s'éternisent (3+ mois)", "Concurrence de solutions US (Gong, Chorus)"],
      recentNews: ["Partenariat avec Genesys Cloud annoncé en février 2026"],
      techStack: ["Python", "PyTorch", "FastAPI", "GCP"],
      teamSize: "~180 employés",
      signals: ["Levée de fonds Série B de 25M€ récente", "Expansion marché UK"],
    },
  },
  {
    firstName: "Claire",
    lastName: "Bonnet",
    email: "demo+claire.bonnet@example.com",
    company: "DevOpsly",
    jobTitle: "VP Sales",
    industry: "Software & Internet",
    companySize: "25 - 100",
    website: "devopsly.io",
    country: "France",
    enrichmentData: {
      companySummary: "DevOpsly est une plateforme d'internal developer platform (IDP) qui simplifie le déploiement et l'infra pour les équipes dev, sans avoir besoin de DevOps dédiés.",
      products: ["Internal Developer Platform", "CI/CD simplifié", "Infra as Code visuel"],
      targetMarket: "Startups et scale-ups tech (20-200 devs) sans équipe platform",
      valueProposition: "Vos devs déploient en production sans ticket Ops",
      painPoints: ["Marché encombré (Backstage, Humanitec, Port)", "Difficulté à closer les CTOs qui veulent build in-house", "ACV trop bas sur le segment startup"],
      recentNews: ["Support Terraform natif lancé en décembre 2025"],
      techStack: ["Go", "React", "Kubernetes", "Terraform"],
      teamSize: "~40 employés",
      signals: ["Pivot vers le mid-market", "Nouveau pricing enterprise lancé"],
    },
  },
];

const FALLBACK_COMPANY_DNA: CompanyDna = {
  oneLiner: "LeadSens aide les équipes sales B2B à automatiser leur prospection outbound grâce à l'IA : sourcing, scoring, emails personnalisés, envoi.",
  targetBuyers: [
    { role: "VP Sales", sellingAngle: "Pipeline prévisible et scalable sans recruter plus de SDRs" },
    { role: "Head of Growth", sellingAngle: "Automatiser l'outbound pour se concentrer sur l'inbound" },
  ],
  keyResults: ["+45% de reply rate vs emails génériques", "3h de recherche manuelle économisées par jour et par SDR", "500 leads qualifiés en 10 minutes"],
  differentiators: ["IA qui score les leads AVANT de les contacter", "Emails hyper-personnalisés basés sur le scraping du site du prospect", "Intégration native Instantly"],
  problemsSolved: ["Les SDRs passent 70% de leur temps à chercher des leads au lieu de vendre", "Les emails templates génériques ont un reply rate de 1%", "Impossible de scaler l'outbound sans multiplier les SDRs"],
  pricingModel: "Per seat, essai gratuit 14 jours",
  socialProof: [
    { industry: "SaaS", clients: ["Pennylane", "Qonto", "Spendesk"], keyMetric: "+45% reply rate" },
    { industry: "Consulting", clients: ["BCG Digital Ventures", "McKinsey Implementation"] },
  ],
  toneOfVoice: {
    register: "conversational",
    traits: ["direct", "peer-to-peer", "data-driven"],
    avoidWords: [],
  },
  ctas: [
    { label: "Un call de 10 min pour voir le pipeline en action ?", commitment: "medium" },
    { label: "Je t'envoie un case study SaaS ?", commitment: "low" },
  ],
  senderIdentity: {
    name: "Martin",
    role: "Co-founder @ LeadSens",
    signatureHook: "PS: On a automatisé l'outbound de Pennylane en 2 semaines.",
  },
  objections: [],
};

// ─── Route ──────────────────────────────────────────────

export async function POST() {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[demo-seed] ${msg}`);
    logs.push(msg);
  };

  try {
    // 1. Find workspace
    const workspace = await prisma.workspace.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!workspace) {
      return NextResponse.json({ error: "No workspace found. Create one first." }, { status: 400 });
    }

    log(`Workspace: ${workspace.name} (${workspace.id})`);

    // 2. Get CompanyDna
    const companyDna: CompanyDna = workspace.companyDna
      ? (workspace.companyDna as CompanyDna)
      : FALLBACK_COMPANY_DNA;

    log(`CompanyDna: ${companyDna.oneLiner.slice(0, 60)}...`);

    // 3. Create Campaign in DB
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: workspace.id,
        name: "Demo — VP Sales SaaS Paris",
        status: "DRAFTING",
        icpDescription: "VP of Sales dans des boîtes SaaS parisiennes, 25-1000 employés",
        icpFilters: {
          job_titles: ["VP of Sales", "VP Sales"],
          level: ["VP-Level"],
          department: ["Sales"],
          industries: ["Software & Internet"],
          locations: ["France"],
          employee_count: ["25 - 100", "100 - 250", "250 - 1000"],
        },
        leadsTotal: DEMO_LEADS.length,
      },
    });

    log(`Campaign created: ${campaign.id}`);

    // 4. Generate campaign angle via Mistral
    log("Generating campaign angle...");
    const campaignAngle = await generateCampaignAngle(
      companyDna,
      campaign.icpDescription,
      workspace.id,
    );

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { angle: campaignAngle as unknown as Record<string, unknown> },
    });

    log(`Campaign angle: ${campaignAngle.angleOneLiner.slice(0, 60)}...`);

    // 5. Create leads in DB
    log("Creating 10 demo leads...");
    const createdLeads = await Promise.all(
      DEMO_LEADS.map((lead) =>
        prisma.lead.upsert({
          where: {
            workspaceId_email: {
              workspaceId: workspace.id,
              email: lead.email,
            },
          },
          update: {
            campaignId: campaign.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            jobTitle: lead.jobTitle,
            industry: lead.industry,
            companySize: lead.companySize,
            website: lead.website,
            country: lead.country,
            enrichmentData: lead.enrichmentData as unknown as Record<string, unknown>,
            enrichedAt: new Date(),
            icpScore: 8,
            status: "ENRICHED",
          },
          create: {
            workspaceId: workspace.id,
            campaignId: campaign.id,
            email: lead.email,
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            jobTitle: lead.jobTitle,
            industry: lead.industry,
            companySize: lead.companySize,
            website: lead.website,
            country: lead.country,
            enrichmentData: lead.enrichmentData as unknown as Record<string, unknown>,
            enrichedAt: new Date(),
            icpScore: 8,
            status: "ENRICHED",
          },
        }),
      ),
    );

    log(`Created ${createdLeads.length} leads`);

    // 6. Draft 3 emails per lead via Mistral
    log("Drafting emails (3 per lead = 30 total)...");
    const draftResults: Array<{
      leadId: string;
      leadName: string;
      emails: Array<{ step: number; subject: string; body: string }>;
    }> = [];

    for (const [i, lead] of createdLeads.entries()) {
      const demoLead = DEMO_LEADS[i];
      const previousEmails: Array<{ step: number; subject: string }> = [];
      const emails: Array<{ step: number; subject: string; body: string }> = [];

      for (let step = 0; step < 3; step++) {
        log(`  Drafting lead ${i + 1}/10 step ${step}/2: ${demoLead.firstName} ${demoLead.lastName} @ ${demoLead.company}`);

        const result = await draftEmail({
          lead: {
            firstName: demoLead.firstName,
            lastName: demoLead.lastName,
            jobTitle: demoLead.jobTitle,
            company: demoLead.company,
            industry: demoLead.industry,
            companySize: demoLead.companySize,
            enrichmentData: demoLead.enrichmentData,
          },
          step,
          companyDna,
          campaignAngle,
          workspaceId: workspace.id,
          previousEmails,
        });

        // Save to DB
        await prisma.draftedEmail.upsert({
          where: { leadId_step: { leadId: lead.id, step } },
          update: {
            subject: result.subject,
            body: result.body,
            model: "mistral-large-latest",
            campaignId: campaign.id,
          },
          create: {
            leadId: lead.id,
            campaignId: campaign.id,
            step,
            subject: result.subject,
            body: result.body,
            model: "mistral-large-latest",
          },
        });

        previousEmails.push({ step, subject: result.subject });
        emails.push({ step, ...result });
      }

      // Update lead status
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "DRAFTED" },
      });

      draftResults.push({
        leadId: lead.id,
        leadName: `${demoLead.firstName} ${demoLead.lastName}`,
        emails,
      });
    }

    // Update campaign stats
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        leadsDrafted: createdLeads.length,
        status: "READY",
      },
    });

    log("All 30 emails drafted!");

    // 7. Create campaign in Instantly & push leads
    log("Creating Instantly campaign...");
    let instantlyCampaignId: string | null = null;

    try {
      const instantly = await getInstantlyClient(workspace.id);

      // Create campaign with template variables
      const instantlyCampaign = await instantly.createCampaign({
        name: `Demo — VP Sales SaaS Paris — ${new Date().toISOString().slice(0, 10)}`,
        steps: [
          {
            subject: "{{email_step_0_subject}}",
            body: "{{email_step_0_body}}",
          },
          {
            subject: "{{email_step_1_subject}}",
            body: "{{email_step_1_body}}",
            delay: 3,
          },
          {
            subject: "{{email_step_2_subject}}",
            body: "{{email_step_2_body}}",
            delay: 3,
          },
        ],
      });

      instantlyCampaignId = instantlyCampaign.id;
      log(`Instantly campaign created: ${instantlyCampaignId}`);

      // Update campaign in DB with Instantly ID
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { instantlyCampaignId },
      });

      // 8. Push each lead to Instantly with custom variables
      log("Pushing leads to Instantly...");
      for (const result of draftResults) {
        const customVariables: Record<string, string> = {};
        for (const email of result.emails) {
          customVariables[`email_step_${email.step}_subject`] = email.subject;
          customVariables[`email_step_${email.step}_body`] = email.body;
        }

        const lead = createdLeads.find((l) => l.id === result.leadId)!;
        const demoLead = DEMO_LEADS.find(
          (d) => d.email === lead.email,
        )!;

        await instantly.createLead({
          email: demoLead.email,
          firstName: demoLead.firstName,
          lastName: demoLead.lastName,
          companyName: demoLead.company,
          campaign: instantlyCampaignId,
          customVariables,
        });

        // Update lead status
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "PUSHED" },
        });

        log(`  Pushed: ${demoLead.firstName} ${demoLead.lastName} (${demoLead.email})`);
      }

      // Update campaign status
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          leadsPushed: createdLeads.length,
          status: "PUSHED",
        },
      });

      log("All leads pushed to Instantly!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Instantly push failed: ${msg}. Emails are drafted in DB but not in Instantly.`);
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        instantlyCampaignId,
      },
      leads: draftResults.map((r) => ({
        id: r.leadId,
        name: r.leadName,
        emails: r.emails.map((e) => ({
          step: e.step,
          subject: e.subject,
          bodyPreview: e.body.slice(0, 100) + "...",
        })),
      })),
      logs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log(`Fatal error: ${msg}`);
    return NextResponse.json({ error: msg, logs }, { status: 500 });
  }
}
