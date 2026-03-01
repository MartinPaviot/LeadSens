# APPEL LLM MANQUANT — Analyse du site client → companyDna structuré

> **Problème :** Actuellement, `companyDna` est un champ texte libre rempli par l'user OU scrapé une seule fois pendant l'onboarding. Si c'est vague ("On fait du SaaS B2B"), tous les 900 emails de la campagne seront génériques. Le companyDna est la FONDATION de chaque email — et personne ne le structure.
>
> **Insight Belkins (2000+ campagnes) :** La value proposition doit être adaptée au RÔLE du destinataire. Un même produit se pitche différemment à un CTO vs un VP Sales vs un CMO.

---

## Le flux corrigé

```
ONBOARDING (1 seule fois par workspace) :

User donne l'URL de son site
  │
  ▼
Jina Reader scrape homepage + /about + /pricing (si existe)
  │
  ▼
NOUVEL APPEL LLM : Mistral Large → companyDna structuré
  │
  ▼
L'agent montre le résultat à l'user : "Voici comment je comprends ton offre. Corrige-moi."
  │
  ▼
User valide ou corrige → stocké dans workspace.companyDna (JSON)
  │
  ▼
Sauvegardé aussi en AgentMemory pour les conversations futures


AVANT CHAQUE CAMPAGNE (à chaque nouveau ICP) :

companyDna structuré + ICP du moment (rôle, secteur)
  │
  ▼
NOUVEL APPEL LLM : Mistral Large → "campaignAngle" adapté au persona
  │
  ▼
L'agent montre : "Voici l'angle que je propose pour cette campagne. Ça te va ?"
  │
  ▼
User valide → injecté dans le prompt email à la place du companyDna brut
```

---

## Appel LLM A — Analyse site client (onboarding, 1 fois)

### Fiche technique

| Paramètre | Valeur |
|-----------|--------|
| **Quand** | Onboarding — l'user donne son URL |
| **Modèle** | `mistral-large-latest` |
| **Méthode** | `json()` |
| **Température** | 0.3 |
| **Input** | Markdown Jina (homepage + /about + /pricing, ~8000 chars) |
| **Action log** | `company-analysis` |

### Stratégie de scraping

On scrape 3 pages au lieu d'1 pour avoir une vue complète :

```typescript
async function scrapeClientSite(url: string): Promise<string> {
  const pages = [
    url,                    // Homepage : pitch principal
    `${url}/about`,         // About : mission, histoire, équipe
    `${url}/pricing`,       // Pricing : offres, segments cibles
  ];

  const results = await Promise.all(
    pages.map(p => scrapeViaJina(p).catch(() => null))
  );

  return results.filter(Boolean).join("\n\n---PAGE SUIVANTE---\n\n").slice(0, 8000);
}
```

### System prompt

```
Tu analyses le site web d'une entreprise pour comprendre PRÉCISÉMENT ce qu'elle vend, à qui, et pourquoi c'est utile. Ton analyse sera utilisée pour écrire des cold emails B2B de prospection — elle doit donc être orientée "selling points", pas description neutre.

Extrais les informations suivantes en JSON :

1. "oneLiner" : En UNE phrase, ce que fait l'entreprise. Format : "[Entreprise] aide [qui] à [faire quoi] grâce à [comment]."
2. "targetBuyers" : Les 2-3 types d'acheteurs les plus probables (titre de poste + ce qui les intéresse).
3. "keyResults" : Les résultats concrets mentionnés sur le site (chiffres, stats, case studies). Si aucun résultat n'est mentionné, retourne [].
4. "differentiators" : Ce qui les distingue de la concurrence (max 3 points).
5. "proofPoints" : Logos clients, témoignages, prix, certifications mentionnés.
6. "problemsSolved" : Les 2-3 problèmes que le produit/service résout.
7. "pricingModel" : Le modèle tarifaire si visible (freemium, par siège, sur devis, etc.). null si pas visible.

RÈGLES :
- Base-toi UNIQUEMENT sur le contenu fourni. Ne complète pas avec des suppositions.
- Si une info n'est pas trouvée → null ou [].
- "keyResults" ne doit contenir QUE des chiffres/stats réellement présents sur le site.
- "targetBuyers" doit inclure le titre de poste ET l'angle de vente adapté.

JSON uniquement.
```

### User prompt

```
Analyse ce site web et extrais les informations commerciales :

{markdown combiné des 3 pages}
```

### Schema de sortie

```typescript
type CompanyDna = {
  oneLiner: string;
  targetBuyers: {
    role: string;          // "VP Sales", "CTO", "Head of Marketing"
    sellingAngle: string;  // "réduire le cycle de vente", "simplifier l'intégration tech"
  }[];
  keyResults: string[];    // ["40% de réduction du cycle de vente", "500+ clients"]
  differentiators: string[];
  proofPoints: string[];   // ["Client : Airbus", "Prix : Best SaaS 2025"]
  problemsSolved: string[];
  pricingModel: string | null;
};
```

### Interaction avec l'user

L'agent présente le résultat sous forme lisible :

```
Voici comment je comprends ton offre :

**{oneLiner}**

Tu résous ces problèmes : {problemsSolved}
Tes acheteurs types : {targetBuyers.map(b => b.role).join(", ")}
Résultats mentionnés sur ton site : {keyResults}
Ce qui te différencie : {differentiators}

C'est correct ? Si je me trompe sur un point, dis-moi et je corrige.
```

L'user peut corriger → l'agent met à jour le JSON → sauvegardé en `workspace.companyDna` (JSON, pas texte libre).

---

## Appel LLM B — Campaign Angle (avant chaque campagne)

### Fiche technique

| Paramètre | Valeur |
|-----------|--------|
| **Quand** | Après le scoring, avant le drafting — quand on connaît l'ICP |
| **Modèle** | `mistral-large-latest` |
| **Méthode** | `json()` |
| **Température** | 0.5 |
| **Input** | companyDna + ICP description |
| **Action log** | `campaign-angle` |

### Pourquoi cet appel est nécessaire

L'insight clé de Belkins : la value proposition doit être adaptée au RÔLE du destinataire.

Exemples concrets :
- Si tu vends un outil de sales automation et que tu cibles des **VP Sales** → l'angle est "réduire le cycle de vente, augmenter le pipeline"
- Le MÊME outil ciblant des **CTO** → l'angle est "s'intègre avec votre CRM en 2h, API ouverte, pas de migration"
- Le MÊME outil ciblant des **CEO de PME** → l'angle est "votre équipe de 3 fait le travail de 10"

Sans cet appel, les 900 emails de la campagne utilisent le même angle générique.

### System prompt

```
Tu es un expert en cold email B2B. Tu adaptes le positionnement d'une offre au persona ciblé par la campagne.

À partir de l'offre du client et de la cible de la campagne, génère un "campaign angle" — c'est-à-dire le CADRAGE spécifique de l'offre pour CE type de prospect.

JSON uniquement :
{
  "angleOneLiner": "1 phrase : comment l'offre aide CE persona spécifiquement",
  "mainProblem": "Le problème N°1 que CE persona rencontre et que l'offre résout",
  "proofPoint": "La stat ou le cas client le plus pertinent pour CE persona (tiré des keyResults)",
  "avoid": "Ce qu'il ne faut PAS mentionner à CE persona (trop technique, trop marketing, etc.)",
  "tone": "Le registre adapté (technique, business, stratégique, opérationnel)"
}
```

### User prompt

```
OFFRE DU CLIENT :
{JSON.stringify(companyDna)}

CIBLE DE CETTE CAMPAGNE :
- Rôle : {icpDescription — ex: "VP Sales SaaS 50-200 employés"}
- Secteur : {industry}
- Taille d'entreprise : {companySize}

Adapte le positionnement de l'offre pour cette cible spécifique.
```

### Schema de sortie

```typescript
type CampaignAngle = {
  angleOneLiner: string;    // "Ton équipe SDR passe 3h/jour sur la data — on automatise ça"
  mainProblem: string;      // "Les SDR passent plus de temps à chercher des leads qu'à closer"
  proofPoint: string;       // "[Client X] a doublé son pipeline en 3 mois"
  avoid: string;            // "Ne pas parler de l'API ou de l'architecture technique"
  tone: string;             // "business, direct, orienté résultats"
};
```

### Injection dans le prompt email

Le `campaignAngle` REMPLACE le `companyDna` brut dans le prompt email :

```
## QUI TU ES (adapté à cette campagne)
{campaignAngle.angleOneLiner}

Problème que tu résous pour eux : {campaignAngle.mainProblem}
Preuve : {campaignAngle.proofPoint}
Ton : {campaignAngle.tone}
À éviter : {campaignAngle.avoid}
```

C'est beaucoup plus actionnable pour le modèle que "On fait du SaaS B2B d'automatisation."

---

## Impact sur le coût

| Appel | Fréquence | Modèle | Coût estimé |
|-------|-----------|--------|-------------|
| Company Analysis | 1 fois par workspace | Large | ~$0.02 |
| Campaign Angle | 1 fois par campagne | Large | ~$0.005 |

**Total additionnel : ~$0.025 par campagne.** Négligeable vs le coût total de ~$2, et l'impact sur la qualité est disproportionné — c'est la différence entre des emails génériques et des emails adaptés au persona.

---

## Impact sur le flow principal

```
User décrit son ICP en langage naturel
  │
  ▼
Mistral parse → JSON search_filters
  │
  ▼
Instantly SuperSearch count → confirmation
  │
  ▼
Instantly SuperSearch source → leads
  │
  ▼
HubSpot dedup (si connecté)
  │
  ▼
ICP scoring (Mistral Small) → skip < 5
  │
  ▼
Jina Reader → Mistral Small summarize → triggerEvents + painPoints
  │
  ▼
★ NOUVEAU : Campaign Angle (Mistral Large)    ← ICI
  │            companyDna + ICP → angle adapté
  │            L'agent montre l'angle, l'user valide
  ▼
Mistral Large draft 3 emails par lead
  │  Utilise campaignAngle au lieu de companyDna brut
  │  + triggerEvents du prospect pour le timeline hook
  ▼
Preview → corrections → style learner → push Instantly
```

---

## Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `server/lib/enrichment/company-analyzer.ts` | **NOUVEAU** — analyzeClientSite() |
| `server/lib/email/campaign-angle.ts` | **NOUVEAU** — generateCampaignAngle() |
| `server/lib/tools/instantly-tools.ts` | Ajouter l'appel campaign angle avant le drafting |
| `server/lib/email/prompt-builder.ts` | Injecter campaignAngle au lieu de companyDna brut |
| `prisma/schema.prisma` | `workspace.companyDna` passe de `@db.Text` à `Json` |
| `prisma/schema.prisma` | Ajouter `campaign.angle Json?` |

---

## Interaction agent pendant l'onboarding (flow conversationnel)

```
User: Mon site c'est https://elevay.io

Agent: [scrape via Jina, analyse via Mistral Large]

Agent: "Voici comment je comprends ton offre :

Elevay aide les PME à automatiser leurs processus métier (Sales, Marketing, RH, Ops) grâce à des agents IA autonomes.

Problèmes que tu résous :
- Les PME passent trop de temps sur des tâches répétitives
- Pas de budget pour une équipe ops dédiée
- Les outils existants sont trop complexes à configurer

Résultats mentionnés : [s'il y en a sur le site]
Ce qui te différencie : [s'il y en a]

C'est fidèle ? Si je me trompe quelque part, corrige-moi."

User: "Oui mais on se concentre sur le sales automation en ce moment, pas les autres verticals"

Agent: [met à jour le companyDna] "Noté. Je recentre sur le sales automation. Prêt pour la suite — décris-moi ta cible."
```

---

## Interaction agent avant une campagne

```
Agent: [après le scoring] "J'ai 280 leads qualifiés. Avant de rédiger les emails, je vais adapter ton pitch à cette cible.

Ta cible : VP Sales dans le SaaS, 50-200 employés, France

L'angle que je propose :
→ 'Ton équipe SDR perd 3h/jour sur de la prospection manuelle — Elevay automatise le sourcing et la personnalisation pour que tes reps passent leur temps à closer.'
→ Problème principal : les SDR sous-performent parce qu'ils font trop de data entry
→ Preuve : [résultat client si disponible]
→ Ton : direct, orienté résultats, pas technique

Ça te va pour l'angle de cette campagne ?"

User: "Parfait, go"

Agent: [lance le drafting avec cet angle]
```
