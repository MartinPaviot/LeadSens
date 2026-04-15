# Spec — Social Content Writer (SCW-16)

> Agent unifié de création de contenu social media — captions courtes + posts long-form + cross-platform.
> Référence mapping : `agent_mapping_SCW_merged.md`

---

## 1. Requirements

### REQ-SCW-001: Onboarding voix de marque

**User Story :** En tant que Content Manager, je veux configurer ma voix de marque une seule fois pour que toutes les générations futures respectent mon ton et mon style sans reconfiguration.

**Critères d'acceptation :**
- Le client peut définir : style, registre, mots interdits, formules clés, positionnement (thought-leader / brand-expert / personal-brand / corporate)
- Le client peut configurer des préférences par plateforme (longueur préférée, ton spécifique, nombre de hashtags, type de CTA)
- Le client peut importer des posts existants pour calibration du modèle
- Le profil est persisté en base (table `ElevayBrandProfile` ou champ dédié) et chargé automatiquement à chaque session
- L'agent génère 3 exemples de réponses types pour validation avant activation
- Le client peut modifier son profil à tout moment via les Settings (onglet Content & Voice existant)

### REQ-SCW-002: Brief par post

**User Story :** En tant que Content Manager, je veux donner un brief rapide dans le chat pour obtenir des variations de contenu optimisées sans remplir un formulaire complexe.

**Critères d'acceptation :**
- Le brief est collecté via conversation dans le chat (pas un formulaire)
- L'agent détecte ou demande : format (caption / long-form / thread / article / reddit-ama), plateformes cibles, objectif, contenu source, ton, CTA, hashtags/mentions
- Si le format n'est pas précisé, l'agent le demande avec des options claires
- Le brief est validé par Zod côté serveur avant traitement
- Le brief est stocké dans le message history de la conversation

### REQ-SCW-003: Génération unifiée short + long

**User Story :** En tant que Content Manager, je veux générer du contenu pour n'importe quel format (caption ou long-form) depuis le même agent pour ne pas jongler entre deux outils.

**Critères d'acceptation :**
- L'agent génère 1–3 variations par plateforme sélectionnée
- Le format est adapté automatiquement à la plateforme via la matrice de compatibilité (ex : Reddit → toujours discussion/AMA, Instagram → toujours caption)
- Chaque variation respecte les limites de caractères de la plateforme
- Les hashtags sont intégrés organiquement selon les best practices par réseau
- Les threads X sont générés avec hooks de transition entre tweets
- Les posts Reddit utilisent un ton communautaire avec titre ultra-spécifique
- La génération se fait en SSE streaming pour un feedback progressif dans le chat
- Le ton de marque global est respecté sur toutes les variations

### REQ-SCW-004: Module cross-platform

**User Story :** En tant que Content Strategist, je veux transformer un post source en versions adaptées pour tous mes réseaux en un clic pour gagner du temps et maintenir la cohérence.

**Critères d'acceptation :**
- Le mode cross-platform est activé explicitement par le client dans le chat
- Le client peut fournir un post source ou laisser l'agent en générer un
- L'agent produit simultanément des versions pour toutes les plateformes sélectionnées
- Chaque version respecte le ton, la structure et le CTA de la plateforme cible
- Des suggestions de médias sont incluses pour chaque version
- Toutes les versions sont générées en un seul appel batch (optimisation coûts)
- Le client peut demander un ajustement spécifique sur une seule version sans régénérer les autres

### REQ-SCW-005: Enrichissement BuzzSumo & tendances

**User Story :** En tant que Content Manager, je veux que mes posts soient enrichis avec les tendances actuelles pour maximiser leur visibilité et engagement.

**Critères d'acceptation :**
- L'agent interroge BuzzSumo pour les hashtags performants sur la thématique du brief
- Les résultats BuzzSumo sont cachés 7 jours pour éviter les appels répétitifs
- L'agent analyse les hooks et structures de descriptions performantes des concurrents
- Les hashtags proposés sont pertinents pour chaque plateforme (pas les mêmes partout)
- Si BuzzSumo est indisponible, l'agent génère quand même avec ses connaissances (dégradé gracieux)

### REQ-SCW-006: Export & injection planificateur

**User Story :** En tant que Content Manager, je veux exporter mes contenus validés directement vers mon outil de planification pour éviter le copier-coller.

**Critères d'acceptation :**
- Export CSV avec colonnes : plateforme, variation, contenu, hashtags, CTA, caractères
- Export Google Sheets (création ou mise à jour d'un spreadsheet existant)
- Injection directe dans Hootsuite, Buffer ou Loomly si le client a connecté l'outil (BYOT)
- Rapport synthétique en fin de session : nombre de posts, variations retenues, hashtags
- Le client peut régénérer une variation spécifique sans relancer tout l'export

### REQ-SCW-007: Mode batch

**User Story :** En tant que Community Manager, je veux soumettre plusieurs posts en une session pour les traiter en lot et gagner du temps.

**Critères d'acceptation :**
- Le client peut soumettre N posts dans une même session de chat
- Les hashtags extraits pour le premier post sont réutilisés pour les suivants si le sujet est similaire
- Les appels LLM sont groupés en batch pour réduire les coûts
- L'agent détecte les doublons de sujet avant de régénérer
- La validation se fait post par post, puis export groupé en fin de session

---

## 2. Design

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chat Interface                        │
│  (assistant-ui — conversation SSE streaming)             │
└──────────────────────┬──────────────────────────────────┘
                       │ POST /api/agents/social-content-writer/chat
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Route Handler (SSE)                         │
│  Auth + workspaceId → BriefParser → Orchestrator        │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌────────────┐ ┌──────────┐ ┌───────────────┐
   │ Analyzer   │ │Generator │ │CrossPlatform  │
   │ (BuzzSumo) │ │(Claude)  │ │(Claude batch) │
   └────────────┘ └──────────┘ └───────────────┘
          │            │            │
          └────────────┼────────────┘
                       ▼
              ┌─────────────────┐
              │   Exporter      │
              │ CSV/Sheets/     │
              │ Hootsuite/Buffer│
              └─────────────────┘
```

### 2.2 Structure fichiers

```
src/agents/social-content-writer/
├── core/
│   ├── types.ts                 ← BrandVoiceProfile, ContentBrief, GeneratedVariation, etc.
│   ├── constants.ts             ← PLATFORM_CONFIGS (limites, tons, hashtags defaults)
│   └── prompts.ts               ← System prompts par format (caption, long-form, thread, reddit, cross)
├── modules/
│   ├── onboarding.ts            ← Calibration voix de marque
│   ├── brief-parser.ts          ← Parse message client → ContentBrief (Zod validation)
│   ├── analyzer.ts              ← BuzzSumo enrichissement + cache 7j
│   ├── generator.ts             ← Génération unifiée (resolveFormat + callLLM)
│   ├── cross-platform.ts        ← Post source → N versions (batch)
│   └── exporter.ts              ← CSV, Sheets, Hootsuite, Buffer, Loomly
├── utils/
│   ├── hashtag-cache.ts         ← Cache Redis/mémoire hashtags 7j
│   ├── character-limits.ts      ← Validation + troncature intelligente
│   └── batch.ts                 ← Groupement multi-posts
└── index.ts                     ← Orchestrateur principal
```

### 2.3 Routes API

| Route | Méthode | Description | Auth |
|---|---|---|---|
| `/api/agents/social-content-writer/chat` | POST (SSE) | Conversation brief + génération streaming | Requise |
| `/api/agents/social-content-writer/generate` | POST | Génération directe (brief structuré) | Requise |
| `/api/agents/social-content-writer/cross-platform` | POST | Mode cross-platform batch | Requise |
| `/api/agents/social-content-writer/export` | POST | Export CSV/Sheets/injection | Requise |
| `/api/agents/social-content-writer/brand-voice` | GET/POST | CRUD profil voix de marque | Requise |

### 2.4 Modèles de données

Réutilise `ElevayBrandProfile` existant, étendu avec les champs voix de marque :

```typescript
// Extension du schéma Prisma existant (ou champ JSON dans ElevayBrandProfile)
interface BrandVoiceConfig {
  style: string;
  register: string;
  forbiddenWords: string[];
  keyPhrases: string[];
  positioning: 'thought-leader' | 'brand-expert' | 'personal-brand' | 'corporate';
  platformOverrides?: Record<string, {
    preferredLength?: number;
    tone?: string;
    hashtagCount?: number;
    ctaType?: string;
  }>;
  examplePosts?: string[];
  calibratedAt?: string;
}
```

Les runs de l'agent sont stockés dans `ElevayAgentRun` avec `agentCode = 'SCW-16'`.

### 2.5 UI/UX

**Split-pane "Content Studio" :**
- **Gauche :** Chat conversationnel pour le brief (assistant-ui existant)
- **Droite :** Preview cards simulant le rendu natif de chaque plateforme
  - Chaque card a un compteur de caractères live
  - Hashtags en pills cliquables
  - Boutons "Copier" / "Régénérer" / "Injecter"
  - Badge format (Caption / Long-form / Thread)
- **Bottom drawer :** Export batch (CSV / Sheets / planificateur)

---

## 3. Tasks

### TASK-SCW-001: Scaffolding agent

**Description :** Créer la structure de fichiers et les types de base de l'agent SCW-16.

**Étapes :**
1. Créer le dossier `src/agents/social-content-writer/` avec la structure définie en 2.2
2. Définir tous les types dans `core/types.ts` (Platform, ContentFormat, PostObjective, BrandVoiceProfile, ContentBrief, GeneratedVariation, ThreadTweet, GenerationOutput)
3. Définir les constantes dans `core/constants.ts` : PLATFORM_CONFIGS avec limites de caractères, nombre de hashtags par défaut, ton dominant, CTA prioritaire pour chaque plateforme
4. Créer les fichiers modules vides avec exports
5. Créer le fichier `index.ts` avec la fonction orchestrateur squelette

**Dépendances :** Aucune
**Vérifie :** `pnpm --filter @leadsens/elevay typecheck` passe

### TASK-SCW-002: Brief parser + validation Zod

**Description :** Implémenter le parsing du brief client depuis un message conversationnel vers un objet ContentBrief validé.

**Étapes :**
1. Créer le schéma Zod `ContentBriefSchema` dans `brief-parser.ts`
2. Implémenter la logique de détection de format depuis le message (mots-clés : "caption", "post long", "thread", "article", etc.)
3. Implémenter la détection des plateformes depuis le message
4. Implémenter `resolveFormat(format, platform)` — la matrice de compatibilité format × plateforme
5. Écrire les tests unitaires pour les cas limites (format incompatible, plateforme non reconnue, brief incomplet)

**Dépendances :** TASK-SCW-001
**Vérifie :** Tests passent, types valides

### TASK-SCW-003: System prompts

**Description :** Rédiger les system prompts pour chaque format de génération.

**Étapes :**
1. Prompt `caption` : instructions pour captions courtes par plateforme (ton, structure, limites)
2. Prompt `long-form` : instructions pour posts longs LinkedIn, Facebook
3. Prompt `thread` : instructions pour threads X (hooks de transition, numérotation, CTA par tweet)
4. Prompt `reddit-ama` : instructions pour posts Reddit (ton communautaire, titre spécifique, honnêteté radicale)
5. Prompt `cross-platform` : instructions pour adapter un post source vers N formats
6. Prompt `onboarding` : instructions pour la calibration de la voix de marque
7. Chaque prompt intègre dynamiquement le BrandVoiceProfile du client

**Dépendances :** TASK-SCW-001
**Vérifie :** Prompts testés manuellement avec Claude, outputs cohérents

### TASK-SCW-004: Générateur unifié

**Description :** Implémenter le module de génération qui route vers le bon format et appelle Claude.

**Étapes :**
1. Implémenter `generator.ts` avec la fonction `generate(brief, voice)` 
2. Intégrer `resolveFormat()` pour le routing automatique
3. Appeler `callLLM()` depuis `@/agents/_shared/llm.ts` avec le prompt approprié
4. Parser la réponse LLM en `GeneratedVariation[]`
5. Valider les limites de caractères post-génération et tronquer intelligemment si dépassement
6. Pour les threads X : parser en `ThreadTweet[]` avec index et hooks
7. Implémenter le mode batch (plusieurs posts → appels groupés)

**Dépendances :** TASK-SCW-002, TASK-SCW-003
**Vérifie :** Génération d'une caption Instagram, d'un post LinkedIn long-form et d'un thread X à partir du même brief

### TASK-SCW-005: Module cross-platform

**Description :** Implémenter la transformation d'un post source vers N versions adaptées.

**Étapes :**
1. Implémenter `cross-platform.ts` avec la fonction `transform(source, platforms, voice)`
2. Construire un prompt batch qui produit toutes les versions en un seul appel LLM
3. Parser la réponse en variations par plateforme
4. Ajouter les suggestions de médias par version
5. Permettre la régénération d'une seule version sans relancer tout le batch

**Dépendances :** TASK-SCW-004
**Vérifie :** Un post source texte → versions LinkedIn + X thread + Reddit + Instagram générées en un appel

### TASK-SCW-006: Route API chat SSE

**Description :** Créer la route API principale avec streaming SSE.

**Étapes :**
1. Créer `src/app/api/agents/social-content-writer/chat/route.ts`
2. Implémenter le pattern auth + workspaceId (comme les routes existantes)
3. Intégrer le brief-parser pour extraire le brief du message
4. Charger le BrandVoiceProfile depuis la DB
5. Appeler l'orchestrateur et streamer la réponse en SSE
6. Sauvegarder le run dans `ElevayAgentRun` avec `agentCode = 'SCW-16'`

**Dépendances :** TASK-SCW-004, TASK-SCW-005
**Vérifie :** Appel POST avec un message texte → réponse SSE avec variations générées

### TASK-SCW-007: Analyzer BuzzSumo + cache

**Description :** Implémenter l'enrichissement BuzzSumo avec cache 7 jours.

**Étapes :**
1. Implémenter `analyzer.ts` avec appel API BuzzSumo (via Composio ou direct)
2. Implémenter `hashtag-cache.ts` — cache mémoire ou Redis avec TTL 7 jours
3. Retourner hashtags performants + insights benchmark
4. Dégradé gracieux : si BuzzSumo indisponible, retourner un résultat vide sans erreur
5. Intégrer dans l'orchestrateur entre le brief-parsing et la génération

**Dépendances :** TASK-SCW-004
**Vérifie :** Enrichissement fonctionne avec et sans BuzzSumo disponible

### TASK-SCW-008: Exporter (CSV, Sheets, injection)

**Description :** Implémenter les exports vers CSV, Google Sheets, Hootsuite, Buffer, Loomly.

**Étapes :**
1. Créer `exporter.ts` avec méthode `exportToCSV(output)` → fichier CSV downloadable
2. Implémenter `exportToSheets(output)` via Google Sheets API (Composio)
3. Implémenter `injectToHootsuite(output)` / `injectToBuffer(output)` / `injectToLoomly(output)` via APIs respectives
4. Créer la route `/api/agents/social-content-writer/export`
5. Le client choisit le format d'export dans le chat → l'agent exécute

**Dépendances :** TASK-SCW-006
**Vérifie :** Export CSV downloadable, injection Hootsuite si connecté

### TASK-SCW-009: UI Content Studio

**Description :** Créer l'interface split-pane pour la génération de contenu.

**Étapes :**
1. Créer la page `src/app/(dashboard)/content-writer/page.tsx`
2. Implémenter le layout split-pane : chat à gauche (assistant-ui), preview cards à droite
3. Créer le composant `PlatformPreviewCard` avec rendu natif simulé par plateforme
4. Ajouter compteur de caractères live, hashtags en pills, boutons Copier/Régénérer
5. Créer le composant `ThreadPreview` pour les threads X (cards empilées numérotées)
6. Implémenter le drawer Export en bas
7. Ajouter l'entrée dans la sidebar navigation
8. Respecter la charte Elevay : teal, orange, cream background, gradient buttons

**Dépendances :** TASK-SCW-006
**Vérifie :** Page accessible, chat fonctionnel, preview cards s'affichent au fur et à mesure du streaming

### TASK-SCW-010: Brand voice settings

**Description :** Intégrer la configuration voix de marque dans les Settings existants.

**Étapes :**
1. Étendre l'onglet "Content & Voice" des Settings avec les champs BrandVoiceConfig
2. Créer la route `/api/agents/social-content-writer/brand-voice` (GET/POST)
3. Persister dans `ElevayBrandProfile` (champ JSON `voiceConfig`)
4. Charger automatiquement le profil au démarrage de chaque session agent
5. Permettre la modification via le chat ("change mon ton pour plus informel")

**Dépendances :** TASK-SCW-001
**Vérifie :** Profil sauvegardé et rechargé entre sessions
