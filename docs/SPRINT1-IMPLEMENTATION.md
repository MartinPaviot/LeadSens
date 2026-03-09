# Sprint 1 — Implementation des ameliorations pipeline

## Vue d'ensemble

Sprint 1 se concentre sur 3 ameliorations concretes qui comblent les derniers gaps du pipeline email avant GATE 1 (prouver que nos emails sont meilleurs que Copilot). Aucune nouvelle integration — on perfectionne ce qui existe.

| Amelioration | Impact | Fichiers |
|-------------|--------|----------|
| Quality Gate | Emails generiques elimines automatiquement | `quality-gate.ts` |
| Subject Line Variants | A/B testing natif dans Instantly | `drafting.ts`, `mistral-client.ts`, `instantly.ts` |
| Worker 6 steps | Sequence complete au lieu de 3 emails | `email-draft-worker.ts` |

---

## 1. Quality Gate — Scoring post-generation

### Probleme

Mistral Large genere parfois des emails generiques : pas de signal concret, formulations vagues, CTA mal adapte au step. Sans controle qualite, ces emails partent directement en campagne et tuent le reply rate.

### Solution

Un scoring automatique via Mistral Small (rapide, peu couteux) sur 4 axes :

| Axe | Poids | Ce qu'il mesure |
|-----|-------|-----------------|
| **Relevance** | 35% | L'email adresse-t-il les pain points du prospect ? La solution est-elle connectee a son role/industrie ? |
| **Specificity** | 30% | Utilise-t-il des donnees concretes (signaux, metriques, stack technique) ou est-il generique ? |
| **Formatting** | 15% | Sauts de ligne corrects, paragraphes courts, subject 2-4 mots minuscules ? |
| **Coherence** | 20% | Suit-il le framework du step (PAS, Value-add, etc.) ? Le CTA est-il adapte ? |

### Fonctionnement

```
draftEmail() genere un email
        |
        v
scoreEmail() le note sur 4 axes (Mistral Small)
        |
    score >= 7 ?
   /          \
  OUI         NON
  |            |
  OK       regenere (max 2 retries)
               |
           garde le meilleur score
```

- **Seuil** : 7/10 (overall = weighted average des 4 axes)
- **Retries** : max 2 regenerations. On garde le meilleur resultat meme si tous < 7
- **Cout** : ~0.001$ par scoring (Mistral Small, ~200 tokens in + ~50 out)
- **Cout total** : pour 100 leads x 6 steps = 600 emails x 1.3 tentatives en moyenne = ~780 scorings = ~0.78$

### Fichiers

- `src/server/lib/email/quality-gate.ts` — `scoreEmail()` et `draftWithQualityGate()`
- `src/server/lib/tools/email-tools.ts` — `draft_emails_batch` integre `draftWithQualityGate`
- `src/queue/email-draft-worker.ts` — idem pour le worker async
- `prisma/schema.prisma` — `DraftedEmail.qualityScore Int?` stocke le score final

### Exemple de resultat

```json
{
  "relevance": 8,
  "specificity": 6,
  "formatting": 9,
  "coherence": 8,
  "overall": 7,
  "issues": ["Le body manque de donnees chiffrees specifiques au prospect"]
}
```

---

## 2. Subject Line Variants — A/B testing natif

### Probleme

Chaque email n'avait qu'un seul objet. Pas de possibilite de tester differentes approches. L'objet est le facteur #1 du taux d'ouverture — sans A/B testing, on laisse de la performance sur la table.

### Solution

Le LLM genere maintenant 3 variantes de subject line pour chaque email. Instantly les recoit comme `variants[]` dans chaque step et fait l'A/B testing automatiquement.

### Fonctionnement

```
Mistral Large genere :
{
  "subject": "votre serie b",           <-- meilleure variante
  "subjects": [                          <-- 3 variantes
    "votre serie b",
    "scaling post-funding",
    "outbound apres la levee"
  ],
  "body": "Thomas,\n\nDepuis votre..."
}
        |
        v
Stockage en DB :
  DraftedEmail.subject = "votre serie b"
  DraftedEmail.subjectVariants = ["scaling post-funding", "outbound apres la levee"]
        |
        v
Push vers Instantly :
  custom_variables = {
    email_step_0_subject: "votre serie b",
    email_step_0_subject_v2: "scaling post-funding",
    email_step_0_subject_v3: "outbound apres la levee",
    email_step_0_body: "<html>..."
  }
        |
        v
Campaign Instantly :
  step[0].variants = [
    { subject: "{{email_step_0_subject}}", body: "{{email_step_0_body}}" },
    { subject: "{{email_step_0_subject_v2}}", body: "{{email_step_0_body}}" },
    { subject: "{{email_step_0_subject_v3}}", body: "{{email_step_0_body}}" },
  ]
```

Instantly distribue automatiquement les variantes et track les performances par variant.

### Fichiers

- `src/server/lib/email/drafting.ts` — prompt modifie pour demander `subjects[]`
- `src/server/lib/llm/mistral-client.ts` — `emailResultSchema` accepte `subjects`
- `src/server/lib/llm/types.ts` — `DraftEmailResult` type etendu
- `src/server/lib/connectors/instantly.ts` — `CampaignStep.subjects` + `createCampaign` mappe vers `variants[]`
- `src/server/lib/tools/instantly-tools.ts` — template variables pour 3 variants par step + push avec custom vars
- `prisma/schema.prisma` — `DraftedEmail.subjectVariants Json?`

---

## 3. Worker 6 steps — Sequence complete

### Probleme

Le worker `email-draft-worker.ts` ne generait que 3 steps (0-2) au lieu de 6. Les steps 3 (New Angle), 4 (Micro-value) et 5 (Breakup) n'etaient jamais draftes par le worker.

La tool `draft_emails_batch` faisait deja les 6 steps correctement, mais le worker async etait en retard.

### Solution

Changement d'une ligne : `for (let step = 0; step < 3; step++)` → `for (let step = 0; step < 6; step++)`.

En plus, le worker passe maintenant le `body` dans `previousEmails` (avant il ne passait que le `subject`), ce qui permet une meilleure coherence narrative inter-emails.

### Les 6 steps

| Step | Framework | Delay | Objectif |
|------|-----------|-------|----------|
| 0 | PAS (Timeline Hook) | J+0 | Curiosite via signal concret |
| 1 | Value-add | J+2 | Apporter un insight, pas un pitch |
| 2 | Social Proof | J+5 | Case study avec chiffres |
| 3 | New Angle | J+9 | Pain point different du step 0 |
| 4 | Micro-value | J+14 | Un seul insight actionable |
| 5 | Breakup | J+21 | Court, direct, derniere tentative |

---

## 4. Provider abstractions (prep)

En parallele, 3 wrappers ont ete crees pour preparer le multi-ESP/CRM :

| Wrapper | Interface | Connecteur existant |
|---------|-----------|---------------------|
| `instantly-esp.ts` | `ESPProvider` | `instantly.ts` |
| `instantly-sourcing.ts` | `SourcingProvider` | `instantly.ts` |
| `hubspot-crm.ts` | `CRMProvider` | `hubspot.ts` |

**Pas utilises en production pour l'instant** — les tools appellent encore directement les connecteurs. Ces wrappers seront branches quand on ajoutera un 2e ESP (Smartlead) ou un 2e CRM (Pipedrive).

Le `providers/index.ts` (registry) a ete nettoye : les imports non-existants (Smartlead, Lemlist, Apollo, Pipedrive, Salesforce, ZeroBounce) ont ete supprimes. Seuls Instantly et HubSpot restent.

---

## 5. Schema DB

Migration `20260306231713_add_subject_variants_quality_score` :

```sql
ALTER TABLE "drafted_email" ADD COLUMN "subjectVariants" JSONB;
ALTER TABLE "drafted_email" ADD COLUMN "qualityScore" INTEGER;
```

- `subjectVariants` : array JSON des variantes alternatives (sans le subject principal)
- `qualityScore` : score overall (1-10) du quality gate

---

## 6. Verification

### Tests automatises
- `npx tsc --noEmit` → 0 erreurs
- `tests/icp-parser/mapping.test.ts` → 92/92
- `tests/greeting-screen.test.tsx` → 6/6

### Test end-to-end (manuel)
1. `pnpm dev`
2. Chat : "Je cible les CTO de SaaS en France, 50-200 employes"
3. Verifier : ICP parse → count → source → score → enrich → **draft (6 steps avec quality gate + 3 subjects)** → campaign create (avec variants) → push → activate
4. Dans le dashboard Instantly : verifier que chaque step a 3 variants de subject

### Cout estime par campagne (100 leads)
| Poste | Calcul | Cout |
|-------|--------|------|
| Drafting (Mistral Large) | 600 emails x ~800 tok = 480K tok | ~2.40$ |
| Quality gate (Mistral Small) | ~780 scorings x ~250 tok = 195K tok | ~0.20$ |
| Regenerations (~30%) | ~180 re-drafts x ~800 tok = 144K tok | ~0.72$ |
| **Total** | | **~3.32$** |

Le quality gate ajoute ~28% au cout du drafting mais elimine les emails faibles qui auraient nui au reply rate.
