# Spec — CRM Campaign Manager (CRM-27)

> Chief CRM Campaign Officer IA — Email, SMS, A/B Testing, optimisation conversion.
> Référence mapping : `agent_mapping_CRM-27.md`

---

## 1. Requirements

### REQ-CRM-001: Onboarding & connexion CRM

**User Story :** En tant que responsable CRM, je veux connecter ma plateforme d'envoi et importer mes segments pour que l'agent comprenne ma base de contacts et ses comportements.

**Critères d'acceptation :**
- Le client connecte une plateforme email via OAuth : HubSpot, Klaviyo ou Brevo (BYOT)
- Le client connecte optionnellement Twilio pour le SMS
- L'agent importe les métadonnées : listes, segments, nombre de contacts par segment
- L'agent analyse l'historique open rate sur les 90 derniers jours
- L'agent identifie les meilleurs créneaux d'envoi depuis l'historique
- Le client configure : fréquence max d'envoi par contact/semaine, canaux par segment, re-envoi par défaut, seuil alerte
- La configuration est persistée et rechargée aux sessions suivantes

### REQ-CRM-002: Brief campagne conversationnel

**User Story :** En tant que marketeur, je veux donner mon brief de campagne dans le chat pour obtenir un draft optimisé sans quitter la conversation.

**Critères d'acceptation :**
- Le brief est collecté via le chat : objectif, segment, canal, date, ton, URL/offre
- L'agent propose le créneau optimal basé sur l'historique d'ouverture du segment ciblé
- Si conflit de calendrier détecté, l'agent propose une alternative
- Le brief est validé par Zod côté serveur
- Le client peut ajuster le créneau proposé

### REQ-CRM-003: Génération contenu email

**User Story :** En tant que marketeur, je veux obtenir un email marketing complet en quelques secondes pour réduire le temps de rédaction de 70%.

**Critères d'acceptation :**
- L'agent génère : objet, pré-header, corps HTML structuré, CTA
- Le contenu est adapté au segment ciblé (nouveau client, actif, inactif, VIP)
- Le ton respecte le style demandé (promotionnel, informatif, urgence, storytelling, minimaliste)
- Le client peut ajuster le draft directement dans le chat
- L'agent intègre les modifications et soumet la version finale

### REQ-CRM-004: Génération SMS

**User Story :** En tant que marketeur, je veux envoyer des campagnes SMS optimisées depuis le même agent pour avoir un workflow unifié email + SMS.

**Critères d'acceptation :**
- L'agent génère un SMS de 160 caractères max avec lien tracké
- Le message est engageant et conforme aux réglementations (opt-out)
- Le client peut demander des variations
- Programmation via Twilio avec confirmation segment + volume
- Rapport de livraison et de clics disponible dans le chat

### REQ-CRM-005: A/B testing systématique

**User Story :** En tant que marketeur, je veux tester systématiquement 2 variations de mes campagnes pour améliorer mes performances d'envoi en continu.

**Critères d'acceptation :**
- L'agent propose systématiquement 2 variations A/B si l'option est activée
- Le client choisit la variable à tester : objet, CTA, contenu, timing
- La taille de l'échantillon est configurable (% de la liste)
- Le critère gagnant est configurable : open rate, click rate ou conversion
- Le délai avant décision est configurable
- La version gagnante est envoyée automatiquement au reste de la liste
- Le rapport identifie le gagnant avec justification

### REQ-CRM-006: Programmation & envoi

**User Story :** En tant que marketeur, je veux programmer et envoyer mes campagnes depuis le chat en validant d'un message.

**Critères d'acceptation :**
- Le client valide la campagne d'un message dans le chat
- L'agent programme l'envoi sur la plateforme choisie via Composio
- Confirmation avec récapitulatif : segment, créneau, taille liste, plateforme
- Le client peut annuler ou modifier jusqu'à 1h avant l'envoi
- L'envoi respecte la fréquence max configurée par contact

### REQ-CRM-007: Rapport post-campagne

**User Story :** En tant que CMO, je veux un rapport automatique après chaque campagne pour mesurer les résultats sans chercher dans mes outils.

**Critères d'acceptation :**
- Rapport envoyé automatiquement 24-48h après l'envoi dans le chat
- Contenu : open rate, CTR, conversions, revenue généré, désabonnements
- Comparaison avec le benchmark historique du segment
- Identification variation A/B gagnante avec justification
- Recommandations pour le prochain envoi (timing, segment, format)

### REQ-CRM-008: Re-envoi non-ouvreurs

**User Story :** En tant que marketeur, je veux re-cibler automatiquement les non-ouvreurs pour récupérer 15% de taux d'ouverture supplémentaire.

**Critères d'acceptation :**
- 48h après l'envoi initial, l'agent propose un re-envoi aux non-ouvreurs dans le chat
- Nouvel objet généré automatiquement avec variation significative
- Le client valide ou refuse d'un message
- Envoi programmé dans les 2h suivant la validation
- Max 1 re-envoi par défaut pour éviter la pression d'envoi
- Le paramètre est configurable par campagne ou en paramètre global

---

## 2. Design

### 2.1 Architecture

```
┌─────────────────────────────────────┐
│          Chat Interface             │
│  Brief → Preview → Validate → Send │
└──────────────────┬──────────────────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Content  │ │ A/B      │ │ Timing   │
│ Generator│ │ Manager  │ │ Optimizer│
└──────────┘ └──────────┘ └──────────┘
      │            │            │
      └────────────┼────────────┘
                   ▼
         ┌─────────────────┐
         │   Scheduler     │
         │ HubSpot/Klaviyo │
         │ Brevo/Twilio    │
         └────────┬────────┘
                  │
         ┌────────┼────────┐
         ▼                 ▼
  ┌────────────┐   ┌────────────┐
  │  Tracker   │   │  Resender  │
  │  (KPIs)    │   │  (48h)     │
  └────────────┘   └────────────┘
         │
         ▼
  ┌────────────┐
  │  Reporter  │
  └────────────┘
```

### 2.2 Structure fichiers

Voir section 9 du mapping.

### 2.3 Types principaux

```typescript
interface CRMCampaignBrief {
  objective: 'sale' | 'retention' | 'reactivation' | 'activation' | 'event';
  segment: 'all' | 'new' | 'inactive' | 'vip' | 'buyers' | string;
  channel: 'email' | 'sms' | 'both';
  platform: 'hubspot' | 'klaviyo' | 'brevo' | 'twilio';
  preferredDate?: string;
  preferredTime?: string;
  tone: 'promotional' | 'informational' | 'urgency' | 'storytelling' | 'minimal';
  offerUrl?: string;
  promoCode?: string;
  smsBudget?: number;
  abConfig?: ABConfig;
  resendConfig?: ResendConfig;
}

interface ABConfig {
  enabled: boolean;
  variable: 'subject' | 'cta' | 'content' | 'image' | 'timing' | 'segment';
  sampleSize: number; // % de la liste
  winCriteria: 'open_rate' | 'click_rate' | 'conversion';
  decisionDelay: number; // heures
}

interface ResendConfig {
  enabled: boolean;
  delay: number; // heures après envoi initial (défaut 48)
  segment: 'non-openers' | 'non-openers-and-non-clickers';
  maxResends: number; // défaut 1
  autoApprove: boolean; // envoyer sans validation ou proposer
}

interface EmailDraft {
  subject: string;
  preHeader: string;
  bodyHtml: string;
  cta: { text: string; url: string };
  variantB?: { subject?: string; cta?: { text: string; url: string }; bodyHtml?: string };
}

interface SMSDraft {
  message: string;
  characterCount: number;
  trackedLink: string;
  variantB?: { message: string };
}

interface CampaignReport {
  campaignId: string;
  metrics: {
    openRate: number;
    clickRate: number;
    conversions: number;
    revenue: number;
    unsubscribes: number;
    bounceRate: number;
  };
  benchmark: {
    openRate: number;
    clickRate: number;
  };
  abResult?: {
    winner: 'A' | 'B';
    variantAMetrics: Record<string, number>;
    variantBMetrics: Record<string, number>;
    justification: string;
  };
  recommendations: string[];
  resendProposal?: {
    segment: string;
    count: number;
    newSubject: string;
  };
}

interface CRMConfig {
  platform: 'hubspot' | 'klaviyo' | 'brevo';
  smsPlatform?: 'twilio';
  maxSendsPerContactPerWeek: number;
  defaultResend: boolean;
  alertThreshold?: number; // open rate minimum avant alerte
  segments: { id: string; name: string; count: number }[];
  historicalOpenRate: number;
  bestTimings: { day: string; hour: string; openRate: number }[];
}
```

### 2.4 UI/UX — "Campaign Cockpit"

**Chat principal** avec composants riches inline :

- **Campaign Card** : composant riche dans le chat après brief complété. Affiche : segment ciblé, créneau optimal, preview email (mini-iframe stylisé), 2 variations A/B côte à côte, bouton "Programmer l'envoi".

- **Report Card** : la Campaign Card se transforme en report après envoi. KPIs en metric cards (open rate avec sparkline, CTR, conversions, revenue). Badge gagnant A/B.

- **Resend Notification** : notification inline dans le chat 48h après envoi. Affiche : nombre de non-ouvreurs, nouvel objet proposé, boutons Valider/Refuser.

- **Page "Campagnes"** : timeline chronologique de toutes les campagnes (passées et planifiées). Chaque campagne cliquable → détails + rapport.

---

## 3. Tasks

### TASK-CRM-001: Scaffolding agent

**Description :** Créer la structure de fichiers, types et constantes.

**Étapes :**
1. Créer `src/agents/crm-campaign-manager/` avec la structure complète
2. Définir tous les types dans `core/types.ts`
3. Constantes : SMS_CHAR_LIMIT (160), DEFAULT_AB_SAMPLE (20), TIMING_DEFAULTS
4. Créer les platform adapters vides (hubspot, klaviyo, brevo, twilio)

**Dépendances :** Aucune

### TASK-CRM-002: Onboarding & configuration

**Description :** Implémenter la connexion CRM et l'import des données initiales.

**Étapes :**
1. Flow conversationnel : détection de la plateforme CRM active
2. Connexion OAuth via Composio (HubSpot / Klaviyo / Brevo + Twilio)
3. Import des métadonnées : segments, listes, nombre de contacts
4. Analyse historique open rate 90 jours → calcul meilleurs créneaux
5. Configuration préférences : fréquence max, re-envoi, seuil alerte
6. Persister `CRMConfig` dans workspace settings (JSON)
7. Créer la route `/api/agents/crm-campaign-manager/configure`

**Dépendances :** TASK-CRM-001

### TASK-CRM-003: Brief parser

**Description :** Parser le brief conversationnel en CRMCampaignBrief structuré.

**Étapes :**
1. Schéma Zod `CRMCampaignBriefSchema`
2. Détection depuis le message : objectif, segment, canal, ton, date
3. Si date non précisée, l'agent propose le créneau optimal
4. Détection conflits calendrier avec campagnes existantes
5. Validation complète du brief avant génération

**Dépendances :** TASK-CRM-002

### TASK-CRM-004: Content generator (email)

**Description :** Générer les drafts email complets avec variations A/B.

**Étapes :**
1. System prompts pour chaque ton (promotionnel, informatif, urgence, storytelling, minimal)
2. Générer : objet, pré-header, corps HTML structuré, CTA
3. Adapter le contenu au segment (nouveau, actif, inactif, VIP)
4. Générer la variation B si A/B activé
5. Le client peut ajuster dans le chat → l'agent intègre les modifications
6. Validation du draft final

**Dépendances :** TASK-CRM-003

### TASK-CRM-005: SMS generator

**Description :** Générer les SMS optimisés avec lien tracké.

**Étapes :**
1. Générer un message de 160 caractères max
2. Intégrer un lien tracké court (UTM params)
3. Respecter les réglementations (opt-out mention)
4. Variation B si A/B activé
5. Validation caractères post-génération

**Dépendances :** TASK-CRM-003

### TASK-CRM-006: Timing optimizer

**Description :** Calculer le créneau d'envoi optimal.

**Étapes :**
1. Analyser l'historique open rate par jour/heure depuis le cache
2. Pondérer par segment ciblé
3. Prendre en compte les fuseaux horaires de la base
4. Détecter les conflits avec le calendrier existant
5. Proposer le top 3 créneaux avec justification

**Dépendances :** TASK-CRM-002

### TASK-CRM-007: A/B manager

**Description :** Implémenter la logique de split, envoi et évaluation A/B.

**Étapes :**
1. Split de la liste selon le sample size configuré
2. Envoi de la variation A à une moitié du sample, B à l'autre
3. Timer configurable avant évaluation
4. Évaluation selon le critère gagnant (open rate, click rate ou conversion)
5. Envoi automatique de la version gagnante au reste de la liste
6. Logging des résultats A/B pour le rapport

**Dépendances :** TASK-CRM-006

### TASK-CRM-008: Scheduler & platform adapters

**Description :** Programmer l'envoi via la plateforme CRM connectée.

**Étapes :**
1. Implémenter les 4 platform adapters : HubSpot, Klaviyo, Brevo, Twilio
2. Chaque adapter expose : `scheduleCampaign()`, `cancelCampaign()`, `getCampaignMetrics()`
3. Implémenter `scheduler.ts` : validation → programmation → confirmation
4. Vérifier la fréquence max par contact avant envoi
5. Permettre l'annulation jusqu'à 1h avant

**Dépendances :** TASK-CRM-007

### TASK-CRM-009: Tracker & reporter

**Description :** Suivre les KPIs et générer le rapport post-campagne.

**Étapes :**
1. Implémenter `tracker.ts` : pull des métriques 24-48h après envoi via Composio
2. Calculer : open rate, CTR, conversions, revenue, désabonnements, bounce rate
3. Comparer avec le benchmark historique du segment
4. Implémenter `reporter.ts` : génération du rapport via Claude (synthèse + recommandations)
5. Configurer le trigger Inngest pour le rapport auto post-envoi
6. Créer la route `/api/agents/crm-campaign-manager/campaign/report`

**Dépendances :** TASK-CRM-008

### TASK-CRM-010: Resender

**Description :** Implémenter le re-envoi ciblé aux non-ouvreurs.

**Étapes :**
1. 48h après envoi, identifier les non-ouvreurs via les métriques plateforme
2. Générer un nouvel objet avec variation significative via Claude
3. Proposer le re-envoi dans le chat avec : nombre de non-ouvreurs, nouvel objet, boutons Valider/Refuser
4. Si validé, programmer l'envoi dans les 2h
5. Si `autoApprove` activé, envoyer directement
6. Rapport du re-envoi intégré au rapport global

**Dépendances :** TASK-CRM-009

### TASK-CRM-011: Route API chat SSE

**Description :** Créer la route chat principale avec streaming.

**Étapes :**
1. Créer `src/app/api/agents/crm-campaign-manager/chat/route.ts`
2. Auth + workspaceId
3. Intégrer le brief parser
4. Charger la CRMConfig depuis la DB
5. Orchestrer : brief → timing → generation → A/B → schedule → track → report
6. Streamer les réponses en SSE
7. Sauvegarder les runs dans `ElevayAgentRun`

**Dépendances :** TASK-CRM-010

### TASK-CRM-012: UI Campaign Cockpit

**Description :** Créer l'interface chat avec composants riches inline.

**Étapes :**
1. Créer la page `src/app/(dashboard)/crm-campaigns/page.tsx`
2. Chat principal (assistant-ui) avec composants riches inline
3. Composant `CampaignCard` : preview email, variations A/B côte à côte, bouton "Programmer"
4. Composant `ReportCard` : metric cards (open rate sparkline, CTR, conversions, revenue)
5. Composant `ResendNotification` : inline notification avec nouvel objet + boutons
6. Page secondaire "Campagnes" : timeline chronologique de toutes les campagnes
7. Ajouter l'entrée dans la sidebar navigation
8. Respecter la charte Elevay

**Dépendances :** TASK-CRM-011
