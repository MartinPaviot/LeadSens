import { z } from "zod/v4";
import { mistralClient } from "@/server/lib/llm/mistral-client";
import type { CompanyDna } from "@/server/lib/enrichment/company-analyzer";

// ─── Schema ──────────────────────────────────────────────

export const campaignAngleSchema = z.object({
  angleOneLiner: z.string(),
  mainProblem: z.string(),
  proofPoint: z.string(),
  avoid: z.string(),
  tone: z.string(),
});

export type CampaignAngle = z.infer<typeof campaignAngleSchema>;

// ─── System Prompt ───────────────────────────────────────

const CAMPAIGN_ANGLE_SYSTEM = `Tu es un expert en cold email B2B. Tu adaptes le positionnement d'une offre au persona ciblé par la campagne.

À partir de l'offre du client et de la cible de la campagne, génère un "campaign angle" — c'est-à-dire le CADRAGE spécifique de l'offre pour CE type de prospect.

JSON uniquement :
{
  "angleOneLiner": "1 phrase : comment l'offre aide CE persona spécifiquement",
  "mainProblem": "Le problème N°1 que CE persona rencontre et que l'offre résout",
  "proofPoint": "La stat ou le cas client le plus pertinent pour CE persona (tiré des keyResults)",
  "avoid": "Ce qu'il ne faut PAS mentionner à CE persona (trop technique, trop marketing, etc.)",
  "tone": "Le registre adapté (technique, business, stratégique, opérationnel)"
}`;

// ─── Generation ──────────────────────────────────────────

export async function generateCampaignAngle(
  companyDna: CompanyDna,
  icpDescription: string,
  workspaceId: string,
): Promise<CampaignAngle> {
  return mistralClient.json<CampaignAngle>({
    model: "mistral-large-latest",
    system: CAMPAIGN_ANGLE_SYSTEM,
    prompt: `OFFRE DU CLIENT :\n${JSON.stringify(companyDna, null, 2)}\n\nCIBLE DE CETTE CAMPAGNE :\n${icpDescription}\n\nAdapte le positionnement de l'offre pour cette cible spécifique.`,
    schema: campaignAngleSchema,
    workspaceId,
    action: "campaign-angle",
    temperature: 0.5,
  });
}
