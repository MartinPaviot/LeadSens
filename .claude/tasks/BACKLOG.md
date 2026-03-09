# BACKLOG — LeadSens Auto-Improvement

> Extrait de `docs/STRATEGY.md` §7 + §11 + §12
> Ordonné par **impact sur le reply rate** (Tier 1 → 2 → 3)
> Chaque tâche a des **acceptance criteria** (PASS IF) testables.
> Ne PAS réordonner sans documenter la raison dans un finding.

---

## Tier 1 — Impact majeur (objectif : 9% → 14%)

> Pré-requis avant tout launch client.

### Enrichissement (STRATEGY §7.1.1 — ~~actuel 2.5/10~~ **actuel 7/10**, cible 6/10) ✅ CIBLE DÉPASSÉE

- [x] **T1-ENR-01** Multi-page scraping Jina ✅ *Audit 2026-03-09: 5 pages (homepage+about+blog+careers+press) avec fallbacks. jina.ts:88-120*
- [x] **T1-ENR-02** Cache par domaine persistant ✅ *2026-03-09: CompanyCache Prisma model + 7d TTL. getOrScrapeCompany() replaces in-memory Map. Both batch + single enrichment use persistent cache.*
- [x] **T1-ENR-03** Données LinkedIn dans le pipeline email ✅ *Audit 2026-03-09: 3-layer integration (direct merge + summarizer input + LinkedIn-only fallback)*
- [x] **T1-ENR-04** Enrichir le summarizer output ✅ *Audit 2026-03-09: 7 champs cibles + 11 champs additionnels. Zod schema strict. summarizer.ts:4-51*

### Copywriting (STRATEGY §7.1.2-1.4 — ~~actuel 6/10~~ **actuel 8/10**, cible 8/10) ✅ CIBLE ATTEINTE

- [x] **T1-COPY-01** Connection bridge explicite ✅ *Audit 2026-03-09: prompt-builder.ts:531-538 — "Choose THE SINGLE pain point"*
- [x] **T1-COPY-02** Trigger event en opener ✅ *Audit 2026-03-09: prompt-builder.ts:550-560 — opener priority hierarchy*
- [x] **T1-COPY-03** Injecter TOUTES les données enrichies ✅ *Audit 2026-03-09: 10+ champs injectés, prompt-builder.ts:508-528*
- [x] **T1-COPY-04** Follow-ups cohérents ✅ *Audit 2026-03-09: full bodies via buildPreviousEmailsSection(), prompt-builder.ts:379-390*

### Bugs critiques (STRATEGY §6.2)

- [x] **T1-FIX-01** Fix `industry: null` dans instantly_source_leads ✅ *Audit 2026-03-09: instantly-tools.ts:289-292 — extrait industries depuis filtres ICP, fallback enrichment data*
- [x] **T1-FIX-02** Pagination listLeads ✅ *2026-03-09: Verified — all 4 callers already use cursor-based do/while pagination loops. No code change needed.*

---

## Tier 2 — Impact significatif (objectif : 14% → 17%)

### Subject Lines (STRATEGY §7.2.1 — ~~actuel 2/10~~ **actuel 6/10**, cible 6/10) ✅ CIBLE ATTEINTE

- [x] **T2-SUBJ-01** Librairie de 5 patterns subject line ✅ *2026-03-09: 5 patterns (Question/Observation/Curiosity gap/Direct/Personalized), 3 exemples chacun, step mapping, snapshot test (25 tests)*

- [x] **T2-SUBJ-02** Générer 2-3 variantes par step ✅ *Audit 2026-03-09: 3 variantes/step, drafting.ts:108-114*
- [x] **T2-SUBJ-03** Utiliser `variants[]` natif Instantly ✅ *Audit 2026-03-09: instantly.ts:919-930 maps to native variants[]*

### Séquence (STRATEGY §7.2.2-2.4 — ~~actuel 4/10~~ **actuel 7.5/10**, cible 7/10) ✅ CIBLE DÉPASSÉE

- [x] **T2-SEQ-01** 5-6 steps avec frameworks par step ✅ *Audit 2026-03-09: 6 steps (PAS/Value-add/Social Proof/New Angle/Micro-value/Breakup), prompt-builder.ts:14-87*
- [x] **T2-SEQ-02** Cadence variable ✅ *Audit 2026-03-09: [0, 2, 5, 9, 14, 21] jours, customisable, instantly-tools.ts:459*

### Pipeline post-launch (STRATEGY §11 — ~~actuel 0/10~~ **actuel 6/10**, cible 5/10) ✅ CIBLE DÉPASSÉE

- [x] **T2-PIPE-01** Extension LeadStatus enum ✅ *Audit 2026-03-09: 8 statuts post-PUSHED, state machine enforced, lead-status.ts:10-48*
- [x] **T2-PIPE-02** Webhook Instantly ✅ *Audit 2026-03-09: 4 event types (reply, bounce, unsub, completed), webhooks/instantly/route.ts*
- [x] **T2-PIPE-03** Sync campaign performance ✅ *Audit 2026-03-09: analytics-sync-worker.ts (30min), EmailPerformance + StepAnalytics*
- [x] **T2-PIPE-04** Reply classification ✅ *Audit 2026-03-09: classify_reply tool, Mistral Small, 6 interest levels, pipeline-tools.ts:117-234*
- [x] **T2-PIPE-05** Reply drafting + sending ✅ *Audit 2026-03-09: draft_reply + reply_to_email tools, pipeline-tools.ts:236-380*

### Intégrations Tier A bloquantes (STRATEGY §4.2)

- [ ] **T2-INT-01** Import CSV *Audit 2026-03-09: import_leads_csv existe dans pipeline-tools.ts mais non vérifié en détail*
- [ ] **T2-INT-02** Multi-ESP routing — RESTE À FAIRE
- [x] **T2-INT-03** CRM push complet HubSpot ✅ *Audit 2026-03-09: crm_create_contact + crm_create_deal dans crm-tools.ts*

---

## Tier 3 — Optimisation continue (objectif : 17% → 20%+)

- [x] **T3-QUAL-01** Quality gate emails ✅ *Audit 2026-03-09: 7/10 threshold, 2 retries, 4 axes, quality-gate.ts:67-112*
- [x] **T3-QUAL-02** Feedback loop stats Instantly ✅ *Audit 2026-03-09: analytics-sync-worker + correlator + insights + adaptive drafting*
- [ ] **T3-QUAL-03** Style learner avancé — *Audit 2026-03-09: corrections capturées mais PAS catégorisées (subject/tone/CTA). Winning patterns = structural (signal+framework), pas correction-type.*
- [x] **T3-SCORE-01** Scoring multi-dimensionnel ✅ *2026-03-09: computeSignalBoost() in icp-scorer.ts — deterministic post-enrichment boost, fit 40% + intent 35% + timing 25%, 13 tests*
- [ ] **T3-SCORE-02** Filtres broadening → scoring signals — RESTE À FAIRE
- [ ] **T3-SCORE-03** Scraping page careers (signal hiring) — *Audit 2026-03-09: careers page IS scraped (jina.ts:85) mais hiringSignals extraction basic*
- [x] **T3-INTEL-01** Campaign insights tool ✅ *Audit 2026-03-09: campaign_insights + performance_insights tools*
- [ ] **T3-INTEL-02** A/B auto-pause — RESTE À FAIRE (variantes envoyées mais pas de winner propagation)
- [x] **T3-INTEL-03** ICP refinement suggestions ✅ *Audit v2 2026-03-09: Feedback loop implémenté — alerte si >70% leads score <5, enrichment-tools.ts:308-317*

---

## Dette technique (alimenté par /audit)

- [ ] **DEBT-01** Éliminer tous les `any` TypeScript
- [ ] **DEBT-02** Zod validation sur toutes les routes API
- [ ] **DEBT-03** Hiérarchie d'erreurs typées
- [x] **DEBT-04** AI Event logging sur tous les appels LLM ✅ *Audit v2: 100% coverage — all LLM calls go through instrumented mistralClient.json()*
- [x] **DEBT-05** Encryption des tokens en DB ✅ *Audit v2: AES-256-GCM applied on all 6 integration routes, encryption.ts*
- [ ] **DEBT-06** Tests unitaires pour tous les tools
- [ ] **DEBT-07** Snapshot tests pour les prompts LLM

<!-- NOUVELLES TÂCHES AJOUTÉES PAR /audit 2026-03-09 -->

### Tâches ajoutées par audit 2026-03-09

- [x] **AUDIT-01** Cache Prisma persistant CompanyCache (TTL 7j) ✅ *Fait: T1-ENR-02, company-cache.ts*
- [x] **AUDIT-02** Subject line pattern library formelle ✅ *Fait: T2-SUBJ-01, prompt-builder.ts:565-574*
- [x] **AUDIT-03** ICP scoring feedback loop ✅ *Fait: enrichment-tools.ts:308-317, alerte si >70% éliminés*
- [ ] **AUDIT-04** A/B winner propagation — corrélation variante → reply rate, auto-promote best variant
  **Priorité:** MEDIUM
  **Impact:** Subject line optimization automatique

- [ ] **AUDIT-05** Zod validation sur 5 routes API manquantes (intégrations + email edit)
  **Priorité:** LOW (DEBT-02) — manual validation exists, not blocking

- [x] **AUDIT-06** Éliminer `as any` ✅ *Audit v2: 6 → 2, both justified at SDK boundaries with eslint-disable*
- [x] **AUDIT-07** AI Event logging ✅ *Audit v2: 100% coverage via centralized mistralClient*

- [ ] **AUDIT-08** Remplacer 47 console.log par logger structuré
  **Priorité:** LOW (DEBT-03)

---

<!-- TÂCHES AJOUTÉES PAR AUDIT v2 2026-03-09 (cross-ref RESEARCH) -->

### Tâches ajoutées par audit v2 2026-03-09 (research-backed)

> Classées par impact sur reply rate + deliverability. Sources: RESEARCH-DELIVERABILITY-2026.md + RESEARCH-LANDSCAPE-2026.md

- [x] **RES-01** Spam word scanner dans quality gate ✅ *2026-03-09: 100 trigger words (phrases+words), scanForSpamWords() in spam-words.ts, integrated in draftWithQualityGate() BEFORE LLM scoring. 20 tests.*
  **Fichiers:** `src/server/lib/email/spam-words.ts` (NEW), `src/server/lib/email/quality-gate.ts`
  **Réf:** RESEARCH-DELIVERABILITY §7.3, §11.1 D1
  **Impact:** 67% moins de risque spam si 3+ trigger words détectés et bloqués
  **PASS IF:**
  - Liste de 100+ spam trigger words maintenue dans un fichier constant
  - `draftWithQualityGate()` scanne AVANT le scoring LLM (rapide, pas de coût)
  - Si ≥3 matches → flag dans quality score issues, pas de régénération auto (le LLM peut les corriger)
  - Test unitaire vérifie la détection de 3+ trigger words
  - `pnpm typecheck && pnpm test` passent

- [ ] **RES-02** Auto-pause campagne sur bounce spike **(HIGH — Research D4)**
  **Fichiers:** `src/app/api/webhooks/instantly/route.ts`, `src/server/lib/connectors/instantly.ts`
  **Réf:** RESEARCH-DELIVERABILITY §8.6 D4, §8.1
  **Impact:** Protège la réputation du domaine (bounce >2% détruit la campagne)
  **PASS IF:**
  - Webhook handler compte les bounces par campagne (compteur in-DB ou cache)
  - Si bounce rate >3% après 50+ sends → auto-pause via Instantly API
  - Notification agent dans le chat ("Campaign X auto-paused: 4.2% bounce rate")
  - Test unitaire vérifie le threshold
  - `pnpm typecheck && pnpm test` passent

- [ ] **RES-03** Pre-campaign email verification gate **(HIGH — Research D3)**
  **Fichiers:** `src/server/lib/tools/instantly-tools.ts`
  **Réf:** RESEARCH-DELIVERABILITY §8.6 D3
  **Impact:** Listes non-vérifiées = 7.8% bounce vs 1.2% vérifiées (6.5x)
  **PASS IF:**
  - `instantly_push_campaign` vérifie si les leads ont un `verificationStatus`
  - Si ZeroBounce connecté ET leads non-vérifiés → warning dans le retour tool ("⚠️ 45/120 leads not verified. Run verify_emails first to prevent bounces.")
  - Si >5% invalid détectés → bloque le push avec message explicatif
  - Ne bloque PAS si ZeroBounce pas connecté (graceful degradation)
  - `pnpm typecheck && pnpm test` passent

- [ ] **RES-04** Industry benchmarks dans reporting **(MEDIUM — Research R6.1)**
  **Fichiers:** `src/server/lib/analytics/insights.ts`
  **Réf:** RESEARCH-LANDSCAPE §6, RESEARCH-DELIVERABILITY §10.2
  **Impact:** L'utilisateur comprend si ses performances sont bonnes ou mauvaises
  **PASS IF:**
  - `INDUSTRY_BENCHMARKS` constant avec reply rates par industrie (SaaS 8-12%, HR 8-13%, etc.)
  - `getCampaignReport()` compare reply rate vs benchmark de l'industrie de la campagne
  - Message type: "Your 6% reply rate in SaaS is below the 8-12% industry benchmark"
  - `pnpm typecheck && pnpm test` passent

- [ ] **RES-05** Subject line pattern tracking **(MEDIUM — Research R6.2)**
  **Fichiers:** `src/server/lib/tools/email-tools.ts`, `src/server/lib/analytics/correlator.ts`
  **Réf:** RESEARCH-LANDSCAPE §6
  **Impact:** Data-driven pattern selection pour optimiser open rate
  **PASS IF:**
  - `DraftedEmail.metadata` inclut `subjectPattern` (question/observation/curiosity/direct/personalized)
  - LLM output schema demande quel pattern a été utilisé pour chaque variante
  - Correlator a une query `getReplyRateBySubjectPattern()`
  - `pnpm typecheck && pnpm test` passent

- [ ] **RES-06** A/B auto-pause avec z-test statistique **(MEDIUM — Research R6.3)**
  **Fichiers:** `src/server/lib/analytics/ab-testing.ts` (NEW), `src/queue/analytics-sync-worker.ts`
  **Réf:** RESEARCH-LANDSCAPE §6, RESEARCH-DELIVERABILITY §11.1
  **Impact:** Concentration du volume sur les variantes gagnantes
  **PASS IF:**
  - Two-proportion z-test implémenté: z = (p1-p2) / sqrt(p_pool * (1-p_pool) * (1/n1 + 1/n2))
  - Significant si |z| > 1.96 (95% confidence)
  - Vérifié seulement si min 100 sends par variante ET 5+ jours
  - Loser variante pausée via Instantly API
  - Test unitaire vérifie le calcul z-test
  - `pnpm typecheck && pnpm test` passent

- [ ] **RES-07** Style learner catégorisé **(MEDIUM — Research R6.4)**
  **Fichiers:** `src/server/lib/email/style-learner.ts`
  **Réf:** STRATEGY §7.3.4, RESEARCH-LANDSCAPE §6
  **Impact:** Corrections plus précises (subject vs tone vs CTA)
  **PASS IF:**
  - `captureStyleCorrection()` catégorise automatiquement: subject | tone | cta | opener | length | general
  - `getStyleSamples()` filtre par catégorie optionnelle
  - Catégorisation via heuristique simple (longueur changée → length, subject changé → subject, etc.)
  - `pnpm typecheck && pnpm test` passent

- [ ] **RES-08** Deliverability guidance dans PHASE_ACTIVE prompt **(LOW — Research D6)**
  **Fichiers:** `src/app/api/agents/chat/route.ts`
  **Réf:** RESEARCH-DELIVERABILITY §5.4, §11.2 D6
  **Impact:** Agent informe sur warmup, custom tracking domain, volume limits
  **PASS IF:**
  - PHASE_ACTIVE/PHASE_PUSHING inclut 3-4 lignes de deliverability guidance
  - Agent conseille custom tracking domain + warmup status
  - Pas de token inflation (< 50 tokens ajoutés)
  - `pnpm typecheck && pnpm test` passent
