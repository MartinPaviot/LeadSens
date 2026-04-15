# Agent Mapping — Social Media Interaction Manager (SMI-20)

> Community Manager autonome — DM, commentaires, qualification leads, protection réputation, escalade intelligente.

---

## 1. Identité de l'agent

| Champ | Valeur |
|-------|--------|
| **Nom** | Social Media Interaction Manager |
| **Code interne** | `AGT-MKT-SMI-20` |
| **Version** | 1.0 — Périmètre V1 |
| **Positionnement** | Community Manager autonome |
| **Catégorie** | Agent Marketing — Engagement & Réputation |
| **Canaux** | Meta (IG+FB), LinkedIn, X, TikTok, Reddit |
| **Canal d'accès** | Monitoring continu + Interface chat pour supervision |
| **Relation** | Complémentaire Agent 19 — Agent 19 publie, Agent 20 gère les interactions |
| **Statut** | Actif — Production V1 |

---

## 2. Problème résolu

**🔴 Sans l'agent :** Les messages restent sans réponse. Les commentaires négatifs ne sont pas traités. Les leads chauds se perdent. Le ton varie selon la personne qui répond. Les équipes perdent du temps sur des questions répétitives. La marque est exposée sans protection.

**✅ Avec l'agent :** Cet agent surveille, classe, répond et escalade intelligemment toutes les interactions entrantes. Il protège la réputation, qualifie les leads et maintient un ton de marque cohérent — 24h/24, 7j/7, sur 5 plateformes simultanément.

### Relation avec l'Agent 19

| Agent 19 — Campaign Manager | Agent 20 — Interaction Manager |
|---|---|
| Planifie et publie les posts organiques | Reçoit et répond à tous les messages entrants |
| Lance et gère les campagnes paid | Gère les commentaires sous les posts publiés |
| Gère le calendrier éditorial | Qualifie les leads générés par les campagnes |
| Produit les contenus et créatifs | Protège la réputation de la marque |

---

## 3. Modules fonctionnels

### Module 1 — Surveillance & réception

Monitoring continu de toutes les interactions entrantes sur 5 plateformes.

- Connexion via webhooks — pas de polling constant, déclenchement à la réception
- Réception DM : Instagram, Facebook, LinkedIn, X, TikTok
- Réception commentaires : sous tous les posts publiés par les comptes connectés
- Reddit : monitoring des mentions et des threads pertinents
- Orchestration via Composio — authentification multi-plateformes centralisée

### Module 2 — Classification IA intelligente

Catégorisation automatique de chaque message avec modèle à deux couches.

- **Couche 1 (modèle léger)** : tri initial rapide — spam évident, questions simples, messages courts, FAQ en cache. < 50ms, coût API minimal.
- **Couche 2 (modèle avancé)** : analyse sentiment détaillée, détection intention d'achat, génération réponse personnalisée, cas ambigus, scoring lead avancé. Déclenché seulement si nécessaire.

**8 catégories de classification :**

| Catégorie | Exemples | Action | Priorité |
|---|---|---|---|
| Lead commercial | Demande tarif, intérêt produit | Réponse + qualification + sync CRM | P1 |
| Commentaire négatif | Plainte publique, déception | Réponse apaisante + escalade si score > seuil | P1 |
| Toxique / Troll | Insultes, harcèlement, spam répétitif | Masquage/suppression (config.) + signalement | P1 |
| Support client | Problème commande, bug, aide technique | Ticket helpdesk + confirmation client | P3 |
| Question produit | Taille, délai, disponibilité | Réponse depuis FAQ cache — instantanée | P3 |
| Partenariat | Collaboration, sponsoring, affiliation | Réponse + escalade équipe commerciale | P3 |
| Influenceur détecté | Audience > seuil, vérifié ou fort engagement | Escalade systématique équipe humaine | P2 |
| Commentaire positif | Félicitations, UGC, retour enthousiaste | Réponse chaleureuse + amplification | P3 |
| Neutre / Général | Mention simple, tag sans intention | Réponse courte ou monitoring seulement | P3 |
| Spam évident | Lien suspect, bot, contenu non sollicité | Suppression/masquage automatique | P3 |

> P1 = Traitement immédiat. P2 = Traitement sous 30 min. P3 = Traitement dans l'heure ou via batch. Seuils configurables par le client.

### Module 3 — Réponse automatique intelligente

Génération et envoi de réponses contextualisées selon la catégorie.

- Questions fréquentes → réponse instantanée depuis la FAQ cache
- Lead détecté → réponse + qualification (budget, besoin, délai) + sync CRM
- Support client → création ticket Zendesk/Freshdesk + confirmation au client
- Commentaire négatif → réponse apaisante personnalisée + escalade si nécessaire
- Spam / toxique → masquage ou suppression (configurable par le client)
- Commentaire positif → réponse chaleureuse pour amplifier l'engagement
- Ton de marque unique et cohérent sur toutes les plateformes

### Module 4 — Escalade intelligente

Détection et transmission aux humains des cas sensibles ou à fort enjeu.

**3 niveaux d'escalade :**

| Niveau | Trigger | Action |
|---|---|---|
| 🔴 CRITIQUE | Sentiment très négatif / connotation juridique / crise réputationnelle naissante | Notification push immédiate |
| 🟡 ATTENTION | Influenceur détecté / partenariat / négatif modéré / réclamation sensible | Inclus dans prochain rapport d'escalade |
| 🟢 OPPORTUNITÉ | Lead chaud / décideur identifié / demande démo explicite | Sync CRM immédiate + notification commerciale |

Canal d'escalade configurable : email, Slack, SMS, notification push.

### Module 5 — Qualification leads & synchronisation CRM

Transformation des interactions en opportunités commerciales qualifiées.

- Détection automatique d'intention d'achat dans les messages
- Qualification conversationnelle : budget, besoin, délai, décideur
- Scoring lead basé sur le profil, le contenu et le comportement
- Synchronisation automatique avec HubSpot, Salesforce ou Pipedrive (BYOT)
- Création de fiche contact + historique du message d'origine
- Notification commerciale si lead chaud détecté (configurable)

---

## 4. Niveau d'automatisation (choix du client)

| Mode | Description |
|---|---|
| **Automatisation 100%** | L'agent répond sans validation humaine sauf escalades critiques |
| **Validation obligée** | Toutes les réponses soumises avant envoi (mode audit) |
| **Hors horaires uniquement** | Réponses auto uniquement si équipe hors ligne (plages horaires définies) |

Autres paramètres configurables : suppression automatique spam (oui/non), ton de marque unique, seuils d'escalade.

---

## 5. Intégrations & Stack technique

### APIs Social Media

| Plateforme | Usage | Priorité V1 |
|---|---|---|
| Meta for Developers | IG + FB DM + Comments | Core V1 |
| LinkedIn API | DM + Comments | Core V1 |
| X API v2 | DM + Replies + Mentions | Core V1 |
| TikTok Developers | Comments + DM | Core V1 |
| Reddit API | Mentions + Threads | Core V1 |

### CRM (BYOT — le client connecte le sien)

| Outil | Usage | Priorité V1 |
|---|---|---|
| HubSpot | Sync leads + contacts | Core V1 |
| Salesforce | Sync leads + pipeline | Core V1 |
| Pipedrive | Sync leads + deals | Core V1 |

### Helpdesk (BYOT)

| Outil | Usage | Priorité V1 |
|---|---|---|
| Zendesk | Création tickets support | Core V1 |
| Freshdesk | Création tickets support | Core V1 |

### Orchestration

Composio = couche d'orchestration centrale. Gère l'authentification multi-plateformes, les webhooks entrants, les tokens et les actions sortantes.

---

## 6. Inputs & Outputs

### 6.1 — Paramétrage initial (onboarding)

| Donnée | Description |
|---|---|
| Plateformes actives | Sélection parmi Meta, LinkedIn, X, TikTok, Reddit |
| Ton de marque | Description + exemples de réponses idéales pour calibration |
| FAQ & réponses type | Base de réponses aux questions fréquentes — alimente le cache |
| Niveau d'automatisation | 100% auto / Validation / Hors horaires uniquement |
| Autorisation suppression | Spam et toxiques : masquage ou suppression active (oui/non) |
| Seuil escalade | Score sentiment, audience influenceur, score lead minimum |
| CRM actif | HubSpot / Salesforce / Pipedrive |
| Helpdesk actif | Zendesk / Freshdesk |
| Canal escalade | Email, Slack, SMS, notification push |

### 6.2 — Outputs produits

| Livrable | Contenu | Trigger |
|---|---|---|
| Réponses automatisées | Texte généré contextualisé selon catégorie + ton marque | Temps réel |
| Tickets support | Fiche ticket helpdesk créée automatiquement | Dès classification Support |
| Leads qualifiés | Fiche contact CRM + score + historique + tag source | Dès détection lead |
| Alertes escalade | Notification équipe avec contexte | Dès détection |
| Rapport hebdo | Volume, taux réponse, sentiment, leads, escalades | Hebdomadaire auto |
| Analyse sentiment | Score global + tendance + détection crises naissantes | Hebdomadaire |
| Dashboard supervision | KPIs à la demande via chat | À la demande |

---

## 7. Parcours client

### PHASE 1 — Onboarding & configuration (J1 — ~45 min)

1. Le client connecte ses comptes via OAuth : Meta, LinkedIn, X, TikTok, Reddit
2. Il partage sa charte de ton : style, formules à utiliser ou éviter, exemples
3. Il alimente la FAQ avec les 10 à 20 questions les plus fréquentes
4. Il configure ses préférences : niveau d'auto, suppression spam, seuils d'escalade
5. L'agent génère 5 réponses types pour validation avant déploiement

**Livrable :** Comptes connectés + Ton validé + FAQ chargée + Paramètres configurés + Agent actif

### PHASE 2 — Fonctionnement quotidien (invisible pour le client)

- L'agent surveille les 5 plateformes via webhooks
- Chaque message est classifié et traité automatiquement
- Les leads sont envoyés au CRM, les tickets au helpdesk
- Les spams sont masqués/supprimés selon paramètres
- Le client peut superviser à tout moment dans le chat

**Livrable :** Réponses automatiques en continu + Leads CRM + Tickets helpdesk + Dashboard à la demande

### PHASE 3 — Gestion d'une escalade critique

1. Le client reçoit une alerte push avec contexte complet
2. L'alerte inclut : plateforme, message original, score sentiment, action déjà prise
3. Le client peut répondre directement ou demander à l'agent de gérer différemment
4. Si crise réputationnelle : l'agent propose un brouillon de réponse officielle

**Livrable :** Alerte détaillée + Réponse apaisante déjà postée + Brouillon officiel + Action exécutée

### PHASE 4 — Rapport hebdomadaire

- Volume total messages par plateforme + comparaison semaine précédente
- Taux de réponse auto, temps moyen de réponse, taux d'escalade
- Leads générés + tickets support ouverts
- Analyse sentiment globale + tendances + alertes potentielles
- Recommandations : ajustement ton, nouvelles FAQ, seuils à modifier

**Livrable :** Rapport complet + Analyse sentiment + Tendances + Recommandations

---

## 8. Optimisation des coûts API

| Stratégie | Description |
|---|---|
| Webhooks vs polling | Déclenchement à la réception — zéro appel inutile |
| Architecture 2 couches | Modèle léger pour 80% des cas, avancé seulement si nécessaire |
| Cache réponses FAQ | Réponses pré-générées — zéro appel IA |
| Classification batch | En volume élevé, traitement groupé |
| Pas d'analyse lourde | Messages courts évidents (spam, emoji, 1 mot) — pas de LLM |
| Cache audiences | Profils influenceurs et contacts CRM en cache local |
| Pas d'appel CRM inutile | Sync CRM uniquement si lead qualifié |

---

## 9. Roadmap

### V1 — en production

- Surveillance 5 plateformes via webhooks
- Classification IA 8 catégories (modèle 2 couches)
- Réponses automatisées (ton unique, FAQ cache, génération contextualisée)
- Qualification leads + CRM (HubSpot, Salesforce, Pipedrive)
- Tickets helpdesk (Zendesk, Freshdesk)
- Escalade intelligente (3 niveaux)
- Niveaux d'automatisation (full auto / validation / hors horaires)
- Rapport hebdo + analyse sentiment
- Suppression spam configurable

### Hors V1

| Module | Version |
|---|---|
| Ton adapté par plateforme | V2 |
| Analyse sentiment évolutive (prédiction crise) | V2 |
| Retargeting déclenché par interaction | V2 |
| Suivi statut ticket dans la réponse | V2 |
| Scoring lead ML avancé | V2 |
| Boucle feedback → stratégie contenu Agent 19 | V2 |

---

## 10. Structure code recommandée

```
src/agents/social-interaction-manager/
├── core/
│   ├── types.ts              ← IncomingMessage, Classification, EscalationLevel, LeadScore
│   ├── constants.ts          ← CATEGORIES, SENTIMENT_THRESHOLDS, PLATFORM_CONFIGS
│   └── prompts.ts            ← System prompts (classification, réponse, qualification, escalade)
├── modules/
│   ├── receiver.ts           ← Webhooks reception + normalisation messages
│   ├── classifier.ts         ← Classification 2 couches (léger + avancé)
│   ├── responder.ts          ← Génération réponse + envoi via API
│   ├── escalator.ts          ← Détection escalade + notification
│   ├── lead-qualifier.ts     ← Scoring + qualification conversationnelle
│   ├── crm-sync.ts           ← Sync HubSpot / Salesforce / Pipedrive (BYOT)
│   ├── helpdesk-sync.ts      ← Création tickets Zendesk / Freshdesk (BYOT)
│   ├── faq-cache.ts          ← Cache FAQ pré-générées
│   └── reporter.ts           ← Rapport hebdo + analyse sentiment
├── utils/
│   ├── sentiment-analyzer.ts ← Score sentiment (positif/neutre/négatif/urgent)
│   ├── influencer-detector.ts← Détection comptes haute audience
│   └── spam-filter.ts        ← Filtrage spam/toxique basique (avant LLM)
└── index.ts                  ← Orchestrateur : receive → classify → route → respond/escalate
```

### Routes API

```
src/app/api/agents/social-interaction-manager/
├── chat/route.ts             ← POST (SSE) — Supervision conversationnelle
├── webhook/route.ts          ← POST — Réception webhooks Composio
├── configure/route.ts        ← POST — Configuration onboarding
├── faq/route.ts              ← GET/POST/DELETE — CRUD FAQ
├── escalations/route.ts      ← GET — Liste des escalades
├── report/route.ts           ← GET — Rapport hebdo
└── dashboard/route.ts        ← GET — Données dashboard temps réel
```
