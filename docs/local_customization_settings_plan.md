# Local customization settings plan

Status: **PLANNED — DO NOT IMPLEMENT AUTOMATICALLY**

Target branch: `local-dev-continue`

Purpose: add local/self-host customization for model visibility, prompt profiles, and AI providers while keeping the pCAD fork easy to reconcile with future upstream CADAM changes.

This plan is intentionally implementation-oriented. OpenCode should be able to execute it one task at a time with minimal human intervention, but no task should start until the user explicitly asks to begin.

---

# 1. Product goals

Implement three user-facing settings areas:

1. **Models** — choose which models appear in the model dropdown.
2. **Prompts** — inspect the current CADAM parametric system prompt, create editable alternatives, and select which prompt profile new conversations use while keeping the original immutable.
3. **Providers** — add and configure AI providers/endpoints and expose their configured models to the same model catalog.

The implementation must preserve:

- current CADAM/pCAD behavior unless a user explicitly changes a local setting;
- current OpenCode CLI/Streaming support;
- current `pcad-builder` runtime agent and validation flow;
- current conversation branch semantics;
- current static upstream model definitions;
- current upstream prompt as the canonical built-in prompt;
- the ability to merge/cherry-pick/reconcile future relevant CADAM changes with a small, obvious conflict surface.

---

# 2. Non-negotiable architecture rules for upstream compatibility

These rules apply to every task in this plan.

## 2.1 Do not replace upstream-owned catalogs

The current upstream-style parametric catalog lives in `PARAMETRIC_MODELS` in `src/lib/utils.ts`. Keep it as the built-in catalog. Do not convert that array into a user database table and do not delete it.

Local behavior should be an overlay:

```text
built-in CADAM models
+ dynamically discovered OpenCode models
+ user custom-provider models
- user hidden model IDs
= effective picker catalog
```

This means a new model added upstream automatically enters the effective catalog unless the user later hides it.

## 2.2 Store hidden models, not the entire visible catalog

Persist `hidden_model_ids`, not a full copy of every visible model ID.

Why:

- new upstream models remain visible automatically;
- removed upstream models leave only harmless stale hidden IDs;
- upstream model descriptions/capabilities can change without migrating local user data;
- model catalog ownership remains with upstream/static discovery, while the local fork only owns visibility preferences.

## 2.3 Never mutate the original CADAM prompt

The built-in `PARAMETRIC_AGENT_PROMPT` remains source-controlled and immutable from the UI.

Settings may display it, but an Edit action must create a new user prompt profile. The original prompt must never be updated in the database or rewritten by a browser request.

## 2.4 Prefer prompt overlays over prompt forks

Support two custom prompt modes:

### Overlay profile — recommended

Runtime prompt:

```text
CURRENT upstream built-in CADAM prompt
+
user custom instructions
```

This automatically inherits future upstream prompt improvements.

### Fork profile — advanced

Runtime prompt:

```text
full user-owned prompt snapshot
```

A fork does not automatically inherit upstream changes. Store metadata identifying the built-in prompt revision/fingerprint it was based on so a future compare/rebase UI can warn the user when the original changed.

The UI should recommend Overlay unless the user explicitly wants complete replacement.

## 2.5 Add local seams instead of rewriting core flows

Prefer new modules/components and small call-site changes:

- `src/server/aiSettings.ts`
- `src/server/modelCatalog.ts`
- `src/server/promptProfiles.ts`
- `src/server/customProviders.ts`
- `src/services/aiSettingsService.ts`
- `src/components/settings/AiModelsSettings.tsx`
- `src/components/settings/PromptProfilesSettings.tsx`
- `src/components/settings/ProvidersSettings.tsx`

Keep changes in these upstream-heavy files as narrow as possible:

- `src/server/aiChat.ts`
- `src/lib/utils.ts`
- `src/components/TextAreaChat.tsx`
- `src/components/ModelSelector.tsx`
- `src/views/PromptView.tsx`
- `src/views/EditorView.tsx`
- `src/views/SettingsView.tsx`

`SettingsView.tsx` should mainly import/render local settings panels rather than embedding hundreds of lines of custom-provider logic directly.

## 2.6 Preserve old conversations

A model or prompt profile being hidden/deleted/disabled must not make historical conversations unreadable.

Existing conversations must still be able to display their saved model ID and prompt profile metadata. Runtime behavior for an unavailable provider must fail explicitly with a useful error rather than silently choosing another provider/model.

## 2.7 No silent fallback

Never silently replace:

- hidden selected model -> another model;
- missing prompt profile -> arbitrary custom profile;
- unavailable custom provider -> OpenRouter/default provider;
- failed custom endpoint -> CLI/OpenCode fallback.

Fallback to the built-in prompt is acceptable only when a conversation has no custom prompt profile or references the explicit built-in profile.

---

# 3. Current code seams to preserve

The implementation agent must inspect these before coding each relevant phase.

## 3.1 Models

Current built-in parametric model catalog:

- `src/lib/utils.ts` -> `PARAMETRIC_MODELS`

Current picker:

- `src/components/ModelSelector.tsx`
- `src/components/TextAreaChat.tsx`

Current model ID is an open string type:

- `shared/types.ts` -> `export type Model = string`

This is already compatible with future dynamic/custom IDs.

OpenCode model IDs remain canonical:

```text
agent/opencode/<provider>/<model>
```

and transport selection remains independent (`cli` vs `streaming`).

## 3.2 Prompt

Current parametric built-in prompt:

- `src/server/aiChat.ts` -> `PARAMETRIC_AGENT_PROMPT`

Current runtime resolver:

- `systemPrompt(conversation)`

Do not duplicate the entire built-in prompt into a second source file merely for the settings page unless there is a compelling dependency reason. The safest upstream-sync seam is to keep the original source where it is and expose/read it through a server-only API/helper.

## 3.3 Provider routing

Current provider routing is mostly static in `src/server/aiChat.ts`:

- `providerFor(modelId)`
- `createChatProviders()`
- `buildChatModel(...)`

Built-in providers currently include direct Anthropic/Google, OpenRouter routing, a local OpenAI-compatible provider, OpenCode and CLI agents.

Custom providers must be an additive route in front of or alongside the existing static route. Avoid rewriting the existing providers into database rows.

## 3.4 Settings UI

Current settings page:

- `src/views/SettingsView.tsx`

It currently owns Account, Notifications and Billing. New AI settings should be separate child components so upstream account/billing changes remain easy to merge.

## 3.5 Conversation settings

Current per-conversation settings are typed in:

- `shared/types.ts` -> `ConversationSettings`

Current fields include `model`, `suggestions`, and `openCodeExecutionMode`.

A pinned prompt profile ID can be added here later with minimal schema impact because `conversations.settings` is already JSON-like application state.

---

# 4. Phase P00 — OpenCode development automation bootstrap

Priority: **FIRST**

Goal: make later phases safe enough for OpenCode to execute independently one task at a time.

Important: this is a **development agent**, separate from the runtime `.opencode/agent/pcad-builder.md` used to generate OpenSCAD for end users. Do not repurpose or weaken `pcad-builder`.

OpenCode currently supports project-local custom agents and on-demand skills. Use those mechanisms rather than adding an MCP server unless a real missing capability appears.

## P00A — Create a dedicated development agent

Create:

```text
.opencode/agent/pcad-maintainer.md
```

Responsibilities:

- implement scoped pCAD repository tasks;
- inspect before editing;
- preserve unrelated user work;
- use tests/typecheck/lint/build as gates;
- never merge to master automatically;
- never reset/clean/stash unrelated work;
- always compare the phase against this plan;
- update the implementation status document after each task;
- stop after one task ID.

Recommended permissions:

- `read`: allow
- `glob`: allow
- `grep`: allow
- `list`: allow
- `lsp`: allow
- `edit`: allow
- `bash`: pattern-limited where OpenCode version supports it
- safe commands such as `git status`, `git diff`, `git log`, `npm run typecheck`, focused `tsx --test`, `npm run lint`, `npm run build`, Supabase inspection/generation commands: allow
- destructive git, arbitrary shell/network: deny or ask
- `websearch`/`webfetch`: ask or deny by default; only use for current official API docs when a task explicitly requires it
- `skill`: allow for the project-local implementation skills below

Acceptance:

- agent loads from project-local OpenCode config;
- can read/edit repo and run validation;
- cannot auto-merge or run destructive git operations.

## P00B — Add skill: upstream-safe customization

Create:

```text
.opencode/skills/pcad-upstream-safe-customization/SKILL.md
```

Must require the agent to:

1. identify upstream-owned files touched by the task;
2. prefer new additive local modules/components;
3. keep static CADAM model/prompt definitions intact;
4. avoid copy-pasting upstream source into user-owned tables;
5. record every unavoidable upstream-heavy edit in a small "sync seam" list;
6. before task completion run:
   - `git diff --check`
   - `git diff --stat`
   - inspect `git diff` for unnecessary churn;
7. not run formatting over unrelated files;
8. not refactor unrelated upstream code while implementing a local feature.

## P00C — Add skill: Supabase settings migration

Create:

```text
.opencode/skills/pcad-supabase-settings/SKILL.md
```

Skill must document the project's migration/RLS workflow:

- additive migration only;
- every user-owned row contains `user_id`;
- RLS enabled;
- select/insert/update/delete policies restricted to `auth.uid() = user_id`;
- no plaintext secrets returned to browser;
- regenerate/check shared database types using the repo's established Supabase workflow;
- never hand-edit generated DB types unless the repository already treats them as hand-maintained;
- run local migration validation before marking a schema task done.

P00C should first audit the repository's exact type-generation command because `package.json` does not currently define one.

## P00D — Add skill: AI provider registry

Create:

```text
.opencode/skills/pcad-ai-provider-registry/SKILL.md
```

Must encode:

- built-in providers remain source/env managed;
- custom provider IDs are user-owned and namespaced;
- provider secrets are server-only;
- never log API keys/authorization headers;
- validate URLs and reject unsupported protocols;
- test connection using a bounded timeout;
- no silent fallback;
- capability metadata must be explicit;
- model IDs persisted in conversations remain stable.

## P00E — Add skill: settings UI

Create:

```text
.opencode/skills/pcad-settings-ui/SKILL.md
```

Must require:

- reuse existing Adam/CADAM visual primitives;
- mobile-safe layout;
- keyboard-accessible controls;
- clear save/cancel/destructive actions;
- React Query cache invalidation after mutations;
- loading/error/empty states;
- no secret values rendered after save;
- do not put all AI settings logic inside `SettingsView.tsx`.

## P00F — Status tracker

Create:

```text
docs/local_customization_settings_status.md
```

Initial state:

```text
Current next task: P01A
```

Every task entry records:

- branch + HEAD before;
- `git status --short`;
- files changed;
- decisions;
- tests;
- acceptance result;
- next task;
- blockers.

### P00 acceptance

OpenCode can be instructed with only:

```text
Read docs/local_customization_settings_plan.md and
 docs/local_customization_settings_status.md.
Work only on Current next task using pcad-maintainer.
```

and has enough repository-local guidance to complete a scoped task safely.

---

# 5. Phase P01 — Data model and preference ownership

Priority: **FOUNDATION**

Goal: persist local user customization without copying upstream catalogs.

## P01A — Audit database conventions

Before writing migration:

- inspect latest migrations;
- inspect `profiles`, `conversations`, RLS patterns and timestamp conventions;
- identify exact generated-type workflow;
- verify whether UUID generation uses `gen_random_uuid()` or another convention;
- verify update timestamp trigger conventions.

No production schema change in P01A.

## P01B — Create `user_ai_preferences`

Recommended schema:

```sql
create table public.user_ai_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hidden_model_ids text[] not null default '{}',
  default_prompt_profile_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Do not store a copied visible model catalog.

Do not store provider API keys here.

RLS:

- user can select own row;
- insert own row;
- update own row;
- delete own row if needed.

Service layer should treat missing row as defaults:

```ts
{
  hiddenModelIds: [],
  defaultPromptProfileId: null
}
```

This avoids requiring an insert for every existing account.

## P01C — Create `prompt_profiles`

Recommended schema:

```sql
create table public.prompt_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('overlay', 'fork')),
  content text not null,
  base_prompt_key text not null default 'parametric',
  base_revision text null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add uniqueness appropriate for UX, recommended:

```text
(user_id, lower(name)) among non-archived profiles
```

Do not create a database row for the original built-in prompt. Represent original as a synthetic immutable profile from server code, e.g.:

```ts
id: 'builtin:parametric'
name: 'CADAM Original'
mode: 'builtin'
```

The built-in profile is not deletable/editable.

`base_revision` should identify the built-in prompt the fork was created from. Initial implementation can use a deterministic SHA-256 fingerprint of built-in prompt text rather than tying behavior to a Git SHA.

## P01D — Create provider tables

Use two tables rather than embedding arbitrary model JSON into one provider row.

### `ai_providers`

Recommended fields:

```text
id uuid PK
user_id uuid FK auth.users
slug text
name text
driver text
preset text nullable
base_url text nullable
enabled boolean
headers jsonb default {}
credential_ciphertext text nullable
credential_iv text nullable
credential_tag text nullable
has_credential is derived server-side, not stored if unnecessary
created_at
updated_at
```

Recommended `driver` initial values:

```text
openai-compatible
anthropic
google
openrouter
```

Recommended `preset` values are UI conveniences, not runtime drivers:

```text
custom
ollama
llama-swap
lm-studio
```

Ollama/llama-swap/LM Studio can initially use the `openai-compatible` runtime driver with preset defaults.

Unique:

```text
(user_id, slug)
```

Do not allow a custom slug to impersonate reserved built-in prefixes such as:

```text
anthropic
google
openai
openrouter
local
opencode
agent
```

### `ai_provider_models`

Recommended fields:

```text
id uuid PK
provider_id uuid FK ai_providers on delete cascade
user_id uuid FK auth.users
model_id text
name text
description text nullable
enabled boolean
supports_tools boolean
supports_thinking boolean
supports_vision boolean
context_limit integer nullable
output_limit integer nullable
created_at
updated_at
```

Unique:

```text
(provider_id, model_id)
```

Keep `user_id` directly on model rows even though it is derivable through provider. This simplifies strict RLS and avoids accidental cross-user joins.

## P01E — Credential encryption policy

Never store provider API keys in plaintext browser-readable rows.

Recommended implementation:

- environment variable: `PCAD_CREDENTIAL_ENCRYPTION_KEY`;
- server-only AES-256-GCM using Node `crypto`;
- generate a fresh random IV per credential;
- database stores ciphertext + IV + auth tag;
- API responses expose only `hasCredential: boolean`;
- edit form starts with an empty secret field and a "credential saved" indicator;
- unchanged empty field means retain existing secret;
- explicit "Remove credential" action deletes ciphertext fields;
- secrets and Authorization headers are redacted from logs/errors.

P01E must define startup/error behavior if encrypted credentials exist but the server lacks the encryption key. Recommended: custom providers requiring those credentials become unavailable with an explicit server configuration error; do not corrupt/delete stored data.

## P01F — Add foreign key from default prompt preference

After `prompt_profiles` exists, optionally add a FK from `user_ai_preferences.default_prompt_profile_id` to `prompt_profiles(id)`.

However the synthetic built-in profile cannot be represented by this UUID field. Treat NULL as built-in original.

Prefer:

```text
NULL = CADAM Original
UUID = custom prompt profile
```

## P01G — Generate/check TypeScript DB types

Regenerate `shared/database.ts` using the repository's established Supabase workflow found in P01A.

Update only application types that need ergonomic camelCase wrappers.

## P01 acceptance

- migrations apply cleanly from a fresh local database;
- existing users need no migration rows;
- RLS prevents cross-user access;
- no prompt/model catalog is duplicated from upstream;
- secrets cannot be selected from browser using normal Supabase anon client;
- typecheck passes.

---

# 6. Phase P02 — Server-side settings API and service layer

Goal: give UI a stable API boundary rather than direct table manipulation for security-sensitive provider settings.

## P02A — Shared DTOs and validation

Create e.g.:

```text
shared/aiSettings.ts
```

Define Zod-compatible/shared TS shapes for:

- `AiPreferencesDto`
- `PromptProfileSummaryDto`
- `PromptProfileDetailDto`
- `ProviderSummaryDto`
- `ProviderDetailDto`
- `ProviderModelDto`
- `ModelCatalogEntryDto`

Important: provider DTOs never contain decrypted secrets.

## P02B — `src/server/aiSettings.ts`

Server helpers:

```ts
getAiPreferences(userId)
updateHiddenModels(userId, ids)
setDefaultPromptProfile(userId, profileId | null)
```

Validate every submitted model ID as a bounded string and deduplicate before persisting.

Do not require hidden IDs to currently exist; stale IDs are harmless and allow settings to survive temporary provider unavailability.

## P02C — Prompt profile server module

Create:

```text
src/server/promptProfiles.ts
```

Functions:

```ts
listPromptProfiles(userId)
getPromptProfile(userId, id)
createPromptProfile(userId, input)
updatePromptProfile(userId, id, input)
archivePromptProfile(userId, id)
resolveParametricPrompt(userId, profileId | null, builtinPrompt)
```

Rules:

- `null` profile -> exact built-in prompt;
- overlay -> `${builtinPrompt}\n\n<local customization>...` with clear delimiter;
- fork -> exact custom content;
- archived profile can still resolve for an existing pinned conversation, but cannot be selected as default for new conversations;
- user cannot access another user's profile;
- profile name/content size limits enforced server-side.

Recommended limits:

```text
name <= 100 chars
content <= 128 KiB initially
```

## P02D — Provider server module

Create:

```text
src/server/customProviders.ts
```

Functions:

```ts
listCustomProviders(userId)
getCustomProvider(userId, id)
createCustomProvider(userId, input)
updateCustomProvider(userId, id, input)
deleteCustomProvider(userId, id)
testCustomProvider(userId, id | draftConfig)
listProviderModels(userId, providerId)
createProviderModel(...)
updateProviderModel(...)
deleteProviderModel(...)
```

All secret decryption stays inside this module or a dedicated credential helper.

## P02E — API routes

Follow the repository's existing API route pattern. Recommended logical endpoints:

```text
GET    /api/ai-settings
PATCH  /api/ai-settings/models
PATCH  /api/ai-settings/default-prompt

GET    /api/ai-settings/prompts
POST   /api/ai-settings/prompts
GET    /api/ai-settings/prompts/:id
PATCH  /api/ai-settings/prompts/:id
DELETE /api/ai-settings/prompts/:id   # archive, not hard delete by default

GET    /api/ai-settings/providers
POST   /api/ai-settings/providers
GET    /api/ai-settings/providers/:id
PATCH  /api/ai-settings/providers/:id
DELETE /api/ai-settings/providers/:id
POST   /api/ai-settings/providers/:id/test

GET    /api/ai-settings/providers/:id/models
POST   /api/ai-settings/providers/:id/models
PATCH  /api/ai-settings/providers/:id/models/:modelRowId
DELETE /api/ai-settings/providers/:id/models/:modelRowId
```

If the current server router favors action-style endpoints over REST params, preserve repository convention; names above are logical API contracts, not a mandate to refactor routing.

## P02F — Client service

Create:

```text
src/services/aiSettingsService.ts
```

React Query hooks:

```text
useAiPreferences
useUpdateModelVisibility
usePromptProfiles
usePromptProfile
useCreatePromptProfile
useUpdatePromptProfile
useArchivePromptProfile
useSetDefaultPromptProfile
useProviders
useProvider
useCreateProvider
useUpdateProvider
useDeleteProvider
useTestProvider
useProviderModels
...
```

Centralize query keys so Settings and model picker share the same cache.

## P02 acceptance

- all APIs require authentication;
- cross-user IDs return 404/403 safely;
- secret fields never return plaintext;
- React Query mutations invalidate only relevant keys;
- typecheck and focused API tests pass.

---

# 7. Phase P03 — Unified effective model catalog

Goal: one model catalog consumed by settings and pickers.

## P03A — Introduce catalog module without moving upstream constants

Create:

```text
src/server/modelCatalog.ts
```

or split server/client DTO helpers if needed.

Sources:

1. built-in `PARAMETRIC_MODELS`;
2. current dynamic OpenCode models;
3. custom provider models.

Do not copy the built-in array into the DB.

## P03B — Stable custom model IDs

Use a namespaced persisted ID that cannot collide with upstream IDs.

Recommended:

```text
custom/<provider-uuid>/<model-id>
```

Parser rule:

- first segment `custom`;
- second segment provider UUID;
- remaining path joined as the provider-native model ID.

This permits native model IDs that themselves contain `/`.

Do not use display name or mutable provider slug as the persisted identifier.

Helper module recommended:

```text
shared/customModelIds.ts
```

Functions:

```ts
isCustomProviderModel(id)
makeCustomProviderModelId(providerId, modelId)
parseCustomProviderModelId(id)
```

## P03C — Catalog API

Add authenticated endpoint:

```text
GET /api/models/catalog
```

Return effective **unfiltered** user-addressable catalog entries with source metadata:

```ts
{
  id,
  name,
  description,
  provider,
  supportsTools,
  supportsThinking,
  supportsVision,
  source: 'builtin' | 'opencode' | 'custom',
  enabled,
  available,
  unavailableReason?
}
```

Why return unfiltered catalog:

- Settings needs to show hidden entries so they can be re-enabled.
- Picker applies hidden preference separately.

## P03D — Effective picker filtering

Create client hook e.g.:

```text
useParametricModelCatalog()
```

Return:

```text
allModels
visibleModels
hiddenModelIds
```

Filtering rule:

```text
visible = enabled && !hiddenModelIds.includes(id)
```

Exception for an already selected historical model:

- if current conversation uses a hidden model, inject it into the picker trigger/current selection so the UI remains coherent;
- optionally mark it "Hidden in settings";
- do not add it back to normal selectable list unless user enables it.

## P03E — Replace direct picker dependency on `PARAMETRIC_MODELS`

`TextAreaChat.tsx` should stop directly treating `PARAMETRIC_MODELS` as the final picker list.

Do not remove `PARAMETRIC_MODELS`. Instead, feed `ModelSelector` the effective `visibleModels` from the catalog hook.

Keep Creative models unchanged in this phase unless the user explicitly wants visibility controls for them too.

## P03F — Default model behavior

Current new-conversation default is hardcoded in `PromptView.tsx`.

Initial requirement:

- if current built-in default is visible/available, use it;
- if user hides it, choose the first visible compatible parametric model by deterministic catalog order;
- if zero parametric models are visible, block Send and show "Enable at least one model in Settings";
- do not silently unhide the default.

A future explicit `default_model_id` preference can be added, but is not required for the first requested feature.

## P03G — Model settings UI

Create:

```text
src/components/settings/AiModelsSettings.tsx
```

UI requirements:

- section title `Models`;
- search/filter box;
- group entries by provider/source;
- switch/checkbox per model;
- `Enable all` and `Hide all` actions with confirmation only if Hide all would leave no model usable;
- `Restore defaults` -> clears `hidden_model_ids`;
- capability chips optional: Tools, Vision, Thinking, OpenCode;
- custom provider models show provider name;
- unavailable entries shown disabled with reason rather than disappearing;
- dynamically discovered OpenCode models can be hidden exactly like built-ins;
- changes save quickly and update picker without full page reload.

## P03H — Tests

At minimum:

1. built-in models appear by default;
2. new built-in model would appear without changing preference row;
3. hidden built-in model absent from normal picker;
4. hidden current conversation model still renders as current selection;
5. OpenCode model hide/show;
6. custom model hide/show;
7. stale hidden ID harmless;
8. all-hidden state blocks new parametric send with actionable message;
9. creative picker unchanged.

## P03 acceptance

User can choose model visibility in Settings and changes immediately affect the parametric dropdown without modifying the upstream model catalog.

---

# 8. Phase P04 — Immutable original prompt + selectable prompt profiles

Goal: expose prompt safely and support multiple profiles.

## P04A — Expose built-in prompt through a server seam

Keep `PARAMETRIC_AGENT_PROMPT` source-controlled as the built-in truth.

Make the smallest practical change required so a server endpoint can return it. Preferred options, in order:

1. export the existing constant from `aiChat.ts` if this does not create a dependency cycle;
2. expose a narrow server getter in the same module;
3. only if necessary, extract the constant to a tiny server-only module and document that extraction as an upstream sync seam.

Avoid duplicating prompt text.

## P04B — Prompt list DTO

Settings list should synthesize:

```text
CADAM Original        Built-in, immutable
My precise CAD rules  Overlay
Experimental v2       Fork
...
```

Built-in detail includes:

- full prompt text;
- current deterministic fingerprint;
- `editable: false`;
- `deletable: false`.

## P04C — Edit behavior must clone, never modify original

On built-in prompt:

- button label can be `Edit` for user friendliness;
- clicking it opens `Create prompt from original` dialog;
- user chooses:
  - **Add custom instructions (recommended)** -> overlay;
  - **Create full copy** -> fork.

Overlay editor initially shows only the local customization text area, plus a collapsible read-only built-in base preview.

Fork editor shows a full editable copy.

Never send an UPDATE for built-in original.

## P04D — Prompt profile settings component

Create:

```text
src/components/settings/PromptProfilesSettings.tsx
```

Recommended UX:

- profile selector at top;
- active/default badge;
- built-in badge;
- read-only large monospaced prompt viewer;
- `Edit` / `Duplicate` buttons;
- custom profile editor dialog or dedicated sub-panel;
- Save, Cancel, Archive;
- `Set as default`;
- overlay/fork mode clearly visible;
- warning on fork: "This full copy does not automatically inherit future CADAM prompt updates.";
- warning when fork's `base_revision` no longer matches current built-in fingerprint;
- `Restore CADAM Original` sets default profile to NULL; it does not delete custom profiles.

## P04E — Runtime prompt resolver

Change `systemPrompt(...)` or its call site minimally.

Recommended function:

```ts
async function resolveConversationSystemPrompt({
  userId,
  conversation,
}): Promise<string>
```

Resolution:

1. read pinned `conversation.settings.promptProfileId`;
2. NULL/undefined -> built-in exact prompt;
3. custom profile -> resolve through `promptProfiles.ts`;
4. profile belongs to another user -> reject;
5. archived profile pinned to existing conversation -> still resolve;
6. deleted/unresolvable profile -> explicit error or documented built-in fallback; recommended safer behavior is explicit error plus recovery action rather than silently changing behavior.

## P04F — Pin profile on conversation creation

Add to `ConversationSettings`:

```ts
promptProfileId?: string | null;
```

When `PromptView` creates a new parametric conversation:

- load `defaultPromptProfileId` from AI preferences;
- persist it into `conversation.settings.promptProfileId`;
- creative conversation does not use it.

Why pin:

- changing Settings later does not silently alter old conversation behavior;
- retries/reloads remain reproducible;
- users can maintain different prompt experiments across conversations.

In this phase, Settings selects the default for **new conversations**. Per-conversation prompt switching in EditorView is optional later, not required now.

## P04G — Upstream update behavior

Test both custom modes against a simulated built-in prompt change:

- overlay runtime changes because its base is current built-in;
- fork runtime remains unchanged;
- fork UI reports base revision mismatch;
- original profile viewer shows the new built-in prompt automatically.

This test is central to the requirement that relevant upstream CADAM prompt changes remain adoptable.

## P04H — Tests

1. built-in prompt exactly unchanged with no custom profile;
2. built-in cannot be modified through API;
3. Edit original creates a new profile;
4. overlay appends customization to current built-in;
5. fork replaces built-in with its own full content;
6. overlay inherits simulated upstream built-in change;
7. fork does not;
8. default profile applies to newly created conversation;
9. existing conversation remains pinned after default changes;
10. archived pinned profile continues to resolve;
11. cross-user profile ID rejected;
12. creative prompt unchanged.

## P04 acceptance

User can read the original prompt, create/edit/select alternatives, and the original remains immutable. Overlay profiles continue to inherit future upstream prompt changes automatically.

---

# 9. Phase P05 — Provider settings UI and safe configuration

Goal: add providers without replacing existing CADAM providers.

## P05A — Provider settings component

Create:

```text
src/components/settings/ProvidersSettings.tsx
```

Display two groups:

### Built-in providers

Derived from current application/runtime support. Show as managed entries, e.g.:

```text
Anthropic       Built-in / server managed
Google          Built-in / server managed
OpenRouter      Built-in / server managed
Local           Built-in / server managed
OpenCode        Built-in / OpenCode managed
```

Initial version does not need to expose built-in API secrets for editing. This avoids turning existing environment-owned provider configuration into DB-owned configuration and protects upstream behavior.

### Custom providers

User-created provider cards with:

- name;
- driver;
- preset;
- base URL;
- credential saved status;
- enabled switch;
- model count;
- Test connection;
- Edit;
- Delete.

## P05B — Add provider form

Fields:

```text
Display name
Preset: Custom OpenAI-compatible / Ollama / llama-swap / LM Studio / Anthropic / Google / OpenRouter
Base URL
API key / token
Optional headers
Enabled
```

Preset behavior:

- OpenAI-compatible custom: user supplies base URL;
- Ollama: suggested `http://localhost:11434/v1`;
- llama-swap: suggested configured local URL such as `http://127.0.0.1:9292/v1` but do not hard-code the user's host as a product default unless the current fork already owns that default;
- LM Studio: suggested conventional local OpenAI-compatible endpoint;
- Anthropic/Google/OpenRouter: appropriate native driver, default official endpoint optional/unset.

Never assume localhost is reachable from a deployed server; clearly label provider endpoint as server-side connectivity.

## P05C — URL validation

Server validation:

- only `http:` / `https:` initially;
- reject `file:`, `ftp:`, `data:`, `javascript:` and malformed URLs;
- normalize trailing slash rules per driver;
- do not permit embedded username/password unless explicitly supported;
- protect against accidental secret inclusion in error messages.

For a local/self-host deployment, private RFC1918/loopback endpoints are valid and must not be blanket-blocked. This is intentionally different from a public multi-tenant SaaS SSRF policy. If this fork is ever exposed as public multi-tenant SaaS, revisit SSRF controls before allowing arbitrary base URLs.

## P05D — Test connection

`Test connection` must be server-side with bounded timeout.

For OpenAI-compatible providers, recommended sequence:

1. call model-list endpoint if available;
2. if unsupported, allow a minimal configured model test after at least one model exists;
3. classify auth failure, connection refused, timeout, invalid response separately;
4. never log secret headers.

UI result:

```text
Connected
Authentication failed
Endpoint unreachable
Timed out
Model listing unsupported — provider saved, add models manually
```

## P05E — Provider model management

Within each provider:

- manual `Add model`;
- optional `Discover models` for drivers with reliable model-list endpoints;
- fields:
  - provider-native model ID;
  - display name;
  - description;
  - supports tools;
  - supports thinking;
  - supports vision;
  - context limit;
  - output limit;
  - enabled.

Discovery must not overwrite manual capability edits without confirmation.

New custom provider model enters the catalog automatically if enabled, unless its custom model ID is in `hidden_model_ids`.

## P05F — Secret UX

After save:

- never return actual credential;
- display `Credential saved`;
- editing with blank credential leaves existing credential unchanged;
- entering a new value replaces it;
- explicit Remove credential button clears it;
- browser devtools/network response must not contain stored credential.

## P05 acceptance

User can create/configure/test a provider and manage its models without affecting existing environment-managed CADAM providers.

---

# 10. Phase P06 — Runtime custom-provider routing

Priority: **AFTER SETTINGS STORAGE/UI WORKS**

Goal: actually run chat against a custom provider model.

## P06A — Add custom-model route before existing static provider route

Do not replace `providerFor()` / `buildChatModel()` wholesale.

Recommended seam:

```ts
if (isCustomProviderModel(actualModelId)) {
  built = await buildCustomChatModel({ userId, modelId: actualModelId, thinking });
} else {
  built = buildChatModel(actualModelId, providers, thinkingEnabled);
}
```

This keeps upstream static routing almost unchanged.

## P06B — `buildCustomChatModel`

In `src/server/customProviders.ts`:

1. parse provider UUID + native model ID;
2. load provider and model row belonging to current user;
3. require provider enabled;
4. require model enabled;
5. decrypt credential if required;
6. instantiate AI SDK provider by `driver`;
7. return LanguageModel + provider options.

Driver mapping initial version:

### `openai-compatible`

Use existing installed `@ai-sdk/openai-compatible`.

### `anthropic`

Use existing installed `@ai-sdk/anthropic`.

### `google`

Use existing installed `@ai-sdk/google`.

### `openrouter`

Use existing installed `@openrouter/ai-sdk-provider`.

No new runtime dependency is required for the first provider set.

## P06C — Capability gates

Before generation:

- parametric direct-provider model must support tools if pCAD's normal tool-call flow requires them;
- if a model lacks tools, mark it incompatible for direct parametric routing rather than allowing a mysterious no-build response;
- OpenCode custom models remain handled through OpenCode catalog/agent routing, not this custom-provider table unless a later explicit integration is designed;
- image attachments should be rejected/omitted consistently when `supportsVision=false`.

UI should show incompatibility instead of hiding it silently.

## P06D — Billing policy decision gate

Current `MODEL_PRICES` uses a conservative fallback for unknown models. A custom BYOK provider must not accidentally be billed as the most expensive CADAM-hosted model.

Before enabling runtime custom providers, choose and document one policy:

### Recommended for local/self-host fork

Custom/BYOK provider inference is externally paid by the user. Do not use `FALLBACK_MODEL_PRICE` as if CADAM paid for it. Keep application entitlement gating separate from provider inference billing.

Implementation may require a `billingSource`/`customProvider` branch in usage accounting.

Do not change billing behavior implicitly. P06 cannot be marked DONE until the chosen policy has tests.

## P06E — Failure behavior

Explicit errors:

```text
Custom provider disabled
Custom model disabled
Provider credential missing
Provider authentication failed
Provider endpoint unreachable
Provider model not found
Provider does not support required CAD tools
```

No fallback to OpenRouter, OpenCode or default model.

## P06F — Tests

Use local/mock OpenAI-compatible server fixture if practical.

At minimum:

1. custom ID resolves correct user/provider/model;
2. cross-user custom model rejected;
3. disabled provider rejected;
4. disabled model rejected;
5. missing credential explicit;
6. OpenAI-compatible endpoint receives expected model ID;
7. stored secret never logged;
8. built-in model path unchanged;
9. OpenCode model path unchanged;
10. billing follows chosen custom-provider policy;
11. historical conversation with deleted provider fails clearly, not silently rerouted.

## P06 acceptance

A configured custom model can complete a normal request using its provider while all built-in and OpenCode routes remain unchanged.

---

# 11. Phase P07 — Settings page composition

Goal: expose all new controls without making `SettingsView.tsx` a permanent merge hotspot.

## P07A — Create AI settings wrapper

Create:

```text
src/components/settings/AiSettingsSection.tsx
```

It can use Tabs/Accordion depending on current design, with:

```text
Models
Prompts
Providers
```

`SettingsView.tsx` should add approximately one import and one rendered section:

```tsx
<AiSettingsSection />
```

plus only minimal placement/layout glue.

## P07B — Lazy/load behavior

Do not block Account/Billing settings render while model/provider catalog loads.

Each subsection owns loading/error state.

## P07C — Mobile layout

Acceptance widths:

```text
360 px
390 px
412 px
desktop
```

Requirements:

- provider forms do not overflow;
- prompt text viewer scrolls internally or wraps appropriately;
- model search/toggles remain tappable;
- destructive buttons not accidentally adjacent to common toggles;
- secret input supports password reveal only while actively entered; saved secret cannot be revealed because it is not returned.

## P07 acceptance

All three requested features are discoverable under Settings and the existing Account/Notifications/Billing UI behavior is unchanged.

---

# 12. Phase P08 — Conversation integration and reproducibility

Goal: ensure settings interact correctly with existing conversations.

## P08A — Pin prompt profile

Add `promptProfileId` to new parametric conversation settings as described in P04.

Existing conversations without it use built-in prompt.

## P08B — Hidden model in historical conversation

Existing conversation keeps its model ID even if hidden.

Editor model selector behavior:

- trigger still shows current model;
- normal options list excludes hidden model;
- user can choose another visible model;
- hidden state does not rewrite stored conversation model automatically.

## P08C — Deleted/disabled custom provider in historical conversation

UI still displays saved model label if metadata/cache allows; if generation is attempted, show clear provider-unavailable error.

Do not rewrite conversation settings to another model automatically.

## P08D — Default prompt change

Settings default changes only future conversations.

Existing conversation remains pinned.

If product later wants "Apply this prompt to current conversation", implement as an explicit Editor action in a separate phase.

## P08 acceptance

Reload/retry/branch operations do not silently change provider, model or prompt profile.

---

# 13. Phase P09 — Upstream synchronization guardrails

Goal: make future CADAM syncing routine rather than fragile.

## P09A — Maintain sync seam inventory

Add section to status/doc listing local modifications in upstream-heavy files, expected roughly:

```text
src/views/SettingsView.tsx
  - render AiSettingsSection only

src/components/TextAreaChat.tsx
  - consume effective model catalog hook

src/views/PromptView.tsx
  - default visible model resolution
  - pin default prompt profile on conversation create

shared/types.ts
  - promptProfileId in ConversationSettings

src/server/aiChat.ts
  - resolve pinned prompt profile
  - custom-provider branch before existing buildChatModel
```

Keep this list short. If implementation starts touching many more upstream core files, stop and reconsider architecture.

## P09B — Built-in inheritance tests

Create regression tests proving:

- built-in model catalog is sourced from current `PARAMETRIC_MODELS`, not a DB copy;
- clearing hidden IDs shows all current built-ins;
- built-in original prompt is read from current source;
- overlay profile uses current built-in at runtime.

These are the tests that protect future upstream sync.

## P09C — Upstream reconcile procedure

Before merging any future upstream CADAM update:

1. fetch upstream/master;
2. inspect new model catalog changes;
3. inspect built-in prompt changes;
4. inspect provider routing changes;
5. reconcile upstream first;
6. run local overlay tests;
7. verify new upstream models appear automatically;
8. verify overlay prompts inherit new upstream prompt;
9. verify fork profiles show revision mismatch but remain unchanged;
10. browser smoke test Settings + one build.

## P09 acceptance

Relevant upstream model/prompt/provider improvements can be incorporated without migrating every user's custom configuration.

---

# 14. Phase P10 — Full automated validation

Run after feature implementation is complete.

Required:

```bash
npm run typecheck
npm run lint
npm run build
npx tsx --test src/server/*.test.ts
```

Also run any new focused client/component test command if a test harness is added.

Database:

- fresh local Supabase reset/migration;
- RLS cross-user tests;
- encryption round-trip server test;
- migration upgrade from current schema if practical.

Security assertions:

- API key absent from GET responses;
- API key absent from browser cache payload;
- API key absent from logs;
- another user cannot read provider/profile/preferences rows;
- malformed custom provider URL rejected;
- custom model cannot reference another user's provider UUID.

---

# 15. Phase P11 — Manual browser acceptance

Do not mark complete from unit tests alone.

## Model visibility

1. Open Settings -> Models.
2. Hide several built-in models.
3. Verify they disappear from PromptView and Editor dropdown.
4. Re-enable one and verify immediate return.
5. Hide an OpenCode Qwen model; verify it disappears.
6. Existing conversation already using hidden model remains readable.
7. Restore defaults; verify all built-ins/dynamic models return.

## Prompt profiles

1. Open CADAM Original; verify full prompt readable.
2. Verify original has no direct Save-overwrite path.
3. Click Edit -> create Overlay profile.
4. Add a recognizable harmless instruction and set default.
5. Start new conversation; verify server resolves overlay.
6. Change default back to original.
7. Existing conversation remains on old pinned profile.
8. Create Fork; modify full prompt; verify it is independent.
9. Archive custom profile; existing pinned conversation still resolves if this is the chosen policy.

## Provider settings

1. Add local OpenAI-compatible provider.
2. Save with credential; refresh; secret is not shown.
3. Test connection.
4. Add/discover a model.
5. Model appears in Models settings and picker.
6. Hide/show custom model.
7. Generate one request.
8. Disable provider; generation fails explicitly.
9. Re-enable; generation works again.
10. Delete provider only after confirmation.

## Mobile

Repeat primary Settings flows at ~390 px:

- models toggles;
- prompt viewer/editor;
- provider add/edit/test;
- model dropdown after visibility changes.

---

# 16. Phase P12 — Final merge/review gate

Only after user accepts behavior.

Run:

```bash
git status --short
git diff --stat
git diff --check
git diff
npm run typecheck
npm run lint
npm run build
npx tsx --test src/server/*.test.ts
```

Review specifically for:

- accidental edits to built-in model catalog;
- accidental editability of original prompt;
- plaintext secrets;
- custom provider fallback into built-in provider paths;
- unnecessary changes to `aiChat.ts`;
- huge logic additions directly inside `SettingsView.tsx`;
- stale local copies of upstream prompt/model definitions;
- missing RLS;
- custom-provider billing falling through to `FALLBACK_MODEL_PRICE`;
- model/provider IDs based on mutable display names;
- historical conversations being silently rewritten.

Do not merge to `master` automatically.

---

# 17. Recommended implementation order

Execute one task ID at a time.

```text
P00A  development agent
P00B  upstream-safe skill
P00C  Supabase skill
P00D  provider-registry skill
P00E  settings-UI skill
P00F  status tracker

P01A  DB convention audit
P01B  user_ai_preferences
P01C  prompt_profiles
P01D  provider/model tables
P01E  credential encryption
P01F  default prompt FK/null semantics
P01G  generated DB types

P02A  DTOs
P02B  preferences server
P02C  prompt profile server
P02D  provider server
P02E  API routes
P02F  React Query services

P03A  catalog module
P03B  custom model ID helpers
P03C  catalog API
P03D  effective picker filtering
P03E  TextAreaChat wiring
P03F  default model resolution
P03G  Models settings UI
P03H  model tests

P04A  built-in prompt server seam
P04B  prompt DTO/list
P04C  immutable-original edit-as-copy
P04D  Prompt settings UI
P04E  runtime prompt resolver
P04F  conversation pinning
P04G  upstream inheritance behavior
P04H  prompt tests

P05A  Providers settings UI
P05B  add/edit provider form
P05C  URL validation
P05D  connection test
P05E  provider model management
P05F  secret UX

P06A  custom-provider routing seam
P06B  buildCustomChatModel
P06C  capability gates
P06D  billing policy
P06E  failure behavior
P06F  runtime tests

P07A-C Settings composition/mobile
P08A-D conversation integration
P09A-C upstream sync guardrails
P10 automated gate
P11 browser acceptance
P12 final review/merge gate
```

---

# 18. OpenCode execution protocol

For autonomous implementation, every OpenCode run should use this protocol:

```text
Read:
- docs/local_customization_settings_plan.md
- docs/local_customization_settings_status.md

Use the pcad-maintainer agent.
Work only on Current next task.
Load the matching project skill(s) for that task.

First run:
git branch --show-current
git status --short
git log -1 --oneline

Preserve all unrelated work.
Do not reset, clean, stash, rebase, merge, or force-push.
Do not implement a later task early unless the current task's acceptance
requires a tiny interface stub; document any stub explicitly.

Inspect current code before editing. Do not trust stale plan line numbers.
For external APIs/libraries, trust installed types/current official docs over
old comments.

After implementation:
- run the focused validation defined by the task;
- run npm run typecheck unless the task is documentation-only;
- run git diff --check;
- inspect the diff for unrelated churn;
- update local_customization_settings_status.md with evidence;
- set exactly one next task only if current task is DONE;
- stop.

Never merge to master automatically.
```

---

# 19. Specific OpenCode skills/plugins decision

## Skills: recommended and should be implemented first

Use the four project-local skills from P00:

- `pcad-upstream-safe-customization`
- `pcad-supabase-settings`
- `pcad-ai-provider-registry`
- `pcad-settings-ui`

They are appropriate because this work repeatedly requires the same repository-specific constraints and can be loaded on demand by the development agent.

## Separate development agent: recommended

`pcad-maintainer` should be introduced. Do **not** use the existing runtime `pcad-builder` to modify application source. `pcad-builder` is intentionally restricted to validating/generated OpenSCAD and has a different security/behavior contract.

## New OpenCode plugin: not required initially

OpenCode already provides the read/edit/grep/bash/LSP capabilities needed for repository implementation. No new MCP server or plugin is needed just to build these settings features.

Only add a development custom tool later if repeated implementation evidence shows a missing deterministic operation. Possible future example:

```text
pcad_upstream_seam_check
```

which could summarize changed upstream-heavy files and fail when a task unexpectedly expands its conflict surface. This is optional and should not block P01.

The existing `pcad-validation` runtime plugin remains dedicated to OpenSCAD validation and should not be repurposed for settings development.

---

# 20. Definition of complete product behavior

The feature set is complete when all of the following are true:

- Settings contains Models, Prompts and Providers.
- User can hide/show models without altering the upstream catalog.
- New upstream models appear automatically by default.
- CADAM Original prompt is fully readable and immutable.
- Edit Original creates a separate custom profile.
- Multiple prompt profiles can coexist.
- Overlay profiles inherit future upstream prompt changes.
- Fork profiles remain stable and report when their base prompt revision changed.
- New conversations pin the selected default prompt profile.
- User can add a custom provider and models.
- Provider credentials are encrypted server-side and never returned in plaintext.
- Custom provider models participate in the same visibility controls.
- Built-in providers and OpenCode remain unchanged unless the user selects something else.
- Existing conversations are not silently rewritten when settings change.
- No silent provider/model fallback exists.
- desktop/mobile Settings flows pass manual acceptance.
- full test/typecheck/lint/build gate is green.
- local customization remains concentrated behind documented additive seams so relevant future CADAM changes can still be reconciled cleanly.
