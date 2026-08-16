# Local Customization Settings — Implementation Status

**Branch**: `local-dev-continue`
**HEAD**: `b09527c` (P04F: Pin user's default promptProfileId on conversation creation)
**Last Updated**: 2026-08-16
**Current Task**: P04G — Upstream update behavior (test overlay vs fork inheritance)

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

## Current Task

P00-P03 complete. Ready for P04A.

## Validation Evidence

- Typecheck: PASS (zero errors)
- Git diff --check: PASS (no whitespace errors)
- No tracked upstream files modified
- pcad-builder.md: UNMODIFIED ✓

## Blockers

None — ready for P03.
