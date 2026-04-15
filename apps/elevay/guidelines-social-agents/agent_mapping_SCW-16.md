# Agent Mapping — Social Content Writer (SCW-16)

> Fusion de l'Agent SPW-16 (Social Post Description Writer) et LFW-17 (Long-Form Social Post Writer) en un agent unifié.

---

## 1. Identité de l'agent

| Champ | Valeur |
|-------|--------|
| **Nom** | Social Content Writer |
| **Code interne** | `AGT-MKT-SCW-16` |
| **Version** | 1.0 — Périmètre V1 |
| **Positionnement** | Rédacteur Social Media autonome — captions courtes ET posts long-form |
| **Catégorie** | Agent Marketing — Création de Contenu |
| **Nature** | Agent de production — génère du contenu à la demande |
| **Périmètre** | 8 plateformes : Instagram, Facebook, TikTok, LinkedIn, Pinterest, Threads, YouTube, X |
| **Formats** | Captions courtes (50–500 mots) + Posts long-form (300–3000 mots) + Threads X + Articles LinkedIn Pulse + Posts Reddit/AMA |
| **Module clé** | Cross-platform : transformation automatique d'un post source vers N réseaux |
| **Output** | 1–3 variations par plateforme + hashtags + CTA + version cross-platform |
| **Export** | CSV, Google Sheets, injection directe Hootsuite / Buffer / Loomly |
| **Relation** | Complémentaire Agent 19 (SMC) — Agent 16 rédige, Agent 19 planifie et publie |
| **Utilisateur type** | Community Manager, Content Strategist, CMO, fondateur, expert sectoriel |
| **Complexité** | Moyenne — génération de contenu guidée par brief + logique cross-platform |
| **Statut** | Actif — Production V1 |

### Pourquoi la fusion

L'ancien Agent 16 (captions courtes) et l'ancien Agent 17 (long-form) partageaient :

- Le même onboarding voix de marque
- Les mêmes intégrations (BuzzSumo, Hootsuite, Buffer, Google Sheets, Composio)
- La même logique d'export et de validation
- Le même cache hashtags et profil marque

La seule différence était la longueur du contenu généré. Fusionner évite de maintenir deux codebases quasi identiques et offre une expérience utilisateur unifiée : le client choisit le **format** dans son brief, pas un agent différent.

---

## 2. Problème résolu

**🔴 Sans l'agent :**
Rédiger des posts engageants pour chaque réseau est fastidieux. Adapter le ton, intégrer les hashtags, respecter les limites de caractères, maintenir la cohérence de marque sur 8 plateformes, reformater un même message pour N réseaux sans perdre l'impact — trop de variables pour une gestion manuelle efficace. Les posts long-form (threads X, articles LinkedIn, posts Reddit) demandent encore plus d'expertise car chaque plateforme a ses propres conventions éditoriales.

**✅ Avec l'agent :**
Un seul agent génère du contenu optimisé pour toutes les plateformes et tous les formats : captions courtes, posts longs, threads X, articles LinkedIn Pulse, posts Reddit/AMA. Le module cross-platform transforme automatiquement un post source en versions adaptées pour chaque réseau. Le client valide, ajuste et exporte directement vers ses outils de planification.

### Relation avec l'Agent 19 — Social Media Campaign Manager

| Agent 16 — Social Content Writer | Agent 19 — Social Media Campaign Manager |
|---|---|
| Rédige les descriptions et posts optimisés | Reçoit les contenus validés |
| Adapte le ton par plateforme et par format | Planifie les envois au moment optimal |
| Intègre hashtags, CTA, mots-clés | Publie automatiquement via les APIs |
| Propose 1–3 variations par plateforme | Suit les KPIs et le taux d'engagement |
| Exporte le contenu prêt à planifier | Ajuste le calendrier selon les performances |

---

## 3. Modules fonctionnels

### Module 1 — Onboarding & voix de marque

Cadrage initial — conservé pour toutes les sessions suivantes.

- Définition de la voix de marque : style, registre, mots interdits, formules clés
- Configuration par plateforme : préférences de longueur, structure, ton spécifique
- Import optionnel de posts existants pour calibrer le modèle sur l'historique
- Définition du positionnement : thought leader, marque expert, personal brand, corporate
- Profil conservé en cache — pas besoin de reconfigurer à chaque session

### Module 2 — Brief par post & analyse

Collecte des informations + enrichissement avant génération.

- **Format demandé** : caption courte OU post long-form OU thread X OU article LinkedIn Pulse OU post Reddit/AMA
- Objectif : engagement, notoriété, trafic, conversion, activation, thought leadership, recrutement
- Plateformes sélectionnées et ton spécifique si différent du ton global
- Contenu source : texte brut, idée, angle, lien à commenter, scénario vidéo, thème carousel
- CTA spécifique souhaité et mots-clés ou hashtags particuliers à intégrer
- BuzzSumo : hashtags et tendances performants sur la thématique
- Benchmark concurrents : hooks et structures efficaces dans la niche
- Tendances Social Media par plateforme

### Module 3 — Génération de contenu (unifié short + long)

Production des variations optimisées par plateforme, quel que soit le format.

**Formats courts (captions) :**

| Plateforme | Ton dominant | Hashtags | Limite | CTA prioritaire |
|---|---|---|---|---|
| Instagram | Inspirationnel, storytelling | 5–15 | 2200 car. | Lien bio / Swipe up / Tag |
| Facebook | Convivial, informatif | 2–5 | 63 206 car. | Commentaire / Partage / Lien |
| TikTok | Décalé, authentique, viral | 3–6 | 2200 car. | Duet / Comment / Lien bio |
| Pinterest | Éducatif, aspirationnel | 2–5 mots-clés | 500 car. | Lien épinglé / Vers site |
| LinkedIn | Professionnel, authority | 3–5 | 3000 car. | Commentaire / Partage |
| Threads | Conversationnel, opinion | 1–3 | 500 car. | Réponse / Repost |
| YouTube | Éducatif, SEO, narratif | 3–10 tags | 5000 car. | S'abonner / Lien / Commentaire |
| X (Twitter) | Direct, punchy, opinion | 1–2 | 280 car. | Retweet / Réponse / Lien |

**Formats longs :**

| Plateforme | Format long-form | Longueur cible | Hooks performants | CTA |
|---|---|---|---|---|
| LinkedIn | Post narratif, article Pulse | 600–3000 mots | Chiffre choc, question rhétorique, histoire perso | Commentaire / Tag / Partage |
| X | Thread 5–10 tweets | 280 car./tweet | Stat, take polémique, liste court | Retweet / Réponse / Quote |
| Reddit | Post discussion, AMA, étude de cas | 500–5000 mots | Titre ultra-spécifique, honnêteté radicale | Upvote / Commentaire / Lien |
| Threads | Thread conversationnel, micro-récit | 500 car./post | Opinion franche, chiffre étonnant | Réponse / Repost |

**Règles de génération communes :**

- 1 à 3 variations générées par plateforme sélectionnée
- Ton adapté automatiquement à chaque réseau selon la charte plateforme/ton
- Hashtags et mots-clés intégrés organiquement
- CTA contextualisé et naturel — pas de formule générique
- Respect des limites de caractères et best practices de chaque plateforme
- Batch : plusieurs posts d'une session traités ensemble pour réduire les appels API

### Module 4 — Cross-Platform (activé à la demande)

Un post source → N versions adaptées automatiquement pour chaque réseau.

| Version | Contenu généré |
|---|---|
| Post source | Post original complet, ton neutre, message de référence |
| LinkedIn | Ton professionnel + insight + narration + CTA commentaire |
| X thread | Découpé en 5–10 tweets, hooks forts, format list ou récit |
| Reddit | Ton honnête et direct, structure AMA ou discussion, titre spécifique |
| Threads | Opinion condensée, post court, ton conversationnel |
| Instagram | Caption inspirationnelle + hashtags optimisés |
| Facebook | Ton convivial + CTA engagement |
| Suggestions média | Visuels, infographies ou vidéos recommandés par version |

Le module cross-platform est activé sur demande explicite du client dans le chat. Il part d'un post source (rédigé par le client ou généré par l'agent) et produit simultanément toutes les versions adaptées en un seul appel batch.

### Module 5 — Validation, export & rapport

De la génération à l'outil de planification.

- Le client valide ou ajuste chaque version dans le chat
- Export CSV ou Google Sheets : toutes les versions + hashtags + CTA
- Injection directe dans Hootsuite, Buffer ou Loomly si connectés
- Rapport synthétique : posts générés, versions retenues, hashtags utilisés
- Régénération d'une variation sur demande sans relancer tout le process

---

## 4. Intégrations & Stack technique

| Catégorie | Outil | Données / Usage | Priorité V1 |
|---|---|---|---|
| Social APIs | Instagram API | Posts existants, performances, hashtags tendances | Essentiel V1 |
| | Facebook API | Contenu existant, benchmark page | Essentiel V1 |
| | LinkedIn API | Posts + articles existants, engagement, tendances | Essentiel V1 |
| | X API v2 | Tweets, threads, engagement, trending topics | Essentiel V1 |
| | Reddit API | Posts communauté, upvotes, sujets tendance | Essentiel V1 |
| | TikTok (Apify) | Tendances, hooks, formats viraux | Best effort V1 |
| | YouTube Data API | Descriptions vidéos, tags, titres | Essentiel V1 |
| | Threads (Meta) | Posts, réponses, engagement | Best effort V1 |
| Tendances & SEO | BuzzSumo | Hashtags performants, tendances thématiques | Essentiel V1 |
| | SerpAPI | Tendances search par sujet | Optionnel V1 |
| | DataForSEO | Mots-clés SEO pour YouTube et Pinterest | Optionnel V1 |
| Export & Planif. | Google Sheets | Export toutes versions + hashtags + CTA | Essentiel V1 |
| | Hootsuite API | Injection directe dans le calendrier | Essentiel V1 |
| | Buffer API | Planification automatique | Essentiel V1 |
| | Loomly API | Planification et approbation | Essentiel V1 |
| Orchestration | Composio MCP | Auth + batch + cache hashtags + réutilisation | Colonne vertébrale |

---

## 5. Inputs & Outputs

### 5.1 — Brief structuré (informations collectées)

| Champ | Description |
|---|---|
| **Format** | Caption courte / Post long-form / Thread X / Article LinkedIn Pulse / Post Reddit-AMA |
| **Plateforme(s) cible(s)** | Instagram, Facebook, TikTok, LinkedIn, Pinterest, Threads, YouTube, X — ou mode cross-platform |
| **Objectif** | Engagement, notoriété, trafic, conversion, thought leadership, recrutement, activation |
| **Contenu source** | Texte brut, idée, angle, texte existant à adapter, lien à commenter, scénario vidéo, thème carousel |
| **Ton par plateforme** | Professionnel (LI), Punchy (X), Communautaire (Reddit), Opinion (Threads), Inspirationnel (IG)... |
| **Hashtags / mots-clés** | Fournis par le client ou proposés par l'agent via BuzzSumo |
| **Mentions** | Personnes, marques ou comptes à citer |
| **CTA souhaité** | Commentaire, partage, clic, upvote, abonnement, téléchargement |
| **Mode cross-platform** | Activé ou non — si oui, post source fourni ou généré par l'agent |

### 5.2 — Outputs produits

| Livrable | Contenu | Fréquence / Trigger |
|---|---|---|
| Variations A/B/C | 1–3 descriptions/posts par plateforme avec variantes de hook | À chaque brief |
| Thread X complet | 5–10 tweets avec hooks de transition optimisés | Si X + format long sélectionnés |
| Version Reddit | Post discussion ou AMA avec titre spécifique + ton communautaire | Si Reddit sélectionné |
| Versions cross-platform | Toutes les adaptations en un batch | Sur demande explicite |
| Hashtags optimisés | Liste sélectionnée par plateforme, volume + pertinence | Par génération |
| CTA contextualisé | CTA intégré et naturel selon plateforme + objectif | Par génération |
| Export CSV/Sheets | Toutes les versions + hashtags + CTA en tableau | À la demande |
| Injection planificateur | Hootsuite / Buffer / Loomly | Sur validation |
| Rapport synthétique | Posts générés, versions retenues, hashtags, KPI estimés | Fin de session |

---

## 6. Parcours client

### PHASE 1 — Onboarding & voix de marque (J1, ~10 min)

Le client configure une seule fois sa voix de marque. Ce profil est réutilisé pour toutes les sessions suivantes.

**Étapes :**

1. Le client connecte ses comptes sociaux (récupération du contenu existant)
2. Il décrit la voix de marque : style, mots interdits, registre, exemples
3. Il configure les préférences par plateforme (hashtags, longueur, CTA type)
4. L'agent calibre sur les posts existants et confirme la compréhension
5. Ce profil est conservé — pas besoin de le re-saisir à chaque session

**Exemple de dialogue d'onboarding :**

> **CLIENT :** Notre marque est une startup SaaS B2B. Ton : professionnel mais accessible, jamais corporate froid. On évite les superlatifs et le jargon. On aime les chiffres, les comparaisons et le storytelling court. On est actifs sur LinkedIn, Instagram, TikTok et X.
>
> **AGENT :** Profil de marque enregistré. Je résume ma compréhension : ton data-driven, storytelling court, registre professionnel mais humain. Sur LinkedIn : insights + opinion + articles thought leadership. Sur Instagram : visuel émotionnel + chiffre d'accroche. Sur TikTok : angle "POV" ou "chiffre choc". Sur X : threads structurés + takes directes. Correct ?

**Livrable Phase 1 :** Voix de marque calibrée + Préférences plateforme enregistrées + Prêt à générer

### PHASE 2 — Génération standard (caption ou long-form)

Le client donne un brief dans le chat. L'agent détecte ou demande le format souhaité.

**Étapes :**

1. Le client donne le contenu + plateformes + objectif + format
2. L'agent enrichit avec les tendances hashtags via BuzzSumo
3. 1 à 3 variations générées pour chaque plateforme sélectionnée
4. Le client valide la variation de son choix ou demande un remix

**Exemple — caption courte :**

> **CLIENT :** Je veux une description pour un post sur notre nouvelle intégration Zapier. Format : caption. Plateformes : LinkedIn + Instagram. Objectif : trafic vers la landing page.
>
> **AGENT :** Voici 2 variations pour chaque plateforme :
>
> **LINKEDIN — Variation A (angle insight) :**
> "Notre intégration Zapier vient de changer la manière dont 200+ clients gèrent leurs workflows. En 3 clics, vos données passent de notre outil à vos 6000+ apps préférées. Lien en commentaire. ↓"
> `#SaaS #Automation #ZapierIntegration`
>
> **INSTAGRAM — Variation A (angle visuel-chiffre) :**
> "3 clics. 6000+ apps. Zéro copier-coller. 🔄 Notre intégration Zapier est là. Lien en bio pour tester. ✨"
> `#Zapier #AutomationTool #SaaS #Productivity #WorkSmart`

**Exemple — post long-form :**

> **CLIENT :** Je veux un post long-form sur l'IA dans le recrutement. Plateformes : LinkedIn + X thread. Objectif : thought leadership + trafic blog.
>
> **AGENT :**
>
> **LINKEDIN (post narratif — 720 mots) :**
> "Il y a 18 mois, notre équipe recrutement passait 12h par semaine à trier des CVs. Aujourd'hui : 1h30. Ce n'est pas de la magie. C'est de l'IA bien utilisée. Voici les 4 étapes exactes qu'on a suivies… [suite du post]"
> `#AI #Recrutement #RH #FutureOfWork`
>
> **X THREAD (8 tweets) :**
> Tweet 1 : "L'IA va supprimer 50% des jobs en recrutement. FAUX. Voici ce qui se passe vraiment ↓ Thread"
> Tweet 2–8 : [générés avec hooks de transition]

**Livrable Phase 2 :** 1–3 variations par plateforme + hashtags + CTA intégré

### PHASE 3 — Mode cross-platform (activé à la demande)

Le client active le mode dans le chat. L'agent transforme un post source en versions adaptées pour tous les réseaux.

**Étapes :**

1. Le client active le mode : « Lance le mode cross-platform »
2. Il fournit ou valide un post source (rédigé par lui ou généré par l'agent)
3. L'agent génère simultanément toutes les versions adaptées
4. Chaque version inclut les suggestions de médias associés
5. Le client valide chaque version ou demande un ajustement spécifique par réseau
6. Export groupé en un seul fichier CSV / Sheets

**Exemple :**

> **CLIENT :** Lance le mode cross-platform. Sujet : « Pourquoi les PME ratent leur transformation digitale ». Objectif : thought leadership + trafic blog. Plateformes : LinkedIn + X thread + Reddit + Instagram.
>
> **AGENT :** Mode cross-platform lancé. Analyse BuzzSumo en cours… Génération simultanée des 4 versions + suggestions médias.
>
> **LinkedIn** — Post narratif 720 mots, angle storytelling + data
> **X** — Thread 8 tweets, hooks de transition optimisés
> **Reddit** — Post r/smallbusiness, titre ultra-spécifique, ton AMA
> **Instagram** — Caption 180 mots, chiffre d'accroche + carousel suggéré

**Livrable Phase 3 :** N versions complètes adaptées + suggestions médias + export batch

### PHASE 4 — Session batch & export

Le client soumet plusieurs posts en une session.

**Étapes :**

1. Le client soumet N posts en une session (mode batch)
2. L'agent traite tous les posts avec réutilisation des hashtags déjà extraits
3. Validation rapide dans le chat : le client sélectionne la variation retenue
4. Export CSV ou Sheets avec toutes les descriptions finales
5. Injection directe dans Hootsuite, Buffer ou Loomly si connectés
6. Rapport synthétique généré en fin de session

**Livrable Phase 4 :** Toutes les descriptions validées + Export CSV/Sheets + Injection planificateur + Rapport synthétique

### Récapitulatif du parcours

| Étape | Durée | Action client | Livrable agent |
|---|---|---|---|
| 1. Onboarding | ~10 min | Décrit voix + positionnement | Profil calibré + cache enregistré |
| 2. Brief post | ~2 min | Sujet + plateforme + format + objectif | 1–3 variations par réseau |
| 3. Cross-platform | Streaming | Active le mode + valide source | LinkedIn + X thread + Reddit + IG + ... |
| 4. Validation | ~1 min | Sélectionne les versions | Versions finales confirmées |
| 5. Export | ~1 min | Choisit le format | CSV / Sheets / Hootsuite / Buffer / Loomly |
| 6. Régénération | Instantané | "Ajuste le ton Reddit" | Nouvelle variation sur demande |

---

## 7. Optimisation des coûts API

| Stratégie | Description |
|---|---|
| Batch multi-posts | Plusieurs posts traités ensemble — réduit les appels API LLM |
| Cache hashtags | Hashtags et mots-clés extraits réutilisés pour tout le lot de posts |
| Cross-platform en 1 appel | Mode cross génère toutes les versions simultanément via 1 appel batch |
| Benchmark groupé par thème | Analyse BuzzSumo par sujet, pas post par post |
| Vérification doublons | Contrôle interne avant appel LLM si sujet similaire déjà traité |
| Cache tendances 7j | BuzzSumo interrogé 1x/semaine, résultats cachés |
| Profil marque en cache | Voix de marque chargée une fois pour toutes les générations |
| Génération conditionnée | Si post similaire déjà traité, adaptation plutôt que régénération complète |

---

## 8. Différenciation stratégique

| ❌ Ce que ce n'est PAS | ✅ Ce que c'est |
|---|---|
| Un simple générateur de texte générique | Un rédacteur calibré sur la voix de marque |
| Un template à remplir | Un adaptateur automatique ton × plateforme × format × objectif |
| Un outil limité à une seule plateforme | Un générateur couvrant 8 plateformes et tous les formats |
| Un copier-coller d'hashtags populaires | Un système d'enrichissement BuzzSumo + tendances |
| Un outil qui ignore les conventions Reddit ou X | Un adaptateur qui respecte les conventions éditoriales de chaque réseau |
| Un agent qui ne fait que du court OU du long | Un agent unifié qui s'adapte au format demandé |

### KPIs de valeur

| Métrique | Valeur |
|---|---|
| Plateformes couvertes | 8 avec ton adapté par réseau |
| Variations par post | 1–3 par plateforme sélectionnée |
| Cross-platform | 1 source → jusqu'à 8 adaptations |
| Gain de temps | -80% vs rédaction manuelle |
| Formats supportés | Captions + posts longs + threads + articles + AMA |
| Export direct | Hootsuite + Buffer + Loomly |

---

## 9. Roadmap & évolutions

### Périmètre V1 — en production

- 8 plateformes couvertes (Instagram, Facebook, TikTok, LinkedIn, Pinterest, Threads, YouTube, X)
- Voix de marque calibrée avec cache pour toutes les sessions
- Génération unifiée : captions courtes ET posts long-form dans le même agent
- 1–3 variations par plateforme avec ton + structure + CTA optimisés
- Module cross-platform : 1 post source → toutes les adaptations simultanément (batch)
- Thread X : génération de threads multi-tweets optimisés
- Reddit : posts discussion/AMA avec ton communautaire
- Suggestions médias pour chaque version
- Mode batch : plusieurs posts par session — coût API optimisé
- Export CSV/Sheets avec toutes versions + hashtags + CTA
- Injection Hootsuite / Buffer / Loomly post-validation
- Rapport synthétique fin de session

### Modules futurs — hors V1

| Module | Version cible |
|---|---|
| Analyse performances post-publication | V2 — intégrer les KPIs réels pour améliorer les variations |
| Ton modulable par plateforme | V2 — profil de ton indépendant par réseau au lieu du ton global |
| Série de posts liés | V2 — générer toute une campagne de posts articulés |
| Quora | V2 — adaptation au format Q&A |
| Pinterest SEO | V2 — optimisation mots-clés Pinterest via DataForSEO |
| YouTube tags automatiques | V2 — génération des tags YouTube optimisés |
| Intégration Agent 19 | V2 — pipeline contenu → planification → publication directe |

---

## 10. Structure code recommandée

```
src/agents/social-content-writer/
├── core/
│   ├── types.ts                    ← Types partagés (Brief, Output, Variation, Platform)
│   ├── constants.ts                ← Plateformes, limites caractères, configs par réseau
│   └── prompts.ts                  ← System prompts (onboarding, caption, long-form, cross-platform)
├── modules/
│   ├── onboarding.ts               ← Calibration voix de marque + cache profil
│   ├── brief-parser.ts             ← Parsing du brief client → BriefStructuré
│   ├── analyzer.ts                 ← BuzzSumo + tendances + benchmark concurrents
│   ├── generator.ts                ← Génération unifiée (détecte format → caption ou long-form)
│   ├── cross-platform.ts           ← Transformation post source → N versions
│   └── exporter.ts                 ← CSV, Google Sheets, Hootsuite, Buffer, Loomly
├── utils/
│   ├── hashtag-cache.ts            ← Cache hashtags 7 jours
│   ├── character-limits.ts         ← Validation limites par plateforme
│   └── batch.ts                    ← Logique de traitement batch multi-posts
└── index.ts                        ← Point d'entrée agent : orchestration des modules
```

### Routes API

```
src/app/api/agents/social-content-writer/
├── chat/route.ts                   ← POST (SSE) — Conversation brief + génération
├── generate/route.ts               ← POST — Génération directe (brief structuré → variations)
├── cross-platform/route.ts         ← POST — Mode cross-platform (post source → N versions)
├── export/route.ts                 ← POST — Export CSV/Sheets/injection planificateur
└── brand-voice/route.ts            ← GET/POST — Récupérer/sauvegarder le profil voix de marque
```

### Types principaux

```typescript
// src/agents/social-content-writer/core/types.ts

type Platform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest'
  | 'threads'
  | 'youtube'
  | 'x';

type ContentFormat =
  | 'caption'           // Court : 50–500 mots
  | 'long-form'         // Long : 300–3000 mots (post LinkedIn, article)
  | 'thread'            // Thread X : 5–10 tweets
  | 'reddit-ama'        // Post Reddit discussion/AMA
  | 'article';          // Article LinkedIn Pulse

type PostObjective =
  | 'engagement'
  | 'awareness'
  | 'traffic'
  | 'conversion'
  | 'thought-leadership'
  | 'recruitment'
  | 'activation';

interface BrandVoiceProfile {
  style: string;                     // Ex: "data-driven, storytelling court"
  register: string;                  // Ex: "professionnel mais humain"
  forbiddenWords: string[];          // Mots à ne jamais utiliser
  keyPhrases: string[];              // Formules récurrentes de la marque
  positioning: 'thought-leader' | 'brand-expert' | 'personal-brand' | 'corporate';
  platformOverrides?: Partial<Record<Platform, {
    preferredLength?: number;
    tone?: string;
    hashtagCount?: number;
    ctaType?: string;
  }>>;
  examplePosts?: string[];           // Posts existants pour calibration
}

interface ContentBrief {
  format: ContentFormat;
  platforms: Platform[];
  objective: PostObjective;
  sourceContent: string;             // Texte brut, idée, angle, lien
  tone?: string;                     // Override du ton global
  hashtags?: string[];               // Fournis par le client
  mentions?: string[];               // Comptes à citer
  cta?: string;                      // CTA spécifique
  crossPlatform: boolean;            // Activer le mode cross-platform
  variationsCount: 1 | 2 | 3;       // Nombre de variations par plateforme
}

interface GeneratedVariation {
  platform: Platform;
  format: ContentFormat;
  variationIndex: number;            // 0, 1, 2
  content: string;                   // Le texte du post
  hashtags: string[];
  cta: string;
  characterCount: number;
  characterLimit: number;
  mediaSuggestions?: string[];       // Suggestions de visuels/formats média
}

interface ThreadTweet {
  index: number;                     // 1, 2, 3...
  content: string;
  characterCount: number;
  hook?: string;                     // Hook de transition vers le tweet suivant
}

interface GenerationOutput {
  brief: ContentBrief;
  variations: GeneratedVariation[];
  threads?: Record<string, ThreadTweet[]>;  // Clé = variationId
  crossPlatformSource?: string;             // Post source si mode cross activé
  hashtagsUsed: string[];
  benchmarkInsights?: string;               // Résumé BuzzSumo
  generatedAt: string;                      // ISO 8601
}
```

### Logique du générateur unifié

```typescript
// src/agents/social-content-writer/modules/generator.ts
// Pseudo-code — logique de routing par format

async function generate(brief: ContentBrief, voice: BrandVoiceProfile): Promise<GenerationOutput> {

  // 1. Enrichissement (BuzzSumo + tendances)
  const insights = await analyzer.enrich(brief);

  // 2. Routing par format
  const variations: GeneratedVariation[] = [];

  for (const platform of brief.platforms) {
    const format = resolveFormat(brief.format, platform);
    // Ex: si format = 'long-form' et platform = 'x' → format = 'thread'
    // Ex: si format = 'long-form' et platform = 'instagram' → format = 'caption' (IG n'a pas de long-form)
    // Ex: si format = 'caption' et platform = 'reddit' → format = 'reddit-ama' (Reddit = toujours long)

    for (let i = 0; i < brief.variationsCount; i++) {
      const variation = await generateForPlatform(platform, format, brief, voice, insights);
      variations.push(variation);
    }
  }

  // 3. Cross-platform si activé
  if (brief.crossPlatform) {
    const source = brief.sourceContent || variations[0]?.content;
    const crossVariations = await crossPlatform.transform(source, brief.platforms, voice);
    variations.push(...crossVariations);
  }

  return { brief, variations, hashtagsUsed: insights.hashtags, generatedAt: new Date().toISOString() };
}

function resolveFormat(requestedFormat: ContentFormat, platform: Platform): ContentFormat {
  // Matrice de compatibilité format × plateforme
  const matrix: Record<Platform, ContentFormat[]> = {
    linkedin: ['caption', 'long-form', 'article'],
    x: ['caption', 'thread'],
    reddit: ['reddit-ama'],           // Reddit = toujours format discussion
    threads: ['caption', 'long-form'],
    instagram: ['caption'],           // IG = toujours caption
    facebook: ['caption', 'long-form'],
    tiktok: ['caption'],              // TikTok = toujours caption
    pinterest: ['caption'],           // Pinterest = toujours caption
    youtube: ['caption'],             // YouTube = description vidéo
  };

  const supported = matrix[platform];
  if (supported.includes(requestedFormat)) return requestedFormat;
  return supported[0]; // Fallback au format par défaut de la plateforme
}
```

---

## 11. Synthèse — Carte de l'agent

**Social Content Writer**
`AGT-MKT-SCW-16` • v1.0

**Brief → Analyse → Génération → Cross-platform → Export**

- ✓ Génère captions courtes ET posts long-form dans un agent unifié
- ✓ Couvre 8 plateformes avec ton, structure et CTA adaptés par réseau
- ✓ Via le module cross-platform, transforme un post source en N versions en 1 batch
- ✓ Respecte la voix de marque définie à l'onboarding sur toutes les générations
- ✓ Exporte directement vers Google Sheets, Hootsuite, Buffer ou Loomly
