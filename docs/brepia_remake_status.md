# Brepia remake — status and audit

Branch: `feature/brepia-remake`
Base: `967f744976d3ae2fb64f3681745c8c046345499a`
Last updated: 2026-08-26

Companion plan: `docs/brepia_remake_plan.md`

## Current state

- [x] Branch created from the recorded `master` base.
- [x] Brepia product/brand concept recorded in-repo.
- [x] Rename strategy recorded: user-facing vs internal compatibility vs historical references.
- [x] Initial branding/asset/loading audit completed.
- [x] Brand primitives implemented: `BrepiaMark`, `BrepiaBrand`, `ActivityIndicator`.
- [x] Browser title and SVG favicon switched to Brepia.
- [x] Desktop/mobile sidebar primary branding switched to Brepia.
- [x] Auth/password surfaces switched to `BrepiaBrand`.
- [x] Home prompt copy switched to Brepia.
- [x] Upstream Adam product banner removed from the Brepia home surface.
- [x] Assistant loading identity switched to Brepia.
- [x] Normal assistant/prompt-avatar artwork is visually Brepia through temporary legacy-asset aliases.
- [x] Generated GIF/live-preview watermark switched to Brepia.
- [x] Primary global/auth/import/viewer/settings/share/export busy states migrated to the Brepia activity language.
- [ ] Remaining large-file spinner/direct-asset cleanup complete.
- [ ] Prompt-profile `CADAM Original` migration decision resolved.
- [ ] Legal/current-product pages resolved and rebranded.
- [ ] README/current docs rebranded.
- [ ] Legacy visual assets/direct aliases fully removed.
- [ ] Visual regression review complete.
- [ ] Final test/typecheck/lint/build gate complete.

## Implemented brand primitives

Under `src/components/brand/`:

- `BrepiaMark` — open node-based wireframe/B-Rep mark with accent and monochrome modes;
- `BrepiaBrand` — mark + BREPIA wordmark with optional `by Noty` secondary lockup;
- `ActivityIndicator` — small pulsing indeterminate dot with optional text and reduced-motion support;
- shared exports in `src/components/brand/index.ts`.

Public Brepia assets:

- `public/brepia-mark.svg`;
- `public/brepia-watermark.svg`.

Current prototype accent uses the existing product blue (`#00A6FF`) into violet (`#7C3AED`). Exact colour/spacing decisions remain open until visual review in the running application.

## Primary product surfaces

### Browser metadata

`src/routes/__root.tsx`

- title is `Brepia`;
- favicon uses `brepia-mark.svg`;
- inherited CADAM favicon fallback was removed.

The deployed router/base path remains `/cadam` intentionally. Browser branding and deployment compatibility are separate concerns.

### Sidebar

`src/components/Sidebar.tsx`

- expanded sidebar uses `BrepiaBrand`;
- collapsed sidebar uses `BrepiaMark`;
- mobile accessibility title says `Brepia`;
- mobile description says `AI-assisted parametric 3D design`;
- source link points to `https://github.com/weaf/pCAD`.

The inherited CADAM Discord link still exists pending an explicit community-link decision. It must not be represented as a Brepia-owned community unless that is actually intended.

### Home/start surface

`src/views/PromptView.tsx`

- prompt placeholder now says `Start building with Brepia...`;
- the inherited `NewProductBanner` render/import was removed.

`src/components/NewProductBanner.tsx` was deleted.

Reason: that component actively promoted the separate/upstream Adam product at `adam.new` together with SolidWorks, Onshape and Fusion. Relabelling it as Brepia would have been misleading.

### Authentication

Shared `BrepiaBrand showByNoty` is used on:

- `src/views/SignInView.tsx`
- `src/views/SignUpView.tsx`
- `src/views/SignUpEmailView.tsx`
- `src/views/ResetPasswordView.tsx`
- `src/views/UpdatePasswordView.tsx`

Visible pCAD wording in these product-facing flows was changed to Brepia where it described the product.

The internal synthetic username mapping remains exactly:

```text
<username>@pcad.invalid
```

This is a compatibility identifier and was intentionally not renamed.

Auth routes, provider behavior and authentication semantics were not changed.

## Assistant and prompt identity

### Assistant loading

`src/components/chat/AssistantLoading.tsx` now uses the Brepia mark and shared activity indicator.

### Large chat components — temporary compatibility aliases

Two large/high-risk components still reference inherited asset filenames:

- `MessageBubble.tsx` → `adam-logo.svg`;
- `TextAreaChat.tsx` → `Adam-Logo.png`.

To avoid broad whole-file rewrites only for an image source, those public assets currently act as temporary visual compatibility aliases:

- `public/adam-logo.svg` now contains the Brepia mark;
- `public/Adam-Logo.png` now contains a Brepia mark PNG.

Result: both runtime surfaces are visually Brepia without changing their chat/upload logic.

Final cleanup must:

1. replace the code references with `brepia-*` asset/component names;
2. fix any inherited Adam alt/accessibility wording at the same time;
3. delete the temporary legacy aliases once no consumers remain.

## Generated media and notifications

### GIF/live preview

`src/components/viewer/MeshGifPreview.tsx`

- live overlay uses `brepia-watermark.svg`;
- the same watermark is baked into generated GIF frames;
- inherited bottom-right sizing/placement remains unchanged;
- GIF rendering, quantization, frame generation and `setProgress` behavior remain unchanged;
- indeterminate model-preview loading uses `ActivityIndicator`.

The GIF branding commit was inspected as a narrow diff limited to asset references, loader and comments.

### Desktop notifications

`src/contexts/AuthProvider.tsx`

- completion notifications now use `brepia-mark.svg` instead of inherited Adam artwork;
- notification/session behavior is unchanged.

## Activity/loading migration

`ActivityIndicator` now replaces rotating `Loader2` indicators on primary simple/indeterminate waits including:

- global application bootstrap (`Layout.tsx`);
- authentication/access bootstrap (`AuthGuard.tsx`);
- sign-in/password/magic-link/OTP waits;
- sign-up/registration-policy/account-creation waits;
- reset/update-password waits;
- local SCAD import;
- GitHub SCAD import;
- assistant loading;
- image loading (`ImageViewer.tsx`);
- mesh/GIF preview loading;
- GIF generation status in `ShareContent.tsx`;
- avatar upload/save;
- OpenSCAD compilation overlay;
- settings name/password actions;
- admin settings fetch/create/save actions;
- local-model discovery/refresh;
- Vision settings loading;
- public shared-conversation loading;
- desktop parameter DXF/STEP export;
- mobile parameter DXF/STEP export.

### Determinate progress preserved

Actual progress must remain determinate. In particular:

- GIF `setProgress` and the determinate share-button progress background were preserved;
- no real percentage/progress state was replaced with the pulse.

### Still deferred

Large files such as `PromptProfilesSettings.tsx`, `ProvidersSettings.tsx`, `AiModelsSettings.tsx`, `TextAreaChat.tsx`, `MessageBubble.tsx`, `DownloadMenu.tsx` and `EditorView.tsx` still need a final targeted review for remaining indeterminate spinner/direct-brand references.

Do not rewrite those large components broadly for cosmetics. Prefer narrow direct-reference cleanup once the rest of the branch is stable.

## Viewer/export product copy

`src/components/viewer/OpenSCADViewer.tsx`

- compile wait uses `ActivityIndicator`;
- visible error copy now says `Brepia encountered an error while compiling`;
- OpenSCAD compile/render behavior is unchanged.

`src/components/parameter/ParameterSection.tsx` and `ParameterSheetContent.tsx`

- desktop and mobile export busy states use `ActivityIndicator`;
- fallback DXF/STEP error wording now names Brepia rather than Adam;
- STL/SCAD/DXF/STEP dispatch, STEP service calls and workspace persistence remain unchanged.

## Settings product copy

`src/views/SettingsView.tsx`

- notification description now says Brepia rather than Adam;
- simple settings busy states use `ActivityIndicator`;
- local-account detection still deliberately uses `@pcad.invalid`.

`src/components/settings/LocalModelsSettings.tsx`

- visible product wording now says model IDs are never hardcoded in Brepia;
- discovery/loading uses the shared activity indicator;
- runtime/model data behavior is unchanged.

## Prompt-profile migration boundary

`src/components/settings/PromptProfilesSettings.tsx` still exposes `CADAM Original` in several places.

This is **not treated as a blind cosmetic string replacement** because the built-in profile participates in real profile semantics:

- overlays are described relative to the built-in prompt;
- forks record a base revision/fingerprint;
- stale-fork warnings refer to changes in the built-in prompt lineage;
- the API uses the built-in profile path/id independently of the display label.

Before renaming `CADAM Original` to something such as `Brepia Original`, audit the built-in prompt contents and decide whether Brepia should:

1. retain the inherited prompt as an explicitly historical/upstream base;
2. rename only its user-facing display identity; or
3. introduce a genuine Brepia built-in prompt revision and migrate the displayed lineage accordingly.

Internal IDs do not need to change merely because the display label changes.

## Legal/current-product pages

Still pending:

- `src/views/TermsOfServiceView.tsx`
- `src/views/PrivacyPolicyView.tsx`

They contain inherited CADAM/AdamCAD presentation and `hello@adamcad.com` contact wording.

Rules for this step:

- visual logo may be changed to Brepia;
- current service-name copy should eventually describe Brepia;
- **do not invent a new legal entity or contact email**;
- preserve effective dates until the legal text is deliberately revised.

This needs an explicit user/product decision before being considered production-ready legal copy.

## README/current public presentation

`README.md` still largely presents upstream CADAM, including inherited banners, URLs, badges and setup copy.

Required later work:

- present Brepia as the current product;
- describe current functionality, including AI-assisted parametric OpenSCAD editing and professional STEP export;
- update current repository/setup links;
- preserve clear CADAM/upstream attribution rather than erasing project history.

## Asset cleanup

Inherited assets still exist under `public/`, including Adam/CADAM logos, favicons, launch media and GitHub banners.

Do not delete them by filename alone.

Final sequence:

1. migrate remaining runtime references;
2. migrate current README presentation;
3. search/verify all live references on the Brepia branch;
4. delete only assets that are genuinely unused;
5. remove the temporary `adam-logo.svg` / `Adam-Logo.png` Brepia aliases after direct consumers move to Brepia names.

## Internal names intentionally preserved

### Routing/deployment

`vite.config.ts` and `src/router.tsx` continue to use `/cadam` for the deployed base path. Changing it would change URLs and belongs in a coordinated deployment migration.

### Sentry

External Sentry organization/project identifiers such as `adamcad` remain until the actual external integration is migrated.

### CSS/theme tokens

Internal Tailwind/theme classes such as `bg-adam-*`, `text-adam-*` and `border-adam-*` remain. Renaming them now would create a large noisy diff with negligible product-facing value.

### pCAD compatibility/ops identifiers

Examples intentionally preserved include:

- `PCAD_STEP_EXPORT_*`;
- `pcad-scad2step-sandbox`;
- `.opencode/agents/pcad-*`;
- `.opencode/skills/pcad-*`;
- `@pcad.invalid` synthetic local-auth addresses;
- historical technical documentation.

These require separate migration decisions only when there is a concrete operational benefit.

## Repository rename checkpoint

The repository remains `weaf/pCAD`.

A future rename to **`weaf/brepia`** is an explicit checkpoint, preferably after the visual identity is stable and the regression gate passes.

Before renaming, audit/update:

- clone and remote URLs;
- README badges/source links;
- application GitHub links;
- CI/deployment integrations;
- webhooks/external services;
- scripts/docs that assume a `pCAD` repository/directory name;
- local developer/agent remotes;
- reliance on GitHub's old-name redirect.

Repository naming and internal compatibility identifiers remain separate decisions.

## Validation status

No test/typecheck/lint/build success is claimed yet for this branch.

A previous local checkout/typecheck attempt from the assistant execution environment was blocked because that environment could not resolve `github.com`.

Required validation on the real project environment:

```bash
npm run typecheck
npm run lint
```

Final merge gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Also perform real visual checks on desktop/mobile and relevant light/dark surfaces before merge.

## Recommended next implementation order

### Step 1 — remaining runtime cleanup

- inspect remaining direct Adam/CADAM artwork references on the Brepia branch;
- finish simple loaders in smaller components;
- defer broad rewrites of large chat/provider/editor files.

### Step 2 — direct-reference and prompt cleanup

- replace temporary legacy asset aliases with direct Brepia component/asset references;
- resolve the `CADAM Original` built-in prompt-profile strategy;
- verify `AnimatedEllipsis` consumers before retiring/refactoring it.

### Step 3 — legal/current docs

- resolve actual legal/contact wording;
- rebrand legal headers/current service identity;
- rewrite README current presentation with upstream attribution.

### Step 4 — asset cleanup and regression gate

- remove genuinely unused inherited assets;
- run desktop/mobile visual checks;
- run auth/editor/viewer/export checks;
- execute tests/typecheck/lint/build.

### Step 5 — post-remake repository/deployment decisions

- decide `weaf/pCAD` → `weaf/brepia`;
- separately decide whether `/cadam` should later move to `/brepia`, `/`, or a Brepia subdomain with redirects.

## Open decisions

1. Exact final Brepia mark geometry and wordmark spacing.
2. Exact accent/gradient policy after visual testing.
3. Final use of `by Noty` vs `by Noty Design` on secondary surfaces (current preference: `by Noty`).
4. Whether the inherited CADAM Discord link remains anywhere in Brepia.
5. Actual legal contact/entity wording replacing AdamCAD contact details.
6. Built-in prompt-profile strategy for `CADAM Original`.
7. Future deployment path beyond the compatibility `/cadam` path.
8. Future repository rename, with `weaf/brepia` as the natural candidate.

## Audit outcome

The remake continues to fit safely inside a presentation-focused branch.

The governing rule remains:

> **Rebrand user-facing presentation while deliberately preserving compatibility identifiers and real behavioral semantics.**
