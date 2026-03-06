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
  country?: string | null;
  enrichmentData?: EnrichmentData | null;
}

interface DraftedEmailRef {
  step: number;
  subject: string;
  body?: string;
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
        name: "PAS (Timeline Hook)",
        instructions:
          "Framework PAS (Problem-Agitate-Solve) avec TIMELINE HOOK. " +
          "1) OPENER : utilise le signal le plus récent et pertinent comme timeline hook. Format gagnant : \"Depuis [signal], [conséquence pour leur business]...\" " +
          "2) Une phrase qui amplifie — conséquence concrète de ce problème. " +
          "3) Présente ta solution en 1 phrase avec timeline proof si disponible. " +
          "CTA : question ouverte orientée échange (medium commitment). Ex: 'Ça vaudrait un échange de 10 min ?'",
        objective: "Déclencher la curiosité via un signal concret. Le prospect doit se dire 'il sait ce qui se passe chez nous'.",
        maxWords: 90,
      };
    case 1:
      return {
        name: "Value-add",
        instructions:
          "Apporte de la valeur concrète : un insight chiffré, un benchmark secteur, ou un case study avec TIMELINE (ex: 'En 90 jours, [client] a atteint [résultat]'). " +
          "PAS de 'suite à mon dernier email'. Le prospect doit apprendre quelque chose. " +
          "Utilise un signal DIFFÉRENT du step 0. Si signal stacking possible (2+ signaux), combine-les. " +
          "CTA : low commitment (resource, insight). Ex: 'Je t'envoie le benchmark ?'",
        objective: "Se positionner comme un pair qui apporte de la valeur. Case study + timeline = crédibilité.",
        maxWords: 70,
      };
    case 2:
      return {
        name: "Social Proof",
        instructions:
          "Case study détaillé dans le MÊME SECTEUR que le prospect. Format narratif : " +
          "'[Client similaire] avait [même problème]. En [timeline], ils ont atteint [résultat]. " +
          "Avec [taille/contexte similaire], tu pourrais [projection].' " +
          "Si pas de case study même secteur, utilise le meilleur case study disponible avec projection. " +
          "CTA : medium commitment (demo, call).",
        objective: "Faire projeter le prospect dans le résultat. Narration > listing de features.",
        maxWords: 80,
      };
    case 3:
      return {
        name: "New Angle",
        instructions:
          "Angle COMPLÈTEMENT différent des steps 0-2. " +
          "Utilise un signal non exploité précédemment (techStackChanges, publicPriorities, ou un pain point inexploré). " +
          "Élément de surprise — aborde un problème que le prospect n'a peut-être pas identifié lui-même. " +
          "CTA : low commitment (question ouverte, partage d'insight).",
        objective: "Relancer l'attention avec une perspective inattendue. Montrer la profondeur de ta compréhension.",
        maxWords: 65,
      };
    case 4:
      return {
        name: "Micro-value",
        instructions:
          "3-4 phrases maximum. UN SEUL insight actionable qui démontre ton expertise du domaine. " +
          "Peut être : une stat récente du secteur, un tip pratique, une observation sur leur marché. " +
          "Question ouverte à la fin — pas de pitch, juste de la valeur pure. " +
          "CTA : low commitment (question ouverte).",
        objective: "Ultra-court, ultra-ciblé. Le prospect doit se dire 'ce type connaît mon métier'.",
        maxWords: 50,
      };
    case 5:
      return {
        name: "Breakup",
        instructions:
          "2-3 phrases max. Reconnaître que c'est pas forcément le bon timing. " +
          "Rappeler LE meilleur résultat de toute la séquence (le case study ou la stat la plus forte). " +
          "Laisser la porte ouverte sans pression. " +
          "CTA : low commitment. Ex: 'Si le timing est meilleur plus tard, dis-moi quand.'",
        objective: "Fermer la boucle proprement. Low-pressure, high-respect. Rappel du meilleur argument.",
        maxWords: 50,
      };
    default:
      return getFramework(0);
  }
}

// ─── Signal Prioritization ──────────────────────────────

interface PrioritizedSignal {
  type: string;
  label: string;
  detail: string;
  recency: "recent" | "older" | "unknown";
}

function classifyRecency(dateStr: string | null | undefined): "recent" | "older" | "unknown" {
  if (!dateStr) return "unknown";
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return "unknown";
  return parsed >= sixMonthsAgo ? "recent" : "older";
}

function prioritizeSignals(ed: EnrichmentData): PrioritizedSignal[] {
  const signals: PrioritizedSignal[] = [];

  // 1. Leadership changes (14-25% reply rate)
  for (const lc of ed.leadershipChanges ?? []) {
    signals.push({
      type: "leadership_change",
      label: "Leadership",
      detail: lc.event + (lc.date ? ` (${lc.date})` : ""),
      recency: classifyRecency(lc.date),
    });
  }

  // 2. Funding signals (12-20% reply rate)
  for (const f of ed.fundingSignals ?? []) {
    signals.push({
      type: "funding",
      label: "Financement",
      detail: f,
      recency: "unknown",
    });
  }

  // 3. Hiring signals (10-18% reply rate)
  for (const h of ed.hiringSignals ?? []) {
    signals.push({
      type: "hiring",
      label: "Recrutement",
      detail: h,
      recency: "unknown",
    });
  }

  // 4. Public priorities (10-15% reply rate)
  for (const pp of ed.publicPriorities ?? []) {
    signals.push({
      type: "public_priority",
      label: "Priorité publique",
      detail: pp.statement + (pp.date ? ` (${pp.date})` : ""),
      recency: classifyRecency(pp.date),
    });
  }

  // 5. Tech stack changes (8-15% reply rate)
  for (const tc of ed.techStackChanges ?? []) {
    signals.push({
      type: "tech_stack_change",
      label: "Stack technique",
      detail: tc.change + (tc.date ? ` (${tc.date})` : ""),
      recency: classifyRecency(tc.date),
    });
  }

  // 6. Generic signals (fallback)
  for (const s of ed.signals ?? []) {
    signals.push({
      type: "signal",
      label: "Signal",
      detail: s,
      recency: "unknown",
    });
  }

  // Sort: recent first, then by type priority (already ordered by push sequence)
  signals.sort((a, b) => {
    const recencyOrder = { recent: 0, unknown: 1, older: 2 };
    return recencyOrder[a.recency] - recencyOrder[b.recency];
  });

  return signals;
}

function buildSignalsSection(ed: EnrichmentData): string {
  const signals = prioritizeSignals(ed);
  if (signals.length === 0) return "";

  const lines = ["## SIGNAUX D'ACHAT (par priorité)"];
  for (let i = 0; i < signals.length && i < 8; i++) {
    const s = signals[i];
    const recencyTag = s.recency === "recent" ? " ★ RÉCENT" : "";
    lines.push(`${i + 1}. [${s.type}] ${s.detail}${recencyTag}`);
  }

  if (signals.filter((s) => s.recency === "recent").length >= 2) {
    lines.push("");
    lines.push("⚡ SIGNAL STACKING POSSIBLE : 2+ signaux récents disponibles. Combine les 2 meilleurs dans les steps 0-1 pour 25-40% reply rate (vs 8-15% pour 1 signal isolé).");
  }

  return lines.join("\n");
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

// ─── Case Study Matching ────────────────────────────────

function findRelevantCaseStudy(
  caseStudies: NonNullable<CompanyDna["caseStudies"]>,
  leadIndustry?: string | null,
): string | null {
  if (!caseStudies.length) return null;

  let best = caseStudies[0];

  // Try industry match
  if (leadIndustry) {
    const needle = leadIndustry.toLowerCase();
    const match = caseStudies.find(
      (cs) =>
        cs.industry.toLowerCase().includes(needle) ||
        needle.includes(cs.industry.toLowerCase()),
    );
    if (match) best = match;
  }

  return `En ${best.timeline}, ${best.client} (${best.industry}) a atteint ${best.result}${best.context ? ` — ${best.context}` : ""}`;
}

// ─── CTA Selection ──────────────────────────────────────

function selectCta(
  ctas: NonNullable<CompanyDna["ctas"]>,
  step: number,
): string | null {
  if (!ctas.length) return null;
  // Steps 0, 2 = medium commitment (demo, call, audit)
  // Steps 1, 3, 4, 5 = low commitment (resource, insight, question)
  const targetCommitment = step === 0 || step === 2 ? "medium" : "low";
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

  // Case studies (industry-matched, timeline format)
  const caseStudy = findRelevantCaseStudy(dna.caseStudies ?? [], leadIndustry);
  if (caseStudy) {
    parts.push(`## CASE STUDY (format timeline)\n${caseStudy}`);
  }

  // Timeline proof & signal hooks from campaign angle
  if (campaignAngle?.timelineProof) {
    parts.push(`Timeline proof : ${campaignAngle.timelineProof}`);
  }
  if (campaignAngle?.signalHooks?.length) {
    parts.push(`## SIGNAL HOOKS\n${campaignAngle.signalHooks.map((h) => `- ${h}`).join("\n")}`);
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

// ─── Previous Emails Section ────────────────────────────

function buildPreviousEmailsSection(previousEmails: DraftedEmailRef[]): string {
  if (!previousEmails.length) return "";

  const lines = ["## Emails précédents (NE PAS répéter, PROGRESSE la conversation)"];
  for (const email of previousEmails) {
    lines.push(`### Step ${email.step} — "${email.subject}"`);
    if (email.body) {
      const truncated = email.body.length > 500 ? email.body.slice(0, 500) + "..." : email.body;
      lines.push(`Body: ${truncated}`);
    }
  }
  return lines.join("\n");
}

/**
 * Builds a structured email drafting prompt.
 * 6-step sequence with signal intelligence and timeline hooks.
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

  // Build prioritized signals section
  const signalsSection = ed ? buildSignalsSection(ed) : "";

  return `
${buildWhoYouAre(params.companyDna, params.step, params.lead.industry, params.campaignAngle)}

## Le prospect
- Prénom: ${params.lead.firstName ?? ""}
- Poste: ${params.lead.jobTitle ?? "unknown"}
- Entreprise: ${params.lead.company ?? "unknown"}
${params.lead.industry ? `- Industrie: ${params.lead.industry}` : ""}
${params.lead.companySize ? `- Taille entreprise: ${params.lead.companySize}` : ""}
${params.lead.country ? `- Localisation: ${params.lead.country}` : ""}
${ed?.companySummary ? `- Activité: ${ed.companySummary}` : ""}
${ed?.painPoints?.length ? `- Pain points: ${ed.painPoints.join(", ")}` : ""}
${ed?.products?.length ? `- Produits/Services: ${ed.products.join(", ")}` : ""}
${ed?.targetMarket ? `- Marché cible: ${ed.targetMarket}` : ""}
${ed?.valueProposition ? `- Proposition de valeur: ${ed.valueProposition}` : ""}
${ed?.techStack?.length ? `- Stack technique: ${ed.techStack.join(", ")}` : ""}
${ed?.industry ? `- Industrie (enrichie): ${ed.industry}` : ""}
${ed?.linkedinHeadline ? `- Headline LinkedIn: ${ed.linkedinHeadline}` : ""}
${ed?.recentLinkedInPosts?.length ? `- Posts LinkedIn récents: ${ed.recentLinkedInPosts.join(" | ")}` : ""}
${ed?.careerHistory?.length ? `- Parcours: ${ed.careerHistory.join(" → ")}` : ""}

${signalsSection}

## INSTRUCTION CRITIQUE — Connection Bridge
Ne LISTE PAS les pain points du prospect séparément.
Choisis LE SEUL pain point qui résonne le plus avec ta solution (section "QUI TU ES").
Construis TOUT l'email autour de ce pont unique :
  1. Signal ou problème spécifique du prospect
  2. → Capacité spécifique de ta solution qui résout CE problème
  3. → Preuve avec TIMELINE (cas client, chiffre, durée) qui démontre le résultat
Si aucun pain point ne matche → utilise le signal d'achat le plus récent.

## Framework — Step ${params.step}: ${fw.name}
${fw.instructions}

## Objectif
${fw.objective}

${params.previousEmails?.length ? buildPreviousEmailsSection(params.previousEmails) : ""}
${params.styleSamples?.length ? `## Style guide\n${params.styleSamples.join("\n")}` : ""}

${params.step === 0 ? `## TIMELINE HOOK (step 0 uniquement)
Format gagnant : "Depuis [signal], [conséquence pour leur business]..."
C'est 2.3x plus efficace que les problem hooks ou les questions rhétoriques.

Priorité d'opener :
1. Signal récent (★ RÉCENT dans la liste) → Timeline hook obligatoire
2. Actu/news récente → Référence directe avec conséquence
3. Changement de poste LinkedIn → Référence au nouveau rôle
4. Si aucun signal → Observation sectorielle data-driven

ÉVITER : problem hooks ("Vous avez du mal à..."), questions rhétoriques, flatterie, "Je me permets de..."
` : ""}${params.step <= 1 && signalsSection.includes("SIGNAL STACKING") ? `## SIGNAL STACKING (steps 0-1)
Combine les 2 meilleurs signaux dans ton message. Le signal stacking (2-3 signaux combinés) génère 25-40% de reply rate vs 8-15% pour 1 signal isolé.
Format : "[Signal 1] + [Signal 2] → [conséquence combinée] → [ta solution]"
` : ""}## Contraintes
- Max ${fw.maxWords} mots pour le body. Chaque mot doit mériter sa place.
- Objet : 2-4 mots, minuscule, pas de majuscule forcée, pas de ponctuation.
- 1 seul CTA orienté meeting/échange/appel. Jamais de "let me know" passif.
- 1 élément spécifique au prospect minimum (signal, actu, pain point).
- Langue : français si prospect FR, sinon anglais.
- Commence par le prénom, sans formule de politesse.
- FORMATAGE : utilise \\n pour les sauts de ligne dans le body JSON. Chaque bullet point sur sa propre ligne. Paragraphes séparés par \\n\\n.

JSON uniquement : {"subject": "...", "body": "..."}`.trim();
}
