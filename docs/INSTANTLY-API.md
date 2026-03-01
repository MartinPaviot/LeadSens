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

### 2.1 Filtres sur la PERSONNE

| Champ | Type | Valeurs possibles | Description |
|-------|------|-------------------|-------------|
| `job_titles` | `string[]` | Texte libre | Titres de poste. Ex: `["CTO", "VP Engineering", "Head of Engineering"]`. Ajouter les variantes courantes (CTO = Chief Technology Officer = Chief Technical Officer) |
| `level` | `string[]` | `"c_suite"`, `"vp"`, `"director"`, `"manager"`, `"senior"`, `"entry"` | Niveau hierarchique / seniority |
| `department` | `string[]` | `"engineering"`, `"finance"`, `"hr"`, `"it"`, `"legal"`, `"marketing"`, `"operations"`, `"sales"`, `"support"` | Departement fonctionnel |
| `names` | `object` | `{ include: string[], exclude: string[] }` | Filtrer par nom de contact (prenom/nom). Rarement utile |

### 2.2 Filtres sur l'ENTREPRISE

| Champ | Type | Valeurs possibles | Description |
|-------|------|-------------------|-------------|
| `industries` | `string[]` | Texte libre | Secteurs d'activite. Ex: `["SaaS", "FinTech", "Healthcare", "E-commerce"]` |
| `employee_count` | `string[]` | `"1-10"`, `"11-50"`, `"51-200"`, `"201-500"`, `"501-1000"`, `"1001-5000"`, `"5001-10000"`, `"10001+"` | Taille d'entreprise (nombre d'employes) |
| `revenue` | `string[]` | `"0-1M"`, `"1M-10M"`, `"10M-50M"`, `"50M-100M"`, `"100M-500M"`, `"500M-1B"`, `"1B+"` | Chiffre d'affaires annuel en USD |
| `funding_type` | `string[]` | `"pre_seed"`, `"seed"`, `"series_a"`, `"series_b"`, `"series_c"`, `"series_d"`, `"series_e"`, `"series_f"`, `"debt_financing"`, `"grant"`, `"ipo"`, `"private_equity"`, `"undisclosed"` | Type de financement/levee de fonds |
| `company_names` | `object` | `{ include: string[], exclude: string[] }` | Filtrer par nom d'entreprise. Utile pour exclure des concurrents ou cibler des entreprises specifiques |

### 2.3 Filtres GEOGRAPHIQUES

| Champ | Type | Valeurs possibles | Description |
|-------|------|-------------------|-------------|
| `locations` | `string[]` (legacy) OU `object` (nouveau) | **Legacy :** `["France", "Paris", "United States"]` **Nouveau :** `{ include: ["France"], exclude: ["Paris"] }` | Localisation. Le format legacy (array simple) fonctionne encore. Le nouveau format permet include/exclude |
| `location_filter_type` | `string` | `"contact"`, `"company_hq"` | Filtrer par localisation du contact OU du siege de l'entreprise. Default: `"contact"` |

### 2.4 Filtres AVANCES

| Champ | Type | Valeurs possibles | Description |
|-------|------|-------------------|-------------|
| `keyword_filter` | `string` | Texte libre | Mot-cle general pour filtrer (cherche dans bio, titre, description entreprise) |
| `technologies` | `string[]` | Texte libre | Technologies utilisees par l'entreprise. Ex: `["Salesforce", "HubSpot", "React", "AWS"]`. Scanne le site web de l'entreprise |
| `lookalike_domain` | `string` | Domaine | Domaine d'une entreprise modele. Retourne des entreprises similaires. Ex: `"stripe.com"` |
| `news` | `string` | Texte libre | Filtre par actualites recentes / mentions media |
| `job_listing` | `string` | Texte libre | Filtre par offres d'emploi actives. Ex: `"sales manager"` = entreprises qui recrutent un sales manager (signal de croissance) |

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
{ "count": 2400 }
```
Note : si `count > 1_000_000`, l'API retourne `1000000`.

### preview-leads
```json
{
  "items": [
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

### enrich-leads (sourcing)
```json
{
  "id": "uuid",
  "resourceId": "uuid"
}
```
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
| "CTO", "directeur technique" | `job_titles: ["CTO", "Chief Technology Officer", "Directeur Technique"]` |
| "VP", "vice-president" | `level: ["vp"]` + `job_titles` specifiques |
| "C-level", "dirigeants" | `level: ["c_suite"]` |
| "SaaS", "logiciel" | `industries: ["SaaS", "Software"]` |
| "France", "en France" | `locations: ["France"]` |
| "Paris uniquement" | `locations: ["Paris"]` |
| "Europe sauf UK" | `locations: { include: ["Europe"], exclude: ["United Kingdom"] }` |
| "50-200 employes" | `employee_count: ["51-200"]` |
| "startup", "petite boite" | `employee_count: ["1-10", "11-50"]` |
| "PME" | `employee_count: ["51-200", "201-500"]` |
| "ETI", "mid-market" | `employee_count: ["501-1000", "1001-5000"]` |
| "grande entreprise", "enterprise" | `employee_count: ["5001-10000", "10001+"]` |
| "CA > 10M" | `revenue: ["10M-50M", "50M-100M", "100M-500M", "500M-1B", "1B+"]` |
| "1 a 10M de CA" | `revenue: ["1M-10M"]` |
| "qui a leve en seed" | `funding_type: ["seed"]` |
| "series A ou B" | `funding_type: ["series_a", "series_b"]` |
| "qui utilise Salesforce" | `technologies: ["Salesforce"]` |
| "entreprises comme Stripe" | `lookalike_domain: "stripe.com"` |
| "qui recrutent un dev" | `job_listing: "developer"` |
| "equipe marketing" | `department: ["marketing"]` |
| "equipe technique" | `department: ["engineering", "it"]` |
| "managers et directeurs" | `level: ["manager", "director"]` |
| "seniors" | `level: ["senior"]` |

### Regles strictes

1. **TOUJOURS** `skip_owned_leads: true`
2. Pour les job titles, TOUJOURS ajouter les variantes courantes :
   - CTO → `["CTO", "Chief Technology Officer", "Chief Technical Officer"]`
   - VP Sales → `["VP Sales", "Vice President Sales", "VP of Sales"]`
   - CEO → `["CEO", "Chief Executive Officer", "Founder", "Co-founder"]`
   - Head of Marketing → `["Head of Marketing", "Marketing Director", "Director of Marketing"]`
3. Interpreter le francais ET l'anglais
4. Ne mettre QUE les filtres clairement specifies ou fortement impliques
5. `employee_count` et `revenue` sont des enums strictes — utiliser les valeurs EXACTES
6. Les `locations` acceptent pays, villes, regions, etats
7. `industries` est du texte libre — utiliser les termes standards
8. `technologies` est du texte libre — utiliser les noms exacts des produits/outils

---

## 6. Statut d'implementation

Tous les filtres et l'enrichment_payload sont implementes :

- [x] `technologies` — filtre par stack techno
- [x] `lookalike_domain` — entreprises similaires a un domaine
- [x] `job_listing` — filtre par offres d'emploi actives
- [x] `company_names` — include/exclude des noms d'entreprise
- [x] `names` — include/exclude des noms de contact
- [x] `location_filter_type` — choix contact vs company HQ
- [x] `locations` format objet avec include/exclude
- [x] `enrichment_payload` — `work_email_enrichment: true` par defaut (requis par l'API)

### Note critique : enrichment_payload
L'endpoint `enrich-leads-from-supersearch` **EXIGE** un `enrichment_payload` avec au moins un type d'enrichissement active.
Sans ca, l'API renvoie une erreur. Notre code envoie `work_email_enrichment: true` par defaut.
