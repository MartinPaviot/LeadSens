# Instantly API V2 — SuperSearch Reference

> Ce fichier est la source de verite pour tous les filtres SuperSearch.
> L'ICP parser et le system prompt agent DOIVENT s'y referer.

Base URL : `https://api.instantly.ai/api/v2`

---

## 1. Endpoints SuperSearch

| Endpoint | Methode | Credits | Usage |
|----------|---------|---------|-------|
| `/supersearch-enrichment/count-leads-from-supersearch` | POST | Non | Estimation du nombre de leads |
| `/supersearch-enrichment/preview-leads-from-supersearch` | POST | Non | Preview 5 leads sample |
| `/supersearch-enrichment/enrich-leads-from-supersearch` | POST | **Oui** | Sourcing reel (consomme des credits) |
| `/supersearch-enrichment/{resourceId}` | GET | Non | Poll status du sourcing |

---

## 2. search_filters — Tous les parametres

### IMPORTANT: Mapping noms internes → noms API

Notre code utilise des noms internes (cote gauche) qui sont transformes par `prepareFiltersForAPI()` en noms API (cote droit) avant envoi :

| Nom interne (code) | Nom API reel | Format API |
|---------------------|-------------|------------|
| `job_titles: string[]` | `title` | `{ include: string[] }` |
| `industries: string[]` | `industry` | `{ include: string[] }` |
| `employee_count: string[]` | `employeeCount` | `string[]` |
| `keyword_filter: string` | `keyword_filter` | `{ include: string }` |
| `company_names: {...}` | `company_name` | `{ include: string[], exclude: string[] }` |
| `names: {include, exclude}` | `name` | `string[]` |
| `lookalike_domain: string` | `look_alike` | `string` |
| `location_filter_type: string` | `location_mode` | `"contact"` ou `"company"` |
| `department: string[]` | `department` | `string[]` (meme nom) |
| `level: string[]` | `level` | `string[]` (meme nom) |
| `revenue: string[]` | `revenue` | `string[]` (valeurs mappees, voir section 2.2) |

### 2.1 Filtres sur la PERSONNE

| Champ interne | Champ API | Type API | Valeurs possibles | Description |
|---------------|-----------|----------|-------------------|-------------|
| `job_titles` | `title` | `{ include: string[] }` | Texte libre | Titres de poste. Ex: `["CTO", "Vice President of Sales"]` |
| `level` | `level` | `string[]` | `"C-Level"`, `"VP-Level"`, `"Director-Level"`, `"Manager-Level"`, `"Staff"`, `"Entry level"`, `"Mid-Senior level"`, `"Director"`, `"Associate"`, `"Owner"` (+8 more) | Niveau hierarchique / seniority |
| `department` | `department` | `string[]` | `"Engineering"`, `"Finance & Administration"`, `"Human Resources"`, `"IT & IS"`, `"Marketing"`, `"Operations"`, `"Sales"`, `"Support"`, `"Other"` | Departement fonctionnel |
| `names` | `name` | `string[]` | Texte libre | Filtrer par nom de contact. API attend un array simple |

### 2.2 Filtres sur l'ENTREPRISE

| Champ interne | Champ API | Type API | Valeurs possibles | Description |
|---------------|-----------|----------|-------------------|-------------|
| `industries` | `industry` | `{ include: string[] }` | ENUM stricte | `"Agriculture & Mining"`, `"Business Services"`, `"Computers & Electronics"`, `"Consumer Services"`, `"Education"`, `"Energy & Utilities"`, `"Financial Services"`, `"Government"`, `"Healthcare, Pharmaceuticals, & Biotech"`, `"Manufacturing"`, `"Media & Entertainment"`, `"Non-Profit"`, `"Other"`, `"Real Estate & Construction"`, `"Retail"`, `"Software & Internet"`, `"Telecommunications"`, `"Transportation & Storage"`, `"Travel, Recreation, and Leisure"`, `"Wholesale & Distribution"` |
| `employee_count` | `employeeCount` | `string[]` | `"0 - 25"`, `"25 - 100"`, `"100 - 250"`, `"250 - 1000"`, `"1K - 10K"`, `"10K - 50K"`, `"50K - 100K"`, `"> 100K"` | Taille d'entreprise (nombre d'employes) |
| `revenue` | `revenue` | `string[]` | Valeurs API: `"$0 - 1M"`, `"$1 - 10M"`, `"$10 - 50M"`, `"$50 - 100M"`, `"$100 - 250M"`, `"$250 - 500M"`, `"$500M - 1B"`, `"> $1B"`. Note: en interne on utilise `"$1M - 10M"` etc., `prepareFiltersForAPI()` mappe vers les valeurs API | Chiffre d'affaires annuel en USD |
| `funding_type` | `funding_type` | `string[]` | `"angel"`, `"seed"`, `"pre_seed"`, `"series_a"` a `"series_g"` (+13 more) | Type de financement/levee de fonds |
| `company_names` | `company_name` | `{ include: string[], exclude: string[] }` | Texte libre | Filtrer par nom d'entreprise |

### 2.3 Filtres GEOGRAPHIQUES

| Champ interne | Champ API | Type API | Valeurs possibles | Description |
|---------------|-----------|----------|-------------------|-------------|
| `locations` | `locations` | `[{place_id, label}]` ou `{ include: [...], exclude: [...] }` | Place IDs Google Maps | `prepareFiltersForAPI()` resout les strings en `{place_id, label}` objets |
| `location_filter_type` | `location_mode` | `string` | `"contact"`, `"company"` | Note: en interne on utilise `"company_hq"`, mappe vers `"company"` |

### 2.4 Filtres AVANCES

| Champ interne | Champ API | Type API | Valeurs possibles | Description |
|---------------|-----------|----------|-------------------|-------------|
| `keyword_filter` | `keyword_filter` | `{ include: string }` | Texte libre | Mot-cle general (bio, titre, description) |
| `technologies` | `technologies` | `string[]` | Texte libre | Technologies de l'entreprise. Ex: `["Salesforce", "HubSpot"]` |
| `lookalike_domain` | `look_alike` | `string` | Domaine | Entreprises similaires. Ex: `"stripe.com"` |
| `news` | `news` | `string[]` | ENUM: `"launches"`, `"hires"`, `"receives_financing"`, `"partners_with"`, etc. | Actualites recentes |
| `job_listing` | `job_listing` | `string` | Texte libre | Offres d'emploi actives |

### 2.5 Options de DEDUPLICATION

| Champ | Type | Default | Description |
|-------|------|---------|-------------|
| `skip_owned_leads` | `boolean` | `true` | Exclure les leads deja dans le compte Instantly. **TOUJOURS mettre a true** |
| `show_one_lead_per_company` | `boolean` | `false` | Un seul lead par entreprise. Utile pour diversifier la liste |

---

## 3. enrichment_payload (optionnel, pour enrich-leads)

Ces champs sont dans le body de `enrich-leads-from-supersearch`, PAS dans search_filters :

| Champ | Type | Default | Description |
|-------|------|---------|-------------|
| `work_email_enrichment` | `boolean` | `true` | Enrichir avec l'email pro verifie |
| `fully_enriched_profile` | `boolean` | `false` | Profil complet (LinkedIn, phone, etc.) |
| `email_verification` | `boolean` | `false` | Verification supplementaire des emails |
| `joblisting` | `boolean` | `false` | Enrichir avec les offres d'emploi de l'entreprise |
| `technologies` | `boolean` | `false` | Enrichir avec la stack techno de l'entreprise |
| `news` | `boolean` | `false` | Enrichir avec les actualites recentes |
| `funding` | `boolean` | `false` | Enrichir avec les donnees de financement |

---

## 4. Reponses attendues

### count-leads
```json
{ "number_of_leads": 2400 }
```
Note : la cle reelle est `number_of_leads` (pas `count`). Si > 1_000_000, l'API retourne `1000000`.

### preview-leads
```json
{
  "number_of_leads": 2400,
  "number_of_redacted_results": 0,
  "leads": [
    {
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company_name": "Acme Corp",
      "title": "VP Sales",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "phone": "+1234567890",
      "website": "https://acme.com",
      "country": "United States",
      "company_size": "51-200",
      "industry": "SaaS"
    }
  ]
}
```
Note : la cle est `leads` (pas `items`). Inclut aussi `number_of_leads` et `number_of_redacted_results`.

### enrich-leads (sourcing)
```json
{
  "id": "uuid",
  "resource_id": "uuid"
}
```
Note : la cle est `resource_id` (pas `resourceId`).

Puis poll GET `/supersearch-enrichment/{resourceId}` :
```json
{
  "resource_id": "uuid",
  "in_progress": false,
  "exists": true,
  "enrichment_payload": { ... }
}
```

---

## 5. Regles de parsing ICP → search_filters

### Mapping langage naturel → filtres

| L'utilisateur dit... | Filtre a utiliser |
|----------------------|-------------------|
| "CTO", "directeur technique" | `job_titles: ["CTO", "Chief Technology Officer"]` + `department: ["Engineering"]` + `level: ["C-Level"]` |
| "VP Sales" | `job_titles: ["Vice President of Sales"]` + `department: ["Sales"]` + `level: ["VP-Level"]` |
| "C-level", "dirigeants" | `level: ["C-Level"]` |
| "SaaS", "logiciel" | `industries: ["Software & Internet"]` |
| "France", "en France" | `locations: ["France"]` |
| "Paris uniquement" | `locations: ["Paris"]` |
| "Europe sauf UK" | `locations: { include: ["Europe"], exclude: ["United Kingdom"] }` |
| "50-200 employes" | `employee_count: ["25 - 100", "100 - 250"]` |
| "startup", "petite boite" | `employee_count: ["0 - 25"]` |
| "PME" | `employee_count: ["25 - 100", "100 - 250"]` |
| "ETI", "mid-market" | `employee_count: ["250 - 1000", "1K - 10K"]` |
| "grande entreprise", "enterprise" | `employee_count: ["10K - 50K", "50K - 100K", "> 100K"]` |
| "CA > 10M" | `revenue: ["$10M - 50M", "$50M - 100M", "$100M - 250M", "$250M - 500M", "$500M - 1B", "> $1B"]` |
| "qui a leve en seed" | `funding_type: ["seed"]` |
| "series A ou B" | `funding_type: ["series_a", "series_b"]` |
| "qui utilise Salesforce" | `technologies: ["Salesforce"]` |
| "entreprises comme Stripe" | `lookalike_domain: "stripe.com"` |
| "qui recrutent un dev" | `job_listing: "developer"` |
| "equipe marketing" | `department: ["Marketing"]` |
| "equipe technique" | `department: ["Engineering", "IT & IS"]` |
| "managers et directeurs" | `level: ["Manager-Level", "Director-Level"]` |
| "seniors" | `level: ["Mid-Senior level"]` |

### Regles strictes

1. **TOUJOURS** `skip_owned_leads: true`
2. Pour les job titles, TOUJOURS ajouter les variantes courantes :
   - CTO → `["CTO", "Chief Technology Officer"]`
   - VP Sales → `["Vice President of Sales"]`
   - CEO → `["CEO", "Chief Executive Officer", "Founder"]`
3. Combiner `department` + `level` + `job_titles` pour le meilleur ciblage
4. Interpreter le francais ET l'anglais
5. Ne mettre QUE les filtres clairement specifies ou fortement impliques
6. `employee_count`, `revenue`, `industries`, `department`, `level` sont des enums strictes — utiliser les valeurs EXACTES
7. Le post-processing corrige automatiquement les erreurs courantes du LLM
8. `technologies` est du texte libre — utiliser les noms exacts des produits/outils

---

## 6. Statut d'implementation

Tous les filtres et l'enrichment_payload sont implementes :

- [x] `technologies` — filtre par stack techno
- [x] `lookalike_domain` → `look_alike` — entreprises similaires a un domaine
- [x] `job_listing` — filtre par offres d'emploi actives
- [x] `company_names` → `company_name` — include/exclude des noms d'entreprise
- [x] `names` → `name` — array de noms de contact
- [x] `location_filter_type` → `location_mode` — choix contact vs company HQ
- [x] `locations` — resolution automatique des strings en place_id objects
- [x] `enrichment_payload` — `work_email_enrichment: true` par defaut
- [x] `department` — enum Title Case (`"Sales"`, `"Engineering"`, etc.)
- [x] `level` — enum (`"C-Level"`, `"VP-Level"`, etc.)
- [x] `funding_type` — enum snake_case (`"seed"`, `"series_a"`, etc.)
- [x] `job_titles` → `title: { include: [...] }` — wrapping objet
- [x] `industries` → `industry: { include: [...] }` — wrapping objet
- [x] `employee_count` → `employeeCount` — camelCase
- [x] `keyword_filter` → `{ include: string }` — wrapping objet
- [x] `revenue` — mapping valeurs internes → valeurs API

### Note critique : enrichment_payload
L'endpoint `enrich-leads-from-supersearch` **EXIGE** un `enrichment_payload` avec au moins un type d'enrichissement active.
Sans ca, l'API renvoie une erreur. Notre code envoie `work_email_enrichment: true` par defaut.
