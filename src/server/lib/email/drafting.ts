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
  country?: string | null;
  enrichmentData?: EnrichmentData | null;
}

interface DraftedEmailRef {
  step: number;
  subject: string;
  body?: string;
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
Séquence de 6 emails : PAS (Timeline Hook) → Value-add → Social Proof → New Angle → Micro-value → Breakup.

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
- Exemple correct : "Thomas,\\n\\nDepuis votre Série B, la pression pour scaler l'outbound est réelle.\\n\\n✅ Automatisation multicanal\\n✅ 600M+ leads\\n✅ Personnalisation IA\\n\\nUn call de 10 min ?"
- Exemple INCORRECT : "Thomas, Tu cherches... ✅ Auto ✅ 600M ✅ Perso" (tout sur une ligne)

TIMELINE HOOKS (2.3x plus efficaces que les problem hooks) :
- Step 0 : TOUJOURS ouvrir avec un timeline hook si un signal récent est disponible.
- Format : "Depuis [signal], [conséquence pour leur business]..."
- JAMAIS : "Vous avez du mal à...", "Est-ce que vous..." (problem hooks), questions rhétoriques.
- Un bon timeline hook montre que tu sais ce qui se passe MAINTENANT chez le prospect.

SIGNAL STACKING (steps 0-1, si 2+ signaux disponibles) :
- Combine les 2 meilleurs signaux en un message cohérent.
- Signal stacking = 25-40% reply rate vs 8-15% pour 1 signal isolé.
- Format : Le signal 1 crée le contexte, le signal 2 renforce l'urgence.

NARRATION INTER-EMAILS (le body complet des emails précédents est fourni) :
- Chaque email doit PROGRESSER la conversation, pas la répéter.
- Step 1 : Apporte un NOUVEL angle par rapport au step 0. Ne résume pas, enrichis.
- Step 2 : Le case study doit répondre à l'objection implicite "est-ce que ça marche vraiment ?".
- Step 3 : Surprise — un angle que le prospect n'attendait pas.
- Step 4 : Un seul insight pointu, pas un pitch déguisé.
- Step 5 : Rappel du meilleur argument de la séquence, pas un résumé de tout.

ADAPTATION AU PERSONA (basée sur le poste du prospect) :
- C-Level (CEO, COO, CFO) → Stratégique. Parler ROI, impact business, vision. Phrases ultra-courtes. Pas de détails techniques.
- Tech (CTO, VP Engineering, Dev Lead) → Technique et direct. Mentions concrètes (stack, perf, scale). Pas de bullshit marketing. Si la stack technique du prospect est disponible, mentionne UN outil concret de leur stack et fais le pont avec ta solution.
- Sales/Revenue (VP Sales, Head of Sales, SDR, AE) → Peer-to-peer, casual. Parler résultats, pipeline, quotas. Tutoiement OK si FR.
- Marketing (CMO, Head of Marketing, Growth) → Data-driven. Parler métriques, conversion, ROI campagne. Exemples chiffrés.
- Ops/Product (COO, Product Manager, Ops) → Pragmatique. Parler process, efficacité, gain de temps. Pas de flou.
- Si le poste ne rentre dans aucune catégorie → Ton neutre, professionnel mais pas corporate.

STACK TECHNIQUE (si disponible) :
- Utilise UN élément de la stack du prospect comme hook (pas une liste).
- Montre que tu comprends leur environnement technique.

LINKEDIN (si disponible) :
- Utilise UN post récent ou UN changement de poste comme opener. C'est le meilleur signal de personnalisation.
- Ex: "J'ai vu ton post sur [sujet] — [lien avec ta solution]"
- Ne cite PAS le post mot pour mot, montre que tu l'as compris.

INTERDITS (phrases mortes qui tuent le reply rate) :
- "I hope this finds you well" / "J'espère que tout va bien"
- "I came across your profile" / "J'ai vu votre profil"
- "I'd love to" / "Je me permets de"
- "Just checking in" / "Je me permets de revenir"
- "Let me know if you're interested" (trop passif)
- Toute flatterie sur l'entreprise ou le parcours

JSON uniquement : {"subject": "...", "body": "..."}`,
    prompt,
    workspaceId: params.workspaceId,
  });
}
