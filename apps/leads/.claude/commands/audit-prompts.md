# /audit-prompts — Audit des prompts LLM vs STRATEGY.md

## Objectif

Les prompts LLM sont le cœur de la valeur LeadSens. Un prompt mal calibré = des emails médiocres = pas de reply = pas de produit.
Cet audit compare CHAQUE prompt du code avec les spécifications de STRATEGY.md §5, §6, §7.

---

## Phase 1 : Inventaire des prompts

```bash
# Trouver tous les system prompts et prompt templates
grep -rn "system\|System\|SYSTEM\|role.*system\|systemPrompt\|system_prompt" src/ --include="*.ts" -l
grep -rn "prompt\|template\|instruction" src/server/lib/email/ src/server/lib/enrichment/ src/server/lib/llm/ --include="*.ts" -l
```

Lis chaque fichier trouvé. Catalogue les prompts :

| Prompt | Fichier | Modèle | Objectif | Tokens estimés |
|--------|---------|--------|----------|---------------|
| Chat agent system | ... | Mistral Large | Orchestration | ... |
| ICP parser | ... | Mistral Large | NL → JSON filters | ... |
| ICP scorer | ... | Mistral Small | Score 1-10 | ... |
| Enrichment summarizer | ... | Mistral Small | Markdown → JSON | ... |
| Email drafter step 0 | ... | Mistral Large | PAS framework | ... |
| Email drafter step 1-5 | ... | Mistral Large | Frameworks | ... |
| Subject line generator | ... | Mistral Large | Subjects | ... |
| Quality gate | ... | Mistral Small | Score email | ... |

---

## Phase 2 : Audit prompt par prompt

### 2.1 Email Drafting — le plus critique

Lis le prompt de drafting complet. Vérifie :

**Connection bridge (STRATEGY §7.1.2) :**
```
✅ ATTENDU : "Choisis LE SEUL pain point qui résonne le plus avec [solution du sender].
             Construis tout l'email autour de ce pont :
             problème_prospect → capacité_spécifique_sender → preuve"
❌ RED FLAG : Les pain points et capabilities sont listés côte à côte sans instruction de connexion
```

**Trigger en opener (STRATEGY §7.1.3) :**
```
✅ ATTENDU : "RÈGLE D'OPENER (par priorité) :
             1. Trigger event récent → 'J'ai vu que...'
             2. Signal spécifique du prospect → référence directe
             3. Pain point segment → observation sectorielle
             JAMAIS : 'Je me permets de...', flaterie générique"
❌ RED FLAG : Pas de hiérarchie d'opener, le trigger est optionnel
```

**Données injectées (STRATEGY §7.1.4) :**
```
✅ ATTENDU : Le prompt reçoit TOUTES ces données si disponibles :
             - painPoints (du summarizer)
             - recentNews
             - techStack
             - products
             - targetMarket
             - valueProposition
             - hiringSignals
             - linkedinHeadline (Apify)
             - linkedinAbout (Apify)
             - recentPosts (Apify)
             - triggerEvents
❌ RED FLAG : Seuls painPoints et companyDescription sont passés
```

**Frameworks par step (CLAUDE.md §Email Frameworks) :**
```
✅ ATTENDU : Step 0 = PAS, Step 1 = Value-add, Step 2 = Social proof,
             Step 3 = New angle, Step 4 = Micro-value, Step 5 = Breakup
             Frameworks HARDCODÉS dans le system prompt
❌ RED FLAG : Le modèle choisit le framework ou un seul framework pour tous les steps
```

**Follow-ups cohérents (STRATEGY §7.2.3) :**
```
✅ ATTENDU : Chaque step reçoit le body complet des steps précédents
❌ RED FLAG : Seul le subject des steps précédents est passé
```

### 2.2 Enrichment Summarizer

Vérifie que le prompt de summarization demande l'extraction de TOUS ces champs :
- `companyDescription` (2-3 lignes, pas un copier-coller de la homepage)
- `painPoints` (vrais pain points, pas des généralités marketing)
- `recentNews` (actualités des 6 derniers mois)
- `techStack` (technologies mentionnées)
- `products` (produits/services principaux)
- `targetMarket` (cible de l'entreprise)
- `valueProposition` (ce qu'ils vendent vraiment)
- `hiringSignals` (postes ouverts détectés sur /careers)
- `fundingSignals` (levées mentionnées)
- `competitivePosition` (positionnement vs concurrents si mentionné)

### 2.3 ICP Scorer

Vérifie :
- Score multi-dimensionnel (fit + intent + timing) ou fit-only ?
- Le prompt connaît-il le Company DNA du sender pour scorer la pertinence ?
- Gestion des données manquantes (neutre, pas pénalisant) ?

### 2.4 Quality Gate (si existant)

Vérifie les 5 critères :
- Pertinence du pain point (0-10)
- Clarté de la value prop (0-10)
- Naturalité du ton (0-10)
- Respect du word count (0-10)
- Force du CTA (0-10)

Score < 6 → régénération ? Max tentatives ?

---

## Phase 3 : Analyse token efficiency

Pour chaque prompt, estime :
- Tokens input (system + user + données)
- Tokens output attendus
- Coût par appel (Mistral Small ~$0.1/1M input, Large ~$2/1M input)
- Possibilités de réduction (champs inutiles, instructions redondantes, exemples trop longs)

Ref: STRATEGY.md §10.1 pour les coûts cibles par lead.

---

## Phase 4 : Findings + backlog

Pour chaque écart trouvé → finding + tâche dans BACKLOG.md.

Priorise par impact sur le reply rate :
- Prompt email manque le connection bridge → **CRITICAL** (Tier 1)
- Données enrichies non injectées → **CRITICAL** (Tier 1)
- Subject lines sans patterns → **HIGH** (Tier 2)
- Quality gate absent → **HIGH** (Tier 2)
- Token waste > 30% → **MEDIUM** (Tier 3)

---

## Phase 5 : Rapport

```
📊 AUDIT PROMPTS LEADSENS — [date]

Prompts audités : [N]
Tokens totaux estimés par lead : [N]
Coût estimé par lead : $[X]

Prompt             | Aligné STRATEGY | Issues | Sévérité max
───────────────────┼─────────────────┼────────┼─────────────
Email drafter      | [%]             | [N]    | CRITICAL
Summarizer         | [%]             | [N]    | ...
ICP scorer         | [%]             | [N]    | ...
Subject generator  | [%]             | [N]    | ...
Quality gate       | [exists?]       | [N]    | ...

🔴 CRITICAL : [liste]
🟠 HIGH : [liste]
📝 Tâches ajoutées : [N]
```
