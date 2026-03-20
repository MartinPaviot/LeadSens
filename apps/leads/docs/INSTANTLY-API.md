# Instantly API V2 — Reference Complete

> Source de verite pour l'API Instantly V2.
> Derniere mise a jour : 2026-03-04. Source : `developer.instantly.ai` + `instantly-schema.txt`

**Base URL** : `https://api.instantly.ai/api/v2`
**Mock server** : `https://developer.instantly.ai/_mock/api/v2/`
**Auth** : Bearer token — `Authorization: Bearer <API_KEY>`
**Version** : 2.0.0

---

## Table des matieres

1. [Inventaire complet des endpoints (~140+)](#1-inventaire-complet-des-endpoints)
2. [Schemas detailles](#2-schemas-detailles)
3. [SuperSearch — Filtres & Parsing](#3-supersearch--filtres--parsing)
4. [Enums de statut](#4-enums-de-statut)
5. [Gotchas & Notes critiques](#5-gotchas--notes-critiques)
6. [Statut d'implementation LeadSens](#6-statut-dimplementation-leadsens)

---

## 1. Inventaire complet des endpoints

### 1.1 Analytics (7 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/accounts/warmup-analytics` | Warmup analytics (filtre par email list) |
| GET | `/accounts/analytics/daily` | Analytics quotidiennes des comptes |
| POST | `/accounts/test/vitals` | Tester la sante d'un compte |
| GET | `/campaigns/analytics` | Analytics de campagne(s) (supporte `expand_crm_events`) |
| GET | `/campaigns/analytics/overview` | Vue d'ensemble analytics campagne |
| GET | `/campaigns/analytics/daily` | Analytics quotidiennes campagne |
| GET | `/campaigns/analytics/steps` | Analytics par step de campagne |

### 1.2 OAuth (3 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/oauth/google/init` | Initialiser OAuth Google |
| POST | `/oauth/microsoft/init` | Initialiser OAuth Microsoft |
| GET | `/oauth/session/status/{sessionId}` | Verifier le statut d'une session OAuth |

### 1.3 Account (15 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/accounts` | Creer un compte email (IMAP/SMTP, Google, Microsoft, AWS, AirMail) |
| GET | `/accounts` | Lister les comptes (filtres: `tag_ids`, `status`, `provider_code`, `search`, `limit`, `starting_after`) |
| GET | `/accounts/{email}` | Obtenir un compte par email |
| PATCH | `/accounts/{email}` | Modifier un compte |
| DELETE | `/accounts/{email}` | Supprimer un compte |
| POST | `/accounts/warmup/enable` | Activer le warmup |
| POST | `/accounts/warmup/disable` | Desactiver le warmup |
| POST | `/accounts/{email}/pause` | Mettre un compte en pause |
| POST | `/accounts/{email}/resume` | Reprendre un compte |
| POST | `/accounts/{email}/mark-fixed` | Marquer un compte comme repare |
| GET | `/accounts/ctd/status` | Statut du custom tracking domain |
| POST | `/accounts/move` | Deplacer des comptes |

### 1.4 Campaign (17 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/campaigns` | Creer une campagne |
| GET | `/campaigns` | Lister les campagnes |
| GET | `/campaigns/{id}` | Obtenir une campagne par ID |
| PATCH | `/campaigns/{id}` | Modifier une campagne |
| DELETE | `/campaigns/{id}` | Supprimer une campagne |
| POST | `/campaigns/{id}/activate` | Activer une campagne |
| POST | `/campaigns/{id}/pause` | Mettre en pause une campagne |
| GET | `/campaigns/search-by-contact` | Chercher une campagne par email de lead |
| POST | `/campaigns/{id}/share` | Partager une campagne |
| POST | `/campaigns/{id}/from-export` | Importer depuis un export |
| POST | `/campaigns/{id}/export` | Exporter une campagne |
| POST | `/campaigns/{id}/duplicate` | Dupliquer une campagne |
| GET | `/campaigns/count-launched` | Compter les campagnes lancees |
| POST | `/campaigns/{id}/variables` | Variables de campagne |
| GET | `/campaigns/{id}/sending-status` | Statut d'envoi de la campagne |

### 1.5 Email / Unibox (8 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/emails/reply` | Repondre a un email (`reply_to_uuid` = id de l'email existant) |
| POST | `/emails/forward` | Transmettre un email |
| GET | `/emails` | Lister les emails (filtres: `assigned_to`, `campaign_id`, `eaccount`, `email_type`, `is_unread`, `lead`, `order`) |
| GET | `/emails/{id}` | Obtenir un email par ID |
| PATCH | `/emails/{id}` | Modifier un email |
| DELETE | `/emails/{id}` | Supprimer un email |
| GET | `/emails/unread/count` | Compter les emails non lus |
| POST | `/emails/threads/{thread_id}/mark-as-read` | Marquer un thread comme lu |

### 1.6 Email Verification (2 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/email-verification` | Verifier une adresse email |
| GET | `/email-verification/{email}` | Obtenir le statut de verification |

### 1.7 Lead List (6 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/lead-lists` | Creer une lead list |
| GET | `/lead-lists` | Lister les lead lists |
| GET | `/lead-lists/{id}` | Obtenir une lead list par ID |
| PATCH | `/lead-lists/{id}` | Modifier une lead list |
| DELETE | `/lead-lists/{id}` | Supprimer une lead list |
| GET | `/lead-lists/{id}/verification-stats` | Stats de verification d'une lead list |

### 1.8 Lead (13 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/leads` | Creer un lead (email requis pour campagne ; email/first_name/last_name pour list) |
| DELETE | `/leads` | Suppression bulk de leads |
| POST | `/leads/list` | Lister les leads (POST, pas GET — filtres complexes) |
| GET | `/leads/{id}` | Obtenir un lead par ID |
| PATCH | `/leads/{id}` | Modifier un lead |
| DELETE | `/leads/{id}` | Supprimer un lead |
| POST | `/leads/merge` | Fusionner des leads |
| POST | `/leads/update-interest-status` | Modifier le statut d'interet d'un lead |
| POST | `/leads/subsequence/remove` | Retirer un lead d'une subsequence |
| POST | `/leads/bulk-assign` | Assigner des leads en masse |
| POST | `/leads/move` | Deplacer des leads entre campagnes/lists |
| POST | `/leads/subsequence/move` | Deplacer des leads entre subsequences |
| POST | `/leads/add` | Ajouter des leads a une campagne |

### 1.9 SuperSearch Enrichment (10 endpoints)

| Methode | Path | Credits | Description |
|---------|------|---------|-------------|
| POST | `/supersearch-enrichment/count-leads-from-supersearch` | Non | Estimation du nombre de leads |
| POST | `/supersearch-enrichment/preview-leads-from-supersearch` | Non | Preview 5 leads sample |
| POST | `/supersearch-enrichment/enrich-leads-from-supersearch` | **Oui** | Sourcing reel (consomme des credits) |
| GET | `/supersearch-enrichment/{resource_id}` | Non | Poll status du sourcing |
| POST | `/supersearch-enrichment` | — | Creer un enrichissement sur une ressource |
| PATCH | `/supersearch-enrichment/{resource_id}/settings` | — | Modifier les settings d'enrichissement |
| POST | `/supersearch-enrichment/ai` | — | Creer un enrichissement AI |
| GET | `/supersearch-enrichment/ai/{resource_id}/in-progress` | — | Verifier le progres d'un enrichissement AI |
| GET | `/supersearch-enrichment/history/{resource_id}` | — | Historique des enrichissements |
| POST | `/supersearch-enrichment/run` | — | Lancer un enrichissement |

### 1.10 Campaign Subsequence (9 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/subsequences` | Creer une subsequence |
| GET | `/subsequences` | Lister les subsequences |
| GET | `/subsequences/{id}` | Obtenir une subsequence par ID |
| PATCH | `/subsequences/{id}` | Modifier une subsequence |
| DELETE | `/subsequences/{id}` | Supprimer une subsequence |
| POST | `/subsequences/{id}/duplicate` | Dupliquer une subsequence |
| POST | `/subsequences/{id}/pause` | Mettre en pause |
| POST | `/subsequences/{id}/resume` | Reprendre |
| GET | `/subsequences/{id}/sending-status` | Statut d'envoi |

### 1.11 Webhook (8 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/webhooks` | Lister les webhooks |
| POST | `/webhooks` | Creer un webhook |
| GET | `/webhooks/{id}` | Obtenir un webhook par ID |
| PATCH | `/webhooks/{id}` | Modifier un webhook |
| DELETE | `/webhooks/{id}` | Supprimer un webhook |
| GET | `/webhooks/event-types` | Lister les types d'evenements |
| POST | `/webhooks/{id}/test` | Tester un webhook |
| POST | `/webhooks/{id}/resume` | Reprendre un webhook desactive |

### 1.12 Webhook Event (4 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/webhook-events` | Lister les evenements |
| GET | `/webhook-events/{id}` | Obtenir un evenement par ID |
| GET | `/webhook-events/summary` | Resume des evenements |
| GET | `/webhook-events/summary-by-date` | Resume par date |

### 1.13 Custom Tag (6 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/custom-tags` | Creer un tag |
| GET | `/custom-tags` | Lister les tags |
| GET | `/custom-tags/{id}` | Obtenir un tag par ID |
| PATCH | `/custom-tags/{id}` | Modifier un tag |
| DELETE | `/custom-tags/{id}` | Supprimer un tag |
| POST | `/custom-tags/toggle-resource` | Toggler un tag sur une ressource |

### 1.14 Custom Tag Mapping (1 endpoint)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/custom-tag-mappings` | Lister les mappings tag ↔ ressource |

### 1.15 Block List Entry (5 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/block-lists-entries` | Creer une entree de blocklist |
| GET | `/block-lists-entries` | Lister les entrees |
| GET | `/block-lists-entries/{id}` | Obtenir une entree par ID |
| PATCH | `/block-lists-entries/{id}` | Modifier une entree |
| DELETE | `/block-lists-entries/{id}` | Supprimer une entree |

### 1.16 Lead Label (7 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/lead-labels` | Creer un label |
| GET | `/lead-labels` | Lister les labels |
| GET | `/lead-labels/{id}` | Obtenir un label par ID |
| PATCH | `/lead-labels/{id}` | Modifier un label |
| DELETE | `/lead-labels/{id}` | Supprimer un label |
| POST | `/lead-labels/ai-reply-label` | Labelling AI des reponses |

### 1.17 Background Job (2 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/background-jobs` | Lister les jobs en arriere-plan |
| GET | `/background-jobs/{id}` | Obtenir un job par ID |

### 1.18 Workspace (6 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/workspaces/current` | Obtenir le workspace courant |
| PATCH | `/workspaces/current` | Modifier le workspace courant |
| POST | `/workspaces/current/whitelabel-domain` | Definir le domaine whitelabel |
| GET | `/workspaces/current/whitelabel-domain` | Obtenir le domaine whitelabel |
| DELETE | `/workspaces/current/whitelabel-domain` | Supprimer le domaine whitelabel |
| POST | `/workspaces/current/change-owner` | Changer le proprietaire |

### 1.19 Workspace Member (5 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/workspace-members` | Ajouter un membre |
| GET | `/workspace-members` | Lister les membres |
| GET | `/workspace-members/{id}` | Obtenir un membre par ID |
| PATCH | `/workspace-members/{id}` | Modifier un membre |
| DELETE | `/workspace-members/{id}` | Supprimer un membre |

### 1.20 Workspace Group Member (5 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/workspace-group-members` | Ajouter un membre au groupe |
| GET | `/workspace-group-members` | Lister les membres du groupe |
| GET | `/workspace-group-members/{id}` | Obtenir un membre par ID |
| DELETE | `/workspace-group-members/{id}` | Supprimer un membre |
| GET | `/workspace-group-members/admin` | Obtenir l'admin |

### 1.21 Account Campaign Mapping (1 endpoint)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/account-campaign-mappings/{email}` | Campagnes liees a un compte |

### 1.22 API Key (3 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/api-keys` | Creer une API key (avec scopes) |
| GET | `/api-keys` | Lister les API keys |
| DELETE | `/api-keys/{id}` | Supprimer une API key |

### 1.23 Inbox Placement Test (6 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/inbox-placement-tests` | Creer un test |
| GET | `/inbox-placement-tests` | Lister les tests |
| GET | `/inbox-placement-tests/{id}` | Obtenir un test par ID |
| DELETE | `/inbox-placement-tests/{id}` | Supprimer un test |
| PATCH | `/inbox-placement-tests/{id}` | Modifier un test |
| GET | `/inbox-placement-tests/email-service-provider-options` | Options ESP |

### 1.24 Inbox Placement Analytics (5 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/inbox-placement-analytics` | Lister les analytics |
| GET | `/inbox-placement-analytics/{id}` | Obtenir par ID |
| POST | `/inbox-placement-analytics/stats-by-test-id` | Stats par test ID |
| POST | `/inbox-placement-analytics/deliverability-insights` | Insights delivrabilite |
| POST | `/inbox-placement-analytics/stats-by-date` | Stats par date |

### 1.25 Inbox Placement Reports (2 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/inbox-placement-reports` | Lister les rapports |
| GET | `/inbox-placement-reports/{id}` | Obtenir un rapport par ID |

### 1.26 DFY Email Account Order (7 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/dfy-email-account-orders` | Creer une commande DFY |
| GET | `/dfy-email-account-orders` | Lister les commandes |
| POST | `/dfy-email-account-orders/domains/similar` | Domaines similaires |
| POST | `/dfy-email-account-orders/domains/check` | Verifier la disponibilite |
| POST | `/dfy-email-account-orders/domains/pre-warmed-up-list` | Liste pre-warmup |
| GET | `/dfy-email-account-orders/accounts` | Lister les comptes DFY |
| POST | `/dfy-email-account-orders/accounts/cancel` | Annuler un compte DFY |

### 1.27 Workspace Billing (2 endpoints)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/workspace-billing/plan-details` | Details du plan |
| GET | `/workspace-billing/subscription-details` | Details de l'abonnement |

### 1.28 Autres (collapsed dans la doc)

| Categorie | Description |
|-----------|-------------|
| Custom Prompt Template | Templates de prompts custom (AI enrichment) |
| Sales Flow | Vues et interactions sales sur campagnes/leads |
| Email Template | Templates d'email pour campagnes |
| CRM Actions | Actions CRM (phone numbers) |
| Audit Log | Journal d'audit des activites |

---

## 2. Schemas detailles

### 2.1 Account

```json
{
  "email": "user@example.com",           // string (email) — required
  "timestamp_created": "2026-02-28T...", // string (date-time) — read-only
  "timestamp_updated": "2026-02-28T...", // string (date-time) — read-only
  "first_name": "John",                  // string — required
  "last_name": "Doe",                    // string — required
  "organization": "uuid",                // string (uuid) — read-only
  "warmup_status": 1,                    // number — read-only (see enum below)
  "provider_code": 2,                    // number — required (1=IMAP/SMTP, 2=Google, 3=Microsoft, 4=AWS, 8=AirMail)
  "setup_pending": false,                // boolean — read-only
  "is_managed_account": false,           // boolean — read-only
  "warmup": {                            // object — optional
    "limit": 100,
    "advanced": {},
    "warmup_custom_ftag": "warmup",
    "increment": "disabled",
    "reply_rate": 0.1
  },
  "daily_limit": 100,                    // number|null
  "status": 1,                           // number — read-only (see enum below)
  "enable_slow_ramp": false,             // boolean|null
  "stat_warmup_score": 85,              // number|null — read-only (0-100)
  "sending_gap": 10,                     // number [0..1440] — gap en minutes entre emails
  "signature": "Best regards, John",     // string|null
  "tracking_domain_name": "example.com", // string|null
  "tracking_domain_status": "active",    // string|null
  "timestamp_last_used": "2026-02-28T...", // string|null — read-only
  "status_message": {                    // object — read-only (erreur si applicable)
    "code": "EENVELOPE",
    "command": "DATA",
    "response": "550-5.4.5 ...",
    "responseCode": 550
  }
}
```

### 2.2 Campaign

```json
{
  "id": "uuid",                          // string (uuid) — read-only
  "name": "My Campaign",                 // string — required
  "status": 1,                           // number — read-only (see enum)
  "campaign_schedule": {                 // object — REQUIRED
    "schedules": [{
      "name": "Business Hours",
      "timing": { "from": "09:00", "to": "17:00" },
      "days": { "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false },
      "timezone": "Europe/Sarajevo"       // enum restreinte (voir section 5)
    }],
    "start_date": "2025-09-25",          // string|null (YYYY-MM-DD)
    "end_date": null                      // string|null (YYYY-MM-DD)
  },
  "sequences": [{                        // Array — UN SEUL element, steps dedans
    "steps": [{
      "type": "email",                    // TOUJOURS "email"
      "delay": 2,                         // number — delai AVANT le prochain email
      "delay_unit": "days",              // "minutes"|"hours"|"days" (defaut: "days")
      "pre_delay": 2,                    // number — delai avant le 1er email (subsequences only)
      "pre_delay_unit": "days",          // "minutes"|"hours"|"days"
      "variants": [{
        "subject": "Hello {{firstName}}",
        "body": "Hey {{firstName}},\n\nI hope you are doing well.",
        "v_disabled": false               // boolean — desactiver une variante
      }]
    }]
  }],
  "email_list": ["john@doe.com"],        // Array — comptes d'envoi
  "email_tag_list": ["uuid"],            // Array (uuid) — tags de comptes
  "daily_limit": 100,                    // number|null
  "daily_max_leads": 100,               // number|null — max nouveaux leads/jour
  "email_gap": 10,                       // number|null — gap en minutes
  "random_wait_max": 10,                // number|null — attente aleatoire max
  "text_only": false,                    // boolean|null
  "first_email_text_only": false,        // boolean|null
  "stop_on_reply": false,               // boolean|null
  "stop_on_auto_reply": false,          // boolean|null
  "stop_for_company": false,            // boolean|null — stopper pour tout le domaine sur reply
  "link_tracking": true,                // boolean|null
  "open_tracking": true,                // boolean|null
  "prioritize_new_leads": false,        // boolean|null
  "match_lead_esp": false,              // boolean|null
  "insert_unsubscribe_header": false,   // boolean|null
  "allow_risky_contacts": false,        // boolean|null
  "disable_bounce_protect": false,      // boolean|null
  "pl_value": 100,                      // number|null — valeur par lead positif
  "is_evergreen": false,                // boolean|null
  "cc_list": ["john@doe.com"],          // Array (email)
  "bcc_list": ["john@doe.com"],         // Array (email)
  "not_sending_status": 2,              // number|null — read-only (see enum)
  "auto_variant_select": null,          // object|null — A/B testing auto
  "limit_emails_per_company_override": null // object|null
}
```

### 2.3 Email (Unibox)

```json
{
  "id": "uuid",                          // read-only
  "timestamp_created": "2026-02-28T...", // read-only — quand ajoute a la DB
  "timestamp_email": "2026-02-28T...",   // read-only — timestamp reel de l'email
  "message_id": "<example123@mail.gmail.com>", // read-only
  "subject": "Re: Your inquiry",        // required
  "from_address_email": "sender@example.com", // read-only
  "to_address_email_list": "recipient@example.com", // required — comma-separated
  "cc_address_email_list": "cc@example.com", // string|null
  "bcc_address_email_list": "bcc@example.com", // string|null
  "reply_to": "replyto@example.com",    // string|null
  "body": {                              // object — read-only
    "text": "This is a test email",
    "html": "<p>This is a test email</p>"
  },
  "organization_id": "uuid",            // read-only
  "campaign_id": "uuid",                // string|null — null pour les emails manuels
  "subsequence_id": "uuid",             // string|null
  "list_id": "uuid",                    // string|null
  "lead": "jondoe@example.com",         // string|null — email du lead
  "lead_id": "uuid",                    // string|null
  "eaccount": "eaccount-123",           // required — compte d'envoi
  "ue_type": 3,                         // number|null (see enum)
  "step": "step-123",                   // string|null — step de campagne
  "is_unread": 1,                       // number|null (0/1)
  "is_auto_reply": 0,                   // number|null — read-only (0=false, 1=true)
  "ai_interest_value": 0.75,            // number|null
  "ai_assisted": 1,                     // number|null (0/1)
  "is_focused": 1,                      // number|null — dans l'onglet primaire Unibox
  "i_status": 0,                        // number|null — interest status
  "thread_id": "uuid",                  // string|null — tous les emails du meme thread ont le meme ID
  "content_preview": "Preview...",       // string|null
  "attachment_json": {                   // object|null — read-only
    "files": [{ "filename": "...", "size": 1927, "type": "text/css", "url": "https://...", "error": null }]
  },
  "ai_agent_id": "uuid"                 // string|null — ID de l'agent AI
}
```

### 2.4 Lead

```json
{
  "id": "uuid",                          // read-only
  "timestamp_created": "2026-02-28T...", // read-only
  "timestamp_updated": "2026-02-28T...", // read-only
  "organization": "uuid",               // read-only
  "campaign": "uuid",                   // string|null
  "list_id": "uuid",                    // string|null
  "status": 1,                          // number — read-only (see enum)
  "email": "example@example.com",       // string|null
  "first_name": "John",                 // string|null
  "last_name": "Doe",                   // string|null
  "company_name": "Example Inc.",       // string|null
  "company_domain": "example.com",      // string — read-only
  "phone": "+1234567890",               // string|null
  "website": "https://example.com",     // string|null
  "personalization": "Hello...",         // string|null
  "email_open_count": 0,                // number — read-only
  "email_reply_count": 0,               // number — read-only
  "email_click_count": 0,               // number — read-only
  "lt_interest_status": 1,              // number (see enum)
  "verification_status": 1,             // number — read-only (see enum)
  "enrichment_status": 1,               // number — read-only (see enum)
  "esp_code": 1,                        // number — read-only (see enum)
  "esg_code": 1,                        // number — read-only (see enum)
  "payload": {                           // object|null — read-only — custom variables
    "firstName": "John",                 // ⚠ camelCase dans payload !
    "lastName": "Doe",
    "companyName": "Example Inc.",
    "jobTitle": "Head of Growth",
    "linkedIn": "linkedin.com/in/...",
    "location": "Lyon, France",
    "companyDomain": "example.com"
  },
  "status_summary": {                   // object — read-only
    "lastStep": { "from": "campaign", "stepID": "uuid", "timestampExecuted": "..." },
    "domain_complete": true
  },
  "subsequence_id": "uuid",             // string|null — read-only
  "pl_value_lead": "High",              // string|null
  "assigned_to": "uuid",                // string|null
  "upload_method": "manual",            // string — read-only ("manual"|"api"|"website-visitor")
  // Timestamps de tracking — tous read-only, string|null
  "timestamp_last_contact": "...",
  "timestamp_last_open": "...",
  "timestamp_last_reply": "...",
  "timestamp_last_click": "...",
  "timestamp_last_interest_change": "...",
  "timestamp_last_touch": "...",
  "last_step_timestamp_executed": "..."
}
```

### 2.5 Lead List

```json
{
  "id": "uuid",                          // read-only
  "organization_id": "uuid",            // read-only
  "name": "My Lead List",               // required
  "timestamp_created": "2026-02-28T...", // read-only
  "has_enrichment_task": false,          // boolean|null — enrichissement auto sur ajout
  "owned_by": "uuid"                     // string|null
}
```

### 2.6 Campaign Subsequence

```json
{
  "id": "uuid",                          // read-only
  "timestamp_created": "...",            // read-only
  "parent_campaign": "uuid",            // required — ID de la campagne parente
  "workspace": "uuid",                  // read-only
  "status": 0,                          // number — read-only (memes enums que Campaign)
  "name": "Follow-up sequence",         // required
  "conditions": {                        // required — declencheurs
    "crm_status": [1],                   // Array<number> — statuts d'interet (0, 1, 2, 3, 4, -1, -2, -3, -4)
    "lead_activity": [4],                // Array<number> — (2=email_opened, 4=link_clicked, 91=campaign_completed_no_reply)
    "reply_contains": "yes"              // string — filtre sur contenu de reponse
  },
  "subsequence_schedule": { /* meme format que campaign_schedule */ },
  "sequences": [{ "steps": [/* meme format */] }]
}
```

### 2.7 Webhook

```json
{
  "id": "uuid",                          // read-only
  "organization": "uuid",               // read-only
  "target_hook_url": "https://...",      // required
  "name": "Zapier Positive Replies",     // string|null
  "campaign": "uuid",                   // string|null — null = toutes les campagnes
  "event_type": "email_sent",           // string|null — see enum below
  "custom_interest_value": 1,           // number|null — pour les events custom label
  "headers": { "Authorization": "..." }, // object|null
  "status": 1,                          // number|null — read-only (1=active, -1=error)
  "timestamp_created": "...",            // read-only
  "timestamp_error": "..."              // string|null — read-only
}
```

**Webhook event_type enum** : `"all_events"`, `"email_sent"`, `"email_opened"`, `"email_link_clicked"`, `"reply_received"`, `"email_bounced"`, `"lead_unsubscribed"`, `"campaign_completed"`, `"account_error"`, `"lead_neutral"`, +9 more

### 2.8 Custom Tag

```json
{
  "id": "uuid",                 // read-only
  "label": "Important",        // required
  "description": "...",        // string|null
  "organization_id": "uuid",  // read-only
  "timestamp_created": "...",  // read-only
  "timestamp_updated": "..."   // read-only
}
```

### 2.9 Block List Entry

```json
{
  "id": "uuid",                 // read-only
  "bl_value": "example.com",  // required — email ou domaine
  "is_domain": true,           // boolean — read-only
  "organization_id": "uuid",  // read-only
  "timestamp_created": "..."   // read-only
}
```

### 2.10 Lead Label

```json
{
  "id": "uuid",                          // read-only
  "label": "Hot Lead",                   // required
  "interest_status_label": "positive",   // required — "positive"|"negative"|"neutral"
  "interest_status": 1,                  // number — read-only (genere automatiquement)
  "description": "...",                  // string|null
  "use_with_ai": false,                 // boolean|null
  "created_by": "uuid",                 // read-only
  "organization_id": "uuid",            // read-only
  "timestamp_created": "..."            // read-only
}
```

### 2.11 Background Job

```json
{
  "id": "675266e304a8e55b17f0228b",
  "workspace_id": "uuid",
  "type": "move-leads",        // "move-leads"|"import-leads"|"export-leads"|"update-warmup-accounts"|"rename-variable"
  "progress": 0,               // number [0..100]
  "status": "pending",         // "pending"|"in-progress"|"success"|"failed"
  "entity_id": "uuid",
  "entity_type": "list",       // "list"|"campaign"|"workspace"
  "created_at": "...",
  "updated_at": "..."
}
```

### 2.12 Email Verification

```json
{
  "email": "example@example.com",        // required
  "verification_status": "pending",      // "pending"|"verified"|"invalid" — read-only
  "status": "success",                   // "success"|"error" — NE PAS utiliser pour verifier le resultat
  "catch_all": true,                     // boolean|string ("pending") — read-only
  "credits": 100,                        // number|null — read-only
  "credits_used": 1                      // number|null — read-only
}
```

### 2.13 SuperSearch Enrichment

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "resource_id": "uuid",
  "resource_type": 1,          // 1=Campaign, 2=List
  "limit": 100,
  "enrichment_payload": {},
  "auto_update": true,         // enrichissement auto sur nouveaux leads
  "skip_rows_without_email": true,
  "in_progress": true,
  "type": "email_verification" // see enum below
}
```

**Enrichment type enum** : `"work_email_enrichment"`, `"fully_enriched_profile"` (LinkedIn), `"email_verification"`, `"joblisting"`, `"technologies"`, `"news"`, `"funding"`, `"ai_enrichment"`, `"custom_flow"`

---

## 3. SuperSearch — Filtres & Parsing

### 3.1 Mapping noms internes → noms API

| Nom interne (code) | Nom API reel | Format API |
|---------------------|-------------|------------|
| `job_titles: string[]` | `title` | `{ include: string[] }` |
| `industries: string[]` | `industry` | `{ include: string[] }` |
| `sub_industries: string[]` | `subIndustry` | `{ include: string[] }` |
| `employee_count: string[]` | `employeeCount` | `string[]` |
| `keyword_filter: string` | `keyword_filter` | `{ include: string }` |
| `company_names: {...}` | `company_name` | `{ include: string[], exclude: string[] }` |
| `names: {include, exclude}` | `name` | `string[]` |
| `lookalike_domain: string` | `look_alike` | `string` |
| `location_filter_type: string` | `location_mode` | `"contact"` ou `"company"` |
| `department: string[]` | `department` | `string[]` (meme nom) |
| `level: string[]` | `level` | `string[]` (meme nom) |
| `revenue: string[]` | `revenue` | `string[]` (valeurs mappees, voir 3.3) |

### 3.2 Filtres sur la PERSONNE

| Champ interne | Champ API | Type API | Valeurs | Description |
|---------------|-----------|----------|---------|-------------|
| `job_titles` | `title` | `{ include: string[] }` | Texte libre | Titres de poste |
| `level` | `level` | `string[]` | `"C-Level"`, `"VP-Level"`, `"Director-Level"`, `"Manager-Level"`, `"Staff"`, `"Entry level"`, `"Mid-Senior level"`, `"Director"`, `"Associate"`, `"Owner"`, `"Executive"`, `"Manager"`, `"Senior"`, `"Chief X Officer (CxO)"`, `"Internship"`, `"Vice President (VP)"`, `"Unpaid / Internship"`, `"Partner"` | Seniority |
| `department` | `department` | `string[]` | `"Engineering"`, `"Finance & Administration"`, `"Human Resources"`, `"IT & IS"`, `"Marketing"`, `"Operations"`, `"Sales"`, `"Support"`, `"Other"` | Departement |
| `names` | `name` | `string[]` | Texte libre | Nom de contact |

### 3.3 Filtres sur l'ENTREPRISE

| Champ interne | Champ API | Type API | Valeurs |
|---------------|-----------|----------|---------|
| `industries` | `industry` | `{ include: string[] }` | ENUM stricte : `"Agriculture & Mining"`, `"Business Services"`, `"Computers & Electronics"`, `"Consumer Services"`, `"Education"`, `"Energy & Utilities"`, `"Financial Services"`, `"Government"`, `"Healthcare, Pharmaceuticals, & Biotech"`, `"Manufacturing"`, `"Media & Entertainment"`, `"Non-Profit"`, `"Other"`, `"Real Estate & Construction"`, `"Retail"`, `"Software & Internet"`, `"Telecommunications"`, `"Transportation & Storage"`, `"Travel, Recreation, and Leisure"`, `"Wholesale & Distribution"` |
| `employee_count` | `employeeCount` | `string[]` | `"0 - 25"`, `"25 - 100"`, `"100 - 250"`, `"250 - 1000"`, `"1K - 10K"`, `"10K - 50K"`, `"50K - 100K"`, `"> 100K"` |
| `revenue` | `revenue` | `string[]` | API: `"$0 - 1M"`, `"$1 - 10M"`, `"$10 - 50M"`, `"$50 - 100M"`, `"$100 - 250M"`, `"$250 - 500M"`, `"$500M - 1B"`, `"> $1B"` |
| `sub_industries` | `subIndustry` | `{ include: string[] }` | ENUM par industrie parente (voir 3.3b) |
| `funding_type` | `funding_type` | `string[]` | `"angel"`, `"seed"`, `"pre_seed"`, `"series_a"` a `"series_j"`, `"pre_series_a"` a `"pre_series_j"`, `"convertible_note"`, `"corporate_round"`, `"debt_financing"`, `"equity_crowdfunding"`, `"grant"`, `"initial_coin_offering"`, `"non_equity_assistance"`, `"post_ipo_debt"`, `"post_ipo_equity"`, `"post_ipo_secondary"`, `"private_equity"`, `"product_crowdfunding"`, `"secondary_market"`, `"undisclosed"` |
| `company_names` | `company_name` | `{ include: string[], exclude: string[] }` | Texte libre |

### 3.3b Enum subIndustry par industrie parente

| Industrie parente | subIndustry (valeurs exactes) |
|-------------------|-------------------------------|
| **Transportation & Storage** | `Airlines/Aviation`, `Logistics and Supply Chain`, `Maritime`, `Package/Freight Delivery`, `Packaging and Containers`, `Warehousing`, `Transportation/Trucking/Railroad` |
| **Manufacturing** | `Automotive`, `Aviation & Aerospace`, `Chemicals`, `Electrical/Electronic Manufacturing`, `Furniture`, `Industrial Automation`, `Machinery`, `Mechanical or Industrial Engineering`, `Plastics`, `Railroad Manufacture`, `Shipbuilding`, `Textiles` |
| **Business Services** | `Management Consulting`, `Marketing and Advertising`, `Staffing and Recruiting`, `Legal Services`, `Law Practice`, `Professional Training & Coaching`, `Human Resources`, `Design`, `Graphic Design`, `Events Services`, `Security and Investigations`, `Outsourcing/Offshoring`, `Import and Export`, `Information Services`, `Environmental Services`, `Public Relations and Communications`, `Translation and Localization`, `Writing and Editing`, `Fund-Raising`, `Market Research`, `Alternative Dispute Resolution`, `Program Development`, `Executive Office`, `Facilities Services`, `Business Supplies and Equipment`, `Think Tanks` |
| **Software & Internet** | `Computer & Network Security`, `Computer Software`, `Information Technology and Services`, `Internet` |
| **Healthcare** | `Biotechnology`, `Hospital & Health Care`, `Medical Devices`, `Medical Practice`, `Mental Health Care`, `Pharmaceuticals`, `Veterinary`, `Alternative Medicine`, `Health, Wellness and Fitness` |
| **Financial Services** | `Accounting`, `Banking`, `Capital Markets`, `Financial Services`, `Insurance`, `Investment Banking`, `Investment Management`, `Venture Capital & Private Equity` |
| **Energy & Utilities** | `Oil & Energy`, `Renewables & Environment`, `Utilities` |
| **Retail** | `Apparel & Fashion`, `Cosmetics`, `Luxury Goods & Jewelry`, `Retail`, `Supermarkets` |
| **Education** | `Education Management`, `E-Learning`, `Higher Education`, `Primary/Secondary Education`, `Research` |
| **Media & Entertainment** | `Broadcast Media`, `Media Production`, `Motion Pictures and Film`, `Music`, `Newspapers`, `Online Media`, `Printing`, `Publishing` |
| **Real Estate & Construction** | `Architecture & Planning`, `Building Materials`, `Civil Engineering`, `Commercial Real Estate`, `Construction`, `Glass, Ceramics & Concrete`, `Real Estate` |
| **Agriculture & Mining** | `Dairy`, `Farming`, `Fishery`, `Food & Beverages`, `Food Production`, `Mining & Metals`, `Paper & Forest Products`, `Ranching`, `Tobacco` |
| **Computers & Electronics** | `Computer Games`, `Computer Hardware`, `Computer Networking`, `Consumer Electronics`, `Semiconductors` |
| **Travel, Recreation, and Leisure** | `Entertainment`, `Fine Art`, `Gambling & Casinos`, `Hospitality`, `Leisure, Travel & Tourism`, `Performing Arts`, `Photography`, `Recreational Facilities and Services`, `Restaurants`, `Sporting Goods`, `Sports`, `Wine and Spirits` |
| **Government** | `Defense & Space`, `Government Administration`, `Government Relations`, `International Affairs`, `Judiciary`, `Law Enforcement`, `Legislative Office`, `Military`, `Museums and Institutions`, `Public Policy` |
| **Non-Profit** | `Civic & Social Organization`, `Libraries`, `Non-Profit Organization Management`, `Philanthropy`, `Political Organization`, `Religious Institutions` |
| **Consumer Services** | `Consumer Goods`, `Consumer Services`, `Individual & Family Services` |
| **Telecommunications** | `Telecommunications`, `Wireless` |
| **Wholesale & Distribution** | `Wholesale` |

### 3.4 Filtres GEOGRAPHIQUES

| Champ interne | Champ API | Type API | Description |
|---------------|-----------|----------|-------------|
| `locations` | `locations` | `[{place_id, label}]` ou `{ include: [...], exclude: [...] }` | `prepareFiltersForAPI()` resout les strings en objets |
| `location_filter_type` | `location_mode` | `string` | `"contact"` ou `"company"` (interne: `"company_hq"` → `"company"`) |

### 3.5 Filtres AVANCES

| Champ interne | Champ API | Type API | Valeurs | Description |
|---------------|-----------|----------|---------|-------------|
| `keyword_filter` | `keyword_filter` | `{ include: string }` | Texte libre | Mot-cle general |
| `technologies` | `technologies` | `string[]` | Texte libre | Stack techno |
| `lookalike_domain` | `look_alike` | `string` | Domaine | Entreprises similaires |
| `news` | `news` | `string[]` | 28 valeurs ENUM (voir ci-dessous) | Actualites |
| `job_listing` | `job_listing` | `string` | Texte libre | Offres d'emploi actives |

**News enum** : `"has_had_recent_funding"`, `"has_had_recent_acquisition_or_merger"`, `"has_had_recent_job_change"`, `"has_had_recent_technology_change"`, `"has_had_recent_leadership_change"`, `"has_had_recent_layoffs"`, `"has_upcoming_contract_renewal"`, `"has_had_recent_new_partnerships"`, `"has_had_recent_award"`, `"has_had_product_launch"`, `"has_had_recent_expansion"`, `"has_had_recent_earnings_report"`, `"has_had_recent_data_breach_security_event"`, `"has_had_recent_regulatory_change"`, `"has_had_recent_customer_win_or_significant_deal"`, `"has_filed_recent_patent"`, `"has_had_recent_cost_cutting"`, `"has_had_recent_rebranding"`, `"has_had_ipo"`, `"has_entered_new_market_or_geography"`, `"has_had_recent_restructuring"`, `"has_had_recent_sustainability_csr_initiative"`, `"has_had_recent_legal_issue_or_controversy"`, `"has_had_recent_management_change"`, `"has_active_job_listings"`, `"has_had_ieo"`, `"has_had_recent_investment"`, `"has_had_recent_dividend_announcement"`

### 3.6 Options de DEDUPLICATION

| Champ | Type | Default | Description |
|-------|------|---------|-------------|
| `skip_owned_leads` | `boolean` | `true` | Exclure les leads deja dans Instantly. **TOUJOURS true** |
| `show_one_lead_per_company` | `boolean` | `false` | Un seul lead par entreprise |

### 3.7 enrichment_payload (pour enrich-leads)

Dans le body de `enrich-leads-from-supersearch`, **PAS dans search_filters** :

| Champ | Type | Default | Description |
|-------|------|---------|-------------|
| `work_email_enrichment` | `boolean` | `true` | Email pro verifie |
| `fully_enriched_profile` | `boolean` | `false` | Profil complet (LinkedIn, phone) |
| `email_verification` | `boolean` | `false` | Verification email supplementaire |
| `joblisting` | `boolean` | `false` | Offres d'emploi |
| `technologies` | `boolean` | `false` | Stack techno |
| `news` | `boolean` | `false` | Actualites |
| `funding` | `boolean` | `false` | Donnees de financement |

### 3.8 Reponses SuperSearch

#### count-leads
```json
{ "number_of_leads": 2400 }
```
Note : si > 1_000_000, retourne `1000000`.

#### preview-leads (ATTENTION: camelCase!)
```json
{
  "number_of_leads": 637,
  "number_of_redacted_results": 205,
  "leads": [{
    "firstName": "Wajdi",
    "lastName": "Fathallah",
    "fullName": "Wajdi Fathallah",
    "jobTitle": "Chief Technology Officer & Co-Founder",
    "location": "Paris, Ile-de-France, France",
    "linkedIn": "linkedin.com/in/wajdi-fathallah-18045253",
    "companyName": "Sifflet",
    "companyLogo": "https://...",
    "companyId": "71807766"
  }]
}
```
**Champs absents** du preview : `email`, `phone`, `website`, `company_size`, `industry`.

#### leads/list (leads stockes — format mixte!)
```json
{
  "items": [{
    "id": "uuid",
    "email": "erwan@lemlist.com",
    "first_name": "Erwan",
    "last_name": "Gauthier",
    "company_name": "Lemlist",
    "company_domain": "lemlist.com",
    "status": 0,
    "verification_status": 1,
    "esp_code": 1,
    "payload": {
      "firstName": "Erwan",
      "lastName": "Gauthier",
      "jobTitle": "Head of Growth",
      "linkedIn": "linkedin.com/in/erwanxgrowth",
      "location": "Lyon, Auvergne-Rhone-Alpes, France"
    }
  }],
  "next_starting_after": "uuid"
}
```
**Top-level = snake_case, payload = camelCase.** Utiliser `normalizePreviewLead()` / `normalizeStoredLead()`.

#### enrich-leads (sourcing)
```json
{ "id": "uuid", "resource_id": "uuid" }
```
Puis poll `GET /supersearch-enrichment/{resourceId}` → `{ "resource_id": "uuid", "in_progress": false, "exists": true }`

### 3.9 Regles de parsing ICP → search_filters

| L'utilisateur dit... | Filtre a utiliser |
|----------------------|-------------------|
| "CTO", "directeur technique" | `job_titles: ["CTO", "Chief Technology Officer"]` + `department: ["Engineering"]` |
| "VP Sales" | `job_titles: ["Vice President of Sales"]` + `department: ["Sales"]` |
| "C-level", "dirigeants" | `job_titles: ["CEO", "CTO", "CFO", "COO", "CMO"]` |
| "SaaS", "logiciel" | `industries: ["Software & Internet"]` |
| "France" | `locations: ["France"]` |
| "50-200 employes" | `employee_count: ["25 - 100", "100 - 250"]` |
| "startup" | `employee_count: ["0 - 25"]` |
| "PME" | `employee_count: ["25 - 100", "100 - 250"]` |
| "ETI", "mid-market" | `employee_count: ["250 - 1000", "1K - 10K"]` |
| "grande entreprise" | `employee_count: ["10K - 50K", "50K - 100K", "> 100K"]` |
| "CA > 10M" | `revenue: ["$10M - 50M", "$50M - 100M", "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"]` |
| "qui a leve en seed" | `funding_type: ["seed"]` |
| "qui utilise Salesforce" | `technologies: ["Salesforce"]` |
| "entreprises comme Stripe" | `lookalike_domain: "stripe.com"` |
| "qui recrutent un dev" | `job_listing: "developer"` |

**Regles** :
1. TOUJOURS `skip_owned_leads: true`
2. Pour les job titles, ajouter les variantes : CTO → `["CTO", "Chief Technology Officer"]`
3. Combiner `department` + `job_titles` pour le meilleur ciblage
4. `employee_count`, `revenue`, `industries`, `department` sont des enums strictes
5. `technologies`, `job_listing` sont du texte libre

---

## 4. Enums de statut

### 4.1 Lead status

| Valeur | Description |
|--------|-------------|
| `1` | Active |
| `2` | Paused |
| `3` | Completed |
| `-1` | Bounced |
| `-2` | Unsubscribed |
| `-3` | Skipped |

### 4.2 Lead interest status (`lt_interest_status`)

| Valeur | Description |
|--------|-------------|
| `0` | Out of Office |
| `1` | Interested |
| `2` | Meeting Booked |
| `3` | Meeting Completed |
| `4` | Won |
| `-1` | Not Interested |
| `-2` | Wrong Person |
| `-3` | Lost |
| `-4` | No Show |

### 4.3 Campaign status

| Valeur | Description |
|--------|-------------|
| `0` | Draft |
| `1` | Active |
| `2` | Paused |
| `3` | Completed |
| `4` | Running Subsequences |
| `-1` | Accounts Unhealthy |
| `-2` | Bounce Protect |
| `-99` | Account Suspended |

### 4.4 Campaign not_sending_status

| Valeur | Description |
|--------|-------------|
| `1` | Hors du schedule d'envoi |
| `2` | En attente d'un lead a traiter |
| `3` | Limite quotidienne atteinte |
| `4` | Tous les comptes d'envoi ont atteint leur limite |
| `99` | Erreur — contacter le support |

### 4.5 Verification status

| Valeur | Description |
|--------|-------------|
| `1` | Verified |
| `11` | Pending |
| `12` | Pending Verification Job |
| `-1` | Invalid |
| `-2` | Risky |
| `-3` | Catch All |
| `-4` | Job Change |

### 4.6 Account status

| Valeur | Description |
|--------|-------------|
| `1` | Active |
| `2` | Paused |
| `3` | Temporarily paused (maintenance, auto-resume) |
| `-1` | Connection Error |
| `-2` | Soft Bounce Error |
| `-3` | Sending Error |

### 4.7 Account warmup_status

| Valeur | Description |
|--------|-------------|
| `0` | Paused |
| `1` | Active |
| `-1` | Banned |
| `-2` | Spam Folder Unknown |
| `-3` | Permanent Suspension |

### 4.8 Account provider_code

| Valeur | Description |
|--------|-------------|
| `1` | Custom IMAP/SMTP |
| `2` | Google |
| `3` | Microsoft |
| `4` | AWS |
| `8` | AirMail |

### 4.9 Email ue_type

| Valeur | Description |
|--------|-------------|
| `1` | Sent from campaign |
| `2` | Received (reply) |
| `3` | Sent (manual) |
| `4` | Scheduled |

### 4.10 Lead enrichment_status

| Valeur | Description |
|--------|-------------|
| `1` | Enriched |
| `11` | Pending |
| `-1` | Enrichment data not available |
| `-2` | Error |

### 4.11 Lead esp_code (Email Service Provider du lead)

| Valeur | Description |
|--------|-------------|
| `0` | In Queue |
| `1` | Google |
| `2` | Microsoft |
| `3` | Zoho |
| `8` | AirMail |
| `9` | Yahoo |
| `10` | Yandex |
| `12` | Web.de |
| `13` | Libero.it |
| `999` | Other |

### 4.12 Audit log activity_type

| Valeur | Description |
|--------|-------------|
| `1` | User login |
| `2` | Lead deletion |
| `3` | Campaign deletion |
| `4` | Campaign launch |
| `5` | Campaign pause |
| `6` | Account addition |
| `7` | Account deletion |
| `8` | Lead moved |
| `9` | Lead added |
| `10` | Lead merged |
| +6 more | ... |

---

## 5. Gotchas & Notes critiques

### 5.1 `level` filter est CASSE
`"VP-Level"` / `"C-Level"` retournent 0 resultats. `"Director"` / `"Manager"` retournent 1M+ (inutilisable).
**SOLUTION** : NE JAMAIS envoyer `level` a l'API. Utiliser `title: { include: [...] }` a la place.
`prepareFiltersForAPI()` auto-convertit via `LEVEL_TITLE_MAP`.

### 5.2 Preview vs Stored leads — casing different
- **Preview** : **camelCase** (`firstName`, `jobTitle`, `companyName`)
- **Leads stockes** : **snake_case** top-level + **camelCase** dans `payload`
- Utiliser `normalizePreviewLead()` / `normalizeStoredLead()` de `instantly.ts`

### 5.3 Timezone enum restreinte
`Europe/Paris` **N'EXISTE PAS** dans l'enum Instantly.

| Zone | Timezone Instantly valide |
|------|--------------------------|
| CET (Paris, Berlin) | `Europe/Sarajevo` ou `Europe/Belgrade` |
| EET (Helsinki) | `Europe/Helsinki` ou `Europe/Bucharest` |
| EST (New York) | `America/New_York` (a tester) |
| CST (Chicago) | `America/Chicago` |
| AST (Anchorage) | `America/Anchorage` |
| GMT+0 (Casablanca) | `Africa/Casablanca` |
| GMT+4 (Dubai) | `Asia/Dubai` |
| GMT+5:30 (Kolkata) | `Asia/Kolkata` |
| BRT (Sao Paulo) | `America/Sao_Paulo` |
| NZST (Auckland) | `Pacific/Auckland` |

### 5.4 campaign_schedule est OBLIGATOIRE
Impossible de creer une campagne sans `campaign_schedule`.

### 5.5 Steps delay_unit et pre_delay_unit
Chaque step necessite `delay_unit` (defaut `"days"`). Pour les subsequences, `pre_delay` + `pre_delay_unit` aussi.

### 5.6 sequences — un seul element
`sequences` est un array mais **seul le premier element est utilise**. Mettre les steps dedans.

### 5.7 enrichment_payload au top-level
L'endpoint `enrich-leads-from-supersearch` **EXIGE** au moins un enrichissement actif au top-level du body (pas dans un objet `enrichment_payload`). Notre code envoie `work_email_enrichment: true`.

### 5.8 SSL sur Windows
Utiliser `--ssl-no-revoke` avec curl sur Windows.

### 5.9 Pagination
La plupart des endpoints de listing utilisent `limit` + `starting_after` (cursor-based).
`leads/list` retourne `next_starting_after` dans la reponse.

---

## 6. Statut d'implementation LeadSens

### Endpoints implementes

| Endpoint | Fonction | Status |
|----------|----------|--------|
| `POST /supersearch-enrichment/count-leads-from-supersearch` | `countLeads` | ✅ |
| `POST /supersearch-enrichment/preview-leads-from-supersearch` | `previewLeads` | ✅ |
| `POST /supersearch-enrichment/enrich-leads-from-supersearch` | `sourceLeads` | ✅ |
| `GET /supersearch-enrichment/{resource_id}` | `getEnrichmentStatus` | ✅ |
| `POST /leads` | `createLead` | ✅ |
| `POST /leads/list` | `listLeads` | ✅ |
| `GET /leads/{id}` | `getLead` | ✅ |
| `PATCH /leads/{id}` | `updateLead` | ✅ |
| `DELETE /leads/{id}` | `deleteLead` | ✅ |
| `DELETE /leads` (bulk) | `deleteLeadsBulk` | ✅ |
| `POST /leads/add` | `addLeadsToCampaign` | ✅ |
| `POST /leads/move` | `moveLeads` | ✅ |
| `POST /leads/update-interest-status` | `updateLeadInterestStatus` | ✅ |
| `POST /campaigns` | `createCampaign` | ✅ |
| `GET /campaigns` | `listCampaigns` | ✅ |
| `GET /campaigns/{id}` | `getCampaign` | ✅ |
| `PATCH /campaigns/{id}` | `updateCampaign` | ✅ |
| `DELETE /campaigns/{id}` | `deleteCampaign` | ✅ |
| `POST /campaigns/{id}/activate` | `activateCampaign` | ✅ |
| `GET /accounts` | `listAccounts` | ✅ |

### Filtres SuperSearch — tous implementes ✅

`job_titles`, `industries`, `sub_industries`, `employee_count`, `revenue`, `department`, `level` (auto-convert), `funding_type`, `technologies`, `lookalike_domain`, `job_listing`, `keyword_filter`, `company_names`, `names`, `locations`, `location_filter_type`, `news`, `enrichment_payload`, `skip_owned_leads`, `show_one_lead_per_company`

### Endpoints a implementer (priorite)

| Endpoint | Priorite | Usage LeadSens |
|----------|----------|----------------|
| `GET /emails` | P1 | Unibox — lire les reponses |
| `GET /emails/{id}` | P1 | Detail d'un email |
| `POST /emails/reply` | P1 | Repondre depuis LeadSens |
| `GET /campaigns/analytics` | P2 | Dashboard analytics |
| `GET /campaigns/analytics/steps` | P2 | Performance par step |
| `POST /webhooks` | P2 | Notifications temps reel (reply, bounce, etc.) |
| `POST /lead-lists` | P3 | Creer des listes pour organiser les leads |
| `POST /subsequences` | P3 | Suivis conditionnels |
| `POST /block-lists-entries` | P3 | Blocklist de domaines |
| `POST /email-verification` | P3 | Verification email individuelle |
