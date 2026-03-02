import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "@/server/lib/email/campaign-angle";

interface LeadForEmail {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  companySize?: string | null;
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
          "Framework PAS (Problem-Agitate-Solve). 1) Une phrase qui nomme un problème spécifique au prospect. 2) Une phrase qui amplifie — conséquence concrète. 3) Présente ta solution en 1 phrase. CTA : question ouverte orientée échange. Ex: 'Ça vaudrait un échange de 10 min ?'",
        objective: "Déclencher la curiosité. Le prospect doit se dire 'il comprend mon problème'.",
        maxWords: 80,
      };
    case 1:
      return {
        name: "Value-add",
        instructions:
          "Apporte de la valeur concrète : un insight chiffré, un benchmark secteur, ou un mini case study en 1 phrase. PAS de 'suite à mon dernier email'. Le prospect doit apprendre quelque chose. CTA : proposition de call court. Ex: 'Un call de 10 min pour te montrer comment ?'",
        objective: "Se positionner comme un pair qui apporte, pas qui relance.",
        maxWords: 60,
      };
    case 2:
      return {
        name: "Breakup",
        instructions:
          "Dernier message. 2-3 phrases max. Reconnaître que c'est pas forcément le bon timing. Donner UNE raison de répondre. CTA final doux. Ex: 'Si le timing est meilleur plus tard, dis-moi quand.' ou 'Un dernier créneau cette semaine ?'",
        objective: "Fermer la boucle proprement. Low-pressure, high-respect.",
        maxWords: 50,
      };
    default:
      return getFramework(0);
  }
}

// ─── Social Proof Matching ──────────────────────────────

function findRelevantProof(
  socialProof: NonNullable<CompanyDna["socialProof"]>,
  leadIndustry?: string | null,
): string | null {
  if (!socialProof.length) return null;

  // Try industry match
  if (leadIndustry) {
    const needle = leadIndustry.toLowerCase();
    const match = socialProof.find(
      (sp) =>
        sp.industry.toLowerCase().includes(needle) ||
        needle.includes(sp.industry.toLowerCase()),
    );
    if (match) {
      const clientList = match.clients.slice(0, 3).join(", ");
      return match.keyMetric
        ? `Clients ${match.industry} : ${clientList} (${match.keyMetric})`
        : `Clients ${match.industry} : ${clientList}`;
    }
  }

  // Fallback: entry with a keyMetric
  const withMetric = socialProof.find((sp) => sp.keyMetric);
  if (withMetric) {
    return `${withMetric.clients.slice(0, 2).join(", ")} (${withMetric.keyMetric})`;
  }

  // Last resort: first entry
  return `Clients : ${socialProof[0].clients.slice(0, 3).join(", ")}`;
}

// ─── CTA Selection ──────────────────────────────────────

function selectCta(
  ctas: NonNullable<CompanyDna["ctas"]>,
  step: number,
): string | null {
  if (!ctas.length) return null;
  // Step 0 (PAS): medium commitment (demo, call, audit)
  // Step 1 (Value-add): low commitment (resource, insight)
  // Step 2 (Breakup): low commitment (when's better?)
  const targetCommitment = step === 0 ? "medium" : "low";
  const match = ctas.find((c) => c.commitment === targetCommitment);
  const selected = match ?? ctas[0];
  return selected.url ? `${selected.label} (${selected.url})` : selected.label;
}

// ─── Build "Who You Are" section ────────────────────────

function buildWhoYouAre(
  companyDna: CompanyDna | string,
  step: number,
  leadIndustry?: string | null,
  campaignAngle?: CampaignAngle,
): string {
  // String-only fallback (no structured DNA)
  if (typeof companyDna === "string") {
    return `## Qui tu es\n${companyDna}`;
  }

  const dna = companyDna;
  const parts: string[] = [];

  // Identity
  const oneLiner = campaignAngle?.angleOneLiner ?? dna.oneLiner;
  parts.push(`## QUI TU ES\n${oneLiner}`);

  // Problem
  const problem = campaignAngle?.mainProblem ?? dna.problemsSolved[0];
  if (problem) {
    parts.push(`Problème que tu résous : ${problem}`);
  }

  // Social proof (industry-matched)
  const proof = findRelevantProof(dna.socialProof ?? [], leadIndustry);
  const angleProof = campaignAngle?.proofPoint;
  if (proof || angleProof) {
    const lines = ["## PREUVES SOCIALES"];
    if (proof) lines.push(`- ${proof}`);
    if (angleProof && angleProof !== proof) lines.push(`- ${angleProof}`);
    if (dna.keyResults.length > 0) {
      lines.push(...dna.keyResults.slice(0, 2).map((r) => `- ${r}`));
    }
    parts.push(lines.join("\n"));
  } else if (dna.keyResults.length > 0) {
    parts.push(`## PREUVES\n${dna.keyResults.slice(0, 3).map((r) => `- ${r}`).join("\n")}`);
  }

  // Differentiators
  if (dna.differentiators.length > 0) {
    parts.push(`Ce qui te différencie : ${dna.differentiators.join(", ")}`);
  }

  // CTA
  const cta = selectCta(dna.ctas ?? [], step);
  if (cta) {
    parts.push(`## CTA À UTILISER\n${cta}`);
  }

  // Tone
  const tone = dna.toneOfVoice;
  if (tone) {
    const toneParts: string[] = [`Registre : ${tone.register}`];
    if (tone.traits.length > 0) toneParts.push(`Traits : ${tone.traits.join(", ")}`);
    const avoidWords = [
      ...(tone.avoidWords ?? []),
      ...(campaignAngle?.avoid ? [campaignAngle.avoid] : []),
    ];
    if (avoidWords.length > 0) toneParts.push(`À éviter : ${avoidWords.join(", ")}`);
    parts.push(`## TON\n${toneParts.join("\n")}`);
  } else if (campaignAngle?.tone) {
    parts.push(`## TON\n${campaignAngle.tone}`);
  }

  // Sender identity
  const sender = dna.senderIdentity;
  if (sender && (sender.name || sender.role)) {
    let senderLine = `## EXPÉDITEUR\n${sender.name}${sender.role ? `, ${sender.role}` : ""}`;
    if (step === 0 && sender.signatureHook) {
      senderLine += `\nSignature hook : ${sender.signatureHook}`;
    }
    parts.push(senderLine);
  }

  return parts.join("\n\n");
}

/**
 * Builds a structured email drafting prompt (SPEC-BACKEND.md section 5.2).
 * Consumes EnrichmentData JSON directly for personalization.
 */
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
${buildWhoYouAre(params.companyDna, params.step, params.lead.industry, params.campaignAngle)}

## Le prospect
- Prénom: ${params.lead.firstName ?? ""}
- Poste: ${params.lead.jobTitle ?? "unknown"}
- Entreprise: ${params.lead.company ?? "unknown"}
${params.lead.industry ? `- Industrie: ${params.lead.industry}` : ""}
${params.lead.companySize ? `- Taille entreprise: ${params.lead.companySize}` : ""}
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
- Max ${fw.maxWords} mots pour le body. Chaque mot doit mériter sa place.
- Objet : 2-4 mots, minuscule, pas de majuscule forcée, pas de ponctuation.
- 1 seul CTA orienté meeting/échange/appel. Jamais de "let me know" passif.
- 1 élément spécifique au prospect minimum (pain point, actu, signal).
- Langue : français si prospect FR, sinon anglais.
- Commence par le prénom, sans formule de politesse.
- FORMATAGE : utilise \\n pour les sauts de ligne dans le body JSON. Chaque bullet point sur sa propre ligne. Paragraphes séparés par \\n\\n.

JSON uniquement : {"subject": "...", "body": "..."}`.trim();
}
