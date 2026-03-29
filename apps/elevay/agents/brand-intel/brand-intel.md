# brand-market-intelligence.md

> Fichier de référence de la catégorie **Brand & Market Intelligence** dans Elevay.
> À lire avant de travailler sur l'un des 3 agents de cette catégorie.
> Pour les conventions spécifiques aux agents BMI, voir `apps/elevay/BMIagents.md`.
> Pour les règles techniques globales d'Elevay, voir `apps/elevay/CLAUDE.md`.

---

## Vue d'ensemble

La catégorie Brand & Market Intelligence regroupe 3 agents complémentaires qui forment une **trilogie stratégique**. Ils partagent un onboarding mutualisé, un format d'output JSON standardisé, et une architecture pensée pour être enchaînés en V2.

| Code | Fichier | Nom | Rôle |
|------|---------|-----|------|
| `BPI-01` | `bpi-01/agentBPI-01.md` | Brand Presence Intelligence | Audit complet présence de marque — 6 axes |
| `MTS-02` | `mts-02/agentMTS-02.md` | Market Trend Strategist | Tendances secteur + roadmap contenu 30j |
| `CIA-03` | `cia-03/agentCIA-03.md` | Competitive Intelligence Architect | Analyse concurrentielle — 6 axes + plan 60j |

---

## Structure du dossier

```
brand-market-intelligence/
├── brand-market-intelligence.md   ← ce fichier
├── bpi-01/
│   └── agentBPI-01.md             ← workflow complet BPI-01
├── mts-02/
│   └── agentMTS-02.md             ← workflow complet MTS-02
└── cia-03/
    └── agentCIA-03.md             ← workflow complet CIA-03
```

Dans le code source (`apps/elevay/src/agents/`), la structure miroir sera :

```
src/agents/
├── _shared/
│   ├── types.ts         # AgentOutput<T>, ElevayAgentProfile, ModuleResult<T>
│   ├── errors.ts        # AgentError, ErrorCode
│   ├── llm.ts           # Wrapper Claude Sonnet 4.6
│   ├── composio.ts      # Client Composio MCP
│   └── cache.ts         # TTL constants
├── bpi-01/
│   ├── index.ts
│   ├── modules/         # serp, press, youtube, social, seo, benchmark
│   ├── scoring.ts
│   ├── prompt.ts
│   └── types.ts
├── mts-02/
│   ├── index.ts
│   ├── modules/         # trends, content, competitive, social-listening, synthesis
│   ├── scoring.ts
│   ├── prompt.ts
│   └── types.ts
└── cia-03/
    ├── index.ts
    ├── modules/         # product-messaging, seo-acquisition, social-media, content, benchmark, recommendations
    ├── scoring.ts
    ├── prompt.ts
    └── types.ts
```

---

## Trilogie — vision d'ensemble

```
BPI-01                    MTS-02                    CIA-03
─────────────────         ─────────────────         ─────────────────
Vision rétrospective      Vision prospective         Vision comparative
Où en est ma marque ?     Quoi publier demain ?      Pourquoi ils performent mieux ?

SERP • Presse             Google Trends              Scraping produit
YouTube • Social          DataForSEO                 SEO comparatif
SEO • Benchmark           GNews • Social             Social • Contenu
                          Concurrents blog           Zones stratégiques

Score global /100         Score opportunité /100      Score compétitivité /100
Risques + quick wins      Roadmap 30 jours           Plan d'action 60 jours
```

---

## Onboarding mutualisé — commun aux 3 agents

Le profil est saisi **une seule fois** par le client, stocké dans `ElevayBrandProfile`, et rechargé automatiquement à chaque lancement d'agent.

```typescript
interface ElevayAgentProfile {
  organisationId:   string
  brand_name:       string   // utilisé dans toutes les requêtes API
  brand_url:        string   // ancrage SEO + SERP
  country:          string   // contexte requêtes + presse
  language:         string
  competitors:      { name: string; url: string }[]  // 2-3 en BPI/MTS, 5 max en CIA
  primary_keyword:  string   // SEO + SERP organique
  secondary_keyword:string   // gaps de contenu
}
```

**Règle absolue** : ne jamais redemander ces informations après l'onboarding initial.

CIA-03 ajoute **2 questions contextuelles légères** au lancement dans le chat (canal prioritaire + objectif), non stockées dans le profil permanent car elles varient d'une analyse à l'autre.

---

## Activation dans le chat

Les agents sont déclenchés via des boutons **quick reply** dans le message de bienvenue. Aucune commande textuelle n'est nécessaire.

```
Message de bienvenue Elevay
┌─────────────────────────────────────────────┐
│ Bonjour ! Que souhaitez-vous faire ?        │
│                                             │
│ [Auditer ma marque]                         │  → BPI-01
│ [Analyser les tendances de mon secteur]     │  → MTS-02
│ [Analyser mes concurrents]                  │  → CIA-03
└─────────────────────────────────────────────┘
```

Si l'utilisateur tape librement sans cliquer → afficher les boutons à nouveau + message `"Pour commencer, choisissez une des options ci-dessus"`.

---

## LLM — Claude Sonnet 4.6

```typescript
// src/agents/_shared/llm.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function callAgentLlm(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ❌ Ne jamais appeler dans un module individuel
// ✅ Appeler uniquement depuis index.ts, après Promise.allSettled de tous les modules
```

**Coût indicatif par utilisation :**
- BPI-01 : ~0,12 $ LLM + ~0,04 $ APIs = ~0,16 $ / audit
- MTS-02 : ~0,09 $ LLM + ~0,03 $ APIs = ~0,12 $ / analyse
- CIA-03 : ~0,15 $ LLM + ~0,06 $ APIs = ~0,21 $ / analyse

---

## Contrat JSON inter-agents — V2-ready

Ces schémas de base sont **immuables en V1**. Ils préparent l'enchaînement V2 où CIA-03 consommera les outputs de BPI-01 et MTS-02 sans recollecte.

```typescript
// src/agents/_shared/types.ts

export interface AgentOutput<T> {
  agent_code:      'BPI-01' | 'MTS-02' | 'CIA-03'
  analysis_date:   string    // ISO 8601
  brand_profile:   ElevayAgentProfile
  payload:         T         // BpiOutput | MtsOutput | CiaOutput
  degraded_sources:string[]  // sources indisponibles durant l'analyse
  version:         '1.0'
}

export interface ModuleResult<T> {
  success:  boolean
  data:     T | null
  source:   string
  error?:   AgentError
  degraded?:boolean
}
```

Les schémas complets (`BpiOutput`, `MtsOutput`, `CiaOutput`) sont dans les `types.ts` de chaque agent — détaillés dans les `agentBPI-01.md`, `agentMTS-02.md`, `agentCIA-03.md`.

---

## Pipeline commun — règles absolues

1. **Modules en parallèle** via `Promise.allSettled` — jamais en séquence
2. **1 seul appel LLM** par agent, à la fin, sur toutes les données agrégées
3. **Aucun module ne throw** — toujours `ModuleResult` avec `degraded: true` en cas d'échec
4. **Progression SSE** communiquée module par module dans le chat
5. **Persistance** dans `ElevayAgentRun` avant de retourner le résultat
6. **Comparaison historique** automatique avec le dernier run complété

---

## Cache — durées obligatoires

```typescript
// src/agents/_shared/cache.ts
export const CACHE_TTL = {
  DA_BACKLINKS:    30 * 24 * 60 * 60 * 1000,  // DataForSEO — 30 jours
  GOOGLE_TRENDS:    7 * 24 * 60 * 60 * 1000,  // MTS-02 — 7 jours
  PRESS_ARTICLES:       24 * 60 * 60 * 1000,  // GNews — 24 heures
  SERP_RESULTS:          6 * 60 * 60 * 1000,  // SerpAPI — 6 heures
  SOCIAL_PROFILES:      24 * 60 * 60 * 1000,  // Profils publics — 24 heures
} as const
```

---

## Retry strategy par source

| Source | Retries | Délai | Fallback |
|--------|---------|-------|---------|
| SerpAPI | ×2 | 1s exponentiel | Score SERP partiel |
| DataForSEO | ×2 | 1s exponentiel | Cache si disponible |
| GNews | ×1 | 500ms | Skip — score presse absent |
| YouTube Data API | ×1 | 500ms | Réduction échantillon |
| LinkedIn / Social | ×0 | — | Apify fallback (Composio) |
| Apify | ×1 | 1s | Skip — score social partiel |
| Claude Sonnet 4.6 | ×2 | 2s exponentiel | Erreur bloquante — seule exception |

---

## Roadmap V2 — ce qui est prévu mais non implémenté

- Enchaînement agents : BPI-01 → CIA-03 / MTS-02 → CIA-03 (import JSON sans recollecte)
- Modes récurrents pour MTS-02 et CIA-03 (hebdo / mensuel / trimestriel)
- Système d'alertes configurable (signal fort, concurrent, viralisation)
- Dashboard web évolution des scores dans le temps
- Ahrefs premium (backlinks avancés)

**Ce qu'il faut préparer en V1 pour ne pas bloquer la V2 :**
- Champs `serp_data`, `seo_data`, `content_gap_map` présents dans tous les outputs JSON
- `ElevayAgentRun` jamais supprimé — historique permanent
- Helper `getLatestOutputByAgent(organisationId, agentCode)` dans `src/lib/`