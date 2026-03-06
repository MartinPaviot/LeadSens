# LLM Company DNA — Signal Intelligence & Email Pipeline

## Top 5 Signaux d'Achat (par reply rate)

| # | Signal | Reply Rate | Multiplicateur |
|---|--------|-----------|----------------|
| 1 | **Leadership changes** (new VP, C-level hire) | 14-25% | 4-7x vs generic |
| 2 | **Funding rounds** (Series A/B/C, revenue milestone) | 12-20% | 3-5x |
| 3 | **Hiring surges** (10+ postes, nouveau department) | 10-18% | 2-4x |
| 4 | **Public priorities** (CEO quotes, strategic initiatives) | 10-15% | 2-3x |
| 5 | **Tech stack changes** (migrations, new tool adoption) | 8-15% | 2-3x |

### Philosophie : Timeline Hooks > Problem Hooks (2.3x)

**Timeline hooks sont 2.3x plus efficaces que les problem hooks.**

| Approche | Exemple | Reply Rate |
|----------|---------|-----------|
| Timeline hook | "Depuis votre Série B, la pression pour scaler l'outbound..." | 15-25% |
| Problem hook | "Vous avez du mal à scaler votre outbound ?" | 6-10% |
| Question rhétorique | "Et si vous pouviez doubler votre pipeline ?" | 3-5% |

**Signal stacking** (2-3 signaux combinés dans un email) : 25-40% reply rate.

---

## Schéma CompanyDna

```typescript
{
  // Core
  oneLiner: string,
  targetBuyers: [{ role, sellingAngle }],
  keyResults: string[],
  differentiators: string[],
  problemsSolved: string[],
  pricingModel: string | null,

  // Social proof
  socialProof: [{ industry, clients[], keyMetric? }],

  // Case studies (avec timeline)
  caseStudies: [{
    client: string,       // "Acme Corp"
    industry: string,     // "SaaS"
    timeline: string,     // "En 90 jours", "Après leur Série B"
    result: string,       // "+45% pipeline"
    context?: string,     // "Après leur migration Salesforce → HubSpot"
  }],

  // Tone & identity
  toneOfVoice: { register, traits[], avoidWords[] },
  ctas: [{ label, commitment, url? }],
  senderIdentity: { name, role, signatureHook },
  objections: [{ objection, response }],
}
```

### Case studies : pourquoi le timeline est critique

Les résultats avec timeline sont 2.3x plus impactants :
- "En 90 jours, Acme a doublé son pipeline" > "Acme a doublé son pipeline"
- "Après leur Série B, Acme a réduit son cycle de vente de 40%" > "Acme a réduit son cycle de vente de 40%"

L'extraction scrape aussi `/results` et `/roi` en plus des pages classiques.

---

## Schéma EnrichmentData (signaux structurés)

```typescript
{
  // Existants (string[] — backward compat)
  hiringSignals: string[],
  fundingSignals: string[],
  productLaunches: string[],
  signals: string[],

  // Nouveaux (structurés avec dates)
  leadershipChanges: [{
    event: string,        // "New VP Sales: Jane Doe"
    date: string | null,  // "2026-02"
    source: string | null,
  }],
  publicPriorities: [{
    statement: string,    // "CEO: Our #1 priority is APAC expansion"
    source: string | null,
    date: string | null,
  }],
  techStackChanges: [{
    change: string,       // "Migrated from Salesforce to HubSpot"
    date: string | null,
  }],
}
```

### Signal prioritization (dans prompt-builder.ts)

```
prioritizeSignals(enrichmentData) retourne :
1. leadershipChanges (14-25%)
2. fundingSignals (12-20%)
3. hiringSignals (10-18%)
4. publicPriorities (10-15%)
5. techStackChanges (8-15%)
6. signals (fallback)

Triés par recency : recent (< 6 mois) > unknown > older
```

---

## Schéma CampaignAngle (signal-aware)

```typescript
{
  angleOneLiner: string,
  mainProblem: string,
  proofPoint: string,
  avoid: string,
  tone: string,
  socialProofMatch?: string,
  suggestedCta?: string,

  // Nouveaux
  timelineProof?: string,   // "En 90 jours, [Client] a atteint [résultat]"
  signalHooks?: string[],   // ["Funding → scaling urgent → ton outil accélère"]
}
```

---

## Séquence 6 Steps

| Step | Framework | Delay | Max mots | CTA | Clé |
|------|-----------|-------|----------|-----|-----|
| 0 | PAS (Timeline Hook) | J+0 | 90 | Medium | Signal récent en opener, timeline proof |
| 1 | Value-add | J+2 | 70 | Low | Insight/benchmark, case study timeline, signal != step 0 |
| 2 | Social Proof | J+5 | 80 | Medium | Case study même secteur, format narratif, projection |
| 3 | New Angle | J+9 | 65 | Low | Angle complètement différent, signal non exploité |
| 4 | Micro-value | J+14 | 50 | Low | 3-4 phrases, 1 insight actionable, expertise domaine |
| 5 | Breakup | J+21 | 50 | Low | 2-3 phrases, respect, rappel meilleur résultat |

### Évolution depuis la V1 (3 steps)

| Avant (3 steps) | Après (6 steps) |
|-----------------|-----------------|
| PAS → Value-add → Breakup | PAS Timeline → Value-add → Social Proof → New Angle → Micro-value → Breakup |
| Follow-ups sans body context | Body complet des steps précédents (tronqué 500 chars) |
| Signaux en listing plat | Signaux priorisés par impact + recency |
| Problem hooks | Timeline hooks (2.3x) |
| Pas de signal stacking | Signal stacking quand 2+ signaux (25-40%) |
| Pas de case studies structurés | Case studies avec timeline |

---

## Flux Complet

```
EnrichmentData (signaux structurés + dates)
  │
  ▼
prioritizeSignals() → classement par impact + recency
  │
  ▼
buildSignalsSection() → section priorisée dans le prompt
  │
  ▼
Step 0: PAS + Timeline Hook (signal #1)
  │  ↓ body complet passé
  ▼
Step 1: Value-add + Signal Stacking (signaux #1 + #2 si dispo)
  │  ↓ body complet steps 0-1
  ▼
Step 2: Social Proof (case study même secteur, timeline)
  │  ↓ body complet steps 0-2
  ▼
Step 3: New Angle (signal non exploité dans 0-2)
  │  ↓ body complet steps 0-3
  ▼
Step 4: Micro-value (1 insight pur, pas de pitch)
  │  ↓ body complet steps 0-4
  ▼
Step 5: Breakup (rappel meilleur argument de la séquence)
```

Chaque step reçoit le body complet (tronqué à 500 chars) de tous les steps précédents pour construire une narration cohérente et éviter les répétitions.

---

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/lib/enrichment/company-analyzer.ts` | Scrape + analyse site → CompanyDna (avec caseStudies) |
| `server/lib/enrichment/summarizer.ts` | Signaux structurés (leadershipChanges, publicPriorities, techStackChanges) |
| `server/lib/email/campaign-angle.ts` | CampaignAngle signal-aware (timelineProof, signalHooks) |
| `server/lib/email/prompt-builder.ts` | 6 frameworks, prioritizeSignals(), signal stacking, timeline hooks |
| `server/lib/email/drafting.ts` | System prompt enrichi (timeline hooks, narration inter-emails) |
| `server/lib/tools/email-tools.ts` | 6 steps loop, full body context |
| `server/lib/tools/instantly-tools.ts` | 6-step campaigns, delays [0, 2, 5, 9, 14, 21] |
