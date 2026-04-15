# Spec — Social Media Interaction Manager (SMI-20)

> Community Manager autonome — DM, commentaires, qualification leads, protection réputation, escalade.
> Référence mapping : `agent_mapping_SMI-20.md`

---

## 1. Requirements

### REQ-SMI-001: Onboarding & configuration

**User Story :** En tant que responsable marketing, je veux configurer mes plateformes, mon ton de marque et mes règles de réponse en une session pour que l'agent commence à gérer mes interactions immédiatement.

**Critères d'acceptation :**
- Le client connecte ses comptes sociaux via OAuth (Composio) : Meta, LinkedIn, X, TikTok, Reddit
- Le client définit son ton de marque avec exemples de réponses idéales
- Le client peut saisir 10-20 FAQ avec réponses types qui alimentent le cache
- Le client choisit son niveau d'automatisation : 100% auto / validation / hors horaires
- Le client configure les seuils d'escalade : score sentiment, audience influenceur, score lead
- Le client connecte son CRM (BYOT : HubSpot, Salesforce ou Pipedrive) et son helpdesk (Zendesk ou Freshdesk)
- Le client choisit son canal d'escalade : email, Slack, SMS
- L'agent génère 5 réponses types pour validation avant activation
- Toute la configuration est persistée et modifiable via les Settings ou le chat

### REQ-SMI-002: Surveillance & réception multi-plateforme

**User Story :** En tant que responsable marketing, je veux que toutes les interactions entrantes sur mes 5 réseaux soient centralisées automatiquement pour ne plus manquer de messages.

**Critères d'acceptation :**
- Les DM et commentaires sont reçus via webhooks Composio (pas de polling)
- Les plateformes supportées : Instagram DM + comments, Facebook DM + comments, LinkedIn DM + comments, X DM + replies + mentions, TikTok comments + DM, Reddit mentions + threads
- Chaque message entrant est normalisé dans un format unifié (plateforme, auteur, contenu, timestamp, contexte du post parent si commentaire)
- Les messages sont traités dans l'ordre de réception avec respect des priorités

### REQ-SMI-003: Classification IA à deux couches

**User Story :** En tant que responsable marketing, je veux que chaque message soit automatiquement classifié dans la bonne catégorie pour que la réponse appropriée soit déclenchée sans intervention manuelle.

**Critères d'acceptation :**
- Couche 1 (modèle léger) : traite 80% des messages — spam évident, FAQ, messages courts clairs
- Couche 2 (modèle avancé) : déclenchée uniquement pour les cas ambigus ou complexes
- 8 catégories supportées : Lead, Négatif, Toxique, Support, Question produit, Partenariat, Influenceur, Positif, Neutre, Spam
- Analyse de sentiment par message : positif, neutre, négatif, urgent
- Détection d'influenceurs : comptes avec audience > seuil configurable
- Les réponses FAQ en cache contournent complètement le LLM (0 appel IA)

### REQ-SMI-004: Réponse automatique intelligente

**User Story :** En tant que responsable marketing, je veux que l'agent réponde automatiquement avec le bon ton et la bonne action pour maintenir l'engagement sans mobiliser mon équipe.

**Critères d'acceptation :**
- Chaque catégorie déclenche une action spécifique (réponse FAQ, qualification lead, ticket support, etc.)
- Le ton de marque est cohérent sur toutes les plateformes
- Les réponses sont contextualisées (elles tiennent compte du message, du profil auteur, de l'historique)
- En mode "validation" : les réponses sont soumises au client avant envoi
- En mode "hors horaires" : réponses auto uniquement quand l'équipe est offline
- Le client peut corriger une réponse ou modifier une règle directement dans le chat

### REQ-SMI-005: Escalade intelligente

**User Story :** En tant que responsable marketing, je veux être alerté immédiatement en cas de crise ou d'opportunité majeure pour pouvoir intervenir au bon moment.

**Critères d'acceptation :**
- 3 niveaux d'escalade : CRITIQUE (immédiat), ATTENTION (planifié), OPPORTUNITÉ (notification)
- Les escalades critiques déclenchent une notification push immédiate (email, Slack ou SMS)
- L'alerte inclut : plateforme, message original, score sentiment, action déjà prise par l'agent
- Si crise réputationnelle (plusieurs messages négatifs en peu de temps) : l'agent propose un brouillon de réponse officielle
- Le client peut répondre ou demander une action différente directement dans le chat
- Les seuils d'escalade sont configurables par le client

### REQ-SMI-006: Qualification leads & sync CRM

**User Story :** En tant que directeur commercial, je veux que les leads détectés dans les messages sociaux soient qualifiés et envoyés automatiquement dans mon CRM pour ne plus perdre d'opportunités.

**Critères d'acceptation :**
- Détection automatique d'intention d'achat dans les messages
- Qualification conversationnelle : l'agent pose des questions (budget, besoin, délai) naturellement
- Scoring lead basé sur le profil, le contenu et le comportement
- Sync automatique avec le CRM connecté (HubSpot / Salesforce / Pipedrive)
- Fiche contact créée avec : nom, plateforme source, message d'origine, score, historique
- Notification équipe commerciale si lead chaud (configurable)

### REQ-SMI-007: Tickets helpdesk automatiques

**User Story :** En tant que responsable support, je veux que les demandes de support identifiées dans les messages sociaux créent automatiquement un ticket dans mon helpdesk.

**Critères d'acceptation :**
- Quand un message est classifié "Support", un ticket est créé dans Zendesk ou Freshdesk
- Le ticket contient : message original, plateforme, profil auteur, contexte
- Le client reçoit une confirmation de prise en charge via le canal social d'origine
- Le mapping catégorie → type de ticket est configurable

### REQ-SMI-008: Rapport hebdomadaire & analyse sentiment

**User Story :** En tant que CMO, je veux un rapport hebdomadaire de mes interactions pour suivre le sentiment de ma communauté et mesurer la performance de l'agent.

**Critères d'acceptation :**
- Rapport envoyé automatiquement chaque lundi dans le chat (via Inngest cron)
- Contenu : volume messages par plateforme, taux réponse auto, leads détectés, tickets ouverts, escalades
- Analyse sentiment : score global + tendance + détection de crises naissantes
- Comparaison avec la semaine précédente
- Recommandations : nouvelles FAQ à ajouter, seuils à ajuster, ton à affiner
- Le client peut demander un dashboard instantané à tout moment dans le chat

---

## 2. Design

### 2.1 Architecture

```
Webhooks (Composio)
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Receiver    │ ──▶ │  Classifier  │ ──▶ │   Router     │
│  (normalize) │     │  (2 couches) │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌───────────────┬─────────────┼──────────────┐
                     ▼               ▼             ▼              ▼
              ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌────────────┐
              │ Responder  │ │ Escalator  │ │ Lead      │ │ Helpdesk   │
              │ (FAQ/LLM)  │ │ (alert)    │ │ Qualifier │ │ Sync       │
              └────────────┘ └────────────┘ │ + CRM     │ └────────────┘
                                            └───────────┘
```

### 2.2 Structure fichiers

Voir section 10 du mapping.

### 2.3 Routes API

| Route | Méthode | Description |
|---|---|---|
| `/api/agents/social-interaction-manager/chat` | POST (SSE) | Supervision conversationnelle |
| `/api/agents/social-interaction-manager/webhook` | POST | Réception webhooks |
| `/api/agents/social-interaction-manager/configure` | POST | Configuration onboarding |
| `/api/agents/social-interaction-manager/faq` | GET/POST/DELETE | CRUD FAQ |
| `/api/agents/social-interaction-manager/escalations` | GET | Liste escalades |
| `/api/agents/social-interaction-manager/report` | GET | Rapport hebdo |
| `/api/agents/social-interaction-manager/dashboard` | GET | Dashboard temps réel |

### 2.4 Types principaux

```typescript
interface IncomingMessage {
  id: string;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'x' | 'tiktok' | 'reddit';
  type: 'dm' | 'comment' | 'mention' | 'reply';
  author: { id: string; name: string; handle: string; followers?: number; verified?: boolean };
  content: string;
  timestamp: string;
  parentPostId?: string;
  parentPostContent?: string;
}

type MessageCategory =
  | 'lead' | 'negative' | 'toxic' | 'support'
  | 'product-question' | 'partnership' | 'influencer'
  | 'positive' | 'neutral' | 'spam';

interface Classification {
  category: MessageCategory;
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  sentimentScore: number; // 0-10
  isInfluencer: boolean;
  layer: 1 | 2; // quelle couche a classifié
}

type EscalationLevel = 'critical' | 'attention' | 'opportunity';

interface Escalation {
  level: EscalationLevel;
  message: IncomingMessage;
  classification: Classification;
  actionTaken: string;
  draftResponse?: string;
  notifiedVia: string;
  timestamp: string;
}

interface LeadQualification {
  messageId: string;
  score: number; // 0-100
  budget?: string;
  need?: string;
  timeline?: string;
  isDecisionMaker?: boolean;
  crmSyncStatus: 'pending' | 'synced' | 'failed';
  crmContactId?: string;
}

interface FAQEntry {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  platform?: string; // si réponse spécifique à une plateforme
  hitCount: number;
}

interface InteractionConfig {
  platforms: string[];
  brandTone: { description: string; examples: string[]; forbiddenWords: string[] };
  automationLevel: 'full-auto' | 'validation' | 'off-hours';
  offHoursSchedule?: { timezone: string; workStart: string; workEnd: string; workDays: number[] };
  spamDeletion: boolean;
  escalationThresholds: { sentimentMin: number; influencerAudienceMin: number; leadScoreMin: number };
  crmTool: 'hubspot' | 'salesforce' | 'pipedrive' | null;
  helpdeskTool: 'zendesk' | 'freshdesk' | null;
  escalationChannel: 'email' | 'slack' | 'sms';
}
```

### 2.5 UI/UX — "Inbox unifié"

**Layout 3 colonnes :**

1. **Gauche (280px) — Liste messages** : Messages groupés par catégorie avec badge couleur + score sentiment. Filtres rapides en pills : plateforme (IG/FB/LI/X/TT) + statut (Traité/En attente/Escaladé). Badge "Auto" sur les messages traités automatiquement.

2. **Centre (flex) — Conversation** : Fil de conversation avec historique. Message original + réponse de l'agent. Le client peut éditer la réponse avant envoi (en mode validation).

3. **Droite (320px) — Fiche contact** : Profil social (avatar, handle, followers, bio). Historique interactions. Statut CRM si synchro. Score lead si applicable.

**Top bar :** Compteurs temps réel (messages aujourd'hui, traités auto, leads, escalades). Bandeau rouge si escalade critique active.

**Tab "Insights" :** Métriques hebdo en metric cards + graphique sentiment trend.

---

## 3. Tasks

### TASK-SMI-001: Scaffolding agent

**Description :** Créer la structure de fichiers, types et constantes.

**Étapes :**
1. Créer `src/agents/social-interaction-manager/` avec la structure complète
2. Définir tous les types dans `core/types.ts`
3. Définir les constantes : CATEGORIES avec priorités, SENTIMENT_THRESHOLDS, PLATFORM_CONFIGS
4. Créer les fichiers modules vides

**Dépendances :** Aucune

### TASK-SMI-002: Configuration & onboarding

**Description :** Implémenter le flow d'onboarding conversationnel.

**Étapes :**
1. Créer le schéma Zod `InteractionConfigSchema`
2. Implémenter le flow conversationnel dans le chat (collecte des 9 champs)
3. Persister la config dans un champ JSON sur `Workspace` ou `ElevayBrandProfile`
4. Implémenter la génération de 5 réponses types pour validation
5. Créer la route `/api/agents/social-interaction-manager/configure`

**Dépendances :** TASK-SMI-001

### TASK-SMI-003: FAQ cache

**Description :** Implémenter le cache FAQ pour les réponses instantanées.

**Étapes :**
1. Implémenter `faq-cache.ts` : stockage en mémoire ou Redis des paires question/réponse
2. Implémenter la détection de match FAQ (fuzzy matching sur keywords)
3. Créer la route CRUD `/api/agents/social-interaction-manager/faq`
4. Compteur de hits par FAQ pour statistiques
5. Le cache est alimenté lors de l'onboarding et enrichi au fil du temps

**Dépendances :** TASK-SMI-002

### TASK-SMI-004: Receiver & normalisation

**Description :** Implémenter la réception et normalisation des messages entrants.

**Étapes :**
1. Créer la route webhook `/api/agents/social-interaction-manager/webhook`
2. Implémenter `receiver.ts` : normalisation des payloads webhook de chaque plateforme en `IncomingMessage`
3. Valider et sécuriser les webhooks (signature verification)
4. Queue les messages pour traitement (FIFO avec priorité)
5. Configurer les webhooks dans Composio pour chaque plateforme connectée

**Dépendances :** TASK-SMI-002

### TASK-SMI-005: Classifier à deux couches

**Description :** Implémenter la classification IA avec modèle léger puis avancé.

**Étapes :**
1. Implémenter `spam-filter.ts` : détection basique (liens suspects, patterns bot, messages 1 mot)
2. Implémenter `classifier.ts` couche 1 : règles simples + FAQ match → classification rapide
3. Implémenter couche 2 : appel Claude pour analyse sentiment + détection intention + classification complexe
4. Implémenter `influencer-detector.ts` : vérification audience via données profil
5. Implémenter `sentiment-analyzer.ts` : score sentiment 0-10
6. Router : couche 1 d'abord, couche 2 seulement si confidence < seuil ou cas ambigu

**Dépendances :** TASK-SMI-003

### TASK-SMI-006: Responder

**Description :** Implémenter la génération et envoi de réponses.

**Étapes :**
1. Implémenter `responder.ts` : routing par catégorie → action appropriée
2. FAQ match → réponse cache (0 appel LLM)
3. Autres catégories → génération via Claude avec ton de marque
4. Envoi de la réponse via Composio API sur la plateforme d'origine
5. Respecter le niveau d'automatisation (envoyer directement, ou soumettre pour validation)
6. Logger chaque réponse (message original, classification, réponse, statut)

**Dépendances :** TASK-SMI-005

### TASK-SMI-007: Escalator

**Description :** Implémenter la détection d'escalade et les notifications.

**Étapes :**
1. Implémenter `escalator.ts` : évaluation des 3 niveaux d'escalade selon les seuils configurés
2. CRITIQUE : notification push immédiate via le canal configuré (email/Slack/SMS)
3. ATTENTION : agrégation dans le prochain rapport d'escalade
4. OPPORTUNITÉ : sync CRM immédiate + notification commerciale
5. Si crise détectée (N messages négatifs en X minutes) : générer brouillon de réponse officielle
6. Logger les escalades pour le rapport hebdo

**Dépendances :** TASK-SMI-005

### TASK-SMI-008: Lead qualifier + CRM sync

**Description :** Implémenter la qualification des leads et la synchronisation CRM.

**Étapes :**
1. Implémenter `lead-qualifier.ts` : scoring basé sur le contenu, le profil et le comportement
2. Qualification conversationnelle : l'agent pose des questions de qualification via réponse
3. Implémenter `crm-sync.ts` : adapter pattern pour HubSpot / Salesforce / Pipedrive (BYOT)
4. Créer la fiche contact avec : nom, plateforme, message, score, historique
5. Notification équipe commerciale si lead chaud

**Dépendances :** TASK-SMI-006

### TASK-SMI-009: Helpdesk sync

**Description :** Implémenter la création automatique de tickets support.

**Étapes :**
1. Implémenter `helpdesk-sync.ts` : adapter pattern pour Zendesk / Freshdesk (BYOT)
2. Créer le ticket avec : message original, plateforme, profil auteur, contexte
3. Envoyer une confirmation de prise en charge via le canal social d'origine
4. Mapping catégorie → type/priorité de ticket configurable

**Dépendances :** TASK-SMI-006

### TASK-SMI-010: Reporter

**Description :** Implémenter le rapport hebdomadaire et le dashboard.

**Étapes :**
1. Implémenter `reporter.ts` : agrégation des métriques hebdomadaires
2. Générer le rapport via Claude (synthèse + recommandations)
3. Configurer le cron Inngest pour envoi automatique chaque lundi
4. Créer la route `/api/agents/social-interaction-manager/report`
5. Créer la route `/api/agents/social-interaction-manager/dashboard` pour les données temps réel
6. Implémenter le dashboard conversationnel (le client demande "état des interactions" → synthèse)

**Dépendances :** TASK-SMI-007, TASK-SMI-008

### TASK-SMI-011: UI Inbox unifié

**Description :** Créer l'interface inbox 3 colonnes.

**Étapes :**
1. Créer la page `src/app/(dashboard)/interactions/page.tsx`
2. Layout 3 colonnes : liste messages / conversation / fiche contact
3. Composant `MessageList` : groupement par catégorie, badges couleur, filtres pills
4. Composant `ConversationThread` : historique fil + réponse agent + édition
5. Composant `ContactPanel` : profil social, historique, statut CRM, score lead
6. Top bar : compteurs temps réel, bandeau escalade critique
7. Tab "Insights" : metric cards + sentiment trend chart (Recharts)
8. WebSocket ou polling pour les mises à jour temps réel de la liste
9. Respecter la charte Elevay

**Dépendances :** TASK-SMI-010
