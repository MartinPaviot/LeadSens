# 19 — Questions ouvertes à trancher AVANT l'intégration

> Les 18 questions ci-dessous ne t'ont pas été posées directement, mais chacune change la façon dont l'intégration doit se faire dans Elevay. Note ta décision à côté de chaque question.

## Bloc A — Compatibilité de versions

### Q1. Version Next.js d'Elevay ?

brand-intello est en **Next 16.2.2** avec des breaking changes signalés dans son `AGENTS.md`. Notamment :
- Comportement des route handlers (`export const dynamic`, `maxDuration`)
- API `headers()` asynchrone (`await headers()`)
- Middleware API (`NextRequest`, matcher)

**Impact** :
- Si Elevay **= Next 16** : intégration directe.
- Si Elevay **= Next 15** : adapter les `await headers()` (optionnel en 15, obligatoire en 16), vérifier les route handlers.
- Si Elevay **= Next 14 (App Router)** : probable upgrade + adaptation.
- Si Elevay **= Next 14 (Pages Router)** : ce guide ne couvre pas ce cas, migration d'Elevay vers App Router nécessaire.

**Ta décision** : ____________________

### Q2. Version React / Prisma d'Elevay ?

- **React 19** requis pour l'UI copiée telle quelle (composants client modernes, pas de legacy API).
- **Prisma 7** utilisé avec `generator provider = "prisma-client"` et output custom.

**Ta décision React** : ____________________
**Ta décision Prisma** : ____________________

## Bloc B — Convention de tenancy

### Q3. Multi-tenant ou mono-tenant dans Elevay ?

brand-intello utilise une constante `WORKSPACE_ID = 'hackathon'` (mono-tenant). Elevay a probablement des équipes / orgs / workspaces réels.

**Choix** :
- **A** : garder `WORKSPACE_ID` constant (pas multi-tenant, tout le monde voit le même profile) — **mauvaise idée en prod**
- **B** : brancher `workspaceId` = `session.user.id` (1 profile par user)
- **C** : brancher `workspaceId` = `session.user.activeOrganizationId` ou équivalent team (Better Auth org plugin)

**Ta décision** : ____________________

**Si B ou C**, chaque route handler doit remplacer :
```ts
// Avant
const profileRow = await db.brandProfile.findUnique({ where: { workspaceId: WORKSPACE_ID } })

// Après
const workspaceId = session.user.id // ou session.activeOrganizationId
const profileRow = await db.brandProfile.findUnique({ where: { workspaceId } })
```

### Q4. Conflits de paths d'API dans Elevay ?

brand-intello utilise :
- `/api/agents/bmi/{bpi-01, mts-02, cia-03, dashboard}`
- `/api/brand-profile`
- `/api/auth/social/{connect, callback, disconnect}`

**Vérifier** : Elevay a-t-il déjà un de ces paths ?

**Ta décision** : ____________________ (liste des renommings nécessaires)

## Bloc C — Schéma DB

### Q5. Divergences du modèle `User` ?

Elevay a sûrement ajouté des champs à `User` : `role`, `organizationId`, `stripeCustomerId`, `onboardingComplete`, `plan`, etc.

**À vérifier** : lister les champs `User` d'Elevay et confirmer qu'ils seront préservés par la migration `add_brand_intel_agents`.

**Action** : `pnpm prisma migrate dev --create-only` (sans appliquer), relire le SQL généré, confirmer qu'il **ne touche pas** à la table `user`.

### Q6. Noms de tables `@@map(...)` identiques ?

brand-intello mappe :
- `user`, `session`, `account`, `verification`

Si Elevay utilise d'autres noms (`users`, `sessions`, `auth_user`, etc.), **ne rien changer côté Elevay**. Better Auth accepte de custom les noms via sa config.

**Ta décision** : ____________________

### Q7. Providers OAuth déjà configurés dans Better Auth d'Elevay ?

brand-intello n'a que `emailAndPassword: { enabled: true }`. Elevay a probablement Google, GitHub, etc. en plus.

**Action** : garder la config Better Auth d'Elevay telle quelle. La minimaliste de brand-intello est un sous-ensemble.

**Ta décision** : ____________________

## Bloc D — UI / Design

### Q8. Style shadcn d'Elevay ?

brand-intello = **`base-nova`** (sous `@base-ui/react`).

Si Elevay utilise `default` ou `new-york` (sous Radix), les 7 primitives `src/components/ui/*` sont **incompatibles** sans refactor.

**Options** :
- **A (recommandé)** : Garder les primitives Elevay. Les composants brand-intel importent `@/components/ui/button` qui pointera sur Elevay. Vérifier que les props correspondent (variant, size, etc.).
- **B** : Namespacer en `src/components/ui-brand-intel/`. Isolation garantie.
- **C** : Migrer tout Elevay vers `base-nova`. Invasif, risqué.

**Ta décision** : ____________________

### Q9. Polices d'Elevay ?

brand-intello charge Public Sans + Geist Mono dans `layout.tsx`.

**Options** :
- Garder les polices d'Elevay, adapter les CSS vars `--font-*` dans Tailwind.
- Adopter Public Sans + Geist Mono (ajouter au layout d'Elevay).

**Ta décision** : ____________________

### Q10. Tailwind config d'Elevay (colors) ?

brand-intello définit `primary`, `secondary`, `accent`, etc. en CSS vars. Si Elevay a déjà ces noms avec des valeurs différentes, **conflit visuel** : les composants shadcn auront les couleurs d'Elevay, mais les composants brand-intel qui utilisent `bg-teal` ou `bg-orange` (hardcoded) auront la palette brand-intello.

**Options** :
- Accepter le mix (si cohérent avec la marque Elevay).
- Remplacer `bg-teal` / `bg-orange` dans les composants brand-intel par les tokens Elevay.
- Remplacer les CSS vars d'Elevay par celles de brand-intello (refonte design).

**Ta décision** : ____________________

### Q11. Middleware d'Elevay ?

Matcher existant d'Elevay ?

**Action** : ajouter `'/brand-intel/:path*'` au matcher existant, **ne pas remplacer**.

**Ta décision** : ____________________ (lister le matcher actuel)

## Bloc E — Opérations

### Q12. Budget APIs externes ?

Coût estimé par run complet : **~$0.40** (voir `11-external-data-apis.md`).

Si budget limité, possibilités :
- Désactiver certains modules (ex: Trustpilot, Google Maps — pas dans le score)
- Cacher les résultats (24h TTL)
- Rate-limiter les runs par user

**Ta décision** : budget/mois + modules à désactiver si besoin ____________________

### Q13. Compte Composio partagé avec brand-intello ou nouveau ?

Les IDs actuels dans brand-intello (`ac_kARFNprSLryc`, `ac_ZN-brYCj4Kf3`) sont liés à **ton compte Composio actuel**.

**Options** :
- Réutiliser les mêmes auth configs et ajouter le domaine Elevay aux redirect URIs autorisés.
- Créer de nouveaux auth configs dans Composio pour Elevay (isolation).

**Ta décision** : ____________________

### Q14. Domaines de prod / callback OAuth ?

Liste des environnements (dev, staging, prod) + domaines → chaque domaine doit être :
- Dans `NEXT_PUBLIC_APP_URL` (par env)
- Dans les redirect URIs des auth configs Composio
- Dans les paramètres Facebook App (Developer Console) pour valider le domaine

**Ta décision** : ____________________

## Bloc F — Code organisation

### Q15. Prisma generator path custom ?

brand-intello utilise `output = "../src/generated/prisma"` → imports `@/generated/prisma/client`.

**Options** :
- Adopter le path custom dans Elevay (modifier `schema.prisma`, réécrire les imports Elevay). Propre mais invasif.
- Garder le path standard `@prisma/client` dans Elevay, find & replace les imports dans les fichiers copiés de brand-intello.

**Ta décision** : ____________________

### Q16. Runner de tests : Vitest ou Jest ?

brand-intello = Vitest. Si Elevay = Jest, options :
- Ajouter Vitest en parallèle (coexistence OK, différents scripts `pnpm test` vs `pnpm test:vitest`).
- Porter les tests brand-intello en Jest (aucun test pour l'instant, donc rien à porter).

**Ta décision** : ____________________

## Bloc G — Fonctionnel

### Q17. Internationalisation d'Elevay ?

Les prompts brand-intello gèrent FR/EN via le champ `language` de `BrandProfile`. L'UI est principalement en anglais (textes hardcodés dans les tabs).

**Options** :
- Laisser l'UI en anglais (`Run all agents`, `Online Presence`, etc.)
- Traduire les textes UI via le système i18n d'Elevay (next-intl, next-i18next, etc.)

**Ta décision** : ____________________

### Q18. Chat agentique existant dans Elevay ?

brand-intello n'a **pas** de chat conversationnel — chaque run est stateless. Si Elevay a déjà un chat agentique (historique, threads, messages), ce sont deux paradigmes distincts.

**Recommandation** : ne pas essayer de fusionner. Brand Intel vit dans `/brand-intel`, le chat vit ailleurs. Les deux coexistent sans se parler.

**Ta décision** : ____________________

## Questions bonus à te poser toi-même

- **Quelle doit être l'UX si l'utilisateur revient plusieurs fois** ? Afficher l'historique des runs ? Comparer N-1 vs N ?
- **Tu veux garder le mock data en fallback, ou afficher un empty state** quand aucun run n'existe ?
- **Tu comptes faire un système d'export PDF / Notion / Slack** des résultats ? Pas dans brand-intello, à ajouter après.
- **Tu as un utilisateur target (PME ? agence ? brand manager ?)** qui va influencer les copys / empty states / onboarding ?
- **Tu veux un bouton "Re-run with same profile" distinct du "Run all agents"** ? Différence : re-run garde le profile comme snapshot, run-all propose de modifier le profile d'abord.
- **Les priorités 90j / roadmap 30j / action plan 60j ont vocation à être cochées ? Assignées ?** Si oui, ajouter des tables `Task` / `Action` à la DB, pas dans brand-intello actuellement.
