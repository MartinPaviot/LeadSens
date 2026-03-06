# STRATEGY.md — LeadSens Product Strategy

> Derniere mise a jour : Mars 2026

---

## 1. Vision

**Le user decrit sa cible, choisit un volume, et recoit une campagne de 25 000 emails ultra-personnalises prete a activer.**

LeadSens est un **agent IA conversationnel** qui orchestre les outils de l'utilisateur pour automatiser tout le pipeline de cold emailing. L'utilisateur connecte ses propres outils, choisit son niveau d'autonomie, et LeadSens fait le reste.

---

## 2. Architecture BYOT (Bring Your Own Tools)

### 2.1 Principe

LeadSens n'est pas un outil. C'est le **chef d'orchestre** des outils du user. Chaque utilisateur connecte ses propres comptes. LeadSens orchestre, optimise, et apporte l'intelligence que ces outils ne fournissent pas seuls.

```
┌─────────────────────────────────────────────────────────────┐
│                    LEADSENS (Intelligence)                   │
│                                                             │
│  ICP Parsing · Scoring · Clustering · Copywriting Engine    │
│  Company DNA · Style Learner · Cost Optimizer               │
│  Orchestration + Curseur d'autonomie                        │
├─────────────────────────────────────────────────────────────┤
│                   OUTILS DU USER (BYOT)                     │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Sourcing │ │ Sending  │ │ Enrichmt │ │ Verif.   │      │
│  │ Instantly│ │ Instantly│ │ Apollo   │ │ZeroBounce│      │
│  │ Apollo   │ │ Smartlead│ │ Jina     │ │NvrBounce │      │
│  │          │ │ Lemlist  │ │          │ │          │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Onboarding = outils + autonomie + Company DNA

```
Partie 1 : Connecter ses outils

  Etape 1 : ESP (obligatoire) → Instantly / Smartlead / Lemlist
  Etape 2 : Enrichissement contact (optionnel) → Apollo
  Etape 3 : Verification email (optionnel) → ZeroBounce

Partie 2 : Intelligence

  Etape 4 : Company DNA → produit, value prop, case studies, ton
  Etape 5 : Curseur d'autonomie → Full auto / Supervise / Manuel
            (modifiable a tout moment)
```

---

## 3. Curseur d'autonomie

### 3.1 Le probleme du marche

Deux camps incompatibles :
- **Outils** (Instantly, Clay, Lemlist) → le user fait tout manuellement. Puissant mais lent.
- **Agents autonomes** (11x, AiSDR) → black box, zero controle, trust gap (75% des dirigeants n'ont pas vu de ROI).

**Personne ne laisse le user choisir.**

### 3.2 Les 3 modes

| Mode | Comportement | Pour qui |
|------|-------------|----------|
| **Full auto** | Cible + volume → tout tourne, le user revient avec des reponses | Founders presses, confiance etablie |
| **Supervise** | Tout tourne, arret aux etapes cles (preview emails, activation campagne) | Sales managers, controle qualite |
| **Manuel** | Proposition a chaque etape, le user decide | Nouveaux users, campagnes a fort enjeu |

### 3.3 Points de controle par mode

| Etape | Full auto | Supervise | Manuel |
|-------|-----------|-----------|--------|
| ICP parsing | Auto | Auto | Validation |
| Sourcing (volume) | Auto (preset) | Auto | "Combien ?" |
| Scoring | Auto | Auto | Auto |
| Enrichissement | Auto | Auto | Auto |
| Clustering | Auto | Auto | Preview segments |
| Redaction emails | Auto | **Preview par segment** | **Preview + edit** |
| Creation campagne | Auto | **Confirmation** | **Confirmation** |
| Activation envoi | **Auto** | **Confirmation** | **Confirmation** |

### 3.4 Positionnement

LeadSens est le seul produit qui couvre **tout l'axe controle ↔ autonomie**. Le user place son curseur ou il veut.

```
            Controle total (outils)
                    ↑
    Lemlist ────────┤
    Smartlead       │
    Instantly       │        ┌──────────────────┐
                    │        │    LeadSens       │
                    ├────────│  curseur reglable │
                    │        │ full auto ←→      │
               Clay │        │        manuel     │
                    │        └──────────────────┘
                    │             11x / AiSDR
                    ↓
            Full autonome (AI SDR)
```

---

## 4. Les 20% d'outils qui gerent 80% du marche

### 4.1 Selection 80/20

| Couche | Outil | Pourquoi | Cout |
|--------|-------|----------|------|
| **Sourcing** | **Instantly SuperSearch** | 450M+ contacts, standard cold email | Inclus ($47-97/mo) |
| **Sending** | **Instantly** | Warmup, rotation, #1 | $47-97/mo |
| **Sending (alt)** | **Smartlead** | #2, agences, API similaire | $78/mo |
| **Enrichissement contact** | **Apollo.io** | 275M contacts, free tier | Free → $49/mo |
| **Enrichissement contextuel** | **Jina Reader** | URL → markdown, gratuit | Gratuit |
| **Verification** | **ZeroBounce** | Leader, 99%+ precision | ~$0.008/email |

5 outils. C'est tout.

### 4.2 Pourquoi pas les autres

| Ecarte | Raison |
|--------|--------|
| Clay ($134-720/mo) | Notre intelligence remplace leur waterfall |
| BuiltWith ($295/mo) | Trop cher V1. DetectZeStack ($15/mo) plus tard |
| Clearbit | Rachete par HubSpot, Apollo fait pareil |
| ZoomInfo ($15K+/an) | Enterprise only |
| People Data Labs | Apollo a meilleure UX + free tier |

### 4.3 Configs types

| Profil | Outils | Cout hors LeadSens |
|--------|--------|-------------------|
| **Starter** | Instantly seul | ~$94/mo |
| **Pro** | Instantly + Apollo + ZeroBounce | ~$160/mo |
| **Agency** | Smartlead + Apollo + ZeroBounce | ~$143/mo |

---

## 5. La couche intelligence (notre vrai produit)

Les outils font de la plomberie. Notre valeur est dans les **decisions entre les appels API**.

### 5.1 Les 7 briques d'intelligence

| # | Brique | Ce que ca fait | Differenciateur |
|---|--------|---------------|-----------------|
| 1 | **ICP Scoring** | Score 1-10 sur donnees brutes AVANT d'enrichir. ~40% d'economie. | Personne ne le fait |
| 2 | **Company DNA** | Capture le produit/value prop du user, infuse tous les prompts | Les AI writers generiques ne connaissent pas le produit |
| 3 | **Frameworks copywriting** | PAS / Value-add / Breakup hardcodes par step | Pas de l'IA qui improvise |
| 4 | **Clustering** | Segments (industrie x taille x role), echantillon → variantes | 50-100 variantes vs 1 template |
| 5 | **Style Learner** | Corrections user → memoire → emails s'adaptent | S'ameliore avec l'usage |
| 6 | **Cost Optimizer** | Chemin le moins cher (scoring avant enrichissement, waterfall, cache) | L'user depense moins |
| 7 | **Curseur d'autonomie** | Full auto ↔ Manuel, reglable a tout moment | Personne ne propose ca |

### 5.2 Ce qui n'est PAS de l'intelligence

| Action | Valeur ajoutee |
|--------|---------------|
| Appeler l'API Instantly | Zero — wrapper |
| Appeler Jina | Zero — un fetch() |
| Pusher des leads | Zero — un POST |

---

## 6. Audit honnete — LeadSens aujourd'hui

### 6.1 Score global : 4.2/10

L'architecture est propre. Les briques sont la. Mais les emails que LeadSens produit aujourd'hui se lisent comme "un bon template automatise", pas comme "quelqu'un qui a passe 15 minutes a me rechercher".

### 6.2 Audit par composant

#### Enrichissement prospect — 2.5/10

| | LeadSens aujourd'hui | Top 0.1% SDR |
|---|---|---|
| Pages scrapees | 1 (homepage) | 5-10 (about, blog, careers, LinkedIn, Crunchbase, presse) |
| Contenu | 8K chars tronques (souvent nav + footer + cookie banner) | Intelligence commerciale ciblee |
| Personne | Zero (aucune donnee sur l'individu) | LinkedIn, posts, podcasts, opinions |
| Trigger events | Champ vide (la source ne peut pas le remplir) | Toujours un hook d'actualite |
| Intent signals | Zero | Funding, hiring, tech changes |
| Cache | Meme entreprise scrapee N fois pour N leads | — |

**Le probleme fondamental :** les homepages sont du marketing, pas de l'intelligence commerciale. Le champ `painPoints` dans le schema est rempli avec des generalites ("scaling operations") parce que la source de donnees ne contient pas cette info.

#### ICP Scoring — 5/10

**Ce qui marche :** Scoring ICP-relatif (pas de disqualifications hardcodees), poids raisonnables (jobTitle 40%, company 30%, industry 20%, location 10%), donnees manquantes = neutre.

**Problemes :**
- **Fit-only** — zero intent, zero timing. Un DRH parfait qui n'a aucun besoin actuel score pareil qu'un DRH en recrutement actif
- **Bug** : `industry: null` hardcode dans `instantly_source_leads` → 20% du poids du score repose sur "(inconnu)" a chaque fois
- Filtres avances (news, funding, tech) supprimes au broadening au lieu d'etre convertis en bonus scoring
- Pas de feedback loop : si 80% des leads sont elimines, le systeme ne suggere pas d'affiner l'ICP

#### Email Copywriting — 6/10

**Ce qui est bien (au-dessus de 95% des outils) :**
- Frameworks PAS/Value-add/Breakup enforced et hardcodes
- CompanyDna + CampaignAngle bien structures
- Kill list de phrases mortes ("I hope this finds you well")
- Adaptation par persona (C-Level = strategique, Tech = direct)
- Word count agressif (80/60/50 mots)

**Ce qui manque :**
- **Pas de "connection bridge"** — pain points du prospect ET capabilities du sender sont dumpes cote a cote, sans instruction explicite de connecter LE pain point le plus pertinent a LA solution specifique
- **Donnees jetees** — techStack, products, targetMarket, valueProposition extraits par le summarizer mais jamais injectes dans le prompt email
- **Pas de trigger en opener** — les top SDR ouvrent avec "J'ai vu que vous veniez de lever..." mais le prompt ne priorise pas les triggers
- **Follow-ups aveugles** — steps 1 et 2 ne connaissent que le subject des emails precedents, pas le body. Impossible de construire une narration coherente
- **Pas de quality gate** — si Mistral genere un email faible, il est sauvegarde tel quel

#### Subject Lines — 2/10

Regles actuelles : "2-4 mots, minuscule, pas de clickbait." C'est tout.

**Ce qui manque :**
- Zero librairie de patterns prouves (question, observation, curiosite, direct)
- Zero A/B testing (l'API Instantly supporte `variants[]` nativement — le code envoie toujours 1 variante)
- Zero tracking de performance par pattern
- Zero strategie differenciee par step

#### A/B Testing — 0/10

L'API Instantly accepte `variants[]` par step. Le code envoie toujours exactement 1 variante. Le plus gros levier d'amelioration est cable dans l'API mais non utilise.

#### Cadence & Sequence — 4/10

Actuellement : 3 steps, delays fixes [0, 3, 3] jours.

**Problemes :**
- 3 steps = trop peu. Top teams : 5-7 steps. Le breakup step 5-7 convertit a 5-8%. On laisse 20-30% des reponses sur la table
- Cadence symetrique 3-3 sous-optimale — les donnees montrent que 2-4-7 ou 1-3-5 performent mieux
- Zero logique conditionnelle (ouvert sans reponse → delay court, pas ouvert → delay long)

#### Feedback Loop — 1.5/10

Style learner : stocke 5 corrections raw comme exemples few-shot.

**Ce qui manque :**
- Zero integration avec les stats Instantly (`email_open_count`, `email_reply_count` existent dans l'API mais sont ignores)
- Pas de distillation des corrections en profil de style
- Pas de categorisation (correction de subject vs tone vs CTA)
- Pas de propagation des "winners" d'A/B tests
- CampaignAngle genere une fois et jamais mis a jour

#### Sourcing & Ciblage — 5.5/10

**Ce qui marche :** ICP parser robuste (~500 lignes de fix maps), auto-broadening intelligent, bilingual FR/EN.

**Ce qui manque :**
- ICP ephemere (pas de modele persistant, pas de raffinement incremental)
- Filtres avances supprimes au broadening au lieu de devenir des scoring signals
- Preview cosmique — affiche un tableau sans scorer ni alerter "ces leads semblent off-target"
- Pas de pagination — `listLeads` limite a 100
- `industry: null` hardcode → perte de donnees

### 6.3 Tableau recapitulatif

```
                          AUJOURD'HUI          TOP 0.1% SDR
                          ───────────          ────────────
Research depth            1 page, 8K chars     5-10 sources, 15-30 min
Trigger events            Champ vide           Toujours un hook actualite
Person-level intel        Zero                 LinkedIn, posts, podcasts
Email personalization     Job title + summary  Pain point → solution bridge
                          homepage generique   avec trigger en opener
Subject lines             1 variante, no data  2-3 variantes, A/B teste
Sequence length           3 steps              5-7 steps
Cadence                   Fixe 0-3-3           Variable selon engagement
A/B testing               Inexistant           Systematique
Feedback loop             5 corrections raw    Stats → optimisation → iteration
Style learning            Primitif             Profil de style distille
Quality gate              Aucun                Score + regeneration
```

---

## 7. Plan d'amelioration par impact sur le reply rate

Les ameliorations sont classees par **impact sur le taux de reponse**, pas par facilite d'implementation.

### Tier 1 — Impact majeur (objectif : 9% → 14%)

Ces changements touchent les variables qui determinent si l'email est ouvert ET lu.

#### 1.1 Multi-page scraping + cache entreprise

**Impact :** Passe le score enrichissement de 2.5 a 6/10.

**Aujourd'hui :** 1 page (homepage), 8K chars tronques.
**Cible :** 3-5 pages par entreprise (about, blog recents, careers, press), cache par domaine.

```
resolveLeadUrl()
  → scrape homepage
  → extraire liens internes (about, blog, careers, press/news)
  → scraper les 3-5 pages les plus pertinentes
  → concatener les markdowns
  → passer au summarizer avec PLUS de contexte
  → cacher par domaine (meme entreprise = 1 seul scrape)
```

**Donnees debloquees :** vrais pain points (blog), hiring signals (careers), actus recentes (press), positionnement reel (about).

#### 1.2 Connection bridge dans le prompt email

**Impact :** Passe le score copywriting de 6 a 7.5/10.

**Aujourd'hui :** Les pain points prospect et les capabilities sender sont poses cote a cote.
**Cible :** Instruction explicite de connecter LE pain point le plus pertinent a LA solution specifique du sender.

```
INSTRUCTION CRITIQUE :
Ne liste PAS les pain points du prospect.
Choisis LE SEUL pain point qui resonne le plus avec [solution du sender].
Construis tout l'email autour de ce pont :
  probleme_prospect → capacite_specifique_sender → preuve (case study)
```

#### 1.3 Trigger event en opener

**Impact :** Les triggers en opener sont le facteur #1 de reply rate en cold email.

**Aujourd'hui :** Le prompt ne priorise pas les triggers.
**Cible :** Si un trigger existe (funding, hiring, nouveau poste, lancement produit), il DOIT etre l'opener.

```
REGLE D'OPENER (par priorite) :
1. Trigger event recent (funding, hiring, lancement) → "J'ai vu que..."
2. Signal specifique du prospect (blog post, opinion LinkedIn) → reference directe
3. Pain point segment → observation sectorielle
JAMAIS : "Je me permets de...", "En tant que...", flaterie generique
```

#### 1.4 Injecter TOUTES les donnees enrichies dans le prompt email

**Impact :** Le summarizer extrait techStack, products, targetMarket, valueProposition — mais le prompt email ne les recoit jamais.

**Fix :** Passer le JSON enrichi complet au prompt-builder, pas juste `painPoints` et `recentNews`.

### Tier 2 — Impact significatif (objectif : 14% → 17%)

#### 2.1 Subject lines : librairie de patterns + A/B testing

**Impact :** Le subject determine l'open rate qui gate tout le reste.

**Cible :**
- Librairie de 5 patterns prouves : question, observation, curiosite, direct, personnalise
- Generer 2-3 variantes par step
- Utiliser `variants[]` natif Instantly
- Tracker la performance par pattern

```
Patterns prouves :
- Question : "{{firstName}}, question rapide"
- Observation : "vu votre [trigger]"
- Curiosite : "idee pour [pain_point]"
- Direct : "[solution] pour {{company}}"
- Personnalise : reference specifique au prospect
```

#### 2.2 Sequence 5-7 steps au lieu de 3

**Impact :** Le breakup step 5-7 convertit a 5-8%. On laisse 20-30% des reponses sur la table avec 3 steps.

**Cible :**

| Step | Framework | Delay | Mots |
|------|-----------|-------|------|
| 0 | PAS (Problem-Agitate-Solve) | J+0 | 80 |
| 1 | Value-add (insight/ressource) | J+2 | 60 |
| 2 | Social proof (case study) | J+5 | 60 |
| 3 | New angle (different pain point) | J+9 | 70 |
| 4 | Micro-value (stat, tip, question) | J+14 | 50 |
| 5 | Breakup (dernier message, zero pression) | J+21 | 40 |

#### 2.3 Follow-ups coherents (narration)

**Aujourd'hui :** Steps 1 et 2 ne connaissent que le subject des emails precedents.
**Cible :** Passer le body complet de chaque step precedent au prompt du step suivant pour construire une narration coherente. Chaque email reference naturellement les precedents.

#### 2.4 Cadence variable

**Aujourd'hui :** Fixe 0-3-3.
**Cible :** Delays variables optimises : 0-2-5-9-14-21 (acceleration au debut, espacement progressif).

### Tier 3 — Impact d'optimisation continue (objectif : 17% → 20%+)

#### 3.1 Quality gate sur les emails generes

Apres generation, un second appel LLM (Mistral Small) score l'email sur 5 criteres :
- Pertinence du pain point (0-10)
- Clarte de la value prop (0-10)
- Naturalite du ton (0-10)
- Respect du word count (0-10)
- Force du CTA (0-10)

Score < 6/10 → regeneration. Max 2 tentatives.

#### 3.2 Feedback loop avec stats Instantly

Recuperer `email_open_count`, `email_reply_count`, `email_click_count` par campagne/step via l'API.
- Open rate par subject line → identifier les patterns gagnants
- Reply rate par segment → identifier les angles qui marchent
- Auto-pause des variantes faibles
- Suggerer des ajustements au CampaignAngle

#### 3.3 Scoring multi-dimensionnel (fit + intent + timing)

**Aujourd'hui :** Fit-only (titre, entreprise, industrie, taille).
**Cible :**

| Dimension | Poids | Source |
|-----------|-------|--------|
| Fit (titre, industrie, taille) | 40% | Donnees brutes Instantly |
| Intent (hiring, tech changes, engagement) | 35% | Scraping careers, BuiltWith |
| Timing (funding, leadership change, news) | 25% | Crunchbase, press |

#### 3.4 Style learner avance

- Distiller les corrections en profil de style (pas juste 5 raw examples)
- Categoriser : correction de subject vs tone vs structure vs CTA
- Learning par persona (corrections sur C-Level ≠ corrections sur Tech)
- Propagation cross-campagne

#### 3.5 Scraping page careers (signal hiring)

**Gratuit via Jina.** Une entreprise qui recrute 3 SDR a un besoin d'outbound. Une entreprise qui recrute un CTO change de direction technique. Les job postings sont le signal d'intent le plus actionable et le moins utilise.

---

## 8. Analyse concurrentielle

### 8.1 Matrice intelligence

| | Instantly natif | Clay | 11x / AiSDR | **LeadSens (cible)** |
|---|---|---|---|---|
| **Scoring pre-enrichissement** | Non | Non | Opaque | **Oui (save 40%)** |
| **Adaptation au produit user** | Non | Non | Config basique | **Company DNA** |
| **Frameworks copywriting** | AI generique | Template + variables | Opaque | **PAS / Value-add / Breakup / Social proof / New angle / Micro-value** |
| **Clustering segments** | Non | Manuel | Inconnu | **Automatique** |
| **A/B testing** | Manuel | Non | Inconnu | **Automatique (variants[])** |
| **Feedback loop stats** | Non | Non | "Self-improving" | **Stats Instantly → optimisation** |
| **Autonomie reglable** | Non (outil) | Non (outil) | Non (full auto) | **Curseur 3 modes** |
| **Quality gate** | Non | Non | Inconnu | **Score + regeneration** |
| **Prix** | $141/mo min | $134-720/mo | $900-5,000/mo | **$49-149/mo** |

### 8.2 Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Instantly copie notre flow | Multi-ESP + avancer vite + qualite email superieure |
| Dependance API Instantly | Multi-ESP Phase 3 |
| Taux de reponse pas meilleur que mail merge | **Tier 1 ameliorations = prerequis avant launch** |
| AI SDR autonomes s'ameliorent | Notre curseur couvre aussi le full auto |

---

## 9. Benchmarks cibles

| Approche | Reply rate | Source |
|----------|-----------|--------|
| Non-personnalise | ~5-7% | Martal Group |
| Mail merge ({{firstName}}) | ~9% | Autobound |
| Template + icebreaker AI | ~12% | Salesforge |
| **Signal-based (notre cible)** | **~18%** | Autobound |
| Micro-cohortes <50 leads | 5.8% vs 2.1% pour 1000+ | The Digital Bloom |

**Notre trajectoire :**
- Aujourd'hui (4.2/10) : probablement ~8-10% (a peine mieux que du mail merge)
- Apres Tier 1 : ~14%
- Apres Tier 2 : ~17%
- Apres Tier 3 : ~20%+

---

## 10. Economie du pipeline

### 10.1 Cout LLM

| Etape | Cout/lead |
|-------|-----------|
| Scoring (Mistral Small) | $0.000084 |
| Summarization (Mistral Small) | $0.00021 |
| Drafting x3-6 (Mistral Large) | $0.003-0.007 |
| Quality gate (Mistral Small) | $0.0001 |
| **Total** | **~$0.004-0.008/lead** |

5 000 leads : **~$20-40 en LLM**. Negligeable.

### 10.2 Avantage scoring pre-enrichissement

```
Sans scoring : 5 000 x $0.05 (Apollo) + 5 000 x $0.008 (ZeroBounce) = $290
Avec scoring : 3 000 qualifies x $0.05 + 3 000 x $0.008                = $174
Economie : $116 par campagne.
```

### 10.3 Comparaison

| Solution | Cout pour 5 000 leads | Interface |
|----------|----------------------|-----------|
| **LeadSens Pro** | **~$200** | Chat + autonomie reglable |
| Clay + Instantly | ~$400-750 | Spreadsheet + campaign builder |
| AiSDR | $900/mo (1,000 emails max) | Config autonome |
| 11x.ai | ~$5,000/mo | Config autonome |

---

## 11. Multi-ESP (Phase 3)

### Pourquoi

Construire uniquement sur Instantly = risque plateforme. Si Instantly change son API/pricing ou ajoute nos features nativement, on est mort.

### Faisabilite

Les ESPs ont converge vers un modele API quasi identique :

| Concept | Instantly | Smartlead | Lemlist | Reply.io |
|---------|-----------|-----------|---------|----------|
| Campagnes CRUD | Oui | Oui | Oui | Oui |
| Steps/sequences | Oui | Oui | Oui | Oui |
| Leads + custom vars | Oui | Oui | Oui | Oui |
| Analytics | Oui | Oui | Oui | Oui |
| Webhooks | Oui | Oui | Oui | Oui |

**Effort : ~4-6 semaines pour 3 providers.**

Priorite : Smartlead (#2) → Lemlist (Europe) → Reply.io (Master API key).

Le sourcing (SuperSearch) reste specifique a Instantly. Separation claire : **couche sourcing** vs **couche envoi**.

---

## 12. Roadmap

### Phase 1 — Fix the basics (pre-launch)

Ameliorations Tier 1 = prerequis. Sans ca, on est un "bon template automatise".

- [ ] Multi-page scraping + cache par domaine (about, blog, careers, press)
- [ ] Connection bridge explicite dans le prompt email
- [ ] Trigger event en opener (priorite dans le prompt)
- [ ] Injecter TOUTES les donnees enrichies dans le prompt
- [ ] Fix bug industry: null dans instantly_source_leads
- [ ] Pagination listLeads (au-dela de 100)
- [ ] Pipeline complet end-to-end
- [ ] Onboarding BYOT + Company DNA + curseur autonomie

### Phase 2 — Competitive edge

Ameliorations Tier 2 = ce qui nous separe du mail merge.

- [ ] Subject lines : librairie patterns + 2-3 variantes + A/B via variants[]
- [ ] Sequence 5-7 steps (PAS → Value-add → Social proof → New angle → Micro-value → Breakup)
- [ ] Follow-ups coherents (body complet des steps precedents dans le prompt)
- [ ] Cadence variable (0-2-5-9-14-21)
- [ ] Clustering par segments (5K-25K leads)
- [ ] Connexion Apollo + ZeroBounce dans l'onboarding

### Phase 3 — Defensibility

- [ ] Quality gate (score + regeneration)
- [ ] Feedback loop stats Instantly (open/reply/click → optimisation)
- [ ] Interface ESPProvider + Smartlead + Lemlist
- [ ] Scoring multi-dimensionnel (fit + intent + timing)
- [ ] Style learner avance (profil distille, categorise, par persona)

### Phase 4 — Intelligence avancee

- [ ] Scraping careers page (signal hiring, gratuit via Jina)
- [ ] Signaux funding (Crunchbase, $49/mo)
- [ ] Enrichissement waterfall (gratuit → payant si gap)
- [ ] Dashboard resultats par segment
- [ ] A/B auto-pause variantes faibles

---

## 13. Decisions cles

### Build vs Buy

| Composant | Decision | Raison |
|-----------|----------|--------|
| Scoring, clustering, copywriting, Company DNA, style learner, cost optimizer, orchestration | **Build** | C'est le produit |
| Sourcing, sending, enrichissement contact, verification | **Buy** (outils du user) | Commodite |
| Enrichissement contextuel | **Build** (Jina + LLM) | Gratuit et superieur |
| Infra SMTP | **Ne pas faire** | Pas notre metier |

### Pricing

| Tier | Prix | Volume |
|------|------|--------|
| Starter | $49/mo | 1 000 leads scores, 500 emails |
| Pro | $99/mo | 5 000 leads, 3 000 emails |
| Scale | $149/mo | 25 000 leads, 15 000 emails |

Le user paie ses outils separement. LeadSens facture l'intelligence.

### LLM

| Tache | Modele | Upgrade path |
|-------|--------|-------------|
| Chat + ICP parsing | Mistral Large | — |
| Scoring + summarization + quality gate | Mistral Small | — |
| **Email drafting** | **Mistral Large** | **Claude Sonnet si reply rate insuffisant** |

---

## Sources

- [Instantly Features 2026](https://instantly.ai/blog/instantly-features/)
- [Instantly AI Copilot](https://instantly.ai/blog/ai-copilot/)
- [Instantly Pricing](https://instantly.ai/pricing)
- [Clay Review & Pricing](https://coldiq.com/tools/clay)
- [Smartlead vs Instantly](https://sparkle.io/blog/smartlead-vs-instantly/)
- [11x.ai Reviews](https://www.enginy.ai/blog/11x-reviews)
- [AiSDR Pricing](https://aisdr.com/pricing/)
- [Are AI SDRs Worth It?](https://www.usergems.com/blog/are-ai-sdrs-worth-it)
- [Autobound: Signal-Based Email Guide](https://www.autobound.ai/blog/cold-email-guide-2026)
- [Martal Group: Cold Email Stats](https://martal.ca/b2b-cold-email-statistics-lb/)
- [Sparkle.io: 5.3M Emails Study](https://sparkle.io/blog/cold-email-personalization/)
- [The Digital Bloom: Reply-Rate Benchmarks](https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/)
- [Smartlead API](https://api.smartlead.ai/reference/create-campaign)
- [Lemlist API](https://developer.lemlist.com/)
- [Reply.io API](https://apidocs.reply.io/)
- [LinkedIn vs Proxycurl 2025](https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/)
- [Salesforge: AI Personalization Trends](https://www.salesforge.ai/blog/ai-personalization-trends-in-cold-outreach-2025)
- [Hunter.io: State of Cold Email](https://hunter.io/the-state-of-cold-email)
