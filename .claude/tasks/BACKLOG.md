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

### Pipeline post-launch (STRATEGY §11 — ~~actuel 0/10~~ **actuel 6.5/10**, cible 5/10) ✅ CIBLE DÉPASSÉE

- [x] **T2-PIPE-01** Extension LeadStatus enum ✅ *Audit 2026-03-09: 8 statuts post-PUSHED, state machine enforced, lead-status.ts:10-48*
- [x] **T2-PIPE-02** Webhook Instantly ✅ *Audit 2026-03-09: 4 event types (reply, bounce, unsub, completed), webhooks/instantly/route.ts*
- [x] **T2-PIPE-03** Sync campaign performance ✅ *Audit 2026-03-09: analytics-sync-worker.ts (30min), EmailPerformance + StepAnalytics*
- [x] **T2-PIPE-04** Reply classification ✅ *Audit 2026-03-09: classify_reply tool, Mistral Small, 6 interest levels, pipeline-tools.ts:117-234*
- [x] **T2-PIPE-05** Reply drafting + sending ✅ *Audit 2026-03-09: draft_reply + reply_to_email tools, pipeline-tools.ts:236-380*

### Intégrations Tier A bloquantes (STRATEGY §4.2)

- [x] **T2-INT-01** Import CSV ✅ *Audit 2026-03-09: import_leads_csv in pipeline-tools.ts:382-491. Multi-format (comma/semicolon/tab), field mapping FR+EN, dedup against existing leads, campaign assignment. Minor gap: quoted fields with embedded delimiters break.*
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

- [x] **DEBT-01** Éliminer les `any` TypeScript ✅ *Audit v3: 6 occurrences across 2 files (mistral-client.ts:3, instantly-sourcing.ts:3), all at SDK boundaries, all justified with eslint-disable comments. No further action needed.*
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

- [ ] **AUDIT-05** Zod validation sur 7 routes API manquantes (6 intégrations + email edit + campaign export)
  **Priorité:** LOW (DEBT-02) — manual validation exists, not blocking. Auth + tRPC handle their own validation.

- [x] **AUDIT-06** Éliminer `as any` ✅ *Audit v3: 6 occurrences across 2 files (mistral-client.ts + instantly-sourcing.ts). All at SDK boundaries, all justified. CLOSED.*
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

- [x] **RES-02** Auto-pause campagne sur bounce spike ✅ *Audit 2026-03-09: bounce-guard.ts — pure function shouldPauseCampaign() + checkAndPauseCampaign() called from webhook handler. 3% threshold after 50+ sends. Auto-pause via Instantly API + chat notification. Tests in bounce-guard.test.ts.*

- [x] **RES-03** Pre-campaign email verification gate ✅ *2026-03-09: checkVerificationGate() pure function in instantly-tools.ts. verificationStatus field on Lead. verify_emails stores status. instantly_add_leads_to_campaign blocks >5% invalid, warns unverified, pass-through without ZeroBounce. 16 tests.*
  **Fichiers:** `src/server/lib/tools/instantly-tools.ts`
  **Réf:** RESEARCH-DELIVERABILITY §8.6 D3
  **Impact:** Listes non-vérifiées = 7.8% bounce vs 1.2% vérifiées (6.5x)
  **PASS IF:**
  - `instantly_push_campaign` vérifie si les leads ont un `verificationStatus`
  - Si ZeroBounce connecté ET leads non-vérifiés → warning dans le retour tool ("⚠️ 45/120 leads not verified. Run verify_emails first to prevent bounces.")
  - Si >5% invalid détectés → bloque le push avec message explicatif
  - Ne bloque PAS si ZeroBounce pas connecté (graceful degradation)
  - `pnpm typecheck && pnpm test` passent

- [x] **RES-04** Industry benchmarks dans reporting ✅ *Already implemented: benchmarks.ts with 20 industries + fuzzy matching + aliases. getBenchmarkContext() integrated in getCampaignReport(). 11 tests in benchmarks.test.ts.*
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

---

<!-- TÂCHES AJOUTÉES PAR AUDIT ENRICHMENT 2026-03-09 -->

### Tâches ajoutées par audit enrichment 2026-03-09

> Source: `.claude/findings/audit-enrichment.md`
> Classées par impact + effort.

- [x] **ENR-BUG-01** Fix Apollo domain parameter bug ✅ *2026-03-09: Fixed body.organization_name → body.domain in apollo.ts:177. 16 tests in apollo-connector.test.ts (enrichPerson, enrichOrganization, testApolloConnection).*

- [x] **ENR-RECENCY-01** Signal recency weighting ✅ *2026-03-10: hiringSignals/fundingSignals migrated from string[] to {detail,date,source}[]. signalAge() decay function. computeSignalBoost() recency-weighted. Backward-compat Zod parsing. 33 tests in signal-boost.test.ts.*
  **Fichiers:** `src/server/lib/enrichment/summarizer.ts`, `src/server/lib/enrichment/icp-scorer.ts`, `src/server/lib/email/prompt-builder.ts`
  **Réf:** RESEARCH-LEAD-ENRICHMENT E3.1, audit-enrichment.md ISSUE 2
  **Impact:** Triggers périmés dans les openers email nuisent à la crédibilité. Triggers récents (<3 mois) = 3-5x plus de replies.
  **PASS IF:**
  - `hiringSignals` et `fundingSignals` migrent de `string[]` vers `{detail: string, date: string|null, source: string|null}[]` (comme `leadershipChanges`)
  - Fonction `signalAge(date: string|null): number` — <3mo=1.0, 3-6mo=0.7, 6-12mo=0.3, >12mo=0.1
  - `computeSignalBoost()` pondère chaque signal par son recency score
  - Schema Zod mis à jour avec backward-compat parsing (string → {detail: string, date: null, source: null})
  - Tests unitaires pour signalAge + signal boost pondéré
  - `pnpm typecheck && pnpm test` passent

- [x] **ENR-CACHE-01** Short TTL for failed scrapes ✅ *2026-03-09: Dual TTL — null markdown uses 1h TTL, successful scrapes keep 7d. 15 tests in company-cache.test.ts.*
  **Fichiers:** `src/server/lib/enrichment/company-cache.ts`
  **Réf:** audit-enrichment.md ISSUE 3
  **Impact:** Échec Jina transitoire (429, timeout) bloque le domaine pendant 7 jours au lieu de réessayer.
  **PASS IF:**
  - Si `markdown` est null, TTL cache = 1 heure (pas 7 jours)
  - Si `markdown` est non-null, TTL reste 7 jours
  - `getOrScrapeCompany()` re-scrape les null expirés (>1h)
  - Test unitaire vérifie les 2 TTL
  - `pnpm typecheck && pnpm test` passent

- [ ] **ENR-TEST-01** Tests unitaires scraper Jina **(MEDIUM — 2h)**
  **Fichiers:** `tests/jina-scraper.test.ts` (NEW)
  **Réf:** audit-enrichment.md ISSUE 4
  **Impact:** Scraping multi-page (critical path) = 0 tests. Régressions invisibles.
  **PASS IF:**
  - Mock Jina responses (success, 404, 429, timeout, empty)
  - Test `scrapeViaJina()` — 5 error types retournent le bon reason
  - Test `scrapeWithFallbacks()` — retourne le premier succès, skip les fails
  - Test `scrapeLeadCompany()` — combine homepage + sub-pages, truncation
  - Minimum 10 tests
  - `pnpm typecheck && pnpm test` passent

- [ ] **ENR-TEST-02** Tests unitaires merge + resolveLeadUrl + cache **(MEDIUM — 1.5h)**
  **Fichiers:** `tests/enrichment-merge.test.ts` (NEW)
  **Réf:** audit-enrichment.md ISSUE 4
  **Impact:** Merge logic (LinkedIn + Apollo + company data) et URL resolution = 0 tests.
  **PASS IF:**
  - Test `mergeLinkedInData()` — LinkedIn fields override nulls, preserve existing
  - Test `mergeApolloData()` — Apollo fills gaps, doesn't overwrite
  - Test `resolveLeadUrl()` — priority order (domain > website > LinkedIn), https prefix
  - Test `summarizeEnrichmentQuality()` — thresholds rich/partial/minimal/none
  - Minimum 12 tests
  - `pnpm typecheck && pnpm test` passent

- [ ] **ENR-TRUNC-01** Per-section char budget in multi-page scraper **(MEDIUM — 1h)**
  **Fichiers:** `src/server/lib/connectors/jina.ts`
  **Réf:** audit-enrichment.md ISSUE 5
  **Impact:** Truncation naive à 15K coupe les pages les plus riches en signaux (careers, press) si homepage est longue.
  **PASS IF:**
  - Budget par section: homepage 4K, about 3K, blog 3K, careers 2.5K, press 2.5K = 15K total
  - Chaque section tronquée indépendamment AVANT concaténation
  - Test unitaire vérifie qu'aucune section ne déborde et que careers/press ne sont pas perdus
  - `pnpm typecheck && pnpm test` passent

- [ ] **ENR-COMPL-01** Enrichment completeness score stored on lead **(MEDIUM — 2h)**
  **Fichiers:** `src/server/lib/enrichment/summarizer.ts`, `src/server/lib/tools/enrichment-tools.ts`, `prisma/schema.prisma`
  **Réf:** RESEARCH-LEAD-ENRICHMENT E3.3, audit-enrichment.md ISSUE 6
  **Impact:** Quality gate ne peut pas détecter les emails rédigés avec des données minces. Leads avec 3/18 champs = emails génériques.
  **PASS IF:**
  - `computeEnrichmentCompleteness(data: EnrichmentData): number` — count non-null/non-empty fields, return 0-1
  - Score stocké sur Lead (nouveau champ `enrichmentCompleteness Float?`)
  - Calculé et écrit dans batch + single enrichment
  - Quality gate affiche warning si completeness < 0.4
  - Test unitaire vérifie les seuils (0 fields = 0, all fields = 1.0)
  - `pnpm typecheck && pnpm test` passent

---

<!-- TÂCHES AJOUTÉES PAR AUDIT SUBJECT LINES 2026-03-09 -->

### Tâches ajoutées par audit subject lines 2026-03-09

> Source: `.claude/findings/audit-subject-lines.md`
> Classées par impact. SUBJ-FIX-01 is CRITICAL — prevents raw template text reaching prospects.

- [x] **SUBJ-FIX-01** Fix variant placeholder fallback bug ✅ *2026-03-09: buildLeadCustomVars() always sets v2/v3 — falls back to primary subject. 10 tests in lead-custom-vars.test.ts.*

- [x] **SUBJ-FIX-02** Fix draft_single_email dropping subjects array ✅ *2026-03-09: Added `subjects` destructuring + `subjectVariants` storage in upsert (create+update). Matches batch pattern exactly. email-tools.ts:357,391,405,413.*
  **Fichiers:** `src/server/lib/tools/email-tools.ts`
  **Réf:** audit-subject-lines.md ISSUE 2
  **Impact:** Single-drafted emails lose A/B variants → pushed to Instantly with 1 subject instead of 3.
  **PASS IF:**
  - `draft_single_email` destructures `subjects` from `draftWithQualityGate()` return
  - `subjectVariants` is written in the `prisma.draftedEmail.upsert()` call (both create and update)
  - `pnpm typecheck && pnpm test` passent

- [x] **SUBJ-VALID-01** Subject line length validation in quality gate ✅ *2026-03-09: checkSubjectLength() validates primary + variants — max 5 words, max 50 chars. Penalizes score -1 + triggers retry. 15 tests in quality-gate.test.ts.*
  **Fichiers:** `src/server/lib/email/quality-gate.ts`
  **Réf:** audit-subject-lines.md ISSUE 4, RESEARCH-DELIVERABILITY §7.4
  **Impact:** LLM may generate 6+ word or 50+ char subjects that violate constraints. No deterministic enforcement.
  **PASS IF:**
  - `draftWithQualityGate()` checks subject word count (>5 words) and char count (>50 chars) deterministically
  - If violated, adds issue to quality score and triggers regeneration
  - Does NOT auto-truncate (unsafe)
  - Test unitaire vérifie la détection de long subjects
  - `pnpm typecheck && pnpm test` passent

- [x] **SUBJ-NUM-01** Add numbers guidance to subject patterns ✅ *2026-03-10: Observation + Curiosity gap examples updated with number variants. "+45% open rate" guidance note added. Snapshot test updated. prompt-builder.ts:572-578.*
  **Fichiers:** `src/server/lib/email/prompt-builder.ts`
  **Réf:** audit-subject-lines.md ISSUE 6, RESEARCH-DELIVERABILITY §7.4 (+45% open rate), RESEARCH-LANDSCAPE §R2.3 (+113% lift)
  **Impact:** Research shows numbers in subjects significantly boost open rates.
  **PASS IF:**
  - Curiosity gap and Observation pattern examples include number variants (e.g., "3 SaaS teams switching to...", "47% of {{industry}} leaders...")
  - A brief note added: "Include a concrete number when available — numbers boost open rates by +45%."
  - Snapshot test updated
  - `pnpm typecheck && pnpm test` passent

---

<!-- TÂCHES AJOUTÉES PAR AUDIT A/B TESTING 2026-03-09 -->

### Tâches ajoutées par audit A/B testing 2026-03-09

> Source: `.claude/findings/audit-ab-testing.md`
> **Score: 5/10 (target 5/10 ✅ atteint)** — variant attribution + correlation done. Missing: auto-pause + winner propagation.
> Dependency chain: ~~AB-ATTR-01~~ ✅ → ~~AB-CORR-01~~ ✅ → AB-REPORT-01 + RES-06 + AUDIT-04

- [x] **AB-ATTR-01** Variant-to-lead attribution via email sync ✅ *2026-03-09: variant-attribution.ts — matchVariantIndex() pure function + syncVariantAttribution(). Fetches sent emails (ue_type=1), matches subject to DraftedEmail variants (normalized: case-insensitive, Re:/Fwd: stripping). variantIndex Int? on EmailPerformance. Integrated in sync worker + tool. 22 tests.*

- [x] **AB-CORR-01** Correlator query for subject variant performance ✅ *2026-03-09: getReplyRateBySubjectVariant() in correlator.ts — groups by variantIndex, joins DraftedEmail for subject text. Pure helpers: getSubjectForVariant() + toVariantPerformanceRows(). CampaignReport.variantBreakdown added to insights.ts. subject_variant dimension in insights + analytics tools. 15 new tests in correlator.test.ts (36 total).*

- [x] **AB-REPORT-01** Variant performance in campaign report ✅ *Already implemented: variantBreakdown in CampaignReport with subject text labels via VariantPerformanceRow. Surfaced in campaign_performance_report tool. Variant insight built from data.*
  **Fichiers:** `src/server/lib/analytics/insights.ts`, `src/server/lib/tools/analytics-tools.ts`
  **Réf:** audit-ab-testing.md ISSUE 9
  **Dépend de:** AB-CORR-01
  **Impact:** Users see "Variant A: 22% open, Variant B: 15% open" in performance reports. Transparency on A/B results.
  **PASS IF:**
  - `getCampaignReport()` includes `variantBreakdown` section: per-step, per-variant (subject, sent, opened, replied, rates)
  - Variants labeled with their actual subject text (not just "Variant 0/1/2")
  - `campaign_performance_report` tool surfaces variant data to the agent
  - Agent can recommend "Variant B outperforms A — consider using this pattern for future campaigns"
  - `pnpm typecheck && pnpm test` passent

---

<!-- TÂCHES AJOUTÉES PAR AUDIT CADENCE & SEQUENCE 2026-03-09 -->

### Tâches ajoutées par audit cadence & sequence 2026-03-09

> Source: `.claude/findings/audit-cadence-sequence.md`
> Score: 7.5/10 (target 7/10 ✅ dépassé). Gaps: reply-style format, Step 0 threshold, word count alignment, test coverage.

- [x] **CAD-REPLY-01** Reply-style format for Step 1 Value-add ✅ *2026-03-09: Added reply-style casual opener guidance to Value-add (Step 1) framework. 3 example openers provided. Core content unchanged. Research: +30% lift on first follow-up (Instantly Benchmark 2026). prompt-builder.ts:28-40.*
  **Fichiers:** `src/server/lib/email/prompt-builder.ts`
  **Réf:** RESEARCH-COLD-EMAIL-SCIENCE §3 (Step 2 "reply-style" = +30% lift), audit-cadence-sequence.md ISSUE 1

- [x] **CAD-THRESH-01** Differentiated quality gate threshold for Step 0 ✅ *2026-03-09: getMinQualityScore(step) returns 8 for step 0, 7 for others. LLM scorer prompt stricter for Step 0. 13 tests in quality-gate.test.ts.*
  **Fichiers:** `src/server/lib/email/quality-gate.ts`
  **Réf:** RESEARCH-COLD-EMAIL-SCIENCE §2 (58-79% replies from Step 0), audit-cadence-sequence.md ISSUE 3
  **Impact:** Step 0 generates 58-79% of all replies. Uniform 7/10 threshold means mediocre first touches pass. Raising to 8/10 filters below-average first emails at ~$0.002/lead.
  **PASS IF:**
  - `draftWithQualityGate()` accepts `step` parameter (already available in `context`)
  - Step 0 threshold = 8/10, all other steps = 7/10 (or configurable)
  - MAX_RETRIES remains 2 (no extra cost for most emails)
  - Test unitaire vérifie que Step 0 rejects score 7, Step 1+ accepts score 7
  - `pnpm typecheck && pnpm test` passent

- [x] **CAD-WORDS-01** Align word counts to STRATEGY + add deterministic enforcement ✅ *2026-03-09: maxWords aligned [85,65,70,65,50,45], deterministic enforcement in draftWithQualityGate() at 130% threshold. 5 new tests in quality-gate.test.ts.*
  **Fichiers:** `src/server/lib/email/prompt-builder.ts`, `src/server/lib/email/quality-gate.ts`
  **Réf:** STRATEGY §7.2.2 (target word counts), RESEARCH consensus (<80 words), audit-cadence-sequence.md ISSUE 2 + 4
  **Impact:** Steps 2 (80 vs target 60) and 5 (50 vs target 40) significantly exceed targets. No runtime enforcement — LLM can generate 120-word emails without detection.
  **PASS IF:**
  - maxWords in `getFramework()` aligned closer to STRATEGY: Step 0=85, Step 1=65, Step 2=70, Step 3=65, Step 4=50, Step 5=45 (compromise between STRATEGY targets and framework needs)
  - `draftWithQualityGate()` adds deterministic word count check: `body.split(/\s+/).length > maxWords * 1.3` → adds issue to qualityScore + triggers regeneration
  - `getFramework()` exported (already is) so quality gate can access maxWords for the step
  - Test unitaire: 150-word body at Step 4 (maxWords=50) triggers word count violation
  - `pnpm typecheck && pnpm test` passent

- [x] **CAD-TEST-01** Unit tests for framework definitions, delays, CTA selection ✅ *2026-03-11: 41 tests covering getFramework, selectCta, buildPreviousEmailsSection, buildStepAnnotation, CTA_LIBRARY, TIER_CADENCES, getPredominantTier. Inline snapshot for framework regression. tests/cadence-sequence.test.ts.*
  **Fichiers:** `tests/cadence-sequence.test.ts` (NEW)
  **Réf:** audit-cadence-sequence.md Test Coverage Assessment
  **Impact:** Zero unit tests for framework definitions, delay logic, CTA selection, step annotations. A framework regression would go undetected.
  **PASS IF:**
  - Test `getFramework(0..5)` returns correct name, maxWords, non-empty instructions for each step
  - Test `getFramework()` default case returns step 0 framework
  - Snapshot test for all 6 framework names + maxWords (regression guard)
  - Test `selectCta()` returns medium commitment for steps 0,2 and low commitment for steps 1,3,4,5
  - Test `buildPreviousEmailsSection()` with 0, 1, 3 previous emails + truncation behavior
  - Test `buildStepAnnotation()` with sufficient/insufficient sample sizes
  - Test default delays [0,2,5,9,14,21] are used when not overridden
  - Minimum 15 tests
  - `pnpm typecheck && pnpm test` passent

---

<!-- TÂCHES AJOUTÉES PAR AUDIT FEEDBACK LOOP 2026-03-09 -->

### Tâches ajoutées par audit feedback loop 2026-03-09

> Source: `.claude/findings/audit-feedback-loop.md`
> Score: 5/10 (target 5/10 ✅ atteint but fragile). Architecture excellent, data quality and coverage are the gaps.
> Priority: FL-METRIC-01 and FL-GUARD-01 are the highest-impact fixes — they fix the FOUNDATION of the feedback loop.

- [x] **FL-METRIC-01** Correlator uses positive reply rate instead of raw reply count ✅ *2026-03-09: All 6 correlator queries + getWinningEmailPatterns() now filter for positive replies only (replyAiInterest IS NULL OR >= 5). Backward compat: unclassified replies still count. Pure function isPositiveReply() + POSITIVE_REPLY_INTEREST_THRESHOLD=5 exported. 21 tests in correlator.test.ts.*
  **Fichiers:** `src/server/lib/analytics/correlator.ts`, `src/server/lib/email/style-learner.ts`
  **Réf:** RESEARCH-FEEDBACK-LOOPS §FL-1, audit-feedback-loop.md ISSUE 1
  **Impact:** Fixes the primary metric of the entire feedback loop. All 6 correlator queries, adaptive weights, winning patterns, and insights are currently polluted by negative replies ("stop emailing me" counted as positive signal). LeadSens already classifies replies into 6 interest levels — this data is NEVER used in correlation.
  **PASS IF:**
  - All 6 correlator queries replace `ep."replyCount" > 0` with a condition that considers `ep."replyAiInterest"` — only count as reply if `replyAiInterest IS NULL OR replyAiInterest >= 5` (positive or unclassified)
  - `getWinningEmailPatterns()` also uses positive-only filter (join EmailPerformance.replyAiInterest)
  - Backward compatible: leads with no reply classification (replyAiInterest IS NULL) still count as replies (graceful degradation for campaigns without classification)
  - Test unitaire: dataset with positive + negative replies returns only positive in reply rate calculation
  - `pnpm typecheck && pnpm test` passent

- [x] **FL-GUARD-01** Negative reply spike auto-pause ✅ *2026-03-09: reply-guard.ts — pure function shouldPauseOnNegativeReplies() + checkAndPauseOnNegativeReplies() called from webhook handler. ≥3 negative replies (aiInterest < 3) in 24h AND ≥20 sends → auto-pause via Instantly API + chat notification. Same pattern as bounce-guard.ts. 21 tests in reply-guard.test.ts.*
  **Fichiers:** `src/server/lib/analytics/reply-guard.ts` (NEW), `src/app/api/webhooks/instantly/route.ts`
  **Réf:** RESEARCH-FEEDBACK-LOOPS §FL-3, Enginy AI: "stop immediately if complaints spike", audit-feedback-loop.md ISSUE 2
  **Impact:** Protects domain reputation from spam complaint cascades. Complements existing bounce-guard.
  **PASS IF:**
  - Pure function: `shouldPauseOnNegativeReplies(totalSends, negativeReplyCount24h) → { shouldPause, rate }`
  - Threshold: ≥3 negative replies (replyAiInterest < 3) within 24h AND ≥20 total sends
  - `checkAndPauseOnReplies(campaignId)` — counts negative replies in last 24h from Reply table, auto-pauses via Instantly API
  - Called from webhook handler after reply_received event IF `ai_interest_value` present and < 3
  - Stores notification in conversation (same pattern as bounce-guard.ts)
  - Test unitaire for pure function (below threshold, at threshold, above threshold)
  - `pnpm typecheck && pnpm test` passent

- [x] **FL-DRY-01** Extract shared analytics sync logic ✅ *Already implemented during Inngest migration: syncSingleCampaign() in analytics/sync.ts used by both inngest cron and analytics-tools.ts. No duplication.*
  **Fichiers:** `src/server/lib/analytics/sync.ts` (NEW), `src/queue/analytics-sync-worker.ts`, `src/server/lib/tools/analytics-tools.ts`
  **Réf:** audit-feedback-loop.md ISSUE 5
  **Impact:** Eliminates copy-paste between worker (117 lines) and tool (124 lines). Bug fixes apply to both paths automatically.
  **PASS IF:**
  - `syncCampaignAnalytics(apiKey, campaignId, instantlyCampaignId)` extracted to `analytics/sync.ts`
  - Function handles: (1) fetch+upsert overall analytics, (2) fetch+upsert step analytics, (3) paginate+upsert lead performance
  - Both `analytics-sync-worker.ts` and `analytics-tools.ts:sync_campaign_analytics` call the shared function
  - No logic duplication between the two callers
  - `pnpm typecheck && pnpm test` passent

- [ ] **FL-TEST-01** Unit tests for feedback loop components **(MEDIUM — 3h)**
  **Fichiers:** `tests/feedback-loop.test.ts` (NEW)
  **Réf:** audit-feedback-loop.md ISSUE 6
  **Impact:** 870 lines of untested feedback loop code. SQL query correctness, rate calculations, normalization, confidence thresholds, and pattern extraction are all unguarded.
  **PASS IF:**
  - Test `toCorrelationRows()` — filters rows with < 5 sent, computes correct openRate/replyRate
  - Test `buildInsight()` — minimum 2 rows + 20 total sent required, correct top/bottom identification, correct confidence levels
  - Test `getDataDrivenWeights()` — normalization to 0-10 scale, null if < 2 significant signal types, zero maxRate handling
  - Test `getStepAnnotation()` — null if < 50 sent, correct isTop boolean
  - Test `getWinningEmailPatterns()` — correct pattern key construction, frequency sorting, top 3 limit
  - Test `captureStyleCorrection()` + `getStyleSamples()` — roundtrip with mock DB
  - Minimum 20 tests
  - `pnpm typecheck && pnpm test` passent

---

<!-- TÂCHES AJOUTÉES PAR AUDIT PIPELINE POST-LAUNCH 2026-03-09 -->

### Tâches ajoutées par audit pipeline post-launch 2026-03-09

> Source: `.claude/findings/audit-pipeline-post-launch.md`
> Score: 6.5/10 (target 5/10 ✅ dépassé). PIPE-SEC-01 + PIPE-SEQ-01 + RES-03 DONE. Remaining: data integrity + test coverage.
> Priority: PIPE-SIDE-01 + PIPE-DATA-01 are quick wins. PIPE-TEST-01 is the highest-impact remaining task.

- [x] **PIPE-SEC-01** Webhook HMAC authentication ✅ *2026-03-09: HMAC-SHA256 with timing-safe comparison, graceful degradation when no secret, 14 tests in webhook-auth.test.ts*
  **Fichiers:** `src/app/api/webhooks/instantly/route.ts`
  **Réf:** audit-pipeline-post-launch.md ISSUE 1
  **Impact:** Unauthenticated webhook = anyone can pause campaigns (fake bounces), pollute reply data, or transition leads. Production blocker.
  **PASS IF:**
  - `INSTANTLY_WEBHOOK_SECRET` env var added to `.env.example`
  - If secret configured: verify HMAC-SHA256 of request body against signature header
  - Invalid signature → 401 Unauthorized
  - No secret configured → accept all events with console.warn (graceful degradation)
  - Test: valid signature passes, invalid returns 401, missing secret accepts all
  - `pnpm typecheck && pnpm test` passent

- [x] **PIPE-SEQ-01** Remove lead from Instantly sequence on INTERESTED/NOT_INTERESTED/MEETING_BOOKED ✅ *2026-03-09: removeFromInstantlySequence() in pipeline-tools.ts — calls updateLeadInterestStatus after classify_reply transitions. Maps INTERESTED→1, NOT_INTERESTED→-1, MEETING_BOOKED→2 (Instantly API §4.2). Best-effort, non-blocking. 11 tests in sequence-removal.test.ts.*
  **Fichiers:** `src/server/lib/tools/pipeline-tools.ts`, `src/server/lib/connectors/instantly.ts`
  **Réf:** STRATEGY §11.2 ("retrait de la séquence"), audit-pipeline-post-launch.md ISSUE 3
  **Impact:** Interested leads continue receiving follow-up emails. Loses deals. Single most damaging UX gap.
  **PASS IF:**
  - After transitioning to INTERESTED, NOT_INTERESTED, or MEETING_BOOKED, calls Instantly API to remove lead from campaign
  - Uses `POST /api/v2/leads/status` or equivalent to mark lead as "completed" in Instantly
  - Best-effort: failure to remove from Instantly doesn't block the status transition
  - Test: mock Instantly API call, verify it's called after INTERESTED transition
  - `pnpm typecheck && pnpm test` passent

- [x] **PIPE-SIDE-01** Add isSideEffect to classify_reply + prevent duplicate Replies ✅ *2026-03-09: isSideEffect: true on classify_reply. isDuplicateReply() checks body prefix (100 chars) within 5-min window. 11 tests in classify-reply-dedup.test.ts.*
  **Fichiers:** `src/server/lib/tools/pipeline-tools.ts`
  **Réf:** audit-pipeline-post-launch.md ISSUE 4
  **Impact:** classify_reply changes lead state without user confirmation. Duplicate Reply records from webhook + classify_reply race condition.
  **PASS IF:**
  - `classify_reply` has `isSideEffect: true`
  - Before creating Reply record, check if a Reply with matching body (first 100 chars) exists in the thread within last 5 minutes — skip if duplicate
  - `pnpm typecheck && pnpm test` passent

- [x] **PIPE-DATA-01** Fix empty fromEmail/toEmail in Reply records ✅ *2026-03-09: classify_reply sets toEmail=lead.email (INBOUND), reply_to_email fetches lead for toEmail (OUTBOUND). fromEmail OUTBOUND remains TODO (needs Instantly sending account resolution).*
  **Fichiers:** `src/server/lib/tools/pipeline-tools.ts`
  **Réf:** audit-pipeline-post-launch.md ISSUE 5
  **Impact:** Data integrity — Reply records from classify_reply and reply_to_email have empty email fields.
  **PASS IF:**
  - `classify_reply` line 199: `toEmail` set to `lead.email`
  - `reply_to_email` line 365: `toEmail` set to lead's email (fetch from DB)
  - `pnpm typecheck && pnpm test` passent

- [x] **PIPE-SENT-01** Resolve phantom SENT status ✅ *2026-03-10: Resolved by WEBHOOK-EXPAND-01 — email_sent webhook event transitions PUSHED→SENT. No more phantom state.*

- [ ] **PIPE-CRM-01** Enrich CRM contact with pipeline data **(MEDIUM — 1h)**
  **Fichiers:** `src/server/lib/tools/crm-tools.ts`
  **Réf:** STRATEGY §11.3 Phase 6 ("toutes les données enrichies"), audit-pipeline-post-launch.md ISSUE 6
  **Impact:** Sales team receives enrichment intelligence with the CRM contact.
  **PASS IF:**
  - `crm_create_contact` sends additional fields: industry, company website, LinkedIn URL, ICP score
  - Enrichment notes (pain points, recent news) serialized into a notes property
  - `pnpm typecheck && pnpm test` passent

- [ ] **PIPE-TEST-01** Unit tests for lead-status state machine + webhook + CSV parser **(HIGH — 3h)**
  **Fichiers:** `tests/pipeline-post-launch.test.ts` (NEW)
  **Réf:** audit-pipeline-post-launch.md ISSUE 9
  **Impact:** 1138 lines of zero-tested pipeline code controlling lead data integrity.
  **PASS IF:**
  - Test all valid transitions from VALID_TRANSITIONS (10+ cases)
  - Test all invalid transitions throw (SOURCED→PUSHED, DRAFTED→REPLIED, etc.)
  - Test batch transition with mixed valid/invalid leads
  - Test CSV parser: comma/semicolon/tab detection, field mapping, dedup, empty rows, missing email
  - Test `buildInsightSuggestions()`: bounce >5%, reply <5%, high performer
  - Minimum 25 tests
  - `pnpm typecheck && pnpm test` passent

---

<!-- TÂCHES AJOUTÉES PAR RESEARCH REFRESH 2026-03-09 -->

### Tâches ajoutées par research refresh 2026-03-09

> Source: `.claude/findings/2026-03-09-research-refresh.md`
> Sources: Reddit r/coldemail (Mar 8-9), LeadsMonky (Mar 4), Instantly blog (Feb 24)

- [x] **QG-FILLER-01** Filler phrase detection in quality gate ✅ *2026-03-09: 35 filler phrases in filler-phrases.ts, scanForFillerPhrases() checks first 2 sentences (after greeting). Integrated in draftWithQualityGate() before LLM scoring — any match = -1 penalty + retry. 24 tests in filler-phrases.test.ts.*
  **Fichiers:** `src/server/lib/email/filler-phrases.ts` (NEW), `src/server/lib/email/quality-gate.ts`
  **Réf:** research-refresh.md §8, Reddit r/coldemail 2026-03-09
  **Impact:** Generic opener phrases ("I came across your profile", "I admire what you're building") are actively harmful — prospects pattern-match them as templates. Zero-cost deterministic check, same pattern as spam-words.ts.
  **PASS IF:**
  - Blocklist of 15+ known filler phrases in `filler-phrases.ts`
  - `scanForFillerPhrases(body)` returns matches found in first 2 sentences
  - Integrated in `draftWithQualityGate()` BEFORE LLM scoring (zero cost)
  - If filler detected → score -1, issue added, forces retry
  - Test unitaire: body with "I came across your profile" triggers detection
  - `pnpm typecheck && pnpm test` passent

- [x] **PROMPT-BRIDGE-01** Strengthen signal-to-pain connection in prompt ✅ *2026-03-09: Connection bridge now demands signal→pain REASONING (not just mention). BAD/GOOD example added. 3-step bridge: signal → WHY it implies pain → solution with timeline proof. 25 tests pass. prompt-builder.ts:533-544.*

- [x] **SCORE-STACK-01** Compound signal scoring (multiplicative, not additive) ✅ *2026-03-10: Compound bonus +1/+2/+3 for 3/4/5+ distinct signal types. CombinedScoreBreakdown.compoundBonus field added. 21 tests (8 new) in signal-boost.test.ts.*
  **Fichiers:** `src/server/lib/enrichment/icp-scorer.ts`
  **Réf:** research-refresh.md §12, Prospeo/Amplemarket 2026 (accounts with 3+ signals = 2.4x conversion)
  **Impact:** Current `computeSignalBoost()` adds weights independently. 3+ concurrent signals (hiring + funding + tech change) should multiply — these leads are significantly hotter than single-signal leads.
  **PASS IF:**
  - When 3+ non-zero signal types are present, apply a compound multiplier (e.g., 1.5x)
  - `computeSignalBoost()` returns higher score for multi-signal leads
  - Test unitaire: 3 signals scores > 3 × (1 signal score) / 3
  - `pnpm typecheck && pnpm test` passent

- [x] **WEBHOOK-VAR-01** Use webhook `variant` field for native A/B attribution ✅ *2026-03-09: webhookVariantToIndex() pure function in route.ts. All 3 lead events (reply, bounce, unsub) extract variant field and set variantIndex on EmailPerformance. syncVariantAttribution() kept as backfill. 15 tests in webhook-variant.test.ts.*

- [x] **WEBHOOK-EXPAND-01** Handle additional Instantly webhook events ✅ *2026-03-10: 11 event types (was 4). email_sent→PUSHED→SENT (resolves PIPE-SENT-01), email_opened→openCount/timestamps, link_clicked→clickCount, lead_meeting_booked→MEETING_BOOKED, lead_interested→INTERESTED, lead_not_interested→NOT_INTERESTED, account_error→log. sentAt+sentStep on EmailPerformance. REPLIED→MEETING_BOOKED transition. 21 tests.*

- [ ] **DEDUP-CROSS-01** Cross-campaign lead dedup before push **(MEDIUM — 2h)**
  **Fichiers:** `src/server/lib/tools/instantly-tools.ts`
  **Réf:** research-refresh.md §13, tl;dv 6-layer architecture 2026
  **Impact:** Without cross-campaign dedup, same prospect receives outreach from multiple campaigns. Damages deliverability and reputation as campaign count grows.
  **PASS IF:**
  - Before `instantly_add_leads_to_campaign`, check if any lead email exists in another ACTIVE campaign (status PUSHED/SENT/REPLIED)
  - If duplicates found → warning: "X leads already in active campaigns: [campaign names]. Remove duplicates?"
  - Does NOT auto-remove (user decides, respects curseur d'autonomie)
  - `pnpm typecheck && pnpm test` passent

---

<!-- TÂCHES AJOUTÉES PAR AUDIT v5 2026-03-10 -->

### Tâches ajoutées par audit v5 2026-03-10

> Source: Audit v5 full codebase vs STRATEGY.md vs research vs .claude/findings/
> 3 CRITICAL, 7 HIGH, 12 MEDIUM issues found. Score: 6.9/10 (unchanged).
> Priority: C1-C3 are quick fixes (30 min total) that fix data correctness bugs.

#### CRITICAL — Fix immediately

- [x] **PIPE-METRIC-01** Fix raw `replyCount > 0` in pipeline-tools.ts campaign_insights ✅ *2026-03-10: Replaced 4 occurrences with isPositiveReply(replyCount, replyAiInterest). Consistent with correlator positive-reply-only convention.*
  **Fichiers:** `src/server/lib/tools/pipeline-tools.ts` (lines 610, 614, 618, 637)
  **Réf:** CLAUDE.md analytics convention, audit-feedback-loop.md FL-METRIC-01
  **Impact:** Agent sees inflated reply rates from `campaign_insights` (counts negative replies) vs correlator tools (positive-only). Inconsistent analytics = bad agent decisions.
  **PASS IF:**
  - All `replyCount > 0` in `buildInsightSuggestions()` and `campaign_insights` tool replaced with positive reply filter (replyAiInterest IS NULL OR >= 5)
  - Import `isPositiveReply` or `POSITIVE_REPLY_INTEREST_THRESHOLD` from correlator
  - `pnpm typecheck && pnpm test` passent

- [x] **ROUTE-STEPS-01** Reduce maxSteps from 15 to 5 in chat route ✅ *2026-03-10: maxSteps: 15 → 5. Enforces CLAUDE.md §5 convention.*
  **Fichiers:** `src/app/api/agents/chat/route.ts` (line 698)
  **Réf:** CLAUDE.md §5 convention "Max 5 steps per message"
  **Impact:** LLM can spiral through 15 tool calls per message, burning ~$0.15+ in Mistral tokens. Cost safety + convention violation.
  **PASS IF:**
  - `maxSteps: 15` changed to `maxSteps: 5`
  - `pnpm typecheck && pnpm test` passent

- [x] **WEBHOOK-ATTR-01** Add variantIndex null-guard to reply_received webhook ✅ *2026-03-10: Replaced unconditional spread with conditional updateMany(where: variantIndex null). Prevents overwrite on repeated replies.*
  **Fichiers:** `src/app/api/webhooks/instantly/route.ts` (line 143)
  **Réf:** audit v5, same pattern as email_sent (line 268)
  **Impact:** Repeated replies overwrite variantIndex — corrupts A/B attribution data. email_sent already has the guard, reply_received does not.
  **PASS IF:**
  - `reply_received` update only sets `variantIndex` when current value is null (same pattern as email_sent)
  - Test: second reply_received for same lead does not overwrite variantIndex
  - `pnpm typecheck && pnpm test` passent

#### HIGH — Fix before next release

- [x] **ROUTE-PHASE-01** Add MONITORING phase to getPhasePrompt and PHASE_TOOLS ✅ *2026-03-10: MONITORING case in getPhasePrompt→PHASE_ACTIVE. MONITORING entry in PHASE_TOOLS with full reply mgmt + analytics + CRM tools.*

- [x] **ANALYTICS-ESP-01** Route sync_campaign_analytics through ESPProvider ✅ *2026-03-11: Full ESP abstraction — sync.ts, variant-attribution.ts, inngest cron all use ESPProvider. Added getStepAnalytics() + getLeadsPerformance() to interface. All 3 connectors (Instantly/Smartlead/Lemlist) implement both. Analytics module fully decoupled from instantly.ts.*

- [x] **INSIGHTS-METRIC-01** Filter positive replies in campaign overview stats ✅ *2026-03-10: getCampaignReport() now queries EmailPerformance with positive-reply filter (replyAiInterest IS NULL OR >= 5) for both overview and step breakdown. StepAnalytics used only for sent/opened/bounced.*
  **Fichiers:** `src/server/lib/analytics/insights.ts` (lines 134-141)
  **Réf:** audit v5, same convention as correlator
  **Impact:** Overview reply rate includes negative replies (from StepAnalytics raw count). Inconsistent with correlator positive-reply metrics.
  **PASS IF:**
  - `getCampaignReport` overview `replied` count filters for positive replies (use EmailPerformance with isPositiveReply condition, not StepAnalytics.replied)
  - `pnpm typecheck && pnpm test` passent

- [x] **PROMPT-TRUNC-01** Increase previous email body truncation from 500 to 1500 chars ✅ *2026-03-10: buildPreviousEmailsSection() truncation 500→1500. Follow-ups can now reference full Step 0 narrative.*

- [x] **SUBJ-CONSISTENCY-01** Align subject word count constraint to single value ✅ *2026-03-10: All 4 locations (drafting.ts×2, prompt-builder.ts, quality-gate.ts scorer+enforcement+comment) aligned to "2-5 words". Gate SUBJECT_MAX_WORDS=5 unchanged.*

- [x] **CORR-CAMPAIGN-01** Filter getReplyRateBySubjectPattern to same campaign ✅ *2026-03-10: Added optional campaignId param. Performance now matched per-email to same campaign (was [0] grab-bag). All 3 callers pass campaignId. Fixed re: pattern detection regex. 19 tests in subject-pattern.test.ts.*
  **Fichiers:** `src/server/lib/analytics/correlator.ts` (lines 373-411)
  **Réf:** audit v5
  **Impact:** Cross-campaign contamination feeds Thompson Sampling with noisy data. Pattern rankings may be wrong.
  **PASS IF:**
  - `getReplyRateBySubjectPattern` joins performance filtered by same campaignId as the DraftedEmail
  - `pnpm typecheck && pnpm test` passent

- [x] **SOURCE-TIMEOUT-01** Add polling timeout to source_leads enrichment wait ✅ *2026-03-10: 30 polls × 5s = 150s max. Returns graceful timeout with resourceId for retry. Progress counter in status updates.*

#### MEDIUM — Optimize

- [ ] **PERF-N1-01** Batch DB writes in score_leads_batch and enrich_leads_batch **(MEDIUM — 2h)**
  **Fichiers:** `src/server/lib/tools/enrichment-tools.ts`
  **Réf:** audit v5
  **Impact:** 100 leads = 200 sequential DB roundtrips. Prisma $transaction or bulk UPDATE would be 10-50x faster.
  **PASS IF:**
  - score_leads_batch uses batched update (e.g., $transaction with grouped updates)
  - enrich_leads_batch uses batched upsert
  - `pnpm typecheck && pnpm test` passent

- [ ] **STYLE-WIRE-01** Wire style category filter to getStyleSamples callers **(MEDIUM — 30 min)**
  **Fichiers:** `src/server/lib/tools/email-tools.ts`
  **Réf:** audit v5, RES-07
  **Impact:** detectCategory() works but callers ignore it. Subject corrections injected into body context.
  **PASS IF:**
  - `getStyleSamples()` callers in email-tools.ts pass relevant category filter
  - `pnpm typecheck && pnpm test` passent

- [x] **WEBHOOK-DEDUP-01** Add isDuplicateReply check to webhook reply_received handler ✅ *2026-03-11: Imported isDuplicateReply from pipeline-tools.ts. Reply record creation now gated by dedup check (same body prefix 100 chars + 5-min window). Prevents duplicate Reply records from webhook retry/race condition. 680/680 tests pass.*
  **Fichiers:** `src/app/api/webhooks/instantly/route.ts`
  **Réf:** audit v5, same pattern as classify_reply in pipeline-tools.ts
  **Impact:** Duplicate webhook delivery → duplicate Reply records. classify_reply has dedup, webhook does not.
  **PASS IF:**
  - Before creating Reply record in reply_received handler, check for duplicate (same body prefix + 5-min window)
  - Import isDuplicateReply from pipeline-tools or extract to shared util
  - `pnpm typecheck && pnpm test` passent
