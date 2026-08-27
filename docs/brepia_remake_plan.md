# Brepia remake — concept and implementation plan

Branch: `feature/brepia-remake`  
Base: `967f744976d3ae2fb64f3681745c8c046345499a`

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
- optional Terms URL;
- optional Privacy URL;
- explicit toggles controlling whether community/legal links are exposed.

Fresh-install defaults are deliberately unclaimed:

```text
Operator: unset
Contact: unset
Community: hidden
Legal links: hidden
```

Public clients consume only a whitelisted DTO from the application API. The underlying settings table is server/service-role managed and is not directly exposed to browser roles.

### Repository-name checkpoint

The GitHub repository is still `weaf/pCAD`. A future rename to **`weaf/brepia`** must be decided explicitly rather than bundled into cosmetic changes.

Preferred timing: after Brepia is visually stable and the branch has passed its regression gate.

Before a repository rename, audit clone/remotes, README/source links, CI/deployment integrations, webhooks/services, scripts/docs, local developer/agent environments and reliance on GitHub redirects.

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
- mark remains usable in monochrome;
- exact final colour/spacing waits for visual review in the real application.

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

Keep CADAM/Adam/pCAD where it records actual project history, source URLs, evidence, migration notes or upstream attribution.

## Implementation phases

### Phase 1 — Audit and rename map: complete

- [x] Inventory user-visible CADAM/pCAD/Adam legacy surfaces.
- [x] Inventory metadata, favicon, logo and image assets.
- [x] Inventory loading/spinner components and distinguish indeterminate work from real progress.
- [x] Inventory current icon system.
- [x] Classify old-name occurrences as presentation, compatibility or history.
- [x] Record findings in `docs/brepia_remake_status.md`.

### Phase 2 — Brand primitives: implementation complete, visual verification substantially complete

- [x] `BrepiaMark`.
- [x] `BrepiaBrand`.
- [x] `ActivityIndicator` with reduced-motion support.
- [x] `brepia-mark.svg`.
- [x] `brepia-logo.svg`.
- [x] `brepia-watermark.svg`.
- [x] Brepia web-app manifest.
- [x] Monochrome-capable mark component.
- [x] Verify normal desktop/mobile Brepia presentation in the running application.
- [ ] Verify any remaining light/monochrome/reduced-motion edge states when supported/exercised.
- [ ] Decide whether additional raster/app-store icon sizes are required by deployment targets.

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

### Phase 4 — Activity, generated media and icon cleanup: implementation complete, visual verification substantially complete

- [x] Migrate global/auth/import/viewer/settings/share/parameter busy states to `ActivityIndicator`.
- [x] Migrate TextAreaChat waits.
- [x] Migrate Providers/AiModels/Editor/MessageBubble/DownloadMenu residual simple waits.
- [x] Replace inherited Lottie editor loader with Brepia mark + activity state.
- [x] Preserve determinate GIF progress.
- [x] Brand GIF overlay and baked output watermark.
- [x] Replace Adam GLB point-cloud artwork with Brepia point geometry.
- [x] Remove obsolete `AnimatedEllipsis` and Adam Lottie asset.
- [x] Remove unused hardcoded Discord-specific icon after community became generic.
- [x] Verify normal mobile and desktop variants independently in the running application.
- [ ] Verify GIF watermark and GLB point-cloud transition when those workflows are next exercised.

### Phase 5 — Documentation, instance identity and safe rename cleanup: implementation substantially complete

- [x] Rewrite README around Brepia.
- [x] Preserve explicit Adam-CAD/CADAM upstream attribution.
- [x] Update contributor/benchmark current-product presentation.
- [x] Add `docs/brepia_branding.md`.
- [x] Remove inherited README/promo/favicon/logo assets after consumers migrated.
- [x] Remove obsolete legacy screenshots and banner-only CAD vendor assets.
- [x] Add server-managed `instance_settings` singleton with migration + declarative schema.
- [x] Add public whitelist GET + admin-only PUT API for instance identity.
- [x] Add admin Instance identity UI.
- [x] Make community navigation instance-configurable; default hidden.
- [x] Make legal links instance-configurable; default hidden.
- [x] Replace inherited AdamCAD legal text with neutral OSS instance notices.
- [x] Remove inherited Adam/CADAM contact/community ownership claims.
- [x] Remove final `cadam-logo.svg` consumer/asset.
- [x] Add focused instance-identity normalization tests.
- [x] Regenerate/check Supabase TypeScript schema types in the real project environment.
- [ ] Clean package metadata/dead dependencies through npm-generated lockfile changes.
- [ ] Resolve built-in prompt-profile `CADAM Original` strategy **at the end**.
- [ ] Decide future repository rename `weaf/pCAD` → `weaf/brepia`.

### Phase 6 — Visual and regression gate

- [x] Apply migration `20260827062000_instance_identity_settings.sql` to the real development database.
- [ ] Verify fresh/default Instance identity exposes no operator/contact/community/legal links in a clean/default runtime state.
- [ ] Verify admin can save operator/contact/community/legal configuration end-to-end.
- [ ] Verify non-admin cannot update Instance identity.
- [ ] Verify configured Community + Discord links on desktop/mobile sidebar.
- [ ] Verify legal notice pages and optional external legal links.
- [x] Review normal desktop and mobile presentation in the real running application.
- [ ] Review remaining light/dark/monochrome/reduced-motion edge behavior where supported.
- [ ] Exercise real agent/OpenSCAD/import/export loading states opportunistically after the remake changes.
- [ ] Verify GIF watermark and Brepia GLB point-cloud transition visually.
- [ ] Verify no functionality changed as a side effect of cosmetic work.
- [x] `npm test`.
- [x] `npm run typecheck`.
- [x] `npm run lint`.
- [x] `npm run build`.

### Phase 6 runtime follow-ups — discovered during manual review

These are product findings from the real desktop/mobile review and must be handled before `CADAM Original`.

#### A. Default model preference

- [ ] Add per-user default Parametric model setting.
- [ ] Add per-user default Creative model setting.
- [ ] Store both in `user_ai_preferences`, not localStorage or Instance identity.
- [ ] Make new conversations preselect the saved default for the active mode.
- [ ] Make mode switches use that mode's default.
- [ ] Preserve existing conversation model pinning.
- [ ] Gracefully fall back when a saved default is hidden/unavailable.

Recommended fields:

- `default_parametric_model_id`
- `default_creative_model_id`

#### B. Remove standalone Generate prompt

- [ ] Remove the Generate-prompt/Wand control from `TextAreaChat`.
- [ ] Remove associated client state/request code.
- [ ] Remove `/api/prompt-generator`.
- [ ] Regenerate `src/routeTree.gen.ts` through the normal Vite/TanStack toolchain.
- [ ] Keep prompt profiles, prompt lineage and title generation unchanged.

Reason: the feature is unnecessary for the intended workflow and currently hardcodes an Anthropic/Claude helper outside the normal configurable provider/model architecture.

#### C. Creative text-to-mesh UX and verification

- [ ] Verify `local/trellis-v1` text-only generation end-to-end with no uploaded image.
- [ ] If it fails, debug the local TRELLIS gateway/worker path before changing the declared capability.
- [ ] Show Creative capabilities clearly in the model picker (`Text + image`, `Image required`, etc.).
- [ ] Fail early and clearly in the UI when an image-required model is used without an image.
- [ ] Recommend TRELLIS v1 for local text-to-3D rather than silently changing the selected model.
- [ ] Treat any future text-to-image pre-step for image-only local backends as a separate feature.

Current declared local behavior:

- TRELLIS v1: text + image.
- Hunyuan3D-2: image required.
- Hunyuan3D-2.1: image required.
- Stable Fast 3D: image required.

## Immediate next sequence

1. Finish any remaining functional Instance identity runtime checks not already covered during manual review.
2. Implement per-user default Parametric/Creative model selection.
3. Remove the standalone `Generate prompt` feature and regenerate the TanStack route tree.
4. Verify TRELLIS v1 text-only Creative generation and improve Creative capability messaging/guardrails.
5. Rerun the full project gate after those code changes.
6. Perform npm-generated cleanup (`lottie-react`, package name if desired) only with a verified lockfile regeneration.
7. **Last:** audit the actual built-in prompt and resolve `CADAM Original` display/lineage strategy.
8. After the remake is stable, decide repository/deployment renames separately.

## Product constraints

- Presentation/product identity should not rewrite unrelated architecture.
- STEP/STL/DXF/OpenSCAD behavior must remain unchanged.
- Existing auth behavior must remain unchanged except for the intentionally added admin Instance identity configuration surface.
- Agent/provider behavior must remain unchanged except for explicit follow-ups approved above.
- Avoid migrations solely to rename existing implementation keys.
- New instance identity fields are configuration, not a hardcoded Brepia company identity.
- Desktop and mobile have both been manually reviewed; do not reopen broad visual redesign without a concrete issue.
- Keep the brand quiet enough that modelling remains the primary visual focus.
- Removing the standalone prompt generator must not be confused with removing the prompt-profile architecture.
- `CADAM Original` remains intentionally deferred until all other regression/follow-up work is complete.

## Current preferred direction

> **BREPIA**  
> *by Noty*

with an open node-based geometric cube, restrained blue/violet accent, rotating but stable-per-visit start-page inspiration, quiet pulsing activity states and deployment-owned instance identity.
