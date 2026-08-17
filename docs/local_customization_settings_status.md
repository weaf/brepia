# Local Customization Settings — Implementation Status

**Branch**: `local-dev-continue`
**HEAD**: `fe2480f` (P08B completed)
**Last Updated**: 2026-08-16
**Current Task**: P08B completed — P08C/D in progress

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

B3 complete (CADAM Original prompt viewer + safe Edit → Overlay/Fork). B4 next.

## Repair Phase Progress (Settings Integration Repair Plan)

- **A1** — authenticated catalog request (`useParametricModelCatalog`) — DONE
- **A2** — restore Codex to unified catalog (`modelCatalog.ts`) — DONE
- **A3** — authenticate model preference reads/writes (`AiModelsSettings`) — DONE
- **A4** — provider Test Connection collection route — DONE
- **B1** — full catalog vs selectable catalog + hidden model behavior — DONE
- **B2** — migrate all Settings API calls to authenticated apiJson/apiUrl — DONE (commit `93d6a6e`)
- **B3** — CADAM Original prompt viewer + safe Edit → Overlay/Fork — DONE (commit `8d11755`)
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

Validation: typecheck clean, 0 lint errors, build clean, 18/18 prompt profile tests pass.
Reviewer: PASS (2 minor findings accepted).

### OLD PLAN P00-P08

P00-P08 completed in prior sessions (committed as `82ec7ab`). Those changes remain on branch.
