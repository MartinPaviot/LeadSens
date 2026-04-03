# AGT-MKT-INF-01 — Influencer Discovery & Campaign Assistant

> **"Le Chief Influencer Officer IA"**  
> Agent Marketing — Acquisition & Influence | Plateforme Elevay B2B | v1.0

---

## 1. Résumé de l'agent

Cet agent agit comme un scout IA stratégique : il collecte un brief structuré via le chat, recherche et qualifie des influenceurs sur plusieurs plateformes, calcule un score de compatibilité IA, et produit une liste directement exploitable pour lancer une campagne.

**Positionnement** : Chief Influencer Officer IA  
**Canal d'accès** : Interface chat B2B (web / mobile)  
**Statut** : Actif — Production V1  
**Code interne** : AGT-MKT-INF-01

---

## 2. Ce que fait l'agent

### Missions principales
- Collecter le brief de campagne via un dialogue structuré (8 critères)
- Rechercher et filtrer des profils d'influenceurs via APIs (Upfluence, Klear)
- Calculer un score de compatibilité IA (0–100) pour chaque profil
- Produire une liste exportable (Excel / Google Sheet / CRM)
- Générer des briefs de collaboration personnalisés prêts à envoyer

### Ce que ce n'est PAS
- Ce n'est pas une plateforme de suivi post-campagne (hors V1)
- Ce n'est pas un outil de paiement ou de contractualisation
- Ce n'est pas un moteur de scraping massif (analyse ciblée, max 50–100 profils/campagne)

---

## 3. Plateformes & Stack technique

### Réseaux sociaux couverts
Instagram · TikTok · YouTube · LinkedIn · X (Twitter)

### Stack technique
| Outil | Rôle | Priorité |
|---|---|---|
| Upfluence API | Recherche et données influenceurs | Primaire |
| Klear API | Analytics complémentaires | Secondaire |
| Composio | Orchestration et batch des requêtes | Backbone |
| Instagram / TikTok / YouTube / LinkedIn API | Données directes réseaux | Accès direct |
| Google Sheets / Excel | Export liste opérationnelle | Livrable client |

---

## 4. Workflow opérationnel (5 étapes)

```
[1] Brief & Critères
        ↓
[2] Recherche & Filtrage (APIs Upfluence / Klear)
        ↓
[3] Scoring IA de compatibilité (algorithme pondéré)
        ↓
[4] Production de la liste opérationnelle (export)
        ↓
[5] Recommandations & Briefs de collaboration
```

### Détail des étapes

**Étape 1 — Brief** : collecte structurée via chat de 8 paramètres (objectif, secteur, géo, plateformes, style, budget, priorité reach/engagement, profil micro/macro).

**Étape 2 — Recherche** : appel APIs avec filtres stricts. Analyse limitée aux top 50–100 profils. Requêtes groupées via Composio pour optimiser les coûts.

**Étape 3 — Scoring** : algorithme pondéré sur 5 composantes (voir section 5).

**Étape 4 — Export** : liste structurée avec données complètes par influenceur.

**Étape 5 — Briefs** : stratégies de contact personnalisées + briefs collaborations prêts à envoyer.

---

## 5. Algorithme de scoring IA (0–100)

| Composante | Poids | Description |
|---|---|---|
| Reach × Engagement | 40% | Score d'influence brut pondéré par taille d'audience |
| Affinité thématique | 25% | Alignement niche influenceur ↔ secteur client |
| Brand Safety | 20% | Analyse contenu publié, historique collabs, controverses |
| Qualité contenu | 10% | Esthétique, cohérence éditoriale, taux complétion vidéo |
| Crédibilité | 5% | Fiabilité données, régularité de publication |

**Lecture du score** :
- 85–100 → profil prioritaire (vert)
- 70–84 → profil recommandé (orange)
- < 70 → profil à risque ou hors cible (rouge)

---

## 6. Inputs / Outputs

### Inputs (brief structuré)
- Objectif campagne (Branding / Conversion / Engagement / Notoriété)
- Secteur / niche (Mode, Tech, Beauté, Food, Finance, B2B…)
- Zone géographique (pays, langue, région)
- Plateformes cibles
- Style de contenu (éducatif, lifestyle, humour, review, UGC…)
- Budget collaboration (fourchette globale ou par influenceur)
- Priorité : reach ou engagement
- Profil influenceur : Micro (<100K) / Macro (>100K) / Mix

### Outputs (livrables)
- Liste influenceurs qualifiés — fichier Excel / Google Sheet / CRM
- Fiche par profil : abonnés, engagement moyen, plateformes, style, niche
- Score IA compatibilité (0–100)
- Classement par ROI potentiel estimé
- Stratégie de contact personnalisée par type de profil
- Brief de collaboration prêt à envoyer

---

## 7. Logique micro vs macro

| Critère | Micro (<100K) | Macro (>100K) |
|---|---|---|
| Budget | Limité / serré | Confortable / large |
| Priorité | Engagement fort | Reach maximum |
| Niche | Ultra-spécialisée | Grand public |
| Authenticité | Très élevée | Modérée |
| ROI estimé | Élevé (ratio coût/impact) | Variable |
| Recommandé pour | Lancement / Test / Niche | Branding massif / Notoriété |

---

## 8. Optimisation des coûts API

- Filtres stricts en amont → réduction du volume avant toute requête API
- Analyse limitée aux top 50–100 profils par campagne
- Requêtes groupées via Composio (batch)
- Cache des profils déjà analysés lors de campagnes précédentes
- Scraping autorisé uniquement en fallback si APIs Upfluence/Klear ne couvrent pas la niche

---

## 9. Instructions de création — Développeur

### Prérequis
- Compte Upfluence avec accès API (clé API requise)
- Compte Klear avec accès API (optionnel, secondaire)
- Compte Composio (orchestration MCP)
- Accès APIs réseaux : Instagram Graph API, TikTok Creator API, YouTube Data API v3, LinkedIn API

### Architecture recommandée

```
agent/
  core/
    brief_collector.py      # Dialogue structuré, collecte des 8 paramètres
    search_engine.py        # Appels Upfluence + Klear via Composio
    scoring.py              # Algorithme de scoring pondéré
    brief_generator.py      # Génération des briefs de collaboration
    export.py               # Export Excel / Google Sheet / CRM
  integrations/
    upfluence.py
    klear.py
    composio_client.py
    social_apis.py
  prompts/
    brief_collection.txt    # Prompt système pour la collecte du brief
    scoring_analysis.txt    # Prompt système pour l'analyse IA
    brief_writing.txt       # Prompt système pour la génération de briefs
  config/
    scoring_weights.json    # Poids de l'algorithme (modifiables)
    api_keys.env
```

### Prompt système recommandé (brief collection)

```
Tu es le Chief Influencer Officer IA d'Elevay. Tu aides les équipes marketing B2B à trouver les meilleurs influenceurs pour leurs campagnes.

Ta mission lors de cette conversation :
1. Collecter le brief de campagne en posant les questions nécessaires (objectif, secteur, géo, plateformes, style, budget, priorité reach/engagement, profil micro/macro)
2. Valider le brief avec l'utilisateur avant de lancer la recherche
3. Lancer la recherche uniquement une fois le brief complet et confirmé
4. Présenter les résultats de façon claire avec les scores et recommandations

Règles :
- Pose maximum 2-3 questions par message pour ne pas surcharger
- Si le budget est < 3 000€ : recommande prioritairement les micro-influenceurs
- Si l'objectif est "notoriété" et budget > 10 000€ : propose un mix micro/macro
- Toujours afficher le récapitulatif du brief avant de lancer la recherche
- Toujours expliquer le score IA avec les 5 composantes pour les top 3 profils
```

### Paramètres de scoring (scoring_weights.json)

```json
{
  "reach_engagement": 0.40,
  "thematic_affinity": 0.25,
  "brand_safety": 0.20,
  "content_quality": 0.10,
  "credibility": 0.05,
  "thresholds": {
    "priority": 85,
    "recommended": 70,
    "at_risk": 0
  },
  "max_profiles_per_campaign": 100
}
```

### Règles métier à implémenter

```python
def recommend_profile_type(budget: float, objective: str) -> str:
    if budget < 3000:
        return "micro"
    elif budget > 10000 and objective == "awareness":
        return "mix"
    elif objective in ["conversion", "engagement"]:
        return "micro"
    else:
        return "macro"

def apply_cost_optimization(profiles: list) -> list:
    # 1. Filtrer par score estimé avant appel API détaillé
    # 2. Grouper les requêtes Composio en batch de 10
    # 3. Vérifier le cache avant tout appel API
    # 4. Fallback scraping si couverture API < 80% de la niche
    pass
```

### Modules futurs (hors V1)
- Suivi des performances post-campagne (KPIs réels)
- Mesure du ROI réel vs estimé
- Recommandations d'optimisation campagne en continu
- Détection automatique de nouveaux influenceurs dans la niche

---

## 10. UI/UX associée

L'interface est un split-panel avec :
- **Panneau gauche (320px)** : chat conversationnel pour le brief
- **Panneau droit** : liste de résultats avec cards influenceurs, filtres, et panneau de détail slide-over

Voir le prompt Claude Code séparé pour l'implémentation complète de l'interface.

**Couleurs principales** : Teal `#1D9E75` (accent), Amber `#EF9F27` (warning), Red `#E24B4A` (danger)  
**Stack UI recommandée** : React + TypeScript + Tailwind CSS + shadcn/ui
