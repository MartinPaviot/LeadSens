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

**Pre-launch :**

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

**Post-launch :**

| Etape | Full auto | Supervise | Manuel |
|-------|-----------|-----------|--------|
| Reply classification | Auto | Auto | Review manuel |
| Reply drafting | Auto send | Preview avant envoi | Composition manuelle |
| CRM push (lead interesse) | Auto create contact + deal | Confirmation | Manuel |
| A/B variant disable (perf basse) | Auto | Confirmation | Manuel |
| Campaign pause (perf basse) | Auto | Confirmation | Manuel |
| Performance summary | Weekly auto-report | On-demand | On-demand |

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

## 4. Strategie d'integrations

### 4.1 Les 3 buyers et ce qui les bloque

Trois personas, leur stack typique, ce qui fonctionne, et ce qui bloque l'adoption :

**Solo Founder / Starter SDR**
- Stack : Instantly seul (~$94/mo)
- Ce qui marche : pipeline amont complet (ICP → Source → Score → Enrich → Draft → Push)
- **Bloquant :** pas d'import CSV (leads existants inutilisables), pas de visibilite post-launch (doit retourner dans Instantly pour les resultats)

**Sales Team startup**
- Stack : Instantly + Apollo + ZeroBounce + HubSpot (~$200-300/mo)
- Ce qui marche : enrichissement Apollo, verification ZeroBounce, dedup HubSpot
- **Bloquant :** HubSpot limite au dedup (pas de push leads qualifies), pas de handoff CRM, pipeline coupe en deux (pre-launch dans LeadSens, post-launch dans Instantly)

**Agency**
- Stack : Smartlead + Apollo + ZeroBounce (~$140-200/mo/client)
- Ce qui marche : abstractions multi-ESP pretes (`ESPProvider` + 3 implementations + `getESPProvider()`)
- **Bloquant :** les tools appellent Instantly directement malgre l'abstraction `ESPProvider`. Un user Smartlead obtient des outils casses

### 4.2 Matrice d'integrations par priorite

Trois tiers bases sur l'impact reel d'adoption, pas la difficulte technique.

**Tier A — Bloquant (pas de workaround)**

| Integration | Pourquoi c'est bloquant | Effort | Abstractions pretes |
|---|---|---|---|
| Import CSV / leads manuels | Users avec leads existants exclus du produit | 1-2 sem | Non (a creer) |
| Multi-ESP routing (tools → ESPProvider) | Users Smartlead/Lemlist = tools casses | 2-3 sem | Oui (`ESPProvider` + Instantly/Smartlead/Lemlist + `getESPProvider()`) |
| CRM push complet (HubSpot) | Leads qualifies ne remontent pas au CRM | 1 sem | Oui (`CRMProvider.createContact/updateContact` existent, pas de tool) |

**Tier B — Impact significatif (workaround = quitter LeadSens)**

| Integration | Pourquoi | Effort | Abstractions |
|---|---|---|---|
| Reply management (Instantly Unibox API) | Sans ca, user retourne dans Instantly pour les resultats | 2-3 sem | API prete (`GET /emails`, `POST /emails/reply`, threads, interest) |
| Webhooks Instantly | Events temps reel (reply, bounce, unsub) vs polling manuel | 1-2 sem | API prete (7 endpoints webhooks) |
| Salesforce CRM | Enterprise buyers, 23% du marche CRM | 2-3 sem | `CRMProvider` interface prete |
| Apollo sourcing | Alternative a Instantly SuperSearch | 2 sem | `SourcingProvider` interface prete + implementation Apollo |

**Tier C — Nice-to-have**

| Integration | Valeur | Effort |
|---|---|---|
| Pipedrive CRM | PME europeennes | 2 sem (`CRMProvider`) |
| NeverBounce | Alternative ZeroBounce | 1 sem (`EmailVerifier`) |
| Slack notifications | Alertes reply/bounce/performance | 1 sem |
| Google Sheets export | Reporting managers | 1 sem |
| Calendly / Cal.com | Lien meeting dans CTA email | 0.5 sem |
| Crunchbase | Signals funding | 1 sem |
| BuiltWith / DetectZeStack | Signals tech stack | 1 sem |

### 4.3 Configurations types

| Profil | Sourcing | Sending | CRM | Enrichment | Verification | Cout hors LeadSens |
|--------|----------|---------|-----|------------|-------------|-------------------|
| **Starter** | Instantly | Instantly | — | Jina (gratuit) | — | ~$94/mo |
| **Starter+** | Instantly + CSV import | Instantly | — | Jina | — | ~$94/mo |
| **Pro** | Instantly | Instantly | HubSpot | Apollo + Jina | ZeroBounce | ~$200/mo |
| **Sales Team** | Instantly + CSV | Instantly | HubSpot + Salesforce | Apollo + Jina | ZeroBounce | ~$250-350/mo |
| **Agency** | Instantly + CSV | Smartlead | — | Apollo + Jina | ZeroBounce | ~$180/mo/client |

**Point cle :** CSV import apparait dans 4 profils sur 5. C'est le feature le plus universellement necessaire qui n'existe pas.

### 4.4 Ce qu'on ne fait PAS et pourquoi

| Ecarte | Raison |
|--------|--------|
| LinkedIn automation | Risque legal post-Proxycurl 2025. Apify = scraping passif, pas d'automation |
| Gmail / SMTP direct | Les ESPs gerent l'infra d'envoi (warmup, rotation, deliverability) |
| WhatsApp / SMS | Compliance differente, hors scope |
| Zapier / n8n natif | Webhooks Instantly suffisent pour les integrateurs |
| Fine-tuning LLM | Few-shot + prompt engineering suffisent en V1 |
| Clay ($134-720/mo) | Notre intelligence remplace leur waterfall |
| ZoomInfo ($15K+/an) | Enterprise only |

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
| Dependance API Instantly | Multi-ESP Phase 2 (abstractions pretes, §4.2 Tier A) |
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

## 11. Pipeline complet : ICP → Meeting Booked

### 11.1 Ou le pipeline meurt aujourd'hui

Diagnostic factuel :

- `LeadStatus` enum : SOURCED → SCORED → ENRICHED → DRAFTED → PUSHED → **dead end**
- `PUSHED` n'a aucune transition sortante dans `lead-status.ts`
- `EmailPerformance` et `StepAnalytics` existent dans le schema Prisma (champs complets : openCount, replyCount, clickCount, bounced, interestStatus, syncedAt) mais **aucun code ne les peuple**
- `instantly_get_replies` retourne du JSON brut sans sync DB ni update de statut
- Le curseur d'autonomie (§3) s'arretait a "Activation envoi" (etendu en §3.3 post-launch)

L'utilisateur doit quitter LeadSens apres le lancement de campagne et retourner dans Instantly pour voir les resultats. Le pipeline est coupe en deux.

### 11.2 Le cycle de vie etendu du lead

Extension du state machine :

```
PRE-LAUNCH (existant) :
  SOURCED → SCORED → ENRICHED → DRAFTED → PUSHED

POST-LAUNCH (nouveau) :
  PUSHED → SENT → REPLIED → INTERESTED → MEETING_BOOKED
                           → NOT_INTERESTED
                  → BOUNCED
                  → UNSUBSCRIBED
```

Choix de design :
- **OPENED n'est PAS un statut lead** — trop peu fiable (Apple Mail Privacy Protection, image blocking ~40%). Tracke dans `EmailPerformance.openCount` mais pas promu en etat lifecycle.
- Chaque transition post-launch **declenche une action agent** (pas juste un update DB).

| Statut | Source de donnees | Action agent | Action CRM |
|--------|-------------------|-------------|------------|
| SENT | Webhook `campaign_started` ou sync analytiques | Update EmailPerformance | — |
| REPLIED | Webhook `reply_received` ou polling Unibox | Classify interest (Mistral Small) | — |
| INTERESTED | Classification LLM (ai_interest ≥ 7) | Draft reply, notify user | Create/update contact |
| NOT_INTERESTED | Classification LLM (ai_interest < 3) | Remove from sequence | Tag "not interested" |
| MEETING_BOOKED | Detection dans reply ("let's schedule", lien Calendly) | Notify user, remove from sequence | Create deal |
| BOUNCED | Webhook `email_bounced` | Mark lead, alert si taux > 5% | — |
| UNSUBSCRIBED | Webhook `lead_unsubscribed` | Remove from all sequences | Tag "unsubscribed" |

### 11.3 L'experience utilisateur phase par phase

7 phases decrites du point de vue user (dialogue agent-user) :

**1. Discovery** (existant) — "Qui cibler ?"
ICP en langage naturel → parsing → confirmation filtres → comptage.

**2. Preparation** (existant) — "Rediger les emails"
Sourcing → scoring → enrichissement → drafting → preview.

**3. Launch** (existant) — "Envoyer"
Creation campagne Instantly → ajout leads → activation.

**4. Monitoring** (NOUVEAU) — "Comment ca se passe ?"
- Sync automatique des analytics (EmailPerformance + StepAnalytics)
- Agent proactif : "Ta campagne tourne depuis 3 jours. Open rate 42%, 2 reponses. Le step 0 subject A performe 2x mieux que B."
- A/B variant management : suggestion d'auto-pause des variantes faibles
- Alerte si bounce rate > 5% ou reply rate < 2% apres 7 jours

**5. Reply Management** (NOUVEAU) — "Quelqu'un a repondu"
- Webhook ou polling → nouvelle reponse detectee
- Classification LLM (Mistral Small) : interesse / pas interesse / question / auto-reply / OOO
- Si interesse : "Martin de Acme a repondu positivement. Voici un draft de reponse." → preview → envoi via Unibox API
- Si pas interesse : "Reponse negative de Lisa chez TechCorp. Je la retire de la sequence."

**6. Handoff** (NOUVEAU) — "Ce lead est qualifie"
- Lead classifie INTERESTED → push CRM automatique ou sur confirmation
- Creation contact HubSpot/Salesforce avec toutes les donnees enrichies (Company DNA, pain points, historique emails)
- Creation deal dans le pipeline CRM
- Retrait de la sequence d'envoi

**7. Learning Loop** (NOUVEAU) — "Qu'est-ce qui a marche ?"
- Analytics croisees par segment, industrie, taille, role
- Identification des patterns gagnants : "Les CTOs repondent 3x plus au step 2 (Social Proof) qu'au step 0 (PAS)"
- Suggestions d'ajustement ICP : "85% des reponses viennent de startups 50-200 employes. Affiner le ciblage ?"
- Propagation des learnings aux prochaines campagnes

### 11.4 Infrastructure technique necessaire

**Nouveaux outils agent :**

| Tool | Phase | Description |
|---|---|---|
| `sync_campaign_performance` | ACTIVE | Appelle analytics Instantly → ecrit dans EmailPerformance + StepAnalytics |
| `classify_reply` | ACTIVE | LLM (Mistral Small) classifie l'interet d'une reponse, update lead status |
| `reply_to_email` | ACTIVE | Envoie une reponse via `POST /emails/reply` Instantly |
| `draft_reply` | ACTIVE | Genere une reponse contextuelle (enrichment + historique conversation) |
| `crm_create_contact` | ACTIVE | Cree un contact CRM avec toutes les donnees d'enrichissement |
| `crm_create_deal` | ACTIVE | Cree un deal dans le pipeline CRM |
| `import_leads_csv` | ANY | Parse CSV, valide, dedup, cree les leads |
| `campaign_insights` | ACTIVE | Agrege les donnees de performance, identifie les patterns gagnants |

**Webhook endpoint :** `POST /api/webhooks/instantly`
- Events : `reply_received`, `email_bounced`, `lead_unsubscribed`, `campaign_completed`
- Auto-registration via `setup_webhooks` au premier lancement de campagne

**Nouveau modele Prisma :** `ReplyThread` + `Reply` (conversation threads par lead)

**Nouveau prompt tier :** PHASE_MONITORING — instructions agent pour la phase post-launch (proactivite, tone, actions permises)

### 11.5 Dependance avec les integrations (§4)

Le pipeline complet ne fonctionne qu'avec les integrations Tier A et B :

| Fonctionnalite pipeline | Integration requise | Tier |
|---|---|---|
| Monitoring (analytics sync) | Instantly API analytics | Existant |
| Reply management | Instantly Unibox API | Tier B |
| Webhooks temps reel | Instantly Webhooks | Tier B |
| CRM handoff | HubSpot/Salesforce CRM push | Tier A (HubSpot) / B (Salesforce) |
| Import leads existants | CSV import | Tier A |
| Multi-ESP monitoring | ESPProvider routing | Tier A |

---

## 12. Roadmap

Restructuree autour de deux axes : **completude du pipeline** (ICP → Meeting Booked) et **couverture marche** (personas bloques).

### Phase 1 — Pipeline complet (pre-launch + post-launch)

L'objectif : un lead entre dans LeadSens et n'en sort plus jusqu'au meeting booke. Pas de "retourne dans Instantly pour voir les resultats".

**Pre-launch (qualite email) :**
- [ ] Multi-page scraping + cache par domaine (about, blog, careers, press)
- [ ] Connection bridge explicite dans le prompt email
- [ ] Trigger event en opener (priorite dans le prompt)
- [ ] Injecter TOUTES les donnees enrichies dans le prompt
- [ ] Fix bug industry: null dans instantly_source_leads
- [ ] Pagination listLeads (au-dela de 100)

**Post-launch (pipeline etendu) :**
- [ ] Extension LeadStatus enum : SENT, REPLIED, INTERESTED, NOT_INTERESTED, MEETING_BOOKED, BOUNCED, UNSUBSCRIBED
- [ ] Extension state machine dans `lead-status.ts` (transitions post-PUSHED)
- [ ] Import CSV / leads manuels (`import_leads_csv` tool)
- [ ] `sync_campaign_performance` : peupler EmailPerformance + StepAnalytics
- [ ] `classify_reply` + `draft_reply` + `reply_to_email` (reply management via Unibox API)
- [ ] Webhook Instantly (`POST /api/webhooks/instantly` — reply, bounce, unsub)
- [ ] PHASE_MONITORING prompt tier (instructions agent post-launch)
- [ ] Modeles Prisma `ReplyThread` + `Reply`

### Phase 2 — Couverture marche

Debloquer les 3 personas identifies en §4.1 et ajouter les leviers competitifs email.

**Integrations (Tier A + B) :**
- [ ] Multi-ESP routing : tools → `ESPProvider` (Smartlead, Lemlist fonctionnels)
- [ ] CRM push complet : `crm_create_contact`, `crm_create_deal` tools (HubSpot)
- [ ] Salesforce `CRMProvider` implementation
- [ ] Apollo sourcing via `SourcingProvider` (alternative a Instantly SuperSearch)

**Email competitif :**
- [ ] Subject lines : librairie patterns + 2-3 variantes + A/B via `variants[]`
- [ ] Sequence 5-7 steps (PAS → Value-add → Social proof → New angle → Micro-value → Breakup)
- [ ] Follow-ups coherents (body complet des steps precedents dans le prompt)
- [ ] Cadence variable (0-2-5-9-14-21)

### Phase 3 — Intelligence & Optimisation

Boucle fermee : les resultats des campagnes ameliorent les prochaines.

- [ ] `campaign_insights` tool : analytics croisees, patterns gagnants, suggestions ICP
- [ ] A/B auto-pause des variantes faibles
- [ ] Reply rate par segment → ajustement CampaignAngle
- [ ] Quality gate enforcement (score + regeneration systematique)
- [ ] Style learner avance (profil distille, categorise, par persona)
- [ ] Scoring multi-dimensionnel (fit + intent + timing)
- [ ] Deliverability monitoring (warmup analytics, account health)

### Phase 4 — Plateforme & Scale

- [ ] Slack / notifications (alertes reply, bounce, performance)
- [ ] Pipedrive CRM (`CRMProvider`)
- [ ] Google Sheets export
- [ ] Meeting booking (Calendly/Cal.com URL dans CTA)
- [ ] Scraping careers page (signal hiring, gratuit via Jina)
- [ ] Crunchbase funding signals
- [ ] Clustering par segments (5K-25K leads)
- [ ] Agency features (multi-workspace, reporting cross-clients)

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
