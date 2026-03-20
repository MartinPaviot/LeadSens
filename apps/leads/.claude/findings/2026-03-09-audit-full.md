# Audit Complet LeadSens — 2026-03-09

## Contexte
Audit stratégique codebase vs STRATEGY.md §6-9. Score initial: 4.2/10.

---

## Phase 1 — Snapshot Technique

| Métrique | Valeur |
|----------|--------|
| Fichiers TS/TSX | 144 |
| Fichiers test dans src/ | 0 (tests dans tests/) |
| `as any` | 10 occurrences |
| `console.log` | 48 occurrences |
| TODO/FIXME | 0 |
| Erreurs typecheck | 4 (scripts + tests, mineurs) |
| Routes sans Zod | 11 |

---

## Phase 2 — Audit par Composant

### FINDING-01: Enrichissement — Cache non-persistant (MEDIUM)
**Score: 7/10** (cible 6/10 — DÉPASSÉ sauf cache)

**Implémenté:** Multi-page scraping (5 pages), LinkedIn 3-layer, tous les champs extraits, fallbacks robustes, rate limiting 3.4s.

**Gap:** Le cache est un `Map<string, string>` en mémoire par batch (`enrichment-tools.ts:381`). Le BACKLOG T1-ENR-02 demande un `CompanyCache` Prisma persistant (TTL 7j). Même entreprise re-scrapée entre batches = coûts Jina inutiles.

**Impact:** ~20% de scrapes redondants sur des campagnes multi-batch même industrie.

---

### FINDING-02: ICP Scoring — Toujours fit-only (HIGH)
**Score: 5.5/10** (cible 7/10 — ÉCART -1.5)

**Amélioré:** Bug `industry: null` corrigé (instantly-tools.ts:289-292).

**Gaps:**
- Scoring purement fit (jobTitle 40%, company 30%, industry 20%, location 10%) — ZERO intent, ZERO timing (`icp-scorer.ts:6-15`)
- Filtres supprimés au broadening non convertis en bonus scoring (`instantly-tools.ts:84-182`)
- Pas de feedback loop si >80% leads éliminés — le tool retourne `qualified: 0, skipped: 100` sans alerte
- Scoring threshold fixe >= 5 sans ajustement possible

**Impact:** Un DRH parfait sans besoin actuel = même score qu'un DRH en recrutement actif. ~30% du potentiel de scoring gaspillé.

---

### FINDING-03: Email Copywriting — Cible atteinte (RESOLVED)
**Score: 8/10** (cible 8/10 — ATTEINT)

**Tout Tier 1 implémenté:**
- Connection bridge explicite (`prompt-builder.ts:531-538`)
- Trigger events prioritisés en opener (`prompt-builder.ts:550-560`)
- Toutes les données enrichies injectées (10+ champs, `prompt-builder.ts:508-528`)
- Follow-ups avec body complet (`prompt-builder.ts:379-390`)
- Quality gate 7/10 + 2 retries (`quality-gate.ts:67-112`)

---

### FINDING-04: Subject Lines — Pattern library manquante (MEDIUM)
**Score: 5/10** (cible 6/10 — ÉCART -1)

**Implémenté:** 3 variantes/step, Instantly `variants[]` natif.

**Gap:** Pas de librairie formelle des 5 patterns (question, observation, curiosité, direct, personnalisé) comme demandé par STRATEGY §7.2.1. Enforcement implicite via banned phrases et quality gate, mais pas de sélection explicite de pattern par step.

---

### FINDING-05: A/B Testing — Winner propagation manquante (MEDIUM)
**Score: 4/10** (cible 5/10 — ÉCART -1)

**Implémenté:** 3 variantes générées/step, envoyées à Instantly.

**Gaps:**
- Pas de corrélation variant → reply (on ne sait pas quelle variante a performé)
- Pas d'auto-pause des variantes faibles
- Pas de propagation des winners aux campagnes futures
- `DraftedEmail` ne lie pas quelle variante a été vue par quel lead

---

### FINDING-06: Cadence & Séquence — Cible dépassée (RESOLVED)
**Score: 7.5/10** (cible 7/10 — DÉPASSÉ)

**Implémenté:** 6 steps avec frameworks hardcodés, delays [0, 2, 5, 9, 14, 21] jours, customisables.

**Gap mineur:** Pas de logique conditionnelle (ouvert sans réponse → delay court).

---

### FINDING-07: Feedback Loop — Style learner non-catégorisé (MEDIUM)
**Score: 5/10** (cible 5/10 — ATTEINT)

**Implémenté:** Stats sync worker (30min), EmailPerformance + StepAnalytics, winning patterns extraction, adaptive drafting.

**Gaps:**
- Style learner capture corrections brutes sans catégoriser (subject vs tone vs CTA) — `style-learner.ts:7-22`
- Click tracking absent du schéma
- A/B winners non propagés automatiquement

---

### FINDING-08: Pipeline Post-launch — Cible dépassée (RESOLVED)
**Score: 6/10** (cible 5/10 — DÉPASSÉ)

**Tout implémenté:** LeadStatus étendu (8 statuts post-PUSHED), webhook Instantly (4 events), reply management (classify + draft + send), CRM push (contact + deal), campaign insights, state machine enforced.

---

## Phase 3 — Audit Technique Transverse

### FINDING-09: 10 `as any` restants (LOW)
Fichiers: webhook route, analytics worker, instantly-sourcing, mistral-client, providers.
Convention CLAUDE.md §5.12: "Zéro `any`, zéro `as any`".

### FINDING-10: 11 routes sans Zod validation (MEDIUM)
Routes API sans validation Zod d'input:
- `/api/campaigns/[campaignId]/export/route.ts`
- `/api/emails/[emailId]/edit/route.ts`
- 6 routes intégrations (apollo, hubspot, instantly, lemlist, smartlead, zerobounce)
- `/api/auth/[...all]/route.ts` (Better Auth, acceptable)
- `/api/trpc/[trpc]/route.ts` (tRPC, acceptable)

### FINDING-11: 48 console.log (LOW)
Convention CLAUDE.md §5.13: "Utiliser le logger structuré."

### FINDING-12: LLM calls sans AI Event logging (MEDIUM)
Appels Mistral sans logging: campaign-angle.ts, quality-gate.ts, icp-scorer.ts, summarizer.ts.
Convention CLAUDE.md §5.8: "Chaque appel LLM est loggé."

### FINDING-13: 4 erreurs typecheck (LOW)
- `scripts/backfill-flat-enrichment.ts:21,35` — null vs InputJsonValue
- `tests/industry-taxonomy.test.ts:24,26` — null vs string | undefined
