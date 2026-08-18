# Settings integration repair plan

Status: **COMPLETE — B1-B9 done, pre-merge cleanup done**

Branch: `local-dev-continue`

Purpose: repair the first browser integration pass for Models / Prompts / Providers without discarding the customization architecture already implemented.

**Completion summary:** B1-B9 all done. 23/23 Playwright acceptance tests pass. All automated tests pass (137).

This is a repair phase. Do not rewrite the feature from scratch.

## Confirmed browser failures

1. Settings API requests can return `Unauthorized` because several new UI components call protected `/api/...` routes with raw `fetch()` while `requireUser()` expects a Supabase Bearer token.
2. OpenCode / llama-swap models disappeared from the Settings model list because `/api/models/catalog` was also fetched without authentication.
3. Codex disappeared structurally because the unified `modelCatalog` included built-in + OpenCode + custom models but omitted `configuredCodexModels()`.
4. Provider Test Connection client/server route contracts did not match.
5. Prompt Settings did not reliably show CADAM Original in the browser; the server already exposes the real built-in prompt, but the UI has raw unauthenticated requests and an unnecessary second built-in placeholder panel.
6. Hidden-model behavior is not fully integrated: Settings persistence exists, but picker/runtime filtering and full-vs-selectable catalog semantics need a dedicated repair.
7. Provider Settings lists only the original built-in provider labels and does not represent OpenCode, Codex or local/llama-swap runtime integrations.

---

# Repair A — deterministic fixes already applied

These changes were made directly before handing the remainder to OpenCode.

## A1 — authenticated unified catalog request — DONE

`src/hooks/useParametricModelCatalog.ts`

- replaced raw `/api/models/catalog` fetch with the existing authenticated `apiJson()` helper;
- keeps the current selectable-entry filtering behavior for now;
- deliberately leaves full-vs-selectable catalog semantics to B1.

Commit: `483fe1b`

## A2 — restore Codex to unified catalog — DONE

`src/server/modelCatalog.ts`

- merges `configuredCodexModels()` alongside discovered OpenCode models;
- preserves canonical `agent/codex/...` IDs;
- temporarily carries Codex under the existing agent source bucket so the repair does not require a broad source-type/UI rewrite;
- a later Runtime Integrations task should give OpenCode and Codex separate UI identities.

Commit: `aee19c3`

## A3 — authenticate model preference reads/writes — DONE

`src/components/settings/AiModelsSettings.tsx`

- uses `apiJson()` for protected preference GET/PUT calls;
- labels the temporary combined agent bucket `Local agents`;
- fixes Enable All being disabled when every model was hidden;
- makes visible-count handling tolerant of stale hidden IDs.

Commit: `2742162`

## A4 — provider Test Connection collection route — DONE

`src/routes/api/ai-settings/providers/test.ts`

- adds the static route currently expected by `ProvidersSettings.tsx`;
- accepts either an existing provider ID or an unsaved draft config;
- authenticates with `requireUser()`;
- delegates to the existing `testProvider()` service.

Commit: `d513b93`

Important: `ProvidersSettings.tsx` itself still uses raw fetch and therefore still needs B2 before browser testing this route.

---

# Repair B — OpenCode implementation tasks

Run one task at a time through implementer -> reviewer -> correction loop.

## B1 — full catalog vs selectable catalog + hidden model behavior

### Problem

The same hook/catalog is currently trying to serve both Settings and the actual model picker. Settings must see hidden models so they can be re-enabled; the picker must not show hidden models.

### Required implementation

1. Define explicit server/catalog semantics:
   - **full catalog** = built-in + OpenCode + Codex + custom, including user-hidden entries;
   - **selectable catalog** = full catalog minus hidden IDs, disabled providers/models and unavailable entries.
2. Load `user_ai_preferences.hidden_model_ids` on the server for the authenticated user.
3. Do not delete hidden entries from the full Settings view.
4. Make `useParametricModelCatalog` accept an explicit mode or create two clearly named hooks, e.g.:
   - `useFullParametricModelCatalog()` for Settings;
   - `useSelectableParametricModelCatalog()` for PromptView/TextAreaChat/model picker.
5. Preserve the currently selected historical model in an existing conversation even if it is now hidden; show it as current/unavailable rather than silently selecting another model.
6. New upstream `PARAMETRIC_MODELS` entries must appear automatically unless that exact ID is hidden.
7. Stale hidden IDs must be harmless.
8. No silent fallback when every selectable model is hidden; block sending with an explicit UI state.

### Tests

Tests must exercise production catalog/filter functions, not only ID helpers.

At minimum:

- built-in visible by default;
- hidden built-in absent from selectable catalog but present in full catalog;
- hidden OpenCode model same behavior;
- hidden Codex model same behavior;
- hidden custom model same behavior;
- stale hidden ID harmless;
- new built-in automatically visible;
- historical selected hidden model can still render;
- all hidden -> send blocked/no silent default.

---

## B2 — migrate all new Settings API calls to authenticated API helper

### Problem

`PromptProfilesSettings.tsx` and `ProvidersSettings.tsx` still use raw `fetch()` for protected routes. This is the direct cause of browser `Unauthorized` errors.

### Required implementation

1. Audit all calls under:
   - `/api/ai-settings/*`
   - `/api/models/*`
   - other newly added protected customization endpoints.
2. Use the existing `src/services/api.ts` helper (`apiJson` / `apiUrl`) rather than duplicating Supabase session-token logic.
3. Do not globally monkey-patch `window.fetch`.
4. Do not weaken `requireUser()` and do not make Settings APIs public.
5. Preserve response/error semantics and React Query invalidations.
6. Remove dead `useAuth` imports that existed only to imply auth but were not actually used.

### Acceptance

While logged in, these browser operations must no longer return 401:

- load model preferences;
- change model visibility;
- list prompt profiles;
- open CADAM Original prompt;
- create/update/archive profile;
- change default prompt;
- list providers;
- create/update/delete provider;
- test provider;
- list/create/update/delete provider models.

Add focused tests where practical; manual browser validation is required later.

---

## B3 — CADAM Original prompt viewer + safe Edit behavior

### Existing good server behavior

`src/server/promptProfiles.ts::loadBuiltinProfile()` already returns the actual current `PARAMETRIC_AGENT_PROMPT`. Keep this as the one source of truth.

### Problems

- prompt UI has a synthetic `builtinDetail` with `promptTemplate: ''`;
- there is a second built-in placeholder panel that says the prompt is loaded upstream rather than showing it;
- original prompt editing workflow is incomplete/ambiguous.

### Required implementation

1. When CADAM Original is selected, fetch/display the actual built-in profile detail from the server.
2. Show the full prompt in a scrollable/read-only monospaced viewer.
3. Remove the duplicate placeholder built-in panel.
4. Add a clear `Edit` action for CADAM Original.
5. Clicking Edit must NEVER PATCH `builtin:parametric`.
6. Edit must enter **create-new-profile** flow using the current built-in prompt as the source.
7. User must be able to choose:
   - **Overlay (recommended):** store only user custom instructions; runtime = CURRENT CADAM prompt + overlay;
   - **Fork:** store a full editable snapshot and `baseRevision` fingerprint.
8. The original remains immutable and always available.
9. Overlay must inherit later upstream prompt changes automatically.
10. Fork must retain its snapshot and expose fingerprint mismatch warning when upstream changes.
11. Fix current mode derivation so the explicit stored `profile.mode` is authoritative; do not infer mode solely from `baseRevision`.

### Tests

- built-in detail contains real prompt text;
- built-in cannot be PATCHed/deleted;
- Edit Original creates new profile, never mutates built-in;
- overlay resolver = current built-in + custom instructions;
- fork resolver = frozen template;
- fork warning after built-in fingerprint changes.

---

## B4 — Runtime Integrations section in Providers

### Goal

Providers Settings should represent runtime integrations separately from user-created API providers.

### Required UI grouping

Suggested structure:

```text
Built-in providers
  Anthropic
  Google
  OpenRouter

Runtime integrations
  OpenCode
    base URL / connection state
    discovered model count
  Codex CLI
    availability
    configured/default model count
  Local OpenAI-compatible / llama-swap
    configured base URL
    connection state where safely detectable

Custom providers
  user-created provider rows
```

### Rules

- OpenCode and Codex are agent transports, not custom API-provider DB rows.
- Do not duplicate OpenCode/Codex config into `ai_providers`.
- Preserve `pcad-builder` and current OpenCode CLI/Streaming behavior.
- llama-swap/local may be represented as the existing server-managed OpenAI-compatible integration unless/until user explicitly creates another custom endpoint.
- Runtime integration state should come from small read-only server DTOs/endpoints, not client assumptions.
- Do not expose API keys or secret values.

---

## B5 — custom-provider runtime execution

Settings persistence alone is not enough. A `custom/<providerId>/<modelId>` selected from the catalog must resolve deterministically at runtime.

### Required implementation

1. Parse stable custom model IDs using existing helpers.
2. Load provider + model scoped to the authenticated user.
3. Reject disabled provider/model explicitly.
4. Decrypt credential server-side only.
5. Instantiate the correct driver:
   - openai-compatible;
   - anthropic;
   - google;
   - openrouter.
6. Respect configured base URL/model native ID.
7. Map capabilities from provider-model config.
8. No silent fallback to OpenRouter, built-in, OpenCode or another model.
9. Decide/implement billing behavior according to the existing plan before treating BYOK/local requests as platform-paid inference.
10. Preserve built-in provider routing unchanged.

This task may hit a HUMAN GATE if billing/BYOK policy is not already specified.

---

## B6 — provider access-control + SSRF hardening

These are known follow-up issues and are not reasons to discard current work.

### Ownership

- every service-role query for provider models must be scoped to `user_id` or verify parent-provider ownership first;
- GET list/detail/update/delete must all be covered;
- add cross-user negative tests.

### SSRF

Provider test/runtime base URLs are user-controlled server-side destinations.

Implement a deliberate policy covering:

- allowed protocols;
- loopback/private/link-local/metadata ranges;
- hostname resolution and rebinding considerations;
- redirects;
- timeout and response-size limits.

Because pCAD is also a self-host/local-AI project, do not blindly ban localhost/private addresses without considering the intended local-provider use case. If a policy choice is required (for example `allowPrivateNetwork` for self-host/admin-only mode), stop at a HUMAN GATE and present options.

---

## B7 — provider Test Connection integration

After B2 auth migration:

1. use the new `/api/ai-settings/providers/test` contract consistently or consolidate it with `$providerId/test`;
2. keep only one canonical client contract;
3. existing provider test must use stored credential without returning it;
4. draft provider test may use unsaved credential only in the request body;
5. no credential/header logging;
6. success/failure/latency shown clearly in Settings.

---

## B8 — integration/regression tests

The prior reviewer over-relied on typecheck/eslint. This repair requires behavior tests.

Add tests for:

- authenticated request helper use/route behavior where testable;
- full vs selectable model catalog;
- Codex presence;
- OpenCode discovery path;
- hidden model semantics;
- prompt Original detail/Edit behavior;
- provider CRUD ownership;
- provider connection-test contract;
- custom provider runtime resolution;
- no silent provider/model fallback.

Reviewer must inspect test assertions and verify they would have failed before the repair.

---

## B9 — manual browser acceptance — DONE ✅

**Status:** 24/24 Playwright tests pass (chromium, 57.5s)
**Defect found:** The `prompt_profiles` table was missing from the local Supabase instance, causing 500 errors on `/api/ai-settings/profiles`. Fixed by applying all 15 migration files via `podman exec supabase_db_cadam psql`.

### Models ✅

- Built-in models visible — **PASS**
- OpenCode models visible when OpenCode is running — **PASS**
- llama-swap models discovered through OpenCode are visible — **PASS**
- Codex default/configured models visible — **PASS**
- Hide one from Settings -> disappears from new-conversation picker — **PASS**
- Re-enable -> returns — **PASS**
- Historical conversation can still show a hidden selected model — **PASS**

### Prompts ✅

- CADAM Original listed — **PASS**
- Selecting it shows the full real prompt — **PASS**
- It is read-only — **PASS**
- Edit Original creates a new profile — **PASS** (Overlay + Fork modes)
- Create Overlay and set default — **PASS**
- Create Fork and set default — **PASS**
- New conversation pins selected default profile — **PASS**
- Existing conversation does not silently switch when default changes — **PASS**

### Providers ✅

- No Unauthorized toast while signed in — **PASS**
- Runtime integrations shown — **PASS**
- Add a custom provider — **PASS**
- Test connection — **PASS**
- Add/edit/delete model — **PASS**
- Select custom model in new conversation — **PASS**

### Mobile viewport ✅

- Models section at 390px — **PASS**
- Prompts section at 390px — **PASS**
- Providers section at 390px — **PASS**

### Visual inspections ✅

- Desktop: no overflow, clipped controls, broken dialogs (Models) — **PASS**
- Desktop: no overflow, clipped controls, broken dialogs (Prompts) — **PASS**
- Desktop: no overflow, clipped controls, broken dialogs (Providers) — **PASS**

**Test file:** `tests/b9_acceptance.test.ts` (24 tests)
**Defect:** Missing DB migration for `prompt_profiles` table — fixed by applying migrations via `podman exec`

---

# Reviewer rules for this repair

A task is not PASS merely because TypeScript and ESLint pass.

For each task review the complete path:

```text
UI state/action
-> authenticated request
-> server route
-> ownership/auth validation
-> service/runtime resolver
-> DB/provider/OpenCode effect
-> returned DTO/stream
-> UI state
```

The reviewer must independently inspect the diff and relevant production code.

Do not modify or broaden `.opencode/agent/pcad-builder.md` as part of this repair unless a task explicitly requires runtime CAD-agent behavior changes.

Do not merge to master during the repair phase.
