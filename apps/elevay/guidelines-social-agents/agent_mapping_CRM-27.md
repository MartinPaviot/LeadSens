# Agent Mapping — CRM Campaign Manager (CRM-27)

> Chief CRM Campaign Officer IA — Email, SMS, A/B Testing, automatisation, optimisation conversion.

---

## 1. Identité de l'agent

| Champ | Valeur |
|-------|--------|
| **Nom** | CRM Campaign Manager |
| **Code interne** | `AGT-MKT-CRM-27` |
| **Version** | 1.0 — Périmètre V1 |
| **Positionnement** | Chief CRM Campaign Officer IA |
| **Catégorie** | Agent Marketing — CRM & Engagement |
| **Canaux couverts** | Email / Newsletter + SMS / Mobile |
| **Canal d'accès** | Interface chat B2B + automations programmées |
| **Complexité** | Moyenne-élevée — logique d'optimisation multi-canal |
| **Statut** | Actif — Production V1 |

---

## 2. Problème résolu

**🔴 Sans l'agent :** Les équipes marketing passent des heures à rédiger des campagnes manuellement, choisir le bon timing au feeling, et analyser les résultats après-coup. Campagnes sous-optimisées, segmentation floue, re-envois oubliés, opportunités manquées.

**✅ Avec l'agent :** Cet agent planifie, rédige, envoie, suit et optimise toutes les campagnes CRM de manière autonome. Il apprend des résultats pour améliorer chaque prochain envoi et s'adapte en temps réel aux performances.

---

## 3. Modules fonctionnels

### Module 1 — Planification des campagnes

Calendrier intelligent basé sur l'historique et les données d'engagement.

- Collecte du brief : objectif, segment, canal, date souhaitée
- Proposition de créneau optimal : jour + heure basés sur historique d'ouverture
- Prise en compte des fuseaux horaires selon la base de contacts
- Détection de conflits de calendrier avec les campagnes existantes
- Calendrier visuel des campagnes planifiées exportable

### Module 2 — Création de contenu & A/B testing

Génération de drafts optimisés et tests systématiques.

- Génère des emails complets : objet, pré-header, corps, CTA
- Génère des SMS courts, engageants et conformes aux limites de caractères
- Propose systématiquement 2 variations A/B : objet, CTA ou contenu dynamique
- Segmentation du contenu selon profil : nouveau client, actif, inactif, VIP
- Optimisation des objets pour maximiser l'open rate prédit

### Module 3 — Envoi, suivi & ajustement

Pilotage opérationnel complet de chaque campagne.

- Programme l'envoi via HubSpot, Klaviyo, Brevo ou Twilio (BYOT)
- Suivi KPIs : open rate, click rate, conversion, revenue généré
- Re-envoi ciblé aux non-ouvreurs avec objet modifié (configurable)
- Déclenchement de retargeting pour non-cliqueurs (configurable)
- Alerte si KPI chute sous le benchmark (optionnel)

### Module 4 — Optimisation & apprentissage continu

Amélioration automatique des prochaines campagnes.

- Analyse les résultats et identifie les patterns gagnants par segment
- Recommande ajustements : segmentation, format, objet, timing, fréquence
- Agrège les données de performance pour alimenter les prochaines campagnes
- Construit un profil d'engagement par segment sur la durée
- Propose de tester de nouveaux formats basés sur les benchmarks

---

## 4. Intégrations (BYOT — le client connecte le sien)

| Plateforme | Rôle | Données | Priorité V1 |
|---|---|---|---|
| HubSpot | Email CRM | Contacts, listes, envois, KPIs campagne | Core V1 |
| Klaviyo | Email E-commerce | Segments, flows, revenue attribué, open/click | Core V1 |
| Brevo | Email transac. | Envois, délivrabilité, listes, automations | Core V1 |
| Twilio | SMS / Mobile | Envoi SMS, statut livraison, opt-out | Core V1 |
| Composio | Orchestration | Batch requêtes, sync multi-plateforme | Core V1 |
| HubSpot CRM | Scoring leads | Cycle de vie, scoring, segmentation avancée | V2 |

Chaque client utilise sa propre stack CRM. L'agent s'adapte à la plateforme active.

---

## 5. Inputs & Outputs

### 5.1 — Brief campagne (collecte à chaque nouvelle campagne)

| Champ | Description |
|---|---|
| Objectif | Vente / Fidélisation / Réactivation / Activation / Événement |
| Segment ciblé | Tous / Nouveaux / Inactifs / VIP / Acheteurs / Liste spécifique |
| Canal | Email, SMS, ou les deux en séquence |
| Plateforme d'envoi | HubSpot / Klaviyo / Brevo / Twilio |
| Date et heure souhaitées | Désir client — l'agent propose ensuite le créneau optimal |
| Ton et style | Promotionnel, informatif, urgence, storytelling, minimaliste |
| URL ou offre | Lien de destination ou code promo si applicable |
| Budget SMS | Nombre maximum de messages à envoyer (si SMS) |

### 5.2 — A/B testing (configuré par le client au brief)

| Paramètre | Description |
|---|---|
| Activer A/B ? | Oui / Non — demandé à chaque campagne |
| Variable à tester | Objet, CTA, contenu, image, timing ou segment |
| Taille échantillon | % de la liste envoyée en test avant déploiement |
| Critère gagnant | Open rate, click rate ou conversion |
| Délai avant décision | Durée du test avant envoi de la version gagnante |

### 5.3 — Re-envoi non-ouvreurs (configurable)

| Paramètre | Description |
|---|---|
| Activer re-envoi ? | Oui / Non (par campagne ou paramètre global) |
| Délai | Par défaut 48h — modifiable |
| Objet re-envoi | Généré automatiquement avec variation ou soumis pour validation |
| Segment | Non-ouvreurs uniquement ou non-ouvreurs + non-cliqueurs |
| Max re-envois | 1 par défaut |

### 5.4 — Outputs produits

| Livrable | Contenu | Fréquence |
|---|---|---|
| Draft email | Objet + pré-header + corps HTML + CTA | Chaque campagne |
| Draft SMS | Message court optimisé + lien tracké | Chaque campagne SMS |
| 2 variations A/B | Objet A vs B ou CTA A vs B | Systématique si activé |
| Calendrier campagnes | Planning des prochains envois | Export à la demande |
| Rapport performance | Open rate, CTR, conversion, revenue par segment | Post-campagne auto |
| Re-envoi non-ouvreurs | Campagne ciblée avec objet modifié | 24-48h après envoi initial |
| Recommandations | Timing, segment, format pour prochain envoi | Fin de chaque campagne |

---

## 6. Parcours client

### PHASE 1 — Onboarding & configuration (J1)

1. Le client connecte ses plateformes CRM via OAuth (HubSpot, Klaviyo, Brevo, Twilio)
2. L'agent importe les métadonnées : listes, segments, historique open rate
3. Le client configure : fréquence max d'envoi, canaux par segment, re-envoi par défaut, seuil alerte
4. L'agent analyse l'historique et identifie les meilleurs créneaux d'envoi

**Livrable :** Connexions validées + Segments importés + Historique analysé + Préférences configurées

### PHASE 2 — Création et envoi d'une campagne

1. Le client donne son brief dans le chat (objectif, segment, canal, ton)
2. L'agent propose le créneau optimal basé sur l'historique
3. L'agent génère le draft complet + 2 variations A/B
4. Le client ajuste dans le chat et valide
5. L'agent programme l'envoi sur la plateforme

**Livrable :** Draft email/SMS + 2 variations A/B + Programmation confirmée

### PHASE 3 — Suivi et ajustements

1. 24-48h après envoi, rapport automatique dans le chat
2. KPIs : open rate, CTR, conversions, revenue, désabonnements
3. Comparaison avec benchmark historique du segment
4. Identification variation A/B gagnante
5. Proposition de re-envoi aux non-ouvreurs si activé

**Livrable :** Rapport complet + Comparaison benchmark + Vainqueur A/B + Re-envoi non-ouvreurs

### PHASE 4 — Campagne SMS

1. Brief SMS dans le chat (objectif, segment, message ou génération auto)
2. L'agent génère un SMS de 160 caractères max avec lien tracké
3. Propose une variation si A/B activé
4. Programme l'envoi via Twilio
5. Rapport livraison et clics dans le chat

**Livrable :** Draft SMS + Programmation Twilio + Rapport livraison et clics

---

## 7. Optimisation des coûts API

| Stratégie | Description |
|---|---|
| Agrégation par lot | Métriques récupérées en batch |
| Pas de sync contacts globale | Seul le segment concerné est tiré |
| Cache métadonnées | Historique open rate et segments cachés, actualisé hebdo |
| Requêtes groupées Composio | Opérations multi-plateformes batchées en 1 appel |
| Analyse simplifiée | KPIs essentiels uniquement — pas d'export brut des logs |

---

## 8. Roadmap

### V1 — en production

- Planification campagnes : brief conversationnel + créneau optimal
- Génération contenu email & SMS : draft complet + ton adapté
- A/B testing : 2 variations, gagnant envoyé automatiquement
- Programmation multi-plateforme : HubSpot, Klaviyo, Brevo, Twilio via Composio
- Suivi KPIs post-campagne : open rate, CTR, conversion, revenue
- Re-envoi non-ouvreurs : configurable, objet modifié auto
- Alertes performance : option configurable
- Optimisation & apprentissage : recommandations post-campagne

### Hors V1

| Module | Version |
|---|---|
| Scoring lead + lifecycle | V2 |
| Retargeting non-cliqueurs | V2 |
| Flows automatisation avancés (bienvenue, abandon panier, réactivation) | V2 |
| Prédiction de churn | V2 |
| Dashboard web campagnes | V2 |

---

## 9. Structure code recommandée

```
src/agents/crm-campaign-manager/
├── core/
│   ├── types.ts               ← CampaignBrief, ABConfig, CampaignReport, SegmentProfile
│   ├── constants.ts           ← SMS_CHAR_LIMIT, DEFAULT_AB_SAMPLE, TIMING_DEFAULTS
│   └── prompts.ts             ← System prompts (email draft, SMS draft, AB analysis, recommendations)
├── modules/
│   ├── onboarding.ts          ← Import segments + historique + configuration préférences
│   ├── brief-parser.ts        ← Parse brief conversationnel → CampaignBrief
│   ├── timing-optimizer.ts    ← Calcul créneau optimal depuis historique open rate
│   ├── content-generator.ts   ← Génération email (objet + pré-header + corps + CTA)
│   ├── sms-generator.ts       ← Génération SMS 160 car. + lien tracké
│   ├── ab-manager.ts          ← Logique A/B : split, envoi, évaluation gagnant
│   ├── scheduler.ts           ← Programmation envoi via plateforme (Composio)
│   ├── tracker.ts             ← Suivi KPIs post-envoi (open, click, conversion)
│   ├── resender.ts            ← Re-envoi non-ouvreurs avec objet modifié
│   └── reporter.ts            ← Rapport post-campagne + recommandations
├── utils/
│   ├── platform-adapters/
│   │   ├── hubspot.ts
│   │   ├── klaviyo.ts
│   │   ├── brevo.ts
│   │   └── twilio.ts
│   ├── segment-cache.ts      ← Cache segments + historique open rate
│   └── calendar-checker.ts   ← Détection conflits calendrier
└── index.ts                   ← Orchestrateur
```

### Routes API

```
src/app/api/agents/crm-campaign-manager/
├── chat/route.ts              ← POST (SSE) — Conversation brief + suivi
├── configure/route.ts         ← POST — Onboarding + configuration
├── campaign/
│   ├── create/route.ts        ← POST — Créer campagne (brief → draft)
│   ├── schedule/route.ts      ← POST — Programmer envoi
│   ├── report/route.ts        ← GET — Rapport post-campagne
│   └── resend/route.ts        ← POST — Re-envoi non-ouvreurs
├── sms/
│   ├── create/route.ts        ← POST — Créer campagne SMS
│   └── report/route.ts        ← GET — Rapport SMS
├── calendar/route.ts          ← GET — Calendrier campagnes
└── dashboard/route.ts         ← GET — Vue globale campagnes
```
