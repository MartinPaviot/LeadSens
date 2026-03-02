import { mistralClient } from "@/server/lib/llm/mistral-client";
import { buildEmailPrompt } from "./prompt-builder";
import type { EnrichmentData } from "@/server/lib/enrichment/summarizer";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";
import type { CampaignAngle } from "./campaign-angle";

interface LeadForDrafting {
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

/**
 * Drafts a single email for a lead using Mistral Large.
 *
 * UPGRADE PATH: To switch to Claude Sonnet, change only the
 * mistralClient.draftEmail() call below. No callers need to change.
 */
export async function draftEmail(params: {
  lead: LeadForDrafting;
  step: number;
  companyDna: CompanyDna | string;
  campaignAngle?: CampaignAngle;
  workspaceId: string;
  previousEmails?: DraftedEmailRef[];
  styleSamples?: string[];
}): Promise<{ subject: string; body: string }> {
  const prompt = buildEmailPrompt({
    lead: params.lead,
    step: params.step,
    companyDna: params.companyDna,
    campaignAngle: params.campaignAngle,
    previousEmails: params.previousEmails,
    styleSamples: params.styleSamples,
  });

  return mistralClient.draftEmail({
    system: `Tu es un expert en cold email B2B. Tu écris des emails ultra-concis qui déclenchent des réponses.

RÈGLES ABSOLUES :
- Objet : 2-4 mots max, minuscule, pas de clickbait, pas de [Prénom]
- Corps : phrases courtes, ton direct, comme un pair qui écrit à un pair
- UN SEUL CTA orienté échange (appel, meeting, chat) — jamais de CTA générique
- Commence par le prénom, sans "Bonjour" ni "Hi"
- Pas de signature, pas de "Cordialement"
- Pas de lien dans le premier email

FORMATAGE DU BODY (CRITIQUE) :
- Utilise \\n pour les sauts de ligne dans le JSON. Chaque idée = une nouvelle ligne.
- Les bullet points (✅, •, -) doivent CHACUN être sur une ligne séparée avec \\n avant chaque bullet.
- Sépare les paragraphes par \\n\\n (double saut de ligne).
- Exemple correct : "Thomas,\\n\\nTu cherches à scaler ton outbound.\\n\\n✅ Automatisation multicanal\\n✅ 600M+ leads\\n✅ Personnalisation IA\\n\\nUn call de 10 min ?"
- Exemple INCORRECT : "Thomas, Tu cherches... ✅ Auto ✅ 600M ✅ Perso" (tout sur une ligne)

INTERDITS (phrases mortes qui tuent le reply rate) :
- "I hope this finds you well" / "J'espère que tout va bien"
- "I came across your profile" / "J'ai vu votre profil"
- "I'd love to" / "Je me permets de"
- "Just checking in" / "Je me permets de revenir"
- "Let me know if you're interested" (trop passif)
- Toute flatterie sur l'entreprise ou le parcours

ADAPTATION AU PERSONA (basée sur le poste du prospect) :
- C-Level (CEO, COO, CFO) → Stratégique. Parler ROI, impact business, vision. Phrases ultra-courtes. Pas de détails techniques.
- Tech (CTO, VP Engineering, Dev Lead) → Technique et direct. Mentions concrètes (stack, perf, scale). Pas de bullshit marketing.
- Sales/Revenue (VP Sales, Head of Sales, SDR, AE) → Peer-to-peer, casual. Parler résultats, pipeline, quotas. Tutoiement OK si FR.
- Marketing (CMO, Head of Marketing, Growth) → Data-driven. Parler métriques, conversion, ROI campagne. Exemples chiffrés.
- Ops/Product (COO, Product Manager, Ops) → Pragmatique. Parler process, efficacité, gain de temps. Pas de flou.
- Si le poste ne rentre dans aucune catégorie → Ton neutre, professionnel mais pas corporate.

JSON uniquement : {"subject": "...", "body": "..."}`,
    prompt,
    workspaceId: params.workspaceId,
  });
}
