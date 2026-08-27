# Brepia remake — status and audit

Branch: `feature/brepia-remake`
Base: `967f744976d3ae2fb64f3681745c8c046345499a`
Last updated: 2026-08-27

Companion plan: `docs/brepia_remake_plan.md`
Brand maintenance note: `docs/brepia_branding.md`

## Current state

- [x] Branch created from the recorded `master` base.
- [x] Brepia product/brand concept and rename boundaries recorded in-repo.
- [x] Initial branding, asset, icon and loading audit completed.
- [x] Shared Brepia primitives implemented: `BrepiaMark`, `BrepiaBrand`, `ActivityIndicator`.
- [x] Browser title, metadata, favicon and web-app manifest switched to Brepia.
- [x] Desktop/mobile sidebar primary branding switched to Brepia.
- [x] Auth/password surfaces switched to `BrepiaBrand`.
- [x] Home/start copy uses rotating Brepia-specific prompts.
- [x] Upstream Adam product banner removed from the Brepia home surface.
- [x] Assistant loading, normal assistant avatar and prompt avatar directly use Brepia components.
- [x] Generated GIF/live-preview watermark switched to Brepia.
- [x] GLB generation preview now morphs from a Brepia point-cloud mark instead of the Adam logo.
- [x] Primary global/auth/import/viewer/settings/share/export busy states migrated to the Brepia activity language.
- [x] README rewritten as the current Brepia product presentation with explicit CADAM upstream attribution.
- [x] Brepia brand-maintenance documentation added.
- [x] First large batch of now-unused Adam/CADAM public artwork removed.
- [ ] Remaining large-file spinner/copy cleanup complete.
- [ ] Prompt-profile `CADAM Original` migration decision resolved — intentionally deferred until the end.
- [ ] Legal/current-product pages resolved and rebranded.
- [ ] All remaining legacy visual assets removed.
- [ ] Desktop/mobile visual regression review complete.
- [ ] Final test/typecheck/lint/build gate complete.

## Brand system

### Shared components

Under `src/components/brand/`:

- `BrepiaMark` — open node-based wireframe/B-Rep mark with accent and monochrome modes;
- `BrepiaBrand` — mark + `BREPIA` wordmark with optional `by Noty` secondary lockup;
- `ActivityIndicator` — quiet pulsing indeterminate activity state with reduced-motion support;
- shared exports in `src/components/brand/index.ts`.

### Current public assets

- `public/brepia-mark.svg`
- `public/brepia-logo.svg`
- `public/brepia-watermark.svg`
- `public/site.webmanifest`

Current accent prototype uses the existing product blue (`#00A6FF`) into violet. Exact colour/spacing decisions remain open until visual review in the running application.

## Browser/app metadata

`src/routes/__root.tsx`

- title is `Brepia`;
- favicon uses `brepia-mark.svg`;
- product description is `AI-assisted parametric 3D design`;
- theme colour is defined;
- `site.webmanifest` is linked.

The deployed router/base path remains `/cadam` intentionally. Display identity and deployment compatibility remain separate migrations.

## Sidebar and source identity

`src/components/Sidebar.tsx`

- expanded sidebar uses `BrepiaBrand`;
- collapsed sidebar uses `BrepiaMark`;
- mobile accessibility copy describes Brepia;
- source link points to `https://github.com/weaf/pCAD`.

The inherited CADAM Discord link remains an explicit later product/community decision and must not be silently represented as a Brepia-owned community.

## Home/start surface

`src/views/PromptView.tsx`

The inherited `NewProductBanner` render/import was removed and `src/components/NewProductBanner.tsx` was deleted. The component actively promoted the separate/upstream Adam product and therefore did not belong in Brepia chrome.

Start-page copy is now owned by `src/lib/homePromptCopy.ts` rather than hard-coded inherited copy. Current messages include:

- `Bring your idea to life with Brepia...`
- `Shape your idea with Brepia...`
- `Turn an idea into geometry with Brepia...`
- `Create something new with Brepia...`
- `What will you create with Brepia?`

One line is selected per home-page mount. `sessionStorage` remembers the previous line so immediate revisits/reloads do not repeat the same message when alternatives exist.

`tests/homePromptCopy.test.ts` covers the selection behavior, but that test has **not yet been executed in the real project environment**.

## Authentication

Shared `BrepiaBrand showByNoty` is used on:

- `src/views/SignInView.tsx`
- `src/views/SignUpView.tsx`
- `src/views/SignUpEmailView.tsx`
- `src/views/ResetPasswordView.tsx`
- `src/views/UpdatePasswordView.tsx`

Auth routes, provider behavior and authentication semantics were not changed.

The synthetic local username mapping remains exactly:

```text
<username>@pcad.invalid
```

This is a compatibility identifier, not presentation branding.

## Chat and assistant identity

### Assistant loading

`src/components/chat/AssistantLoading.tsx` uses `BrepiaMark` + `ActivityIndicator`.

### Normal assistant messages

`src/components/chat/MessageBubble.tsx` now directly renders `BrepiaMark` in the assistant avatar. The migration commit was inspected and confirmed as a narrow avatar/import change plus a branding comment update.

The temporary `public/adam-logo.svg` Brepia compatibility alias has therefore been deleted.

### Prompt surface

`src/components/TextAreaChat.tsx` now directly uses:

- `BrepiaMark` for the prompt avatar;
- `ActivityIndicator` for image upload, mesh upload and prompt-generation waits;
- `What will you create with Brepia?` as the component-level fallback placeholder.

The home page still passes its rotating prompt text explicitly.

Compatibility-sensitive local-storage keys remain unchanged:

- `adam-mesh-topology`
- `adam-polygon-overrides`

The temporary `public/Adam-Logo.png` Brepia compatibility alias has been deleted.

The TextAreaChat whole-file migration was immediately inspected through the commit diff. Runtime changes were limited to the intended branding/loading paths and fallback copy; a few explanatory JSX comments were dropped as harmless diff noise. No upload/model/transport/localStorage behavior was intentionally changed.

## Generated media and notifications

### GIF/live preview

`src/components/viewer/MeshGifPreview.tsx`

- live overlay uses `brepia-watermark.svg`;
- the same Brepia watermark is baked into generated GIF frames;
- inherited bottom-right sizing/placement remains unchanged;
- GIF rendering, quantization, frame generation and `setProgress` behavior remain unchanged;
- indeterminate empty-preview loading uses `ActivityIndicator`.

### GLB point-cloud transition

`src/components/viewer/GlbPreview.tsx`

- inherited Adam point-cloud artwork was replaced by a Brepia wireframe/B-Rep point set;
- the existing dissolve/diffusion animation into the generated GLB remains;
- shader, load and animation timing behavior were not intentionally changed.

`src/utils/brepiaLogoVertices.ts` now owns the Brepia point geometry. The former `src/utils/adamLogoVertices.ts` was removed after its only runtime consumer migrated.

### Desktop notifications

`src/contexts/AuthProvider.tsx` uses `brepia-mark.svg` for model-completion notifications.

## Activity/loading migration

`ActivityIndicator` now replaces rotating `Loader2` indicators on primary simple/indeterminate waits including:

- application and auth bootstrap;
- sign-in/password/magic-link/OTP flows;
- sign-up/registration-policy/account creation;
- local and GitHub SCAD import;
- assistant loading;
- prompt image/mesh upload and prompt generation;
- image viewer;
- mesh/GIF preview;
- share/GIF generation states;
- avatar upload/save;
- OpenSCAD compilation overlay;
- settings/admin/local-model/Vision waits;
- public shared-conversation loading;
- desktop/mobile parametric DXF/STEP export.

Actual determinate progress remains determinate. In particular GIF percentage/progress behavior was preserved.

Remaining large files such as `ProvidersSettings.tsx`, `AiModelsSettings.tsx`, `DownloadMenu.tsx`, `EditorView.tsx` and parts of `MessageBubble.tsx` still need targeted review for simple residual spinners. Do not broadly rewrite them just for cosmetics.

## Viewer/export product copy

`src/components/viewer/OpenSCADViewer.tsx`

- compile wait uses `ActivityIndicator`;
- visible error copy names Brepia;
- OpenSCAD compile/render behavior is unchanged.

`src/components/parameter/ParameterSection.tsx` and `ParameterSheetContent.tsx`

- desktop and mobile export waits use `ActivityIndicator`;
- fallback DXF/STEP errors name Brepia;
- STL/SCAD/DXF/STEP dispatch, STEP service calls and workspace persistence remain unchanged.

`src/components/viewer/DownloadMenu.tsx` still requires a targeted final pass. In addition to remaining spinners, exported OBJ/MTL content still contains an inherited `Generated by Adam` metadata comment. That output-file branding must become Brepia without changing export algorithms.

## README/current public presentation

`README.md` is now a Brepia README rather than an inherited CADAM landing page.

It now covers the current product, including:

- AI-assisted parametric OpenSCAD modelling/editing;
- parameters and live preview;
- local/hosted/OpenCode/Codex model paths;
- CLI/streaming OpenCode execution;
- vision routing;
- OpenSCAD import/editing;
- STL/SCAD/DXF/STEP export;
- current `weaf/pCAD` clone path;
- regression-gate commands;
- Brepia brand-maintenance references.

A dedicated origin section explicitly attributes the upstream Adam-CAD/CADAM project instead of erasing project history.

## Public asset cleanup

Removed after their consumers migrated:

- `public/cadam-launch.gif`
- `public/Github-Banner-Dark.png`
- `public/Github-Banner-Light.png`
- `public/adam-logo-full.svg`
- `public/adam-logo-pink.svg`
- `public/adam-icon.ico`
- `public/cadam-icon.ico`
- `public/cadam-icon.svg`
- `public/adam-logo.svg`
- `public/Adam-Logo.png`

`public/cadam-logo.svg` remains because legal pages still consume it. Do not delete it until Terms/Privacy are deliberately migrated.

## Prompt-profile migration boundary

`src/components/settings/PromptProfilesSettings.tsx` still exposes `CADAM Original` in several places.

This is intentionally deferred until the end of the remake at the user's request.

It is not a blind cosmetic replacement because the built-in profile participates in real profile semantics:

- overlays are described relative to the built-in prompt;
- forks record a base revision/fingerprint;
- stale-fork warnings refer to built-in prompt lineage;
- the API uses built-in profile semantics independently of its display label.

Before renaming `CADAM Original`, inspect the actual built-in prompt and decide whether Brepia should preserve the inherited lineage, rename display identity only, or introduce a genuine Brepia built-in revision. Internal IDs need not change merely because the display label does.

## Legal/current-product pages

Still pending:

- `src/views/TermsOfServiceView.tsx`
- `src/views/PrivacyPolicyView.tsx`

They contain inherited CADAM/AdamCAD presentation and `hello@adamcad.com` contact wording.

Rules:

- do not invent a legal entity or contact email;
- preserve effective dates until deliberately revised;
- move visual/service identity to Brepia only together with an explicit decision on actual contact/entity wording.

## Internal names intentionally preserved

### Routing/deployment

`vite.config.ts` and `src/router.tsx` continue to use `/cadam`. A later deployment migration can move this with redirects once hosting is coordinated.

### Sentry

External Sentry organization/project identifiers such as `adamcad` remain until the actual external integration is migrated.

### CSS/theme tokens

Tailwind/theme classes such as `bg-adam-*`, `text-adam-*` and `border-adam-*` remain internal implementation tokens. Renaming them would create a large low-value diff.

### pCAD compatibility/ops identifiers

Examples intentionally preserved include:

- `PCAD_STEP_EXPORT_*`
- `pcad-scad2step-sandbox`
- `.opencode/agents/pcad-*`
- `.opencode/skills/pcad-*`
- `@pcad.invalid`
- compatibility-sensitive local-storage/database/storage identifiers
- historical technical documentation.

## Repository rename checkpoint

The repository remains `weaf/pCAD`.

A future rename to **`weaf/brepia`** remains the natural candidate, preferably after the visual identity is stable and the regression gate passes.

Before renaming, update/audit clone/remotes, README/source links, CI/deployment integrations, webhooks/services, scripts/docs, local agent environments and reliance on GitHub redirects.

Repository naming and internal compatibility identifiers remain separate decisions.

## Validation status

No full test/typecheck/lint/build success is claimed yet for this branch.

A previous checkout/typecheck attempt from the assistant execution environment was blocked by that environment's GitHub/DNS access. The new focused `homePromptCopy` test is present but not yet run in the real development environment.

Required final gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Also perform real visual checks on desktop/mobile and relevant light/dark surfaces before merge.

## Recommended next implementation order

1. Target `DownloadMenu.tsx`: exported `Generated by Adam` metadata + simple download/print spinners only.
2. Finish remaining small/simple indeterminate waits in `AiModelsSettings`, `ProvidersSettings`, `EditorView` and `MessageBubble` without touching provider/editor/chat behavior.
3. Audit remaining live Adam/CADAM artwork/copy on the Brepia branch.
4. Resolve actual legal/contact wording and migrate Terms/Privacy; then remove `cadam-logo.svg` if no consumer remains.
5. Perform desktop/mobile visual review and adjust mark spacing/accent details.
6. Run full regression gate.
7. At the end, resolve `CADAM Original` prompt-profile lineage/display migration.
8. After the branch is stable, decide whether to rename `weaf/pCAD` to `weaf/brepia` and whether `/cadam` later gets a deployment-path migration.

## Open decisions

1. Exact final Brepia mark geometry and wordmark spacing.
2. Exact accent/gradient policy after visual testing.
3. Final use of `by Noty` vs `by Noty Design` on secondary surfaces; current preference remains `by Noty`.
4. Whether the inherited CADAM Discord link remains anywhere in Brepia.
5. Actual legal contact/entity wording replacing AdamCAD details.
6. Built-in prompt-profile strategy for `CADAM Original` — intentionally last.
7. Future deployment path beyond compatibility `/cadam`.
8. Future repository rename, with `weaf/brepia` as the natural candidate.

## Audit outcome

The remake remains presentation-focused and the core architecture is still intentionally outside scope.

> **Rebrand user-facing presentation while deliberately preserving compatibility identifiers and real behavioral semantics.**
