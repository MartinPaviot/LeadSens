# /audit — Audit stratégique codebase vs STRATEGY.md

## Objectif

Pas un linting. Un **audit produit** : le code actuel peut-il atteindre les benchmarks de STRATEGY.md §9 ?
Chaque écart trouvé → finding documenté → tâche ajoutée au backlog.

---

## Phase 1 : Snapshot technique (2 min)

```bash
echo "=== Structure ==="
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l
find src/ -type f -name "*.test.*" | wc -l

echo "=== Santé ==="
pnpm typecheck 2>&1 | tail -5
pnpm test 2>&1 | tail -10

echo "=== Dettes ==="
echo "any:" && grep -rc "any" src/ --include="*.ts" --include="*.tsx" | awk -F: '{s+=$2}END{print s}'
echo "as any:" && grep -rc "as any" src/ --include="*.ts" --include="*.tsx" | awk -F: '{s+=$2}END{print s}'
echo "console.log:" && grep -rc "console.log" src/ --include="*.ts" --include="*.tsx" | awk -F: '{s+=$2}END{print s}'
echo "TODO/FIXME:" && grep -rc "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx" | awk -F: '{s+=$2}END{print s}'

echo "=== Encryption ==="
echo "Tokens en clair ?" && grep -rn "apiKey\|api_key\|token\|secret" src/ --include="*.ts" | grep -v "encrypt\|decrypt\|cipher\|ENCRYPTED" | head -10

echo "=== Zod coverage ==="
echo "Routes sans Zod :" && find src/app/api -name "route.ts" -exec grep -L "z\.\|zod" {} \;
```

---

## Phase 2 : Audit par composant (STRATEGY.md §6.2)

Pour CHAQUE composant ci-dessous, lis les fichiers source correspondants et compare avec la cible STRATEGY.md.

### 2.1 Enrichissement prospect (STRATEGY §6.2 → cible 6/10, actuel 2.5/10)

**Fichiers à lire :**
- `src/server/lib/enrichment/jina-scraper.ts`
- `src/server/lib/enrichment/summarizer.ts`
- `src/server/lib/connectors/apify.ts`
- `src/server/lib/tools/enrichment-tools.ts`

**Questions :**
- [ ] Combien de pages sont scrapées par entreprise ? (cible : 3-5 — homepage + about + blog + careers + press)
- [ ] Y a-t-il un cache par domaine ? (cible : oui, même entreprise = 1 seul scrape)
- [ ] Les données LinkedIn (Apify) sont-elles intégrées au summarizer output ?
- [ ] Le summarizer extrait-il : painPoints, recentNews, techStack, products, targetMarket, valueProposition, hiringSignals ?
- [ ] Y a-t-il un fallback si Jina/Apify fail ?

### 2.2 ICP Scoring (STRATEGY §6.2 → cible 7/10, actuel 5/10)

**Fichiers à lire :**
- `src/server/lib/enrichment/icp-scorer.ts`
- `src/server/lib/tools/instantly-tools.ts` (chercher `source_leads`)

**Questions :**
- [ ] Le scoring est-il fit-only ou multi-dimensionnel (fit + intent + timing) ?
- [ ] Le bug `industry: null` dans `instantly_source_leads` est-il corrigé ?
- [ ] Les filtres supprimés au broadening deviennent-ils des signaux de scoring bonus ?
- [ ] Y a-t-il un feedback loop si 80% des leads sont éliminés ?

### 2.3 Email Copywriting (STRATEGY §6.2 → cible 8/10, actuel 6/10)

**Fichiers à lire :**
- `src/server/lib/email/prompt-builder.ts`
- `src/server/lib/email/drafting.ts`
- Tous les system prompts utilisés pour les emails

**Questions :**
- [ ] Le prompt contient-il une instruction **connection bridge** explicite ? ("Choisis LE SEUL pain point qui résonne avec la solution du sender")
- [ ] Les triggers events sont-ils priorisés en opener ?
- [ ] TOUTES les données enrichies (techStack, products, targetMarket, valueProposition) sont-elles injectées dans le prompt ?
- [ ] Les follow-ups reçoivent-ils le body complet des steps précédents ?
- [ ] Y a-t-il un quality gate (score LLM + régénération si < 6) ?
- [ ] Combien de steps dans la séquence ? (cible : 5-6, actuel : 3)

### 2.4 Subject Lines (STRATEGY §6.2 → cible 6/10, actuel 2/10)

**Fichiers à lire :**
- Prompt de génération des subject lines (dans prompt-builder ou drafting)

**Questions :**
- [ ] Y a-t-il une librairie de patterns (question, observation, curiosité, direct, personnalisé) ?
- [ ] Combien de variantes sont générées par step ? (cible : 2-3)
- [ ] Les variantes utilisent-elles `variants[]` natif Instantly ?

### 2.5 A/B Testing (STRATEGY §6.2 → actuel 0/10)

**Questions :**
- [ ] Le code utilise-t-il `variants[]` de l'API Instantly ?
- [ ] Y a-t-il un mécanisme d'auto-pause des variantes faibles ?

### 2.6 Cadence & Séquence (STRATEGY §6.2 → cible 7/10, actuel 4/10)

**Questions :**
- [ ] Combien de steps ? (cible : 5-6)
- [ ] Les delays sont-ils variables ? (cible : 0-2-5-9-14-21)
- [ ] Y a-t-il une logique conditionnelle (ouvert sans réponse → delay court) ?

### 2.7 Feedback Loop (STRATEGY §6.2 → cible 5/10, actuel 1.5/10)

**Fichiers à lire :**
- `src/server/lib/email/style-learner.ts`

**Questions :**
- [ ] Les stats Instantly (open, reply, click) sont-elles récupérées et stockées ?
- [ ] Le style learner catégorise-t-il les corrections (subject vs tone vs CTA) ?
- [ ] Les winners A/B sont-ils propagés ?

### 2.8 Pipeline post-launch (STRATEGY §11 → actuel 0/10)

**Questions :**
- [ ] LeadStatus a-t-il les statuts post-PUSHED ? (SENT, REPLIED, INTERESTED, MEETING_BOOKED, etc.)
- [ ] Y a-t-il un webhook endpoint pour Instantly ?
- [ ] Y a-t-il un reply management (classify + draft reply) ?

---

## Phase 3 : Audit technique transverse

### 3.1 Conventions CLAUDE.md

```bash
# Encryption — tokens en clair ?
grep -rn "apiKey\|api_key\|apiToken\|secret" prisma/schema.prisma

# Zod — routes sans validation ?
for f in $(find src/app/api -name "route.ts"); do
  if ! grep -q "z\.\|zod\|ZodSchema" "$f"; then
    echo "⚠️  Pas de Zod: $f"
  fi
done

# AI logging — appels LLM sans logging ?
grep -rn "mistral\|anthropic\|openai" src/server/ --include="*.ts" | grep -v "aiEvent\|logEvent\|AI_EVENT"

# Error handling — try/catch génériques ?
grep -rn "catch (e)" src/ --include="*.ts" --include="*.tsx" | grep -v "instanceof"
```

### 3.2 Performance

- Requêtes Prisma N+1 (inclure les relations quand c'est itéré)
- Appels Jina en série vs en parallèle (respecter le rate limit 20/min)
- Taille du contexte LLM (le prompt-builder ne doit pas dépasser 4K tokens input)

---

## Phase 4 : Générer les findings + mettre à jour le backlog

Pour CHAQUE problème trouvé :

1. Crée un fichier `.claude/findings/{date}-{topic}.md` avec le format standard
2. Ajoute la tâche corrective dans `.claude/tasks/BACKLOG.md` dans le bon tier
3. Priorise : CRITICAL/HIGH dans le tier courant, MEDIUM/LOW en fin de backlog

---

## Phase 5 : Rapport

```
📊 AUDIT LEADSENS — [date]

Score estimé : [X]/10 (était 4.2/10 au dernier audit)

Composant        | Score | Cible | Écart
─────────────────┼───────┼───────┼──────
Enrichissement   | X/10  | 6/10  | ...
ICP Scoring      | X/10  | 7/10  | ...
Copywriting      | X/10  | 8/10  | ...
Subject Lines    | X/10  | 6/10  | ...
A/B Testing      | X/10  | 5/10  | ...
Cadence          | X/10  | 7/10  | ...
Feedback Loop    | X/10  | 5/10  | ...
Post-launch      | X/10  | 5/10  | ...

🔴 Findings CRITICAL : [N]
🟠 Findings HIGH : [N]
🟡 Findings MEDIUM : [N]
⚪ Findings LOW : [N]

📝 Tâches ajoutées au backlog : [N]
🔜 Prochaine action recommandée : [description]
```
