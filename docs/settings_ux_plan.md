# Brepia Settings UX and appearance plan

Status: **ACTIVE on `feature/post-merge-functionality`**

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

The current implementation is functional but has several UX constraints:

- `SettingsView` used a single `max-w-xl` content width for Account, AI, Administration, and Debug. This was reasonable for Account but unnecessarily constrained AI and administration controls on desktop.
- The root Settings flex layout vertically centered short pages, so the page heading moved significantly when switching between a short Account page and a long AI page.
- AI settings already contain responsive grids, but the narrow parent prevented those layouts from making good use of desktop width.
- Top-level Settings and AI subsection navigation used horizontally scrollable tab lists with hidden scrollbars. Phase 2 replaces those hidden-scroll dependencies with wrapping primary tabs, a mobile AI section selector, and desktop side navigation.
- The CSS bundle already contained generic light/dark variables while Brepia surfaces used fixed `adam-*` palette utilities. Phase 3 now routes the core Brepia palette through semantic appearance tokens while retaining the existing utility names as a compatibility layer.
- Secondary text and compact controls should be checked for contrast and mobile target size rather than adjusted by visual guesswork.

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

Acceptance — pending visual review:

- [ ] Account and AI headings do not jump vertically when switching tabs.
- [ ] Long model names/selects gain useful desktop width.
- [ ] Account does not become excessively wide.
- [ ] 320–390 px mobile widths remain usable without document-level horizontal scrolling.

## Phase 2 — Responsive Settings navigation

Goal: remove dependence on hidden horizontal tab scrolling.

Implementation checkpoint: `c5abec6c96592a5a031a8c21aec101cfb541b020`.

Desktop/tablet:

- [x] Keep the primary `Account / AI / Administration / Debug` navigation compact and obvious. The primary list now wraps instead of relying on hidden horizontal overflow.
- [x] Convert the larger AI subsection set into a left-side section navigation with content to the right at desktop/tablet widths.

Mobile:

- [x] Replace horizontally hidden AI subsection tabs with an explicit `Section` selector.
- [x] Keep the currently selected section visible at all times through the controlled selector value.
- [x] Avoid nested horizontal tab strips for normal navigation. The Prompts subsection tabs now wrap instead of scrolling horizontally.
- [x] Preserve keyboard navigation and accessible labels by retaining Radix tab semantics on desktop and using the existing accessible Select primitive on mobile.

Acceptance — pending visual review:

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
- [x] Add a light palette with corresponding surface/text hierarchy. Formal contrast verification remains part of Phase 5.
- [x] Route shared layout/navigation/settings palette aliases through the semantic tokens so existing shared surfaces can follow appearance without changing their functional components.
- [x] Remove the high-risk hardcoded dark/white combinations from the main authentication, email-confirmation, legal-notice, and History menu surfaces so Light does not render white text on light surfaces or isolated dark popups.
- [x] Keep the 3D viewer background brightness preference independent. Appearance changes only document/UI theme state; viewer brightness continues through the existing viewer-specific brightness props/state.

Implementation notes:

- The default for users with no stored preference remains `Dark`, preserving the Brepia baseline.
- `src/routes/__root.tsx` applies the stored/resolved appearance before the application stylesheet paints to avoid a light/dark flash on reload.
- The React provider deliberately starts from the same dark server snapshot and reconciles stored state after hydration, avoiding a server/client Settings-selection mismatch.
- `tests/appearance.test.ts` covers accepted preference values and explicit/System resolution logic.
- The user menu also exposes a compact `System / Light / Dark` quick switcher (`ca8218dadd76a05099c2e59d79a812107487ee19`) while the full Appearance setting remains available under Account.
- The light-theme cleanup through `949d605a56c8c9467ba240289b0106c52ca37cb9` is styling-only: History menus, sign-in/sign-up/password/email-confirmation surfaces, and instance legal notices now use the semantic Brepia palette. No authentication, AI, Creative, Parametric, Supabase, or stable-runtime behavior was changed.
- The semantic compatibility layer intentionally does not change AI settings values, model/profile behavior, Creative/Parametric behavior, Supabase contracts, or stable-runtime logic.

Acceptance — pending visual/runtime review:

- [ ] Dark appearance remains visually consistent with the current Brepia baseline.
- [ ] Light appearance is complete enough that no major application surface remains accidentally dark-only or low-contrast.
- [ ] System mode visibly updates when the operating-system preference changes.
- [ ] Reloading the app preserves an explicit Light/Dark choice without a theme flash.
- [ ] Application appearance remains visually and behaviorally independent from viewer background brightness.

## Phase 4 — Settings information hierarchy

Goal: reduce technical density without removing expert functionality.

- [ ] Review the AI landing experience after Phases 1–3 before changing information architecture.
- [ ] Keep common choices immediately accessible: Parametric default, Creative 3D default, Creative controller AI, AI profile.
- [ ] Group model catalog, local models, prompts, runtime, providers, and vision as advanced configuration if usability review still shows excessive density.
- [ ] Do not hide functionality behind an irreversible simplified mode.

This phase is conditional: do not reorganize the AI settings if the responsive layout/navigation changes already solve the usability problem.

## Phase 5 — Accessibility and interaction polish

- [ ] Audit normal and secondary text contrast in both themes.
- [ ] Ensure visible keyboard focus on tabs, selectors, buttons, switches, and links.
- [ ] Check mobile pointer/touch targets; aim for approximately 40–44 px practical targets even where WCAG minimum spacing would technically pass.
- [ ] Verify selected/disabled/error states do not rely on color alone.
- [ ] Check zoom/reflow at 200% and narrow viewport widths.
- [ ] Respect reduced-motion preferences for nonessential UI transitions.

## Phase 6 — Visual and regression gate

Desktop review:

- [ ] Account
- [ ] AI / Models
- [ ] AI / Profiles
- [ ] AI / Local Models
- [ ] AI / Prompts
- [ ] AI / Runtime
- [ ] AI / Providers
- [ ] AI / Vision
- [ ] Administration (admin only)
- [ ] Debug (when enabled)

Responsive review:

- [ ] ~320 px phone
- [ ] ~390 px phone
- [ ] tablet/narrow desktop
- [ ] standard desktop
- [ ] wide desktop

Appearance review:

- [ ] System
- [ ] Light
- [ ] Dark
- [ ] app appearance independent from viewer background brightness

Repository gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The GitHub connector used for the implementation does not provide a local dependency/runtime environment, and this branch currently has no GitHub Actions run for the appearance checkpoint. Keep the repository gate unchecked until those commands are run in the normal project environment.

## Execution rule

Implement one phase or narrowly scoped sub-phase at a time. After each visible UX change, perform desktop and mobile review before broadening the scope. Do not combine theme migration, navigation restructuring, and unrelated application behavior in one large change.
