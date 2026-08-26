# Brepia remake — status and audit

Branch: `feature/brepia-remake`
Base: `967f744976d3ae2fb64f3681745c8c046345499a`
Last updated: 2026-08-26

Companion plan: `docs/brepia_remake_plan.md`

## Current state

- [x] Branch created from current `master`.
- [x] Brepia product/brand concept recorded in-repo.
- [x] Rename strategy recorded: user-facing vs internal compatibility vs historical references.
- [x] Initial branding/asset/loading audit completed far enough to define implementation boundaries.
- [ ] Brand SVG/component implemented.
- [ ] Primary UI surfaces rebranded.
- [ ] Activity indicator cleanup implemented.
- [ ] README/current docs rebranded.
- [ ] Visual regression review complete.
- [ ] Final test/typecheck/lint/build gate complete.

## Audit conclusions

### 1. Current product identity is spread across several generations

The UI currently mixes at least three identities:

- `CADAM` — current browser title, primary expanded logo and most auth/legal branding.
- `Adam` / `AdamCAD` — collapsed logo, assistant avatar, legal copy, aria/mobile copy and multiple older assets.
- `pCAD` / `pcad` — local fork/project/internal integration identifiers, environment variables, agent names and technical docs.

The Brepia remake must therefore be a classified rename, not a global replacement.

## User-facing surfaces to rename

### Browser/app metadata

`src/routes/__root.tsx`

Current:

- document title is `CADAM`;
- favicon uses `cadam-icon.svg` and `cadam-icon.ico`.

Action:

- replace with Brepia title;
- add/use Brepia favicon assets;
- do not change the router/base path here as part of the visual rename.

### Sidebar — desktop and mobile

`src/components/Sidebar.tsx`

Current:

- expanded sidebar uses `cadam-logo.svg`;
- collapsed sidebar uses `adam-logo.svg`;
- mobile sheet accessibility title says `AdamCAD`;
- GitHub button points to `https://github.com/Adam-CAD/CADAM`;
- Discord button points to the upstream CADAM community.

Action:

- replace expanded/collapsed marks with shared Brepia brand components/assets;
- change mobile accessibility copy to Brepia;
- point source-code link at the current project repository unless/until the repository is renamed;
- treat the upstream Discord link as a product decision rather than silently presenting it as the Brepia community. Default recommendation: remove it from primary product chrome unless Brepia intentionally participates in that upstream community.

### Authentication and account surfaces

Confirmed direct `cadam-logo.svg` use in:

- `src/views/SignInView.tsx`
- `src/views/SignUpView.tsx`
- `src/views/SignUpEmailView.tsx`
- `src/views/ResetPasswordView.tsx`
- `src/views/UpdatePasswordView.tsx`

Action:

- switch all five to the same Brepia brand component rather than duplicating raw `<img>` paths;
- preserve auth behavior exactly;
- use `Brepia` in alt/accessibility text.

Important compatibility boundary in `SignInView.tsx`:

```text
<username>@pcad.invalid
```

This is an internal synthetic email compatibility mechanism and must **not** be renamed merely for cosmetics. Changing it could break existing username/password accounts.

### Chat assistant identity

Confirmed old Adam artwork in:

- `src/components/chat/AssistantLoading.tsx`
- `src/components/chat/MessageBubble.tsx`

`AssistantLoading` currently combines the Adam logo avatar with `AnimatedEllipsis`.

Action:

- use the compact Brepia symbol for assistant identity;
- keep or evolve the three-dot loading language into the shared Brepia activity component;
- do not make the assistant avatar look like a generic robot/AI badge.

### Generated GIF branding/watermark

`src/components/viewer/MeshGifPreview.tsx`

Current:

- loads `adam-logo-full.svg` for generated preview/GIF branding.

Action:

- replace with a Brepia-compatible watermark/wordmark asset;
- ensure export/generation behavior is unchanged.

### Legal/current-product pages

Confirmed current-product branding in:

- `src/views/TermsOfServiceView.tsx`
- `src/views/PrivacyPolicyView.tsx`

Both pages use the CADAM logo but their prose identifies the service as `AdamCAD` and gives `hello@adamcad.com` as contact information.

Action:

- visual logo can be changed to Brepia;
- service-name copy should eventually describe Brepia;
- **do not invent a new legal contact email or entity name**. Contact/ownership wording needs an explicit decision before these pages are treated as production-ready legal text;
- preserve the effective date until the legal text is intentionally revised.

This is not merely an icon replacement: the old pages currently assert an AdamCAD legal/service identity.

### README/current public presentation

`README.md` is still overwhelmingly the upstream CADAM presentation:

- `cadam-launch.gif` hero;
- CADAM GitHub banners;
- Adam-CAD repository badges and links;
- `adam.new/cadam` live URL;
- CADAM screenshots/alt text;
- Quick Start clones `Adam-CAD/CADAM`;
- current capability copy predates newer pCAD/Brepia functionality, including STEP.

Action:

- rewrite the top/current-product presentation around Brepia;
- update features to reflect the current product rather than merely changing the name;
- keep clear upstream/origin attribution instead of erasing CADAM history;
- current repository URL remains `weaf/pCAD` until a separate repository rename is deliberately performed.

## Asset audit

The `public/` directory still contains a full legacy identity set, including:

- `Adam-Logo.png`
- `adam-icon.ico`
- `adam-logo-full.svg`
- `adam-logo-pink.svg`
- `adam-logo.svg`
- `cadam-icon.ico`
- `cadam-icon.svg`
- `cadam-launch.gif`
- `cadam-logo.svg`
- `Github-Banner-Dark.png`
- `Github-Banner-Light.png`

Known uses found during audit:

- `cadam-logo.svg` — sidebar and auth/legal views;
- `adam-logo.svg` — collapsed sidebar and assistant/chat identity;
- `adam-logo-full.svg` — `MeshGifPreview` watermark;
- `adam-logo-pink.svg` — `NewProductBanner`;
- `Adam-Logo.png` — still referenced by application code including auth/chat-related code;
- `cadam-launch.gif` — README hero;
- `cadam-icon.svg/.ico` — browser favicon.

Action sequence:

1. add Brepia assets/components first;
2. migrate runtime consumers;
3. migrate current README presentation;
4. only then delete legacy visual assets that have no remaining runtime/documentation use.

Do not remove old assets prematurely: some are still referenced outside the obvious sidebar/auth paths.

## Loading/activity audit

The codebase has widespread `Loader2` + `animate-spin` usage. Search identified roughly two dozen affected files/surfaces, including:

- `src/components/Layout.tsx`
- `src/components/auth/AuthGuard.tsx`
- auth views (`SignIn`, `SignUp`, `SignUpEmail`, `ResetPassword`, `UpdatePassword`)
- `src/components/ScadImportButton.tsx`
- `src/components/GithubScadImportButton.tsx`
- `src/components/ImageViewer.tsx`
- `src/views/EditorView.tsx`
- `src/components/viewer/OpenSCADViewer.tsx`
- `src/components/viewer/DownloadMenu.tsx`
- `src/components/viewer/MeshGifPreview.tsx`
- settings/provider components
- parameter desktop/mobile components
- chat/message components.

### Loading-state classification

#### Replace first — global/obvious indeterminate spinners

Examples:

- full-screen auth/layout bootstrap spinner in `Layout.tsx`;
- `AuthGuard` indeterminate wait;
- auth submit button spinners;
- simple import/export/save waits where the only information is “busy”.

Preferred replacement: a shared Brepia `ActivityIndicator` with a subtle pulsing dot and optional status text.

#### Evaluate per context — tiny inline media placeholders

Examples:

- image/mesh loading inside fixed-size preview tiles;
- viewer compilation/loading placeholders.

A tiny Brepia dot or skeleton may be visually better than adding text everywhere. Keep accessibility labels.

#### Preserve determinate progress

Do not replace actual progress bars/percentages with a pulse. `MeshGifPreview` and other generation flows that expose meaningful progress should continue showing progress; only their accompanying indeterminate spinner/branding should be simplified.

### Existing useful component

`src/components/chat/AnimatedEllipsis.tsx` already implements a small three-dot pulsing activity language. It is conceptually close to the Brepia direction, but currently carries `adam-neutral` naming and injects its own keyframes.

Recommended implementation:

- introduce a generic/shared Brepia activity primitive;
- optionally refactor `AnimatedEllipsis` to use it rather than duplicate animation semantics;
- support `prefers-reduced-motion`;
- avoid broad CSS-token renaming in the same step.

## Icon-system audit

The application already has `lucide-react` and uses it extensively for product actions. Radix icons are mainly part of lower-level UI primitives.

Conclusion:

- keep Lucide as the normal application icon language;
- do not replace Radix icons inside generic UI primitives merely for branding;
- focus icon cleanup on visible action semantics and old Adam/CADAM artwork;
- `Plus`, `LayoutGrid`, `Settings`, `LogOut`, `PanelLeft`, `Download`, etc. already fit the desired simple outline direction.

This means the remake does **not** need an icon-library migration.

## Internal names to preserve during the cosmetic branch

The following are deliberately **not** part of the first visual rename unless a separate migration is approved:

### Routing/deployment

`vite.config.ts` and `src/router.tsx` currently use `/cadam` as the deployed base path, and Vite emits client assets under `dist/cadam`.

Changing this would alter deployed URLs such as the current `/cadam/...` application path and is not required to make the UI Brepia.

Recommendation: keep `/cadam` during the cosmetic remake. A later deployment migration can move to `/brepia` or a root/subdomain with redirects once hosting is coordinated.

### Sentry

`vite.config.ts` contains Sentry organization/project identifiers `adamcad`.

These are external integration IDs, not display branding. Do not rename them until the actual Sentry project is migrated.

### CSS/theme tokens

The UI has pervasive internal Tailwind/theme classes such as:

- `bg-adam-*`
- `text-adam-*`
- `border-adam-*`

They are implementation tokens, not user-visible product names. Renaming them would create a large noisy diff with little product value.

Recommendation: leave them intact in this branch. A later design-system cleanup can rename them to semantic tokens if desired.

### pCAD environment/tool identifiers

Examples include:

- `PCAD_STEP_EXPORT_*`
- `pcad-scad2step-sandbox`
- `.opencode/agents/pcad-*`
- `.opencode/skills/pcad-*`
- internal logs/technical docs.

These are compatibility/ops identifiers. Keep them during the visual remake unless there is a concrete external reason to migrate them.

## Historical references to preserve

Do not blindly replace CADAM/pCAD in:

- old status/plan documents;
- upstream attribution/history;
- historical URLs/evidence;
- migration notes;
- comments that describe old deployed URLs for compatibility.

For current docs such as README, present Brepia as the current product but retain a short, explicit origin/upstream acknowledgement where appropriate.

## Recommended implementation order from audit

### Step 1 — shared brand primitives

Create maintainable components/assets first:

- `BrepiaMark` — open node-based geometric cube SVG/component;
- `BrepiaBrand` — mark + BREPIA wordmark, with compact/full variants;
- `ActivityIndicator` — pulsing dot, optional label, reduced-motion-safe.

This prevents repeatedly hard-coding new image paths across every page.

### Step 2 — browser + sidebar + auth

These are the highest-visibility and most repeated CADAM surfaces:

- root title/favicon;
- expanded/collapsed/mobile sidebar;
- auth/password views.

### Step 3 — chat + generated media

- assistant avatars/loading;
- message assistant identity;
- generated GIF watermark;
- any old Adam artwork in chat/input/auth provider defaults.

### Step 4 — activity indicators

Migrate global/simple indeterminate spinners to the shared component in small batches, validating behavior after each batch.

### Step 5 — legal/current docs

- rebrand visual legal headers;
- update product service name only with explicit contact/entity decision;
- rewrite README current presentation;
- preserve upstream attribution.

### Step 6 — unused legacy assets + regression gate

- verify repository-wide references before deleting old visual assets;
- desktop/mobile visual checks;
- auth/editor/viewer checks;
- tests/typecheck/lint/build.

## Open decisions

These should be resolved before the relevant implementation step, but none block starting the brand primitives:

1. Exact final Brepia mark geometry and wordmark spacing.
2. Exact accent values/gradient policy after testing against the current dark UI.
3. Whether primary footer/About wording is `by Noty` or `by Noty Design` (current preference: `by Noty`).
4. Whether the upstream CADAM Discord link remains anywhere in the Brepia UI.
5. Legal contact name/email to replace `AdamCAD / hello@adamcad.com`.
6. Future deployment path: keep `/cadam` for compatibility now; decide later whether to migrate to `/brepia`, `/`, or a Brepia subdomain.
7. Future repository rename from `weaf/pCAD` is separate from this visual branch.

## Audit outcome

The remake can be done safely without touching the major runtime architecture.

The most important boundary is to **rebrand presentation while deliberately preserving compatibility identifiers**. The highest-value first implementation is therefore a shared Brepia brand component and activity component, followed by sidebar/auth/browser surfaces.
