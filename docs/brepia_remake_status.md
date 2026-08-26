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
- [x] Brand primitives implemented: `BrepiaMark`, `BrepiaBrand`, `ActivityIndicator`, standalone SVG mark.
- [x] Browser title and SVG favicon switched to Brepia.
- [x] Desktop/mobile sidebar primary branding switched to Brepia.
- [x] Current repository link in the sidebar points to `weaf/pCAD` rather than upstream CADAM.
- [x] Sign-in/sign-up/email-sign-up/reset-password/update-password visual branding switched to shared `BrepiaBrand`.
- [ ] Chat/assistant identity rebranded.
- [ ] Generated media watermark rebranded.
- [ ] Activity indicator cleanup implemented across primary busy states.
- [ ] Legal/current-product pages resolved and rebranded.
- [ ] README/current docs rebranded.
- [ ] Visual regression review complete.
- [ ] Final test/typecheck/lint/build gate complete.

## Current implementation notes

### Brand primitives

Added under `src/components/brand/`:

- `BrepiaMark` — open node-based wireframe/B-Rep mark, with accent and monochrome modes;
- `BrepiaBrand` — mark + BREPIA wordmark with optional `by Noty` secondary lockup;
- `ActivityIndicator` — small pulsing indeterminate dot with optional text and reduced-motion support;
- shared exports through `src/components/brand/index.ts`.

Standalone asset:

- `public/brepia-mark.svg`.

The current accent prototype reuses the existing Brepia-friendly blue (`#00A6FF`) and adds violet at the opposite end of the mark. Exact colour/spacing decisions remain intentionally open until visual review on the real application.

### Browser metadata

`src/routes/__root.tsx`

- title is now `Brepia`;
- primary favicon is `brepia-mark.svg`;
- the old CADAM `.ico` fallback was removed rather than advertising the old mark.

The deployed router/base path remains `/cadam` intentionally. Browser branding and deployment compatibility are separate concerns.

### Sidebar

`src/components/Sidebar.tsx`

- expanded desktop/mobile sidebar uses `BrepiaBrand`;
- collapsed sidebar uses `BrepiaMark`;
- mobile accessibility title now says `Brepia`;
- mobile description now says `AI-assisted parametric 3D design`;
- GitHub source link now points to `https://github.com/weaf/pCAD`.

The upstream CADAM Discord link is deliberately still present until the product/community decision is made. It must not be silently relabelled as a Brepia-owned community.

### Authentication surfaces

Shared `BrepiaBrand showByNoty` is now used on:

- `src/views/SignInView.tsx`
- `src/views/SignUpView.tsx`
- `src/views/SignUpEmailView.tsx`
- `src/views/ResetPasswordView.tsx`
- `src/views/UpdatePasswordView.tsx`

Visible pCAD wording in the edited sign-up surfaces was changed to Brepia where it described the product.

The internal synthetic username email mapping remains exactly:

```text
<username>@pcad.invalid
```

This is a compatibility identifier and was intentionally not renamed.

Auth behavior, routes and provider logic were otherwise left unchanged. Existing `Loader2` spinners in auth were also left for the later activity-indicator cleanup so branding and behavior changes remain separately reviewable.

## Validation status for current implementation batch

A local checkout/typecheck attempt from the assistant execution environment was blocked because that container could not resolve `github.com`; therefore **no new typecheck/lint/test/build result is claimed for this batch**.

Validation still required on the real project environment:

```bash
npm run typecheck
npm run lint
```

The full merge gate remains:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Audit conclusions

### 1. Current product identity is spread across several generations

The inherited/current codebase mixes at least three identities:

- `CADAM` — inherited browser/logo/auth/legal presentation;
- `Adam` / `AdamCAD` — collapsed/assistant artwork, legal copy and older assets;
- `pCAD` / `pcad` — local fork/project/internal integration identifiers.

The Brepia remake therefore remains a classified rename, not a global replacement.

## Remaining user-facing surfaces to rename

### Chat assistant identity

Confirmed old Adam artwork in:

- `src/components/chat/AssistantLoading.tsx`
- `src/components/chat/MessageBubble.tsx`

`AssistantLoading` currently combines the Adam logo avatar with `AnimatedEllipsis`.

Next action:

- use the compact Brepia symbol for assistant identity;
- evolve the loading treatment toward the shared Brepia activity language;
- do not make the assistant avatar look like a generic robot/AI badge.

### Generated GIF branding/watermark

`src/components/viewer/MeshGifPreview.tsx`

Current inherited behavior:

- loads `adam-logo-full.svg` for generated preview/GIF branding.

Action:

- replace with a Brepia-compatible watermark/wordmark asset;
- ensure export/generation behavior is unchanged.

### Legal/current-product pages

Confirmed current-product branding in:

- `src/views/TermsOfServiceView.tsx`
- `src/views/PrivacyPolicyView.tsx`

Both pages still use inherited CADAM/AdamCAD identity and `hello@adamcad.com` contact wording.

Action:

- visual logo can be changed to Brepia;
- service-name copy should eventually describe Brepia;
- **do not invent a new legal contact email or entity name**;
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

The `public/` directory still contains the inherited identity set, including:

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

Brepia currently adds:

- `brepia-mark.svg`.

Action sequence remains:

1. migrate runtime consumers;
2. migrate current README presentation;
3. verify repository-wide references;
4. only then delete legacy visual assets that have no remaining runtime/documentation use.

Do not remove old assets prematurely: some remain used by chat, generated media, legal pages and documentation.

## Loading/activity audit

The codebase has widespread `Loader2` + `animate-spin` usage across layout/auth/import/viewer/settings/parameter/chat surfaces.

### Loading-state classification

#### Replace first — global/obvious indeterminate spinners

Examples:

- full-screen auth/layout bootstrap spinner in `Layout.tsx`;
- `AuthGuard` indeterminate wait;
- auth submit button spinners;
- simple import/export/save waits where the only information is “busy”.

Preferred replacement: shared Brepia `ActivityIndicator` with a subtle pulsing dot and optional status text.

#### Evaluate per context — tiny inline media placeholders

Examples:

- image/mesh loading inside fixed-size preview tiles;
- viewer compilation/loading placeholders.

A tiny Brepia dot or skeleton may be visually better than adding text everywhere. Keep accessibility labels.

#### Preserve determinate progress

Do not replace actual progress bars/percentages with a pulse. `MeshGifPreview` and other generation flows that expose meaningful progress should continue showing progress; only accompanying indeterminate spinner/branding should be simplified.

### Existing useful component

`src/components/chat/AnimatedEllipsis.tsx` already implements a small three-dot pulsing activity language. It is conceptually close to the Brepia direction, but currently carries `adam-neutral` naming and injects its own keyframes.

Recommended implementation:

- refactor or retire it behind the shared Brepia activity primitive where appropriate;
- preserve compact three-dot behavior only if it remains useful in dense chat UI;
- support `prefers-reduced-motion`;
- avoid broad CSS-token renaming in the same step.

## Icon-system audit

The application already has `lucide-react` and uses it extensively for product actions. Radix icons are mainly part of lower-level UI primitives.

Conclusion:

- keep Lucide as the normal application icon language;
- do not replace Radix icons inside generic UI primitives merely for branding;
- focus icon cleanup on visible action semantics and old Adam/CADAM artwork;
- `Plus`, `LayoutGrid`, `Settings`, `LogOut`, `PanelLeft`, `Download`, etc. already fit the desired simple outline direction.

The remake does **not** need an icon-library migration.

## Internal names to preserve during the cosmetic branch

### Routing/deployment

`vite.config.ts` and `src/router.tsx` currently use `/cadam` as the deployed base path, and Vite emits client assets under `dist/cadam`.

Changing this would alter deployed URLs and is not required to make the UI Brepia.

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

## Repository rename checkpoint

The repository itself is currently `weaf/pCAD`.

A future rename to a Brepia-oriented repository name — most naturally `weaf/brepia` — is now an explicit project checkpoint, but it is **not bundled into the cosmetic branch automatically**.

Before renaming the repository, verify and update:

- clone URLs in README/docs/scripts;
- current sidebar/source links;
- deployment/build integrations that reference `weaf/pCAD`;
- badges and external links;
- local git remotes on development machines;
- any GitHub Actions, webhooks or external services tied to the old repository name;
- whether GitHub's automatic old-name redirect is sufficient for existing public links.

The repository name and internal compatibility identifiers are separate decisions: renaming the repo does not imply immediately renaming `PCAD_*`, `pcad.invalid`, agent names or historical docs.

## Historical references to preserve

Do not blindly replace CADAM/pCAD in:

- old status/plan documents;
- upstream attribution/history;
- historical URLs/evidence;
- migration notes;
- comments that describe old deployed URLs for compatibility.

For current docs such as README, present Brepia as the current product but retain a short, explicit origin/upstream acknowledgement where appropriate.

## Recommended next implementation order

### Step 1 — chat + generated media identity

- assistant avatars/loading;
- message assistant identity;
- generated GIF watermark;
- remaining runtime Adam artwork.

### Step 2 — activity indicators

Migrate global/simple indeterminate spinners to the shared component in small batches, validating behavior after each batch.

### Step 3 — legal/current docs

- rebrand visual legal headers;
- update product service name only with explicit contact/entity decision;
- rewrite README current presentation;
- preserve upstream attribution.

### Step 4 — unused legacy assets + regression gate

- verify repository-wide references before deleting old visual assets;
- desktop/mobile visual checks;
- auth/editor/viewer checks;
- tests/typecheck/lint/build.

## Open decisions

These remain intentionally deferred until visual/product review:

1. Exact final Brepia mark geometry and wordmark spacing.
2. Exact accent values/gradient policy after testing against the current dark UI.
3. Whether primary footer/About wording is `by Noty` or `by Noty Design` (current preference: `by Noty`).
4. Whether the upstream CADAM Discord link remains anywhere in the Brepia UI.
5. Legal contact name/email to replace `AdamCAD / hello@adamcad.com`.
6. Future deployment path: keep `/cadam` for compatibility now; decide later whether to migrate to `/brepia`, `/`, or a Brepia subdomain.
7. Future repository rename from `weaf/pCAD`, with `weaf/brepia` as the natural candidate.

## Audit outcome

The remake can continue safely without touching the major runtime architecture.

The key boundary remains: **rebrand presentation while deliberately preserving compatibility identifiers**.
