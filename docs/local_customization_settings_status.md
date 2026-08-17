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

---

## Current Task

P00-P08B complete. P08C — Deleted/disabled custom provider handling in historical conversations; P08D — Default prompt changes only affect future conversations.

## Validation Evidence

- Typecheck: PASS (zero errors)
- ESLint: PASS (zero errors)
- Git diff --check: PASS (no whitespace errors)
- No tracked upstream files modified
- pcad-builder.md: UNMODIFIED ✓

## Blockers

None — P08C/D next (conversation integration).
