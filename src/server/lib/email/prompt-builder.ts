import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "@/server/lib/email/campaign-angle";

interface LeadForEmail {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  enrichmentData?: EnrichmentData | null;
}

interface DraftedEmailRef {
  step: number;
  subject: string;
}

interface Framework {
  name: string;
  instructions: string;
  objective: string;
  maxWords: number;
}

function getFramework(step: number): Framework {
  switch (step) {
    case 0:
      return {
        name: "PAS",
        instructions:
          "Use the PAS framework (Problem-Agitate-Solve). 1) Identify a specific problem the prospect faces. 2) Amplify the pain — make them feel it. 3) Present the solution naturally.",
        objective: "Get the prospect curious enough to reply or book a call.",
        maxWords: 150,
      };
    case 1:
      return {
        name: "Value-add",
        instructions:
          "Bring genuine value: an insight, a relevant resource, a case study, or a benchmark. NO 'just checking in' or 'following up'. Show you've done your homework.",
        objective: "Position yourself as a knowledgeable peer, not a pushy seller.",
        maxWords: 100,
      };
    case 2:
      return {
        name: "Breakup",
        instructions:
          "Short and direct. Last attempt. Acknowledge they're busy. No guilt-tripping. Something like 'Last note from me — no worries if the timing isn't right.'",
        objective: "Give a final, low-pressure reason to reply.",
        maxWords: 80,
      };
    default:
      return getFramework(0);
  }
}

/**
 * Builds a structured email drafting prompt (SPEC-BACKEND.md section 5.2).
 * Consumes EnrichmentData JSON directly for personalization.
 */
function buildWhoYouAre(
  companyDna: CompanyDna | string,
  campaignAngle?: CampaignAngle,
): string {
  if (campaignAngle) {
    return `## QUI TU ES (adapté à cette campagne)
${campaignAngle.angleOneLiner}

Problème que tu résous pour eux : ${campaignAngle.mainProblem}
Preuve : ${campaignAngle.proofPoint}
Ton : ${campaignAngle.tone}
À éviter : ${campaignAngle.avoid}`;
  }

  if (typeof companyDna === "object" && companyDna !== null) {
    const dna = companyDna;
    let section = `## Qui tu es
${dna.oneLiner}
Problèmes résolus : ${dna.problemsSolved.join(", ")}
Ce qui te différencie : ${dna.differentiators.join(", ")}`;
    if (dna.keyResults.length > 0) {
      section += `\nRésultats : ${dna.keyResults.join(", ")}`;
    }
    return section;
  }

  return `## Qui tu es\n${companyDna}`;
}

export function buildEmailPrompt(params: {
  lead: LeadForEmail;
  step: number;
  companyDna: CompanyDna | string;
  campaignAngle?: CampaignAngle;
  previousEmails?: DraftedEmailRef[];
  styleSamples?: string[];
}): string {
  const fw = getFramework(params.step);
  const ed = params.lead.enrichmentData;

  return `
${buildWhoYouAre(params.companyDna, params.campaignAngle)}

## Le prospect
- Prénom: ${params.lead.firstName ?? ""}
- Poste: ${params.lead.jobTitle ?? "unknown"}
- Entreprise: ${params.lead.company ?? "unknown"}
${ed?.companySummary ? `- Activité: ${ed.companySummary}` : ""}
${ed?.painPoints?.length ? `- Pain points: ${ed.painPoints.join(", ")}` : ""}
${ed?.signals?.length ? `- Signaux: ${ed.signals.join(", ")}` : ""}
${ed?.recentNews?.length ? `- Actus: ${ed.recentNews.join(", ")}` : ""}

## Framework
${fw.instructions}

## Objectif
${fw.objective}

${params.previousEmails?.length ? `## Emails précédents (NE PAS répéter)\n${params.previousEmails.map((e, i) => `Email ${i + 1}: "${e.subject}"`).join("\n")}` : ""}
${params.styleSamples?.length ? `## Style guide\n${params.styleSamples.join("\n")}` : ""}

## Contraintes
- Max ${fw.maxWords} mots. 1 CTA. 1 élément spécifique minimum.
- Pas de flatterie creepy, pas de signature.
- Langue : français si prospect FR, sinon anglais.
- Commence par le prénom.

JSON uniquement : {"subject": "...", "body": "..."}`.trim();
}
