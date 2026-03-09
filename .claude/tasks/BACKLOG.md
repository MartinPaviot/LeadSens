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
- [ ] **T1-FIX-02** Pagination listLeads ⚠️ *Non vérifié dans cet audit — à vérifier*

---

## Tier 2 — Impact significatif (objectif : 14% → 17%)

### Subject Lines (STRATEGY §7.2.1 — ~~actuel 2/10~~ **actuel 5/10**, cible 6/10) ⚠️ ÉCART -1

- [ ] **T2-SUBJ-01** Librairie de 5 patterns subject line ⚠️ *Audit 2026-03-09: PAS de librairie formelle. Enforcement implicite via banned phrases + quality gate, mais pas d'enum explicite (question, observation, curiosité, direct, personnalisé)*
  **Fichiers:** `src/server/lib/email/prompt-builder.ts`
  **Réf:** STRATEGY §7.2.1
  **PASS IF:**
  - 5 patterns hardcodés dans le prompt : question, observation, curiosité, direct, personnalisé
  - Chaque pattern a 2-3 exemples
  - Snapshot test du prompt
  - `pnpm typecheck && pnpm test` passent

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
- [ ] **T3-INTEL-03** ICP refinement suggestions — RESTE À FAIRE (pas d'alerte si >80% leads éliminés)

---

## Dette technique (alimenté par /audit)

- [ ] **DEBT-01** Éliminer tous les `any` TypeScript
- [ ] **DEBT-02** Zod validation sur toutes les routes API
- [ ] **DEBT-03** Hiérarchie d'erreurs typées
- [ ] **DEBT-04** AI Event logging sur tous les appels LLM
- [ ] **DEBT-05** Encryption des tokens en DB
- [ ] **DEBT-06** Tests unitaires pour tous les tools
- [ ] **DEBT-07** Snapshot tests pour les prompts LLM

<!-- NOUVELLES TÂCHES AJOUTÉES PAR /audit 2026-03-09 -->

### Tâches ajoutées par audit 2026-03-09

- [ ] **AUDIT-01** Cache Prisma persistant CompanyCache (TTL 7j) — upgrade du Map in-memory actuel
  **Priorité:** MEDIUM (T1-ENR-02 non complet)
  **Impact:** ~20% scrapes redondants entre batches

- [ ] **AUDIT-02** Subject line pattern library formelle — 5 patterns (question, observation, curiosité, direct, personnalisé) avec exemples
  **Priorité:** MEDIUM (T2-SUBJ-01)
  **Impact:** +1 point subject lines score

- [ ] **AUDIT-03** ICP scoring feedback loop — alerte si >80% leads score <5, suggestion d'affiner l'ICP
  **Priorité:** HIGH
  **Impact:** Évite les campagnes silencieusement vides

- [ ] **AUDIT-04** A/B winner propagation — corrélation variante → reply rate, auto-promote best variant
  **Priorité:** MEDIUM
  **Impact:** Subject line optimization automatique

- [ ] **AUDIT-05** Zod validation sur 8 routes API manquantes (intégrations + export + email edit)
  **Priorité:** MEDIUM (DEBT-02)

- [ ] **AUDIT-06** Éliminer 10 `as any` restants
  **Priorité:** LOW (DEBT-01)

- [ ] **AUDIT-07** AI Event logging sur 4 modules manquants (campaign-angle, quality-gate, icp-scorer, summarizer)
  **Priorité:** MEDIUM (DEBT-04)

- [ ] **AUDIT-08** Remplacer 48 console.log par logger structuré
  **Priorité:** LOW (DEBT-03)
