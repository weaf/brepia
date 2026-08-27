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

### Phase 2 — Brand primitives: implementation complete, visual verification pending

- [x] `BrepiaMark`.
- [x] `BrepiaBrand`.
- [x] `ActivityIndicator` with reduced-motion support.
- [x] `brepia-mark.svg`.
- [x] `brepia-logo.svg`.
- [x] `brepia-watermark.svg`.
- [x] Brepia web-app manifest.
- [x] Monochrome-capable mark component.
- [ ] Verify final light/dark/monochrome appearance in the running application.
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

### Phase 4 — Activity, generated media and icon cleanup: implementation complete, visual verification pending

- [x] Migrate global/auth/import/viewer/settings/share/parameter busy states to `ActivityIndicator`.
- [x] Migrate TextAreaChat waits.
- [x] Migrate Providers/AiModels/Editor/MessageBubble/DownloadMenu residual simple waits.
- [x] Replace inherited Lottie editor loader with Brepia mark + activity state.
- [x] Preserve determinate GIF progress.
- [x] Brand GIF overlay and baked output watermark.
- [x] Replace Adam GLB point-cloud artwork with Brepia point geometry.
- [x] Remove obsolete `AnimatedEllipsis` and Adam Lottie asset.
- [x] Remove unused hardcoded Discord-specific icon after community became generic.
- [ ] Verify mobile and desktop variants independently in the running application.

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
- [ ] Regenerate/check Supabase TypeScript schema types in a real project environment; current server implementation intentionally isolates the new table behind a local typed adapter.
- [ ] Clean package metadata/dead dependencies through npm-generated lockfile changes.
- [ ] Resolve built-in prompt-profile `CADAM Original` strategy **at the end**.
- [ ] Decide future repository rename `weaf/pCAD` → `weaf/brepia`.

### Phase 6 — Visual and regression gate

- [ ] Apply migration `20260827062000_instance_identity_settings.sql` to the real development database.
- [ ] Verify fresh/default Instance identity exposes no operator/contact/community/legal links.
- [ ] Verify admin can save operator/contact/community/legal configuration.
- [ ] Verify non-admin cannot update Instance identity.
- [ ] Verify configured community link on desktop/mobile sidebar.
- [ ] Verify legal notice pages and optional external legal links.
- [ ] Review screenshots on desktop and mobile.
- [ ] Review light/dark/monochrome behavior where supported.
- [ ] Exercise real agent/OpenSCAD/import/export loading states.
- [ ] Verify GIF watermark and Brepia GLB point-cloud transition visually.
- [ ] Verify no functionality changed as a side effect of cosmetic work.
- [ ] `npm test`.
- [ ] `npm run typecheck`.
- [ ] `npm run lint`.
- [ ] `npm run build`.

## Immediate next sequence

1. Apply the new Instance identity migration in the real pCAD development environment.
2. Run the focused/full validation gate and fix any compile/type/lint issues discovered by the real toolchain.
3. Perform desktop/mobile visual review and make only small geometry/spacing/accent adjustments.
4. Perform npm-generated cleanup (`lottie-react`, package name if desired) only with a verified lockfile regeneration.
5. **Last:** audit the actual built-in prompt and resolve `CADAM Original` display/lineage strategy.
6. After the remake is stable, decide repository/deployment renames separately.

## Product constraints

- Presentation/product identity should not rewrite unrelated architecture.
- STEP/STL/DXF/OpenSCAD behavior must remain unchanged.
- Existing auth behavior must remain unchanged except for the intentionally added admin Instance identity configuration surface.
- Agent/provider behavior must remain unchanged.
- Avoid migrations solely to rename existing implementation keys.
- New instance identity fields are configuration, not a hardcoded Brepia company identity.
- Desktop and mobile must both be reviewed.
- Keep the brand quiet enough that modelling remains the primary visual focus.

## Current preferred direction

> **BREPIA**  
> *by Noty*

with an open node-based geometric cube, restrained blue/violet accent, rotating but stable-per-visit start-page inspiration, quiet pulsing activity states and deployment-owned instance identity.
