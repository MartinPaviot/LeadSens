# 16 — Dashboard orchestration (`BrandIntelDashboard.tsx`)

## Rôle

Composant client orchestrateur qui :
1. Au mount : GET `/api/agents/bmi/dashboard` → hydrate l'UI avec les derniers runs persistés (ou mock data si aucun run).
2. Affiche 4 onglets (Overview, Online Presence, Trends, Competitive).
3. Permet de lancer individuellement ou séquentiellement les 3 agents via SSE.
4. Gère le formulaire de BrandProfile (upsert via `/api/brand-profile`).
5. Gère le flow OAuth Composio (query param `?connected=facebook` après callback).

## Fichier

`src/components/brand-intel/BrandIntelDashboard.tsx` — 340 lignes, 1 composant.

## State machine

```ts
type AgentKey = 'bpi' | 'mts' | 'cia'
type AgentState = 'idle' | 'running' | 'done' | 'error'
type TabId = 'overview' | 'audit' | 'trends' | 'competitive'

interface Runs {
  bpi: AgentOutput<BpiOutput> | null
  mts: AgentOutput<MtsOutput> | null
  cia: AgentOutput<CiaOutput> | null
}
```

États locaux (useState) :
- `runs: Runs` — résultats des 3 derniers runs
- `profile: BrandProfile | null`
- `showProfileForm: boolean`
- `socialStatus: { facebookConnected, instagramConnected }`
- `agentStates: Record<AgentKey, AgentState>`
- `progress: Record<AgentKey, string>` — dernier message SSE status
- `activeTab: TabId`
- `loaded: boolean` — pour afficher spinner au mount

Pas de Zustand/Redux/Context — tout en local state d'un seul composant parent.

## Routes des agents

```ts
const AGENT_ROUTES: Record<AgentKey, string> = {
  bpi: '/api/agents/bmi/bpi-01',
  mts: '/api/agents/bmi/mts-02',
  cia: '/api/agents/bmi/cia-03',
}
```

## Chargement initial (useEffect au mount)

```ts
useEffect(() => {
  async function load() {
    try {
      const res = await fetch('/api/agents/bmi/dashboard')
      const data = await res.json() as DashboardData
      if (data.bpi || data.mts || data.cia) {
        setRuns({ bpi: data.bpi, mts: data.mts, cia: data.cia })
        if (data.profile) { setProfile(data.profile); setSocialStatus(...) }
      } else {
        // Pas de runs → mock data
        setRuns({ bpi: mockDashboardData.bpi, mts: ... })
        setProfile(mockDashboardData.profile)
      }
    } catch {
      setRuns({ /* fallback mock */ })
      setProfile(mockDashboardData.profile)
    } finally { setLoaded(true) }
  }
  void load()
}, [])
```

**Fallback mock data** (`mockDashboardData.ts`) : garantit que l'UI n'est jamais vide, utile pour démo et onboarding.

## Flow OAuth callback

```ts
useEffect(() => {
  const connected = searchParams.get('connected')
  if (connected) {
    toast.success(`${capitalize(connected)} connected successfully`)
    setSocialStatus((prev) => ({ ...prev, [`${connected}Connected`]: true }))
    router.replace('/brand-intel')  // nettoie l'URL
  }
  const error = searchParams.get('error')
  if (error) {
    toast.error(`Connection failed: ${error}`)
    router.replace('/brand-intel')
  }
}, [searchParams, router])
```

## Lancer un agent (`launchAgent`)

Voir `13-sse-streaming.md` pour le détail complet du SSE client. Résumé :

```ts
const launchAgent = useCallback(async (agentKey: AgentKey) => {
  setAgentState(agentKey, 'running')
  const response = await fetch(AGENT_ROUTES[agentKey], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority_channels: profile?.priority_channels }),
  })

  // Handle 400 NO_PROFILE → ouvre le formulaire
  if (response.status === 400) {
    const body = await response.json()
    if (body.error === 'NO_PROFILE') {
      setShowProfileForm(true)
      setAgentState(agentKey, 'error')
      return
    }
  }

  // Read SSE stream
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      const event = JSON.parse(line.slice(6))
      if (event.event === 'status')  setAgentProgress(agentKey, event.message)
      if (event.event === 'result')  updateRun(agentKey, event.output)
      if (event.event === 'finish')  setAgentState(agentKey, 'done')
      if (event.event === 'error')   setAgentState(agentKey, 'error')
    }
  }
}, [profile, ...])
```

## Lancer tous les agents (séquentiel)

```ts
const launchAll = useCallback(async () => {
  await launchAgent('bpi')   // 1. BPI en premier
  await launchAgent('mts')   // 2. MTS ensuite
  await launchAgent('cia')   // 3. CIA en dernier (utilise scores.social de BPI)
}, [launchAgent])
```

**Raison du séquentiel** :
1. CIA-03 lit le dernier run BPI-01 pour cross-référencer `scores.social`.
2. Éviter de saturer les APIs externes avec 3 runs parallèles (SerpAPI, DataForSEO).
3. UX : l'utilisateur voit la progression linéaire (1 agent à la fois).

Le bouton "Run all agents" disable pendant qu'un agent tourne :

```tsx
const isAnyRunning = Object.values(agentStates).some((s) => s === 'running')

<Button onClick={() => void launchAll()} disabled={isAnyRunning}>
  {isAnyRunning ? 'Running...' : 'Run all agents'}
</Button>
```

## Sauvegarde du profil

```ts
const handleSaveProfile = useCallback(async (data: BrandProfileFormData) => {
  const res = await fetch('/api/brand-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Save failed')
  setProfile(body)
  setShowProfileForm(false)
  toast.success('Profile saved')
}, [])
```

## Structure JSX (rendu)

```tsx
return (
  <div className="flex flex-col h-full">
    {/* Header : 56px, bouton "Run all", ThemeToggle, GearSix (settings) */}
    <div className="h-14 border-b px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
      <h1>Dashboard</h1>
      <div className="flex items-center gap-1.5">
        <Button onClick={launchAll} disabled={isAnyRunning}
                style={{ background: 'linear-gradient(90deg, #17c3b2, #FF7A3D)' }}>
          {isAnyRunning ? 'Running...' : 'Run all agents'}
        </Button>
        <ThemeToggle />
        <button onClick={() => setShowProfileForm(true)}><GearSix size={18} /></button>
      </div>
    </div>

    {/* AgentProgress : 3 cards état des agents */}
    <AgentProgress states={agentStates} progress={progress} onLaunchAgent={...} disabled={isAnyRunning} />

    {/* TabNav : Overview / Online Presence / Trends / Competitive */}
    <TabNav tabs={TABS} active={activeTab} onChange={...} />

    {/* Tab content */}
    <div className="flex-1 overflow-auto">
      {activeTab === 'overview'    && <OverviewTab    runs={runs} />}
      {activeTab === 'audit'       && runs.bpi && <AuditTab       output={runs.bpi.payload} />}
      {activeTab === 'trends'      && runs.mts && <TrendsTab      output={runs.mts.payload} />}
      {activeTab === 'competitive' && runs.cia && <CompetitiveTab output={runs.cia.payload} />}
    </div>
  </div>
)
```

## Modals / formulaire

Quand `showProfileForm === true` ou `profile === null`, le rendu bascule sur `<BrandProfileForm>` à la place du dashboard :

```tsx
if (showProfileForm || !profile) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1>Agent Settings</h1>
      <BrandProfileForm
        initialData={profile ? { /* ... */ } : undefined}
        onSave={handleSaveProfile}
        socialStatus={socialStatus}
      />
    </div>
  )
}
```

## Intégration dans Elevay

### Page

Créer `src/app/(dashboard)/brand-intel/page.tsx` :

```tsx
import { BrandIntelDashboard } from '@/components/brand-intel/BrandIntelDashboard'

export default function Page() {
  return <BrandIntelDashboard />
}
```

### Layout parent

La page est dans le groupe `(dashboard)` d'Elevay — elle hérite du layout avec sidebar + header d'Elevay. Le dashboard s'adapte : il n'a **pas** sa propre sidebar, il s'insère dans la zone de contenu principale.

⚠️ Si le layout parent d'Elevay n'a pas `height: 100vh` / flex column, le `h-full` du dashboard ne fonctionnera pas (pas de parent pour déterminer la hauteur). Vérifier que le layout d'Elevay passe bien la hauteur au children.

### Lien sidebar

Dans la sidebar d'Elevay, ajouter un item :

```tsx
<Link href="/brand-intel">
  <ChartBarIcon /> Brand Intel
</Link>
```

## Adaptations pour multi-tenant

Actuellement, le dashboard repose sur `WORKSPACE_ID = 'hackathon'` (constante globale). Pour Elevay multi-tenant :

1. Dans les route handlers, remplacer `WORKSPACE_ID` par l'ID de workspace/team de la session :

```ts
// Avant :
await db.brandProfile.findUnique({ where: { workspaceId: WORKSPACE_ID } })

// Après :
const workspaceId = session.user.activeWorkspaceId  // depuis Better Auth
await db.brandProfile.findUnique({ where: { workspaceId } })
```

2. Idem pour `db.agentRun.findFirst()` et `db.agentRun.create()`.

Voir question 3 de `19-open-questions.md`.

## Checklist dashboard

- [ ] `BrandIntelDashboard.tsx` copié dans `src/components/brand-intel/`
- [ ] Tous les sous-composants copiés (OverviewTab, AuditTab, ...)
- [ ] `mockDashboardData.ts` copié (utile pour démo)
- [ ] Page `(dashboard)/brand-intel/page.tsx` créée et monte le composant
- [ ] Lien sidebar d'Elevay pointe vers `/brand-intel`
- [ ] Test mount : arriver sur `/brand-intel` → spinner → fallback mock data OU vraies data
- [ ] Test bouton "Run all agents" : les 3 progressent séquentiellement, les tabs se mettent à jour
- [ ] Test OAuth : bouton "Connect Facebook" → redirect → callback → toast success
