/**
 * One-shot script to generate 100 ICP descriptions via Mistral Large.
 * Run once: pnpm test:icp:generate
 * Review output, then commit descriptions.ts.
 */
import { jsonRaw } from "@/server/lib/llm/mistral-client";
import { writeFileSync } from "fs";
import { resolve } from "path";

const PROMPT = `Tu es un simulateur de prospects B2B. Genere 100 descriptions d'ICP (Ideal Customer Profile)
comme les ecrirait un VRAI humain qui repond a la question "Quel est votre client cible ?".

Regles :
- 50 en francais (ids 1-50), 50 en anglais (ids 51-100)
- Chaque description utilise le vocabulaire NATUREL du secteur (pas des termes generiques)
- Varie enormement : secteurs de niche, metiers rares, tailles variees, geographies variees
- Certaines descriptions sont vagues, d'autres tres precises
- Certaines mentionnent une geo, d'autres non
- Inclure des cas difficiles : abbreviations, argot metier, fautes, melanges FR/EN
- Ne JAMAIS utiliser les termes exacts d'un CRM ou d'une API (pas "Software & Internet", pas "0 - 25")
- Format : tableau JSON avec { id, description, language, sectorHint }

Diversite ciblee (5 FR + 5 EN par bucket) :
1. Industrie lourde / manufacturing / BTP
2. Services financiers / assurance / banque
3. Sante / pharma / biotech / medical
4. Tech / SaaS / AI / cybersecurite
5. Retail / e-commerce / mode / luxe
6. Education / formation / edtech
7. Transport / logistique / supply chain
8. Energie / environnement / cleantech
9. Services aux entreprises / conseil / RH / legal
10. Niches rares (agriculture, maritime, aero, defense, ONG, gouvernement, media, tourisme, immobilier, telecom)

Exemples de style :
- "Je cible les DAF de boites industrielles entre 200 et 2000 salaries en Ile-de-France"
- "We sell to heads of procurement at chemical manufacturing companies, 500+ employees, mainly DACH"
- "On vise les responsables formation dans les groupes hospitaliers francais"
- "I'm looking for IT directors at insurance firms, 1000-5000 employees, UK and Ireland"
- "On cherche des patrons de PME du BTP dans le sud de la France"
- "Looking for supply chain VPs at food & bev companies across Southeast Asia"

sectorHint = le secteur vise en anglais, court (2-4 mots), pour un evaluateur humain.

Reponds UNIQUEMENT avec le JSON array, pas de texte avant/apres.`;

async function main() {
  console.log("Generating 100 ICP descriptions via Mistral Large...");

  const result = await jsonRaw({
    model: "mistral-large-latest",
    system: "You generate realistic test data. Output valid JSON only.",
    prompt: PROMPT,
    workspaceId: "test-generate",
    action: "generate-descriptions",
    temperature: 0.9,
  });

  const descriptions = Array.isArray(result) ? result : (result as Record<string, unknown>).descriptions;

  if (!Array.isArray(descriptions) || descriptions.length < 90) {
    console.error("Expected 100 descriptions, got:", Array.isArray(descriptions) ? descriptions.length : typeof descriptions);
    console.log(JSON.stringify(result).slice(0, 2000));
    process.exit(1);
  }

  // Generate TypeScript file
  const tsContent = `import type { TestCase } from "./types";

/**
 * 100 realistic ICP descriptions — generated once, committed for reproducibility.
 * 50 French (ids 1-50) + 50 English (ids 51-100).
 * DO NOT regenerate unless you want to reset the baseline.
 */
export const TEST_CASES: TestCase[] = ${JSON.stringify(descriptions, null, 2)};
`;

  const outPath = resolve(__dirname, "descriptions.ts");
  writeFileSync(outPath, tsContent, "utf-8");
  console.log(`Wrote ${descriptions.length} descriptions to ${outPath}`);
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
