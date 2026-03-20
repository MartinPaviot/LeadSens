# Audit Complet LeadSens v2 — 2026-03-09
# Cross-référence: STRATEGY.md + RESEARCH-DELIVERABILITY + RESEARCH-LANDSCAPE

## Contexte
Audit stratégique codebase vs STRATEGY.md §6-9 ET vs external research (100+ sources).
Score précédent: 6.2/10 (audit v1 2026-03-09).

---

## Phase 1 — Snapshot Technique

| Métrique | Valeur | Changement |
|----------|--------|------------|
| Fichiers TS/TSX | 145 | +1 (company-cache.ts) |
| Fichiers test | 12 (tests/) | +3 depuis audit v1 |
| `as any` | 6 | -4 (fixes audit v1, 2 restants justifiés) |
| `console.log` | 47 | -1 |
| TODO/FIXME | 0 | — |
| Build | ✅ 20.8s Turbopack | No errors |
| Typecheck | ✅ 0 errors | Was 4 |
| Routes sans Zod | 5 | -6 (was 11, manual validation acceptable) |
| Tests passants | 172/172 | +24 depuis audit v1 |

---

## Phase 2 — Audit par Composant (vs STRATEGY + RESEARCH)

### Enrichissement — 7/10 (cible 6/10) ✅ DÉPASSÉ

**Implémenté:**
- Multi-page scraping: 5 pages (homepage + about + blog + careers + press) — `jina.ts:93-105`
- Cache persistant Prisma CompanyCache TTL 7j — `company-cache.ts:25-56`
- LinkedIn 3-layer fallback (Apollo → LinkedIn → Jina → LinkedIn-only) — `enrichment-tools.ts:399-481`
- Summarizer: 18+ champs, Zod schema strict — `summarizer.ts:4-51`
- Rate limiting 3.4s/req (~18 req/min) — `jina.ts:2`
- Non-blocking failures: leads advance to ENRICHED even if scraping fails

**Gaps mineurs:**
- Pas de link extraction dynamique depuis la homepage (chemins prédéfinis — couvre ~80% des sites B2B)
- Pas de case study extraction dans lead enrichment (uniquement dans Company DNA analyzer)
- Signals temporels sans dates (fundingSignals.length vs fundingSignals[].date)

### ICP Scoring — 7/10 (cible 7/10) ✅ ATTEINT

**Implémenté:**
- Multi-dimensionnel: fit 40% + intent 35% + timing 25% — `icp-scorer.ts:157-240`
- `computeSignalBoost()` avec 8 types de signaux (hiring, tech, LinkedIn, launches, funding, leadership, priorities, news)
- Feedback loop si >70% éliminés — `enrichment-tools.ts:308-317`
- Bug industry:null corrigé — `instantly-tools.ts:289-292`
- Données manquantes = neutre (score 6), pas pénalisant

**Gaps:**
- **RESEARCH GAP:** Signal weights dans icp-scorer.ts (hiringSignals +2, funding +3) ≠ poids dans prompt-builder.ts (leadership 5, funding 4, hiring 3). Les deux ont des bonnes raisons mais ne sont pas alignés.
- Filtres broadening → scoring signals non implémenté (T3-SCORE-02)

### Email Copywriting — 8/10 (cible 8/10) ✅ ATTEINT

**Implémenté:**
- Connection bridge explicite — `prompt-builder.ts:531-538`
- Trigger events priorisés (timeline hooks 2.3x vs PAS) — `prompt-builder.ts:550-560`
- Toutes les données enrichies injectées (10+ champs) — `prompt-builder.ts:512-527`
- Follow-ups avec body complet — `prompt-builder.ts:379-390`, `email-tools.ts:113-183`
- Signal weights par reply rate (leadership 14-25%, funding 12-20%) — `prompt-builder.ts:107-115`
- Quality gate 7/10 + 2 retries, 4 axes — `quality-gate.ts:4-54, 67-112`
- Kill list de phrases mortes + adaptation par persona
- Cross-email narrative enforcement — `drafting.ts:75-81`

**Gaps (RESEARCH-validated):**
- ❌ **Pas de spam word scanner** dans quality gate — Research D1: 3+ triggers = 67% plus de chances d'atterrir en spam
- Quality gate threshold 7/10 vs STRATEGY 6/10 (threshold plus strict = OK mais plus coûteux)
- Word count axis manquant dans quality gate (proxied par "formatting")

### Subject Lines — 6/10 (cible 6/10) ✅ ATTEINT

**Implémenté:**
- 5 patterns (Question, Observation, Curiosity gap, Direct, Personalized) — `prompt-builder.ts:565-574`
- 3 variantes/step — `drafting.ts:108-114`
- Instantly `variants[]` natif — `instantly.ts:919-930`
- Chaque variante doit utiliser un pattern différent

**Gaps (RESEARCH-validated):**
- ❌ Pas de tracking formel de `subjectPattern` metadata dans DraftedEmail (Research R6.2)
- ❌ Research montre first name en subject = 43.41% reply rate (règle actuelle l'interdit) — À A/B tester (Research D9)
- ❌ Pas de tracking performance par pattern pour auto-optimiser

### A/B Testing — 4/10 (cible 5/10) ⚠️ ÉCART -1

**Implémenté:**
- 3 variantes générées/step ✅
- Envoyées à Instantly via custom variables ✅

**Gaps (RESEARCH-validated, CRITICAL):**
- ❌ **Pas de corrélation variant → reply rate** — on ne sait pas quelle variante performe
- ❌ **Pas d'auto-pause z-test** — Research R6.3: two-proportion z-test, min 100 sends + 5 jours, |z| > 1.96
- ❌ **Pas de winner propagation** aux campagnes futures
- ❌ DraftedEmail ne lie pas quelle variante a été vue par quel lead

### Cadence & Séquence — 7.5/10 (cible 7/10) ✅ DÉPASSÉ

**Implémenté:**
- 6 steps: PAS → Value-add → Social Proof → New Angle → Micro-value → Breakup
- Delays variables [0, 2, 5, 9, 14, 21] jours — Research VALIDE ✅ ("well-designed, expanding gaps match principle")
- Word counts [90, 70, 80, 65, 50, 50] — Research VALIDE ✅ ("< 80 words = highest reply rates")

**Research insight:**
- Research suggests Step 5 (Breakup) should be optional — steps 5+ risk spam complaints
- Research suggests shorter sequences (3-4 steps) for warm/inbound leads

### Feedback Loop — 5/10 (cible 5/10) ✅ ATTEINT

**Implémenté:**
- Analytics sync worker 30min — `analytics-sync-worker.ts`
- EmailPerformance + StepAnalytics sync — 3 data layers
- 6 correlator dimensions (signal_type, framework, quality_score, enrichment_depth, industry, word_count) — `correlator.ts`
- Insights with recommendations — `insights.ts:42-47`
- Adaptive drafting with data-driven weights — `adaptive.ts:13-32`
- Winning patterns extraction — `style-learner.ts:getWinningEmailPatterns()`

**Gaps (RESEARCH-validated):**
- ❌ **Style learner non-catégorisé** (subject vs tone vs CTA) — Research R6.4
- ❌ **Pas de benchmarks industrie** dans reporting — Research R6.1: "Your 6% in SaaS is below 8-12% benchmark"
- ❌ **A/B winner propagation manquante** — Research R6.5

### Pipeline post-launch — 6/10 (cible 5/10) ✅ DÉPASSÉ

**Implémenté:**
- LeadStatus: 8 statuts post-PUSHED + state machine enforced — `lead-status.ts:10-48`
- Webhook Instantly: 4 events (reply, bounce, unsub, completed) — `webhooks/instantly/route.ts`
- Reply management: classify (Mistral Small, 6 levels) + draft (Mistral Large) + send (Unibox API)
- CRM push: crm_create_contact + crm_create_deal (HubSpot)
- Campaign insights: sync + correlator + reports
- CSV import: field mapping (20+ aliases, FR support), dedup

**Gaps (RESEARCH-validated, HIGH IMPACT):**
- ❌ **Pas d'auto-pause sur bounce spike** — Research D4: bounce >3% après 50+ sends = auto-pause
- ❌ **Pas de pre-campaign verification gate** — Research D3: vérifier les emails avant push
- ❌ **Pas de deliverability guidance** dans PHASE_ACTIVE prompt

---

## Phase 3 — Findings CRITIQUES issus de la RECHERCHE (pas dans l'audit précédent)

### FINDING-R1: Spam Word Scanner ABSENT (CRITICAL — Research D1)
**Impact:** 67% plus de chances d'atterrir en spam si 3+ trigger words.
**Code:** quality-gate.ts — aucun scan de spam words.
**Research:** Maintenir une liste de 100+ mots (financial promises, urgency, too-good-to-be-true). Scanner AVANT le quality gate LLM (plus rapide, moins cher).
**Recommandation:** Créer `src/server/lib/email/spam-words.ts`, intégrer dans `draftWithQualityGate()`.

### FINDING-R2: Auto-pause bounce spike ABSENT (HIGH — Research D4)
**Impact:** Bounce >2% détruit la campagne. >5% détruit le domaine.
**Code:** Webhook stocke `bounced=true` mais aucune logique de seuil. Agent prompt dit "alerter si >5%" mais c'est réactif, pas automatique.
**Research:** Auto-pause via webhook handler quand bounce rate >3% après 50+ sends.
**Recommandation:** Ajouter compteur bounce dans webhook, auto-pause via Instantly API.

### FINDING-R3: Pre-campaign verification gate ABSENT (HIGH — Research D3)
**Impact:** Listes non-vérifiées = 7.8% bounce vs 1.2% vérifiées (6.5x).
**Code:** `instantly_push_campaign` push sans vérifier. Agent prompt mentionne ZeroBounce mais ne bloque pas.
**Research:** Si ZeroBounce connecté, vérifier avant push. Bloquer si >5% invalid.
**Recommandation:** Check `leads.verificationStatus` dans `instantly_push_campaign`.

### FINDING-R4: Industry benchmarks ABSENTS du reporting (MEDIUM — Research R6.1)
**Impact:** L'agent rapporte "6% reply rate" sans contexte. L'utilisateur ne sait pas si c'est bon ou mauvais.
**Code:** `insights.ts` compare internal dimensions mais pas vs benchmarks externes.
**Research:** Benchmarks par industrie (SaaS 8-12%, HR 8-13%, Financial 5-8%).
**Recommandation:** Ajouter `INDUSTRY_BENCHMARKS` dans insights.ts, contextualiser dans reports.

### FINDING-R5: Open tracking guidance ABSENTE (MEDIUM — Research D10)
**Impact:** Désactiver l'open tracking = 2x reply rate (1.08% → 2.36%). Custom tracking domain = mitigation.
**Code:** Aucune mention dans agent prompt ou onboarding.
**Research:** Conseiller custom tracking domain ou désactivation.
**Recommandation:** Ajouter dans PHASE_PUSHING prompt + onboarding tips.

---

## Phase 4 — Tableau récapitulatif

```
📊 AUDIT LEADSENS v2 — 2026-03-09 (with research cross-reference)

Score estimé : 6.5/10 (était 6.2/10 audit v1, 4.2/10 initial)

Composant        | Score | Cible | Écart | Tendance
─────────────────┼───────┼───────┼───────┼─────────
Enrichissement   | 7/10  | 6/10  | +1    | ✅ Dépassé
ICP Scoring      | 7/10  | 7/10  | 0     | ✅ Atteint
Copywriting      | 8/10  | 8/10  | 0     | ✅ Atteint
Subject Lines    | 6/10  | 6/10  | 0     | ✅ Atteint
A/B Testing      | 4/10  | 5/10  | -1    | ⚠️ Gap
Cadence          | 7.5/10| 7/10  | +0.5  | ✅ Dépassé
Feedback Loop    | 5/10  | 5/10  | 0     | ✅ Atteint
Post-launch      | 6/10  | 5/10  | +1    | ✅ Dépassé

🔴 Findings CRITICAL : 1 (spam word scanner)
🟠 Findings HIGH : 2 (auto-pause bounce, pre-campaign verification)
🟡 Findings MEDIUM : 5 (industry benchmarks, open tracking, style categorization, A/B z-test, subject pattern tracking)
⚪ Findings LOW : 3 (console.log, Zod routes, quality gate threshold)

📝 Tâches ajoutées au backlog : 8 (research-backed)
🔜 Prochaine action recommandée : Spam word scanner (CRITICAL, Research D1)
```

---

## Phase 5 — Prompt Audit Summary

| Prompt | Fichier | Aligné STRATEGY | Issues | Sévérité max |
|--------|---------|-----------------|--------|-------------|
| Email drafter | prompt-builder.ts + drafting.ts | 95% | 1 (no spam scanner) | HIGH |
| Summarizer | summarizer.ts | 100% | 0 | — |
| ICP scorer | icp-scorer.ts | 95% | 0 | — |
| Subject generator | prompt-builder.ts:565-574 | 90% | 1 (no pattern tracking) | MEDIUM |
| Quality gate | quality-gate.ts | 85% | 2 (threshold, word count axis) | LOW |
| Style learner | style-learner.ts | 50% | 1 (no categorization) | MEDIUM |
| Chat system prompt | route.ts | 90% | 1 (no deliverability) | MEDIUM |
| Reply classifier | pipeline-tools.ts | 100% | 0 | — |

---

## Research-Validated Competitive Position

### Where LeadSens is AHEAD of competitors

| Capability | LeadSens | Enterprise AI SDRs ($2-10K) | Sending Tools |
|-----------|---------|---------------------------|---------------|
| Connection bridge | ✅ Hardcoded | ❌ Generic AI | ❌ Manual |
| Timeline hooks | ✅ 2.3x PAS enforced | ❌ | ❌ |
| Signal-backed weights | ✅ 5 types weighted | ❌ Opaque | ❌ |
| 6 frameworks hardcoded | ✅ | ❌ AI chooses | ❌ Manual |
| Quality gate + retries | ✅ 7/10, 2 retries | ❌ | ❌ |
| BYOT architecture | ✅ Unique | ❌ Locked in | N/A |
| Autonomy cursor | ✅ 3 modes | ❌ | ❌ |

### Where competitors are AHEAD (Research D1-D5)

| Gap | Who does it | Impact | Effort to close |
|-----|------------|--------|-----------------|
| Spam word scanning | Lemlist, Saleshandy | Deliverability | 1 day |
| Auto-pause on metrics | Instantly native | Domain protection | 1 day |
| Pre-send verification | AiSDR, Apollo | Bounce prevention | 0.5 day |
| Industry benchmarks | Salesforge, AiSDR | Better reporting | 0.5 day |
| Open tracking guidance | MailReach, Allegrow | 2x reply rate | 0.5 day |

**Verdict:** Tous les gaps sont LOW EFFORT à combler. Aucun gap architectural.
