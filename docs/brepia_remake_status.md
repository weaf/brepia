# Brepia remake — status and audit

Branch: `feature/brepia-remake`  
Base / merge base: `967f744976d3ae2fb64f3681745c8c046345499a`  
Last updated: 2026-08-28

Companion plan: `docs/brepia_remake_plan.md`  
Brand maintenance note: `docs/brepia_branding.md`  
Runtime handover: `docs/brepia_phase6_runtime_handover.md`  
Closeout handover: `docs/brepia_cosmetic_closeout_handover.md`

## Current closeout checkpoint

The old status/checkpoint documents accumulated stale unchecked items while Phase 6 was still moving. They were reconciled against the actual branch on 2026-08-28 before any new closeout work was started.

At reconciliation commit `fcfbe55f48dfd7b778503990789cea44a95abb4f`, GitHub comparison showed:

- `feature/brepia-remake` is a linear descendant of the recorded master base;
- **270 commits ahead of `master`, 0 behind**;
- merge base remains `967f744976d3ae2fb64f3681745c8c046345499a`.

Do not treat this count as permanent; use a fresh comparison before merge.

The Brepia implementation scope is frozen. No new functional experiments belong on this branch. The remaining merge gate is intentionally narrow: finish/evidence the remaining Instance identity runtime smoke checks, run the final local regression gate on the final branch state, record evidence, and then merge.

## Reconciliation result

The following old checklist items are **already implemented and must not be redone**:

- Brepia branding, app/auth/sidebar/home presentation and generated-media branding;
- desktop/mobile main visual review;
- Instance identity schema/API/admin UI/legal/community architecture;
- administrator-configured Discord social link;
- Supabase migrations and generated database types;
- TanStack route-tree regeneration;
- per-user default Parametric and Creative models;
- standalone Generate-prompt removal;
- TRELLIS v1 text-only Creative generation runtime verification;
- Creative capability labels and image-required guardrails;
- Stable Fast 3D retirement from the active local Creative stack;
- persistent Creative generation activity;
- stable production-like local runtime in `start.sh` / `scripts/stable-runtime-proxy.mjs`;
- Parametric persisted-completion reconciliation after browser backgrounding;
- original Phase 6 `npm test`, typecheck, lint and build gate at its recorded checkpoint.

The following are **not remake blockers**:

- repository/deployment rename;
- additional app-store/raster icon targets not required by the current deployment;
- specialized GIF/GLB/reduced-motion visual exercise when those paths are not otherwise being changed;
- optional removal of dead `lottie-react` package metadata unless it is done through the real npm toolchain;
- any Local Creative expansion described in `docs/post_merge_functionality_plan.md`.

## Local environment convention

The local Supabase stack is managed by **NOx**.

- Do not use `supabase start`, `supabase stop`, `npx supabase start` or `npx supabase stop` as the normal lifecycle.
- After NOx has started the stack, repository-local operations may use:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

- Never use `db push` / `db pull` for the normal workflow.
- Never hand-edit `shared/database.ts`.
- `src/routeTree.gen.ts` is generated and must not be hand-edited.

## Product / visual state

Brepia is the current product presentation, with the preferred hierarchy:

```text
BREPIA
by Noty
```

The main desktop/mobile review passed in the real running application. Broad redesign is closed unless a concrete closeout regression is found.

Implemented shared brand primitives:

- `src/components/brand/BrepiaMark.tsx`;
- `src/components/brand/BrepiaBrand.tsx`;
- `src/components/brand/ActivityIndicator.tsx`.

Current public assets:

- `public/brepia-mark.svg`;
- `public/brepia-logo.svg`;
- `public/brepia-watermark.svg`;
- `public/site.webmanifest`.

Historical/compatibility identifiers such as `/cadam`, `PCAD_*`, `adam-*` CSS tokens, external integration IDs and accurate upstream documentation remain intentionally separate from user-facing branding.

## Instance identity — implementation state

Brepia is treated as open-source software rather than one centrally operated hosted service. A fresh installation therefore must not claim an operator, support contact, community owner or hosted-service legal identity by default.

Current neutral defaults include no operator/contact/community/Discord/legal ownership claim.

### Database and generated types

Implemented:

- `supabase/migrations/20260827062000_instance_identity_settings.sql`;
- `supabase/migrations/20260827070000_add_instance_discord_link.sql`;
- `supabase/schemas/instance_settings.sql`;
- matching `updated_at` trigger;
- migrations applied in the real NOx-managed development environment at the recorded Phase 6 checkpoint;
- `shared/database.ts` regenerated from that running local Supabase instance.

### API and security

Implemented:

- `src/server/instanceIdentity.ts` normalization/defaults/storage layer;
- public `GET /api/settings/instanceIdentity` returns only the public presentation DTO;
- `PUT` requires an authenticated active administrator via `requireAdmin`;
- browser roles do not directly own/read the underlying service-role-managed settings table;
- public URLs are normalized/restricted to HTTP/HTTPS;
- Community visibility requires a valid configured Community URL;
- Discord is optional and hidden when unset.

Static review found no blocking architecture issue.

### Admin/public UI

Implemented:

- operator / organization;
- public contact email;
- generic Community label + URL + visibility;
- Discord URL;
- legal-link visibility;
- Terms URL;
- Privacy URL;
- neutral Terms/Privacy fallback pages;
- optional external legal links;
- shared desktop/mobile sidebar behavior.

### Still-open runtime evidence

Where not already manually exercised and explicitly recorded, closeout still needs evidence for:

1. fresh/default public identity is neutral;
2. admin save + reload of operator/contact/Community/Discord/legal configuration;
3. authenticated non-admin `PUT` is forbidden;
4. clearing Discord removes it after identity refresh;
5. Community and Discord can coexist;
6. disabling Community hides its navigation entry without deleting its stored URL;
7. disabling legal links hides external links while neutral local Terms/Privacy pages remain available;
8. Terms/Privacy show configured operator/contact accurately without implying Brepia/Noty is automatically the deployment operator.

These are runtime validation tasks, not requests for new Instance identity architecture.

## Runtime follow-ups — final reconciled state

### Default model preferences — complete and runtime verified

Independent per-user fields exist in `user_ai_preferences`:

- `default_parametric_model_id`;
- `default_creative_model_id`.

New conversations/mode switches use the applicable default, existing conversations remain pinned, and unavailable saved Parametric defaults fall back safely. Runtime use was verified in the real installation.

### Standalone Generate prompt — removed

The unnecessary standalone Wand/Generate-prompt feature is already gone:

- UI/client request/state removed from `TextAreaChat`;
- `/api/prompt-generator` removed;
- generated TanStack route tree updated;
- prompt profiles, prompt lineage, conversation prompts and title generation remain intact.

Do not recreate or repair this retired feature.

### Local Creative capabilities — complete for remake scope

Active retained local targets:

- TRELLIS v1 — text + image;
- Hunyuan3D-2 — image required;
- Hunyuan3D-2.1 — image required.

Stable Fast 3D has been retired and must not be restored during closeout.

TRELLIS v1 text-only generation was runtime verified with successful real GLB generation. Model capability messaging and image-required early guardrails are implemented.

Any later Local Creative architecture or backend expansion is post-merge work and must not start on this branch.

### Stable runtime — complete

Normal `./start.sh` now builds/runs a production-like preview behind `scripts/stable-runtime-proxy.mjs` instead of relying on Vite development/HMR. The user verified that long mobile app switching/background periods no longer trigger the disruptive Brepia reload behavior.

Explicit HMR mode remains separate for development.

### Parametric completion reconciliation — complete

Persistent-message reconciliation now accepts a later terminal assistant for the same user turn when the live assistant is in the persisted branch and no newer user message intervenes. Regression coverage protects against incorrectly cancelling a genuinely newer user turn.

The user reported the recovery behavior working after the fix.

## `CADAM Original` — final decision complete

This item was intentionally deferred until the end and has now been inspected against the actual implementation.

Decision: **preserve `CADAM Original` as the explicit inherited/pre-Brepia built-in prompt profile and lineage marker.**

Rationale:

- the synthetic built-in profile remains `builtin:parametric`;
- it resolves directly to the inherited `PARAMETRIC_AGENT_PROMPT`;
- overlay/fork fingerprints and stale-fork warnings encode real prompt lineage;
- the actual prompt still contains the inherited Adam agent identity and is not merely a cosmetic label;
- historical/upstream references are explicitly allowed by the Brepia branding boundary.

Therefore closeout must **not** rename the internal built-in ID, rewrite the inherited system prompt, or intentionally change its fingerprint just to remove the CADAM name. Doing so would turn a cosmetic closeout into a behavioral prompt revision and would invalidate existing lineage semantics.

`CADAM Original` is now an intentional compatibility/history label, not an unfinished branding defect.

## Package metadata

`package.json` still declares `lottie-react` although the old Lottie runtime consumer and asset are gone. The inherited package name also remains.

This cleanup is optional and non-blocking. If performed, use npm in the real project checkout so `package-lock.json` is regenerated by npm; do not hand-edit the lockfile through a remote cosmetic pass.

Given the frozen closeout scope, it is reasonable to leave this cleanup for a later maintenance change rather than introduce package churn immediately before merge.

## Validation history vs final gate

A real local Phase 6 technical gate previously passed:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

That historical PASS remains valid evidence for that checkpoint, but it is **not** a substitute for the required final gate on the final branch state after all subsequent runtime/cosmetic changes.

The final closeout gate must still be run locally before merge:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Also run focused tests relevant to any final edit if needed.

No final PASS is claimed here until those commands are actually executed in the user's local checkout. The remote assistant environment cannot currently reach the user's workstation and its container cannot resolve GitHub DNS, so it cannot honestly substitute its own run.

## Final manual smoke before merge

At minimum confirm:

- normal desktop/mobile Brepia presentation remains intact;
- a Parametric conversation can be created/continued;
- Creative selection/capability messaging remains correct;
- authentication and Settings remain accessible;
- Instance identity navigation/legal presentation is correct;
- no obvious regression was introduced by closeout documentation or any final cleanup.

Do not reopen deferred runtime bugs unless a closeout change directly causes a regression.

## Merge readiness

The branch is **prepared for its final local gate but is not yet declared merge-green**.

Remaining blockers are evidence, not additional product development:

1. finish/record the remaining Instance identity live smoke checks if not already exercised;
2. run the final local `npm test` / typecheck / lint / build gate on the current final branch state;
3. record the exact tested branch HEAD and results;
4. verify a fresh compare still shows the branch based cleanly on current `master`;
5. merge using the repository's normal integration procedure.

After merge, create a **new branch from updated `master`** before any post-merge functionality program begins.

## Governing rule

> **Reconcile, validate and merge the existing Brepia remake. Preserve compatibility and stable-runtime behavior. Do not expand the branch with new functionality.**
