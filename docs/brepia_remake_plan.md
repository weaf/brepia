# Brepia remake — concept and implementation plan

Branch: `feature/brepia-remake`  
Base: `967f744976d3ae2fb64f3681745c8c046345499a`  
Closeout reconciliation: 2026-08-28

## Product identity

Working product name: **Brepia**.

Brepia is the product identity for the application previously presented as CADAM/pCAD. It has evolved into an AI-assisted parametric 3D design environment with OpenSCAD semantics, editable parameters, local/remote agent workflows and professional CAD exchange through STEP.

The name is inspired by **B-Rep (Boundary Representation)**. It should feel technical and precise without requiring users to know the acronym.

Preferred brand lockup:

```text
BREPIA
by Noty
```

`by Noty` is secondary and should normally appear on product/about/auth/documentation surfaces rather than competing with Brepia in dense application chrome.

### Brand hierarchy

- **Brepia** — product name.
- **Noty** — creator / umbrella brand.
- **Noty Design** — optional studio/identity wording for external presentation if deliberately chosen later.
- Repository/deployment names are separate migrations from display identity.

### Open-source instance model

Brepia is currently treated as **open-source software, not as one centrally operated hosted service**.

A clean installation therefore must not claim a legal operator, support address, community or hosted-service legal terms by default.

Instance-specific public identity is controlled by an administrator through **Instance identity** settings:

- operator / organization name;
- public contact email;
- optional community label + URL;
- optional Discord URL;
- optional Terms URL;
- optional Privacy URL;
- explicit toggles controlling whether community/legal links are exposed.

Fresh-install defaults are deliberately unclaimed:

```text
Operator: unset
Contact: unset
Community: hidden
Discord: hidden
Legal links: hidden
```

Public clients consume only a whitelisted DTO from the application API. The underlying settings table is server/service-role managed and is not directly exposed to browser roles.

### Repository-name checkpoint

The GitHub repository is still `weaf/pCAD`. A future rename to **`weaf/brepia`** remains a separate migration decision and is **not part of the remake merge gate**.

A repository rename does **not** automatically imply renaming compatibility-sensitive `PCAD_*`, DB/storage/local-state identifiers, `@pcad.invalid`, deployment paths or agent/tool IDs.

## Visual concept

### Primary symbol

Use a minimal **open geometric B-Rep / wireframe cube** with visible node points.

It should communicate 3D geometry, construction/editability and parametric relationships. It must not depend on generic AI imagery.

### Avoid

Do not make the identity depend on robot heads, brains, generic sparkle clusters, gears as the primary mark, visually heavy spinners or CADAM legacy artwork.

### Wordmark and colour

Preferred direction:

- `BREPIA` in a clean geometric sans-serif;
- app/favicons use the symbol without requiring text;
- restrained blue-to-violet technical accent on neutral UI;
- mark remains usable in monochrome.

The main real desktop/mobile visual review has passed. Do not reopen broad redesign without a concrete defect.

## Activity/loading language

Use a quiet Brepia activity signal instead of decorative rotating artwork when the state is indeterminate.

Rules:

1. Loading communicates work, not decoration.
2. Prefer descriptive status text when known.
3. Preserve accessibility semantics.
4. Never replace meaningful determinate progress with an indeterminate pulse.
5. Respect reduced-motion preferences.

The GLB generation preview may use the Brepia point-cloud mark because it is a purposeful brand-to-model transition rather than a generic spinner.

## Icon language

Keep the existing Lucide outline language for normal actions. Do not add a second general UI icon library solely for the remake.

## Rename strategy

### A. User-facing identity — Brepia

Rename current product presentation: title, sidebar/header, auth, browser metadata, visible current-product copy, favicon/app mark, README and generated-media branding.

### B. Instance identity — deployment-owned

Operator/contact/community/legal information belongs to the deployment administrator and must not be hardcoded as Brepia project identity.

### C. Internal identifiers — evaluate before renaming

Environment variables, database/storage/local-state keys, API IDs, package/tool IDs, file paths, Sentry IDs and agent names are migration-sensitive. Do not rename them solely for cosmetics.

### D. Historical/upstream references — preserve where accurate

Keep CADAM/Adam/pCAD where it records actual project history, source URLs, evidence, migration notes, compatibility semantics or upstream attribution.

## Closeout reconciliation rule

The older Phase 6 checklist accumulated work items while the branch was still evolving. On 2026-08-28 it was reconciled against the actual implementation and the closeout handovers.

Each remaining item below is now classified as one of:

- **complete / verified** — do not redo;
- **open merge gate** — still needs explicit runtime evidence;
- **non-blocking / opportunistic** — implementation exists and specialized visual exercise is not required to merge;
- **deferred** — explicitly outside the remake merge scope.

`docs/post_merge_functionality_plan.md` must not be started on this branch.

## Implementation phases

### Phase 1 — Audit and rename map: complete

- [x] Inventory user-visible CADAM/pCAD/Adam legacy surfaces.
- [x] Inventory metadata, favicon, logo and image assets.
- [x] Inventory loading/spinner components and distinguish indeterminate work from real progress.
- [x] Inventory current icon system.
- [x] Classify old-name occurrences as presentation, compatibility or history.
- [x] Record findings in `docs/brepia_remake_status.md`.

### Phase 2 — Brand primitives: complete

- [x] `BrepiaMark`.
- [x] `BrepiaBrand`.
- [x] `ActivityIndicator` with reduced-motion support.
- [x] `brepia-mark.svg`.
- [x] `brepia-logo.svg`.
- [x] `brepia-watermark.svg`.
- [x] Brepia web-app manifest.
- [x] Monochrome-capable mark component.
- [x] Verify normal desktop/mobile Brepia presentation in the running application.
- [x] Reduced-motion/monochrome behavior is implemented; specialized edge-state visual exercise is non-blocking and opportunistic.
- [x] No additional raster/app-store icon sizes are required by the current deployment target; revisit only when a deployment target requires them.

### Phase 3 — Primary product surfaces: complete

- [x] Header/sidebar branding.
- [x] Root/home/start surface.
- [x] Rotating Brepia-specific home prompt copy.
- [x] Remove inherited Adam product banner.
- [x] Sign-in/sign-up/password flows.
- [x] Browser title/meta/favicon/manifest.
- [x] Assistant loading and normal assistant identity.
- [x] Prompt-field identity.
- [x] Remove temporary Adam logo compatibility aliases.
- [x] Replace inherited AdamCAD Terms/Privacy presentation with neutral open-source instance notices.

### Phase 4 — Activity, generated media and icon cleanup: complete

- [x] Migrate global/auth/import/viewer/settings/share/parameter busy states to `ActivityIndicator`.
- [x] Migrate TextAreaChat waits.
- [x] Migrate Providers/AiModels/Editor/MessageBubble/DownloadMenu residual simple waits.
- [x] Replace inherited Lottie editor loader with Brepia mark + activity state.
- [x] Preserve determinate GIF progress.
- [x] Brand GIF overlay and baked output watermark.
- [x] Replace Adam GLB point-cloud artwork with Brepia point geometry.
- [x] Remove obsolete `AnimatedEllipsis` and Adam Lottie asset.
- [x] Remove unused hardcoded Discord-specific icon after community became generic; Discord was later reintroduced correctly as an administrator-configured social link.
- [x] Verify normal mobile and desktop variants independently in the running application.
- [x] GIF watermark and GLB point-cloud transition implementation is complete; specialized visual exercise remains opportunistic/non-blocking unless a closeout edit regresses those paths.

### Phase 5 — Documentation, Instance identity and safe rename cleanup: substantially complete

- [x] Rewrite README around Brepia.
- [x] Preserve explicit Adam-CAD/CADAM upstream attribution.
- [x] Update contributor/benchmark current-product presentation.
- [x] Add `docs/brepia_branding.md`.
- [x] Remove inherited README/promo/favicon/logo assets after consumers migrated.
- [x] Remove obsolete legacy screenshots and banner-only CAD vendor assets.
- [x] Add server-managed `instance_settings` singleton with migration + declarative schema.
- [x] Add public whitelist GET + admin-only PUT API for Instance identity.
- [x] Add admin Instance identity UI.
- [x] Make community navigation instance-configurable; default hidden.
- [x] Add administrator-configured Discord social link; default hidden and not hardcoded.
- [x] Make legal links instance-configurable; default hidden.
- [x] Replace inherited AdamCAD legal text with neutral OSS instance notices.
- [x] Remove inherited Adam/CADAM contact/community ownership claims.
- [x] Remove final `cadam-logo.svg` consumer/asset.
- [x] Add focused Instance identity normalization tests.
- [x] Regenerate/check Supabase TypeScript schema types in the real project environment.
- [ ] Optional package cleanup: `lottie-react` remains declared but has no active runtime consumer. Remove only with npm-generated lockfile changes; this is not a merge blocker.
- [x] Resolve built-in prompt-profile `CADAM Original` strategy **at the end**: preserve it as the explicit inherited pre-Brepia built-in prompt/lineage. Do not rename `builtin:parametric`, rewrite the inherited system prompt, or change its fingerprint solely for branding.
- [ ] Future repository rename `weaf/pCAD` → `weaf/brepia` is deferred and not a remake merge blocker.

### Phase 6 — Visual and regression gate

Already completed and evidenced:

- [x] Apply migration `20260827062000_instance_identity_settings.sql` to the real development database.
- [x] Apply the administrator-configured Discord social-link migration.
- [x] Regenerate `shared/database.ts` from the NOx-managed local Supabase instance.
- [x] Regenerate `src/routeTree.gen.ts` through the TanStack/Vite toolchain.
- [x] Review normal desktop and mobile presentation in the real running application.
- [x] Stable production-like runtime behavior verified on desktop/mobile browser lifecycle use.
- [x] Parametric completion reconciliation verified after browser backgrounding.
- [x] Original Phase 6 `npm test` PASS.
- [x] Original Phase 6 `npm run typecheck` PASS.
- [x] Original Phase 6 `npm run lint` PASS.
- [x] Original Phase 6 `npm run build` PASS.

Still requiring explicit closeout evidence before merge if not already exercised locally:

- [ ] Verify fresh/default Instance identity exposes no operator/contact/community/Discord/legal ownership claims in a clean/default runtime state.
- [ ] Verify admin can save and reload operator/contact/community/Discord/legal configuration end-to-end.
- [ ] Verify non-admin cannot update Instance identity.
- [ ] Verify Community + Discord coexistence and hide/show behavior in the running desktop/mobile sidebar.
- [ ] Verify Terms/Privacy neutral fallback plus optional external legal links in the running application.
- [ ] Perform a final smoke confirming no regression from closeout changes: Parametric conversation, Creative selection/capability messaging, auth/settings and Instance identity navigation.
- [ ] Rerun the full local closeout gate after the final branch state:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

Non-blocking/opportunistic checks, unless a closeout edit directly regresses them:

- [x] Remaining light/dark/monochrome/reduced-motion specialized visual exercise is not a broad redesign gate.
- [x] Real agent/OpenSCAD/import/export loading states have been migrated; further workflow-by-workflow visual exercise is opportunistic.
- [x] GIF watermark and Brepia GLB point-cloud specialized visual exercise is opportunistic.

### Phase 6 runtime follow-ups — reconciled

These findings were added while Phase 6 was active. They are now reconciled against the actual branch so they are not reimplemented.

#### A. Per-user default model selection — complete and runtime verified

- [x] Add per-user default Parametric model setting.
- [x] Add per-user default Creative model setting.
- [x] Store both in `user_ai_preferences`, not localStorage or Instance identity.
- [x] Make new conversations preselect the saved default for the active mode.
- [x] Make mode switches use that mode's default.
- [x] Preserve existing conversation model pinning.
- [x] Gracefully fall back when a saved default is hidden/unavailable.

Fields:

- `default_parametric_model_id`
- `default_creative_model_id`

#### B. Remove standalone Generate prompt — complete

- [x] Remove the Generate-prompt/Wand control from `TextAreaChat`.
- [x] Remove associated client state/request code.
- [x] Remove `/api/prompt-generator`.
- [x] Regenerate `src/routeTree.gen.ts` through the normal Vite/TanStack toolchain.
- [x] Keep prompt profiles, prompt lineage and title generation unchanged.

#### C. Creative text-to-mesh UX and verification — complete for remake scope

- [x] Verify `local/trellis-v1` text-only generation end-to-end with no uploaded image.
- [x] Show Creative capabilities clearly in the model picker (`Text + image`, `Image required`).
- [x] Fail early and clearly when an image-required model is used without an image.
- [x] Recommend TRELLIS v1 for local text-to-3D rather than silently changing the selected model.
- [x] Keep any future text-to-image pre-step as a separate post-merge feature.

Retained active local Creative targets:

- TRELLIS v1 — text + image.
- Hunyuan3D-2 — image required.
- Hunyuan3D-2.1 — image required.

Stable Fast 3D has been retired from the active local Creative stack and must not be restored as part of closeout.

#### D. Persistent Creative generation activity — implemented

- [x] Persist generation activity from durable pending mesh state.
- [x] Restore activity indication after navigation/focus/reconnect.
- [x] Do not fake percentage progress when the backend has no durable determinate progress.

The later paused mobile `Creating...` recovery issue is explicitly out of scope for this merge unless a closeout change introduces a fresh regression.

## Closeout sequence

1. Complete only the remaining explicit Instance identity runtime smoke checks above if they are not already evidenced locally.
2. Do **not** add new Brepia/Creative/runtime experiments.
3. `CADAM Original` decision is complete: preserve inherited profile name/lineage and runtime prompt semantics.
4. Skip optional `lottie-react` cleanup unless it is deliberately done with the real npm toolchain and generated lockfile.
5. Run the full local gate on the final branch state.
6. Record final branch HEAD and validation evidence in the closeout/status documents.
7. Merge `feature/brepia-remake` into `master` using the repository's normal integration procedure only when the gate is green.
8. After merge, create a new functionality branch from updated `master` before starting `docs/post_merge_functionality_plan.md`.

## Product constraints

- Presentation/product identity should not rewrite unrelated architecture.
- STEP/STL/DXF/OpenSCAD behavior must remain unchanged.
- Existing auth behavior must remain unchanged except for the intentionally added admin Instance identity configuration surface.
- Avoid migrations solely to rename existing implementation keys.
- New Instance identity fields are configuration, not a hardcoded Brepia company identity.
- Desktop and mobile have both been manually reviewed; do not reopen broad visual redesign without a concrete issue.
- Keep the brand quiet enough that modelling remains the primary visual focus.
- Removing the standalone prompt generator must not be confused with removing the prompt-profile architecture.
- `CADAM Original` is now an intentional historical/compatibility presentation, not an unfinished Brepia rename task.
- Stable runtime architecture in `start.sh` / `scripts/stable-runtime-proxy.mjs` must be preserved.
- LLaMA-Mesh, `trellis.cpp` and other Local Creative improvements belong only to the post-merge functionality branch.

## Current preferred direction

> **BREPIA**  
> *by Noty*

with an open node-based geometric cube, restrained blue/violet accent, rotating but stable-per-visit start-page inspiration, quiet pulsing activity states and deployment-owned Instance identity.
