# Plan: Implementera auto-trader-ai's LLM-Provider-Architektur i pCAD

> Mål: Ersätt pCAD:s nuvarande monolitiska opencode/HV-approach med auto-trader-ai's
> ProviderAdapter-mönster — med registry, router med fallback-kedja, DB-konfig,
> och en ren LLM-settings UI.

---

## Översikt av skillnader

| Aspekt        | pCAD (nu)                                                             | auto-trader-ai                          |
| ------------- | --------------------------------------------------------------------- | --------------------------------------- |
| Transport     | HTTP API (`POST /api/session` + SSE-polling)                          | CLI (`opencode run --format json`)      |
| Abstraktion   | `LanguageModelV2` (AI SDK, strömmande)                                | `ProviderAdapter` (enkel, blockerande)  |
| Routning      | `buildChatModel` switch-caser (`google/`, `local/`, `opencode/`, ...) | Prioritetskedja med automatisk fallback |
| Konfiguration | Miljövariabler (.env.local)                                           | DB-tabell `llm_provider_config`         |
| Inställningar | Ingen LLM-settings UI                                                 | Full UI med drag-and-drop priority      |
| Strömning     | ✅ AI SDK `streamText`                                                | ❌ Blocking — väntar på fullt svar      |

---

## Arkitekturval

### Strömningsproblem

auto-trader-ai's CLI-approach är **blockerande** — ingen strömning. pCAD:s chat-UI
bygger på AI SDK's `streamText` som kräver strömmande LanguageModelV2.

**Lösning: Två spår**

1. **Chat UI** — Behåll `LanguageModelV2` + AI SDK `streamText`.
   - `opencodeChatModel` fortsätter använda HTTP API (SSE-polling) för strömning.
   - Vi _refaktor_ inte bort detta förrän vi har en strömmande CLI-wrapper.

2. **Ej-strömmande operationer** — Titelgenerering, förslagsgenerering, bakgrundsjobb.
   - Bygg ny `ProviderAdapter`-baserad CLI-implementation för opencode.
   - Använd router för fallback (om opencode rate-limit, försök lokal/llama-swap).

---

## Del 1 — ProviderAdapter-bas (ny fil)

**Ny fil:** `src/lib/llm-providers/types.ts`

```typescript
export type Capability = 'reasoning' | 'fast' | 'vision' | 'long-context';

export interface CompleteInput {
  task: string;
  system?: string;
  capabilities?: Capability[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  provider?: string;
  enableThinking?: boolean;
}

export interface CompleteOutput {
  provider: string;
  model: string;
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface ProviderModel {
  id: string;
  label?: string;
}

export interface ProviderAdapter {
  id: string;
  label: string;
  isConfigured(): boolean;
  modelFor(caps: Capability[]): string;
  listModels?(): Promise<ProviderModel[]>;
  complete(input: CompleteInput): Promise<CompleteOutput>;
}
```

### Del 1.1 — CLI-hjälp

**Ny fil:** `src/lib/llm-providers/cli.ts`

- `spawn('opencode', args, { stdio: ['pipe','pipe','pipe'] })` med prompt till stdin
- `commandExists(bin)` med cache
- `runCli(bin, args, opts)` — timeout, error hantering
- `bridgeUrl()` / `runCliViaBridge()` — valfri HTTP-brygga för deployment
- `runCliOrBridge()` — försök lokalt, fallback till brygga

### Del 1.2 — Opencode ProviderAdapter

**Ny fil:** `src/lib/llm-providers/opencode-adapter.ts`

- Implementerar `ProviderAdapter`
- `complete()`: `opencode run --format json --pure -m <model>` → läs JSONL från stdout → `lastText()`
- `listModels()`: `opencode models` → parse CLI-utdata
- `isConfigured()`: `commandExists('opencode')`
- Kör i temp-katalog (`mkdtemp`) för isolation
- Timeout: 10 minuter

---

## Del 2 — Provider Registry

**Ny fil:** `src/lib/llm-providers/registry.ts`

- `ALL_PROVIDERS`: array av `ProviderAdapter[]`
- `PROVIDERS_BY_ID`: Record<string, ProviderAdapter>
- `getProviderRegistry()`: hämtar registry (kan inkludera custom providers från DB senare)
- `listAllProviders()`: returnerar { id, label, configured } för UI

**Första versionen:** Endast `opencode` provider (CLI).
**Senare:** Lägg till `llama-swap`, `local-ollama`, `anthropic`, `google`, `openrouter` som adapters.

---

## Del 3 — Router med Fallback

**Ny fil:** `src/lib/llm-providers/router.ts`

### RouterConfig (från DB)

```typescript
interface RouterConfig {
  priorityOrder: string[]; // ["opencode", "local", "openrouter", ...]
  providerModels: Record<string, string>; // {"opencode": "big-pickle", ...}
  thinkingDisabled: string[]; // ["opencode"]
  perCapability: Partial<
    Record<Capability, { provider: string; model?: string }>
  >;
}
```

### Router.complete()

1. Ladda config från DB
2. Build priority chain (använd perCapability overrides först, sedan priorityOrder)
3. Filtrera bort inte-konfigurerade providers
4. Iterera kedjan: försök varje provider, fallback på fel
5. Om alla misslyckas med rate-limit → returnera rate-limit-felet (UI kan visa val)
6. Om alla misslyckas med andra fel → samla alla fel, returnera

### Filtrering

- Provider utan nyckel = hoppas över
- `thinkingDisabled` = `enableThinking: false` för den providern
- `perCapability.reasoning` = override för reasoning-capability

---

## Del 4 — DB Konfiguration

**Ny migration:** `supabase/migrations/XXXX_add_llm_provider_config.sql`

```sql
CREATE TABLE public.llm_provider_config (
  id BIGINT PRIMARY KEY DEFAULT 1,
  priority_order TEXT[],
  provider_models JSONB,
  thinking_disabled TEXT[],
  per_capability JSONB,
  local_llm_url TEXT,
  llm_discovery_cadence_minutes INT,
  llm_discovery_event_debounce_minutes INT,
  CONSTRAINT id_check CHECK (id = 1)
);

-- Default values
INSERT INTO public.llm_provider_config (
  priority_order, provider_models, thinking_disabled, per_capability,
  llm_discovery_cadence_minutes, llm_discovery_event_debounce_minutes
) VALUES (
  '["opencode", "local"]',
  '{}',
  '[]',
  '{}',
  30,
  2
);

-- RLS: endast authed users kan läsa/skriva
ALTER TABLE public.llm_provider_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own config" ON public.llm_provider_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own config" ON public.llm_provider_config
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert own config" ON public.llm_provider_config
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

---

## Del 5 — LLM Settings UI

**Ny fil:** `src/routes/settings.llm.tsx`

### Sektioner:

1. **Lokal LLM-URL** — input för llama-swap URL
2. **Providers** — add/edit/delete custom providers
   - id, label, apiKind (openai/anthropic/ollama)
   - baseUrl, apiKey, apiKeyEnv, extra headers
   - models per capability
   - enabled/disabled toggle
3. **Prioritetsordning** — drag-and-drop lista
   - Flytta upp/ned
   - Visa ping-status (latency, model)
   - Ping-knapp (testa anslutning)
   - Default-modell dropdown per provider
   - "tänkande av" checkbox
4. **Capability-override** — per capability (reasoning, fast, vision, long-context)
   - Välj provider + modell per capability
5. **LLM Scout intervall** — cadence + debounce (för framtida autotrader integration)

### Server Functions (TanStack Router)

- `getLlmConfig()` — läs från DB
- `setLlmConfig(config)` — skriv till DB
- `listCustomProviders()` — läs custom providers från DB
- `saveCustomProvider(draft)` — spara custom provider
- `deleteCustomProvider(id)` — ta bort custom provider
- `listProviderModels(id)` — hämta modeller från specifik provider
- `pingProvider(id)` — testa anslutning

---

## Del 6 — Integrera med befintlig kod

### 6.1 — aiChat.ts (refaktor)

**Förändringar:**

- Behåll `buildChatModel` för AI SDK direktproviders (google/, openrouter/, anthropic/, local/)
- Lägg `buildOpencodeRouterModel()` som wrapper för router → LanguageModelV2-adapter
- Eller: behåll nuvarande `opencodeChatModel` för strömmande chat, använd ny router för ej-strömmande

**Vald strategi:** Behåll nuvarande `opencodeChatModel` för chat (strömmande).
Använd ny `router.complete()` för titel/suggestions (ej-strömmande).

### 6.2 — Chat Title Generation (aiChat.ts ~line 780)

```typescript
// NUVARANDE (hardcoded Anthropic):
const result = await generateText({
  model: anthropicModel,
  prompt: ...,
  maxTokens: 50,
});

// NY (med router):
const output = await router.complete({
  task: firstMessage,
  system: titlePrompt,
  capabilities: ["fast"],
  model: routerConfig.providerModels?.fast || undefined,
});
// output.text = conversation title
```

### 6.3 — Conversation Suggestions (aiChat.ts ~line 830)

```typescript
// NUVARANDE (hardcoded Anthropic):
const suggestions = await generateConversationSuggestions({
  anthropic,
  branch,
});

// NY (med router):
const output = await router.complete({
  task: branch.map((m) => m.role + ': ' + m.text).join('\n'),
  system: suggestionsPrompt,
  capabilities: ['fast'],
});
const suggestions = normalizeConversationSuggestions(output.text);
```

### 6.4 — models.ts route (uppdatering)

**Fil:** `src/routes/api/opencode/models.ts`

- Behåll nuvarande logik (API + CLI merge) för model list i dropdown
- Lägg till `POST /api/opencode/ping` endpoint för settings UI
- Lägg till `GET /api/opencode/models/:id` för provider-specifika modeller

---

## Del 7 — CLI Bridge (valfri, för deployment)

**Ny fil:** `infra/cli-bridge.mjs` (kopiera från auto-trader-ai)

- HTTP proxy som kör `opencode`/`codex` kommandon
- Tillgänglig via `host.containers.internal` från Podman-containrar
- `CLI_BRIDGE_URL` miljövariabel aktiverar bridge-mode
- `CLI_BRIDGE_TOKEN` för autentisering
- Temp-katalog per anrop för isolation
- Timeout 10 minuter

---

## Implementeringsordning (rekommenderad)

### Sprint 1 — Grundläggande (3-4 timmar)

1. **Del 1.1** — `cli.ts` (CLI-hjälp)
2. **Del 1.2** — `opencode-adapter.ts` (ProviderAdapter)
3. **Del 2** — `registry.ts`
4. **Test:** `router.complete()` med opencode CLI fungerar

### Sprint 2 — Router + DB (3-4 timmar)

5. **Del 3** — `router.ts` (fallback chain)
6. **Del 4** — DB migration (`llm_provider_config`)
7. **Del 5 (delvis)** — `getLlmConfig`/`setLlmConfig` server functions

### Sprint 3 — Settings UI (4-5 timmar)

8. **Del 5 (resten)** — `settings.llm.tsx` UI
   - Provider-lista med CRUD
   - Prioritetsordning drag-drop
   - Ping-test
   - Capability-override
9. **Del 6.2-6.3** — Integrera router i titel/suggestions generation

### Sprint 4 — Polering (2-3 timmar)

10. **Del 7** — CLI bridge (valfri, för deployment-scenarier)
11. **Del 6.4** — models.ts route uppdatering
12. **Testing** — End-to-end: UI → DB config → router → provider → response

---

## Filstruktur (efter implementation)

```
pCAD/
├── src/
│   ├── lib/
│   │   └── llm-providers/
│   │       ├── types.ts            ← ProviderAdapter interface
│   │       ├── cli.ts              ← CLI runner + bridge
│   │       ├── opencode-adapter.ts ← Opencode ProviderAdapter
│   │       ├── registry.ts         ← ALL_PROVIDERS + PROVIDERS_BY_ID
│   │       └── router.ts           ← Priority chain + fallback
│   ├── routes/
│   │   ├── settings.llm.tsx        ← LLM settings UI
│   │   └── api/
│   │       ├── opencode/
│   │       │   ├── models.ts       ← (behålls, uppdateras)
│   │       │   ├── ping.ts         ← Ny: ping provider
│   │       │   └── provider-models.ts ← Ny: models per provider
│   │       └── llm/
│   │           ├── config.ts       ← Ny: GET/POST config
│   │           ├── providers.ts    ← Ny: CRUD custom providers
│   │           └── ping.ts         ← Ny: ping endpoint
│   └── server/
│       ├── aiChat.ts               ← Refaktor: titel/suggestions via router
│       ├── opencode.ts             ← (behålls — LanguageModelV2 för chat)
│       └── env.ts                  ← Ny: OPENCODE_MODEL (valfri)
├── supabase/
│   └── migrations/
│       └── XXXX_add_llm_provider_config.sql
└── infra/
    └── cli-bridge.mjs              ← Ny: CLI HTTP proxy
```

---

## Behålls utan förändring

| Fil                                     | Varför                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `src/server/opencode.ts`                | LanguageModelV2 för strömmande chat — fortfarande nödvändigt            |
| `src/server/aiChat.ts` `buildChatModel` | Direktproviders (google/, openrouter/, anthropic/, local/) fungerar bra |
| `src/routes/api/opencode/models.ts`     | Model list i dropdown — fungerar, bara uppdatering                      |
| `src/components/TextAreaChat.tsx`       | Chat UI — ingen förändring                                              |
| `src/lib/utils.ts` `PARAMETRIC_MODELS`  | Static model list — fungerar                                            |

---

## Risker och överväganden

### Risk 1: Strömning för opencode

- **Problem:** CLI är blockerande, chat UI kräver strömning
- **Åtgärd:** Behåll HTTP API `opencodeChatModel` för chat. Router-CLI används endast för titel/suggestions (snabba, ej-strömmande operationer)
- **Framtid:** Overväg `opencode run --format json --pure` med ReadableStream wrapper för strömmande CLI

### Risk 2: DB-schema för pCAD

- **Problem:** pCAD använder Supabase, auto-trader-ai har sin egen DB-lager
- **Åtgärd:** Anpassa SQL-migration för Supabase RLS och TanStack Router patterns
- **Kompatibilitet:** pCAD har redan `conversations` och `messages` tabeller

### Risk 3: Scope creep

- **Problem:** auto-trader-ai har 7 providers, custom provider CRUD, full settings UI
- **Åtgärd:** Fokus på **opencode CLI** först. Övriga providers och custom CRUD kan läggas till i Sprint 4+

### Risk 4: Befintlig funktionalitet bryts

- **Problem:** Refaktor av aiChat.ts kan påverka existerande chat-funktioner
- **Åtgärd:** Endast titel/suggestions generering byts (se Sprint 3). Chat-flow förblir oförändrad. TypeScript compiles clean = grön zon.

---

## Valfri: Framtida förbättringar

1. **Strömmande CLI wrapper** — ReadableStream som läser JSONL från stdout i realtid
2. **Custom providers via UI** — Användare kan lägga till egna providers (vLLM, LM Studio, OpenRouter)
3. **Per-provider model selection** — Dropdown i settings UI för att välja modell per provider
4. **Rate limit UI** — Visa cooldown-status, förslag på alternative providers
5. **LLM Scout** — Integrera auto-trader-ai's LLM-discovery för att hitta nya bolag (om relevant för pCAD)
6. **Health checks** — Periodisk ping av alla providers, larma om någon dör
7. **Usage tracking** — Token-användning per provider (från `CompleteOutput.usage`)
