# LLM-AUDIT.md — Cartographie complète des appels LLM

> **Objectif :** Documenter chaque point d'appel LLM dans LeadSens pour challenger les prompts, les modeles, les temperatures, les schemas de sortie, et le rapport qualite/cout.
>
> **Derniere mise a jour :** 2026-02-28

---

## Vue d'ensemble

| # | Appel | Modele | Methode | Temperature | Max tokens | Format sortie | Fichier source | Action log |
|---|-------|--------|---------|-------------|-----------|---------------|----------------|------------|
| 1 | Chat agent (conversation) | `mistral-large-latest` | `chatStream()` | 0.7 | - | Texte libre + tool calls | `api/agents/chat/route.ts` | `chat-stream` |
| 2 | ~~Greeting~~ | **Aucun** | Deterministe | - | - | Texte statique contextuel | `api/agents/chat/route.ts` | - |
| 3 | ICP Parsing (NL → filtres) | `mistral-large-latest` | `json()` | 0.3 | - | JSON valide Zod | `tools/icp-parser.ts` | `icp-parse` |
| 4 | ICP Scoring (classification) | `mistral-small-latest` | `json()` | 0.3 | - | JSON valide Zod | `enrichment/icp-scorer.ts` | `icp-scoring` |
| 5 | Company Summarization | `mistral-small-latest` | `json()` | 0.3 | - | JSON valide Zod | `enrichment/summarizer.ts` | `enrichment-summarize` |
| 6 | Email Drafting | `mistral-large-latest` | `draftEmail()` | 0.8 | 1024 | JSON `{subject, body}` | `email/drafting.ts` | `draft-email` |
| 7 | Company DNA Analysis | `mistral-large-latest` | `json()` | 0.3 | - | JSON valide Zod | `enrichment/company-analyzer.ts` | `company-analysis` |
| 8 | Campaign Angle | `mistral-large-latest` | `json()` | 0.5 | - | JSON valide Zod | `email/campaign-angle.ts` | `campaign-angle` |

**Cout estimatif (pricing Mistral, code source `ai-events.ts`) :**
- `mistral-large-latest` : $2.00/M tokens input, $6.00/M tokens output
- `mistral-small-latest` : $0.10/M tokens input, $0.30/M tokens output

---

## 1. CHAT AGENT — Conversation principale

### Fiche technique

| Parametre | Valeur |
|-----------|--------|
| **Fichier** | `src/app/api/agents/chat/route.ts` lignes 249-257 |
| **Methode** | `mistralClient.chatStream()` |
| **Modele** | `mistral-large-latest` |
| **Temperature** | 0.7 |
| **Max steps (tool loop)** | 5 |
| **Streaming** | Oui — SSE `data: {json}\n\n` |
| **Tool calling** | Oui — tous les tools du `buildToolSet()` |
| **Action log** | `chat-stream` |

### System Prompt (statique)

```
Tu es LeadSens, un agent de prospection B2B intelligent.

PERSONNALITE :
- Direct et efficace, pas de blabla
- Tu montres ton travail en temps reel (status updates)
- Tu poses les bonnes questions quand c'est necessaire
- Ton decontracte mais professionnel

WORKFLOW PRINCIPAL :
1. Comprendre l'ICP (description en langage naturel)
2. Parser en filtres Instantly SuperSearch
3. Estimer le nombre de leads, demander confirmation
4. Sourcer via SuperSearch (credits du client)
5. Verifier doublons CRM (si connecte)
6. Scorer les leads sur donnees brutes Instantly (skip < 5)
7. Enrichir les leads qualifies via Jina Reader + Mistral
8. Demander le ton/angle pour les emails
9. Rediger 3 emails par lead (PAS, Value-add, Breakup)
10. Montrer des previews, permettre les corrections
11. Creer la campagne Instantly et pousser les leads
12. Confirmer que tout est pret

REGLES :
- Ne source JAMAIS sans confirmation (credits du client)
- Montre TOUJOURS un apercu avant de creer dans Instantly
- Score AVANT d'enrichir — on ne gaspille pas de credits Jina sur des leads non qualifies
- Les emails suivent les frameworks PAS / Value-add / Breakup — JAMAIS improvises
- Sauvegarde en memoire : companyDna, ICPs, preferences de style
```

> **Source :** `route.ts` lignes 14-41

### System Prompt (dynamique — append conditionnel)

Le system prompt est enrichi dynamiquement (lignes 58-89) avec 4 sections optionnelles :

```
## Your client's company
{workspace.companyDna}
// → Ajoute SEULEMENT si workspace.companyDna existe

## What you remember
- {key}: {value}
- {key}: {value}
// → Ajoute SEULEMENT si des AgentMemory existent pour ce workspace

## Style Guide (learn from these corrections)
Original: "..."
Corrected: "..."
// → Ajoute SEULEMENT si des USER_EDIT existent (getStyleSamples, max 5)

## Connected integrations
INSTANTLY, HUBSPOT
// → Toujours present. "None yet" si rien connecte
```

### User Message

Le dernier message de l'historique `messages[]` envoye par le frontend.

### Points a challenger

- [ ] Le system prompt est-il trop long ? (plus il est long, plus ca coute en input tokens a chaque echange)
- [ ] Le workflow en 12 etapes est-il suivi naturellement par le modele ou est-ce juste decoratif ?
- [ ] "Ton decontracte mais professionnel" — est-ce que le modele le respecte vraiment ?
- [ ] Les memories et style corrections sont injectes en brut — risque d'injection si l'user met du contenu malveillant ?
- [ ] Max 5 steps de tool calling — suffisant pour un flow complet sourcing → scoring → enrichment → drafting ?
- [ ] Temperature 0.7 — assez creatif pour le chat, mais pas trop instable ?

---

## 2. GREETING — Message d'accueil (DETERMINISTE — plus de LLM)

### Fiche technique

| Parametre | Valeur |
|-----------|--------|
| **Fichier** | `src/app/api/agents/chat/route.ts` — `buildGreeting()` |
| **Methode** | Deterministe (aucun appel LLM) |
| **Cout** | $0 |
| **Latence** | ~0ms (juste une query DB workspace) |

### Logique contextuelle

Le greeting est construit en fonction de l'etat reel du workspace :

| Etat | CompanyDna | Instantly | Message |
|------|-----------|-----------|---------|
| **Onboarding complet** | Non | Non | Presentation + demande URL site + instructions Instantly |
| **Instantly ok, pas de DNA** | Non | Oui | Demande URL site uniquement |
| **DNA ok, pas d'Instantly** | Oui | Non | Rappelle le oneLiner + instructions Instantly |
| **Tout pret** | Oui | Oui | Rappelle le oneLiner + demande ICP pour la campagne |

### Messages (verbatim du code)

**Case 1 — Rien configure :**
```
Salut ! Je suis LeadSens, ton copilote de prospection B2B.

Avant de lancer ta premiere campagne, j'ai besoin de deux choses :

1. **L'URL de ton site** — je vais analyser ton offre pour personnaliser chaque email
2. **Ton compte Instantly connecte** — va dans Settings > Integrations et colle ton API key V2

Une fois tout ca en place, tu me decris ta cible et je gere le reste : sourcing, scoring,
enrichissement, redaction, et push dans Instantly.

On commence ? Envoie-moi l'URL de ton site.
```

**Case 2 — Instantly ok, pas de DNA :**
```
Salut ! Instantly est connecte, nickel.

Il me manque juste **l'URL de ton site** pour comprendre ton offre. Je vais analyser ta homepage,
ta page about et ton pricing pour en tirer les arguments cles qu'on utilisera dans les emails.

Envoie-moi ton URL et on demarre.
```

**Case 3 — DNA ok, pas d'Instantly :**
```
Salut ! Je connais ton offre : *{oneLiner}*

Il me manque **ton compte Instantly** pour sourcer et envoyer. Va dans Settings > Integrations
et colle ton API key V2.

Une fois connecte, decris-moi ta cible et on lance ta campagne.
```

**Case 4 — Tout pret :**
```
Salut ! Tout est pret — {oneLiner}, Instantly connecte.

Decris-moi ta cible pour cette campagne : role, secteur, taille d'entreprise, geo.
Par exemple : *"VP Sales dans le SaaS B2B, 50-200 employes, France"*.

Je m'occupe du sourcing, scoring, enrichissement, redaction personnalisee et push dans Instantly.
```

### Pourquoi deterministe et pas LLM

- **Cout : $0** au lieu de ~$0.002 par greeting (tokens Large)
- **Latence : instantane** au lieu de 1-3s d'attente Mistral
- **Fiable a 100%** — pas de risque de greeting hors sujet
- **Guide l'user** vers la bonne action au lieu d'un "Comment puis-je t'aider ?" generique

---

## 3. ICP PARSING — Langage naturel → Filtres Instantly

### Fiche technique

| Parametre | Valeur |
|-----------|--------|
| **Fichier** | `src/server/lib/tools/icp-parser.ts` |
| **Methode** | `mistralClient.json<InstantlySearchFilters>()` |
| **Modele** | `mistral-large-latest` |
| **Temperature** | 0.3 (force par `json()`) |
| **Format sortie** | `json_object` (force cote Mistral) |
| **Validation** | Zod `searchFiltersSchema` |
| **Action log** | `icp-parse` |

### System Prompt

```
You are an ICP (Ideal Customer Profile) parser. Convert natural language descriptions
of target prospects into structured Instantly SuperSearch filters.

Available filters:
- job_titles: string[] — Job title keywords (e.g., ["CTO", "VP Engineering", "Head of Engineering"])
- locations: string[] — Country/city names (e.g., ["France", "United States", "Paris"])
- industries: string[] — Industry names (e.g., ["SaaS", "FinTech", "Healthcare"])
- employee_count: string[] — Company size ranges: "1-10", "11-50", "51-200", "201-500",
  "501-1000", "1001-5000", "5001-10000", "10001+"
- revenue: string[] — Revenue ranges: "0-1M", "1M-10M", "10M-50M", "50M-100M",
  "100M-500M", "500M-1B", "1B+"
- funding_type: string[] — Funding stages (e.g., ["seed", "series_a", "series_b"])
- level: string[] — Seniority: "c_suite", "vp", "director", "manager", "senior", "entry"
- department: string[] — Department: "engineering", "finance", "hr", "it", "legal",
  "marketing", "operations", "sales", "support"
- keyword_filter: string — General keyword to filter by
- news: string — Recent news keyword filter
- show_one_lead_per_company: boolean — Only one lead per company

RULES:
- ALWAYS set skip_owned_leads: true
- For job titles, add common variations (e.g., "CTO" → ["CTO", "Chief Technology Officer",
  "Chief Technical Officer"])
- Interpret French AND English descriptions
- Only include filters that are clearly specified or strongly implied
- Output valid JSON matching the schema exactly
```

> **Note :** Le suffix `\n\nJSON only, no markdown, no comments.` est ajoute automatiquement par la methode `json()` du client.

### User Prompt

```
Convert this ICP description into Instantly SuperSearch filters:

{description fournie par l'utilisateur}
```

### Schema de sortie (Zod)

```typescript
searchFiltersSchema = z.object({
  job_titles: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  employee_count: z.array(z.string()).optional(),
  revenue: z.array(z.string()).optional(),
  funding_type: z.array(z.string()).optional(),
  level: z.array(z.string()).optional(),
  department: z.array(z.string()).optional(),
  keyword_filter: z.string().optional(),
  news: z.string().optional(),
  show_one_lead_per_company: z.boolean().optional(),
  skip_owned_leads: z.boolean().optional(),
})
```

### Post-processing

`result.skip_owned_leads = true` est force cote code apres le parsing (ligne 43).

### Points a challenger

- [ ] Le system prompt liste toutes les valeurs possibles pour chaque filtre — est-ce que le modele les respecte exactement ou invente des variantes ?
- [ ] "Interpret French AND English" — teste avec des descriptions ambigues FR/EN ?
- [ ] Si la description est vague ("je veux des CTOs"), le modele doit-il inventer des filtres (industries, location) ou laisser vide ?
- [ ] `skip_owned_leads` est force en post-processing — pourquoi ne pas le retirer du prompt pour economiser des tokens ?
- [ ] Pas de few-shot examples dans le prompt — ca aiderait la fiabilite du JSON ?

---

## 4. ICP SCORING — Classification sur donnees brutes

### Fiche technique

| Parametre | Valeur |
|-----------|--------|
| **Fichier** | `src/server/lib/enrichment/icp-scorer.ts` |
| **Methode** | `mistralClient.json<IcpScore>()` |
| **Modele** | `mistral-small-latest` |
| **Temperature** | 0.3 (force par `json()`) |
| **Format sortie** | `json_object` |
| **Validation** | Zod `icpScoreSchema` |
| **Action log** | `icp-scoring` |
| **Volume** | 1 appel par lead (N appels sequentiels dans `score_leads_batch`) |

### System Prompt

```
You are an ICP scoring engine. Score 1-10 with breakdown. JSON only, no comments.
```

> **Note :** + suffix automatique `\n\nJSON only, no markdown, no comments.`

### User Prompt (template)

```
ICP: {icpDescription fournie par l'utilisateur}

Lead (raw Instantly data):
- Name: {firstName} {lastName}
- Job Title: {jobTitle ?? "unknown"}
- Company: {company ?? "unknown"}
- Industry: {industry ?? "unknown"}
- Company Size: {companySize ?? "unknown"}
- Location: {country ?? "unknown"}

Score this lead 1-10. JSON: {"score": N, "breakdown": {"jobTitleFit": N, "companyFit": N,
"industryRelevance": N, "locationFit": N}, "reason": "one sentence"}
```

### Schema de sortie (Zod)

```typescript
icpScoreSchema = z.object({
  score: z.number().int().min(1).max(10),
  breakdown: z.object({
    jobTitleFit: z.number().int().min(1).max(10),
    companyFit: z.number().int().min(1).max(10),
    industryRelevance: z.number().int().min(1).max(10),
    locationFit: z.number().int().min(1).max(10),
  }),
  reason: z.string(),
})
```

### Logique de seuil

- Score >= 5 → status `SCORED` (passe a l'enrichissement)
- Score < 5 → status `SKIPPED` (pas de scraping, pas d'email)

### Points a challenger

- [ ] Le system prompt est extremement court (1 ligne) — le modele a-t-il assez de contexte pour scorer correctement ?
- [ ] Pas de definition de ce que signifie chaque score (1 = ?, 5 = ?, 10 = ?) — le modele interprete librement
- [ ] Le `score` global n'est pas defini comme une moyenne ou une formule des sous-scores — coherence ?
- [ ] "reason: one sentence" — parfois insuffisant pour comprendre le scoring
- [ ] Les champs "unknown" sont frequents (industry, companySize) — comment le modele gere-t-il le manque de donnees ?
- [ ] Volume potentiel : 500 appels sequentiels pour 500 leads — pas de batching ? Temps total ?
- [ ] Le seuil de 5 est hardcode — devrait-il etre configurable par workspace ?
- [ ] Pas de calibration : est-ce que le modele a tendance a sur-scorer ou sous-scorer ?
- [ ] Le prompt melange FR (description ICP user) et EN (structure du prompt) — confusion possible ?

---

## 5. COMPANY SUMMARIZATION — Markdown Jina → JSON structure

### Fiche technique

| Parametre | Valeur |
|-----------|--------|
| **Fichier** | `src/server/lib/enrichment/summarizer.ts` |
| **Methode** | `mistralClient.json<EnrichmentData>()` |
| **Modele** | `mistral-small-latest` |
| **Temperature** | 0.3 (force par `json()`) |
| **Format sortie** | `json_object` |
| **Validation** | Zod `enrichmentDataSchema` |
| **Action log** | `enrichment-summarize` |
| **Input** | Markdown brut tronque a 5000 chars (Jina Reader) |

### System Prompt

```
Extract structured info from this company website. Return ONLY valid JSON:
{
  "companySummary": "2-3 sentences",
  "products": ["..."],
  "targetMarket": "who they sell to",
  "valueProposition": "main pitch",
  "painPoints": ["pain point 1", "pain point 2"],
  "recentNews": [],
  "techStack": [],
  "teamSize": "estimate or null",
  "signals": ["buying signals"]
}
If not found → null or []. NEVER hallucinate.
```

> **Note :** + suffix automatique `\n\nJSON only, no markdown, no comments.`

### User Prompt

Le markdown brut retourne par Jina Reader (tronque a 5000 caracteres).

### Schema de sortie (Zod)

```typescript
enrichmentDataSchema = z.object({
  companySummary: z.string().nullable(),
  products: z.array(z.string()),
  targetMarket: z.string().nullable(),
  valueProposition: z.string().nullable(),
  painPoints: z.array(z.string()),
  recentNews: z.array(z.string()),
  techStack: z.array(z.string()),
  teamSize: z.string().nullable(),
  signals: z.array(z.string()),
})
```

### Chaine d'appel

```
Lead (website ou guess URL)
  → Jina Reader (fetch r.jina.ai/{url}) → markdown brut (max 5000 chars)
    → Mistral Small json() → EnrichmentData JSON
      → Stocke en DB (lead.enrichmentData)
        → Consomme par buildEmailPrompt() pour personnaliser les emails
```

### Points a challenger

- [ ] 5000 caracteres de markdown — suffisant pour extraire des infos pertinentes ? Trop court pour les gros sites ?
- [ ] "NEVER hallucinate" — est-ce que le modele respecte cette instruction ? Teste avec des pages pauvres en contenu ?
- [ ] `painPoints` et `signals` sont les champs les plus critiques pour les emails — quelle fiabilite ?
- [ ] Le markdown de Jina peut contenir du bruit (navbars, footers, cookies) — pre-processing ?
- [ ] `teamSize: "estimate or null"` — le modele invente-t-il des chiffres ?
- [ ] Pas de distinction entre page d'accueil / page about / blog — Jina scrape quoi exactement ?
- [ ] Si le website n'est pas celui de la bonne entreprise (guess URL), les donnees sont fausses
- [ ] Le JSON output est directement injecte dans le prompt email — une erreur ici se propage

---

## 6. EMAIL DRAFTING — Redaction des cold emails

### Fiche technique

| Parametre | Valeur |
|-----------|--------|
| **Fichier** | `src/server/lib/email/drafting.ts` + `prompt-builder.ts` |
| **Methode** | `mistralClient.draftEmail()` |
| **Modele** | `mistral-large-latest` (hardcode) |
| **Temperature** | 0.8 (plus creatif) |
| **Max tokens** | 1024 |
| **Format sortie** | `json_object` → `{subject, body}` |
| **Validation** | Zod `emailResultSchema` |
| **Action log** | `draft-email` |
| **Volume** | 3 appels par lead (step 0, 1, 2) |

### System Prompt

```
You are a world-class B2B cold email copywriter. Write concise, personalized emails
that get replies. JSON output only.
```

### User Prompt (construit par `buildEmailPrompt()`)

```
## Qui tu es
{workspace.companyDna — description de l'entreprise du client}

## Le prospect
- Prenom: {lead.firstName}
- Poste: {lead.jobTitle ?? "unknown"}
- Entreprise: {lead.company ?? "unknown"}
- Activite: {enrichmentData.companySummary}          // si disponible
- Pain points: {enrichmentData.painPoints.join(", ")} // si disponible
- Signaux: {enrichmentData.signals.join(", ")}        // si disponible
- Actus: {enrichmentData.recentNews.join(", ")}       // si disponible

## Framework
{framework.instructions — voir ci-dessous}

## Objectif
{framework.objective — voir ci-dessous}

## Emails precedents (NE PAS repeter)       // seulement pour steps 1 et 2
Email 1: "{previousEmail.subject}"
Email 2: "{previousEmail.subject}"

## Style guide                               // seulement si corrections existent
Original: "{original}"
Corrected: "{corrected}"

## Contraintes
- Max {maxWords} mots. 1 CTA. 1 element specifique minimum.
- Pas de flatterie creepy, pas de signature.
- Langue : francais si prospect FR, sinon anglais.
- Commence par le prenom.

JSON uniquement : {"subject": "...", "body": "..."}
```

### Les 3 frameworks (hardcodes dans `prompt-builder.ts`)

#### Step 0 — PAS (Problem-Agitate-Solve)

| Champ | Valeur |
|-------|--------|
| **name** | `PAS` |
| **instructions** | Use the PAS framework (Problem-Agitate-Solve). 1) Identify a specific problem the prospect faces. 2) Amplify the pain — make them feel it. 3) Present the solution naturally. |
| **objective** | Get the prospect curious enough to reply or book a call. |
| **maxWords** | 150 |

#### Step 1 — Value-add

| Champ | Valeur |
|-------|--------|
| **name** | `Value-add` |
| **instructions** | Bring genuine value: an insight, a relevant resource, a case study, or a benchmark. NO 'just checking in' or 'following up'. Show you've done your homework. |
| **objective** | Position yourself as a knowledgeable peer, not a pushy seller. |
| **maxWords** | 100 |

#### Step 2 — Breakup

| Champ | Valeur |
|-------|--------|
| **name** | `Breakup` |
| **instructions** | Short and direct. Last attempt. Acknowledge they're busy. No guilt-tripping. Something like 'Last note from me — no worries if the timing isn't right.' |
| **objective** | Give a final, low-pressure reason to reply. |
| **maxWords** | 80 |

### Schema de sortie (Zod)

```typescript
emailResultSchema = z.object({
  subject: z.string(),
  body: z.string(),
})
```

### Chaine d'appel (pour `draft_emails_batch`)

```
Pour chaque lead (concurrency 5) :
  Pour chaque step (0, 1, 2 — sequentiel) :
    1. buildEmailPrompt(lead, step, companyDna, previousEmails, styleSamples)
    2. mistralClient.draftEmail(system, prompt, workspaceId)
    3. Zod validation → {subject, body}
    4. prisma.draftedEmail.upsert(...)
    5. previousEmails.push({step, subject}) → pour eviter la repetition au step suivant
  lead.status → DRAFTED
```

### Points a challenger

- [ ] Temperature 0.8 — est-ce que ca genere des emails trop "creatifs" ou incoherents parfois ?
- [ ] Le system prompt est tres court (1 phrase) vs le user prompt tres long — equilibre ?
- [ ] "world-class B2B cold email copywriter" — le modele comprend-il ce que ca implique concretement ?
- [ ] Le `companyDna` est injecte tel quel — si c'est vague, les emails seront generiques
- [ ] Les `painPoints` viennent du summarizer (Mistral Small) — erreur en cascade si le summarizer hallucine
- [ ] "Langue : francais si prospect FR, sinon anglais" — comment le modele determine-t-il si le prospect est FR ?
- [ ] "Commence par le prenom" — si le prenom est null, le modele fait quoi ?
- [ ] Les `styleSamples` sont au format `Original: "..." / Corrected: "..."` — le modele comprend-il que c'est un guide de style ?
- [ ] Pas de contrainte sur le sujet (subject line) — longueur, style, emoji ?
- [ ] 3 appels sequentiels par lead (chaque step depend du precedent) — lent pour 200+ leads
- [ ] Le framework Breakup dit "Something like 'Last note from me...'" — le modele copie-t-il cette phrase ?
- [ ] Max 1024 tokens output — suffisant ? Le body + subject font rarement plus de 300 tokens

---

## 7. STYLE LEARNER — Boucle de feedback

### Fiche technique

| Parametre | Valeur |
|-----------|--------|
| **Fichier** | `src/server/lib/email/style-learner.ts` |
| **Appel LLM** | Non — purement DB |
| **Stockage** | Table `AgentFeedback`, type `USER_EDIT` |
| **Injection** | Dans le prompt email via `## Style guide` |
| **Limite** | 5 corrections les plus recentes |

### Format injecte dans les prompts

```
Original: "{texte original genere par Mistral}"
Corrected: "{texte corrige par l'utilisateur}"
```

### Points a challenger

- [ ] 5 corrections max — suffisant pour que le modele apprenne le style ?
- [ ] Les corrections sont par workspace (pas par campagne) — une correction sur une campagne tech s'applique a une campagne RH ?
- [ ] Pas de mecanisme pour oublier les vieilles corrections — elles persistent indefiniment
- [ ] Le format "Original/Corrected" est-il le plus efficace pour le style learning ?

---

## 8. CLIENT MISTRAL — Methodes et parametres

### `chatStream()` — Streaming avec tool loop

| Parametre | Valeur | Configurable ? |
|-----------|--------|----------------|
| Model | `mistral-large-latest` | Oui (defaut) |
| Max steps | 5 | Oui (defaut) |
| Temperature | 0.7 | Oui |
| Tool choice | `auto` | Non |
| System | Passe tel quel | - |
| Messages | Historique complet | - |

**Boucle de tool calling :**
1. Envoie messages + tools a Mistral
2. Si `finishReason === "tool_calls"` → execute les tools
3. Ajoute les resultats en tant que messages `role: "tool"`
4. Re-envoie tout a Mistral
5. Repete jusqu'a `finishReason !== "tool_calls"` ou max steps atteint

### `complete()` — Appel simple

| Parametre | Valeur | Configurable ? |
|-----------|--------|----------------|
| Model | `mistral-large-latest` | Oui (defaut) |
| Temperature | 0.7 | Oui (defaut) |
| Max tokens | - | Oui |
| Format | Texte libre | Non |

### `json<T>()` — JSON structure avec validation

| Parametre | Valeur | Configurable ? |
|-----------|--------|----------------|
| Model | `mistral-small-latest` | Oui (defaut) |
| Temperature | 0.3 | Oui (defaut) |
| Response format | `{ type: "json_object" }` | Non |
| System suffix | `\n\nJSON only, no markdown, no comments.` | Non (auto) |
| Validation | Zod schema | Requis |

**Attention :** Si le JSON ne parse pas ou ne valide pas le schema Zod, ca throw une erreur non catchee dans `json()`. Pas de retry.

### `draftEmail()` — Specialise emails

| Parametre | Valeur | Configurable ? |
|-----------|--------|----------------|
| Model | `mistral-large-latest` | **Non** (hardcode) |
| Temperature | 0.8 | **Non** (hardcode) |
| Max tokens | 1024 | **Non** (hardcode) |
| Response format | `{ type: "json_object" }` | Non |
| Validation | `emailResultSchema` (subject + body) | Non |

### Points a challenger (client)

- [ ] Pas de retry/fallback dans `json()` — un JSON invalide = crash
- [ ] Pas de retry dans `draftEmail()` — un email invalide = crash
- [ ] `chatStream()` re-envoie TOUT l'historique a chaque step (y compris le system prompt) — cout cumulatif
- [ ] Les tool calls accumulent les messages dans la boucle — le context peut exploser en 5 steps
- [ ] Pas de timeout sur les appels Mistral — un hang = request bloquee
- [ ] Le singleton `_client` ne gere pas la rotation de cle API

---

## 9. TOOLS QUI DECLENCHENT DES APPELS LLM

### Via l'agent (tool calling indirect)

| Tool name | Appel LLM interne | Modele | Volume |
|-----------|-------------------|--------|--------|
| `score_leads_batch` | `scoreLead()` × N leads | Small | 1 par lead, sequentiel |
| `enrich_leads_batch` | `summarizeCompanyContext()` × N leads | Small | 1 par lead, sequentiel (+ 3.4s delay Jina) |
| `enrich_single_lead` | `summarizeCompanyContext()` × 1 | Small | 1 |
| `draft_emails_batch` | `draftEmail()` × N leads × 3 steps | Large | 3 par lead, concurrency 5 |
| `draft_single_email` | `draftEmail()` × 1 | Large | 1 |

### Tools sans LLM

| Tool name | Description |
|-----------|------------|
| `instantly_count_leads` | API Instantly uniquement |
| `instantly_preview_leads` | API Instantly uniquement |
| `instantly_source_leads` | API Instantly uniquement |
| `instantly_create_campaign` | API Instantly uniquement |
| `instantly_add_leads_to_campaign` | API Instantly uniquement |
| `instantly_activate_campaign` | API Instantly uniquement |
| `instantly_list_accounts` | API Instantly uniquement |
| `crm_check_duplicates` | API HubSpot uniquement |
| `save_memory` | DB uniquement |
| `get_memories` | DB uniquement |
| `delete_memory` | DB uniquement |
| `render_email_preview` | UI uniquement |
| `render_lead_table` | UI uniquement |
| `render_campaign_summary` | UI uniquement |

---

## 10. ESTIMATION DE COUT — Scenario type

### Scenario : 500 leads sources, 300 qualifies, 300 enrichis, 300 draftes

| Etape | Appels | Modele | Tokens in (est.) | Tokens out (est.) | Cout est. |
|-------|--------|--------|-------------------|-------------------|-----------|
| Chat agent (10 echanges) | 10 | Large | ~50K | ~10K | $0.16 |
| Greeting | 1 | Large | ~500 | ~100 | $0.002 |
| ICP Parsing | 1 | Large | ~800 | ~200 | $0.003 |
| ICP Scoring | 500 | Small | ~100K | ~25K | $0.018 |
| Summarization | 300 | Small | ~750K | ~75K | $0.098 |
| Email Drafting | 900 (300×3) | Large | ~900K | ~270K | $3.42 |
| **TOTAL** | **1712** | - | **~1.8M** | **~380K** | **~$3.70** |

> **Note :** L'email drafting represente ~92% du cout total. C'est le premier candidat pour l'optimisation (ou le switch vers Claude).

---

## 11. LOGGING & TRACKING

### Table `AIEvent` (Prisma)

Chaque appel LLM est log avec :

```typescript
{
  workspaceId: string,
  provider: "mistral",     // hardcode V1
  model: string,           // "mistral-large-latest" | "mistral-small-latest"
  action: string,          // "chat-stream" | "greeting" | "icp-parse" | "icp-scoring"
                           // | "enrichment-summarize" | "draft-email"
  tokensIn: number,
  tokensOut: number,
  cost: number,            // calcule via MISTRAL_PRICING
  latencyMs: number,
  metadata?: JSON,
}
```

### Points a challenger (logging)

- [ ] Le logging est fire-and-forget (`.catch(() => {})`) — on peut perdre des logs
- [ ] Pas de correlation ID entre les appels d'une meme session/campagne
- [ ] Le `chatStream` log chaque step individuellement — pas de vue globale par message
- [ ] Pas d'alerte si le cout depasse un seuil

---

## 12. FLUX COMPLET — Sequence temporelle des appels LLM

```
USER: "Je cherche des CTOs SaaS en France, 50-200 employes"

  ┌─────────────────────────────────────────────────┐
  │ APPEL #1 — Chat Agent (chatStream)              │
  │ Model: mistral-large-latest                     │
  │ L'agent recoit le message, decide d'utiliser    │
  │ les tools pour parser l'ICP                     │
  │ → Tool call: (implicite) parseICP               │
  └─────────────────────────────────────────────────┘
            │
            ▼
  ┌─────────────────────────────────────────────────┐
  │ APPEL #2 — ICP Parsing (json)                   │
  │ Model: mistral-large-latest, temp 0.3           │
  │ Input: description NL user                      │
  │ Output: {job_titles: ["CTO", ...], ...}         │
  └─────────────────────────────────────────────────┘
            │
            ▼
  (Tool: instantly_count_leads — PAS de LLM)
  (Tool: instantly_source_leads — PAS de LLM)
  (Tool: crm_check_duplicates — PAS de LLM)
            │
            ▼
  ┌─────────────────────────────────────────────────┐
  │ APPELS #3 a #502 — ICP Scoring (json × 500)    │
  │ Model: mistral-small-latest, temp 0.3           │
  │ Input: ICP + donnees brutes Instantly par lead  │
  │ Output: {score, breakdown, reason} par lead     │
  │ → 200 leads SKIPPED (score < 5)                 │
  │ → 300 leads SCORED (score >= 5)                 │
  └─────────────────────────────────────────────────┘
            │
            ▼
  (Jina Reader: 300 appels HTTP, ~18/min — PAS de LLM)
            │
            ▼
  ┌─────────────────────────────────────────────────┐
  │ APPELS #503 a #802 — Summarization (json × 300) │
  │ Model: mistral-small-latest, temp 0.3           │
  │ Input: markdown Jina (max 5000 chars)           │
  │ Output: EnrichmentData JSON                     │
  └─────────────────────────────────────────────────┘
            │
            ▼
  ┌─────────────────────────────────────────────────┐
  │ APPELS #803 a #1702 — Email Drafting (× 900)    │
  │ Model: mistral-large-latest, temp 0.8           │
  │ 300 leads × 3 steps (PAS, Value-add, Breakup)   │
  │ Input: companyDna + lead + enrichment + framework│
  │ Output: {subject, body} par email               │
  │ Concurrency: 5 leads en parallele               │
  └─────────────────────────────────────────────────┘
            │
            ▼
  (Tool: instantly_create_campaign — PAS de LLM)
  (Tool: instantly_add_leads_to_campaign — PAS de LLM)
  (Tool: instantly_activate_campaign — PAS de LLM)

  TOTAL: ~1702 appels LLM pour 500 leads
```

---

## 13. UPGRADE PATH — Switch email drafting vers Claude

Le seul fichier a modifier : `src/server/lib/email/drafting.ts`

```typescript
// Avant (V1 — Mistral)
return mistralClient.draftEmail({
  system: "You are a world-class B2B cold email copywriter...",
  prompt,
  workspaceId: params.workspaceId,
});

// Apres (V2 — Claude Sonnet)
// 1. pnpm add @anthropic-ai/sdk
// 2. Ajouter ANTHROPIC_API_KEY a .env
// 3. Changer l'implementation ci-dessous
// 4. Ajouter le pricing Claude dans calculateCost()
```

**Impact :** Uniquement sur les 900 appels email drafting. Le reste (chat, parsing, scoring, summarization) reste sur Mistral.

---

## 14. CHECKLIST GLOBALE POUR CHALLENGER

### Qualite des prompts
- [ ] Tester chaque prompt avec des inputs edge-case (vides, tres longs, multilingues)
- [ ] Verifier la coherence FR/EN dans les prompts (certains system prompts sont en EN, d'autres en FR)
- [ ] Ajouter des few-shot examples aux prompts critiques (ICP parsing, scoring)
- [ ] Tester la repetabilite du scoring (meme lead, meme ICP → meme score ?)

### Cout & performance
- [ ] Le greeting utilise Large — switcher vers Small
- [ ] Le scoring est sequentiel — batcher les appels ?
- [ ] L'email drafting est le gros du cout (92%) — qualite suffisante avec Small ?
- [ ] Le system prompt chat est re-envoye a chaque step du tool loop — cacher/tronquer ?

### Fiabilite
- [ ] Pas de retry sur `json()` / `draftEmail()` — ajouter retry avec backoff
- [ ] Pas de timeout explicite sur les appels Mistral
- [ ] Le Zod parse echoue = exception non catchee dans certains cas
- [ ] Le logging est fire-and-forget — perte de donnees possible

### Securite
- [ ] Les memories et companyDna sont injectes dans le system prompt sans sanitization
- [ ] Le style guide injecte du contenu user dans le prompt — injection possible
- [ ] Les enrichmentData (de Jina + Mistral Small) sont re-injectees dans le prompt email — chaine de confiance ?

### UX
- [ ] Le greeting arrive en un seul bloc (pas de streaming reel)
- [ ] Le scoring de 500 leads prend du temps — progress bar suffisante ?
- [ ] L'enrichissement a un delay de 3.4s entre chaque lead (rate limit Jina) — ~17 min pour 300 leads
- [ ] Les previews email sont generes un par un — temps d'attente pour l'user ?
