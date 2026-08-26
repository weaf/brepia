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

`by Noty` is secondary and should normally appear on product/about/marketing surfaces rather than competing with the Brepia wordmark in the application header.

### Brand hierarchy

- **Brepia** — product name.
- **Noty** — creator / umbrella brand.
- **Noty Design** — optional formal studio/identity name for About, documentation, copyright or external presentation.
- `noty.se` may act as the umbrella site.
- A future deployment/marketing path such as `brepia.noty.se` fits the intended hierarchy, but DNS/domain changes are outside this branch unless explicitly requested.

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

Do not make the identity depend on:

- robot heads;
- brains;
- generic AI sparkle clusters;
- gears as the primary product mark;
- visually heavy spinners;
- CADAM legacy artwork.

A small sparkle icon may remain where it describes a specific AI action, but it is not the Brepia brand mark.

### Wordmark

Preferred direction:

- `BREPIA` in a clean geometric sans-serif;
- generous spacing but not so wide that it becomes awkward in the application header;
- symbol and wordmark must also work independently;
- the app icon/favicons should use the symbol without requiring text.

### Colour direction

The initial concept uses a restrained blue-to-violet technical accent on a neutral light/dark UI. The identity must remain legible in monochrome and must not require a gradient to function.

Exact brand colours are intentionally not frozen yet. They should be derived from the existing application theme after the UI audit rather than forcing a separate colour system prematurely.

## Activity / loading language

Replace decorative spinning/loading graphics where practical with a quiet activity signal.

Preferred default:

```text
● Generating model…
● Rendering…
● Exporting STEP…
```

The point uses a subtle opacity pulse. No rotation is required.

An alternate Brepia-specific variant may animate the node points of the Brepia symbol sequentially, but only if it remains lightweight and does not distract from the work surface.

Rules:

1. Loading state must communicate that work is ongoing, not merely decorate the screen.
2. Prefer descriptive status text when the operation is known.
3. Preserve accessible text / `aria-*` semantics.
4. Do not replace progress indicators that communicate actual percentage/progress with an indeterminate pulse.
5. Keep animation subtle and respect reduced-motion preferences.

## Icon language

Use simple, consistent outline icons for actions. Existing Lucide-style icons are preferred where available rather than introducing a second icon library.

Target semantic mapping:

- New model — `Plus`.
- Chat — `MessageSquare` or existing chat icon.
- Parameters — `SlidersHorizontal`.
- Code/OpenSCAD — `Code2`.
- 3D/model view — `Box` / `Cuboid`.
- Import — `Upload`.
- Export/download — `Download`.
- Settings — `Settings`.
- Indeterminate work — pulsing point / compact Brepia activity mark, not a large spinner.

Do not change a working icon solely for novelty. The remake should improve visual consistency rather than create churn.

## Rename strategy

The rename must distinguish three categories instead of blindly replacing every `CADAM`/`pCAD` string.

### A. User-facing identity — rename to Brepia

Examples:

- application title;
- header/sidebar product name;
- sign-in/sign-up/reset-password branding;
- browser metadata/title;
- visible legal/product copy where CADAM is named as the current product;
- favicon/app mark and relevant visual assets;
- README top-level current product identity when appropriate.

### B. Internal identifiers — evaluate before renaming

Examples:

- environment variables;
- database keys;
- local-storage keys;
- API identifiers;
- test IDs;
- package names;
- file/directory names;
- internal agent/tool IDs.

Do not rename these merely for cosmetics if doing so creates migration or compatibility risk. Internal `pcad` identifiers may remain until a dedicated technical rename is justified.

### C. Historical/upstream references — normally preserve

Examples:

- historical docs describing CADAM origin/upstream;
- migration/status documents that record old names as history;
- citations or URLs to upstream projects;
- old commit/evidence text.

Historical accuracy is more important than global string replacement.

## Implementation phases

### Phase 1 — Audit and rename map

- [ ] Inventory every user-visible CADAM/pCAD occurrence.
- [ ] Inventory metadata, favicon, logo and image assets.
- [ ] Inventory loading/spinner components and distinguish cosmetic indeterminate states from meaningful progress.
- [ ] Inventory current icon library/use and obvious inconsistent legacy icons.
- [ ] Classify old-name occurrences as user-facing, internal-compatibility or historical.
- [ ] Record concrete files and recommended action in `docs/brepia_remake_status.md`.

No broad search-and-replace before this phase is complete.

### Phase 2 — Brand primitives

- [ ] Implement the Brepia symbol as a maintainable vector/SVG/component.
- [ ] Add wordmark/brand component suitable for header and auth screens.
- [ ] Add monochrome-safe and light/dark-safe rendering.
- [ ] Add favicon/app-icon assets at required sizes/formats.
- [ ] Add compact activity indicator with reduced-motion support.

### Phase 3 — Primary product surfaces

- [ ] Header/sidebar branding.
- [ ] Root/home/start surface.
- [ ] Sign-in/sign-up/password flows.
- [ ] Browser title/meta/favicon.
- [ ] About/legal-facing current-product references.

### Phase 4 — Activity and icon cleanup

- [ ] Replace unnecessary large spinning indicators with the Brepia activity language.
- [ ] Keep operation-specific text where possible.
- [ ] Normalize obvious icon inconsistencies without redesigning every control.
- [ ] Verify mobile and desktop variants independently.

### Phase 5 — Documentation and safe rename cleanup

- [ ] Update current README/product documentation to Brepia where it represents the present product.
- [ ] Preserve historical CADAM references where they explain origin/history.
- [ ] Decide which `pCAD` internal names intentionally remain for compatibility.
- [ ] Add a short branding/asset maintenance note for future contributors/agents.

### Phase 6 — Visual and regression gate

- [ ] Review screenshots on desktop and mobile, light and dark where supported.
- [ ] Check sign-in/auth pages and editor/workspace separately.
- [ ] Verify loading states while real agent/OpenSCAD/export operations run.
- [ ] Verify no functionality changed as a side effect of cosmetic work.
- [ ] `npm test`.
- [ ] `npm run typecheck`.
- [ ] `npm run lint`.
- [ ] `npm run build`.

## Product constraints

- This branch is primarily a cosmetic/product-identity remake, not an architecture rewrite.
- STEP/STL/DXF/OpenSCAD behavior must remain unchanged.
- Existing auth behavior must remain unchanged.
- Agent/provider behavior must remain unchanged.
- Avoid migrations solely to rename internal implementation keys.
- Desktop and mobile can use different layout components; both must be audited rather than assuming one component covers both.
- Keep the design simple enough that the brand does not overwhelm the modelling workspace.

## Current preferred direction

Unless later visual testing shows a concrete problem, the working direction is:

> **BREPIA**  
> *by Noty*

with an open node-based geometric cube, restrained blue/violet accent, and a small pulsing activity point replacing unnecessary spinner imagery.
