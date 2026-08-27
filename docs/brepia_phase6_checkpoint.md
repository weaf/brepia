# Brepia Phase 6 checkpoint

Updated: 2026-08-27

This is the current execution checkpoint for `feature/brepia-remake`. Read it together with:

- `AGENTS.md`
- `docs/brepia_remake_plan.md`
- `docs/brepia_remake_status.md`
- `docs/brepia_branding.md`

## Branch lineage

The branch remains a linear descendant of master base:

`967f744976d3ae2fb64f3681745c8c046345499a`

The branch is still 0 commits behind `master`. The exact ahead count changes as this checkpoint is updated; use GitHub comparison rather than treating an old count in documentation as authoritative.

## Local environment convention

The local Supabase stack is managed by **NOx**.

Do not start/stop Supabase with a global CLI or with `npx supabase start/stop` on this workstation. Once NOx has started the stack, use the repository-local CLI for operations such as:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

Follow `.cursor/rules/database-workflow.mdc`: declarative schema first, generated migration second, never `db push`/`db pull`, and never hand-edit `shared/database.ts`.

## Phase 6 original technical gate — GREEN

The original Phase 6 technical gate was completed in the real local development environment before the runtime-review follow-ups were added.

Verified at that checkpoint:

- Instance identity migration applied.
- Discord social-link migration applied.
- `shared/database.ts` regenerated from the running local Supabase instance.
- `src/routeTree.gen.ts` regenerated through the TanStack/Vite toolchain.
- Generated database typing cleanup included.
- `npm test` PASS.
- `npm run typecheck` PASS.
- `npm run lint` PASS.
- `npm run build` PASS.

The default-model implementation below changes application code and adds a new migration, so the local migration/type-generation/test gate must be rerun before the branch is called ready to merge.

## Runtime visual review — desktop/mobile PASS

The application has been manually reviewed in the real running environment on both desktop and mobile.

User result:

- desktop presentation looks good;
- mobile presentation looks good;
- no Brepia branding/layout issue was identified that requires broad visual rework.

This satisfies the requirement that the main desktop/mobile visual gate be checked in the real application rather than by static code review alone.

Do not infer from this general pass that every specialized generated-media state was exercised unless explicitly recorded separately. GIF watermark, GLB transition, reduced-motion and uncommon error states can still be checked opportunistically when those workflows are exercised.

### Collapsed account-menu visual follow-up — implemented

The orange circular fallback avatar in the collapsed desktop sidebar was identified as visually out of place.

Implementation:

- the expanded sidebar still shows the real user avatar/name;
- the collapsed account trigger now uses the existing Lucide `Menu` icon;
- the trigger still opens the same account dropdown with Settings and Sign out;
- the mobile sidebar already used the same `Menu` icon language.

This is intentionally a small presentation correction, not a redesign of the account menu.

## Discord social link

Discord is an administrator-configurable deployment social link, not a hardcoded CADAM-owned invite.

Current behavior:

- `discordUrl` is optional and defaults to `null`;
- no Discord link is shown on a fresh installation;
- admin configures the URL under Instance identity -> Social links;
- only HTTP/HTTPS URLs are accepted;
- the sidebar uses the Discord brand icon;
- desktop and mobile share the same sidebar rendering;
- the old hardcoded invite URL was not restored;
- the generic Community link remains separate for forum/Matrix/other communities.

## Static Instance identity review — no blocking finding

The current code review confirms the intended architecture before/alongside the live functional pass:

- public `GET /api/settings/instanceIdentity` returns only the explicit public presentation DTO;
- `PUT` requires an authenticated user and `requireAdmin`, which also requires an active admin account;
- fresh-install server/client defaults contain no operator, contact, community, Discord or legal-service ownership claim;
- public URLs are normalized and restricted to HTTP/HTTPS;
- `showCommunityLink` cannot become publicly effective without a configured community URL;
- Discord remains hidden when `discordUrl` is null;
- the admin Instance identity section is only rendered for an admin account;
- sidebar, legal surfaces and admin settings use the same `['instance-identity']` React Query cache key, so a successful save invalidates/refetches the public identity state;
- mobile navigation reuses the expanded desktop sidebar renderer, so Community/Discord behavior is shared rather than implemented twice;
- Community and Discord are independent and can coexist in the navigation;
- legal links are only exposed as external links when `legalPagesEnabled` is true and the corresponding URL exists.

### Non-blocking hardening observation

`InstanceLegalNotice` currently distinguishes loading from loaded state but not load-error from an unconfigured instance. A failed public Instance identity request can therefore visually fall back to the neutral “no document published” presentation.

Do not change this solely from static review. Treat it as a separate hardening item unless a real runtime failure demonstrates that it is misleading enough to fix in this branch.

## Remaining functional Instance identity review

Where not already exercised during the manual runtime pass, verify:

1. Fresh/default GET is neutral when no singleton configuration has been saved.
2. Admin can save and reload:
   - operator;
   - contact email;
   - Community label + URL + visibility;
   - Discord URL;
   - legal-link toggle;
   - Terms URL;
   - Privacy URL.
3. A non-admin authenticated user receives a forbidden response when attempting `PUT`.
4. Clearing Discord removes it from navigation after the identity query refreshes.
5. Community and Discord can be visible at the same time.
6. Turning off Community hides the Community navigation entry without requiring the stored URL to be deleted.
7. Turning off legal links hides external legal links while the neutral Brepia legal-information pages remain available.
8. Terms/Privacy pages show configured operator/contact information accurately and never imply that Brepia/Noty is automatically the deployment operator.

## Runtime-review follow-ups discovered 2026-08-27

Three product-level follow-ups were discovered during the desktop/mobile review. They must be handled before the intentionally deferred `CADAM Original` decision.

### 1. Per-user default model selection — IMPLEMENTED, LOCAL VALIDATION PENDING

The implementation now stores two independent per-user defaults:

- `default_parametric_model_id`;
- `default_creative_model_id`.

Implementation details:

- declarative schema updated in `supabase/schemas/user_ai_preferences.sql`;
- migration added: `supabase/migrations/20260827095000_default_model_preferences.sql`;
- `AiPreferencesDto` exposes:
  - `defaultParametricModelId`;
  - `defaultCreativeModelId`;
- existing `/api/ai-settings/preferences` GET/PUT carries both fields;
- Parametric defaults are validated against the current selectable catalog;
- Creative defaults are validated against the Creative mesh model IDs;
- new `Default models` settings UI is shown under AI Settings -> Models;
- users can independently choose Parametric and Creative defaults;
- `Automatic fallback` resets either preference to `null`;
- a saved Parametric model that becomes hidden/unavailable is not blindly used; the new-conversation resolver selects the normal fallback or the first currently selectable model;
- new conversations use the configured default;
- switching Parametric/Creative on the new-conversation surface switches to that mode's configured default;
- existing conversations remain pinned to their existing model settings and are not rewritten;
- focused resolver tests were added in `tests/defaultModels.test.ts`.

Important: `shared/database.ts` has **not** been hand-edited. Apply the new migration to the NOx-managed local Supabase instance and regenerate types from the real database before running the final gate.

Required local verification:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Functional checks after the migration:

1. Settings -> AI Settings -> Models shows both default selectors.
2. Choose a non-fallback Parametric model, return to New Creation, verify it is preselected.
3. Choose a Creative default, switch to Creative, verify it is preselected.
4. Change the defaults again and verify an existing conversation keeps its pinned model.
5. Hide the saved Parametric default and verify New Creation falls back to another selectable Parametric model rather than blocking.
6. Reset either selector to `Automatic fallback` and verify the corresponding mode uses its normal fallback behavior.

### 2. Remove the standalone `Generate prompt` feature — NEXT IMPLEMENTATION

Runtime observation: `Generate prompt` does not work in the current installation and is not considered necessary for the Brepia workflow.

Recommendation remains to remove it rather than repair it.

Reasoning:

- it adds UI complexity without being required to start a modelling request;
- users can already write/edit the request directly;
- the selected conversation agent/model can interpret or refine normal user intent as part of the actual modelling turn;
- the current `/api/prompt-generator` implementation bypasses the configurable model/provider architecture and hardcodes `claude-haiku-4-5-20251001` through the Anthropic helper;
- that hidden Anthropic dependency is inappropriate for local/self-hosted installations where the user may intentionally have no Anthropic credential configured.

Removal scope:

- remove the Wand/Generate-prompt control from `TextAreaChat`;
- remove its loading/error state and client request code;
- remove the now-unused `/api/prompt-generator` route;
- regenerate the TanStack route tree normally;
- remove only imports/state made dead by this feature;
- do **not** remove prompt profiles, prompt lineage, conversation system prompts or the title generator; those are separate features.

### 3. Creative text-to-mesh capability needs clearer UX and verification

The current implementation is model-dependent, not globally image-only.

Creative model capabilities currently declare:

- `local/trellis-v1` — supports text and image;
- `local/hunyuan3d-2` — image required;
- `local/hunyuan3d-2.1` — image required;
- `local/stable-fast-3d` — image required;
- historical fal.ai `quality`, `fast`, `ultra` modes — accept text and image through their hosted pipeline.

The local server already rejects image-only models clearly and specifically recommends TRELLIS for text-to-3D. The local TRELLIS worker contains separate `TrellisTextTo3DPipeline` and `TrellisImageTo3DPipeline` paths.

Required follow-up:

1. Verify `TRELLIS v1` text-only generation end-to-end in the real local installation:
   - select Creative;
   - select TRELLIS v1;
   - attach no image;
   - submit a simple text prompt;
   - verify a GLB is generated and displayed.
2. If TRELLIS text-only fails, debug the local gateway/backend before changing the product contract, because the repository explicitly implements it as text-capable.
3. Make model capability obvious in the Creative model picker, for example:
   - `Text + image`;
   - `Image required`;
   - optional provider/time information.
4. When an image-required model is selected and the user has supplied text only, fail early in the UI with a specific explanation and offer the user to choose TRELLIS rather than letting the request look like a generic Creative failure.
5. Do not silently switch the user's selected model unless that behavior is explicitly designed later.

A future enhancement could add a text-to-image pre-step in front of image-only local mesh backends, but that is a separate feature and should not be introduced merely to hide model capability differences.

## Recommended next sequence

1. Apply `20260827095000_default_model_preferences.sql` in the NOx-managed local database.
2. Regenerate `shared/database.ts` from the local database.
3. Run the focused/full validation gate and exercise the default-model functional checks above.
4. If green, remove the standalone `Generate prompt` feature and regenerate the route tree.
5. Verify TRELLIS text-only Creative generation end-to-end and improve capability messaging/guardrails.
6. Rerun the full validation gate after those code changes.
7. Perform npm-generated cleanup of dead `lottie-react` and package metadata if still desired, with the lockfile regenerated by npm.
8. Resolve the built-in prompt-profile `CADAM Original` display/lineage strategy **last**.
9. Repository/deployment renames remain a separate later decision.

## Important constraints

- The main desktop/mobile visual gate has been manually reviewed and passed; do not reopen broad redesign without a concrete finding.
- Do not rename compatibility-sensitive `PCAD_*`, `/cadam`, storage/database/local-state identifiers or external integration IDs merely for presentation cleanup.
- Do not hand-edit `shared/database.ts`; regenerate it from the NOx-managed local Supabase instance after applying the new migration.
- Do not confuse removal of the standalone prompt-generator button with removal/change of the prompt-profile architecture.
- Do not touch `CADAM Original` until the Brepia regression, remaining functional follow-ups and resulting validation gate are complete.
