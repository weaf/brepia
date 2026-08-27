# Brepia remake — concept and implementation plan

Branch: `feature/brepia-remake`
Base: `967f744976d3ae2fb64f3681745c8c046345499a`

## Product identity

Working product name: **Brepia**.

Brepia is the new product identity for the application previously presented as CADAM/pCAD. The application has evolved beyond the original CADAM framing into an AI-assisted, parametric 3D design environment with OpenSCAD semantics, editable parameters, local/remote agent workflows, and professional CAD exchange through STEP.

The name is inspired by **B-Rep (Boundary Representation)**, the CAD representation used for solid geometry. The name should feel technical and precise without requiring users to know the B-Rep acronym.

Preferred brand lockup:

```text
BREPIA
by Noty
```

`by Noty` is secondary and should normally appear on product/about/marketing surfaces rather than competing with the Brepia wordmark in dense application chrome.

### Brand hierarchy

- **Brepia** — product name.
- **Noty** — creator / umbrella brand.
- **Noty Design** — optional formal studio/identity name for About, documentation, copyright or external presentation.
- `noty.se` may act as the umbrella site.
- A future deployment/marketing path such as `brepia.noty.se` fits the intended hierarchy, but DNS/domain changes are outside this branch unless explicitly requested.

### Repository-name checkpoint

The GitHub repository is still `weaf/pCAD`. A possible future rename to **`weaf/brepia`** must be decided explicitly rather than bundled into the cosmetic UI rename.

Preferred timing: after the Brepia identity is visually stable and the branch has passed its regression gate.

Before a repository rename, audit and update clone/remotes, README/source links, CI/deployment integrations, webhooks/services, scripts/docs, local developer/agent environments and reliance on GitHub redirects.

A repository rename does **not** automatically imply renaming compatibility-sensitive `PCAD_*`, database/storage/local-state identifiers, `@pcad.invalid`, deployment paths, or agent/tool IDs.

## Visual concept

### Primary symbol

Use a minimal **open geometric B-Rep / wireframe cube** with visible node points.

The symbol should communicate:

- 3D geometry;
- construction and editable structure;
- parametric relationships;
- a model that is intentionally open/changeable rather than a static finished object.

The symbol should not depend on generic AI imagery.

### Avoid

Do not make the identity depend on robot heads, brains, generic AI sparkle clusters, gears as the primary mark, visually heavy spinners, or CADAM legacy artwork.

A small sparkle/wand may remain when it describes a specific AI action; it is not the Brepia identity.

### Wordmark and colour

Preferred direction:

- `BREPIA` in a clean geometric sans-serif;
- generous but practical spacing;
- symbol and wordmark work independently;
- app/favicons use the symbol without requiring text;
- restrained blue-to-violet technical accent on neutral UI;
- mark remains usable in monochrome.

Exact final colours and spacing remain open until visual review in the real application.

## Activity/loading language

Replace decorative spinning/loading graphics where practical with a quiet Brepia activity signal.

Preferred pattern:

```text
● Generating model…
● Rendering…
● Exporting STEP…
```

Rules:

1. Loading state must communicate work, not decorate.
2. Prefer descriptive status text when the operation is known.
3. Preserve accessibility semantics.
4. Never replace meaningful determinate percentages/progress with an indeterminate pulse.
5. Respect reduced-motion preferences.

The GLB generation preview may use the Brepia point-cloud mark because it is a purposeful brand-to-model transition rather than a generic spinner.

## Icon language

Keep the existing Lucide outline language for normal actions. Do not introduce a second application icon library merely for the remake.

Examples:

- New model — `Plus`
- Chat — `MessageSquare`
- Parameters — `SlidersHorizontal`
- Code/OpenSCAD — `Code2`
- 3D/model view — `Box` / `Cuboid`
- Import — `Upload`
- Export — `Download`
- Settings — `Settings`
- Indeterminate work — Brepia activity pulse

Do not change a working icon solely for novelty.

## Rename strategy

### A. User-facing identity — Brepia

Rename current product presentation such as title, sidebar/header, auth, browser metadata, visible current-product copy, favicon/app mark, README and media branding.

### B. Internal identifiers — evaluate before renaming

Environment variables, database/storage/local-state keys, API IDs, package/tool IDs, file paths, Sentry IDs and agent names are migration-sensitive. Do not rename them solely for cosmetics.

### C. Historical/upstream references — preserve where accurate

Keep CADAM/Adam/pCAD where it records actual project history, source URLs, old evidence, migration notes or upstream attribution.

## Implementation phases

### Phase 1 — Audit and rename map: complete

- [x] Inventory user-visible CADAM/pCAD/Adam legacy surfaces.
- [x] Inventory metadata, favicon, logo and image assets.
- [x] Inventory loading/spinner components and separate indeterminate work from real progress.
- [x] Inventory current icon system.
- [x] Classify old-name occurrences as presentation, compatibility or history.
- [x] Record findings in `docs/brepia_remake_status.md`.

### Phase 2 — Brand primitives: implementation complete, visual verification pending

- [x] Implement reusable Brepia symbol component.
- [x] Implement Brepia wordmark/brand lockup component.
- [x] Add standalone `brepia-mark.svg`.
- [x] Add standalone `brepia-logo.svg` lockup.
- [x] Add `brepia-watermark.svg`.
- [x] Add web-app manifest using Brepia identity.
- [x] Add compact activity indicator with reduced-motion support.
- [x] Support monochrome rendering in the component.
- [ ] Verify final light/dark/monochrome appearance in the running application.
- [ ] Decide whether additional raster/app-store/icon sizes are actually required by the deployment target.

### Phase 3 — Primary product surfaces: complete except legal

- [x] Header/sidebar branding.
- [x] Root/home/start surface.
- [x] Rotating Brepia-specific home prompt copy.
- [x] Remove inherited Adam/upstream product banner from Brepia chrome.
- [x] Sign-in/sign-up/password flows.
- [x] Browser title/meta/favicon/manifest.
- [x] Assistant-loading identity.
- [x] Normal assistant avatar directly uses Brepia.
- [x] Prompt-field avatar directly uses Brepia.
- [x] Remove temporary Adam logo compatibility aliases after direct migration.
- [ ] About/legal-facing current-product references.

### Phase 4 — Activity, generated media and icon cleanup: mostly complete

- [x] Migrate primary global/auth/import/viewer/settings/share/parameter busy states to `ActivityIndicator`.
- [x] Migrate TextAreaChat upload and prompt-generation waits.
- [x] Preserve actual determinate GIF progress.
- [x] Brand GIF live overlay and baked output watermark.
- [x] Replace Adam GLB point-cloud artwork with Brepia point geometry while preserving the dissolve-to-model behavior.
- [x] Remove obsolete `AnimatedEllipsis` after its consumer migrated.
- [ ] Finish residual simple spinners in large files (`DownloadMenu`, `ProvidersSettings`, `AiModelsSettings`, `EditorView`, selected `MessageBubble` waits).
- [ ] Normalize only genuinely inconsistent action icons.
- [ ] Verify mobile and desktop variants independently in the running application.

### Phase 5 — Documentation and safe rename cleanup: mostly complete

- [x] Rewrite README around the current Brepia product.
- [x] Preserve explicit Adam-CAD/CADAM upstream attribution.
- [x] Update README clone/source instructions to current `weaf/pCAD` repository.
- [x] Add `docs/brepia_branding.md` maintenance guidance.
- [x] Remove large inherited README/promo assets once unused.
- [x] Remove old Adam/CADAM favicon/watermark/promo assets once their consumers migrated.
- [ ] Finish repository-wide live-reference audit and remove any remaining unused visual assets.
- [ ] Resolve actual legal/contact identity and update Terms/Privacy.
- [ ] Resolve the built-in prompt-profile display/lineage strategy for `CADAM Original` **at the end of the remake**.
- [ ] Decide whether the repository should later be renamed `weaf/pCAD` → `weaf/brepia`.
- [ ] If approved, perform repository rename as a controlled follow-up rather than conflating it with internal compatibility renames.

### Phase 6 — Visual and regression gate

- [ ] Review screenshots on desktop and mobile.
- [ ] Review light/dark/monochrome behavior where supported.
- [ ] Check auth pages, home, editor/workspace, history/share and settings.
- [ ] Exercise real agent/OpenSCAD/import/export loading states.
- [ ] Verify GIF watermark and Brepia GLB point-cloud transition visually.
- [ ] Verify no functionality changed as a side effect of cosmetic work.
- [ ] `npm test`.
- [ ] `npm run typecheck`.
- [ ] `npm run lint`.
- [ ] `npm run build`.

## Immediate next sequence

1. `DownloadMenu.tsx`: change exported MTL `Generated by Adam` metadata to Brepia and migrate its simple download/print spinners without altering export algorithms.
2. Finish remaining low-risk indeterminate loaders in `ProvidersSettings`, `AiModelsSettings`, `EditorView` and selected `MessageBubble` placeholders.
3. Audit remaining live Adam/CADAM artwork/copy on the feature branch.
4. Resolve legal/contact wording and migrate Terms/Privacy; remove `cadam-logo.svg` only when it truly becomes unused.
5. Perform the visual pass and make final spacing/accent adjustments.
6. Run the full regression gate.
7. **Last:** resolve the `CADAM Original` prompt-profile strategy and any required display/lineage migration.
8. After the remake is stable, decide repo/deployment renames separately.

## Product constraints

- This branch is a presentation/product-identity remake, not an architecture rewrite.
- STEP/STL/DXF/OpenSCAD behavior must remain unchanged.
- Existing auth behavior must remain unchanged.
- Agent/provider behavior must remain unchanged.
- Avoid migrations solely to rename internal implementation keys.
- Desktop and mobile can use different components; both must be reviewed.
- Keep the brand quiet enough that modelling remains the primary visual focus.

## Current preferred direction

> **BREPIA**  
> *by Noty*

with an open node-based geometric cube, restrained blue/violet accent, rotating but stable-per-visit start-page inspiration, and quiet pulsing activity states instead of decorative spinners.
