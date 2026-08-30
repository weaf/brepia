# Brepia Settings UX and appearance plan

Status: **IMPLEMENTATION COMPLETE on `feature/post-merge-functionality`; Phase 6 manual/regression gate pending**

This plan covers usability, responsiveness, appearance, and accessibility improvements for the Brepia Settings experience. It is intentionally separate from Parametric/Creative runtime behavior, AI prompt/profile optimization, and stable-runtime recovery.

## Goals

- Preserve the current Brepia dark visual identity as the default appearance.
- Make Settings use available desktop/tablet space without becoming unnecessarily wide for simple account content.
- Make Settings predictable and usable on narrow mobile screens without hidden horizontal navigation being required for normal use.
- Add a first-class `System / Light / Dark` application appearance preference.
- Keep the 3D viewer background brightness control independent from the application appearance.
- Improve discoverability and reduce technical density for ordinary users without removing advanced controls.
- Meet practical WCAG 2.2 expectations for reflow, contrast, focus visibility, and pointer/touch target size.
- Preserve all existing settings behavior, permissions, AI model/profile semantics, and stable-runtime architecture.

## Baseline observations

The original implementation was functional but had several UX constraints:

- `SettingsView` used a single `max-w-xl` content width for Account, AI, Administration, and Debug. This was reasonable for Account but unnecessarily constrained AI and administration controls on desktop.
- The root Settings flex layout vertically centered short pages, so the page heading moved significantly when switching between a short Account page and a long AI page.
- AI settings already contained responsive grids, but the narrow parent prevented those layouts from making good use of desktop width.
- Top-level Settings and AI subsection navigation used horizontally scrollable tab lists with hidden scrollbars. Phase 2 replaced those hidden-scroll dependencies with wrapping primary tabs, a mobile AI section selector, and desktop side navigation.
- The CSS bundle already contained generic light/dark variables while Brepia surfaces used fixed `adam-*` palette utilities. Phase 3 routes the core Brepia palette through semantic appearance tokens while retaining the existing utility names as a compatibility layer.
- The Phase 4 review found that the remaining AI-settings density was primarily information-hierarchy rather than width/navigation: common default-model choices shared the same `Models` surface as the expert model catalog, while AI profile was a separate peer section.
- Phase 5 identified two concrete accessibility issues rather than a need for broad redesign: dense expert controls had sub-40 px targets on mobile, and several tertiary/neutral grayscale tokens were too low-contrast for small normal text.

## UX invariants

- Do not redesign Brepia broadly or replace the existing visual language.
- Do not change Parametric, Creative, model routing, prompt/profile, Supabase, or stable-runtime behavior as part of this plan.
- Do not couple application theme to the 3D viewer background slider.
- Existing admin/debug visibility rules remain unchanged.
- Destructive actions remain clearly separated and confirmed.
- Existing conversation/model/profile pinning semantics remain unchanged.
- Prefer CSS/layout changes and small reusable UI primitives over page-specific viewport hacks.

## Phase 1 — Responsive Settings shell

Goal: fix the desktop width/top-alignment problem before changing navigation or theme.

Implementation checkpoint: `a708226a649a663b303ac1a46b8514e9a49d3fce`.

- [x] Keep all Settings sections aligned to a stable top position when switching tabs.
- [x] Keep Account content at a comfortable reading width.
- [x] Allow AI, Administration, and Debug content to use a wider desktop workspace (roughly 960–1050 px maximum).
- [x] Keep full-width mobile behavior with safe 16 px side padding.
- [ ] Ensure no new horizontal document overflow is introduced in real desktop/mobile review.
- [ ] Verify existing Account actions and AI controls still render correctly.

Acceptance — retain for Phase 6 manual review:

- [ ] Account and AI headings do not jump vertically when switching tabs.
- [ ] Long model names/selects gain useful desktop width.
- [ ] Account does not become excessively wide.
- [ ] 320–390 px mobile widths remain usable without document-level horizontal scrolling.

## Phase 2 — Responsive Settings navigation

Goal: remove dependence on hidden horizontal tab scrolling.

Implementation checkpoint: `c5abec6c96592a5a031a8c21aec101cfb541b020`.

Desktop/tablet:

- [x] Keep the primary `Account / AI / Administration / Debug` navigation compact and obvious. The primary list wraps instead of relying on hidden horizontal overflow.
- [x] Convert the larger AI subsection set into a left-side section navigation with content to the right at desktop/tablet widths.

Mobile:

- [x] Replace horizontally hidden AI subsection tabs with an explicit `Section` selector.
- [x] Keep the currently selected section visible at all times through the controlled selector value.
- [x] Avoid nested horizontal tab strips for normal navigation. The Prompts subsection tabs wrap instead of scrolling horizontally.
- [x] Preserve keyboard navigation and accessible labels by retaining Radix tab semantics on desktop and using the existing accessible Select primitive on mobile.

Acceptance — retain for Phase 6 manual review:

- [ ] Every Settings and AI section is discoverable at 320 px without horizontal swiping to reveal hidden navigation.
- [ ] Desktop users can move between AI sections without losing useful content width.
- [ ] Primary Settings navigation remains clear when Administration and Debug are both visible.
- [ ] Prompt subsection controls remain readable and usable at narrow phone widths.

## Phase 3 — Application appearance: System / Light / Dark

Goal: add a real application-level appearance preference while preserving current dark mode as the default Brepia look.

Implementation checkpoint: `949d605a56c8c9467ba240289b0106c52ca37cb9`.

- [x] Add an `Appearance` control under Account with `System`, `Light`, and `Dark` choices.
- [x] Use `prefers-color-scheme` when `System` is selected, including a live media-query listener for OS changes.
- [x] Persist the preference locally with the `brepia-appearance` key; no database migration or account contract was introduced.
- [x] Apply `color-scheme` to the document so native controls follow the resolved appearance.
- [x] Introduce semantic Brepia surface/text/border tokens and map the existing dark palette to them first. Existing `adam-*` utilities remain as compatibility aliases rather than forcing a broad component rewrite.
- [x] Add a light palette with corresponding surface/text hierarchy.
- [x] Route shared layout/navigation/settings palette aliases through the semantic tokens so existing shared surfaces can follow appearance without changing their functional components.
- [x] Remove the high-risk hardcoded dark/white combinations from the main authentication, email-confirmation, legal-notice, and History menu surfaces so Light does not render white text on light surfaces or isolated dark popups.
- [x] Keep the 3D viewer background brightness preference independent. Appearance changes only document/UI theme state; viewer brightness continues through the existing viewer-specific brightness props/state.

Implementation notes:

- The default for users with no stored preference remains `Dark`, preserving the Brepia baseline.
- `src/routes/__root.tsx` applies the stored/resolved appearance before the application stylesheet paints to avoid a light/dark flash on reload.
- The React provider deliberately starts from the same dark server snapshot and reconciles stored state after hydration, avoiding a server/client Settings-selection mismatch.
- `tests/appearance.test.ts` covers accepted preference values and explicit/System resolution logic.
- The user menu also exposes a compact `System / Light / Dark` quick switcher (`ca8218dadd76a05099c2e59d79a812107487ee19`) while the full Appearance setting remains available under Account.
- The light-theme cleanup through `949d605a56c8c9467ba240289b0106c52ca37cb9` is styling-only: History menus, sign-in/sign-up/password/email-confirmation surfaces, and instance legal notices use the semantic Brepia palette. No authentication, AI, Creative, Parametric, Supabase, or stable-runtime behavior was changed.
- User visual review after the cleanup reported the result looked good. This closes the broad Dark-baseline and major Light-surface visual checks, but does not by itself prove System live switching, reload persistence/no-flash, or viewer-brightness independence.
- The mobile Sheet close control was corrected in `4f5b28807aae4d0e98ef1413238523ea4cc4b699`: it now uses theme-aware foreground/hover colors, a 40 px target, visible focus ring and reduced-motion handling.

Acceptance:

- [x] Dark appearance remains visually consistent with the current Brepia baseline based on user visual review.
- [x] Light appearance is complete enough that no major application surface remains accidentally dark-only or visibly broken based on user visual review.
- [ ] System mode visibly updates when the operating-system preference changes.
- [ ] Reloading the app preserves an explicit Light/Dark choice without a theme flash.
- [ ] Application appearance remains visually and behaviorally independent from viewer background brightness.

## Phase 4 — Settings information hierarchy

Goal: reduce technical density without removing expert functionality.

Implementation checkpoint: `8c2303ce971cb07173d673ee7e8289784bcb95f2`.

- [x] Review the AI landing experience after Phases 1–3 before changing information architecture. The review found that the flat seven-section navigation was usable, but common defaults were still mixed with expert model-catalog controls.
- [x] Keep common choices immediately accessible. `General` is the default AI section and contains both Parametric/Creative default models and the AI profile.
- [x] Group model catalog, local models, prompts, runtime, providers, and vision as advanced configuration. Desktop navigation and the mobile section selector expose explicit `Common` and `Advanced` grouping.
- [x] Do not hide functionality behind an irreversible simplified mode. All previous sections remain directly reachable; only component placement and labels changed.

Reconciliation note:

- The earlier plan text mentioned a separate `Creative controller AI` common choice. Current `user_ai_preferences` / AI-settings schemas contain Parametric default, Creative 3D default, AI profile, vision defaults, prompt/profile defaults and runtime overrides, but no distinct persisted Creative-controller preference. Phase 4 therefore does not invent a new controller setting as part of UX work.

Implementation notes:

- `DefaultModelSettings` and `InstructionProfileSettings` are rendered together under `General`; their existing query/mutation behavior is unchanged.
- The previous expert `AiModelsSettings` panel is `Model catalog` under `Advanced` rather than sharing the same landing surface as default-model selection.
- `Local Models`, `Prompts`, `Runtime`, `Providers`, and `Vision` retain their existing components and behavior.
- Desktop group labels are presentation-only inside the Radix tab list so they do not become additional keyboard tabs; the mobile selector uses Radix Select groups/labels.

Acceptance:

- [x] AI opens on `General` with Default models and AI profile immediately visible in user visual review.
- [x] `Model catalog` and the advanced grouping remain clearly discoverable in user visual review.
- [x] The new grouping reduces perceived technical density without hiding or changing any setting; user review reported that it looks good.
- [ ] General and advanced sections remain usable at narrow mobile widths; retain for the explicit responsive gate rather than infer it from desktop review.

## Phase 5 — Accessibility and interaction polish

### Phase 5A — core Settings controls

Interaction checkpoint: `281eb0c05de53b6c201dfc56bf2c1f19f9b11d42`.

- [x] Increase the primary Settings tabs, desktop AI section tabs and Prompt subsection tabs to practical 40 px minimum targets while preserving existing Radix keyboard semantics.
- [x] Increase Account action buttons and the editable-name input to a practical 40 px minimum target without changing their actions.
- [x] Give the Notifications switch an explicit accessible name and description through `aria-labelledby` / `aria-describedby`.
- [x] Mark the Appearance choices as an explicitly labelled control group while retaining `aria-pressed` on each choice, so selection is not communicated by color alone.
- [x] Add `prefers-reduced-motion` handling to the Settings/AI tab and Appearance transitions introduced or touched by this UX work.
- [x] Retain visible `focus-visible` rings already provided by the Radix/shared primitives on tabs, selects, buttons and switches; the Appearance buttons retain their explicit two-pixel focus ring.

### Phase 5B — contrast and remaining dense controls

Implementation checkpoint: `9030163aac4e67b29f3c3faf416eb39faa778887`.

- [x] Complete the contrast pass without broadly changing primary/secondary Brepia colors. In Dark, tertiary text is raised from RGB 103 to 132 (~4.66:1 against the 25/26 canvas), `neutral-400` to RGB 140 (~5.19:1), and `neutral-500` to RGB 132 (~4.66:1). In Light, `neutral-500` is lowered from RGB 148 to 110 (~4.72:1 against the 246 canvas). This addresses the previously identified small-text/placeholder contrast gap while preserving visual hierarchy.
- [x] Improve dense mobile controls through shared primitives instead of per-panel hacks: `size="sm"` buttons now retain a 40 px minimum target below the `sm` breakpoint, Select triggers/items have practical minimum targets, and Inputs retain at least 40 px even when expert panels request compact heights.
- [x] Increase the Switch interaction box to 40 px while keeping the visible track at its existing ~24 px size. The checked/unchecked state continues to use Radix state plus thumb position, so it is not communicated by color alone.
- [x] Strengthen keyboard focus: shared buttons/selects use two-pixel focus rings and application links now receive a visible two-pixel Brepia-blue `:focus-visible` outline.
- [x] Verify selected/disabled/error semantics in the advanced-control patterns: filter choices use `aria-pressed`, Radix switches/selects expose programmatic state, disabled controls use the native/Radix disabled state, and errors retain explicit error text rather than color-only signaling.
- [x] Add application-level `prefers-reduced-motion` fallback that effectively removes nonessential CSS animation/transition duration while preserving state changes.
- [x] Fix the shared Sheet close control (`4f5b28807aae4d0e98ef1413238523ea4cc4b699`) so its theme contrast, keyboard focus and touch target satisfy the same interaction baseline.
- [ ] Verify actual 200% zoom/reflow and 320–390 px rendering in a browser. This is a runtime/visual acceptance check and is intentionally left to Phase 6 rather than claimed from static code inspection.

No Phase 5 change modifies AI model/profile values, provider/runtime behavior, Creative/Parametric behavior, Supabase contracts, authentication behavior or stable-runtime recovery.

## Phase 6 — Visual and regression gate

This is the only remaining phase. No additional UX implementation is planned unless this gate finds a concrete regression.

Desktop review:

- [ ] Account
- [ ] AI / General
- [ ] AI / Model catalog
- [ ] AI / Local Models
- [ ] AI / Prompts
- [ ] AI / Runtime
- [ ] AI / Providers
- [ ] AI / Vision
- [ ] Administration (admin only)
- [ ] Debug (when enabled)

Responsive/reflow review:

- [ ] ~320 px phone
- [ ] ~390 px phone
- [ ] tablet/narrow desktop
- [ ] standard desktop
- [ ] wide desktop
- [ ] 200% browser zoom/reflow
- [ ] no document-level horizontal scrolling in Settings

Appearance review:

- [ ] System follows an OS appearance change while Brepia is open
- [x] Light — broad visual review reported good after the Phase 3 cleanup; recheck the final Phase 5 contrast polish
- [x] Dark — broad visual review reported good after the Phase 3 cleanup; recheck the final Phase 5 contrast polish
- [ ] explicit Light/Dark survives reload without a visible wrong-theme flash
- [ ] app appearance remains independent from viewer background brightness
- [ ] mobile sidebar Sheet close control remains visible in both Light and Dark

Interaction/accessibility spot check:

- [ ] keyboard through top Settings tabs and desktop AI navigation
- [ ] keyboard through mobile AI selector, buttons, links and switches
- [ ] focus indicator remains visible in both themes
- [ ] dense Model catalog / Local Models / Providers controls remain practical on phone widths
- [ ] disabled and error states remain understandable without relying on color alone

Repository gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The current execution environment could not run this gate: a clean checkout attempt failed because it could not resolve `github.com`, and the current branch head has no GitHub Actions workflow run. Keep the repository gate unchecked until these commands are run in the normal project environment.

## Execution rule

Implementation is complete. Run Phase 6 as the closeout gate. If the gate finds a concrete UX regression, fix only that regression and rerun the affected checks; do not reopen broad redesign or change AI/Creative/Parametric/stable-runtime functionality as part of UX closeout.
