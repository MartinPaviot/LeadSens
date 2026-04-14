# 13 — Server-Sent Events (SSE) — streaming des runs agents

## Helper serveur — `src/lib/sse.ts`

Code complet de brand-intello (31 lignes) :

```ts
export function createSSEStream(
  handler: (emit: (event: string, data: Record<string, unknown>) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: Record<string, unknown>) => {
        const payload = `data: ${JSON.stringify({ event, ...data })}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      try {
        await handler(emit)
      } catch (err) {
        console.error('[SSE] Handler error:', String(err))
        emit('error', { message: 'Agent execution failed. Please retry.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

### Format de message SSE

Chaque message envoyé suit la spec SSE :

```
data: {"event":"status","message":"[1/8] Analyse SERP...","index":1,"total":8}

data: {"event":"result","output":{...}}

data: {"event":"finish","durationMs":12345,"degraded_sources":[]}
```

**Points importants** :
- Double newline (`\n\n`) après chaque ligne `data:` — **obligatoire** pour respecter le format SSE.
- Le champ `event` dans le JSON n'est **pas** le champ SSE natif `event:` — c'est un nom conventionnel dans le payload. Tous les messages utilisent le canal par défaut `data:`.
- Pas de retry hint côté client — si la connexion drop, le client re-fetch manuellement.

### Usage côté route handler

```ts
export async function POST(req: Request) {
  // auth + load profile
  // ...
  return createSSEStream(async (emit) => {
    emit('status', { message: '[0/8] Démarrage...', index: 0, total: 8 })
    const output = await runBpi01(profile)
    emit('status', { message: '[8/8] Terminé', index: 8, total: 8 })
    await db.agentRun.create({ data: { /* ... */ } })
    emit('result', { output: output.payload })
    emit('finish', { durationMs: Date.now() - startedAt, degraded_sources: output.degraded_sources })
  })
}
```

## Consommation côté client

Fichier : `src/components/brand-intel/BrandIntelDashboard.tsx` lignes 157-223 (fonction `launchAgent`)

### Pourquoi pas `EventSource` ?

- `EventSource` force la méthode GET → incompatible avec `POST /api/agents/bmi/bpi-01`.
- `EventSource` n'envoie pas les cookies cross-origin sans configuration spéciale.

Solution : `fetch()` + lecture manuelle du `ReadableStream`.

### Pattern de consommation (buffer correct)

```ts
const response = await fetch(AGENT_ROUTES[agentKey], {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ priority_channels: profile?.priority_channels }),
})

if (response.status === 400) {
  const body = await response.json()
  if (body.error === 'NO_PROFILE') { setShowProfileForm(true); return }
}

if (!response.ok || !response.body) { setAgentState(agentKey, 'error'); return }

const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const parts = buffer.split('\n\n')
  buffer = parts.pop() ?? ''   // ⚠️ conserver le dernier morceau incomplet

  for (const part of parts) {
    const line = part.trim()
    if (!line.startsWith('data: ')) continue
    try {
      const event = JSON.parse(line.slice(6)) as {
        event: string
        message?: string
        output?: unknown
      }
      if (event.event === 'status' && event.message) setAgentProgress(agentKey, event.message)
      if (event.event === 'result') updateRun(agentKey, event.output)
      if (event.event === 'finish') setAgentState(agentKey, 'done')
      if (event.event === 'error') setAgentState(agentKey, 'error')
    } catch {
      // malformed chunk — ignore
    }
  }
}
```

### Règle critique : buffering

Un chunk TCP ne correspond **pas** forcément à un message SSE. Exemple :
- Le chunk 1 contient `data: {"event":"status","message":"[1/`
- Le chunk 2 contient `8] SERP"}\n\ndata: {"event":"result",...}`

Le split sur `\n\n` et la conservation du dernier morceau (`buffer = parts.pop()`) garantit qu'on ne parse que des messages complets. Erreur typique : faire `JSON.parse` sur un chunk sans buffering → crash dès le premier message coupé.

### Fallback si stream se termine sans `finish`

```ts
setAgentStates((prev) => {
  if (prev[agentKey] === 'running') return { ...prev, [agentKey]: 'done' }
  return prev
})
```

Si le serveur `controller.close()` sans avoir émis `finish` (timeout, crash), le client ne reste pas bloqué en "running".

## Durée max et timeouts

- Route handler : `maxDuration = 60` secondes (Vercel Pro).
- Client : pas de timeout global — la boucle `while (!done)` tient aussi longtemps que le stream.
- Si l'utilisateur ferme la tab : le fetch est `abort`é, le serveur continue (pas de cleanup). Pas de gros souci car les data sont persistées en DB à la fin.

## Alternative abandonnée : WebSocket

Pas de WebSocket dans brand-intello. Raisons :
- Next.js App Router ne supporte pas nativement les WebSockets dans les route handlers (nécessite un server custom).
- SSE suffit : communication server→client unidirectionnelle, compatible serverless, HTTP/2 multiplexing natif.

## Proxy / CDN considerations

- ✅ Vercel : forward SSE correctement.
- ✅ Cloudflare : forward, mais attention au timeout (100s par défaut Free tier).
- ⚠️ Nginx : ajouter `proxy_buffering off;` et `proxy_read_timeout 120s;` pour éviter que le reverse proxy bufferise tout le stream.

## Test SSE en isolation

```bash
curl -N -X POST http://localhost:3000/api/agents/bmi/bpi-01 \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=TOKEN" \
  -d '{}'
```

`-N` désactive le buffer curl. Tu dois voir s'afficher progressivement :

```
data: {"event":"status","message":"[0/8] Démarrage de l'audit...","index":0,"total":8}

data: {"event":"status","message":"[1/8] Analyse SERP...","module":"serp","index":1,"total":8}

...

data: {"event":"result","output":{"scores":{...},"axis_diagnostics":[...],...}}

data: {"event":"finish","durationMs":18432,"degraded_sources":[]}
```

## Fichiers à copier

```
src/lib/sse.ts    ✅ copier tel quel (31 lignes, pas de dép externe)
```

## Checklist SSE

- [ ] `src/lib/sse.ts` copié
- [ ] Routes agents retournent bien `createSSEStream(...)` (pas `Response.json(...)`)
- [ ] Client consomme via `fetch()` + ReadableStream reader + buffering sur `\n\n`
- [ ] Test curl streaming fonctionne
- [ ] Pas de proxy qui bufferise (vérifier Vercel/Cloudflare/Nginx en prod)
