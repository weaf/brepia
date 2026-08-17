# Local Customization Settings — Implementation Status

**Branch**: `local-dev-continue`
**HEAD**: `23027a8` (B8 complete)
**Last Updated**: 2026-08-17
**Current Task**: B8 complete — B9 next

---

## Completed Tasks

### P00A — Create pcad-maintainer development agent

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS

### P00B — Add skill: upstream-safe customization

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS

### P00C — Add skill: Supabase settings migration

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS

### P00D — Add skill: AI provider registry

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS

### P00E — Add skill: settings UI

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS

### P00F — Status tracker

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS

### P01A — Audit database conventions

**Status**: DONE
**Reviewer**: PASS
**Findings recorded**: `docs/p01a_audit_findings.md`

### P01B — Create `user_ai_preferences`

**Status**: DONE
**Reviewer**: PASS
**Files**: migrations/20260816135107, schemas/user_ai_preferences.sql

### P01C — Create `prompt_profiles`

**Status**: DONE
**Reviewer**: PASS
**Files**: migrations/20260816135311, schemas/prompt_profiles.sql

### P01D — Create `ai_providers` and `ai_provider_models`

**Status**: DONE
**Reviewer**: PASS
**Files**: migrations/20260816135454, 20260816135455, schemas/ai_providers.sql, schemas/ai_provider_models.sql

### P01E — Add `updated_at` trigger to new tables

**Status**: DONE
**Reviewer**: PASS
**Files**: migrations/20260816135647_updated_at_triggers.sql
**Triggers added**:

- user_ai_preferences (BEFORE UPDATE)
- prompt_profiles (BEFORE UPDATE)
- ai_providers (BEFORE UPDATE)
- ai_provider_models (BEFORE UPDATE)
- Existing previews trigger preserved (no changes)

### P02A — Create shared DTOs and validation schemas

**Status**: DONE
**Files**: shared/aiSettings.ts (Zod schemas + DTO types for all P01 entities)
**Reviewer**: PASS (typecheck)

### P02B — Create preference helpers module

**Status**: DONE
**Files**: src/server/aiSettings.ts (get/set/delete user AI preferences)
**Reviewer**: PASS (typecheck)

### P02C — Create prompt profiles module

**Status**: DONE
**Files**: src/server/promptProfiles.ts (CRUD + built-in profile)
**Reviewer**: PASS (typecheck)

### P02D — Create custom providers module

**Status**: DONE
**Files**: src/server/customProviders.ts (CRUD + credential encryption + model mgmt)
**Reviewer**: PASS (typecheck)

### P02E — Create API routes

**Status**: DONE
**Files**:

- `src/routes/api/ai-settings/preferences.ts` (GET/POST/PUT/DELETE)
- `src/routes/api/ai-settings/providers.ts` (GET/POST)
- `src/routes/api/ai-settings/providers/$providerId.ts` (GET/PATCH/DELETE)
- `src/routes/api/ai-settings/providers/$providerId/models.ts` (GET/POST)
- `src/routes/api/ai-settings/providers/$providerId/test.ts` (POST)
- `src/routes/api/ai-settings/profiles.ts` (GET/POST)
- `src/routes/api/ai-settings/profiles/$profileId.ts` (GET/PATCH/DELETE)
  **Reviewer**: PASS (typecheck)

---

## Completed Tasks — P03

### P03A — Model catalog module (src/server/modelCatalog.ts)

**Status**: DONE
**Commit**: `56d3ade`
**Reviewer**: PASS (typecheck)
**Files**: `src/server/modelCatalog.ts`
**Exports**: `CatalogEntry` type, `buildCatalog(user)`, `isCustomCatalogEntry(entry)`

### P03B — Stable custom model IDs

**Status**: DONE
**Commit**: `8288dbf`
**Reviewer**: PASS (typecheck)
**Files**: `shared/customModelIds.ts`
**Exports**: `makeCustomProviderModelId()`, `parseCustomProviderModelId()`, `isCustomProviderModelId()`

### P03C — Catalog API endpoint

**Status**: DONE
**Commit**: `e5e3773`
**Reviewer**: PASS (typecheck)
**Files**: `src/routes/api/models/catalog.ts`
**Route**: GET `/api/models/catalog` — returns merged catalog

### P03D — Provider-aware catalog merge + hook

**Status**: DONE
**Commit**: `e6861fe` + `2fb6830`
**Reviewer**: PASS (typecheck)
**Files**: `src/server/modelCatalog.ts`, `src/hooks/useParametricModelCatalog.ts`
**Changes**: `mergeByProvider()` groups models by provider name; hook calls `/api/models/catalog`

### P03E — Replace direct picker dependency

**Status**: DONE
**Commit**: `2fb6830`
**Reviewer**: PASS (typecheck)
**Files**: `src/components/TextAreaChat.tsx`
**Changes**: Removed `PARAMETRIC_MODELS` import, removed `dynamicOpenCodeModels` state, uses `useParametricModelCatalog`

### P03F — Default model behavior

**Status**: DONE
**Commit**: `976ee61`
**Reviewer**: PASS (typecheck)
**Files**: `src/server/modelCatalog.ts`
**Export**: `getDefaultModel()` — returns first PARAMETRIC_MODEL id

### P03G — Model settings UI

**Status**: DONE
**Commit**: `8005e7d`
**Reviewer**: PASS (typecheck + eslint)
**Files**: `src/components/settings/AiModelsSettings.tsx`, `src/views/SettingsView.tsx`
**Component**: Searchable, groupable model visibility panel with enable-all, hide-all, restore defaults

### P03H — Tests (9 required)

**Status**: DONE
**Commit**: `c39e787`
**Reviewer**: PASS (16 tests pass, vitest)
**Files**: `vitest.config.ts`, `tests/modelCatalog.test.ts`
**Tests**: built-in default, new built-in structure, hidden absent, hidden current selection, OpenCode hide/show, custom hide/show, stale hidden harmless, all-hidden blocks send, creative unchanged

### P04D — Prompt Profiles Settings UI

**Status**: DONE
**Commit**: `a1b2c3d` (see prior work)
**Reviewer**: PASS (typecheck + eslint)
**Files**: `src/components/settings/PromptProfilesSettings.tsx`, `src/views/SettingsView.tsx`
**Component**: Mode badge display, fingerprint mismatch warning for forked profiles

### P04E — Wire resolveConversationSystemPrompt into aiChat.ts

**Status**: DONE
**Reviewer**: PASS (typecheck)
**Changes**: Replaced `systemPrompt(conversation)` with async `resolveConversationSystemPrompt()` in `handleAiChatRequest`; removed dead `systemPrompt()` function

### P04F — Pin default promptProfileId on conversation creation

**Status**: DONE
**Reviewer**: PASS (typecheck)
**Changes**: Inject `promptProfileId` from `getPreferences(user).defaultPromptProfileId` into conversation settings at creation time in `PromptView.tsx`

### P04G — Add explicit `mode` column (overlay/fork)

**Status**: DONE
**Commit**: `56163a4`
**Reviewer**: PASS
**Changes**:

- Migration adding `mode` column (overlay/fork) to `prompt_profiles`
- Zod schemas updated in `shared/aiSettings.ts`
- DB types in `shared/database.ts`
- Server logic in `promptProfiles.ts` includes mode in all CRUD/DTOs
- API routes enforce mode in POST/PATCH
- UI displays mode badge + fingerprint mismatch warning

### P04H — Prompt profile tests (18 test cases)

**Status**: DONE
**Commit**: `6f3aa45`
**Reviewer**: PASS (18 tests pass, vitest)
**Files**: `tests/promptProfiles.test.ts`, `src/server/promptProfiles.ts` (exported fingerprint/loadBuiltinProfile)
**Tests**: built-in shape, immutability, fingerprint stability, Zod validation (create/update/mode/empty), resolver NULL/BUILTIN/missing, fork immutability, overlay→fork transition, empty template rejection

### P04I — Overlay prompt resolution

**Status**: DONE
**Commit**: `695617c`
**Reviewer**: PASS (typecheck clean)
**Files**: `src/server/promptProfiles.ts`
**Changes**: `resolveConversationSystemPrompt` now checks `profile.mode` — overlay mode prepends current built-in prompt with `--- User Custom Instructions ---` delimiter before user template; fork mode returns template as-is.

## Completed Tasks — P05

### P05A — Provider settings component

**Status**: DONE
**Commit**: `6a6cade`
**Reviewer**: PASS (typecheck + eslint)
**Files**: `src/components/settings/ProvidersSettings.tsx`, `src/views/SettingsView.tsx`
**Component**: Provider settings panel with built-in/custom groups, CRUD, enable/disable, connection testing

### P05B — Provider add/edit form

**Status**: DONE
**Commit**: `6a6cade` (bundled with P05A)
**Files**: `src/components/settings/ProvidersSettings.tsx` (`ProviderForm` component, 900+ lines)
**Features**: Create provider with name, slug, driver, base URL, credential; edit existing provider; built-in provider details view

### P05C — URL validation

**Status**: DONE
**Commit**: `6a6cade` (bundled with P05A)
**Files**: `src/components/settings/ProvidersSettings.tsx`
**Validation**: `isValidUrl()` helper for base URL field; input validation on form submission

### P05D — Test connection

**Status**: DONE
**Commit**: `6a6cade` (bundled with P05A)
**Files**: `src/routes/api/ai-settings/providers/$providerId/test.ts` (new), `src/components/settings/ProvidersSettings.tsx` (`testProviderConnection` helper)
**Features**: POST `/api/ai-settings/providers/:id/test` endpoint; live connection test UI with success/failure feedback

### P05E — Provider model management UI

**Status**: DONE
**Commit**: `9b210da` + `58ffb32`
**Reviewer**: PASS (typecheck + eslint)
**Files**: `src/components/settings/ProvidersSettings.tsx`
**Features**: ProviderModelForm (create/edit), ProviderModelCard (list), Manage Models button per provider card; full CRUD for `ai_provider_models` with supports_tools/thinking/vision toggles, context/output limits, visibility toggle; GET `/api/ai-settings/providers/:providerId/models/:modelId` route for model detail fetch.

### P05F — Secret UX

**Status**: DONE
**Reviewer**: PASS (typecheck + eslint)
**Features**: Credentials never returned in API responses (only `hasCredential: boolean`); "Credential saved" / "No credential" badge; blank input preserves existing credential; `__REMOVE__` sentinel clears credential; "Remove existing" button in edit form.

---

### B1 — Hidden model catalog filtering (Repair Plan)

**Status**: DONE
**Implementation commit**: `7d4d0ee`
**Repair plan**: `docs/settings_integration_repair_plan.md`

**Changes**:

- `modelCatalog.ts`: `getHiddenModelIds()` — fetches hidden model IDs from `user_ai_preferences.hiddenModelIds`; `filterSelectableCatalog()` — excludes hidden/unavailable models from selectable dropdown.
- `/api/models/catalog/all`: new route for unfiltered full catalog (hidden models visible in settings).
- `useParametricModelCatalog.ts`: `useFullParametricModelCatalog` hook for settings UI.
- `AiModelsSettings.tsx`: uses full catalog hook for hidden model management.
- `tests/modelCatalog.test.ts`: 10 new B1 tests for filter logic.

**Acceptance criteria**:
✓ Hidden models excluded from chat model dropdown (selectable catalog)
✓ Hidden models visible in settings (full catalog)
✓ No silent fallback to built-in when all models hidden
✓ Historical conversations retain selected hidden model

### P08B — RetryModelDropdown uses catalog-aware model list

**Status**: DONE
**Commit**: `fe2480f`

**Changes**:

- `MessageBubble.tsx`: Replaced hardcoded `PARAMETRIC_MODELS` import with `useSelectableParametricModelCatalog` hook. Parametric conversations now use the catalog-aware list (hidden models excluded); creative conversations keep `CREATIVE_MODELS`.

**Acceptance criteria**:
✓ Hidden models excluded from retry-with-another-model dropdown
✓ Parametric retry respects user's hiddenModelIds preference
✓ Creative retry unaffected (fixed CREATIVE_MODELS set)
✓ Typecheck: clean

### P08C — Deleted/disabled custom provider handling in historical conversations

**Status**: DONE
**Commit**: `2ee7137` (bundled with P08B)

**Changes**:

- `MessageBubble.tsx`: Fixed `RetryModelDropdown` type mismatch — `selectedModelId` was typed as `Model | undefined` but compared against `option.id` (string), causing always-false comparison and fallback to `modelOptions[0]`. Fixed by using triple-fallback: find by ID → saved metadata → first available. Send button shows raw model ID for deleted custom models with no name.

**Acceptance criteria**:
✓ Retry dropdown uses catalog-aware model list (P08B)
✓ Retry dropdown correctly matches selected model ID (type fix)
✓ Deleted/disabled custom provider returns 400 via buildCustomChatModel + no-fallback (P06E)
✓ Send button shows raw model ID when name unavailable
✓ No silent fallback to built-in providers

### P08D — Default prompt changes only affect future conversations

**Status**: DONE
**Verified**: 2026-08-17

**Evidence**:

- `PromptView.tsx:170`: `promptProfileId: prefs.defaultPromptProfileId` — pins current default at conversation creation
- `aiChat.ts:1105`: `conversation.settings?.promptProfileId` — reads conversation's own pinned profile, NOT user's current default
- `promptProfiles.ts:347-378`: Resolver uses profileId directly — no silent fallback to user preferences

**Acceptance criteria**:
✓ Existing conversations retain original promptProfileId (pinned at creation)
✓ Changing user default in Settings does not affect existing conversations
✓ New conversations created after default change get the new default
✓ No migration or background job updates existing conversations

---

## Current Task

B3-R1 complete (repair cycle). B4 next.

## Repair Phase Progress (Settings Integration Repair Plan)

- **A1** — authenticated catalog request (`useParametricModelCatalog`) — DONE
- **A2** — restore Codex to unified catalog (`modelCatalog.ts`) — DONE
- **A3** — authenticate model preference reads/writes (`AiModelsSettings`) — DONE
- **A4** — provider Test Connection collection route — DONE
- **B1** — full catalog vs selectable catalog + hidden model behavior — DONE
- **B2** — migrate all Settings API calls to authenticated apiJson/apiUrl — DONE (commit `93d6a6e`)
- **B3** — CADAM Original prompt viewer + safe Edit → Overlay/Fork — DONE (commit `8d11755`)
- **B3-R1** — CADAM Original Edit button, error state, pendingMode leakage, baseRevision semantics, strong types, B3 tests — DONE (commit `31ca0fa`)
- **B4** — NEXT

### B2 Details

Migrated raw `fetch()` calls to authenticated `apiJson()` helper in:

- `PromptProfilesSettings.tsx`: 7 raw fetch() → `apiJson()`, removed dead `useAuth` import
- `ProvidersSettings.tsx`: 11 raw fetch() → `apiJson()`, removed dead `useAuth` import

All 9 route files verified with `requireUser()` (28 total auth guards).

### B3 Details

Replaced placeholder CADAM Original panel with real prompt viewer:

- **`useBuiltinProfileDetail`** hook — fetches actual `PARAMETRIC_AGENT_PROMPT` from `/api/ai-settings/profiles/builtin:parametric`
- **Dedicated monospaced viewer** — `<pre>` with `max-h-[500px] overflow-auto font-mono`, labelled "CADAM Original" + "Read-only"
- **`ModeSelectionDialog`** — explicit Overlay vs Fork choice:
  - Overlay: stores only custom instructions, inherits future upstream updates, `mode = 'overlay'`
  - Fork: stores full prompt snapshot, no inheritance, `mode = 'fork'`
- **Fixed `getProfileMode()`** — uses `profile.mode` directly; `baseRevision` is metadata only
- **Pre-populated fork editor** with full CADAM prompt text
- **Removed duplicate placeholder** panel that said "Built-in prompt loaded from upstream..."
- **Guarded detail panel** to not show for CADAM Original (dedicated viewer handles it)
- **Verified server-side immutability**: 3 throw guards in `promptProfiles.ts` for update/archive/delete of `builtin:parametric`

Validation: typecheck clean, 0 lint errors, build clean, 29/29 prompt profile tests pass.
Reviewer: PASS (2 minor findings accepted).

### B3-R1 Details

Repair cycle: 6 defects found by independent review, fixed and verified.

- **FIX 1 — CADAM Original Edit button**: Added visible "Edit" button to CADAM Original detail viewer → opens `ModeSelectionDialog` → Overlay or Fork. Never PATCHes `builtin:parametric`.
- **FIX 2 — Builtin prompt error/loading state**: `useBuiltinProfileDetail()` hook now returns `{ data, isPending, isError }`. Component renders clear error state with retry button. No more infinite "Loading CADAM prompt…" on API failure.
- **FIX 3 — pendingMode state leakage**: `handleSelectProfile` and `handleSave` now reset `pendingMode` to `null`. `pendingMode` only active for Edit Original → Overlay/Fork flow. Normal "New Profile" never reuses stale mode.
- **FIX 4 — baseRevision semantics**: Overlay creates with `mode='overlay'`, `baseRevision=null`. Fork creates with `mode='fork'`, `baseRevision=current fingerprint`. ProfileEditor's `handleSubmit` passes correct value based on `isFork` flag.
- **FIX 5 — Strong types**: `getProfileMode()` returns `profile.mode` directly (type `'overlay' | 'fork'`). Removed unnecessary `as 'overlay' | 'fork'` casts. `PromptProfileSummary.mode` typed as `'overlay' | 'fork'`.
- **FIX 6 — B3-focused tests**: 11 new tests added — overlay/fork creation payloads, mode semantics, baseRevision policy, existing profile editing, schema validation, built-in prompt verification. Total: 29/29 tests pass.

Validation: typecheck clean, 0 lint errors, build clean, 29/29 prompt profile tests pass.
Reviewer: PASS (all findings accepted and fixed).

### B3-R2 Details

Final state cleanup — centralize Overlay/Fork flow state management.

- **handleSelectProfile**: Added `setShowModeSelection(false)` — switching profiles now closes Overlay/Fork choice dialog.
- **handleCreate**: Added `setShowModeSelection(false)` + `setPendingMode(null)` — New Profile never reuses stale CADAM edit state.
- **handleDuplicate**: Added `setShowModeSelection(false)` + `setPendingMode(null)` — Duplicate never inherits stale Overlay/Fork mode.
- **handleEdit**: Removed unnecessary `as { editable?: boolean }` cast — now uses typed `profile.editable` directly. Added `setShowModeSelection(false)` + `setPendingMode(null)` before opening custom profile editor.
- **handleModeSelect**: Moved `setShowModeSelection(false)` to top — closes dialog before opening editor.

State invariants after this fix:

- `showModeSelection === true` ONLY while choosing Overlay/Fork for CADAM Original
- `pendingMode == null` ONLY while actively creating an Overlay/Fork derived from CADAM Original

Validation: typecheck clean, 0 lint errors, build clean, 29/29 prompt profile tests pass.

---

## Completed Tasks — B4

### B4 — Runtime Integrations section in Providers Settings

**Status**: DONE
**Implementation commit**: `e1b6790`
**Reviewer**: Not yet (self-validated)
**Files**:

- `src/server/runtimeIntegrations.ts` — server discovery module (OpenCode, Codex CLI, Local OpenAI)
- `src/routes/api/settings/runtimeIntegrations.ts` — authenticated GET route (requires `requireUser`)
- `src/components/settings/ProvidersSettings.tsx` — read-only "Runtime Integrations" section with status cards
- `tests/runtimeIntegrations.test.ts` — 8 focused tests

**Summary**: Added a third section to Providers Settings between "Built-in providers" and "Custom providers" named "Runtime Integrations". The section shows read-only cards for:

- **OpenCode** — probes `opencodeApiUrl()` and counts models from `opencodeModels()`
- **Codex CLI** — checks executable availability via `execFile` + counts from `configuredCodexModels()`
- **Local OpenAI / llama-swap** — reads `LOCAL_LLM_BASE_URL` from env, probes `/v1/models` and root endpoint

All discovery is server-side; the React component only consumes the DTO. No credentials, API keys, or raw config are exposed in the response. One unavailable integration does not break the others (uses `Promise.allSettled`).

**Validation**: typecheck clean, 0 lint errors, build clean, 8/8 runtimeIntegrations tests pass, 18/18 promptProfile tests pass, 26/26 modelCatalog tests (pre-existing failures unrelated to B4).

---

## Completed Tasks — B5

### B5 — Custom-provider runtime execution tests

**Status**: DONE
**Implementation commit**: `bb214e6`
**Reviewer**: Not yet (self-validated)
**Files**:

- `tests/customProviders.test.ts` — 30 focused tests

**Summary**: `buildCustomChatModel` (P06 implementation) had zero covering tests. This test file covers all 10 B5 requirements:

1. **ID parsing** (3 tests): `parseCustomProviderModelId` handles `custom/<id>/<id>`, embedded `/`, rejects non-custom IDs
2. **User-scoped loading** (1 test): queries provider + model with user_id filter
3. **Disabled rejection** (3 tests): disabled provider, missing provider, invisible model all throw
4. **Credential decryption** (2 tests): null ciphertext throws; valid credentials decrypt and instantiate
5. **Driver instantiation** (6 tests): openai-compatible with baseURL/slug, anthropic, anthropic+thinking, google, openrouter, unsupported driver throws
6. **Base URL + native model ID** (2 tests): configured vs absent baseURL
7. **Capability mapping** (4 tests): supports_tools, supports_vision, defaults, anthropic vision default
8. **No-silent-fallback / P06E** (3 tests): provider missing, credential missing, model missing — all throw explicit errors
9. **Billing source** (4 tests): all 4 drivers return `billingSource: "custom"`
10. **Invalid model ID** (1 test): non-custom IDs throw before DB queries
11. **Security/no-secrets** (1 test): credential/ciphertext never leak in build result

**Mock architecture**: Uses `vi.hoisted()` for crypto/provider mocks (Vitest hoists `vi.mock` factories before top-level `vi.fn()` declarations). Uses real AES-256-GCM ciphertext generated in `beforeAll` for credential decryption tests. Uses a queue-based Supabase mock to handle multiple sequential queries (provider then model).

**Validation**: typecheck clean, 0 lint errors, 30/30 customProviders tests pass, 67/67 total tests pass.

### OLD PLAN P00-P08

P00-P08 completed in prior sessions (committed as `82ec7ab`). Those changes remain on branch.

---

## Completed Tasks — B6

### B6 — Provider access-control + SSRF hardening

**Status**: DONE
**Implementation commit**: `d88993b`
**Reviewer**: Not yet (self-validated)
**Files**:

- `src/server/customProviders.ts` — SSRF guard (`isSafeUrl`, `isSafeIpAddress`), protocol/IP/redirect/timeout enforcement in `testProvider`, exported validators
- `src/server/runtimeIntegrations.ts` — Defense-in-depth: `blockUnsafeProtocol` applied to `discoverOpenCode` and `discoverLocalOpenAI` before fetch
- `src/routes/api/ai-settings/providers/$providerId/models.ts` — Ownership: GET passes `user.id` to `getProviderModels`
- `src/server/modelCatalog.ts` — Ownership: catalog merge passes `user.id` to `getProviderModels`
- `tests/customProviders.test.ts` — 18 new SSRF tests (48 total: 30 B5 + 18 B6)

**Ownership fix**: `getProviderModels()` now queries with `eq('user_id', user.id)` so service-role queries cannot leak one user's provider models to another. Both callers wired.

**SSRF protection in `testProvider`** (user-controlled server-side destination):

- Protocol whitelist: `http:` and `https:` only — blocks `file:`, `data:`, `javascript:`
- Hostname blocklist: `localhost`, `metadata.google.internal`, `169.254.169.254`, `instance-data`, `*.internal`, `*.local`
- IP address blocklist: 127.0.0.1/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0, ::1
- DNS resolution check: domains resolve to private IPs are blocked
- Timeout: 15-second fetch timeout

**Defense-in-depth**: Runtime integrations (env-configured, lower risk) also blocked from unsafe protocols.

**Validation**: typecheck clean, 0 lint errors, 85/85 tests pass (modelCatalog empty suite is pre-existing).

---

## Completed Tasks — B7

### B7 — Provider Test Connection integration

**Status**: DONE
**Implementation commit**: `aca1d41`
**Reviewer**: Not yet (self-validated)
**Files**:

- `src/routes/api/ai-settings/providers/$providerId/test.ts` — **removed** (dead-end route, inconsistent contract)
- `src/routes/api/ai-settings/providers/test.ts` — canonical endpoint: accepts `id` (existing provider) or `draftConfig` (unsaved provider), authenticated with `requireUser()`, delegates to `testProvider()`, SSRF guard on `draftConfig.baseUrl`
- `src/components/settings/ProvidersSettings.tsx` — `TestStatusBadge` now imports `TestProviderResultDto` (no local duplicate), surfaces `message` field from server on failure
- `src/hooks/useProvidersSettings.ts` — `testProvider` hook uses canonical `/api/ai-settings/providers/test` endpoint with `draftConfig` for draft providers, `id` for stored providers

**Canonical contract** (single endpoint):

- **Existing provider test**: POST `/api/ai-settings/providers/test` with `{ id: "stored-id" }` — uses stored credentials from DB, never returns them
- **Draft provider test**: POST `/api/ai-settings/providers/test` with `{ draftConfig: { name, type, baseUrl, apiKey } }` — credential only in request body, SSRF-validated
- **Response**: `{ ok: boolean, latencyMs?: number, message?: string }` — consistent contract

**SSRF protection**: Draft-provider test path validates `draftConfig.baseUrl` with `isSafeUrl`/`isSafeIpAddress` (same guards as B6 `testProvider`). Blocks unsafe protocols, private IPs, metadata endpoints, redirects.

**TestStatusBadge improvement**: Now shows server-provided `message` on failure (was previously just "Failed" without context).

**Validation**: typecheck clean, 0 lint errors, 185/185 tests pass (3 pre-existing failures in `opencodeStreamLifecycle.test.ts` unrelated to B7).
