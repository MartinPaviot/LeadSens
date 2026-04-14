# 07 — Architecture commune des 3 agents

## Pattern général

Tous les agents (BPI-01, MTS-02, CIA-03) suivent **le même pipeline** :

```
┌─────────────────────────────────────────────────────────────────────┐
│  HTTP POST /api/agents/bmi/<code>                                    │
│                                                                       │
│  1. Auth check  (Better Auth session)                                 │
│  2. Load BrandProfile (Prisma)                                        │
│  3. (optional) Load previous AgentRun pour delta                      │
│  4. Build AgentProfile                                                │
│  5. Open SSE stream → createSSEStream()                               │
│      │                                                                │
│      ├─► emit('status', ...)    [progression]                         │
│      │                                                                │
│      ├─► Phase 1: fetch modules en parallèle (Promise.allSettled)    │
│      │      • module A          ┐                                     │
│      │      • module B          │                                     │
│      │      • module C          │                                     │
│      │      • ...               ┘                                     │
│      │                                                                │
│      ├─► Phase 2: scoring / synthesis local (pure calculation)        │
│      │                                                                │
│      ├─► Phase 3: 1 seul appel LLM Claude (prompt consolidé)          │
│      │                                                                │
│      ├─► Phase 4: parse + merge résultats LLM                         │
│      │                                                                │
│      ├─► Phase 5: Prisma persist (AgentRun.create)                    │
│      │                                                                │
│      ├─► emit('result', { output: payload })                          │
│      └─► emit('finish', { durationMs, degraded_sources })             │
└─────────────────────────────────────────────────────────────────────┘
```

## Contrats de types — `src/agents/_shared/types.ts`

```ts
export interface AgentProfile {
  workspaceId: string
  brand_name: string
  brand_url: string
  country: string
  language: string // "fr" | "en" | ...
  competitors: Array<{ name: string; url: string }>
  primary_keyword: string
  secondary_keyword: string
  sector?: string
  priority_channels?: string[]
  objective?: string
  facebookConnected?: boolean
  facebookComposioAccountId?: string
  instagramConnected?: boolean
  instagramComposioAccountId?: string
}

export interface ModuleResult<T> {
  success: boolean
  data: T | null
  source: string        // "serp" | "gnews" | ...
  error?: { code: string; message: string }
  degraded?: boolean    // true = partiel mais exploitable
}

export interface AgentOutput<T> {
  agent_code: 'BPI-01' | 'MTS-02' | 'CIA-03'
  analysis_date: string // ISO 8601
  brand_profile: AgentProfile
  payload: T
  degraded_sources: string[]
  version: '1.0'
}
```

## Dégradation gracieuse

- Chaque module retourne `ModuleResult<T>` — jamais un throw.
- `Promise.allSettled` au lieu de `Promise.all` : une erreur dans un module **n'arrête pas** les autres.
- Un module échoué ajoute son nom au tableau `degraded_sources`, et le payload final inclut `null` pour ce champ.
- Le LLM reçoit le prompt consolidé avec `"Data unavailable"` pour les modules échoués — la réponse garde sa structure.

## Appel LLM — `src/agents/_shared/llm.ts`

### Client + parser robuste

```ts
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

function parseRobust(raw: string): unknown {
  let s = raw.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '') // strip fences
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) {
    const aStart = s.indexOf('[')
    const aEnd = s.lastIndexOf(']')
    if (aStart === -1 || aEnd === -1) return null
    s = s.slice(aStart, aEnd + 1)
  } else {
    s = s.slice(start, end + 1)
  }
  s = s.replace(/,\s*([\]}])/g, '$1')  // clean trailing commas
  return JSON.parse(s)
}
```

### Appel avec timeout

```ts
export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.3,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    }, { signal: controller.signal })

    const firstBlock = response.content[0]
    const content = firstBlock?.type === 'text' ? firstBlock.text : ''
    return {
      content,
      parsed: parseRobust(content),
      tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      latencyMs: Date.now() - start,
      model: response.model,
    }
  } catch (err) {
    return { content: '', parsed: null, tokens: { input: 0, output: 0 }, latencyMs: Date.now() - start, model: 'error' }
  } finally {
    clearTimeout(timeout)
  }
}
```

**Points critiques** :
- Modèle **`claude-sonnet-4-6`** (pas `claude-3-opus` ou autre).
- Temperature **`0.3`** pour stabilité du JSON (0.4 pour MTS-02 qui a besoin de plus de créativité).
- Max tokens **`4096`** — largement suffisant pour les réponses JSON structurées.
- Timeout **`45_000` ms** — supérieur à `AbortSignal.timeout(15_000)` des modules data, laisse de la marge.
- **Pas de tool-use** : Claude renvoie du **JSON pur**, parsé côté serveur. Pas de function-calling côté LLM.

## Prompt system — invariants communs

Tous les prompts système des 3 agents partagent ces règles :

1. **Language pinning** : `"CRITICAL: You MUST respond ENTIRELY in ${language}. Every field value must be in ${language}."` — évite les mélanges FR/EN.
2. **Format strict** : `"Return ONLY the JSON object. No markdown fences. No text before or after."`
3. **Schéma inline** : le prompt contient un exemple exact de la structure JSON attendue.
4. **Règles mandatoires** : listes avec `"MUST have exactly N items"`, `"NEVER return an empty array"`.

Le parser `parseRobust` gère les cas où Claude échappe aux consignes (fences markdown, texte avant/après) — robustesse en défense.

## Parse + validation Zod

Aucune validation Zod sur la **sortie** du LLM : à la place, des **type guards manuels** :

```ts
interface LlmBpiResponse {
  axis_diagnostics: AxisDiagnostic[]
  priorities_90d: Priority90d[]
}

function isLlmBpiResponse(v: unknown): v is LlmBpiResponse {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  return Array.isArray(obj['axis_diagnostics']) && Array.isArray(obj['priorities_90d'])
}
```

Si le guard échoue, l'agent retombe sur :
- Les scores / synthesis locales (calculées sans LLM).
- Un champ `warning: "AI analysis returned partial results"` dans le payload.

## Persistance

```ts
await db.agentRun.create({
  data: {
    workspaceId: WORKSPACE_ID,
    agentCode: 'BPI-01',
    status: output.degraded_sources.length > 0 ? 'PARTIAL' : 'COMPLETED',
    output: output as any, // JSON field, double cast documenté
    degradedSources: output.degraded_sources,
    durationMs: Date.now() - startedAt,
    brandProfileId: profileRow.id,
  },
})
```

## Index des runs pour delta

Les agents utilisent `findFirst({ orderBy: { createdAt: 'desc' } })` pour lire le run précédent :

- **BPI-01** → attache `previous: { global, serp, press, youtube, social, seo, benchmark, date }` à `scores` pour afficher le delta dans l'UI.
- **MTS-02** → load comparison metadata.
- **CIA-03** → lit le dernier `BPI-01` pour connaître `brandSocialScore` (cross-signal).

L'index `@@index([workspaceId, agentCode, createdAt])` est là pour ça.

## Inter-agent communication (CIA-03 utilise BPI-01)

Dans `src/app/api/agents/bmi/cia-03/route.ts`, avant de lancer l'agent :

```ts
const lastBpi = await db.agentRun.findFirst({
  where: { workspaceId, agentCode: 'BPI-01' },
  orderBy: { createdAt: 'desc' },
})
const socialScore = /* extrait de lastBpi.output.payload.scores.social */
await runCia03(profile, context, socialScore)
```

C'est pourquoi le dashboard lance **BPI → MTS → CIA** séquentiellement (et non en parallèle) :

```ts
// BrandIntelDashboard.tsx
const launchAll = useCallback(async () => {
  await launchAgent('bpi')
  await launchAgent('mts')
  await launchAgent('cia')
}, [launchAgent])
```

## Limites de durée

```ts
export const maxDuration = 60
export const dynamic = 'force-dynamic'
```

Chaque route handler a un `maxDuration = 60` (secondes). Sur Vercel hobby, la limite est 10s → il faut un plan Pro (60s) ou Enterprise pour exécuter en prod. En dev local, pas de limite.

Si Elevay tourne sur un runtime avec des limites plus basses (edge runtime, Cloudflare Workers 30s), envisager :
- Découper l'exécution (lancer les modules via un job queue)
- Basculer en mode polling côté client au lieu de SSE long

## Coût LLM

Pour 1 run de chaque agent (estimation) :
- BPI-01 prompt consolidé ≈ 2-3k tokens input, 1-2k output → **$0.03-0.06** par run (Sonnet 4.6 pricing)
- MTS-02 ≈ 3-4k input, 2k output → **$0.05-0.08**
- CIA-03 ≈ 2k input, 1k output → **$0.02-0.04**

Total `launchAll` ≈ **$0.10-0.18** par run complet. Multiplier par le nombre d'utilisateurs pour budgéter.

## Fichiers à copier (intégralement)

```
src/agents/_shared/llm.ts
src/agents/_shared/types.ts
src/agents/_shared/composio.ts
src/agents/_shared/apify.ts
src/agents/_shared/social-oauth.ts
src/agents/_shared/utils.ts
```

Aucun risque de collision avec Elevay (dossier `agents/` nouveau).
